import * as express from 'express';

import { createRequesterRoutes } from './requester';
import { CircleCIRequester } from '../../requesters/CircleCIRequester';
import { TravisCIRequester } from '../../requesters/TravisCIRequester';

export function requestRoutes() {
  const router = express();

  router.use(createRequesterRoutes(new CircleCIRequester()));
  router.use(createRequesterRoutes(new TravisCIRequester()));

  return router;
}
