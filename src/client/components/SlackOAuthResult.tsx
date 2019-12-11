import * as React from 'react';
import { Alert, Heading, Pane, Paragraph } from 'evergreen-ui';

import { SlackLogo } from './icons/Slack';

import * as styles from './SlackOAuthResult.scss';

export function SlackOAuthResult() {
  const query = new URLSearchParams(window.location.search);
  const error = query.get('error');

  return (
    <div className={styles.container}>
      <Pane className={styles.block}>
        <SlackLogo className={styles.logo} />
        {error ? (
          <Pane>
            <Heading size={800}>Failed to install the CFA Slack App</Heading>
            <Paragraph marginTop={8}>
              It looks like for some reason we failed to either install or confirm the installation
              of the CFA slack app. This can happen for a number of reasons but normally it's
              because the install was cancelled. If this is unexpected you should just try again.
              The error CFA experienced is included below, it may be helpful to you.
            </Paragraph>
            <Alert intent="danger" title="Slack OAuth Error" marginTop={8}>
              {error}
            </Alert>
          </Pane>
        ) : (
          <Pane>
            <Heading size={800}>Successfully installed the CFA Slack App</Heading>
            <Paragraph marginTop={8}>
              Now that the app has been installed you can close this tab and continue configuring
              your CFA project by following the steps on the previous page.
            </Paragraph>
          </Pane>
        )}
      </Pane>
    </div>
  );
}
