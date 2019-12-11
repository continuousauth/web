import { FullProject } from '../common/types';

export const mockProject = (): FullProject => ({
  secret: 'my_secret',
  enabled: true,
  requester_circleCI: null,
  requester_travisCI: null,
  responder_slack: null,
  id: '123',
  repoName: 'my-repo',
  repoOwner: 'my-owner',
});
