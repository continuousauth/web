import * as React from 'react';
import { useFetch } from 'react-hooks-async';
import { Alert, Button, Icon, Pane, Paragraph, Position, Spinner, Tooltip } from 'evergreen-ui';

import * as styles from './Dashboard.scss';
import { ReposResponse, SimpleProject, projectIsMissingConfig } from '../../common/types';
import { Rocket } from './icons/Rocket';
import { AddProjectDialog } from './AddProjectDialog';
import { CircleCILogo } from './icons/CircleCI';
import { SlackLogo } from './icons/Slack';
import { Link } from 'react-router-dom';
import { cx, projectHasAnyConfig, defaultFetchInit, defaultBodyReader } from '../utils';
import { TravisCILogo } from './icons/TravisCI';

export function Dashboard() {
  const reposFetch = useFetch<ReposResponse>('/api/repos', defaultFetchInit, defaultBodyReader);
  const [isAddProjectOpen, setAddProjectOpen] = React.useState(false);

  if (reposFetch.pending) {
    return (
      <Pane
        paddingTop={120}
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexDirection="column"
      >
        <Spinner />
        <p className={styles.loadingText}>Loading your projects...</p>
      </Pane>
    );
  }

  if (reposFetch.error || !reposFetch.result) {
    return (
      <Pane padding={32}>
        <Alert
          intent="danger"
          title="Failed to load the dashboard, please reload and try again..."
        />
      </Pane>
    );
  }

  const fetchedRepos = reposFetch.result;

  const notConfigured = fetchedRepos.all.filter(
    r => !fetchedRepos.configured.find(configured => `${configured.id}` === `${r.id}`),
  );

  const addProject = (
    <>
      <AddProjectDialog
        isOpen={isAddProjectOpen}
        onClose={(newProject?: SimpleProject) => {
          if (newProject && newProject.id && newProject.repoName && newProject.repoOwner) {
            fetchedRepos.configured.push(newProject);
          }
          setAddProjectOpen(false);
        }}
        repos={notConfigured}
      />
      <Pane display="flex" justifyContent="flex-end" padding={8}>
        <Button onClick={() => setAddProjectOpen(true)}>Add Project</Button>
      </Pane>
    </>
  );

  const repos = reposFetch.result;
  if (repos.configured.length === 0) {
    return (
      <>
        {addProject}
        <Pane
          paddingTop={120}
          display="flex"
          alignItems="center"
          justifyContent="center"
          flexDirection="column"
        >
          <Rocket className={styles.rocket} />
          <h3 className={styles.rocketTextHeader}>
            Looks like you haven't set up any projects yet!
          </h3>
          <p className={styles.rocketText}>
            Getting your first project set up is as simple as hitting that "Add Project" button up
            there.
          </p>
        </Pane>
      </>
    );
  }

  return (
    <>
      {addProject}
      <Pane className={styles.projectList}>
        {repos.configured
          .sort((a, b) => {
            const ownerCompare = a.repoOwner.localeCompare(b.repoOwner);
            if (ownerCompare === 0) return a.repoName.localeCompare(b.repoName);
            return ownerCompare;
          })
          .map(repo => (
            <Pane key={repo.id} className={styles.projectCard}>
              <Pane className={styles.projectHeader}>
                {repo.repoOwner}/{repo.repoName}
              </Pane>
              {projectIsMissingConfig(repo) ? (
                <Pane
                  className={cx(
                    styles.configRow,
                    projectHasAnyConfig(repo) ? styles.errorRow : null,
                  )}
                >
                  <Tooltip content="Configuration Incomplete" position={Position.LEFT}>
                    <Icon icon="warning-sign" color="danger" />
                  </Tooltip>
                  <span className={styles.configIcon} />
                  <Paragraph color="danger">
                    This project has not been completely configured. Both a Requester and a
                    Responder must be completely configured.
                  </Paragraph>
                </Pane>
              ) : null}
              {repo.requester_circleCI ? (
                <Pane className={styles.configRow}>
                  <Tooltip content="CFA Requester" position={Position.LEFT}>
                    <Icon icon="circle-arrow-right" color="success" />
                  </Tooltip>
                  <CircleCILogo className={styles.configIcon} />
                  <span>CircleCI</span>
                </Pane>
              ) : null}
              {repo.requester_travisCI ? (
                <Pane className={styles.configRow}>
                  <Tooltip content="CFA Requester" position={Position.LEFT}>
                    <Icon icon="circle-arrow-right" color="success" />
                  </Tooltip>
                  <TravisCILogo className={styles.configIcon} />
                  <span>Travis CI</span>
                </Pane>
              ) : null}
              {repo.responder_slack ? (
                <Pane className={styles.configRow}>
                  <Tooltip content="CFA Responder" position={Position.LEFT}>
                    <Icon icon="circle-arrow-left" color="warning" />
                  </Tooltip>
                  <SlackLogo className={styles.configIcon} />
                  <span>
                    Slack - {repo.responder_slack.team} - #{repo.responder_slack.channel}
                  </span>
                </Pane>
              ) : null}
              <Pane className={styles.projectFooter}>
                <Link to={`/project/${repo.id}`}>Update Configuration</Link>
              </Pane>
            </Pane>
          ))}
      </Pane>
    </>
  );
}
