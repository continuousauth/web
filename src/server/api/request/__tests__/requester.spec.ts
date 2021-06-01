import { Router } from 'express';
import * as request from 'supertest';

import { createRequesterRoutes } from '../requester';
import {
  Project,
  OTPRequest,
  CircleCIRequesterConfig,
  SlackResponderConfig,
} from '../../../db/models';
import { temporaryDatabaseForTestScope } from '../../../../__mocks__/db';

const makeMockRequester = () => ({
  slug: 'test',
  getConfigForProject: jest.fn(),
  metadataForInitialRequest: jest.fn(),
  validateActiveRequest: jest.fn(),
  validateProofForRequest: jest.fn(),
  isOTPRequestValidForRequester: jest.fn(),
  getRequestInformationToPassOn: jest.fn(),
});

describe('requester endpoint creator', () => {
  let router: Router;
  let mock: ReturnType<typeof makeMockRequester>;

  beforeEach(async () => {
    mock = makeMockRequester();
    router = createRequesterRoutes(mock);
  });

  temporaryDatabaseForTestScope();

  describe('request auth', () => {
    it('should reject requests with no auth header', async () => {
      const response = await request(router).delete('/123/test');
      expect(response.status).toBe(403);
      expect(response.text).toMatchInlineSnapshot(
        `"{\\"error\\":\\"Missing Authorization header\\"}"`,
      );
    });

    it('should reject requests for projects that do not exist', async () => {
      const response = await request(router)
        .delete('/123/test')
        .auth('abc', { type: 'bearer' });
      expect(response.status).toBe(404);
      expect(response.text).toMatchInlineSnapshot(
        `"{\\"error\\":\\"Project not found, disabled or you are not authorizad to access it\\"}"`,
      );
    });

    it('should reject requests with an incorrect auth header (non-bearer)', async () => {
      const project = new Project({
        id: 123,
        repoName: 'cfa',
        repoOwner: 'electron',
        secret: 'very scret thing',
        defaultBranch: 'main',
      });
      await project.save();
      const response = await request(router)
        .delete('/123/test')
        .auth('username', 'password');
      expect(response.status).toBe(404);
      expect(response.text).toMatchInlineSnapshot(
        `"{\\"error\\":\\"Project not found, disabled or you are not authorizad to access it\\"}"`,
      );
    });

    it('should reject requests with an incorrect bearer token', async () => {
      const project = new Project({
        id: 123,
        repoName: 'cfa',
        repoOwner: 'electron',
        secret: 'very scret thing',
        defaultBranch: 'main',
      });
      await project.save();
      const response = await request(router)
        .delete('/123/test')
        .auth('the wrong secret thing', { type: 'bearer' });
      expect(response.status).toBe(404);
      expect(response.text).toMatchInlineSnapshot(
        `"{\\"error\\":\\"Project not found, disabled or you are not authorizad to access it\\"}"`,
      );
    });

    it('should reject requests for a project that has not been completely configured', async () => {
      const project = new Project({
        id: 123,
        repoName: 'cfa',
        repoOwner: 'electron',
        secret: 'very scret thing',
        defaultBranch: 'main',
      });
      await project.save();
      const response = await request(router)
        .delete('/123/test')
        .auth('very scret thing', { type: 'bearer' });
      expect(response.status).toBe(400);
      expect(response.text).toMatchInlineSnapshot(
        `"{\\"error\\":\\"Project not completely configured\\"}"`,
      );
    });

    it('should passthrough authed requests for a project that has been configured', async () => {
      const project = new Project({
        id: 123,
        repoName: 'cfa',
        repoOwner: 'electron',
        secret: 'very scret thing',
        defaultBranch: 'main',
      });
      await project.save();
      const circleConfig = await CircleCIRequesterConfig.create(
        {
          accessToken: '123',
        },
        {
          returning: true,
        },
      );
      // await circleConfig.save({ returning: true });
      project.requester_circleCI_id = circleConfig.id;
      const slackConfig = await SlackResponderConfig.create(
        {
          teamName: 'my team',
          teamId: 'my team id',
          teamIcon: 'team icon',
          channelName: 'my channel',
          channelId: 'channel id',
          enterpriseId: 'enterprise id',
          usernameToMention: '@me',
        },
        {
          returning: true,
        },
      );
      project.responder_slack_id = slackConfig.id;
      await project.save();
      const response = await request(router)
        .delete('/123/test')
        .auth('very scret thing', { type: 'bearer' });
      expect(response.status).toBe(404);
      expect(response.text).toMatchInlineSnapshot(`
                                                                                "<!DOCTYPE html>
                                                                                <html lang=\\"en\\">
                                                                                <head>
                                                                                <meta charset=\\"utf-8\\">
                                                                                <title>Error</title>
                                                                                </head>
                                                                                <body>
                                                                                <pre>Cannot DELETE /123/test</pre>
                                                                                </body>
                                                                                </html>
                                                                                "
                                                            `);
    });
  });

  describe('with request auth bypassed', () => {
    beforeEach(() => {
      (global as any).__bypassRequesterAuthentication = true;
    });

    afterEach(() => {
      delete (global as any).__bypassRequesterAuthentication;
    });

    describe('creating a request', () => {
      it('should 404 for an incorrect slug', async () => {
        const response = await request(router).post('/123/voodoo');
        expect(response.status).toEqual(404);
        expect(response.text).toMatchInlineSnapshot(`
                                                                                                                                                                                                                    "<!DOCTYPE html>
                                                                                                                                                                                                                    <html lang=\\"en\\">
                                                                                                                                                                                                                    <head>
                                                                                                                                                                                                                    <meta charset=\\"utf-8\\">
                                                                                                                                                                                                                    <title>Error</title>
                                                                                                                                                                                                                    </head>
                                                                                                                                                                                                                    <body>
                                                                                                                                                                                                                    <pre>Cannot POST /123/voodoo</pre>
                                                                                                                                                                                                                    </body>
                                                                                                                                                                                                                    </html>
                                                                                                                                                                                                                    "
                                                                                                                                                                    `);
      });

      it('should 400 for an invalid project ID', async () => {
        const response = await request(router).post('/bad-id/test');
        expect(response.status).toEqual(400);
        expect(response.text).toMatchInlineSnapshot(
          `"{\\"error\\":\\"Params Validation Error\\",\\"message\\":\\"child \\\\\\"projectId\\\\\\" fails because [\\\\\\"projectId\\\\\\" must be a number]\\"}"`,
        );
      });

      it('should 404 for a project that does not exist', async () => {
        const response = await request(router).post('/123/test');
        expect(response.status).toEqual(404);
        expect(response.text).toMatchInlineSnapshot(`"{\\"error\\":\\"Could not find project\\"}"`);
      });

      describe('with an existing project', () => {
        beforeEach(async () => {
          const project = new Project({
            id: 123,
            repoName: 'cfa',
            repoOwner: 'electron',
            secret: 'very scret thing',
            defaultBranch: 'main',
          });
          await project.save();
        });

        it('should return 422 for a project that is not configured to use this requester', async () => {
          const response = await request(router).post('/123/test');
          expect(response.status).toEqual(422);
          expect(response.text).toMatchInlineSnapshot(
            `"{\\"error\\":\\"Project is not configured to use this requester\\"}"`,
          );
        });

        it('should return the correct code for a project that is configured but fails to acquire metadata', async () => {
          mock.getConfigForProject.mockImplementationOnce(async () => ({
            myConfig: true,
          }));
          mock.metadataForInitialRequest.mockImplementationOnce(async (req, res) => {
            res.status(321).send('metadata error');
            return null;
          });
          const response = await request(router).post('/123/test');
          expect(response.status).toEqual(321);
          expect(response.text).toBe('metadata error');
        });

        it('should create an OTPRequest for a project that is configured and has valid metadata', async () => {
          expect(await OTPRequest.findAll()).toHaveLength(0);
          mock.getConfigForProject.mockImplementationOnce(async () => ({
            myConfig: true,
          }));
          mock.metadataForInitialRequest.mockImplementationOnce(async (req, res) => ({
            metadata: 321,
          }));
          await request(router).post('/123/test');
          const requests = await OTPRequest.findAll();
          expect(requests).toHaveLength(1);
          const { id, proof, requested, ...strippedRequest } = requests[0].get() as OTPRequest;
          expect(strippedRequest).toMatchSnapshot();
        });

        it('should return a 422 if the created OTPRequest is not immediately deemed valid', async () => {
          mock.getConfigForProject.mockImplementationOnce(async () => ({
            myConfig: true,
          }));
          mock.metadataForInitialRequest.mockImplementationOnce(async (req, res) => ({
            metadata: 321,
          }));
          const response = await request(router).post('/123/test');
          expect(response.status).toBe(422);
          expect(response.text).toMatchInlineSnapshot(
            `"{\\"error\\":\\"CFA Requester is misconfigured\\"}"`,
          );
        });

        it('should return a 400 and mark the OTPRequest as errored if the request is not validated', async () => {
          mock.getConfigForProject.mockImplementationOnce(async () => ({
            myConfig: true,
          }));
          mock.metadataForInitialRequest.mockImplementationOnce(async (req, res) => ({
            metadata: 321,
          }));
          mock.isOTPRequestValidForRequester.mockImplementationOnce(request => request);
          mock.validateActiveRequest.mockImplementationOnce(async () => ({
            ok: false,
            error: "that isn't a bird, that's a plane",
          }));
          const response = await request(router).post('/123/test');
          expect(response.status).toBe(400);
          expect(response.text).toMatchInlineSnapshot(
            `"{\\"error\\":\\"Invalid build provided, check the CFA dashboard for reasoning.\\"}"`,
          );
          const requests = await OTPRequest.findAll();
          expect(requests).toHaveLength(1);
          expect(requests[0].state).toBe('error');
          expect(requests[0].errored).toBeTruthy();
          expect(requests[0].errorReason).toMatchInlineSnapshot(
            `"that isn't a bird, that's a plane"`,
          );
        });

        it('should return a 200 and leave the OTPRequest as requested if the request is validated', async () => {
          mock.getConfigForProject.mockImplementationOnce(async () => ({
            myConfig: true,
          }));
          mock.metadataForInitialRequest.mockImplementationOnce(async (req, res) => ({
            metadata: 321,
          }));
          mock.isOTPRequestValidForRequester.mockImplementationOnce(request => request);
          mock.validateActiveRequest.mockImplementationOnce(async () => ({
            ok: true,
          }));
          const response = await request(router).post('/123/test');
          expect(response.status).toBe(200);
          const body = JSON.parse(response.text);
          expect(body).toHaveProperty('id');
          expect(body).toHaveProperty('proof');
          const requests = await OTPRequest.findAll();
          expect(requests).toHaveLength(1);
          expect(requests[0].id).toBe(body.id);
          expect(requests[0].proof).toBe(body.proof);
        });

        it('should generate unique proof strings for consecutive requests', async () => {
          mock.getConfigForProject.mockImplementation(async () => ({
            myConfig: true,
          }));
          mock.metadataForInitialRequest.mockImplementation(async (req, res) => ({
            metadata: 321,
          }));
          mock.isOTPRequestValidForRequester.mockImplementation(request => request);
          mock.validateActiveRequest.mockImplementation(async () => ({
            ok: true,
          }));
          const response = await request(router).post('/123/test');
          expect(response.status).toBe(200);
          const body = JSON.parse(response.text);
          const response2 = await request(router).post('/123/test');
          expect(response2.status).toBe(200);
          const body2 = JSON.parse(response2.text);
          expect(body.proof).not.toBe(body2.proof);
        });
      });
    });

    describe('validating a request', () => {
      const testUuid = '76e9d11d-517a-4fa0-a954-44e3cc6f9a96';

      beforeEach(async () => {
        const project = new Project({
          id: 123,
          repoName: 'cfa',
          repoOwner: 'electron',
          secret: 'very scret thing',
          defaultBranch: 'main',
        });
        await project.save();
      });

      it('should 400 for a bad UUID', async () => {
        const response = await request(router).post('/123/test/not-a-uuid/validate');
        expect(response.status).toBe(400);
        expect(response.text).toMatchInlineSnapshot(
          `"{\\"error\\":\\"Params Validation Error\\",\\"message\\":\\"child \\\\\\"requestId\\\\\\" fails because [\\\\\\"requestId\\\\\\" must be a valid GUID]\\"}"`,
        );
      });

      it('should 400 for a bad project ID', async () => {
        const response = await request(router).post(`/bad-project/test/${testUuid}/validate`);
        expect(response.status).toBe(400);
        expect(response.text).toMatchInlineSnapshot(
          `"{\\"error\\":\\"Params Validation Error\\",\\"message\\":\\"child \\\\\\"projectId\\\\\\" fails because [\\\\\\"projectId\\\\\\" must be a number]\\"}"`,
        );
      });

      it('should 404 for a non-existent request', async () => {
        const response = await request(router).post(`/123/test/${testUuid}/validate`);
        expect(response.status).toBe(404);
        expect(response.text).toMatchInlineSnapshot(
          `"{\\"error\\":\\"That request does not exist or is invalid\\"}"`,
        );
      });

      describe('with an existing request', () => {
        let req: OTPRequest;
        beforeEach(async () => {
          req = new OTPRequest({
            id: testUuid,
            projectId: '123',
            state: 'requested',
            requested: new Date(),
            requestMetadata: {},
            responseMetadata: {},
            proof: 'very-strong-and-secure',
          });
          await req.save();
        });

        it('should 404 for a request for a different project ID', async () => {
          const response = await request(router).post(`/321/test/${testUuid}/validate`);
          expect(response.status).toBe(404);
          expect(response.text).toMatchInlineSnapshot(
            `"{\\"error\\":\\"That request does not exist or is invalid\\"}"`,
          );
        });

        it('should 422 for a request associated with a project that does not have a matching configured requester for the requestmetadata', async () => {
          mock.isOTPRequestValidForRequester.mockImplementation(async () => false);
          const response = await request(router).post(`/123/test/${testUuid}/validate`);
          expect(mock.isOTPRequestValidForRequester).toBeCalled();
          expect(response.status).toBe(422);
          expect(response.text).toMatchInlineSnapshot(
            `"{\\"error\\":\\"Project is not configured to use this requester\\"}"`,
          );
        });

        it('should 422 for a request associated with a project that does not have a valid config for this requester', async () => {
          mock.isOTPRequestValidForRequester.mockImplementation(async r => r);
          mock.getConfigForProject.mockImplementation(() => null);
          const response = await request(router).post(`/123/test/${testUuid}/validate`);
          expect(mock.getConfigForProject).toBeCalled();
          expect(response.status).toBe(422);
          expect(response.text).toMatchInlineSnapshot(
            `"{\\"error\\":\\"Project is missing the required configuration to use this requester\\"}"`,
          );
        });

        it('should 500 for a request associated with a project has a mis-implementeded getConfigForProject as async', async () => {
          mock.isOTPRequestValidForRequester.mockImplementation(async r => r);
          mock.getConfigForProject.mockImplementation(async () => null);
          const response = await request(router).post(`/123/test/${testUuid}/validate`);
          expect(mock.getConfigForProject).toBeCalled();
          expect(response.status).toBe(500);
          expect(response.text).toMatchInlineSnapshot(
            `"{\\"error\\":\\"getConfigForProject returned a promise-like thing and that is not OK\\"}"`,
          );
        });

        it('should 400 for a request that has errored', async () => {
          req.state = 'error';
          await req.save();
          mock.isOTPRequestValidForRequester.mockImplementation(async r => r);
          mock.getConfigForProject.mockImplementation(() => ({ config: 'stuff' }));
          const response = await request(router).post(`/123/test/${testUuid}/validate`);
          expect(response.status).toBe(400);
          expect(response.text).toMatchInlineSnapshot(
            `"{\\"error\\":\\"Expected the request to be in state \\\\\\"requested\\\\\\" but was in state \\\\\\"error\\\\\\"\\"}"`,
          );
        });

        it('should 400 for a request that has been responded to already', async () => {
          req.state = 'responded';
          await req.save();
          mock.isOTPRequestValidForRequester.mockImplementation(async r => r);
          mock.getConfigForProject.mockImplementation(() => ({ config: 'stuff' }));
          const response = await request(router).post(`/123/test/${testUuid}/validate`);
          expect(response.status).toBe(400);
          expect(response.text).toMatchInlineSnapshot(
            `"{\\"error\\":\\"Expected the request to be in state \\\\\\"requested\\\\\\" but was in state \\\\\\"responded\\\\\\"\\"}"`,
          );
        });

        it('should 400 for a request that has been validated already', async () => {
          req.state = 'validated';
          await req.save();
          mock.isOTPRequestValidForRequester.mockImplementation(async r => r);
          mock.getConfigForProject.mockImplementation(() => ({ config: 'stuff' }));
          const response = await request(router).post(`/123/test/${testUuid}/validate`);
          expect(response.status).toBe(400);
          expect(response.text).toMatchInlineSnapshot(
            `"{\\"error\\":\\"Expected the request to be in state \\\\\\"requested\\\\\\" but was in state \\\\\\"validated\\\\\\"\\"}"`,
          );
        });
      });
    });

    describe('getting a validated request', () => {
      const testUuid = '993fb356-c7e0-4a07-9c2a-6e7a37940445';

      beforeEach(async () => {
        const project = new Project({
          id: 123,
          repoName: 'cfa',
          repoOwner: 'electron',
          secret: 'very scret thing',
          defaultBranch: 'main',
        });
        await project.save();
      });

      it('should 400 for a bad UUID', async () => {
        const response = await request(router).post('/123/test/this-is-a-uuid-i-swear');
        expect(response.status).toBe(400);
        expect(response.text).toMatchInlineSnapshot(
          `"{\\"error\\":\\"Params Validation Error\\",\\"message\\":\\"child \\\\\\"requestId\\\\\\" fails because [\\\\\\"requestId\\\\\\" must be a valid GUID]\\"}"`,
        );
      });

      it('should 400 for a bad projectId', async () => {
        const response = await request(router).post(`/bad-id/test/${testUuid}`);
        expect(response.status).toBe(400);
        expect(response.text).toMatchInlineSnapshot(
          `"{\\"error\\":\\"Params Validation Error\\",\\"message\\":\\"child \\\\\\"projectId\\\\\\" fails because [\\\\\\"projectId\\\\\\" must be a number]\\"}"`,
        );
      });

      it('should 404 for a non-existent request', async () => {
        const response = await request(router).post(`/123/test/${testUuid}`);
        expect(response.status).toBe(404);
        expect(response.text).toMatchInlineSnapshot(
          `"{\\"error\\":\\"That request does not exist or you do not have permission to see it\\"}"`,
        );
      });

      it('should 404 for a request that exists but is not for the current project', async () => {
        const otpRequest = new OTPRequest({
          id: testUuid,
          projectId: '123',
          state: 'requested',
          requested: new Date(),
          requestMetadata: {},
          responseMetadata: {},
          proof: 'very-strong-and-secure',
        });
        await otpRequest.save();
        const response = await request(router).post(`/111/test/${testUuid}`);
        expect(response.status).toBe(404);
        expect(response.text).toMatchInlineSnapshot(
          `"{\\"error\\":\\"That request does not exist or you do not have permission to see it\\"}"`,
        );
      });

      it('should 204 No-Content for a request that has not been responded to', async () => {
        const otpRequest = new OTPRequest({
          id: testUuid,
          projectId: '123',
          state: 'requested',
          requested: new Date(),
          requestMetadata: {},
          responseMetadata: {},
          proof: 'very-strong-and-secure',
        });
        await otpRequest.save();
        const response = await request(router).post(`/123/test/${testUuid}`);
        expect(response.status).toBe(204);
        expect(response.text).toMatchInlineSnapshot(`""`);
      });

      it('should return an otp request that has been responded to', async () => {
        const otpRequest = new OTPRequest({
          id: testUuid,
          projectId: '123',
          state: 'responded',
          response: 'my-otp',
          requested: new Date(),
          requestMetadata: {},
          responseMetadata: {},
          proof: 'very-strong-and-secure',
        });
        await otpRequest.save();
        const response = await request(router).post(`/123/test/${testUuid}`);
        expect(response.status).toBe(200);
        const body = JSON.parse(response.text);
        expect(body.id).toBe(otpRequest.id);
        expect(body.response).toBe('my-otp');
      });
    });
  });
});
