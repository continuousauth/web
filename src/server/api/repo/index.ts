import * as debug from 'debug';
import * as express from 'express';
import * as Octokit from '@octokit/rest';

import { Project } from '../../db/models';
import { createA } from '../../helpers/a';
import { SimpleProject, SimpleRepo } from '../../../common/types';
import { Op } from 'sequelize';

const d = debug('cfa:server:api:repo');
const a = createA(d);

export function repoRoutes() {
  const router = express();

  router.get(
    '/',
    a(async (req, res) => {
      // TODO: Should we really be storing this on session, is there a better
      // place to store them in a cache?
      let reposWithAdmin: SimpleRepo[] = req.session!.cachedRepos;
      if (!reposWithAdmin) {
        const github = new Octokit({
          auth: req.user.accessToken,
        });

        const allRepos: Octokit.ReposListForOrgResponseItem[] = await github.paginate(
          github.repos.list.endpoint.merge({
            per_page: 100,
          }),
        );

        reposWithAdmin = allRepos
          .filter(r => r.permissions.admin)
          .map(r => ({
            id: `${r.id}`,
            repoName: r.name,
            repoOwner: r.owner.login,
            defaultBranch: r.default_branch,
          }));
        req.session!.cachedRepos = reposWithAdmin;
      }

      const configured = await Project.findAll({
        where: {
          id: {
            [Op.in]: reposWithAdmin.map(r => r.id),
          },
          enabled: true,
        },
        include: Project.allIncludes,
      });

      // Due to the use of a cache above to avoid long GitHub API requests
      // we CAN NOT guarantee that the user here has the "admin" level permission
      // still.  As such no important information should be returned in the
      // SimpleProject.  The secret should be stripped, and all request and respond
      // configs should be stripped to tiny amounts of information and no API keys
      // or ID's.
      const configuredMapped: SimpleProject[] = await Promise.all(
        configured.map(async p => {
          const actualDefaultBranch = reposWithAdmin.find(r => r.id === p.id)!.defaultBranch;
          console.log(p.repoOwner, p.repoName, actualDefaultBranch, p.defaultBranch);
          if (actualDefaultBranch && p.defaultBranch !== actualDefaultBranch) {
            p.defaultBranch = actualDefaultBranch;
            await p.save();
          }
          return {
            id: p.id,
            repoName: p.repoName,
            repoOwner: p.repoOwner,
            defaultBranch: p.defaultBranch,
            requester_circleCI: !!p.requester_circleCI,
            requester_travisCI: !!p.requester_travisCI,
            responder_slack: p.responder_slack
              ? {
                  team: p.responder_slack.teamName,
                  channel: p.responder_slack.channelName,
                }
              : null,
          };
        }),
      );
      res.json({
        all: reposWithAdmin,
        configured: configuredMapped,
      });
    }),
  );

  return router;
}
