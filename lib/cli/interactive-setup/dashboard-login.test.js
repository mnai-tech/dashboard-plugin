'use strict';

const chai = require('chai');
const { join } = require('path');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const resolveSync = require('ncjsm/resolve/sync');
const overrideCwd = require('process-utils/override-cwd');
const setupServerless = require('../../../test/setupServerless');
const configureInquirerStub = require('@serverless/test/configure-inquirer-stub');

const { expect } = chai;

chai.use(require('chai-as-promised'));

const fixturesPath = join(__dirname, '../../../test/fixtures');

const ServerlessSDKMock = class ServerlessSDK {
  constructor() {
    this.metadata = {
      get: async () => {
        return {
          awsAccountId: '377024778620',
          supportedRuntimes: ['nodejs10.x', 'nodejs12.x', 'python2.7', 'python3.6', 'python3.7'],
          supportedRegions: [
            'us-east-1',
            'us-east-2',
            'us-west-2',
            'eu-central-1',
            'eu-west-1',
            'eu-west-2',
            'ap-northeast-1',
            'ap-southeast-1',
            'ap-southeast-2',
          ],
        };
      },
    };
  }
};

const step = proxyquire('./dashboard-login', {
  '@serverless/platform-client': {
    ServerlessSDK: ServerlessSDKMock,
  },
});

describe('lib/cli/interactive-setup/dashboard-login.test.js', function () {
  this.timeout(1000 * 60 * 3);

  let inquirer;
  const loginStub = sinon.stub().resolves();

  before(async () => {
    const serverlessPath = (await setupServerless()).root;
    const inquirerPath = resolveSync(serverlessPath, '@serverless/utils/inquirer').realPath;
    inquirer = require(inquirerPath);
  });
  after(() => {
    sinon.restore();
  });

  afterEach(() => {
    if (inquirer.prompt.restore) inquirer.prompt.restore();
    sinon.reset();
  });

  it('Should be ineffective, when not at service path', async () =>
    expect(await step.isApplicable({})).to.be.false);

  it('Should be ineffective, when not at AWS service path', async () =>
    expect(
      await step.isApplicable({
        serviceDir: process.cwd(),
        configuration: {},
        configurationFilename: 'serverless.yml',
        options: {},
        inquirer,
      })
    ).to.equal(false));

  it('Should be ineffective, when not at supported runtime service path', async () =>
    expect(
      await step.isApplicable({
        serviceDir: process.cwd(),
        configuration: { provider: { name: 'aws', runtime: 'java8' } },
        configurationFilename: 'serverless.yml',
        options: {},
        inquirer,
      })
    ).to.equal(false));

  it('Should be ineffective, when logged in', async () => {
    expect(
      await overrideCwd(
        join(fixturesPath, 'aws-loggedin-service'),
        async () =>
          await step.isApplicable({
            serviceDir: process.cwd(),
            configuration: { provider: { name: 'aws', runtime: 'nodejs12.x' } },
            configurationFilename: 'serverless.yml',
            options: {},
            inquirer,
          })
      )
    ).to.equal(false);
  });

  it('Should login when user decides to login/register', async () => {
    configureInquirerStub(inquirer, {
      list: { shouldLoginOrRegister: 'Yes' },
    });
    const loginStep = proxyquire('./dashboard-login', {
      '../../login': loginStub,
      '@serverless/platform-client': {
        ServerlessSDK: ServerlessSDKMock,
      },
    });
    await loginStep.run({
      serviceDir: process.cwd(),
      configuration: { provider: { name: 'aws', runtime: 'nodejs12.x' } },
      configurationFilename: 'serverless.yml',
      options: {},
      inquirer,
    });
    expect(loginStub.calledOnce).to.be.true;
  });

  it('Should not login when user decides not to login/register', async () => {
    configureInquirerStub(inquirer, {
      list: { shouldLoginOrRegister: 'No' },
    });
    const loginStep = proxyquire('./dashboard-login', {
      '../../login': loginStub,
      '@serverless/platform-client': {
        ServerlessSDK: ServerlessSDKMock,
      },
    });
    await loginStep.run({
      serviceDir: process.cwd(),
      configuration: { provider: { name: 'aws', runtime: 'nodejs12.x' } },
      configurationFilename: 'serverless.yml',
      options: {},
      inquirer,
    });
    expect(loginStub.called).to.be.false;
  });
});