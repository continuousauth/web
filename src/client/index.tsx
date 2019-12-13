import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as Sentry from '@sentry/browser';

import 'normalize.css';
import './base.css';

import { App } from './components/App';

if (process.env.SENTRY_FE_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_FE_DSN,
    environment: location.host.includes('staging') ? 'staging' : 'production',
  });
}

ReactDOM.render(<App />, document.querySelector('#app'));
