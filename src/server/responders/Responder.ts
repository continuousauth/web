import { Project, OTPRequest } from '../db/models';

export type RequestInformation = {
  description: string;
  url: string;
};

export abstract class Responder<Req = unknown, Res = unknown> {
  constructor(protected project: Project) {}

  abstract requestOtp(
    request: OTPRequest<Req, Res>,
    info: RequestInformation | null,
  ): Promise<void>;
}
