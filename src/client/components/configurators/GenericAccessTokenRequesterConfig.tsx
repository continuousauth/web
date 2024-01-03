import * as React from 'react';
import { Button, Pane, TextInput, toaster } from 'evergreen-ui';

import { FullProject } from '../../../common/types';
import { useAsyncTaskFetch } from 'react-hooks-async';
import { defaultBodyReader } from '../../utils';

export interface Props {
  project: FullProject;
  setProject: (newProject: FullProject) => void;
  originalAccessToken: string;
  children: React.ReactChild | React.ReactChild[];
  slug: 'circleci';
  requesterName: string;
}

export function GenericAccessTokenRequesterConfig({
  project,
  setProject,
  originalAccessToken,
  children,
  slug,
  requesterName,
}: Props) {
  const [accessToken, setAccesToken] = React.useState(originalAccessToken);

  const options = React.useMemo(
    () => ({
      method: 'POST',
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ accessToken }),
    }),
    [project, accessToken],
  );

  const createRequesterTask = useAsyncTaskFetch<FullProject>(
    `/api/project/${project.id}/config/requesters/${slug}`,
    options,
    defaultBodyReader,
  );

  React.useEffect(() => {
    if (createRequesterTask.error) {
      toaster.danger(
        `Failed to create the ${requesterName} Requester, please ensure the access token is correct and try again.`,
      );
    }
  }, [createRequesterTask.error]);

  React.useEffect(() => {
    if (createRequesterTask.result) {
      toaster.success(
        `Successfully created the ${requesterName} Requester, the access token is valid.`,
      );
      setProject(createRequesterTask.result);
    }
  }, [createRequesterTask.result]);

  const saving = createRequesterTask.started && createRequesterTask.pending;

  return (
    <Pane>
      <Pane>
        {children}
        <TextInput
          value={accessToken}
          type="password"
          onChange={e => setAccesToken(e.currentTarget.value)}
          disabled={saving}
        />
        {accessToken !== originalAccessToken && accessToken ? (
          <Button
            appearance="primary"
            intent="success"
            marginLeft={8}
            isLoading={saving}
            disabled={!!createRequesterTask.error}
            onClick={() => createRequesterTask.start()}
          >
            Save
          </Button>
        ) : null}
      </Pane>
    </Pane>
  );
}
