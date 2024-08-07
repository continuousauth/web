import * as debug from 'debug';
import * as express from 'express';
import { ExpressRequest } from './_middleware';

export const createA =
  (d: debug.IDebugger) =>
  (handler: (req: express.Request, res: express.Response, next: express.NextFunction) => any) =>
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      await Promise.resolve(handler(req, res, next));
    } catch (err) {
      d(`Unhandled error: ${req.originalUrl}`);
      d(err);
      res.status(500).json({ error: 'Something went wrong...' });
    }
  };
