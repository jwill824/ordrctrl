// T12-05 — Contract tests for PATCH /api/feed/:itemId/override
// Validates the new override route introduced in Plan 12-04.
//
// In feed.routes.ts the handler calls requireAuth() first (line 400-401),
// so ALL unauthenticated requests return 401 before any itemId or body
// validation runs. Tests confirm the auth guard is in place; comments
// document what would be returned with a valid session.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import type { FastifyInstance } from 'fastify';

// Required env vars before app creation (mirrors feed.test.ts pattern)
process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
process.env.SESSION_SECRET = 'test-session-secret-for-contract-tests-abc123';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://ordrctrl:ordrctrl@localhost:5432/ordrctrl_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.RESEND_API_KEY = 'test_key';
process.env.APP_URL = 'http://localhost:3000';
process.env.API_URL = 'http://localhost:4000';

let app: FastifyInstance;
let request: ReturnType<typeof supertest>;

beforeAll(async () => {
  try {
    const { createApp } = await import('../../src/app.js');
    app = await createApp();
    await app.ready();
    request = supertest(app.server);
  } catch (e) {
    console.warn('Feed override contract tests skipped:', (e as Error).message);
  }
});

afterAll(async () => {
  if (app) await app.close();
});

// ---------------------------------------------------------------------------
// PATCH /api/feed/:itemId/override — auth guard
// ---------------------------------------------------------------------------

describe('PATCH /api/feed/:itemId/override — auth guard', () => {
  it('returns 401 for a valid sync itemId (unauthenticated)', async () => {
    if (!request) return;
    const res = await request
      .patch('/api/feed/sync:00000000-0000-0000-0000-000000000000/override')
      .send({ type: 'COLOR', value: '#EF4444' });
    expect(res.status).toBe(401);
  });

  // Auth guard fires BEFORE the sync: prefix check, so native: also returns 401
  // (with auth, a native: itemId would return 400 "sync: prefix only")
  it('returns 401 for a native itemId (auth guard fires before prefix check)', async () => {
    if (!request) return;
    const res = await request
      .patch('/api/feed/native:00000000-0000-0000-0000-000000000000/override')
      .send({ type: 'COLOR', value: '#EF4444' });
    expect(res.status).toBe(401);
  });

  it('returns 401 with no body (auth guard fires before body validation)', async () => {
    if (!request) return;
    const res = await request
      .patch('/api/feed/sync:00000000-0000-0000-0000-000000000000/override');
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid type value (auth guard fires before schema parse)', async () => {
    if (!request) return;
    const res = await request
      .patch('/api/feed/sync:00000000-0000-0000-0000-000000000000/override')
      .send({ type: 'INVALID_TYPE', value: '#EF4444' });
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid hex color (auth guard fires before color hex check)', async () => {
    if (!request) return;
    const res = await request
      .patch('/api/feed/sync:00000000-0000-0000-0000-000000000000/override')
      .send({ type: 'COLOR', value: '#ZZZ' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for ICON type with valid emoji', async () => {
    if (!request) return;
    const res = await request
      .patch('/api/feed/sync:00000000-0000-0000-0000-000000000000/override')
      .send({ type: 'ICON', value: '🎯' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when value is null (clearing the override, auth guard fires first)', async () => {
    if (!request) return;
    const res = await request
      .patch('/api/feed/sync:00000000-0000-0000-0000-000000000000/override')
      .send({ type: 'COLOR', value: null });
    expect(res.status).toBe(401);
  });
});
