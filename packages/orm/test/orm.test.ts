/* eslint-disable prettier/prettier */
import { Configuration } from '@spinajs/configuration';
import { Bootstrapper, DI } from '@spinajs/di';
import * as chai from 'chai';
import _ from 'lodash';
import 'mocha';
import { Orm, TableQueryCompiler, InsertQueryCompiler, SelectQueryCompiler, DeleteQueryCompiler, UpdateQueryCompiler, DropTableCompiler } from '../src/index.js';
import { ConnectionConf, FakeSqliteDriver, FakeMysqlDriver, FakeTableQueryCompiler, FakeSelectQueryCompiler, FakeDeleteQueryCompiler, FakeUpdateQueryCompiler, FakeInsertQueryCompiler, FakeDropTableCompiler } from './misc.js';
import "./../src/bootstrap.js";
import * as sinon from 'sinon';
import "@spinajs/log";

const expect = chai.expect;

async function db() {
  return await DI.resolve(Orm);
}

describe('Orm general', () => {
  beforeEach(() => {
    DI.register(ConnectionConf).as(Configuration);
    DI.register(FakeSqliteDriver).as('sqlite');
    DI.register(FakeMysqlDriver).as('mysql');
    DI.register(FakeSelectQueryCompiler).as(SelectQueryCompiler);
    DI.register(FakeDeleteQueryCompiler).as(DeleteQueryCompiler);
    DI.register(FakeUpdateQueryCompiler).as(UpdateQueryCompiler);
    DI.register(FakeInsertQueryCompiler).as(InsertQueryCompiler);
    DI.register(FakeTableQueryCompiler).as(TableQueryCompiler);
    DI.register(FakeDropTableCompiler).as(DropTableCompiler);
  });

  beforeEach(async () =>{ 

    DI.removeAllListeners("di.resolve.Configuration");
    
    const bootstrappers = await DI.resolve(Array.ofType(Bootstrapper));
    for (const b of bootstrappers) {
      await b.bootstrap();
    }
  })


  afterEach(async () => {
    sinon.restore();
    DI.clearCache();
  });

  it('ORM should create connections', async () => {
    const connect1 = sinon.stub(FakeSqliteDriver.prototype, 'connect').returns(
      new Promise((resolve) => {
        resolve(
          new FakeSqliteDriver({
            Name: 'test',
            Driver: 'test',
            Options: {},
            PoolLimit: 0,
            DefaultConnection: false,
          }),
        );
      }),
    );
    const connect2 = sinon.stub(FakeMysqlDriver.prototype, 'connect').returns(
      new Promise((resolve) => {
        resolve(
          new FakeMysqlDriver({
            Name: 'test2',
            Driver: 'test',
            Options: {},
            PoolLimit: 0,
            DefaultConnection: false,
          }),
        );
      }),
    );

    // @ts-ignore
    const orm = await db();

    expect(connect1.calledOnce).to.be.true;
    expect(connect2.calledOnce).to.be.true;

    expect(orm.Connections).to.be.an('Map').that.have.length(2);
    expect(orm.Connections.get('main_connection')).to.be.not.null;
    expect(orm.Connections.get('sqlite')).to.be.not.null;
  });
});
