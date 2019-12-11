import * as React from 'react';
import { Heading, Paragraph } from 'evergreen-ui';

import { FullProject } from '../../../common/types';
import { GenericAccessTokenRequesterConfig } from './GenericAccessTokenRequesterConfig';

export interface Props {
  project: FullProject;
  setProject: (newProject: FullProject) => void;
}

export function CircleCIRequesterConfig(props: Props) {
  return (
    <GenericAccessTokenRequesterConfig
      {...props}
      originalAccessToken={
        props.project.requester_circleCI ? props.project.requester_circleCI.accessToken : ''
      }
      slug="circleci"
      requesterName="Circle CI"
    >
      <Heading size={400} marginBottom={8}>
        Circle CI Access Token
      </Heading>
      <Paragraph marginBottom={4}>
        You can generate an access token in your{' '}
        <a
          href={`https://circleci.com/gh/${props.project.repoOwner}/${props.project.repoName}/edit#api`}
          target="_blank"
          rel="noreferrer noopener"
        >
          Circle CI Project Settings
        </a>
        . The token must have the "All" scope.
      </Paragraph>
    </GenericAccessTokenRequesterConfig>
  );
}
