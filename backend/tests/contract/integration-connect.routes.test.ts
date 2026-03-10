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
  updateGmailCompletionMode: vi.fn(),
  updateGmailSyncMode: vi.fn(),
  updateLabel: vi.fn(),
  pauseIntegration: vi.fn(),
  AppError: class AppError extends Error {
    constructor(public readonly code: string, message: string) {
      super(message);
      this.name = 'AppError';
    }
  },
}));

vi.mock('../../src/integrations/_adapter/types.js', () => ({
  InvalidCredentialsError: class InvalidCredentialsError extends Error {
    constructor(serviceId: string) {
      super(`Invalid credentials for ${serviceId}`);
      this.name = 'InvalidCredentialsError';
    }
  },
  ProviderUnavailableError: class ProviderUnavailableError extends Error {
    constructor(serviceId: string, statusCode?: number) {
      super(`Provider ${serviceId} is unavailable`);
      this.name = 'ProviderUnavailableError';
    }
  },
  AccountLimitError: class AccountLimitError extends Error {
    constructor(serviceId: string, limit: number) {
      super(`Account limit reached for ${serviceId}: maximum ${limit} accounts per service`);
      this.name = 'AccountLimitError';
    }
  },
  DuplicateAccountError: class DuplicateAccountError extends Error {
    constructor(serviceId: string, accountIdentifier: string) {
      super(`Account ${accountIdentifier} is already connected for ${serviceId}`);
      this.name = 'DuplicateAccountError';
    }
  },
}));

vi.mock('../../src/lib/csrf.js', () => ({
  generateState: vi.fn(() => 'mock-state'),
  validateState: vi.fn(() => true),
}));

import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { registerIntegrationRoutes } from '../../src/api/integrations.routes.js';
import {
  connectIntegration,
  updateCalendarEventWindow,
  AppError,
} from '../../src/integrations/integration.service.js';
import {
  InvalidCredentialsError,
  ProviderUnavailableError,
} from '../../src/integrations/_adapter/types.js';

const mockConnectIntegration = connectIntegration as ReturnType<typeof vi.fn>;
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

describe('POST /api/integrations/:serviceId/connect', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('valid credential body → 200 { integrationId, status: connected }', async () => {
    mockConnectIntegration.mockResolvedValue({ integrationId: 'int-1' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/integrations/apple_calendar/connect',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'credential', email: 'test@icloud.com', password: 'xxxx-xxxx' }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.integrationId).toBe('int-1');
    expect(body.status).toBe('connected');
  });

  it('invalid credentials (service throws InvalidCredentialsError) → 401', async () => {
    mockConnectIntegration.mockRejectedValue(new InvalidCredentialsError('apple_calendar'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/integrations/apple_calendar/connect',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'credential', email: 'test@icloud.com', password: 'wrong' }),
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('INVALID_CREDENTIALS');
  });

  it('use-existing with no sibling → 409 NO_EXISTING_CREDENTIALS', async () => {
    const AppErrorClass = (await import('../../src/integrations/integration.service.js')).AppError;
    mockConnectIntegration.mockRejectedValue(new AppErrorClass('NO_EXISTING_CREDENTIALS', 'No sibling found'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/integrations/apple_calendar/connect',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'use-existing' }),
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('NO_EXISTING_CREDENTIALS');
  });

  it('provider unavailable → 503', async () => {
    mockConnectIntegration.mockRejectedValue(new ProviderUnavailableError('apple_calendar', 503));

    const res = await app.inject({
      method: 'POST',
      url: '/api/integrations/apple_calendar/connect',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'credential', email: 'test@icloud.com', password: 'xxxx-xxxx' }),
    });

    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('PROVIDER_UNAVAILABLE');
  });

  it('POST /api/integrations/gmail/connect → 400 UNSUPPORTED_SERVICE', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/integrations/gmail/connect',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'credential', email: 'test@gmail.com', password: 'pass' }),
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('UNSUPPORTED_SERVICE');
  });
});

describe('PUT /api/integrations/:integrationId/event-window', () => {
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
      url: '/api/integrations/int-apple-1/event-window',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ days: 14 }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.calendarEventWindowDays).toBe(14);
  });

  it('invalid days (999) → 400', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/integrations/int-apple-1/event-window',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ days: 999 }),
    });

    expect(res.statusCode).toBe(400);
  });

  it('unknown integrationId → 404 INTEGRATION_NOT_FOUND', async () => {
    const AppErrorClass = (await import('../../src/integrations/integration.service.js')).AppError as any;
    mockUpdateCalendarEventWindow.mockRejectedValue(new AppErrorClass('INTEGRATION_NOT_FOUND', 'Not found'));

    const res = await app.inject({
      method: 'PUT',
      url: '/api/integrations/nonexistent-id/event-window',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ days: 14 }),
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('INTEGRATION_NOT_FOUND');
  });
});
