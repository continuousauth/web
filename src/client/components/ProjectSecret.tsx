import * as React from 'react';
import { Button, Heading, Pane, TextInput } from 'evergreen-ui';

import { FullProject } from '../../common/types';

import * as styles from './ProjectSecret.scss';

export interface Props {
  project: FullProject;
}

export function ProjectSecret({ project }: Props) {
  const [isVisible, setVisisble] = React.useState(false);

  return (
    <Pane>
      <Heading>Project Secret</Heading>
      <Pane className={styles.inputContainer}>
        <TextInput
          className={styles.input}
          value={isVisible ? project.secret : '••••••••••••••••••••••••••••••••••••••••••••••••••'}
          disabled
        />
        <Button className={styles.button} intent="danger" onClick={() => setVisisble(!isVisible)}>
          {isVisible ? 'Hide' : 'Show'}
        </Button>
      </Pane>
    </Pane>
  );
}
