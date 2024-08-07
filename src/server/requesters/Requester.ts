import { Request, Response } from 'express';
import type * as jwt from 'jsonwebtoken';

import { Project, OTPRequest } from '../db/models';
import { RequestInformation } from '../responders/Responder';

export type AllowedState =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

export interface Requester<RequesterConfig, MetadataType> {
  /**
   * The url slug to host this requester on.
   *
   * E.g. "circleci" would generate the /:projectId/circleci/* routes
   */
  readonly slug: string;
  /**
   * Should return the config instance from the project that this requester
   * uses.  If it does not exist return null to indicate incompatibility
   * with the incoming request.
   *
   * @param project The project the request is being created for
   */
  getConfigForProject(project: Project): RequesterConfig | null;
  /**
   * The initial "create otp request" API call will come with metadata that
   * the requester should acquire, validate and return if it's ok.
   *
   * If the metadata is missing, invalid or incorrect the requester should
   * return null and send a 400 status back with information on the issue
   * with the request.
   *
   * @param req Incoming Request
   * @param res Outgoing Response
   */
  metadataForInitialRequest(req: Request, res: Response): Promise<MetadataType | null>;
  /**
   * This method should ensure that based on the metadata for this OTPRequest
   * the request is valid, active and not being spoofed.  i.e. the CI build is
   * still running, on the default_branch branch, etc.
   *
   * Check the existing implementations for a better idea of what this method should do
   *
   * @param request
   */
  validateActiveRequest(
    request: OTPRequest<MetadataType, unknown>,
    config: RequesterConfig,
  ): Promise<AllowedState>;
  /**
   * This method should ensure that the active request has proved itself, normally for
   * CI builds this means checking that the CI build has logged the proof property of
   * the OTP Request
   *
   * @param request
   */
  validateProofForRequest(
    request: OTPRequest<MetadataType, unknown>,
    config: RequesterConfig,
  ): Promise<boolean>;
  /**
   * This should run a JOI validator on the request.requestMetadata property, if it's invalid
   * return false, otherwise return true.
   *
   * This is designed to handle the requester/responder for a project being modified with an
   * OTP request being inflight.
   *
   * @param request
   */
  isOTPRequestValidForRequester(
    request: OTPRequest<unknown, unknown>,
  ): Promise<OTPRequest<MetadataType, unknown> | null>;
  /**
   * This return the url/description that the responder uses to ask for an OTP, normally the URL
   * of the CI build.
   *
   * @param request
   */
  getRequestInformationToPassOn(
    request: OTPRequest<MetadataType, unknown>,
  ): Promise<RequestInformation>;
  /**
   * This returns the OIDC discovery URL for the given provider.
   *
   * For providers that don't support OIDC return null and no behavior will change.
   */
  getOpenIDConnectDiscoveryURL(project: Project, config: RequesterConfig): Promise<string | null>;
  /**
   * This should validate the given JWT claims against the expected project.
   */
  doOpenIDConnectClaimsMatchProject(
    claims: jwt.JwtPayload,
    project: Project,
    config: RequesterConfig,
  ): Promise<boolean>;
}
