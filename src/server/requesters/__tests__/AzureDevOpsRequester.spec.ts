import { AxiosInstance, AxiosResponse } from 'axios';
import { Request, Response } from 'express';
import * as fs from 'fs';
import { Request as JestRequest } from 'jest-express/lib/request';
import { Response as JestResponse } from 'jest-express/lib/response';
import { AzureDevOpsRequesterConfig, OTPRequest, Project } from '../../db/models';
import {
  AzureDevOpsRelease,
  AzureDevOpsRequester,
  AzureDevOpsRequestMetadata,
  GetAxiosForConfigFn,
} from '../AzureDevOpsRequester';

describe('AzureDevOpsRequester', () => {
  it('should have the correct slug', () => {
    const requester = setup().build();

    expect(requester.slug).toBe('azuredevops-release');
  });
  // azdo = Azure Dev Ops
  it('when getConfigForProject is called it should return the azdo config if one is present in project', () => {
    // arrange
    const { build } = setup().default();
    const c = build();
    // act
    const r = c.getConfigForProject({
      requester_AzureDevOps: {} as any,
    } as Project);
    // assert
    expect(r).toEqual({});
  });

  it('when getConfigForProject is called it should return the null if missing', () => {
    // arrange
    const { build } = setup().default();
    const c = build();
    // act
    const r = c.getConfigForProject(({
      requester_AzureDevOps: undefined,
    } as any) as Project);
    // assert
    expect(r).toEqual(null);
  });

  it('when metadataForInitialRequest is called it should set status 400 for missing releaseId', () => {
    // arrange
    const { build, req, res } = setup().default();
    const c = build();
    // act
    c.metadataForInitialRequest(req, res);

    // assert
    expect(res.status).toHaveBeenCalledWith(400);
  });
  it('when metadataForInitialRequest is called with not-a-number as releaseId should set status 400 for missing releaseId', () => {
    // arrange
    const { build, req, res } = setup().default();
    const c = build();
    req.body = JSON.stringify({ releaseId: 'a word' });
    // act
    c.metadataForInitialRequest(req, res);

    // assert
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('when metadataForInitialRequest is called with number as releaseId it should the request', async () => {
    // arrange
    const { build, req, res } = setup().default();
    const c = build();
    req.body = JSON.stringify({ releaseId: 10 });
    // act
    const x = c.metadataForInitialRequest(req, res);

    // assert
    await expect(x).resolves.toEqual({ releaseId: 10 });
  });

  it('when validateActiveRequest is called and azdo response status is not 200 it should return an error state', async () => {
    // arrange
    const { build } = setup()
      .default()
      .withAzDOResponse({ status: 400 } as AxiosResponse<any>);
    const c = build();
    const request = { requestMetadata: { releaseId: 1 } } as OTPRequest<
      AzureDevOpsRequestMetadata,
      unknown
    >;
    const config = {} as AzureDevOpsRequesterConfig;
    // act
    const validation = c.validateActiveRequest(request, config);
    // assert
    await expect(validation).resolves.toEqual({
      ok: false,
      error: 'Release with id 1 does not exist!',
    });
  });

  it('when validateActiveRequest is called and azdo the release is not `phaseInProgress` status it should return an error state', async () => {
    // arrange
    const { build } = setup()
      .default()
      .withAzDOResponse({ operationStatus: 'approved' } as AzureDevOpsRelease);
    const c = build();
    const request = { requestMetadata: { releaseId: 1 } } as OTPRequest<
      AzureDevOpsRequestMetadata,
      unknown
    >;
    const config = {} as AzureDevOpsRequesterConfig;
    // act
    const validation = c.validateActiveRequest(request, config);
    // assert
    await expect(validation).resolves.toEqual({
      ok: false,
      error: 'Release with id 1 is not in progress!',
    });
  });

  it('when validateActiveRequest is called and azdo the release is in `phaseInProgress` status it should return ok state', async () => {
    // arrange
    const { build } = setup()
      .default()
      .withAzDOResponse({ operationStatus: 'phaseInProgress' } as AzureDevOpsRelease);
    const c = build();
    const request = { requestMetadata: { releaseId: 1 } } as OTPRequest<
      AzureDevOpsRequestMetadata,
      unknown
    >;
    const config = {} as AzureDevOpsRequesterConfig;
    // act
    const validation = c.validateActiveRequest(request, config);
    // assert
    await expect(validation).resolves.toEqual({
      ok: true,
    });
  });

  it('when isOTPRequestValidForRequester is called with a valid request it should return the request', () => {
    // arrange
    const { build } = setup().default();
    const c = build();
    const validRequest = { requestMetadata: { releaseId: 1 } } as OTPRequest<
      AzureDevOpsRequestMetadata,
      unknown
    >;
    // act
    const result = c.isOTPRequestValidForRequester(validRequest);
    // assert
    expect(result).toEqual(validRequest);
  });

  it('when isOTPRequestValidForRequester is called with an invalid request it should return null', () => {
    // arrange
    const { build } = setup().default();
    const c = build();
    const validRequest = ({
      requestMetadata: { releaseId: 'invalid number' },
    } as unknown) as OTPRequest<AzureDevOpsRequestMetadata, unknown>;
    // act
    const result = c.isOTPRequestValidForRequester(validRequest);
    // assert
    expect(result).toBeNull();
  });

  it('when getRequestInformationToPassOn is called it should parse the Azure DevOps release info and use the web href from its links', async () => {
    // arrange
    const { build } = setup()
      .default()
      .withAzDOResponse({ _links: { web: { href: 'http://my-release' } } } as AzureDevOpsRelease);
    const c = build();
    // act
    const d = await c.getRequestInformationToPassOn({
      project: { repoOwner: 'me', repoName: 'some repo' } as Project,
      requestMetadata: { releaseId: 1 },
    } as OTPRequest<AzureDevOpsRequestMetadata, unknown>);
    // assert
    expect(d).toEqual({
      description: 'Azure DevOps Release me/some repo#1',
      url: 'http://my-release',
    });
  });

  it('when validateProofForRequest is called and logs contains the proof `npm` it should return true', async () => {
    // arrange
    const { build } = setup()
      .default()
      .withAzDOLogsResponseContainingTheWord_npm();
    const c = build();

    const request = { requestMetadata: { releaseId: 1 }, proof: 'npm' } as OTPRequest<
      AzureDevOpsRequestMetadata,
      unknown
    >;
    const config = {} as AzureDevOpsRequesterConfig;

    // act
    const valid = await c.validateProofForRequest(request, config);
    // assert
    expect(valid).toEqual(true);
  });

  it('when validateProofForRequest is called and logs does not contain the proof `random41231313string` it should return false', async () => {
    // arrange
    const { build } = setup()
      .default()
      .withAzDOLogsResponseContainingTheWord_npm();
    const c = build();

    const request = {
      requestMetadata: { releaseId: 1 },
      proof: 'random41231313string',
    } as OTPRequest<AzureDevOpsRequestMetadata, unknown>;
    const config = {} as AzureDevOpsRequesterConfig;

    // act
    const valid = await c.validateProofForRequest(request, config);
    // assert
    expect(valid).toEqual(false);
  });
});

function setup() {
  let req = (new JestRequest() as unknown) as Request;
  let res = (new JestResponse() as unknown) as Response;

  let axiosMockResponse = () => ({} as AxiosResponse<any>);
  const getAxiosForConfigMock: GetAxiosForConfigFn = () =>
    (({
      get: () => {
        return Promise.resolve(axiosMockResponse());
      },
    } as unknown) as AxiosInstance);

  let isAxiosResponse = <T>(x: any): x is AxiosResponse<T> => {
    return x != null && 'status' in x && x.status > 0;
  };

  let retryTimeout = 1;

  const builder = {
    req,
    res,
    withAzDOResponse(x: AzureDevOpsRelease | AxiosResponse<AzureDevOpsRelease>) {
      axiosMockResponse = isAxiosResponse(x)
        ? () => x
        : () => ({ status: 200, data: x } as AxiosResponse<AzureDevOpsRelease>);
      return builder;
    },
    withAzDOLogsResponseContainingTheWord_npm() {
      axiosMockResponse = () =>
        ({
          status: 200,
          data: builder.getLogsZipStreamWhichContainsTheWord_npm(),
        } as AxiosResponse<any>);

      return builder;
    },
    getLogsZipStreamWhichContainsTheWord_npm() {
      return fs.createReadStream(__dirname + '/logs');
    },
    default() {
      return builder;
    },
    build() {
      return new AzureDevOpsRequester(getAxiosForConfigMock, retryTimeout);
    },
  };

  return builder;
}
