let octokitRequest: jest.Mock;

jest.mock('@octokit/rest', () => {
  class FakeOctokit {
    request = octokitRequest;
  }
  return FakeOctokit;
});

import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as Joi from 'joi';
import * as request from 'supertest';
import { createA } from '../a';
import { validate, requireLogin, hasAdminAccessToTargetRepo, ExpressRequest } from '../_middleware';
import { Request } from 'jest-express/lib/request';
import { Response } from 'jest-express/lib/response';

const successHandler = (req, res) => res.status(321).json({ very: 'Good' });

describe('validate middleware', () => {
  let debug: jest.Mock;
  let a: ReturnType<typeof createA>;
  let router: express.Router;

  beforeEach(() => {
    debug = jest.fn();
    a = createA(debug as any);
    router = express();
    router.use(bodyParser.json());
  });

  it('should log errors with the provided "a"', async () => {
    router.use(
      validate(
        {
          a,
        },
        () => {
          throw new Error('whoops');
        },
      ),
    );
    const response = await request(router).post('/');
    expect(debug).toHaveBeenCalled();
    expect(response.status).toBe(500);
  });

  it('should fail with 400 if the body does not match provided requirements', async () => {
    router.use(
      validate(
        {
          a,
          body: {
            foo: Joi.string().required(),
          },
        },
        successHandler,
      ),
    );
    const response = await request(router)
      .post('/')
      .send({ bad: true });
    expect(response.status).toBe(400);
    expect(response.body).toMatchInlineSnapshot(`
                              Object {
                                "error": "Body Validation Error",
                                "message": "child \\"foo\\" fails because [\\"foo\\" is required]",
                              }
                    `);
  });

  it('should fail with 400 if the query does not match provided requirements', async () => {
    router.use(
      validate(
        {
          a,
          query: {
            foo: Joi.string().required(),
          },
        },
        successHandler,
      ),
    );
    const response = await request(router).post('/foo?a=1');
    expect(response.status).toBe(400);
    expect(response.body).toMatchInlineSnapshot(`
                        Object {
                          "error": "Query Validation Error",
                          "message": "child \\"foo\\" fails because [\\"foo\\" is required]",
                        }
                `);
  });

  it('should fail with 400 if the params do not match provided requirements', async () => {
    router.use(
      '/:foo',
      validate(
        {
          a,
          params: {
            foo: Joi.number().required(),
          },
        },
        successHandler,
      ),
    );
    const response = await request(router).post('/not-a-number');
    expect(response.status).toBe(400);
    expect(response.body).toMatchInlineSnapshot(`
                        Object {
                          "error": "Params Validation Error",
                          "message": "child \\"foo\\" fails because [\\"foo\\" must be a number]",
                        }
                `);
  });

  it('should should passthrough to the handler if all validation succeeds', async () => {
    router.use(
      '/:thing',
      validate(
        {
          a,
          body: {
            foo: Joi.string().required(),
          },
          query: {
            bar: Joi.string().required(),
          },
          params: {
            thing: Joi.string().required(),
          },
        },
        successHandler,
      ),
    );
    const response = await request(router)
      .post('/foo?bar=1')
      .send({ foo: 'hey' });
    expect(response.status).toBe(321);
    expect(response.body).toMatchInlineSnapshot(`
            Object {
              "very": "Good",
            }
        `);
  });
});

describe('requireLogin middleware', () => {
  it('should pass through if the user is signed in', () => {
    const req = new Request();
    (req as any).user = {};
    const res = new Response();
    const next = jest.fn();
    requireLogin(req as any, res as any, next);
    expect(next).toHaveBeenCalled();
  });

  it('should return a 403 if the user is not signed in', () => {
    const req = new Request();
    const res = new Response();
    req.method = 'post';
    const next = jest.fn();
    requireLogin(req as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('hasAdminAccessToTargetRepo middleware', () => {
  let req: Request;
  let _req: ExpressRequest;
  beforeEach(() => {
    req = new Request();
    _req = req as any;

    octokitRequest = jest.fn();
  });

  it('should return false if the repo provided is falsey', async () => {
    const value = await hasAdminAccessToTargetRepo(_req, '0');
    expect(value).toBe(false);
  });

  it('should return false if the request is not from an authenticated user', async () => {
    const value = await hasAdminAccessToTargetRepo(_req, '1');
    expect(value).toBe(false);
  });

  it('should return false if github returns a non-ok status code', async () => {
    (req as any).user = {
      profile: {
        username: 'my-user',
      },
    };
    octokitRequest.mockImplementation((url, params) => {
      expect(url).toMatchInlineSnapshot(
        `"GET /repositories/:id/collaborators/:username/permission"`,
      );
      expect(params).toStrictEqual({
        id: 1,
        username: 'my-user',
      });
      return {
        status: 404,
      };
    });
    const value = await hasAdminAccessToTargetRepo(_req, '1');
    expect(value).toBe(false);
  });

  it('should return false if the github request fails', async () => {
    (req as any).user = {
      profile: {
        username: 'my-user',
      },
    };
    octokitRequest.mockImplementation((url, params) => {
      throw new Error('wut');
    });
    const value = await hasAdminAccessToTargetRepo(_req, '1');
    expect(value).toBe(false);
  });

  it('should return false if github returns a a non-admin permission level', async () => {
    (req as any).user = {
      profile: {
        username: 'my-user',
      },
    };
    octokitRequest.mockImplementation((url, params) => {
      return {
        status: 200,
        data: {
          permission: 'write',
        },
      };
    });
    const value = await hasAdminAccessToTargetRepo(_req, '1');
    expect(value).toBe(false);
  });

  it('should return true if github returns the admin permission level', async () => {
    (req as any).user = {
      profile: {
        username: 'my-user',
      },
    };
    octokitRequest.mockImplementation((url, params) => {
      return {
        status: 200,
        data: {
          permission: 'admin',
        },
      };
    });
    const value = await hasAdminAccessToTargetRepo(_req, '1');
    expect(value).toBe(true);
  });
});
