import * as debug from 'debug';
import * as express from 'express';
import * as Joi from 'joi';
import * as Octokit from '@octokit/rest';

import { createA } from '../../helpers/a';
import { validate, hasAdminAccessToTargetRepo } from '../../helpers/_middleware';
import { Project, withTransaction, OTPRequest } from '../../db/models';
import { configRoutes } from './config';
import { sanitizeProject, generateNewSecret, getProjectFromIdAndCheckPermissions } from './_safe';

const d = debug('cfa:server:api:auth');
const a = createA(d);

export function projectRoutes() {
  const router = express();

  router.post(
    '/',
    validate(
      {
        a,
        body: {
          repoId: Joi.number()
            .integer()
            .required(),
        },
      },
      async (req, res) => {
        if (!(await hasAdminAccessToTargetRepo(req, `${req.body.repoId}`))) {
          return res.status(401).json({
            error: 'Current user is not an admin of the target repository',
          });
        }

        const github = new Octokit({
          auth: req.user.accessToken,
        });

        const repoResponse = await github.request('GET /repositories/:id', {
          id: req.body.repoId,
        });
        const repo: Octokit.ReposGetResponse = repoResponse.data;

        const existingProject = await Project.findByPrimary(req.body.repoId);
        if (existingProject) {
          existingProject.repoName = repo.name;
          existingProject.repoOwner = repo.owner.login;
          // If the project existed but was disabled let's enable it and
          // generate a new secret so that the old info is invalid.
          if (!existingProject.enabled) {
            existingProject.enabled = true;
            existingProject.secret = generateNewSecret(256);
          }
          await existingProject.save();
          return res.status(200).json(existingProject);
        }

        const project = await Project.create({
          id: req.body.repoId,
          repoName: repo.name,
          repoOwner: repo.owner.login,
          secret: generateNewSecret(256),
        });
        res.status(201).json(project);
      },
    ),
  );

  router.get(
    '/:id',
    validate(
      {
        a,
        params: {
          id: Joi.number()
            .integer()
            .required(),
        },
      },
      async (req, res) => {
        const project = await Project.findOne({
          where: {
            id: req.params.id,
            enabled: true,
          },
          include: Project.allIncludes,
        });
        // Project not existing and user not having permission should look identical
        // so that folks can't sniff which projects are active on CFA
        if (!project) {
          return res.status(401).json({
            error: 'Current user is not an admin of the target repository',
          });
        }

        if (!(await hasAdminAccessToTargetRepo(req, project.id))) {
          return res.status(401).json({
            error: 'Current user is not an admin of the target repository',
          });
        }

        res.json(sanitizeProject(project));
      },
    ),
  );

  router.get(
    '/:id/log',
    validate(
      {
        a,
        params: {
          id: Joi.number()
            .integer()
            .required(),
        },
      },
      async (req, res) => {
        const project = await getProjectFromIdAndCheckPermissions(req.params.id, req, res);
        if (!project) return;

        res.json(
          (await OTPRequest.findAll({
            where: {
              projectId: project.id,
            },
          }))
            .map(req => {
              const simpleReq = req.get();
              delete simpleReq.proof;
              delete simpleReq.requestMetadata;
              delete simpleReq.responseMetadata;
              return simpleReq;
            })
            .sort((a, b) => b.requested.getTime() - a.requested.getTime()),
        );
      },
    ),
  );

  router.patch(
    '/:id/secret',
    validate(
      {
        a,
        params: {
          id: Joi.number()
            .integer()
            .required(),
        },
      },
      async (req, res) => {
        const project = await getProjectFromIdAndCheckPermissions(req.params.id, req, res);
        if (!project) return;

        project.secret = generateNewSecret(256);
        await project.save();

        res.json(sanitizeProject(project));
      },
    ),
  );

  router.delete(
    '/:id',
    validate(
      {
        a,
        params: {
          id: Joi.number()
            .integer()
            .required(),
        },
      },
      async (req, res) => {
        const project = await getProjectFromIdAndCheckPermissions(req.params.id, req, res);
        if (!project) return;

        await withTransaction(async t => {
          project.enabled = false;
          await project.resetAllResponders(t);
          await project.resetAllRequesters(t);
          await project.save({ transaction: t });
        });

        res.json(sanitizeProject(project));
      },
    ),
  );

  router.use(configRoutes());

  return router;
}
