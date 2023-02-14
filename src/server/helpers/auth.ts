import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

import { Project } from '../db/models';

export const getGitHubAppInstallationToken = async (project: Project) => {
  const appCredentials = {
    appId: process.env.GITHUB_APP_ID!,
    privateKey: process.env.GITHUB_PRIVATE_KEY!,
  };

  const appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      ...appCredentials,
    },
  });

  const installation = await appOctokit.apps.getRepoInstallation({
    owner: project.repoOwner,
    repo: project.repoName,
  });

  const authOptions = {
    type: <const>'installation',
    ...appCredentials,
    installationId: installation.data.id,
    repositoryNames: [project.repoName],
  };
  const { token } = await createAppAuth(authOptions)(authOptions);
  return token;
};
