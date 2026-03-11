// T010 — Contract tests for Inbox API routes

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/sync/sync.scheduler.js', () => ({
  scheduleIntegrationSync: vi.fn(),
  bootstrapSyncScheduler: vi.fn(),
}));

vi.mock('../../src/inbox/inbox.service.js', () => ({
  buildInbox: vi.fn(),
  getInboxCount: vi.fn(),
  acceptInboxItem: vi.fn(),
  dismissInboxItem: vi.fn(),
  acceptAll: vi.fn(),
  dismissAll: vi.fn(),
  InboxError: class InboxError extends Error {
    constructor(
      public readonly code: string,
      message: string
    ) {
      super(message);
      this.name = 'InboxError';
    }
  },
}));

import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { registerInboxRoutes } from '../../src/api/inbox.routes.js';
import {
  buildInbox,
  getInboxCount,
  acceptInboxItem,
  dismissInboxItem,
  acceptAll,
  dismissAll,
  InboxError,
} from '../../src/inbox/inbox.service.js';

const mockBuildInbox = buildInbox as ReturnType<typeof vi.fn>;
const mockGetInboxCount = getInboxCount as ReturnType<typeof vi.fn>;
const mockAcceptInboxItem = acceptInboxItem as ReturnType<typeof vi.fn>;
const mockDismissInboxItem = dismissInboxItem as ReturnType<typeof vi.fn>;
const mockAcceptAll = acceptAll as ReturnType<typeof vi.fn>;
const mockDismissAll = dismissAll as ReturnType<typeof vi.fn>;

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(fastifyCookie);
  await app.register(fastifySession, {
    secret: 'test-session-secret-for-tests-12345678901234567890',
    cookie: { secure: false },
  });
  app.addHook('preHandler', async (request) => {
    (request.session as any).userId = 'user-1';
  });
  await registerInboxRoutes(app);
  await app.ready();
  return app;
}

async function buildUnauthApp() {
  const app = Fastify({ logger: false });
  await app.register(fastifyCookie);
  await app.register(fastifySession, {
    secret: 'test-session-secret-for-tests-12345678901234567890',
    cookie: { secure: false },
  });
  // No preHandler that sets userId → unauthenticated
  await registerInboxRoutes(app);
  await app.ready();
  return app;
}

const sampleGroup = {
  integrationId: 'int-1',
  serviceId: 'gmail',
  accountLabel: 'Work',
  accountIdentifier: 'user@example.com',
  items: [
    {
      id: 'inbox:item-1',
      externalId: 'ext-1',
      title: 'Test Task',
      itemType: 'task',
      syncedAt: '2026-01-01T00:00:00.000Z',
      integration: {
        id: 'int-1',
        serviceId: 'gmail',
        label: 'Work',
        accountIdentifier: 'user@example.com',
      },
    },
  ],
};

describe('GET /api/inbox', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let unauthApp: Awaited<ReturnType<typeof buildUnauthApp>>;

  beforeEach(async () => {
    app = await buildApp();
    unauthApp = await buildUnauthApp();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
    await unauthApp.close();
  });

  it('returns inbox groups and total', async () => {
    mockBuildInbox.mockResolvedValue({ groups: [sampleGroup], total: 1 });

    const res = await app.inject({ method: 'GET', url: '/api/inbox' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(1);
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0].integrationId).toBe('int-1');
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await unauthApp.inject({ method: 'GET', url: '/api/inbox' });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/inbox/count', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let unauthApp: Awaited<ReturnType<typeof buildUnauthApp>>;

  beforeEach(async () => {
    app = await buildApp();
    unauthApp = await buildUnauthApp();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
    await unauthApp.close();
  });

  it('returns count', async () => {
    mockGetInboxCount.mockResolvedValue(7);

    const res = await app.inject({ method: 'GET', url: '/api/inbox/count' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ count: 7 });
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await unauthApp.inject({ method: 'GET', url: '/api/inbox/count' });
    expect(res.statusCode).toBe(401);
  });
});

describe('PATCH /api/inbox/items/:itemId/accept', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let unauthApp: Awaited<ReturnType<typeof buildUnauthApp>>;

  beforeEach(async () => {
    app = await buildApp();
    unauthApp = await buildUnauthApp();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
    await unauthApp.close();
  });

  it('accepts item and returns 200 {}', async () => {
    mockAcceptInboxItem.mockResolvedValue(undefined);

    const res = await app.inject({ method: 'PATCH', url: '/api/inbox/items/inbox:item-1/accept' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({});
    expect(mockAcceptInboxItem).toHaveBeenCalledWith('user-1', 'item-1');
  });

  it('accepts item without inbox: prefix', async () => {
    mockAcceptInboxItem.mockResolvedValue(undefined);

    const res = await app.inject({ method: 'PATCH', url: '/api/inbox/items/item-1/accept' });
    expect(res.statusCode).toBe(200);
    expect(mockAcceptInboxItem).toHaveBeenCalledWith('user-1', 'item-1');
  });

  it('returns 404 for ITEM_NOT_FOUND', async () => {
    mockAcceptInboxItem.mockRejectedValue(new InboxError('ITEM_NOT_FOUND', 'Not found'));

    const res = await app.inject({ method: 'PATCH', url: '/api/inbox/items/inbox:missing/accept' });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('ITEM_NOT_FOUND');
  });

  it('returns 409 for ALREADY_ACCEPTED', async () => {
    mockAcceptInboxItem.mockRejectedValue(new InboxError('ALREADY_ACCEPTED', 'Already accepted'));

    const res = await app.inject({ method: 'PATCH', url: '/api/inbox/items/inbox:item-1/accept' });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('ALREADY_ACCEPTED');
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await unauthApp.inject({ method: 'PATCH', url: '/api/inbox/items/inbox:item-1/accept' });
    expect(res.statusCode).toBe(401);
  });
});

describe('PATCH /api/inbox/items/:itemId/dismiss', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let unauthApp: Awaited<ReturnType<typeof buildUnauthApp>>;

  beforeEach(async () => {
    app = await buildApp();
    unauthApp = await buildUnauthApp();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
    await unauthApp.close();
  });

  it('dismisses item and returns 200 {}', async () => {
    mockDismissInboxItem.mockResolvedValue(undefined);

    const res = await app.inject({ method: 'PATCH', url: '/api/inbox/items/inbox:item-1/dismiss' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({});
    expect(mockDismissInboxItem).toHaveBeenCalledWith('user-1', 'item-1');
  });

  it('returns 404 for ITEM_NOT_FOUND', async () => {
    mockDismissInboxItem.mockRejectedValue(new InboxError('ITEM_NOT_FOUND', 'Not found'));

    const res = await app.inject({ method: 'PATCH', url: '/api/inbox/items/inbox:missing/dismiss' });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('ITEM_NOT_FOUND');
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await unauthApp.inject({ method: 'PATCH', url: '/api/inbox/items/inbox:item-1/dismiss' });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/inbox/accept-all', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let unauthApp: Awaited<ReturnType<typeof buildUnauthApp>>;

  beforeEach(async () => {
    app = await buildApp();
    unauthApp = await buildUnauthApp();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
    await unauthApp.close();
  });

  it('accepts all and returns count', async () => {
    mockAcceptAll.mockResolvedValue(4);

    const res = await app.inject({
      method: 'POST',
      url: '/api/inbox/accept-all',
      payload: { integrationId: 'int-1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ accepted: 4 });
    expect(mockAcceptAll).toHaveBeenCalledWith('user-1', 'int-1');
  });

  it('returns 400 for missing integrationId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/inbox/accept-all',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('MISSING_INTEGRATION_ID');
  });

  it('returns 404 for INTEGRATION_NOT_FOUND', async () => {
    mockAcceptAll.mockRejectedValue(new InboxError('INTEGRATION_NOT_FOUND', 'Not found'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/inbox/accept-all',
      payload: { integrationId: 'bad-int' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('INTEGRATION_NOT_FOUND');
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await unauthApp.inject({
      method: 'POST',
      url: '/api/inbox/accept-all',
      payload: { integrationId: 'int-1' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/inbox/dismiss-all', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let unauthApp: Awaited<ReturnType<typeof buildUnauthApp>>;

  beforeEach(async () => {
    app = await buildApp();
    unauthApp = await buildUnauthApp();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
    await unauthApp.close();
  });

  it('dismisses all and returns count', async () => {
    mockDismissAll.mockResolvedValue(3);

    const res = await app.inject({
      method: 'POST',
      url: '/api/inbox/dismiss-all',
      payload: { integrationId: 'int-1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ dismissed: 3 });
    expect(mockDismissAll).toHaveBeenCalledWith('user-1', 'int-1');
  });

  it('returns 400 for missing integrationId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/inbox/dismiss-all',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('MISSING_INTEGRATION_ID');
  });

  it('returns 404 for INTEGRATION_NOT_FOUND', async () => {
    mockDismissAll.mockRejectedValue(new InboxError('INTEGRATION_NOT_FOUND', 'Not found'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/inbox/dismiss-all',
      payload: { integrationId: 'bad-int' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('INTEGRATION_NOT_FOUND');
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await unauthApp.inject({
      method: 'POST',
      url: '/api/inbox/dismiss-all',
      payload: { integrationId: 'int-1' },
    });
    expect(res.statusCode).toBe(401);
  });
});
