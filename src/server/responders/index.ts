import { Project } from '../db/models';

import { Responder } from './Responder';
import { SlackResponder } from './SlackResponder';

export function getResponderFor(project: Project): Responder {
  if (project.responder_slack) {
    return new SlackResponder(project);
  }
  throw new Error(`Attempted to get responder for project ${project.id} but it does not have one`);
}
