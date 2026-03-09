import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/integrations/integration.service.js', () => ({
  listIntegrations: vi.fn(),
  getAuthorizationUrl: vi.fn(),
  connectIntegration: vi.fn(),
  disconnectIntegration: vi.fn(),
  triggerManualSync: vi.fn(),
  getSubSources: vi.fn(),
  updateImportFilter: vi.fn(),
  updateCalendarEventWindow: vi.fn(),
  AppError: class AppError extends Error {
    constructor(public readonly code: string, message: string) {
      super(message);
      this.name = 'AppError';
    }
  },
}));

vi.mock('../../src/integrations/_adapter/types.js', () => ({
  InvalidCredentialsError: class extends Error { constructor(s: string) { super(s); } },
  ProviderUnavailableError: class extends Error { constructor(s: string) { super(s); } },
}));

vi.mock('../../src/lib/csrf.js', () => ({
  generateState: vi.fn(() => 'mock-state'),
  validateState: vi.fn(() => true),
}));

import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { registerIntegrationRoutes } from '../../src/api/integrations.routes.js';
import { updateCalendarEventWindow, AppError } from '../../src/integrations/integration.service.js';

const mockUpdateCalendarEventWindow = updateCalendarEventWindow as ReturnType<typeof vi.fn>;

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(fastifyCookie);
  await app.register(fastifySession, {
    secret: 'test-secret-at-least-32-chars-long!!',
    cookie: { secure: false },
  });
  app.addHook('preHandler', async (request) => {
    (request.session as any).userId = 'user-1';
  });
  await registerIntegrationRoutes(app);
  await app.ready();
  return app;
}

describe('PUT /api/integrations/apple_calendar/event-window', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('valid days (14) → 200 { calendarEventWindowDays: 14 }', async () => {
    mockUpdateCalendarEventWindow.mockResolvedValue(undefined);

    const res = await app.inject({
      method: 'PUT',
      url: '/api/integrations/apple_calendar/event-window',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ days: 14 }),
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).calendarEventWindowDays).toBe(14);
  });

  it('invalid days (999) → 400', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/integrations/apple_calendar/event-window',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ days: 999 }),
    });

    expect(res.statusCode).toBe(400);
  });

  it('apple_reminders serviceId → 400 UNSUPPORTED_SERVICE', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/integrations/apple_reminders/event-window',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ days: 14 }),
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('UNSUPPORTED_SERVICE');
  });
});
