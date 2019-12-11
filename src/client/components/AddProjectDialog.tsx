import * as React from 'react';
import { Button, Dialog, Pane, Paragraph, SelectMenu, toaster } from 'evergreen-ui';
import { SimpleRepo, SimpleProject } from '../../common/types';

import * as styles from './AddProjectDialog.scss';
import { useAsyncTaskFetch } from 'react-hooks-async';
import { defaultBodyReader } from '../utils';

export interface Props {
  isOpen: boolean;
  onClose: (newProject?: SimpleProject) => void;
  repos: SimpleRepo[];
}

export function AddProjectDialog({ isOpen, onClose, repos }: Props) {
  const [selectedOwner, setSelectedOwner] = React.useState(null);
  const [selectedRepo, setSelectedRepo] = React.useState(null);
  const owners = Array.from(new Set(repos.map(r => r.repoOwner))).sort();
  const possibleRepos = selectedOwner ? repos.filter(r => r.repoOwner === selectedOwner) : [];
  const selectedRepoObject = selectedRepo ? repos.find(r => r.id === selectedRepo) : null;
  const selectedRepoName = selectedRepoObject ? selectedRepoObject.repoName : null;

  const createProjectOptions = React.useMemo(
    () => ({
      method: 'POST',
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        repoId: selectedRepoObject ? selectedRepoObject.id : null,
      }),
    }),
    [selectedRepo],
  );
  const createProjectTask = useAsyncTaskFetch<SimpleProject>(
    '/api/project',
    createProjectOptions,
    defaultBodyReader,
  );

  const creatingProject = createProjectTask.started && createProjectTask.pending;
  React.useMemo(() => {
    if (createProjectTask.error) {
      toaster.danger('Failed to add project, please choose a different repository and try again.');
    }
  }, [createProjectTask.error]);
  React.useEffect(() => {
    setSelectedRepo(null);
    setSelectedOwner(null);
    if (!createProjectTask.result) return;
    toaster.success(
      'Successfully added project, select it on the Dashboard to continue setting it up.',
    );
    onClose(createProjectTask.result);
  }, [createProjectTask.result]);

  return (
    <Dialog
      isShown={isOpen}
      title="Add Project"
      onCloseComplete={onClose}
      confirmLabel="Add"
      isConfirmDisabled={!selectedOwner || !selectedRepo || createProjectTask.error}
      isConfirmLoading={creatingProject}
      onConfirm={createProjectTask.start}
      shouldCloseOnOverlayClick={!creatingProject}
      shouldCloseOnEscapePress={!creatingProject}
    >
      <Paragraph marginBottom={8}>Choose which repository you want to add a project for:</Paragraph>
      <Pane>
        <b className={styles.label}>Owner:</b>
        <SelectMenu
          title="Select Owner"
          options={owners.map(owner => ({
            label: owner,
            value: owner,
          }))}
          selected={selectedOwner}
          closeOnSelect
          onSelect={item => {
            setSelectedRepo(null);
            setSelectedOwner(item.value);
          }}
        >
          <Button disabled={creatingProject}>{selectedOwner || 'Select Owner...'}</Button>
        </SelectMenu>
      </Pane>
      <Pane>
        <b className={styles.label}>Repository:</b>
        <SelectMenu
          title="Select Repository"
          options={possibleRepos.map(repo => ({
            label: repo.repoName,
            value: repo.id,
          }))}
          selected={selectedRepo}
          closeOnSelect
          onSelect={item => setSelectedRepo(item.value)}
        >
          <Button disabled={!selectedOwner || creatingProject}>
            {selectedRepoName || 'Select Repository...'}
          </Button>
        </SelectMenu>
      </Pane>
      <Paragraph color="#aaa" fontSize={12} lineHeight={1.1} marginTop={16}>
        Please note that you can only add repositories to CFA that you have "admin" level access to.
        If you don't have that level of access you should reach out to someone on your team who does
        and ask them to do this bit.
      </Paragraph>
    </Dialog>
  );
}
