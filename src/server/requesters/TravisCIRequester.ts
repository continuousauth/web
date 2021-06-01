import axios from 'axios';
import { Request, Response } from 'express';
import * as Joi from 'joi';

import { Requester, AllowedState } from './Requester';
import { Project, OTPRequest, TravisCIRequesterConfig } from '../db/models';
import { RequestInformation } from '../responders/Responder';

export type TravisCIOTPRequestMetadata = {
  // Unique
  buildId: number;
  // Human friendly
  buildNumber: string;
  jobId: number;
};

type TravisCIRepository = {
  github_id: number;
  active: boolean;
};

type TravisCIJob = {
  id: number;
  number: string;
  state: string;
};

type TravisCIJobLog = {
  id: number;
  content: string;
};

type TravisCIBuild = {
  id: number;
  number: string;
  state: string;
  duration: number;
  event_type: string;
  repository: TravisCIRepository;
  branch: {
    name: string;
  };
  jobs: TravisCIJob[];
};

export const getAxiosForConfig = (config: TravisCIRequesterConfig) =>
  axios.create({
    baseURL: 'https://api.travis-ci.org',
    headers: {
      'Travis-API-Version': '3',
      Authorization: `token ${config.accessToken}`,
    },
    validateStatus: () => true,
  });

const validateMetadataObject = (object: any) =>
  Joi.validate(object, {
    buildId: Joi.number()
      .min(1)
      .integer()
      .required(),
    buildNumber: Joi.number()
      .min(1)
      .integer()
      .required(),
    jobId: Joi.number()
      .min(1)
      .integer()
      .required(),
  });

export class TravisCIRequester
  implements Requester<TravisCIRequesterConfig, TravisCIOTPRequestMetadata> {
  readonly slug = 'travisci';

  getConfigForProject(project: Project) {
    return project.requester_travisCI || null;
  }

  async metadataForInitialRequest(
    req: Request,
    res: Response,
  ): Promise<TravisCIOTPRequestMetadata | null> {
    const result = validateMetadataObject(req.body);
    if (result.error) {
      res.status(400).json({
        error: 'Request Validation Error',
        message: result.error.message,
      });
      return null;
    }

    return {
      buildId: result.value.buildId,
      buildNumber: `${result.value.buildNumber}`,
      jobId: result.value.jobId,
    };
  }

  async validateActiveRequest(
    request: OTPRequest<TravisCIOTPRequestMetadata, unknown>,
    config: TravisCIRequesterConfig,
  ): Promise<AllowedState> {
    const buildResponse = await getAxiosForConfig(config).get<TravisCIBuild>(
      `/build/${request.requestMetadata.buildId}?include=build.jobs,build.repository`,
    );

    // Build clearly does not exist
    if (buildResponse.status !== 200)
      return {
        ok: false,
        error: 'Travis CI build does not exist',
      };

    const build = buildResponse.data;

    // Must be for this repository
    if (`${build.repository.github_id}` !== request.project.id)
      return {
        ok: false,
        error: 'Travis CI build is not for this project',
      };

    if (build.number !== request.requestMetadata.buildNumber)
      return {
        ok: false,
        error: 'Travis CI build does not match the initially provided build number',
      };

    // Must be on the default branch
    if (build.branch.name !== request.project.defaultBranch)
      return {
        ok: false,
        error: 'Travis CI build is not for the default branch',
      };

    // Trigger must be a GitHub push
    if (build.event_type !== 'push')
      return {
        ok: false,
        error: 'Travis CI build was triggered manually, not by GitHub',
      };

    // Build must be currently running
    if (build.state !== 'started')
      return {
        ok: false,
        error: 'Travis CI build is not running',
      };

    const job = build.jobs.find(job => job.id === request.requestMetadata.jobId);
    if (!job)
      return {
        ok: false,
        error: 'Travis CI job does not appear to exist in that build',
      };

    if (job.state !== 'started')
      return {
        ok: false,
        error: 'Travis CI job is not running',
      };

    return {
      ok: true,
    };
  }

  async validateProofForRequest(
    request: OTPRequest<TravisCIOTPRequestMetadata, unknown>,
    config: TravisCIRequesterConfig,
  ): Promise<boolean> {
    const { proof } = request;
    const { jobId } = request.requestMetadata;

    async function attemptToValidateProof(attempts: number): Promise<boolean> {
      if (attempts <= 0) return false;

      const again = async () => {
        await new Promise(r => setTimeout(r, 5000));
        return attemptToValidateProof(attempts - 1);
      };

      const logResponse = await getAxiosForConfig(config).get<TravisCIJobLog>(`/job/${jobId}/log`, {
        validateStatus: () => true,
      });
      // Job clearly does not exist
      if (logResponse.status !== 200) return again();

      const log = logResponse.data;
      if (!log.content) return again();

      const output = log.content.trim();
      if (new RegExp(`Proof:(\r?\n)${proof}$`).test(output)) return true;

      return again();
    }

    return attemptToValidateProof(3);
  }

  async isOTPRequestValidForRequester(
    request: OTPRequest<unknown, unknown>,
  ): Promise<OTPRequest<TravisCIOTPRequestMetadata> | null> {
    const result = validateMetadataObject(request.requestMetadata);
    if (result.error) return null;
    return request as any;
  }

  async getRequestInformationToPassOn(
    request: OTPRequest<TravisCIOTPRequestMetadata, unknown>,
  ): Promise<RequestInformation> {
    const { project } = request;

    return {
      description: `Travis CI Build for ${project.repoOwner}/${project.repoName}#${request.requestMetadata.buildNumber}`,
      url: `https://travis-ci.org/${project.repoOwner}/${project.repoName}/builds/${request.requestMetadata.buildId}`,
    };
  }
}
