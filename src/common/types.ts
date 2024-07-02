export interface User {
  id: string;
  displayName: string;
  username: string;
  profileUrl: string;
}

export interface SimpleRepo {
  id: string;
  repoName: string;
  repoOwner: string;
  defaultBranch: string;
}

export interface SimpleProject extends SimpleRepo {
  requester_circleCI: boolean;
  requester_gitHub: boolean;
  responder_slack: {
    team: string;
    channel: string;
  } | null;
}

export interface FullProject extends SimpleRepo {
  secret: string;
  enabled: boolean;
  requester_circleCI: {
    accessToken: string;
  } | null;
  requester_gitHub: {} | null;
  responder_slack: {
    teamName: string;
    channelName: string;
    teamIcon: string;
    usernameToMention: string;
  } | null;
}

export interface ReposResponse {
  all: SimpleRepo[];
  configured: SimpleProject[];
}

type Any<T> = {
  [P in keyof T]: any;
};

export const projectIsMissingConfig = (
  project: Any<
    Pick<
      FullProject,
      Exclude<
        keyof FullProject,
        'secret' | 'enabled' | 'id' | 'repoName' | 'repoOwner' | 'defaultBranch'
      >
    >
  >,
) => {
  const hasRequester: boolean = !!project.requester_circleCI || !!project.requester_gitHub;
  const hasResponder: boolean = !!project.responder_slack;
  return !hasRequester || !hasResponder;
};
