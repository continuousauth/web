import * as React from 'react';
import { useFetch } from 'react-hooks-async';
import { RouteComponentProps } from 'react-router';
import { RefreshIcon, Pane, Spinner, Tooltip, toaster } from 'evergreen-ui';

import { FullProject } from '../../common/types';

import styles from './ProjectConfig.scss';
import { ProjectSecret } from './ProjectSecret';
import { DangerZone } from './DangerZone';
import { ResponderConfig } from './ResponderConfig';
import { RequesterConfig } from './RequesterConfig';
import { defaultFetchInit, defaultBodyReader } from '../utils';

export function ProjectConfig(props: RouteComponentProps<{ projectId: string }>) {
  const [refreshId, setRefreshId] = React.useState(1);
  const projectFetch = useFetch<FullProject>(
    `/api/project/${props.match.params.projectId}?refresh=${refreshId}`,
    defaultFetchInit,
    defaultBodyReader,
  );
  const [project, setProject] = React.useState<FullProject | null>(null);

  React.useEffect(() => {
    if (projectFetch.error) {
      toaster.danger(
        'Failed to load project configuration, either that project does not exist or you do not have permission to view it.',
      );
      props.history.replace('/');
    }
  }, [projectFetch.error]);

  React.useEffect(() => {
    if (projectFetch.result) {
      setProject(projectFetch.result);
    }
  }, [projectFetch.result]);
  React.useEffect(() => {
    if (project && !project.enabled) {
      props.history.push('/');
    }
  }, [project, project ? project.enabled : null]);

  if (projectFetch.pending || projectFetch.error || !project || !project.enabled) {
    return (
      <Pane
        paddingTop={120}
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexDirection="column"
      >
        <Spinner />
        <p className={styles.loadingText}>Loading project configuration...</p>
      </Pane>
    );
  }

  return (
    <Pane key={refreshId} className={styles.wrapper}>
      <Pane className={styles.configContainer}>
        <Pane className={styles.header}>
          <Pane>
            Configuration: {project.repoOwner}/{project.repoName}
          </Pane>
          <Tooltip content="Refresh Project">
            <RefreshIcon
              onClick={() => setRefreshId(refreshId + 1)}
              style={{ cursor: 'pointer' }}
            />
          </Tooltip>
        </Pane>
        <Pane className={styles.inner}>
          <ProjectSecret project={project} />
          <RequesterConfig project={project} setProject={setProject} />
          <ResponderConfig project={project} setProject={setProject} />
          <DangerZone project={project} setProject={setProject} />
        </Pane>
      </Pane>
    </Pane>
  );
}
