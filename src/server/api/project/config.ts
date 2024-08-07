import axios from 'axios';
import * as debug from 'debug';
import * as express from 'express';
import * as Joi from 'joi';

import { validate } from '../../helpers/_middleware';
import { createA } from '../../helpers/a';
import {
  Project,
  SlackResponderLinker,
  withTransaction,
  CircleCIRequesterConfig,
} from '../../db/models';
import { getProjectFromIdAndCheckPermissions } from './_safe';

const d = debug('cfa:server:api:project:config');
const a = createA(d);

export async function updateCircleEnvVars(project: Project, accessToken: string) {
  const client = axios.create({
    baseURL: 'https://circleci.com/api/v1.1',
    auth: {
      username: accessToken,
      password: '',
    },
    validateStatus: () => true,
  });

  const existing = await client.get(
    `/project/github/${project.repoOwner}/${project.repoName}/envvar`,
  );
  if (existing.status !== 200) return;

  if (existing.data.find((item) => item.name === 'CFA_SECRET')) {
    await client.delete(
      `/project/github/${project.repoOwner}/${project.repoName}/envvar/CFA_SECRET`,
    );
  }
  await client.post(`/project/github/${project.repoOwner}/${project.repoName}/envvar`, {
    name: 'CFA_SECRET',
    value: project.secret,
  });

  if (existing.data.find((item) => item.name === 'CFA_PROJECT_ID')) {
    await client.delete(
      `/project/github/${project.repoOwner}/${project.repoName}/envvar/CFA_PROJECT_ID`,
    );
  }
  await client.post(`/project/github/${project.repoOwner}/${project.repoName}/envvar`, {
    name: 'CFA_PROJECT_ID',
    value: project.id,
  });
}

export function configRoutes() {
  const router = express();

  router.post(
    '/:id/config/requesters/circleci',
    validate(
      {
        a,
        params: {
          id: Joi.number().integer().required(),
        },
        body: {
          accessToken: Joi.string().min(1).required(),
        },
      },
      async (req, res) => {
        const project = await getProjectFromIdAndCheckPermissions(req.params.id, req, res);
        if (!project) return;

        const response = await axios.get(
          `https://circleci.com/api/v1.1/project/gh/${project.repoOwner}/${project.repoName}/checkout-key`,
          {
            auth: {
              username: req.body.accessToken,
              password: '',
            },
            validateStatus: () => true,
          },
        );

        if (response.status !== 200) {
          return res.status(401).json({
            error:
              'That token is not valid for the current project, or the repository is not configured on CircleCI',
          });
        }

        await updateCircleEnvVars(project, req.body.accessToken);

        const newProject = await withTransaction(async (t) => {
          const config = await CircleCIRequesterConfig.create(
            {
              accessToken: req.body.accessToken,
            },
            {
              returning: true,
            },
          );
          await project.resetAllRequesters(t);
          project.requester_circleCI_id = config.id;
          await project.save({ transaction: t });
          return await Project.findByPk(project.id, {
            include: Project.allIncludes,
            transaction: t,
          });
        });

        res.json(newProject);
      },
    ),
  );

  router.post(
    '/:id/config/responders/slack',
    validate(
      {
        a,
        params: {
          id: Joi.number().integer().required(),
        },
      },
      async (req, res) => {
        const project = await getProjectFromIdAndCheckPermissions(req.params.id, req, res);
        if (!project) return;

        const linker = await withTransaction(async (t) => {
          await SlackResponderLinker.destroy({
            where: {
              projectId: project.id,
            },
            transaction: t,
          });
          return await SlackResponderLinker.create(
            {
              projectId: project.id,
            },
            {
              transaction: t,
              returning: true,
            },
          );
        });

        res.json({
          linker,
          slackClientId: process.env.SLACK_CLIENT_ID,
        });
      },
    ),
  );

  router.patch(
    '/:id/config/responders/slack',
    validate(
      {
        a,
        params: {
          id: Joi.number().integer().required(),
        },
        body: {
          usernameToMention: Joi.string().min(1).max(50).required(),
        },
      },
      async (req, res) => {
        const project = await getProjectFromIdAndCheckPermissions(req.params.id, req, res);
        if (!project) return;

        if (!project.responder_slack) {
          return res.status(400).json({
            error: 'Project is not configured to use Slack as a responder',
          });
        }

        project.responder_slack.usernameToMention = req.body.usernameToMention;
        await project.responder_slack.save();

        res.json(project);
      },
    ),
  );

  return router;
}
