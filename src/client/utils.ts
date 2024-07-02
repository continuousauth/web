import { SimpleProject } from '../common/types';

export const cx = (...args: (string | null | undefined)[]) => args.filter(a => a).join(' ');

export const projectHasAnyConfig = (project: SimpleProject): boolean => {
  return Boolean(project.requester_circleCI || project.requester_gitHub || project.responder_slack);
};

export const defaultBodyReader = (body: any) => body.json();
export const defaultFetchInit = {};
