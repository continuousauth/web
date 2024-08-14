import axios from 'axios';
import * as debug from 'debug';
import * as express from 'express';
import * as Joi from 'joi';
import * as sodium from 'libsodium-wrappers';

import { validate } from '../../helpers/_middleware';
import { createA } from '../../helpers/a';
import {
  Project,
  SlackResponderLinker,
  withTransaction,
  CircleCIRequesterConfig,
  GitHubActionsRequesterConfig,
} from '../../db/models';
import { getProjectFromIdAndCheckPermissions } from './_safe';
import { getGitHubAppInstallationToken } from '../../helpers/auth';
import { Octokit } from '@octokit/rest';

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

enum GitHubActionsEnvironmentResult {
  SUCCESS,
  APP_NOT_INSTALLED,
  UNKNOWN_ERROR,
}

export const CFA_RELEASE_GITHUB_ENVIRONMENT_NAME = 'npm';

export async function updateGitHubActionsEnvironment(
  project: Project,
): Promise<GitHubActionsEnvironmentResult> {
  try {
    let token: string;
    try {
      token = await getGitHubAppInstallationToken(project, {
        metadata: 'read',
        administration: 'write',
        environments: 'write',
      });
    } catch {
      // Assume an error here means that the app is not installed
      return GitHubActionsEnvironmentResult.APP_NOT_INSTALLED;
    }
    const github = new Octokit({ auth: token });

    const allEnvs = await github.repos.getAllEnvironments({
      owner: project.repoOwner,
      repo: project.repoName,
    });
    const cfaReleaseEnv = allEnvs.data.environments?.find(
      (e) => e.name === CFA_RELEASE_GITHUB_ENVIRONMENT_NAME,
    );
    if (!cfaReleaseEnv) {
      await github.repos.createOrUpdateEnvironment({
        owner: project.repoOwner,
        repo: project.repoName,
        environment_name: CFA_RELEASE_GITHUB_ENVIRONMENT_NAME,
        reviewers: null,
        deployment_branch_policy: {
          protected_branches: false,
          custom_branch_policies: true,
        },
      });

      await github.repos.createDeploymentBranchPolicy({
        owner: project.repoOwner,
        repo: project.repoName,
        environment_name: CFA_RELEASE_GITHUB_ENVIRONMENT_NAME,
        name: project.defaultBranch,
        type: 'branch',
      });
    }

    const publicKey = await github.actions.getEnvironmentPublicKey({
      repository_id: parseInt(project.id, 10),
      environment_name: CFA_RELEASE_GITHUB_ENVIRONMENT_NAME,
    });

    await sodium.ready;
    const sodiumKey = sodium.from_base64(publicKey.data.key, sodium.base64_variants.ORIGINAL);
    const sodiumSecret = sodium.from_string(project.secret);
    const sodiumProjectId = sodium.from_string(project.id);

    await github.actions.createOrUpdateEnvironmentSecret({
      repository_id: parseInt(project.id, 10),
      environment_name: CFA_RELEASE_GITHUB_ENVIRONMENT_NAME,
      key_id: publicKey.data.key_id,
      secret_name: 'CFA_SECRET',
      encrypted_value: sodium.to_base64(
        sodium.crypto_box_seal(sodiumSecret, sodiumKey),
        sodium.base64_variants.ORIGINAL,
      ),
    });

    await github.actions.createOrUpdateEnvironmentSecret({
      repository_id: parseInt(project.id, 10),
      environment_name: CFA_RELEASE_GITHUB_ENVIRONMENT_NAME,
      key_id: publicKey.data.key_id,
      secret_name: 'CFA_PROJECT_ID',
      encrypted_value: sodium.to_base64(
        sodium.crypto_box_seal(sodiumProjectId, sodiumKey),
        sodium.base64_variants.ORIGINAL,
      ),
    });

    const npmTokenToUse = process.env[`npm_token_credential_${project.repoOwner}`];
    if (npmTokenToUse) {
      const sodiumNpmToken = sodium.from_string(npmTokenToUse);

      await github.actions.createOrUpdateEnvironmentSecret({
        repository_id: parseInt(project.id, 10),
        environment_name: CFA_RELEASE_GITHUB_ENVIRONMENT_NAME,
        key_id: publicKey.data.key_id,
        secret_name: 'NPM_TOKEN',
        encrypted_value: sodium.to_base64(
          sodium.crypto_box_seal(sodiumNpmToken, sodiumKey),
          sodium.base64_variants.ORIGINAL,
        ),
      });
    }

    return GitHubActionsEnvironmentResult.SUCCESS;
  } catch (err) {
    console.error('Unknown error occurred updating github actions environment', err);
    return GitHubActionsEnvironmentResult.UNKNOWN_ERROR;
  }
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
    '/:id/config/requesters/github',
    validate(
      {
        a,
        params: {
          id: Joi.number().integer().required(),
        },
        body: {},
      },
      async (req, res) => {
        const project = await getProjectFromIdAndCheckPermissions(req.params.id, req, res);
        if (!project) return;

        const result = await updateGitHubActionsEnvironment(project);
        if (result === GitHubActionsEnvironmentResult.APP_NOT_INSTALLED) {
          return res.status(412).json({ error: 'App not installed' });
        } else if (result === GitHubActionsEnvironmentResult.UNKNOWN_ERROR) {
          return res.status(500).json({ error: 'Unknown Error' });
        }

        const newProject = await withTransaction(async (t) => {
          const config = await GitHubActionsRequesterConfig.create(
            {},
            {
              returning: true,
            },
          );
          await project.resetAllRequesters(t);
          project.requester_gitHub_id = config.id;
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
