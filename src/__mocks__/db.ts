import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { Sequelize } from 'sequelize-typescript';

import { __overrideSequelizeInstanceForTesting } from '../server/db/models';

/**
 * Hooks into jest beforeEach and afterEach to set up and
 * teardown unique database instances usiong sqlite
 */
export const temporaryDatabaseForTestScope = () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.promises.mkdtemp(path.resolve(os.tmpdir(), 'cfa-test-db-'));

    await __overrideSequelizeInstanceForTesting(
      new Sequelize({
        dialect: 'sqlite',
        storage: path.resolve(dir, 'test.db'),
        logging: false,
      }),
    );
  });

  afterEach(async () => {
    await fs.remove(dir);
  });
};
