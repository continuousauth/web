import { FullProject } from '../common/types';

export const mockProject = (): FullProject => ({
  secret: 'my_secret',
  enabled: true,
  requester_circleCI: null,
  requester_gitHub: null,
  responder_slack: null,
  id: '123',
  repoName: 'my-repo',
  repoOwner: 'my-owner',
  defaultBranch: 'main',
});
