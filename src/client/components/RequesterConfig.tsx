import * as React from 'react';
import { Alert, Heading, Pane, Paragraph, Tab, Tablist } from 'evergreen-ui';

import { FullProject } from '../../common/types';

import styles from './ReqResConfig.scss';
import { CircleCILogo } from './icons/CircleCI';
import { CircleCIRequesterConfig } from './configurators/CircleCIRequesterConfig';
import { GitHubLogo } from './icons/GitHub';
import { GitHubActionsRequesterConfig } from './configurators/GitHubActionsRequesterConfig';
export interface Props {
  project: FullProject;
  setProject: (newProject: FullProject) => void;
}

enum RequesterTab {
  NOTHING_YET,
  CIRCLE_CI,
  GITHUB_ACTIONS,
}

const defaultTabForProject = (project: FullProject) => {
  if (project.requester_circleCI) return RequesterTab.CIRCLE_CI;
  if (project.requester_gitHub) return RequesterTab.GITHUB_ACTIONS;
  return RequesterTab.NOTHING_YET;
};

export function RequesterConfig({ project, setProject }: Props) {
  const [activeTab, setActiveTab] = React.useState(RequesterTab.NOTHING_YET);
  React.useEffect(() => {
    setActiveTab(defaultTabForProject(project));
  }, [defaultTabForProject(project)]);

  const [showRequesterHelp, setShowRequesterHelp] = React.useState(
    defaultTabForProject(project) === RequesterTab.NOTHING_YET,
  );
  React.useEffect(() => {
    if (defaultTabForProject(project) === RequesterTab.NOTHING_YET && !showRequesterHelp) {
      setShowRequesterHelp(true);
    }
  }, [project]);

  return (
    <Pane>
      <Heading marginBottom={8}>Requester</Heading>
      <Pane>
        {showRequesterHelp ? (
          <Alert
            intent="none"
            title="What is a Requester?"
            isRemoveable
            onRemove={() => setShowRequesterHelp(false)}
          >
            A Requester is how your automation asks CFA for a 2FA token. This is normally your CI
            provider, E.g. Circle CI.
          </Alert>
        ) : null}
      </Pane>
      <Pane marginY={8}>
        <Tablist>
          <Tab
            onSelect={() => setActiveTab(RequesterTab.CIRCLE_CI)}
            isSelected={activeTab === RequesterTab.CIRCLE_CI}
            style={{ paddingLeft: 28, position: 'relative' }}
          >
            <CircleCILogo className={styles.tabIcon} /> Circle CI
          </Tab>
          <Tab
            onSelect={() => setActiveTab(RequesterTab.GITHUB_ACTIONS)}
            isSelected={activeTab === RequesterTab.GITHUB_ACTIONS}
            style={{ paddingLeft: 28, position: 'relative' }}
          >
            <GitHubLogo className={styles.tabIcon} /> GitHub Actions
          </Tab>
          <Tab disabled>More Coming Soon...</Tab>
        </Tablist>
      </Pane>
      <Pane marginY={8} className={styles.configBox}>
        {activeTab === RequesterTab.NOTHING_YET ? (
          <Paragraph>No Requester has been configured, choose one to get started!</Paragraph>
        ) : activeTab === RequesterTab.CIRCLE_CI ? (
          <CircleCIRequesterConfig project={project} setProject={setProject} />
        ) : activeTab === RequesterTab.GITHUB_ACTIONS ? (
          <GitHubActionsRequesterConfig project={project} setProject={setProject} />
        ) : null}
      </Pane>
    </Pane>
  );
}
