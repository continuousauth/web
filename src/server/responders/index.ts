import { Project } from '../db/models';

import { Responder } from './Responder';
import { SlackResponder } from './SlackResponder';

export function getResponderFor<Req>(project: Project): Responder<Req> {
  if (project.responder_slack) {
    return new SlackResponder(project) as Responder<Req>;
  }
  throw new Error(`Attempted to get responder for project ${project.id} but it does not have one`);
}
