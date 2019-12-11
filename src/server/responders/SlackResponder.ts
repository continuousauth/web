import * as debug from 'debug';
import * as Joi from 'joi';
import * as uuid from 'uuid';

import { Responder, RequestInformation } from './Responder';
import {
  OTPRequest,
  Project,
  SlackResponderConfig,
  SlackResponderLinker,
  withTransaction,
} from '../db/models';
import { bolt, authorizeTeam } from '../server';
import {
  SlackActionMiddlewareArgs,
  InteractiveMessage,
  ButtonClick,
  Context,
  DialogSubmitAction,
} from '@slack/bolt';

const d = debug('cfa:responder:slack');

type SlackResponderMetadata = {
  request_ts: string;
  messageText: string;
  attachments: any[];
};

export class SlackResponder extends Responder {
  async requestOtp(
    request: OTPRequest<unknown, SlackResponderMetadata>,
    info: RequestInformation | null,
  ) {
    const config = this.project.responder_slack;
    if (!config) return;

    const boltAuth = await authorizeTeam({
      teamId: config.teamId,
      enterpriseId: config.enterpriseId,
    });

    if (!boltAuth) {
      d(
        `attempted to request OTP from {${config.enterpriseId}/${config.teamId}} but failed to obtain credentials`,
      );
      return;
    }

    const messageText = this.getOtpText(request.project, config);
    const attachments = info ? [this.buildAttachment(info)] : [];
    const message = await bolt.client.chat.postMessage({
      token: boltAuth.botToken,
      channel: config.channelId,
      text: messageText,
      parse: 'full',
      attachments: [
        ...attachments,
        {
          text: 'Submit OTP Token & Confirm Release',
          fallback: 'You are unable to confirm the release',
          callback_id: uuid.v4(),
          color: '#00B8D9',
          actions: [
            {
              name: request.id,
              text: 'Enter OTP Token',
              style: 'danger',
              type: 'button',
              value: 'open-otp-dialog',
            },
          ],
        },
      ],
    });

    if (message.ok) {
      request.responseMetadata = {
        request_ts: (message as any).ts,
        messageText,
        attachments,
      };
      await request.save();
    } else {
      d('failed to send OTP request message', message.error);
    }
  }

  private getOtpText = (project: Project, config: SlackResponderConfig) =>
    `:warning: Attention on deck, @${config.usernameToMention}! The CFA system ` +
    `needs a 2FA OTP token to publish a new release of \`${project.repoOwner}/${project.repoName}\`.`;

  private buildAttachment = (info: RequestInformation) => ({
    fallback: `Request: ${info.url}`,
    color: '#6554C0',
    pretext: 'The request source is linked below',
    title: info.description,
    title_link: info.url,
    text: 'This request has been validated by CFA and now just requires a OTP code.',
    footer: 'CFA Auth',
    ts: `${Math.floor(Date.now() / 1000)}`,
  });
}

/**
 * Handle link command
 */
bolt.command(
  process.env.NODE_ENV === 'production' ? '/cfa-link' : '/cfa-link-dev',
  async ({ context, respond, ack, payload }) => {
    ack();

    const linkerId = payload.text;
    if (!linkerId)
      return respond({
        response_type: 'ephemeral',
        text:
          'Missing required argument "link-id", please ensure you followed the instructions on CFA exactly.',
      });

    const result = Joi.validate(
      linkerId,
      Joi.string()
        .uuid({ version: 'uuidv4' })
        .required(),
    );
    if (result.error) {
      return respond({
        response_type: 'ephemeral',
        text: `The linker ID \`${linkerId}\` provided is invalid, please head back to CFA and try again.`,
      });
    }

    const linker = await SlackResponderLinker.findByPrimary(linkerId, {
      include: [Project],
    });
    if (!linker)
      return respond({
        response_type: 'ephemeral',
        text:
          'The linker ID provided has either already been used or does not exist, please head back to CFA and try again.',
      });

    const info = await bolt.client.team.info({
      token: context.botToken,
    });
    if (!info.ok) {
      console.error('Failed to link team', info.error);
      return respond({
        response_type: 'ephemeral',
        text:
          'An internal error occurred while trying to link this Slack team to CFA.  Please try again later.',
      });
    }

    await withTransaction(async t => {
      const config = await SlackResponderConfig.create(
        {
          teamName: (info as any).team.name,
          teamId: payload.team_id,
          channelName: payload.channel_name,
          channelId: payload.channel_id,
          usernameToMention: payload.user_name,
          teamIcon: (info as any).team.icon.image_68,
          enterpriseId: payload.enterprise_id || '',
        },
        {
          transaction: t,
          returning: true,
        },
      );
      payload.team_id;
      await linker.project.resetAllResponders(t);
      linker.project.responder_slack_id = config.id;
      await linker.project.save({ transaction: t });
      await linker.destroy({ transaction: t });
    });

    respond({
      response_type: 'ephemeral',
      text: `Successfully linked this channel to \`${linker.project.repoOwner}/${linker.project.repoName}\``,
    });
  },
);

/**
 * Handle the "Open Dialog" button
 */
(bolt as any).use(
  async ({
    context,
    action,
    ack,
    body,
    next,
  }: SlackActionMiddlewareArgs<InteractiveMessage<ButtonClick>> & {
    context: Context;
    next: Function;
  }) => {
    if (action && action.type === 'button' && action.value === 'open-otp-dialog') {
      ack();

      bolt.client.dialog.open({
        token: context.botToken,
        trigger_id: body.trigger_id,
        dialog: {
          title: 'Enter 2FA OTP',
          callback_id: `otp:${action.name}`,
          elements: [
            {
              type: 'text',
              label: 'OTP',
              name: 'otp',
            },
          ],
        },
      });
    } else {
      next();
    }
  },
);

/**
 * Handle dialog submission
 */
(bolt as any).use(
  async ({
    action,
    ack,
    body,
    context,
    next,
    respond,
  }: SlackActionMiddlewareArgs<DialogSubmitAction> & {
    context: Context;
    next: Function;
  }) => {
    if (
      action &&
      action.type === 'dialog_submission' &&
      action.callback_id &&
      /^otp:.+$/.test(action.callback_id)
    ) {
      ack();
      const requestId = action.callback_id.slice(4);

      const result = Joi.validate(
        requestId,
        Joi.string()
          .uuid({ version: 'uuidv4' })
          .required(),
      );

      if (result.error) {
        return respond({
          response_type: 'ephemeral',
          text:
            ':red_circle: CFA experienced an unexpected error while processing your response, please try again later.',
        });
      }

      const request: OTPRequest<unknown, any> | null = await OTPRequest.findByPrimary(requestId);
      if (!request) {
        return respond({
          response_type: 'ephemeral',
          text:
            ':red_circle: CFA experienced an unexpected error while finding your request, please try again later.',
        });
      }

      if (request.state !== 'validated') {
        return respond({
          response_type: 'ephemeral',
          text: ':red_circle: This OTP request is in an invalid state and can not be responded to.',
        });
      }

      if (request.responseMetadata && request.responseMetadata.request_ts) {
        const messageTs = request.responseMetadata.request_ts;

        await bolt.client.chat.update({
          token: context.botToken,
          channel: body.channel.id,
          ts: messageTs,
          text: request.responseMetadata.messageText,
          parse: 'full',
          attachments: [
            ...request.responseMetadata.attachments,
            {
              fallback: `OTP provided by:`,
              pretext: `We've received an OTP and will transmit to the requester shortly.`,
              title: `OTP provided by: @${body.user.name}`,
              color: '#36B37E',
              footer: 'CFA Auth',
              ts: `${Math.floor(Date.now() / 1000)}`,
            },
          ],
        });

        request.state = 'responded';
        request.responded = new Date();
        request.response = body.submission.otp;
        request.userThatResponded = body.user.name;
        await request.save();
      } else {
        request.state = 'error';
        request.errored = new Date();
        request.errorReason = 'Invalid responseMetadata on the backend';
        await request.save();
        return respond({
          response_type: 'ephemeral',
          text:
            ':red_circle: CFA experienced an unexpected error while updating your request, please try again later.',
        });
      }
    } else {
      next();
    }
  },
);
