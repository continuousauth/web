import axios from 'axios';
import { Request, Response } from 'express';
import * as Joi from 'joi';
import * as jwt from 'jsonwebtoken';

import { Requester, AllowedState } from './Requester';
import { Project, CircleCIRequesterConfig, OTPRequest } from '../db/models';
import { RequestInformation } from '../responders/Responder';

export type CircleCIOTPRequestMetadata = {
  buildNumber: number;
};

export const getAxiosForConfig = (config: CircleCIRequesterConfig) =>
  axios.create({
    baseURL: 'https://circleci.com/api/v1.1',
    auth: {
      username: config.accessToken,
      password: '',
    },
    validateStatus: () => true,
  });

// Unauthenticated
export const getAxiosForConfigV2 = (config: CircleCIRequesterConfig) =>
  axios.create({
    baseURL: 'https://circleci.com/api/v2',
    validateStatus: () => true,
  });

const validateMetadataObject = (object: any) => {
  return Joi.validate(object, {
    buildNumber: Joi.number()
      .min(1)
      .integer()
      .required(),
  });
};

export class CircleCIRequester
  implements Requester<CircleCIRequesterConfig, CircleCIOTPRequestMetadata> {
  readonly slug = 'circleci';

  getConfigForProject(project: Project) {
    return project.requester_circleCI || null;
  }

  async getOpenIDConnectDiscoveryURL(project: Project, config: CircleCIRequesterConfig) {
    const projectResponse = await getAxiosForConfigV2(config).get(
      `/project/gh/${project.repoOwner}/${project.repoName}`,
    );

    if (projectResponse.status !== 200) {
      return null;
    }

    const orgId = projectResponse.data.organization_id;
    return `https://oidc.circleci.com/org/${orgId}`;
  }

  async doOpenIDConnectClaimsMatchProject(claims: jwt.JwtPayload, project: Project, config: CircleCIRequesterConfig) {
    const projectResponse = await getAxiosForConfigV2(config).get(
      `/project/gh/${project.repoOwner}/${project.repoName}`,
    );

    if (projectResponse.status !== 200) {
      return false;
    }

    return projectResponse.data.id === claims['oidc.circleci.com/project-id'];
  }

  async metadataForInitialRequest(
    req: Request,
    res: Response,
  ): Promise<CircleCIOTPRequestMetadata | null> {
    const result = validateMetadataObject(req.body);
    if (result.error) {
      res.status(400).json({
        error: 'Request Validation Error',
        message: result.error.message,
      });
      return null;
    }

    return {
      buildNumber: result.value.buildNumber,
    };
  }

  async validateActiveRequest(
    request: OTPRequest<CircleCIOTPRequestMetadata, unknown>,
    config: CircleCIRequesterConfig,
  ): Promise<AllowedState> {
    const { project } = request;
    const buildResponse = await getAxiosForConfig(config).get(
      `/project/github/${project.repoOwner}/${project.repoName}/${request.requestMetadata.buildNumber}`,
    );
    // Build clearly does not exist
    if (buildResponse.status !== 200)
      return {
        ok: false,
        error: 'CircleCI build does not exist',
      };

    const build = buildResponse.data;

    // Must be on the default branch
    if (build.branch !== project.defaultBranch)
      return {
        ok: false,
        error: 'CircleCI build is not for the default branch',
      };

    // Trigger must be GitHub
    if (build.why !== 'github')
      return {
        ok: false,
        error: 'CircleCI build was triggered manually, not by GitHub',
      };

    // Build must be currently running
    if (build.status !== 'running')
      return {
        ok: false,
        error: 'CircleCI build is not running',
      };

    // SSH must be disabled for safety
    if (!build.ssh_disabled)
      return {
        ok: false,
        error: 'CircleCI build had SSH enabled, this is not allowed',
      };

    return {
      ok: true,
    };
  }

  async validateProofForRequest(
    request: OTPRequest<CircleCIOTPRequestMetadata, unknown>,
    config: CircleCIRequesterConfig,
  ): Promise<boolean> {
    const { project, proof } = request;
    const { buildNumber } = request.requestMetadata;

    async function attemptToValidateProof(attempts: number): Promise<boolean> {
      if (attempts <= 0) return false;

      const again = async () => {
        await new Promise(r => setTimeout(r, 5000));
        return attemptToValidateProof(attempts - 1);
      };

      const buildUrl = `/project/github/${project.repoOwner}/${project.repoName}/${buildNumber}`;
      const buildResponse = await getAxiosForConfig(config).get(buildUrl, {
        validateStatus: () => true,
      });
      // Build clearly does not exist
      if (buildResponse.status !== 200) return again();

      const build = buildResponse.data;
      if (!build.steps || !build.steps.length) return again();

      const finalStep = build.steps[build.steps.length - 1];
      if (!finalStep || !finalStep.actions.length) return again();

      const finalAction = finalStep.actions[finalStep.actions.length - 1];
      const outputResponse = await getAxiosForConfig(config).get(
        `${buildUrl}/output/${finalAction.step}/${finalAction.index}`,
        {
          validateStatus: () => true,
        },
      );
      // Output clearly does not exist
      if (outputResponse.status !== 200) return again();

      const outputData = outputResponse.data;
      if (!outputData.length) return again();

      const output = outputData[0].message.trim();
      if (new RegExp(`Proof:(\r?\n)${proof}$`).test(output)) return true;

      return again();
    }

    return attemptToValidateProof(3);
  }

  async isOTPRequestValidForRequester(
    request: OTPRequest<unknown, unknown>,
  ): Promise<OTPRequest<CircleCIOTPRequestMetadata> | null> {
    const result = validateMetadataObject(request.requestMetadata);
    if (result.error) return null;
    return request as any;
  }

  async getRequestInformationToPassOn(
    request: OTPRequest<CircleCIOTPRequestMetadata, unknown>,
  ): Promise<RequestInformation> {
    const { project } = request;

    return {
      description: `Circle CI Build for ${project.repoOwner}/${project.repoName}#${request.requestMetadata.buildNumber}`,
      url: `https://circleci.com/gh/${project.repoOwner}/${project.repoName}/${request.requestMetadata.buildNumber}`,
    };
  }
}
