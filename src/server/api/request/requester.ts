import axios from 'axios';
import * as debug from 'debug';
import * as express from 'express';
import * as Joi from 'joi';
import { Issuer } from 'openid-client';
import * as jwkToPem from 'jwk-to-pem';
import * as jwt from 'jsonwebtoken';

import { createA } from '../../helpers/a';
import { getGitHubAppInstallationToken } from '../../helpers/auth';
import { validate } from '../../helpers/_middleware';
import { Project, OTPRequest } from '../../db/models';
import { getResponderFor } from '../../responders';
import { Requester } from '../../requesters/Requester';
import { projectIsMissingConfig } from '../../../common/types';

const d = debug('cfa:api:request:requester');
const a = createA(d);

const getRequestReadyProject = (projectId: string) =>
  Project.findOne({
    where: {
      id: projectId,
      enabled: true,
    },
    include: Project.allIncludes,
  });

const getFullRequest = async (projectId: string, requestId: string) => {
  return OTPRequest.findOne({
    where: {
      id: requestId,
      projectId,
    },
    include: [
      {
        model: Project,
        include: Project.allIncludes,
      },
    ],
  });
};

export function createRequesterRoutes<R, M>(requester: Requester<R, M>) {
  const router = express();

  // Middleware to verify the requst is authorized
  router.use(
    `/:projectId/${requester.slug}`,
    validate(
      {
        a,
        params: {
          projectId: Joi.number()
            .integer()
            .required(),
        },
      },
      async (req, res, next) => {
        if ((global as any).__bypassRequesterAuthentication) return next();
        const authHeader = req.header('Authorization');
        if (!authHeader)
          return res.status(403).json({
            error: 'Missing Authorization header',
          });

        const project = await Project.findOne({
          where: {
            id: req.params.projectId,
            enabled: true,
          },
          include: Project.allIncludes,
        });

        const badAuthHeader =
          !project ||
          !authHeader.toLowerCase().startsWith('bearer ') ||
          authHeader.substr('bearer '.length) !== project.secret;
        if (!project || badAuthHeader)
          return res.status(404).json({
            error: 'Project not found, disabled or you are not authorizad to access it',
          });

        if (projectIsMissingConfig(project))
          return res.status(400).json({
            error: 'Project not completely configured',
          });

        next();
      },
    ),
  );

  router.post(`/:projectId/${requester.slug}/test`, (req, res) => res.json({ ok: true }));

  router.post(
    `/:projectId/${requester.slug}/credentials`,
    validate(
      {
        a,
        params: {
          projectId: Joi.number()
            .integer()
            .required(),
        },
        body: {
          token: Joi.string().required(),
        },
      },
      async (req, res) => {
        const project = await getRequestReadyProject(req.params.projectId);
        if (!project) return res.status(404).json({ error: 'Could not find project' });

        const config = requester.getConfigForProject(project);
        if (!config)
          return res.status(422).json({ error: 'Project is not configured to use this requester' });

        const disoveryUrl = await requester.getOpenIDConnectDiscoveryURL(project, config);
        if (!disoveryUrl)
          return res
            .status(422)
            .json({ error: 'Project is not eligible for OIDC credential exchange' });
        const issuer = await Issuer.discover(disoveryUrl);

        if (!issuer.metadata.jwks_uri)
          return res
            .status(422)
            .json({ error: 'Project is not eligible for JWKS backed OIDC credential exchange' });
        const jwks = await axios.get(issuer.metadata.jwks_uri);

        if (jwks.status !== 200)
          return res
            .status(422)
            .json({ error: 'Project is not eligible for JWKS backed OIDC credential exchange' });

        let claims = jwt.decode(req.body.token, { complete: true }) as jwt.Jwt | null;
        if (!claims) return res.status(422).json({ error: 'Invalid OIDC token provided' });
        const key = jwks.data.keys.find(key => key.kid === claims!.header.kid);

        if (!key) return res.status(422).json({ error: 'Invalid kid found in the token provided' });

        const pem = jwkToPem(key);
        try {
          claims = jwt.verify(req.body.token, pem, {
            complete: true,
            algorithms: [key.alg],
          }) as jwt.Jwt | null;
        } catch {
          return res
            .status(422)
            .json({ error: 'Could not verify the provided token against the OIDC provider' });
        }

        if (!claims) return res.status(422).json({ error: 'Invalid OIDC token provided' });

        if (
          !(await requester.doOpenIDConnectClaimsMatchProject(
            claims.payload as jwt.JwtPayload,
            project,
            config,
          ))
        ) {
          return res.status(422).json({ error: 'Provided OIDC token does not match project' });
        }

        let githubToken: string;
        try {
          githubToken = await getGitHubAppInstallationToken(project);
        } catch (err) {
          console.error(err);
          return res.status(422).json({ error: 'Failed to obtain access token for project' });
        }

        return res.json({
          GITHUB_TOKEN: githubToken,
        });
      },
    ),
  );

  router.post(
    `/:projectId/${requester.slug}`,
    validate(
      {
        a,
        params: {
          projectId: Joi.number()
            .integer()
            .required(),
        },
      },
      async (req, res) => {
        const project = await getRequestReadyProject(req.params.projectId);
        if (!project) return res.status(404).json({ error: 'Could not find project' });

        const config = requester.getConfigForProject(project);
        if (!config)
          return res.status(422).json({ error: 'Project is not configured to use this requester' });

        const requestMetadata = await requester.metadataForInitialRequest(req, res);
        // Do not send a response here as metadataForInitialRequest will send the response
        if (!requestMetadata) return;

        const newRequest = await OTPRequest.create(
          {
            projectId: project.id,
            state: 'requested',
            requested: new Date(),
            requestMetadata,
            responseMetadata: {},
            proof: OTPRequest.generateProof(),
          },
          {
            returning: true,
          },
        );
        // Fetch with includes
        const completeRequest = (await getFullRequest(`${project.id}`, newRequest.id))!;
        const request = await requester.isOTPRequestValidForRequester(completeRequest);
        if (!request) return res.status(422).json({ error: 'CFA Requester is misconfigured' });

        const allowedState = await requester.validateActiveRequest(request, config);
        if (!allowedState.ok) {
          request.state = 'error';
          request.errored = new Date();
          request.errorReason = allowedState.error;
          await request.save();
          return res.status(400).json({
            error: 'Invalid build provided, check the CFA dashboard for reasoning.',
          });
        }

        res.json(request);
      },
    ),
  );

  router.post(
    `/:projectId/${requester.slug}/:requestId/validate`,
    validate(
      {
        a,
        params: {
          projectId: Joi.number()
            .integer()
            .required(),
          requestId: Joi.string()
            .uuid({ version: 'uuidv4' })
            .required(),
        },
      },
      async (req, res) => {
        const unknownRequest = await getFullRequest(req.params.projectId, req.params.requestId);
        if (!unknownRequest) {
          return res.status(404).json({
            error: 'That request does not exist or is invalid',
          });
        }

        const request = await requester.isOTPRequestValidForRequester(unknownRequest);
        if (!request)
          return res.status(422).json({ error: 'Project is not configured to use this requester' });

        const config = requester.getConfigForProject(request.project);

        if (!config)
          return res
            .status(422)
            .json({ error: 'Project is missing the required configuration to use this requester' });

        if ((config as any).then)
          return res.status(500).json({
            error: 'getConfigForProject returned a promise-like thing and that is not OK',
          });

        if (request.state !== 'requested') {
          return res.status(400).json({
            error: `Expected the request to be in state "requested" but was in state "${request.state}"`,
          });
        }

        const allowedState = await requester.validateActiveRequest(request, config);
        if (!allowedState.ok) {
          request.state = 'error';
          request.errored = new Date();
          request.errorReason = allowedState.error;
          await request.save();
          return res.status(400).json({
            error: 'Invalid build provided, check the CFA dashboard for reasoning.',
          });
        }

        if (!(await requester.validateProofForRequest(request, config))) {
          request.state = 'error';
          request.errored = new Date();
          request.errorReason =
            'Failed to validate build.  Could not find the proof in the build logs in an adaquete time period.';
          await request.save();
          return res.status(403).json({
            error: 'Failed to validate the build, check the CFA dashboard for reasoning.',
          });
        }

        request.state = 'validated';
        request.validated = new Date();
        await request.save();

        // Fetch just the request with no additional info **before** the responder adds its
        // metadata
        const newRequest = (await OTPRequest.findByPk(request.id))!;

        await getResponderFor<M>(request.project).requestOtp(
          request,
          await requester.getRequestInformationToPassOn(request),
        );

        res.json(newRequest);
      },
    ),
  );

  router.post(
    `/:projectId/${requester.slug}/:requestId`,
    validate(
      {
        a,
        params: {
          projectId: Joi.number()
            .integer()
            .required(),
          requestId: Joi.string()
            .uuid({ version: 'uuidv4' })
            .required(),
        },
      },
      async (req, res) => {
        const request = await OTPRequest.findOne({
          where: {
            id: req.params.requestId,
            projectId: req.params.projectId,
          },
        });
        if (!request)
          return res
            .status(404)
            .json({ error: 'That request does not exist or you do not have permission to see it' });
        if (request.state !== 'responded')
          return res.status(204).json({ error: 'That request does not have a response yet' });
        res.json(request);
      },
    ),
  );

  return router;
}
