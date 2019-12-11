import { app } from './server';

import * as bodyParser from 'body-parser';
import * as compression from 'compression';
import * as debug from 'debug';
import * as express from 'express';
import * as session from 'express-session';
import * as connectRedis from 'connect-redis';
import * as path from 'path';

import { apiRoutes } from './api';
import passport = require('passport');
import { getSequelizeInstance } from './db/models';

const d = debug('cfa:server');
const RedisStore = connectRedis(session);

app.use(compression());

app.use(
  '/api',
  bodyParser.json(),
  session({
    store: new RedisStore({
      url: process.env.REDIS_URL,
    }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: true,
    name: 'cfa.session',
  }),
  passport.initialize(),
  passport.session(),
  apiRoutes(),
);

// Static hosting
const staticRoot = path.resolve(__dirname, '../../public_out');
app.use(
  express.static(staticRoot, {
    index: false,
  }),
);
app.use(
  require('express-history-api-fallback')('index.html', {
    root: staticRoot,
  }),
);

if (process.mainModule === module) {
  const port = process.env.PORT || 3001;
  d('booting CFA');
  getSequelizeInstance()
    .then(() => {
      app.listen(port, () => {
        d('CFA server running on port:', port);
      });
    })
    .catch(err => {
      d('Failed to connect to DB', err);
      process.exit(1);
    });
}
