import * as React from 'react';
import { Heading, Paragraph } from 'evergreen-ui';

import { FullProject } from '../../../common/types';
import { GenericAccessTokenRequesterConfig } from './GenericAccessTokenRequesterConfig';

export interface Props {
  project: FullProject;
  setProject: (newProject: FullProject) => void;
}

export function TravisCIRequesterConfig(props: Props) {
  return (
    <GenericAccessTokenRequesterConfig
      {...props}
      originalAccessToken={
        props.project.requester_travisCI ? props.project.requester_travisCI.accessToken : ''
      }
      slug="travisci"
      requesterName="Travis CI"
    >
      <Heading size={400} marginBottom={8}>
        Travis CI Access Token
      </Heading>
      <Paragraph marginBottom={4}>
        You can get your access token in your Travis CI{' '}
        <a
          href={`https://travis-ci.org/account/preferences`}
          target="_blank"
          rel="noreferrer noopener"
        >
          Account Settings
        </a>
        .
      </Paragraph>
    </GenericAccessTokenRequesterConfig>
  );
}
