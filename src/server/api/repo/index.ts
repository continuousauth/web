import * as debug from 'debug';
import * as express from 'express';
import { Octokit, RestEndpointMethodTypes } from '@octokit/rest';
import { paginateGraphql } from '@octokit/plugin-paginate-graphql';

import { Project } from '../../db/models';
import { createA } from '../../helpers/a';
import { SimpleProject, SimpleRepo } from '../../../common/types';
import { Op } from 'sequelize';

const d = debug('cfa:server:api:repo');
const a = createA(d);

Octokit.plugin(paginateGraphql);

declare module 'express-session' {
  interface SessionData {
    cachedRepos: SimpleRepo[];
  }
}

export function repoRoutes() {
  const router = express();

  router.get(
    '/',
    a(async (req, res) => {
      if (!req.user?.accessToken) {
        return res.status(403).json({ error: 'No Auth' });
      }

      // TODO: Should we really be storing this on session, is there a better
      // place to store them in a cache?
      let reposWithAdmin = req.session.cachedRepos;
      if (!reposWithAdmin) {
        const github = paginateGraphql(
          new Octokit({
            auth: req.user.accessToken,
          }),
        );

        const {
          viewer: { repositories },
        } = await github.graphql.paginate(`
          query paginate($cursor: String) {
            viewer {
              repositories(first: 100, after: $cursor) {
                edges {
                  node {
                    databaseId
                    name
                    defaultBranchRef {
                      name
                    }
                    owner {
                      login
                    }
                    viewerCanAdminister
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }
        `);

        reposWithAdmin = (repositories.edges as any[])
          .map(edge => edge.node)
          .filter(r => r.viewerCanAdminister)
          .map<SimpleRepo>(r => ({
            id: `${r.databaseId}`,
            repoName: r.name,
            repoOwner: r.owner.login,
            defaultBranch: r.defaultBranchRef.name,
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
          const actualDefaultBranch = reposWithAdmin!.find(r => r.id === p.id)!.defaultBranch;
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
