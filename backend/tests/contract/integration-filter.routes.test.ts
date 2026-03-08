import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/integrations/integration.service.js', () => ({
  listIntegrations: vi.fn(),
  getSubSources: vi.fn(),
  updateImportFilter: vi.fn(),
}));

vi.mock('../../src/lib/csrf.js', () => ({
  generateState: vi.fn(() => 'mock-state'),
  validateState: vi.fn(() => true),
}));

import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { registerIntegrationRoutes } from '../../src/api/integrations.routes.js';
import { listIntegrations, getSubSources, updateImportFilter } from '../../src/integrations/integration.service.js';

const mockListIntegrations = listIntegrations as ReturnType<typeof vi.fn>;
const mockGetSubSources = getSubSources as ReturnType<typeof vi.fn>;
const mockUpdateImportFilter = updateImportFilter as ReturnType<typeof vi.fn>;

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(fastifyCookie);
  await app.register(fastifySession, {
    secret: 'test-secret-at-least-32-chars-long!!',
    cookie: { secure: false },
  });

  // Mock auth middleware by injecting userId into session
  app.addHook('preHandler', async (request) => {
    (request.session as any).userId = 'user-1';
  });

  await registerIntegrationRoutes(app);
  await app.ready();
  return app;
}

describe('Integration Filter Routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/integrations/:serviceId/sub-sources', () => {
    it('returns 200 with subSources array', async () => {
      mockGetSubSources.mockResolvedValue([
        { id: 'LABEL_1', label: 'Work', type: 'label' },
        { id: 'LABEL_2', label: 'Personal', type: 'label' },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/integrations/gmail/sub-sources',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.subSources).toHaveLength(2);
      expect(body.subSources[0]).toMatchObject({ id: 'LABEL_1', label: 'Work', type: 'label' });
    });

    it('returns 404 when integration not connected', async () => {
      mockGetSubSources.mockRejectedValue(Object.assign(new Error('Not connected'), { code: 'INTEGRATION_NOT_FOUND' }));

      const res = await app.inject({
        method: 'GET',
        url: '/api/integrations/gmail/sub-sources',
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 502 when provider API fails', async () => {
      mockGetSubSources.mockRejectedValue(Object.assign(new Error('Provider error'), { code: 'PROVIDER_ERROR' }));

      const res = await app.inject({
        method: 'GET',
        url: '/api/integrations/gmail/sub-sources',
      });

      expect(res.statusCode).toBe(502);
    });
  });

  describe('PUT /api/integrations/:serviceId/import-filter', () => {
    it('saves and returns 200 with updated filter state', async () => {
      mockUpdateImportFilter.mockResolvedValue({
        serviceId: 'gmail',
        status: 'connected',
        importEverything: false,
        selectedSubSourceIds: ['LABEL_1'],
        lastSyncAt: null,
        lastSyncError: null,
        gmailSyncMode: null,
        updatedAt: new Date().toISOString(),
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/integrations/gmail/import-filter',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ importEverything: false, selectedSubSourceIds: ['LABEL_1'] }),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.importEverything).toBe(false);
      expect(body.selectedSubSourceIds).toContain('LABEL_1');
    });

    it('returns 400 when importEverything=false and selectedSubSourceIds is empty', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/integrations/gmail/import-filter',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ importEverything: false, selectedSubSourceIds: [] }),
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 404 when integration not connected', async () => {
      mockUpdateImportFilter.mockRejectedValue(Object.assign(new Error('Not found'), { code: 'INTEGRATION_NOT_FOUND' }));

      const res = await app.inject({
        method: 'PUT',
        url: '/api/integrations/gmail/import-filter',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ importEverything: true, selectedSubSourceIds: [] }),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/integrations', () => {
    it('response includes importEverything and selectedSubSourceIds fields', async () => {
      mockListIntegrations.mockResolvedValue([
        {
          serviceId: 'gmail',
          status: 'connected',
          lastSyncAt: null,
          lastSyncError: null,
          gmailSyncMode: null,
          importEverything: true,
          selectedSubSourceIds: [],
        },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/integrations',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.integrations[0]).toHaveProperty('importEverything');
      expect(body.integrations[0]).toHaveProperty('selectedSubSourceIds');
    });
  });

  describe('T024 - PUT then GET shows updated values', () => {
    it('after PUT, GET /api/integrations shows new importEverything and selectedSubSourceIds', async () => {
      mockUpdateImportFilter.mockResolvedValue({
        serviceId: 'gmail',
        status: 'connected',
        importEverything: false,
        selectedSubSourceIds: ['LABEL_1'],
        lastSyncAt: null,
        lastSyncError: null,
        gmailSyncMode: null,
      });

      const putRes = await app.inject({
        method: 'PUT',
        url: '/api/integrations/gmail/import-filter',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ importEverything: false, selectedSubSourceIds: ['LABEL_1'] }),
      });
      expect(putRes.statusCode).toBe(200);

      mockListIntegrations.mockResolvedValue([
        {
          serviceId: 'gmail',
          status: 'connected',
          lastSyncAt: null,
          lastSyncError: null,
          gmailSyncMode: null,
          importEverything: false,
          selectedSubSourceIds: ['LABEL_1'],
        },
      ]);

      const getRes = await app.inject({ method: 'GET', url: '/api/integrations' });
      const body = JSON.parse(getRes.body);
      expect(body.integrations[0].importEverything).toBe(false);
      expect(body.integrations[0].selectedSubSourceIds).toContain('LABEL_1');
    });
  });
});
