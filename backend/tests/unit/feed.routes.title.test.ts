// T016 — Endpoint integration tests for PATCH /api/feed/sync/:id/title-override

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
  setTitleOverride: vi.fn(),
}));

import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { registerFeedRoutes } from '../../src/api/feed.routes.js';
import { setTitleOverride } from '../../src/feed/feed.service.js';

const mockSetTitleOverride = setTitleOverride as ReturnType<typeof vi.fn>;

const mockFeedItem = {
  id: 'sync:item-uuid',
  source: 'Gmail',
  serviceId: 'gmail',
  itemType: 'task',
  title: 'Q3 budget',
  originalTitle: 'Re: Re: Q3 budget review',
  hasTitleOverride: true,
  dueAt: null,
  startAt: null,
  endAt: null,
  completed: false,
  completedAt: null,
  isDuplicateSuspect: false,
  dismissed: false,
  hasUserDueAt: false,
  originalBody: null,
  description: 'Original: Re: Re: Q3 budget review',
  hasDescriptionOverride: true,
  descriptionOverride: 'Original: Re: Re: Q3 budget review',
  descriptionUpdatedAt: '2026-03-15T12:00:00.000Z',
  sourceUrl: null,
};

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

describe('PATCH /api/feed/sync/:id/title-override', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('200 — sets a title override, returns full FeedItem', async () => {
    mockSetTitleOverride.mockResolvedValue(mockFeedItem);

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/feed/sync/item-uuid/title-override',
      payload: { value: 'Q3 budget' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.hasTitleOverride).toBe(true);
    expect(body.title).toBe('Q3 budget');
    expect(body.originalTitle).toBe('Re: Re: Q3 budget review');
    expect(mockSetTitleOverride).toHaveBeenCalledWith('user-1', 'item-uuid', 'Q3 budget');
  });

  it('200 — clears a title override (value: null), returns FeedItem with hasTitleOverride false', async () => {
    const clearedItem = {
      ...mockFeedItem,
      title: 'Re: Re: Q3 budget review',
      hasTitleOverride: false,
    };
    mockSetTitleOverride.mockResolvedValue(clearedItem);

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/feed/sync/item-uuid/title-override',
      payload: { value: null },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.hasTitleOverride).toBe(false);
    expect(body.title).toBe('Re: Re: Q3 budget review');
    expect(mockSetTitleOverride).toHaveBeenCalledWith('user-1', 'item-uuid', null);
  });

  it('400 INVALID_VALUE — empty string is rejected', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/feed/sync/item-uuid/title-override',
      payload: { value: '' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_VALUE');
    expect(mockSetTitleOverride).not.toHaveBeenCalled();
  });

  it('400 INVALID_VALUE — whitespace-only string is rejected', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/feed/sync/item-uuid/title-override',
      payload: { value: '   ' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_VALUE');
    expect(mockSetTitleOverride).not.toHaveBeenCalled();
  });

  it('401 — unauthenticated request returns 401', async () => {
    const unauthApp = await buildUnauthApp();
    try {
      const res = await unauthApp.inject({
        method: 'PATCH',
        url: '/api/feed/sync/item-uuid/title-override',
        payload: { value: 'Q3 budget' },
      });
      expect(res.statusCode).toBe(401);
    } finally {
      await unauthApp.close();
    }
  });

  it('404 — item not found returns 404', async () => {
    mockSetTitleOverride.mockRejectedValue(
      Object.assign(new Error('Item not found'), { code: 'ITEM_NOT_FOUND' })
    );

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/feed/sync/missing-uuid/title-override',
      payload: { value: 'Q3 budget' },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('ITEM_NOT_FOUND');
  });
});
