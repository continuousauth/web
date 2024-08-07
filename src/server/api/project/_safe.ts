import * as crypto from 'crypto';
import * as express from 'express';

import { Project } from '../../db/models';
import { ExpressRequest, hasAdminAccessToTargetRepo } from '../../helpers/_middleware';

export const generateNewSecret = (size: number) => {
  if (size > 256) throw new Error('size must be <= 256');
  return crypto.randomBytes(256).toString('hex').slice(0, size);
};

export const sanitizeProject = (project: Project) => project;

export const getProjectFromIdAndCheckPermissions = async (
  id: string,
  req: ExpressRequest,
  res: express.Response,
) => {
  const project = await Project.findOne({
    where: {
      id: id,
      enabled: true,
    },
    include: Project.allIncludes,
  });
  // Project not existing and user not having permission should look identical
  // so that folks can't sniff which projects are active on CFA
  if (!project) {
    res.status(401).json({
      error: 'Current user is not an admin of the target repository',
    });
    return null;
  }

  if (!(await hasAdminAccessToTargetRepo(req, project.id))) {
    res.status(401).json({
      error: 'Current user is not an admin of the target repository',
    });
    return null;
  }

  return project;
};
