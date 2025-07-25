/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { TestMigration_2022_02_08_01_13_00 } from './migrations/TestMigration_2022_02_08_01_13_00.js';
import { Configuration } from '@spinajs/configuration';
import { SqliteOrmDriver } from './../src/index.js';
import { Bootstrapper, DI } from '@spinajs/di';
import { Orm, Migration, ICompilerOutput, OrmDriver, OrmMigration, QueryContext, InsertBehaviour } from '@spinajs/orm';
import _ from 'lodash';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { DateTime } from 'luxon';
import { TestModel } from './models/TestModel.js';
import { TestOwned } from './models/TestOwned.js';
import { TestMany } from './models/TestMany.js';
import { User } from './models/User.js';
import { TestModelOwner } from './models/TestModelOwner.js';
import { Category } from './models/Category.js';
import { has_many_1, owned_by_has_many_1, owned_by_owned_by_has_many_1 } from './models/HasMany1.js';
import { SqlDriver } from '@spinajs/orm-sql';
import '@spinajs/log';
import { Offer } from './models/Offer.js';
import { ConnectionConf, ConnectionConf2, TEST_MIGRATION_TABLE_NAME, db } from './common.js';

const expect = chai.expect;
chai.use(chaiAsPromised);
describe('Sqlite driver migration, updates, deletions & inserts', function () {
  this.timeout(10000);

  before(() => {
    DI.register(ConnectionConf).as(Configuration);
    DI.register(SqliteOrmDriver).as('orm-driver-sqlite');
  });

  beforeEach(async () => {
    const bootstrappers = await DI.resolve(Array.ofType(Bootstrapper));
    for (const b of bootstrappers) {
      await b.bootstrap();
    }

    await DI.resolve(Orm);

    await db().migrateUp();
    await db().reloadTableInfo();
  });

  afterEach(() => {
    DI.clearCache();
  });

  it('Should migrate', async () => {
    await db().migrateUp();

    await db().Connections.get('sqlite').select().from('user');
    await expect(db().Connections.get('sqlite').select().from('notexisted')).to.be.rejected;
  });

  it('Should create schema builder', () => {
    const result = db()
      .Connections.get('sqlite')
      .schema()
      .createTable('test', (table) => {
        table.timestamp('timestamp');
        table.enum('enum', ['a', 'b', 'c']);
      })
      .toDB() as ICompilerOutput[];

    expect(result[0].expression).to.eq('CREATE TABLE `test` (`timestamp` TEXT,`enum` TEXT )');
  });

  it('Should check if table exists', async () => {
    await db().migrateUp();

    const exists = await db().Connections.get('sqlite').schema().tableExists('user');
    const notExists = await db().Connections.get('sqlite').schema().tableExists('user2');

    expect(exists).to.eq(true);
    expect(notExists).to.eq(false);
  });

  it('should insert query', async () => {
    await db().migrateUp();
    await db().reloadTableInfo();
    const iResult = await db().Connections.get('sqlite').insert().into('user').values({
      Name: 'test',
      Password: 'test_password',
      CreatedAt: '2019-10-18',
      IsActive: true,
    });

    const result: User = await User.first();

    expect(iResult.LastInsertId).to.eq(1);
    expect(iResult.RowsAffected).to.eq(1);
    expect(result).to.be.not.null;
    expect(result.Id).to.eq(1);
    expect(result.Name).to.eq('test');
    expect(result.IsActive).to.eq(true);
  });

  it('should insert or ignore  query', () => {
    const result = db()
      .Connections.get('sqlite')
      .insert()
      .into('user')
      .values({
        Name: 'test',
        Password: 'test_password',
        CreatedAt: '2019-10-18',
        IsActive: true,
      })
      .orIgnore()
      .toDB();

    expect(result.expression).to.eq('INSERT OR IGNORE INTO `user` (`Name`,`Password`,`CreatedAt`,`IsActive`) VALUES (?,?,?,?)');
  });

  it('should delete', async () => {
    await db().migrateUp();
    await db().Connections.get('sqlite').insert().into('user').values({
      Name: 'test',
      Password: 'test_password',
      CreatedAt: '2019-10-18',
      IsActive: true,
    });

    await db().Connections.get('sqlite').del().from('user').where('id', 1);

    const result = await db().Connections.get('sqlite').select().from('user').first();
    expect(result).to.be.undefined;
  });

  it('should update', async () => {
    await db().migrateUp();
    await db().Connections.get('sqlite').insert().into('user').values({
      Name: 'test',
      Password: 'test_password',
      CreatedAt: '2019-10-18',
      IsActive: true,
    });

    await db()
      .Connections.get('sqlite')
      .update()
      .in('user')
      .update({
        Name: 'test updated',
      })
      .where('id', 1);

    const result: User = await db().Connections.get('sqlite').select<User>().from('user').first();
    expect(result).to.be.not.null;
    expect(result.Name).to.eq('test updated');
  });
});

describe('Sqlite driver migrate', () => {
  beforeEach(async () => {
    DI.clearCache();

    DI.register(ConnectionConf).as(Configuration);
    DI.register(SqliteOrmDriver).as('orm-driver-sqlite');
    await DI.resolve(Orm);
  });

  it('Should migrate create migrate table', async () => {
    await db().migrateUp();
    const mTable = await db().Connections.get('sqlite').tableInfo(TEST_MIGRATION_TABLE_NAME);
    const mResult = await db().Connections.get('sqlite').select().from(TEST_MIGRATION_TABLE_NAME).first();
    expect(mTable).to.be.not.null;
    expect(mResult).to.be.not.null;
    expect((mResult as any).Migration).to.eq('TestMigration_2022_02_08_01_13_00');
  });

  it('Should not migrate twice', async () => {
    const spy = sinon.spy(TestMigration_2022_02_08_01_13_00.prototype, 'up');

    await db().migrateUp();
    await db().migrateUp();

    expect(spy.calledOnce).to.be.true;
  });

  it('Should migrate', async () => {
    await db().migrateUp();
    await db().Connections.get('sqlite').insert().into('user').values({
      Name: 'test',
      Password: 'test_password',
      CreatedAt: '2019-10-18',
      IsActive: true,
      DateTime: 0,
    });
    const result = await db().Connections.get('sqlite').select().from('user').first();

    expect(result).to.be.not.null;
    expect(result).to.eql({
      Id: 1,
      Name: 'test',
      DateTime: 0,
      Password: 'test_password',
      CreatedAt: '2019-10-18',
      IsActive: 1,
    });
  });
});

describe('Sqlite model functions', function () {
  this.timeout(10000);

  beforeEach(async () => {
    DI.clearCache();
    DI.register(ConnectionConf).as(Configuration);
    DI.register(SqliteOrmDriver).as('orm-driver-sqlite');
    await DI.resolve(Orm);

    await db().migrateUp();
    await db().reloadTableInfo();
  });

  it('should model create', async () => {
    const user = await User.create({
      Name: 'test',
      Password: 'test_password',
      IsActive: true,
    });

    const result: User = await db().Connections.get('sqlite').select<User>().from('user').first();

    expect(result).to.be.not.null;
    expect(result.Id).to.eq(1);
    expect(result.Name).to.eq('test');
    expect(result.Password).to.eq('test_password');

    expect(user).to.be.not.null;
    expect(user.Id).to.eq(1);
    expect(user.Name).to.eq('test');
    expect(user.Password).to.eq('test_password');
  });

  it('should model be inserted with one-to-one relation', async () => {
    const model = new TestModel();
    await model.insert();

    expect(model.Id).to.eq(1);

    const owned = new TestOwned();
    owned.attach(model);

    await owned.insert();

    expect(owned.Id).to.eq(1);

    const check = await TestOwned.getOrFail(1);
    await check.Owner.populate();

    expect(check.Owner.Value.constructor.name).to.eq('TestModel');
    expect(check.Owner.Value.Id).to.eq(1);
  });

  it('should model be updated with one-to-one relation', async () => {
    const model = new TestModel();
    await model.insert();
    const model2 = new TestModel();
    await model2.insert();

    expect(model.Id).to.eq(1);
    expect(model2.Id).to.eq(2);

    const owned = new TestOwned();
    owned.attach(model);

    await owned.insert();

    expect(owned.Id).to.eq(1);

    owned.attach(model2);
    await owned.update();

    const check = await TestOwned.getOrFail(1);
    await check.Owner.populate();

    expect(check.Owner.Value.constructor.name).to.eq('TestModel');
    expect(check.Owner.Value.Id).to.eq(2);
  });

  it('model should attach & set one-to many relations', async () => {
    const model = new TestModel();
    await model.insert();

    const m1 = new TestMany();
    const m2 = new TestMany();
    const m3 = new TestMany();
    const m4 = new TestMany();

    model.attach(m1);
    model.attach(m2);
    model.attach(m3);
    model.attach(m4);

    await m1.insert();
    await m2.insert();
    await m3.insert();
    await m4.insert();

    const check = await TestModel.where({ Id: 1 }).populate('Many').first();

    expect(check.Many.length).to.eq(4);
    expect(check.Many[0].Id).to.eq(1);
    expect(check.Many[1].Id).to.eq(2);
    expect(check.Many[2].Id).to.eq(3);
    expect(check.Many[3].Id).to.eq(4);

    expect(check.Many[0].constructor.name).to.eq('TestMany');
  });

  it('Model should populate recursive relations', async () => {
    const cat1 = new Category({
      Name: 'cat1',
    });

    await cat1.insert();

    const cat2 = new Category({
      Name: 'cat2',
    });

    const cat4 = new Category({
      Name: 'cat4',
    });

    cat1.Children.push(cat2);
    cat1.Children.push(cat4);

    await cat1.Children.sync();

    const cat3 = new Category({
      Name: 'cat3',
    });
    cat2.Children.push(cat3);

    await cat2.Children.sync();

    const result = await Category.query().whereNull('parent_id').populate('Children').first();

    expect(result.Children.length).to.eq(2);
    expect(result.Children[0].Name).to.eq('cat2');
    expect(result.Children[1].Name).to.eq('cat4');
    expect(result.Children[0].Children.length).to.eq(1);
    expect(result.Children[0].Children[0].Name).to.eq('cat3');
  });

  it('model relation should populate multiple belongsBY', async () => {
    const model = new TestModel();
    await model.insert();

    const model2 = new TestModel();
    await model2.insert();

    const owned = new TestOwned();
    owned.Owner.attach(model);

    const owned2 = new TestOwned();
    owned2.Owner.attach(model2);

    await owned.insert();
    await owned2.insert();

    const result = await TestOwned.where('Id', '>', 0).populate('Owner');

    expect(result.length).to.eq(2);
    expect(result[0].Owner.Value.Id).to.eq(1);
    expect(result[1].Owner.Value.Id).to.eq(2);
  });

  it('Should hydrate single belongs to', async () => {
    const o2 = new owned_by_owned_by_has_many_1();
    o2.Val = 'leaf';

    await o2.insert();
    const o1 = new owned_by_has_many_1();
    o1.Val = 'middle';

    o1.attach(o2);
    await o1.insert();

    const result = await owned_by_has_many_1.where('Id', '>', 0).populate('File');
    expect(result.length).to.eq(1);
    expect(result[0].File.Value.Val).to.eq('leaf');
  });

  it('Should proper hydrate hasMany with belongsTo relation', async () => {
    const h1 = new has_many_1();
    h1.Val = 'root';

    await h1.insert();
    const o2 = new owned_by_owned_by_has_many_1();
    o2.Val = 'leaf';

    const o1 = new owned_by_has_many_1();
    o1.Val = 'middle';

    h1.attach(o1);
    o1.attach(o2);

    await o2.insert();
    await o1.insert();

    const result = await has_many_1.where('Id', '>', 0).populate('Informations', function () {
      this.populate('File');
    });

    expect(result.length).to.eq(1);
    expect(result[0].Informations.length).to.eq(1);
    expect(result[0].Informations[0].File.Value).to.be.not.undefined;
  });

  it('model should populate nested belongsTo relation', async () => {
    const o = new TestModelOwner();
    const o2 = new TestModelOwner();

    await o.insert();
    await o2.insert();

    const model = new TestModel();
    const model2 = new TestModel();
    model.Owner.attach(o);
    model2.Owner.attach(o2);

    await model.insert();
    await model2.insert();

    const m1 = new TestMany();
    const m2 = new TestMany();
    const m3 = new TestMany();
    const m4 = new TestMany();

    model.Many.set([m1, m2, m3, m4]);

    await model.Many.sync();

    const m5 = new TestMany();
    const m6 = new TestMany();
    const m7 = new TestMany();
    const m8 = new TestMany();

    model2.Many.set([m5, m6, m7, m8]);

    await model2.Many.sync();

    const owned = new TestOwned();
    owned.Owner.attach(model);

    const owned2 = new TestOwned();
    owned2.Owner.attach(model2);

    await owned.insert();
    await owned2.insert();

    const r = await TestMany.all();
    console.log(r.length);

    const result = await TestOwned.where('Id', '>', 0).populate('Owner', function () {
      this.populate('Many');
      this.populate('Owner');
    });

    expect(result.length).to.eq(2);

    expect(result[0].Owner.Value.Many.length).to.eq(4);
    expect(result[1].Owner.Value.Many.length).to.eq(4);

    expect(result[0].Owner.Value.Many[0].Id).to.eq(1);
    expect(result[0].Owner.Value.Many[1].Id).to.eq(2);
    expect(result[0].Owner.Value.Many[2].Id).to.eq(3);
    expect(result[0].Owner.Value.Many[3].Id).to.eq(4);
    expect(result[1].Owner.Value.Many[0].Id).to.eq(5);
    expect(result[1].Owner.Value.Many[1].Id).to.eq(6);
    expect(result[1].Owner.Value.Many[2].Id).to.eq(7);
    expect(result[1].Owner.Value.Many[3].Id).to.eq(8);

    expect(result[0].Owner.Value.Owner.Value.Id).to.eq(1);
    expect(result[1].Owner.Value.Owner.Value.Id).to.eq(2);
  });

  it('model relation belongsto should populate ', async () => {
    const model = new TestModel();
    await model.insert();

    const model2 = new TestModel();
    await model2.insert();

    const owned = new TestOwned();
    owned.Owner.attach(model);

    const owned2 = new TestOwned();
    owned2.Owner.attach(model2);

    await owned.insert();
    await owned2.insert();

    const m1 = new TestMany();
    const m2 = new TestMany();
    const m3 = new TestMany();
    const m4 = new TestMany();

    model.Many.set([m1, m2, m3, m4]);

    await model.Many.sync();

    const m5 = new TestMany();
    const m6 = new TestMany();
    const m7 = new TestMany();
    const m8 = new TestMany();

    model2.Many.set([m5, m6, m7, m8]);

    await model2.Many.sync();

    const result = await TestOwned.where('Id', '>', 0).populate('Owner', function () {
      this.populate('Many');
    });

    const result2 = await TestModel.where('Id', '>', 0).populate('Many');

    expect(result2.length).to.eq(2);
    expect(result.length).to.eq(2);

    expect(result[0].Owner.Value.Many.length).to.eq(4);
    expect(result[1].Owner.Value.Many.length).to.eq(4);

    expect(result[0].Owner.Value.Many[0].Id).to.eq(1);
    expect(result[0].Owner.Value.Many[1].Id).to.eq(2);
    expect(result[0].Owner.Value.Many[2].Id).to.eq(3);
    expect(result[0].Owner.Value.Many[3].Id).to.eq(4);
    expect(result[1].Owner.Value.Many[0].Id).to.eq(5);
    expect(result[1].Owner.Value.Many[1].Id).to.eq(6);
    expect(result[1].Owner.Value.Many[2].Id).to.eq(7);
    expect(result[1].Owner.Value.Many[3].Id).to.eq(8);
  });

  it('model relation set should work', async () => {
    const model = new TestModel();
    await model.insert();

    const m0 = new TestMany();
    model.attach(m0);

    await m0.insert();

    const m1 = new TestMany();
    const m2 = new TestMany();
    const m3 = new TestMany();
    const m4 = new TestMany();

    model.Many.set([m1, m2, m3, m4]);

    await model.Many.sync();

    const check = await TestModel.where({ Id: 1 }).populate('Many').first();

    expect(check.Many.length).to.eq(4);
    expect(check.Many[0].Id).to.eq(2);
    expect(check.Many[1].Id).to.eq(3);
    expect(check.Many[2].Id).to.eq(4);
    expect(check.Many[3].Id).to.eq(5);

    const c2 = await TestMany.get(m0.Id);
    expect(c2).to.eq(undefined);
  });

  it('model relation set should update', async () => {
    const model = new TestModel();
    await model.insert();

    const m0 = new TestMany();
    model.attach(m0);

    await m0.insert();

    expect(m0.Id).to.eq(1);

    const m1 = new TestMany({ Val: 'inserted' });
    const m2 = new TestMany();
    const m3 = new TestMany();
    const m4 = new TestMany();

    model.Many.set([m1, m2, m3, m4]);

    await model.Many.sync();

    let check = await TestModel.where({ Id: 1 }).populate('Many').first();

    expect(check.Many.length).to.eq(4);
    expect(check.Many[0].Id).to.eq(2);
    expect(check.Many[1].Id).to.eq(3);
    expect(check.Many[2].Id).to.eq(4);
    expect(check.Many[3].Id).to.eq(5);

    m1.Val = 'test';
    await model.Many.sync();

    check = await TestModel.where({ Id: 1 }).populate('Many').first();
    expect(check.Many[0].Val).to.eq('test');
    expect(check.Many[0].Id).to.eq(2);
    expect(check.Many[1].Id).to.eq(3);
    expect(check.Many[2].Id).to.eq(4);
    expect(check.Many[3].Id).to.eq(5);
  });

  it('model relation union should work', async () => {
    const model = new TestModel();
    await model.insert();

    const m0 = new TestMany();
    model.attach(m0);

    await m0.insert();

    const m1 = new TestMany();
    const m2 = new TestMany();
    const m3 = new TestMany();
    const m4 = new TestMany();

    model.Many.union([m1, m2, m3, m4]);

    await model.Many.sync();

    const check = await TestModel.where({ Id: 1 }).populate('Many').first();

    expect(check.Many.length).to.eq(5);
    expect(check.Many[0].Id).to.eq(1);
    expect(check.Many[1].Id).to.eq(2);
    expect(check.Many[2].Id).to.eq(3);
    expect(check.Many[3].Id).to.eq(4);
    expect(check.Many[4].Id).to.eq(5);
  });

  it('model relation diff should work', async () => {
    const model = new TestModel();
    await model.insert();

    const m0 = new TestMany();
    model.attach(m0);

    await m0.insert();

    const m1 = new TestMany();
    const m2 = new TestMany();

    model.Many.set(model.Many.diff([m0, m1, m2]));

    await model.Many.sync();

    const check = await TestModel.where({ Id: 1 }).populate('Many').first();

    expect(check.Many.length).to.eq(2);
    expect(check.Many[0].Id).to.eq(2);
    expect(check.Many[1].Id).to.eq(3);
  });

  it('model relation intersection should work', async () => {
    const model = new TestModel();
    await model.insert();

    const m0 = new TestMany();
    model.attach(m0);

    await m0.insert();

    const m1 = new TestMany();
    const m2 = new TestMany();

    await model.Many.intersection([m0, m1, m2]);

    const check = await TestModel.where({ Id: 1 }).populate('Many').first();

    expect(check.Many.length).to.eq(1);
    expect(check.Many[0].Id).to.eq(1);
  });
});

describe('Sqlite queries', function () {
  this.timeout(20000);

  beforeEach(async () => {
    DI.register(ConnectionConf).as(Configuration);
    DI.register(SqliteOrmDriver).as('orm-driver-sqlite');
    await DI.resolve(Orm);

    await db().migrateUp();
    await db().reloadTableInfo();
  });

  afterEach(() => {
    DI.clearCache();
  });

  it('should select and sort', async () => {
    await db().Connections.get('sqlite').insert().into('user').values({
      Name: 'a',
      Password: 'test_password',
      CreatedAt: '2019-10-18',
      IsActive: true,
    });

    await db().Connections.get('sqlite').insert().into('user').values({
      Name: 'b',
      Password: 'test_password',
      CreatedAt: '2019-10-18',
      IsActive: true,
    });

    const userQuery = User.where(function () {
      this.where({ Name: 'a' });
    }).orderBy('Name');

    return expect(userQuery).to.be.fulfilled;
  });

  it('should select to model', async () => {
    await db().Connections.get('sqlite').insert().into('user').values({
      Name: 'test',
      Password: 'test_password',
      CreatedAt: '2019-10-18',
      IsActive: true,
    });

    const user = await User.get(1);

    expect(user).instanceOf(User);
    expect(user.Id).to.eq(1);
    expect(user.Name).to.eq('test');
  });

  it('should map datetime', async () => {
    await db().Connections.get('sqlite').insert().into('user').values({
      Name: 'test',
      Password: 'test_password',
      CreatedAt: '2019-10-18',
      IsActive: true,
    });

    const user = await User.get(1);

    expect(user).instanceOf(User);
    expect(user.CreatedAt).instanceof(DateTime);
  });

  it('should run on duplicate', async () => {
    await db().Connections.get('sqlite').insert().into('user').values({
      Name: 'test',
      Password: 'test_password',
      CreatedAt: '2019-10-18',
      IsActive: true,
    });

    await User.insert(new User({ Name: 'test', Password: 'test_password_2', CreatedAt: DateTime.fromFormat('2019-10-19', 'yyyy-MM-dd'), IsActive: true }), InsertBehaviour.InsertOrUpdate);

    const all = await User.all();
    const user = await User.get(1);

    expect(user).instanceOf(User);
    expect(user.CreatedAt).instanceof(DateTime);
    expect(user.Name).to.eq('test');
    expect(user.Password).to.eq('test_password_2');
    expect(all.length).to.eq(1);

    expect(async () => {
      await User.insert(new User({ Name: 'test', Password: 'test_password_2', CreatedAt: DateTime.fromFormat('2019-10-19', 'yyyy-MM-dd'), IsActive: true }), InsertBehaviour.InsertOrUpdate);
    }).to.throw;

    user.Name = 'test2';

    await user.update();

    const user2 = await User.get(1);
    expect(user2.Name).to.eq('test2');
  });
});

describe('Relation tests', function () {
  this.timeout(10000);
  beforeEach(() => {
    DI.clearCache();

    DI.register(ConnectionConf2).as(Configuration);
    DI.register(SqliteOrmDriver).as('orm-driver-sqlite');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('Populate belongs to in many to many relation', async () => {
    const db = await DI.resolve(Orm);
    await db.migrateUp();
    await db.reloadTableInfo();

    const result = await Offer.all().populate('Localisations', function () {
      this.populate('Metadata');
      this.populate('Network', function () {
        this.populate('Metadata');
      });
    });

    expect(result.length).to.eq(1);
    expect(result[0].Localisations[0].Network.Value).to.be.not.null;
    expect(result[0].Localisations[1].Network.Value).to.be.not.null;

    expect(result[0].Localisations[0].Network.Value.Name).to.eq('Network 1');

    expect(result[0].Localisations[0].Metadata.length).to.eq(1);
    expect(result[0].Localisations[1].Metadata.length).to.eq(1);

    expect(result[0].Localisations[0].Metadata[0].Key).to.eq('meta 1');
    expect(result[0].Localisations[1].Metadata[0].Key).to.eq('meta 2');
  });
});

describe('Sqlite driver migrate with transaction', function () {
  this.timeout(10000);
  beforeEach(() => {
    DI.clearCache();

    DI.register(ConnectionConf2).as(Configuration);
    DI.register(SqliteOrmDriver).as('orm-driver-sqlite');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('Should commit migration', async () => {
    const orm = await DI.resolve(Orm);
    const driver = orm.Connections.get('sqlite') as SqlDriver;
    const trSpy = sinon.spy(driver, 'transaction');
    const exSpy = sinon.spy(driver, 'executeOnDb');

    await orm.migrateUp();

    expect(trSpy.calledOnce).to.be.true;
    expect(exSpy.getCall(3).args[0]).to.eq('BEGIN TRANSACTION');
    expect(exSpy.getCall(35).args[0]).to.eq('COMMIT');

    expect(driver.executeOnDb('SELECT * FROM user', null, QueryContext.Select)).to.be.fulfilled;

    const result = (await driver.executeOnDb(`SELECT * FROM ${TEST_MIGRATION_TABLE_NAME}`, null, QueryContext.Select)) as unknown[];
    expect(result[0]).to.be.not.undefined;
    expect(result[0]).to.be.not.null;
    expect((result[0] as any).Migration).to.eq('TestMigration_2022_02_08_01_13_00');
  });

  it('Should rollback migration', async () => {
    @Migration('sqlite')
    class MigrationFailed_2022_02_08_01_13_00 extends OrmMigration {
      public async up(connection: OrmDriver): Promise<void> {
        await connection.insert().into('not_exists').values({ id: 1 });
      }
      public down(_connection: OrmDriver): Promise<void> {
        return;
      }
    }

    class Fake2Orm extends Orm {
      constructor() {
        super();

        this.Migrations.length = 0;
        this.Models.length = 0;
        this.registerMigration(MigrationFailed_2022_02_08_01_13_00);
      }
    }
    DI.register(Fake2Orm).as(Orm);
    const orm = await DI.resolve(Orm);
    const driver = orm.Connections.get('sqlite') as SqlDriver;
    const trSpy = sinon.spy(driver, 'transaction');
    const exSpy = sinon.spy(driver, 'executeOnDb');

    try {
      await orm.migrateUp();
    } catch {}

    expect(trSpy.calledOnce).to.be.true;
    expect(exSpy.getCall(3).args[0]).to.eq('BEGIN TRANSACTION');
    expect(exSpy.getCall(5).args[0]).to.eq('ROLLBACK');

    expect(driver.executeOnDb('SELECT * FROM user', null, QueryContext.Select)).to.be.rejected;
    const result = (await driver.executeOnDb(`SELECT * FROM ${TEST_MIGRATION_TABLE_NAME}`, null, QueryContext.Select)) as unknown[];
    expect(result.length).to.be.eq(0);

    DI.unregister(Fake2Orm);
    DI.unregister(MigrationFailed_2022_02_08_01_13_00);
  });
});
