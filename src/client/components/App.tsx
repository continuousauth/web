import * as React from 'react';
import { hot } from 'react-hot-loader/root';
import { Alert, Pane, Spinner } from 'evergreen-ui';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons/faGithub';
import { useFetch } from 'react-hooks-async';

import { UserState } from '../state/user';

import styles from './App.scss';
import { User } from '../../common/types';
import { MainAppRouter } from './MainAppRouter';
import { defaultFetchInit, defaultBodyReader } from '../utils';

function AppInner() {
  const meFetch = useFetch<User>('/api/auth/me', defaultFetchInit, defaultBodyReader);

  if (meFetch.pending)
    return (
      <Pane>
        <Spinner marginX="auto" marginY={120} />
      </Pane>
    );

  if (meFetch.error)
    return (
      <Pane>
        <Pane padding={32}>
          <Alert
            intent="danger"
            title="Looks like you aren't logged in yet, to access the CFA Dashboard you must log in..."
          />
        </Pane>
        <Pane alignItems="center" justifyContent="center" display="flex" marginTop={24}>
          <FontAwesomeIcon icon={faGithub} color="#444" size="10x" />
        </Pane>
        <Pane alignItems="center" justifyContent="center" display="flex" marginY={12}>
          <a className={styles.login} href="/api/auth/login">
            Log in with GitHub
          </a>
        </Pane>
      </Pane>
    );

  return (
    <UserState.Provider value={meFetch.result}>
      <MainAppRouter />
    </UserState.Provider>
  );
}

let HotApp = AppInner;
if (process.env.NODE_ENV !== 'production') {
  HotApp = hot(AppInner);
}

export const App = HotApp;
