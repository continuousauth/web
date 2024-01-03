import * as express from 'express';

import { createRequesterRoutes } from './requester';
import { CircleCIRequester } from '../../requesters/CircleCIRequester';

export function requestRoutes() {
  const router = express();

  router.use(createRequesterRoutes(new CircleCIRequester()));

  return router;
}
