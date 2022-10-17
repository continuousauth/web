import * as React from 'react';
import {
  Avatar,
  Button,
  Code,
  Heading,
  ListItem,
  OrderedList,
  Pane,
  Paragraph,
  Spinner,
  TextInput,
  toaster,
} from 'evergreen-ui';

import { FullProject } from '../../../common/types';
import { useAsyncTaskFetch } from 'react-hooks-async';
import { defaultBodyReader } from '../../utils';

export interface Props {
  project: FullProject;
  setProject: (newProject: FullProject) => void;
}

const linkOptions = {
  method: 'POST',
};

export function SlackResponderConfig({ project, setProject }: Props) {
  const createLinkerTask = useAsyncTaskFetch<{ linker: { id: string }; slackClientId: string }>(
    `/api/project/${project.id}/config/responders/slack`,
    linkOptions,
    defaultBodyReader,
  );

  React.useEffect(() => {
    if (!project.responder_slack && createLinkerTask.start) {
      createLinkerTask.start();
    }
  }, [project.responder_slack, createLinkerTask.start]);

  React.useEffect(() => {
    if (createLinkerTask.error) {
      toaster.danger('Failed to generate Slack linker code, please reload and try again.');
    }
  }, [createLinkerTask.error]);

  const [usernameToMention, setUsernameToMention] = React.useState(
    project.responder_slack ? project.responder_slack.usernameToMention : '',
  );

  const usernameOptions = React.useMemo(
    () => ({
      method: 'PATCH',
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ usernameToMention }),
    }),
    [usernameToMention],
  );

  const updateUsernameToMentionTask = useAsyncTaskFetch<FullProject>(
    `/api/project/${project.id}/config/responders/slack`,
    usernameOptions,
    defaultBodyReader,
  );

  React.useEffect(() => {
    if (updateUsernameToMentionTask.error) {
      toaster.danger('Failed to update the Slack Responder, please try again later.');
    }
  }, [updateUsernameToMentionTask.error]);

  React.useEffect(() => {
    if (updateUsernameToMentionTask.result) {
      toaster.success(
        'Successfully updated the Slack Responder with the provided username / usergroup.',
      );
      setProject(updateUsernameToMentionTask.result);
    }
  }, [updateUsernameToMentionTask.result]);

  if (project.responder_slack) {
    const saving = updateUsernameToMentionTask.started && updateUsernameToMentionTask.pending;

    return (
      <Pane>
        <Paragraph>
          The Slack Responder is currently configured and is pointing at the following Team /
          Channel.
        </Paragraph>
        <Heading marginTop={8} display="flex" alignItems="center">
          <Avatar
            name={project.responder_slack.teamName}
            size={24}
            src={project.responder_slack.teamIcon}
            style={{ marginRight: 8 }}
          />
          {project.responder_slack.teamName} - #{project.responder_slack.channelName}
        </Heading>
        <Pane>
          <Heading size={400} marginY={8}>
            Username / Usergroup
          </Heading>
          <TextInput
            value={usernameToMention}
            onChange={e => setUsernameToMention(e.currentTarget.value)}
          />
          {usernameToMention !== project.responder_slack.usernameToMention && usernameToMention ? (
            <Button
              appearance="primary"
              intent="success"
              marginLeft={8}
              isLoading={saving}
              disabled={updateUsernameToMentionTask.error}
              onClick={() => updateUsernameToMentionTask.start()}
            >
              Save
            </Button>
          ) : null}
        </Pane>
      </Pane>
    );
  }

  if (createLinkerTask.pending || createLinkerTask.error || !createLinkerTask.result) {
    return (
      <Pane>
        <Spinner />
      </Pane>
    );
  }

  return (
    <Pane>
      <Paragraph marginBottom={16}>
        Slack has not been linked to this Project yet, follow the instructions below to link a Slack
        channel to this project.
      </Paragraph>
      <OrderedList>
        <ListItem>
          Install the CFA Slack App in your workspace if it isn't already installed.{' '}
          <a
            style={{
              display: 'block',
              marginTop: 8,
            }}
            href={`https://slack.com/oauth/authorize?client_id=${createLinkerTask.result.slackClientId}&scope=bot,commands,team:read`}
            target="_blank"
            rel="noreferrer noopener"
          >
            <img
              alt="Add to Slack"
              height="40"
              width="139"
              src="https://platform.slack-edge.com/img/add_to_slack.png"
              srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x"
            />
          </a>
        </ListItem>
        <ListItem>
          Run{' '}
          <Code>
            /cfa-link{process.env.NODE_ENV === 'production' ? '' : '-dev'}{' '}
            {createLinkerTask.result.linker.id}
          </Code>{' '}
          in the channel you want to link to CFA
        </ListItem>
        <ListItem>Refresh this project when you're done using the Refresh button above.</ListItem>
      </OrderedList>
    </Pane>
  );
}
