import * as crypto from 'crypto';
import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AllowNull,
  Sequelize,
  DataType,
  BelongsTo,
  Default,
  ForeignKey,
  Unique,
} from 'sequelize-typescript';
import { QueryInterface, Transaction } from 'sequelize';
import * as url from 'url';

@Table
export class Project extends Model<Project> {
  /**
   * Project ID maps to GitHub repository id
   */
  @PrimaryKey
  @Column(DataType.BIGINT)
  id: string;

  /**
   * Owner login (first half of repo slug)
   */
  @AllowNull(false)
  @Column(DataType.STRING)
  repoOwner: string;

  /**
   * Name of GH repository (second half of repo slug)
   */
  @AllowNull(false)
  @Column(DataType.STRING)
  repoName: string;

  /**
   * When false this project has been "deleted" and should be completely
   * ignored.  No incoming our outgoing signals and it should not appear in
   * the UI until it is "created" again.
   */
  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  enabled: boolean;

  @AllowNull(false)
  @Column(DataType.STRING({ length: 256 }))
  secret: string;

  @BelongsTo(() => CircleCIRequesterConfig, 'requester_circleCI_id')
  requester_circleCI: CircleCIRequesterConfig | null;
  requester_circleCI_id: string | null;

  @BelongsTo(() => TravisCIRequesterConfig, 'requester_travisCI_id')
  requester_travisCI: CircleCIRequesterConfig | null;
  requester_travisCI_id: string | null;

  @BelongsTo(() => SlackResponderConfig, 'responder_slack_id')
  responder_slack: SlackResponderConfig | null;
  responder_slack_id: string | null;

  public async resetAllRequesters(t: Transaction) {
    this.requester_circleCI_id = null;
    await this.save({ transaction: t });
    if (this.requester_circleCI) {
      await this.requester_circleCI.destroy({ transaction: t });
    }
  }

  public async resetAllResponders(t: Transaction) {
    this.responder_slack_id = null;
    await this.save({ transaction: t });
    if (this.responder_slack) {
      await this.responder_slack.destroy({ transaction: t });
    }
  }

  static get allIncludes() {
    return [CircleCIRequesterConfig, TravisCIRequesterConfig, SlackResponderConfig];
  }
}

@Table
export class CircleCIRequesterConfig extends Model<CircleCIRequesterConfig> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  accessToken: string;
}

@Table
export class TravisCIRequesterConfig extends Model<TravisCIRequesterConfig> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  accessToken: string;
}

@Table
export class SlackResponderConfig extends Model<SlackResponderConfig> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  teamName: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  teamId: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  teamIcon: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  channelName: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  channelId: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  enterpriseId: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  usernameToMention: string;
}

/**
 * Used as a middle-table to create a SlackResponderConfig
 */
@Table
export class SlackResponderLinker extends Model<SlackResponderLinker> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @ForeignKey(() => Project)
  @Column(DataType.BIGINT)
  projectId: string;

  @BelongsTo(() => Project, 'projectId')
  project: Project;
}

@Table
export class SlackInstall extends Model<SlackInstall> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  botToken: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  botId: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  botUserId: string;

  @AllowNull(false)
  @Unique('slack_team')
  @Column(DataType.STRING)
  teamId: string;

  @AllowNull(false)
  @Unique('slack_team')
  @Column(DataType.STRING)
  enterpriseId: string;
}

@Table
export class OTPRequest<Req = unknown, Res = unknown> extends Model<OTPRequest<Req, Res>> {
  static generateProof() {
    return crypto
      .randomBytes(2048)
      .toString('hex')
      .toLowerCase();
  }
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  /**
   * The project the OTP request is for
   */
  @AllowNull(false)
  @ForeignKey(() => Project)
  @Column(DataType.BIGINT)
  projectId: string;

  @AllowNull(false)
  @Column(DataType.ENUM({ values: ['requested', 'validated', 'responded', 'error'] }))
  state: 'requested' | 'validated' | 'responded' | 'error';

  @AllowNull(false)
  @Column(DataType.TEXT)
  proof: string;

  /**
   * The human-provided response from a Responder
   */
  @AllowNull(true)
  @Column(DataType.TEXT)
  response: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  errorReason: string;

  /**
   * The time this request was, well... requested
   */
  @AllowNull(false)
  @Column(DataType.DATE)
  requested: Date;

  /**
   * The time this request was validated by CFA
   */
  @AllowNull(true)
  @Column(DataType.DATE)
  validated: Date;

  /**
   * The time this request was responded to by a Responder
   */
  @AllowNull(true)
  @Column(DataType.DATE)
  responded: Date;

  @AllowNull(true)
  @Column(DataType.TEXT)
  userThatResponded: string | null;

  /**
   * The time this request encountered an error (hopefully never but hey)
   */
  @AllowNull(true)
  @Column(DataType.DATE)
  errored: Date;

  @AllowNull(false)
  @Column(DataType.JSON)
  requestMetadata: Req;

  @AllowNull(false)
  @Column(DataType.JSON)
  responseMetadata: Res;

  @BelongsTo(() => Project, 'projectId')
  project: Project;
}

const migrationFns: ((t: Transaction, qI: QueryInterface) => Promise<void>)[] = [
  async function addTravisCIRequesterForeignKey(t: Transaction, queryInterface: QueryInterface) {
    const table: any = await queryInterface.describeTable(Project.getTableName());
    if (!table.requester_travisCI_id) {
      await queryInterface.addColumn(
        Project.getTableName() as string,
        'requester_travisCI_id',
        {
          type: Sequelize.UUID,
          references: {
            model: 'TravisCIRequesterConfig',
            key: 'id',
          },
        },
        {
          transaction: t,
        },
      );
    }
  },
  async function addUserThatRespondedAttribute(t: Transaction, queryInterface: QueryInterface) {
    const table: any = await queryInterface.describeTable(OTPRequest.getTableName());
    if (!table.userThatResponded) {
      await queryInterface.addColumn(
        OTPRequest.getTableName() as string,
        'userThatResponded',
        {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        {
          transaction: t,
        },
      );
    }
  },
];

const initializeInstance = async (sequelize: Sequelize) => {
  sequelize.addModels([
    Project,
    CircleCIRequesterConfig,
    TravisCIRequesterConfig,
    SlackResponderConfig,
    SlackResponderLinker,
    OTPRequest,
    SlackInstall,
  ]);

  await sequelize.sync();

  for (const migrationFn of migrationFns) {
    await sequelize.transaction(async t => {
      await migrationFn(t, sequelize.getQueryInterface());
    });
  }
};

const create = async () => {
  const parsed = url.parse(process.env.DATABASE_URL!);
  const opts = {
    dialect: 'postgres',
    database: parsed.pathname!.slice(1),
    username: parsed.auth!.split(':')[0],
    password: parsed.auth!.split(':')[1],
    host: parsed.hostname,
    port: parseInt(parsed.port!, 10),
    ssl: process.env.NO_DB_SSL ? false : true,
    pool: {
      max: 20,
      min: 0,
      idle: 10000,
      handleDisconnects: true,
    },
    dialectOptions: {
      ssl: process.env.NO_DB_SSL ? false : true,
    },
  } as any;
  const sequelize = new Sequelize(opts);
  await initializeInstance(sequelize);

  return sequelize;
};

let instance: Sequelize;
export const getSequelizeInstance = async () => {
  if (!instance) instance = await create();
  return instance;
};

export const __overrideSequelizeInstanceForTesting = async (_instance: Sequelize) => {
  instance = _instance;
  await initializeInstance(instance);
};

export const withTransaction = async <T>(fn: (t: Transaction) => Promise<T>) => {
  const instance = await getSequelizeInstance();
  return instance.transaction(async t => {
    return await fn(t);
  });
};
