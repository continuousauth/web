import { Project, OTPRequest } from '../db/models';

export type RequestInformation = {
  description: string;
  url: string;
};

export abstract class Responder {
  constructor(protected project: Project) {}

  abstract requestOtp(request: OTPRequest, info: RequestInformation | null): Promise<void>;
}
