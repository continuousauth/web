import * as React from 'react';
import { Alert, Heading, Pane, Paragraph, Tab, Tablist } from 'evergreen-ui';

import { FullProject } from '../../common/types';
import { SlackResponderConfig } from './configurators/SlackResponderConfig';

import styles from './ReqResConfig.scss';
import { SlackLogo } from './icons/Slack';

export interface Props {
  project: FullProject;
  setProject: (newProject: FullProject) => void;
}

enum ResponderTab {
  NOTHING_YET,
  SLACK,
}

const defaultTabForProject = (project: FullProject) => {
  if (project.responder_slack) return ResponderTab.SLACK;
  return ResponderTab.NOTHING_YET;
};

export function ResponderConfig({ project, setProject }: Props) {
  const [activeTab, setActiveTab] = React.useState(ResponderTab.NOTHING_YET);
  React.useEffect(() => {
    setActiveTab(defaultTabForProject(project));
  }, [defaultTabForProject(project)]);

  const [showHelp, setShowHelp] = React.useState(false);
  React.useEffect(() => {
    if (defaultTabForProject(project) === ResponderTab.NOTHING_YET) {
      setShowHelp(true);
    }
  }, [defaultTabForProject(project)]);

  return (
    <Pane>
      <Heading marginBottom={8}>Responder</Heading>
      <Pane>
        {showHelp ? (
          <Alert
            intent="none"
            title="What is a Responder?"
            isRemoveable
            onRemove={() => setShowHelp(false)}
          >
            A Responder is how CFA asks a human for a 2FA token. E.g. If you choose Slack it will
            send a message to a channel asking you to enter a 2FA code into a Slack dialog.
          </Alert>
        ) : null}
      </Pane>
      <Pane marginY={8}>
        <Tablist>
          <Tab
            onSelect={() => setActiveTab(ResponderTab.SLACK)}
            isSelected={activeTab === ResponderTab.SLACK}
            style={{ paddingLeft: 28, position: 'relative' }}
          >
            <SlackLogo className={styles.tabIcon} /> Slack
          </Tab>
          <Tab disabled>More Coming Soon...</Tab>
        </Tablist>
      </Pane>
      <Pane marginY={8} className={styles.configBox}>
        {activeTab === ResponderTab.NOTHING_YET ? (
          <Paragraph>No Responder has been configured, choose one to get started!</Paragraph>
        ) : activeTab === ResponderTab.SLACK ? (
          <SlackResponderConfig project={project} setProject={setProject} />
        ) : null}
      </Pane>
    </Pane>
  );
}
