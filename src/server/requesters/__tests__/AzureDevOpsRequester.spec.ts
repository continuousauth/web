import {
  AzureDevOpsRequester,
  GetAxiosForConfigFn,
  AzureDevOpsRelease,
  AzureDevOpsRequestMetadata,
} from '../AzureDevOpsRequester';
import { Project, OTPRequest, AzureDevOpsRequesterConfig } from '../../db/models';
import { Request as JestRequest } from 'jest-express/lib/request';
import { Response as JestResponse } from 'jest-express/lib/response';
import { Request, Response } from 'express';
import { AxiosInstance, AxiosResponse } from 'axios';

describe('createA', () => {
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

  // it('when getRequestInformationToPassOn is called it should', () => {
  //   // arrange
  //   const { build } = setup().default();
  //   const c = build();
  //   // act
  //   c.getRequestInformationToPassOn();
  //   // assert
  //   // expect(c).toEqual
  // });

  // it('when validateProofForRequest is called it should', () => {
  //   // arrange
  //   const { build } = setup().default();
  //   const c = build();
  //   // act
  //   c.validateProofForRequest();
  //   // assert
  //   // expect(c).toEqual
  // });
});

function setup() {
  let req = (new JestRequest() as unknown) as Request;
  let res = (new JestResponse() as unknown) as Response;

  let axiosMockResponse = {} as AxiosResponse<AzureDevOpsRelease>;
  const getAxiosForConfigMock: GetAxiosForConfigFn = () =>
    (({
      get: () => Promise.resolve(axiosMockResponse),
    } as unknown) as AxiosInstance);

  let isAxiosResponse = <T>(x: any): x is AxiosResponse<T> => {
    return x != null && 'status' in x && x.status > 0;
  };

  const builder = {
    req,
    res,
    withAzDOResponse(x: AzureDevOpsRelease | AxiosResponse<AzureDevOpsRelease>) {
      axiosMockResponse = isAxiosResponse(x)
        ? x
        : ({ status: 200, data: x } as AxiosResponse<AzureDevOpsRelease>);
      return builder;
    },
    default() {
      return builder;
    },
    build() {
      return new AzureDevOpsRequester(getAxiosForConfigMock);
    },
  };

  return builder;
}
