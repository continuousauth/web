import { Octokit } from '@octokit/rest';
import axios from 'axios';
import { Request, Response } from 'express';
import * as Joi from 'joi';
import * as jwt from 'jsonwebtoken';

import { Requester, AllowedState } from './Requester';
import { Project, GitHubActionsRequesterConfig, OTPRequest } from '../db/models';
import { getGitHubAppInstallationToken } from '../helpers/auth';
import { RequestInformation } from '../responders/Responder';
import { CFA_RELEASE_GITHUB_ENVIRONMENT_NAME } from '../api/project/config';
import { getSignatureValidatedOIDCClaims } from '../helpers/oidc';

type GitHubActionsOTPRequestMetadata = {
  oidcToken: string;
  buildUrl: string;
};

const validateMetadataObject = (object: any) => {
  return Joi.validate(object, {
    oidcToken: Joi.string().min(1).required(),
    buildUrl: Joi.string()
      .uri({
        scheme: 'https',
      })
      .required(),
  });
};

export class GitHubActionsRequester
  implements Requester<GitHubActionsRequesterConfig, GitHubActionsOTPRequestMetadata>
{
  readonly slug = 'github';

  getConfigForProject(project: Project) {
    return project.requester_gitHub || null;
  }

  async getOpenIDConnectDiscoveryURL(project: Project, config: GitHubActionsRequesterConfig) {
    return 'https://token.actions.githubusercontent.com';
  }

  async doOpenIDConnectClaimsMatchProject(
    claims: jwt.JwtPayload,
    project: Project,
    config: GitHubActionsRequesterConfig,
  ) {
    const internal = await this.doOpenIDConnectClaimsMatchProjectInternal(claims, project);
    if (!internal.ok) {
      console.error(
        `Failed to match OIDC claims to project(${project.repoOwner}/${project.repoName}):`,
        claims,
        internal,
      );
    }
    return internal.ok;
  }

  private async doOpenIDConnectClaimsMatchProjectInternal(
    claims: jwt.JwtPayload,
    project: Project,
  ): Promise<AllowedState> {
    if (claims.aud !== 'continuousauth.dev') {
      return { ok: false, error: 'Token audience is not correct' };
    }
    // Wrong repository
    if (claims.repository_id !== project.id)
      return { ok: false, error: 'GitHub Actions build is for incorrect repository id' };

    // Wrong repository name (probably out of date)
    if (claims.repository_owner !== project.repoOwner)
      return { ok: false, error: 'GitHub Actions build is for incorrect repository owner' };
    if (claims.repository !== `${project.repoOwner}/${project.repoName}`)
      return { ok: false, error: 'GitHub Actions build is for incorrect repository' };

    // Must be running int he right environment
    if (
      claims.sub !==
      `repo:${project.repoOwner}/${project.repoName}:environment:${CFA_RELEASE_GITHUB_ENVIRONMENT_NAME}`
    )
      return { ok: false, error: 'GitHub Actions build is for incorrect environment' };

    // Must be on the default branch
    if (claims.ref.startsWith('refs/tags/')) {
      const token = await getGitHubAppInstallationToken(project, {
        metadata: 'read',
        contents: 'read',
      });
      const github = new Octokit({ auth: token });

      const comparison = await github.repos.compareCommitsWithBasehead({
        owner: project.repoOwner,
        repo: project.repoName,
        // Use sha instead of ref here to ensure no malicious race between job start and
        // ref re-point
        basehead: `${claims.sha}...${project.defaultBranch}`,
      });

      if (
        comparison.status !== 200 ||
        !(comparison.data.behind_by === 0 && comparison.data.ahead_by >= 0)
      ) {
        return {
          ok: false,
          error: 'GitHub Actions build is for a tag not on the default branch',
        };
      }
    } else if (claims.ref !== `refs/heads/${project.defaultBranch}`) {
      return {
        ok: false,
        error: 'GitHub Actions build is not for the default branch',
      };
    }

    // Trigger must be GitHub
    // Check event_name must be push
    // Some repos use workflow_dispatch, those cases can be handled during migration
    // as it requires more though
    if (claims.event_name !== 'push')
      return {
        ok: false,
        error: 'GitHub Actions build was triggered by not-a-push',
      };

    // Build must be currently running
    // Hit API using claims.run_id, run_number and run_attempt
    const token = await getGitHubAppInstallationToken(project, {
      metadata: 'read',
      contents: 'read',
    });
    const github = new Octokit({ auth: token });
    let isStillRunning = false;
    try {
      const workflowRunAttempt = await github.actions.getWorkflowRunAttempt({
        owner: project.repoOwner,
        repo: project.repoName,
        run_id: claims.run_id,
        attempt_number: claims.run_attempt,
      });
      isStillRunning = workflowRunAttempt.data.status === 'in_progress';
    } catch {
      isStillRunning = false;
    }
    if (!isStillRunning)
      return {
        ok: false,
        error: 'GitHub Actions build is not running',
      };

    // SSH must be disabled for safety
    // We should be able to check this when GitHub releases actions ssh
    // for now just checking we're running on github infra is enough
    if (claims.runner_environment !== 'github-hosted')
      return {
        ok: false,
        error: 'GitHub Actions build could have SSH enabled, this is not allowed',
      };

    return { ok: true, needsLogBasedProof: false };
  }

  async metadataForInitialRequest(
    req: Request,
    res: Response,
  ): Promise<GitHubActionsOTPRequestMetadata | null> {
    const result = validateMetadataObject(req.body);
    if (result.error) {
      res.status(400).json({
        error: 'Request Validation Error',
        message: result.error.message,
      });
      return null;
    }

    return {
      oidcToken: result.value.oidcToken,
      buildUrl: result.value.buildUrl,
    };
  }

  async validateActiveRequest(
    request: OTPRequest<GitHubActionsOTPRequestMetadata, unknown>,
    config: GitHubActionsRequesterConfig,
  ): Promise<AllowedState> {
    const { project } = request;

    // validate and parse claims from request
    let claims: jwt.Jwt | null;
    try {
      claims = await getSignatureValidatedOIDCClaims(
        this,
        project,
        config,
        request.requestMetadata.oidcToken,
      );
    } catch (err) {
      if (typeof err === 'string') {
        return {
          ok: false,
          error: err,
        };
      }
      claims = null;
    }

    if (!claims) {
      return {
        ok: false,
        error: 'Failed to validate OIDC token',
      };
    }

    const claimsEvaluation = await this.doOpenIDConnectClaimsMatchProjectInternal(claims, project);
    if (!claimsEvaluation.ok) {
      return {
        ok: false,
        error: claimsEvaluation.error,
      };
    }

    return {
      ok: true,
      needsLogBasedProof: false,
    };
  }

  async validateProofForRequest(
    request: OTPRequest<GitHubActionsOTPRequestMetadata, unknown>,
    config: GitHubActionsRequesterConfig,
  ): Promise<boolean> {
    // Not needed, default closed
    return false;
  }

  async isOTPRequestValidForRequester(
    request: OTPRequest<unknown, unknown>,
  ): Promise<OTPRequest<GitHubActionsOTPRequestMetadata> | null> {
    const result = validateMetadataObject(request.requestMetadata);
    if (result.error) return null;
    return request as any;
  }

  async getRequestInformationToPassOn(
    request: OTPRequest<GitHubActionsOTPRequestMetadata, unknown>,
  ): Promise<RequestInformation> {
    const { project } = request;

    return {
      description: `GitHub Actions Build for ${project.repoOwner}/${project.repoName}`,
      url: request.requestMetadata.buildUrl,
    };
  }
}
