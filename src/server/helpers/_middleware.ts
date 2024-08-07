import { Octokit } from '@octokit/rest';
import * as debug from 'debug';
import * as express from 'express';
import * as Joi from 'joi';

import { createA } from './a';
import './_joi_extract';
import { User as CFAUser } from '../../common/types';

const d = debug('cfa:server:helpers');

export interface ExpressRequest<CTX = {}>
  extends Omit<express.Request, 'body' | 'query' | 'params'> {
  ctx: {} & CTX;
  body: unknown;
  query: unknown;
  params: unknown;
}

declare global {
  namespace Express {
    interface User {
      accessToken: string;
      profile: CFAUser;
    }
  }
}

export const requireLogin = (req: ExpressRequest, res: express.Response, next: Function) => {
  if (!req.user) {
    if (req.method.toLowerCase() !== 'get') {
      d(`Unauthenticated user attempted to access: ${req.originalUrl}`);
    }
    res.setHeader('x-cfa-403-reason', 'no-auth');
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

export const hasAdminAccessToTargetRepo = async (
  req: ExpressRequest,
  repoId: string,
): Promise<boolean> => {
  if (!repoId) return false;
  if (!req.user) return false;

  const github = new Octokit({
    auth: req.user.accessToken,
  });

  try {
    const body = await github.request('GET /repositories/:id/collaborators/:username/permission', {
      id: repoId,
      username: req.user.profile.username,
    });

    if (body.status !== 200) return false;
    if (body.data.permission === 'admin') return true;
  } catch (err) {
    d('failed to request permission level from github', err);
    return false;
  }

  return false;
};

export interface ValidationOptionsObject {
  a: ReturnType<typeof createA>;
  query?: Joi.SchemaMap;
  body?: Joi.SchemaMap;
  params?: Joi.SchemaMap;
}

export type ValidatedObject<S extends Joi.mappedSchema> = S extends undefined
  ? {}
  : Joi.extractType<S>;

export type AllStrings<T> = { [P in keyof T]: string };

export type ValidatedRequest<V extends ValidationOptionsObject> = Pick<
  ExpressRequest,
  Exclude<keyof ExpressRequest, 'body' | 'query' | 'params'>
> & {
  body: ValidatedObject<Required<V['body']>>;
  query: AllStrings<ValidatedObject<Required<V['query']>>>;
  params: AllStrings<ValidatedObject<Required<V['params']>>>;
  [Symbol.asyncIterator](): AsyncIterableIterator<any>;
};

export const validate =
  <V extends ValidationOptionsObject>(
    options: V,
    handler: (req: ValidatedRequest<V>, res: express.Response, next: express.NextFunction) => void,
  ): express.RequestHandler =>
  (req: ExpressRequest, res, next) => {
    if (options.body) {
      const result = Joi.validate(req.body, options.body);
      if (result.error) {
        return res.status(400).json({
          error: 'Body Validation Error',
          message: result.error.message,
        });
      }
    }

    if (options.query) {
      const result = Joi.validate(req.query, options.query);
      if (result.error) {
        return res.status(400).json({
          error: 'Query Validation Error',
          message: result.error.message,
        });
      }
    }

    if (options.params) {
      const result = Joi.validate(req.params, Joi.object(options.params).unknown(true));
      if (result.error) {
        return res.status(400).json({
          error: 'Params Validation Error',
          message: result.error.message,
        });
      }
    }

    return options.a(handler)(req as any, res, next);
  };
