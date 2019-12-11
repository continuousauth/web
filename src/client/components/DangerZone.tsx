import * as React from 'react';
import { Alert, Button, Dialog, Pane, toaster } from 'evergreen-ui';
import { FullProject } from '../../common/types';

import * as styles from './DangerZone.scss';
import { useAsyncTaskFetch } from 'react-hooks-async';
import { defaultBodyReader } from '../utils';

export interface Props {
  project: FullProject;
  setProject: (project: FullProject) => void;
}

enum ConfirmState {
  CLOSED,
  OPEN,
}

export function DangerZone({ project, setProject }: Props) {
  const [confirmState, setConfirmState] = React.useState<{
    state: ConfirmState;
    pendingAction: (() => void) | null;
  }>({
    state: ConfirmState.CLOSED,
    pendingAction: null,
  });
  const regenerateSecretOptions = React.useMemo(
    () => ({
      method: 'PATCH',
    }),
    [project.id, project.secret],
  );
  const regenerateSecretTask = useAsyncTaskFetch<FullProject>(
    `/api/project/${project.id}/secret`,
    regenerateSecretOptions,
    defaultBodyReader,
  );

  const disableOptions = React.useMemo(
    () => ({
      method: 'DELETE',
    }),
    [project.id],
  );
  const disableTask = useAsyncTaskFetch<FullProject>(
    `/api/project/${project.id}`,
    disableOptions,
    defaultBodyReader,
  );

  const regeneratePending = regenerateSecretTask.started && regenerateSecretTask.pending;
  const disablePending = disableTask.started && disableTask.pending;

  React.useEffect(() => {
    if (regenerateSecretTask.error) {
      toaster.danger('Failed to regenerate project secret, please try again later.');
    }
  }, [regenerateSecretTask.error]);
  React.useEffect(() => {
    if (regenerateSecretTask.result) {
      toaster.success(
        'Project secret has been regenerated successfully, please update your CI configurations with the new secret.',
      );
      setProject(regenerateSecretTask.result);
    }
  }, [regenerateSecretTask.result]);

  React.useEffect(() => {
    if (disableTask.error) {
      toaster.danger('Failed to disable project, please try again later.');
    }
  }, [disableTask.error]);
  React.useEffect(() => {
    if (disableTask.result) {
      toaster.warning(
        'Project has been disabled.  CFA will no longer process incoming requests for this project.',
      );
      setProject(disableTask.result);
    }
  }, [disableTask.result]);

  return (
    <Pane>
      <Dialog
        isShown={confirmState.state === ConfirmState.OPEN}
        title="Are you sure?"
        intent="danger"
        onCloseComplete={() => setConfirmState({ state: ConfirmState.CLOSED, pendingAction: null })}
        confirmLabel="Yes"
        onConfirm={() => {
          if (confirmState.pendingAction) confirmState.pendingAction();
          setConfirmState({ state: ConfirmState.CLOSED, pendingAction: null });
        }}
        onCancel={() => setConfirmState({ state: ConfirmState.CLOSED, pendingAction: null })}
        shouldCloseOnOverlayClick={false}
        shouldCloseOnEscapePress={false}
      >
        This action is not easily reversable, please double check this is actually what you want to
        do.
      </Dialog>
      <Alert intent="danger" title="Dange Zone">
        Watch out! The options below are scary and do bad things, please double check before you go
        clicking them.
      </Alert>
      <Pane className={styles.group}>
        <Button
          appearance="primary"
          intent="warning"
          disabled={regeneratePending || disablePending || regenerateSecretTask.error}
          isLoading={regeneratePending}
          onClick={() =>
            setConfirmState({ state: ConfirmState.OPEN, pendingAction: regenerateSecretTask.start })
          }
        >
          Regenerate Secret
        </Button>
        <Button
          appearance="primary"
          intent="danger"
          disabled={regeneratePending || disablePending || disableTask.error}
          isLoading={disablePending}
          onClick={() =>
            setConfirmState({ state: ConfirmState.OPEN, pendingAction: disableTask.start })
          }
        >
          Delete Project
        </Button>
      </Pane>
    </Pane>
  );
}
