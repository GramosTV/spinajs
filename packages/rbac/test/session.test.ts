import { DI } from '@spinajs/di';
import { MemorySessionStore, SessionProvider, UserSession } from '../src/index.js';
import { expect } from 'chai';
import { Configuration } from '@spinajs/configuration';
import { TestConfiguration } from './common.test.js';

describe('Session provider tests', () => {
  before(async () => {
    DI.register(MemorySessionStore).as(SessionProvider);
    DI.register(TestConfiguration).as(Configuration);

    await DI.resolve(Configuration);
  });

  afterEach(async () => {
    DI.clearCache();
  });

  it('should update & restore session', async () => {
    const session = new UserSession();
    const provider = await DI.resolve(SessionProvider);

    await provider.save(session);

    const restored = await provider.restore(session.SessionId);

    expect(restored instanceof UserSession).to.be.true;
  });

  it('should delete session', async () => {
    const session = new UserSession();
    const provider = await DI.resolve(SessionProvider);

    await provider.save(session);
    await provider.delete(session.SessionId);

    const restored = await provider.restore(session.SessionId);

    expect(restored).to.be.null;
  });
});
