// T016 — Endpoint integration tests for PATCH /api/feed/items/:itemId/description-override

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/sync/sync.scheduler.js', () => ({
  scheduleIntegrationSync: vi.fn(),
  bootstrapSyncScheduler: vi.fn(),
}));

vi.mock('../../src/feed/feed.service.js', () => ({
  buildFeed: vi.fn(),
  buildDismissedFeed: vi.fn(),
  completeSyncItem: vi.fn(),
  completeNativeTask: vi.fn(),
  uncompleteNativeTask: vi.fn(),
  uncompleteSyncItem: vi.fn(),
  clearCompletedItems: vi.fn(),
  dismissFeedItem: vi.fn(),
  restoreFeedItem: vi.fn(),
  getDismissedItems: vi.fn(),
  permanentDeleteFeedItem: vi.fn(),
  setUserDueAt: vi.fn(),
  setDescriptionOverride: vi.fn(),
}));

import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { registerFeedRoutes } from '../../src/api/feed.routes.js';
import { setDescriptionOverride } from '../../src/feed/feed.service.js';

const mockSetDescriptionOverride = setDescriptionOverride as ReturnType<typeof vi.fn>;

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(fastifyCookie);
  await app.register(fastifySession, {
    secret: 'test-session-secret-for-tests-12345678901234567890',
    cookie: { secure: false },
  });
  app.addHook('preHandler', async (request) => {
    (request.session as { userId?: string }).userId = 'user-1';
  });
  await registerFeedRoutes(app);
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
  await registerFeedRoutes(app);
  await app.ready();
  return app;
}

describe('PATCH /api/feed/items/:itemId/description-override', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('200 — sets a description override', async () => {
    mockSetDescriptionOverride.mockResolvedValue({
      hasDescriptionOverride: true,
      descriptionOverride: 'My note',
      descriptionUpdatedAt: '2026-07-18T14:32:00.000Z',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/feed/items/sync:item-uuid/description-override',
      payload: { value: 'My note' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.hasDescriptionOverride).toBe(true);
    expect(body.descriptionOverride).toBe('My note');
    expect(body.descriptionUpdatedAt).toBe('2026-07-18T14:32:00.000Z');
    expect(mockSetDescriptionOverride).toHaveBeenCalledWith('user-1', 'item-uuid', 'My note');
  });

  it('200 — clears a description override (value: null)', async () => {
    mockSetDescriptionOverride.mockResolvedValue({
      hasDescriptionOverride: false,
      descriptionOverride: null,
      descriptionUpdatedAt: null,
    });

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/feed/items/sync:item-uuid/description-override',
      payload: { value: null },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.hasDescriptionOverride).toBe(false);
    expect(body.descriptionOverride).toBeNull();
    expect(mockSetDescriptionOverride).toHaveBeenCalledWith('user-1', 'item-uuid', null);
  });

  it('400 INVALID_ITEM_ID — native: prefix is rejected', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/feed/items/native:item-uuid/description-override',
      payload: { value: 'hello' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_ITEM_ID');
  });

  it('400 INVALID_ITEM_ID — malformed id (no colon)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/feed/items/just-a-uuid/description-override',
      payload: { value: 'hello' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_ITEM_ID');
  });

  it('400 INVALID_VALUE — empty string is rejected', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/feed/items/sync:item-uuid/description-override',
      payload: { value: '' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_VALUE');
  });

  it('400 INVALID_VALUE — whitespace-only string is rejected', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/feed/items/sync:item-uuid/description-override',
      payload: { value: '   ' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_VALUE');
  });

  it('400 VALUE_TOO_LONG — string exceeding 50000 chars is rejected', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/feed/items/sync:item-uuid/description-override',
      payload: { value: 'a'.repeat(50001) },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALUE_TOO_LONG');
  });

  it('401 — unauthenticated request returns 401', async () => {
    const unauthApp = await buildUnauthApp();
    try {
      const res = await unauthApp.inject({
        method: 'PATCH',
        url: '/api/feed/items/sync:item-uuid/description-override',
        payload: { value: 'hello' },
      });
      expect(res.statusCode).toBe(401);
    } finally {
      await unauthApp.close();
    }
  });

  it('404 — item not found returns 404', async () => {
    mockSetDescriptionOverride.mockRejectedValue(
      Object.assign(new Error('Item not found'), { code: 'ITEM_NOT_FOUND' })
    );

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/feed/items/sync:missing-uuid/description-override',
      payload: { value: 'hello' },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('ITEM_NOT_FOUND');
  });
});
