import * as Sentry from '@sentry/node';
import { App, ExpressReceiver } from '@slack/bolt';
import * as debug from 'debug';
import * as dotenv from 'dotenv-safe';
import * as express from 'express';
import * as morgan from 'morgan';

import { createA } from './helpers/a';
import { SlackInstall, withTransaction } from './db/models';

const d = debug('cfa:server:core');
const a = createA(d);

dotenv.config();
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.CFA_ENV || 'development' });
}

const receiverOpts = {
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  endpoints: {
    commands: '/commands',
    events: '/events',
    interactive: '/interactive',
  },
};
const boltReceiver = new ExpressReceiver(receiverOpts);

const boltApp = boltReceiver.app;

export const app = express();
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.requestHandler());
}

export const bolt = new App({
  receiver: boltReceiver,
  authorize: authorizeTeam,
});

app.use(morgan('dev'));
app.use('/api/services/slack', boltApp);
// TODO: Make responses pretty AF
app.get(
  '/api/services/slack/oauth',
  a(async (req, res) => {
    if (!req.query.code)
      return res.redirect(
        '/oauth_result/slack?error=Failed to obtain user token, please try again',
      );

    let access: any;
    try {
      const accessResult = await bolt.client.oauth.access({
        code: req.query.code as string,
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
      });
      if (!accessResult.ok) {
        throw accessResult.error;
      }
      access = accessResult;
    } catch (err) {
      d('failed to auth user:', err);
      return res.redirect(
        '/oauth_result/slack?error=Failed to authenticate user, please try again',
      );
    }

    const { bot, team_id } = access;
    const { bot_access_token, bot_user_id } = bot;

    const info: any = await bolt.client.team.info({
      token: bot_access_token,
    });
    if (!info.ok) {
      d('failed to load team info:', info.error);
      return res.redirect('/oauth_result/slack?error=Failed to get team info');
    }
    const { enterprise_id } = info.team;

    const botInfo: any = await bolt.client.users.info({
      token: bot_access_token,
      user: bot_user_id,
    });
    if (!botInfo.ok) {
      d('failed to load bot info:', botInfo.error);
      return res.redirect('/oauth_result/slack?error=Failed to get bot installation info');
    }

    if (!botInfo.user.profile.bot_id) {
      d('failed to find bot id:', bot_user_id);
      return res.redirect('/oauth_result/slack?error=Failed to get bot installation info');
    }

    await withTransaction(async (t) => {
      const existingInstall = await SlackInstall.findOne({
        where: {
          teamId: team_id,
          enterpriseId: enterprise_id || '',
        },
        transaction: t,
      });
      if (existingInstall) {
        await existingInstall.destroy({ transaction: t });
      }

      const install = new SlackInstall({
        teamId: team_id,
        enterpriseId: enterprise_id || '',
        botToken: bot_access_token,
        botId: botInfo.user.profile.bot_id,
        botUserId: bot_user_id,
      });

      await install.save({ transaction: t });
    });

    res.redirect('/oauth_result/slack');
  }),
);

export async function authorizeTeam(opts: { teamId?: string; enterpriseId?: string }): Promise<{
  botToken: string;
  botId: string;
  botUserId: string;
}> {
  if (!opts.teamId && !opts.enterpriseId) throw new Error('Not installed');
  const install = await SlackInstall.findOne({
    where: {
      teamId: opts.teamId || '',
      enterpriseId: opts.enterpriseId || '',
    },
  });
  if (!install) throw new Error('Not installed');
  return {
    botToken: install.botToken,
    botId: install.botId,
    botUserId: install.botUserId,
  };
}
