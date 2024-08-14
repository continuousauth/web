import * as express from 'express';

import { createRequesterRoutes } from './requester';
import { CircleCIRequester } from '../../requesters/CircleCIRequester';
import { GitHubActionsRequester } from '../../requesters/GitHubActionsRequester';

export function requestRoutes() {
  const router = express();

  router.use(createRequesterRoutes(new CircleCIRequester()));
  router.use(createRequesterRoutes(new GitHubActionsRequester()));

  return router;
}
