import * as React from 'react';
import { Alert, Button, Code, Heading, Pane, Paragraph, toaster } from 'evergreen-ui';

import { FullProject } from '../../../common/types';
import { useAsyncTaskFetch } from 'react-hooks-async';
import { defaultBodyReader } from '../../utils';

export interface Props {
  project: FullProject;
  setProject: (newProject: FullProject) => void;
}

export function GitHubActionsRequesterConfig({ project, setProject }: Props) {
  const [showInstallButton, setShowInstallButton] = React.useState(false);
  const options = React.useMemo(
    () => ({
      method: 'POST',
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({}),
    }),
    [project],
  );

  const installGitHubApp = React.useCallback(() => {
    window.open('https://github.com/apps/continuous-auth/installations/new', '_blank');
    setShowInstallButton(false);
  }, []);

  const createRequesterTask = useAsyncTaskFetch<FullProject>(
    `/api/project/${project.id}/config/requesters/github`,
    options,
    defaultBodyReader,
  );

  const projectSlug = `${project.repoOwner}/${project.repoName}`;

  React.useEffect(() => {
    if (createRequesterTask.error) {
      if (createRequesterTask.error.message.includes('412')) {
        toaster.notify(`Continuous Auth not installed in ${projectSlug}`);
        setShowInstallButton(true);
      } else {
        toaster.danger(`Failed to create the GitHub Requester, please try again later.`);
      }
    }
  }, [createRequesterTask.error, projectSlug]);

  React.useEffect(() => {
    if (createRequesterTask.result) {
      toaster.success(`Successfully created the GitHub Requester.`);
      setProject(createRequesterTask.result);
    }
  }, [createRequesterTask.result]);

  const saving = createRequesterTask.started && createRequesterTask.pending;

  return (
    <Pane>
      <Pane>
        <Heading size={400} marginBottom={8}>
          GitHub Actions Secrets
        </Heading>
        {showInstallButton ? (
          <>
            <Alert marginBottom={4} intent="warning">
              You need to install the Continuous Auth github app before we can set this project up.
              <br />
              <Button marginTop={12} onClick={installGitHubApp}>
                Install
              </Button>
            </Alert>
          </>
        ) : null}
        {project.requester_gitHub ? (
          <>
            <Paragraph marginBottom={4}>
              ContinuousAuth is fully set up, if you're having issues with secrets you can use the
              "Fix" button below.
            </Paragraph>
            <Button
              appearance="default"
              marginLeft={8}
              isLoading={saving}
              disabled={showInstallButton}
              onClick={() => createRequesterTask.start()}
            >
              Fix GitHub Actions for {project.repoOwner}/{project.repoName}
            </Button>
          </>
        ) : (
          <>
            <Paragraph marginBottom={4}>
              ContinuousAuth needs to make some secrets in GitHub Actions in order to publish.
            </Paragraph>
            <Button
              appearance="primary"
              intent="success"
              marginLeft={8}
              isLoading={saving}
              disabled={showInstallButton}
              onClick={() => createRequesterTask.start()}
            >
              Use GitHub Actions for {project.repoOwner}/{project.repoName}
            </Button>
          </>
        )}
      </Pane>
    </Pane>
  );
}
