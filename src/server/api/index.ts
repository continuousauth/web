import * as express from 'express';
import { authRoutes } from './auth';
import { repoRoutes } from './repo';
import { projectRoutes } from './project';
import { requireLogin } from '../helpers/_middleware';
import { requestRoutes } from './request';

export function apiRoutes() {
  const router = express();

  router.use('/auth', authRoutes());
  router.use('/project', requireLogin, projectRoutes());
  router.use('/repos', requireLogin, repoRoutes());
  router.use('/request', requestRoutes());

  return router;
}
