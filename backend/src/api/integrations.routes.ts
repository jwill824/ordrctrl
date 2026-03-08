// T040 — Integrations API routes
// GET /api/integrations
// GET /api/integrations/:serviceId/connect
// GET /api/integrations/:serviceId/callback (GET or POST for Apple)
// DELETE /api/integrations/:serviceId
// POST /api/integrations/:serviceId/reconnect
// POST /api/integrations/sync

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  listIntegrations,
  getAuthorizationUrl,
  connectIntegration,
  disconnectIntegration,
  triggerManualSync,
  getSubSources,
  updateImportFilter,
} from '../integrations/integration.service.js';
import type { ServiceId } from '../integrations/_adapter/types.js';
import { generateState, validateState } from '../lib/csrf.js';
import { logger } from '../lib/logger.js';
import { importFilterBodySchema } from './schemas/integrations.schemas.js';

const VALID_SERVICE_IDS = ['gmail', 'apple_reminders', 'microsoft_tasks', 'apple_calendar'];

function isValidServiceId(id: string): id is ServiceId {
  return VALID_SERVICE_IDS.includes(id);
}

function requireAuth(request: FastifyRequest, reply: FastifyReply): string | null {
  const userId = request.session.userId;
  if (!userId) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Not authenticated' });
    return null;
  }
  return userId;
}

const connectQuerySchema = z.object({
  syncMode: z.enum(['all_unread', 'starred_only']).optional(),
});

export async function registerIntegrationRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/integrations — list all 4 with status
  app.get('/api/integrations', async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    const integrations = await listIntegrations(userId);
    return reply.send({ integrations });
  });

  // GET /api/integrations/:serviceId/connect — initiate OAuth
  app.get(
    '/api/integrations/:serviceId/connect',
    async (request: FastifyRequest<{ Params: { serviceId: string }; Querystring: { syncMode?: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const { serviceId } = request.params;
      if (!isValidServiceId(serviceId)) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Unknown serviceId' });
      }

      // Check if already connected
      const integrations = await listIntegrations(userId);
      const existing = integrations.find((i) => i.serviceId === serviceId);
      if (existing?.status === 'connected') {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'Integration already connected. Use reconnect to re-authorize.',
        });
      }

      // Parse options
      const query = connectQuerySchema.safeParse(request.query);
      const syncMode = query.success ? query.data.syncMode : undefined;

      // Generate and store CSRF state
      const state = generateState();
      request.session.oauthState = state;
      if (syncMode) request.session.gmailSyncMode = syncMode;

      const authUrl = await getAuthorizationUrl(serviceId, state, { gmailSyncMode: syncMode });
      return reply.redirect(302, authUrl);
    }
  );

  // GET /api/integrations/:serviceId/callback — OAuth callback (Google/Microsoft)
  app.get(
    '/api/integrations/:serviceId/callback',
    async (request: FastifyRequest<{ Params: { serviceId: string }; Querystring: { code?: string; state?: string; error?: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const { serviceId } = request.params;
      const { code, state, error: oauthError } = request.query;

      if (!isValidServiceId(serviceId)) {
        return reply.redirect(302, `${process.env.APP_URL}/onboarding?error=${serviceId}&reason=invalid`);
      }

      if (oauthError || !code) {
        return reply.redirect(302, `${process.env.APP_URL}/onboarding?error=${serviceId}&reason=denied`);
      }

      try {
        validateState(state, request.session.oauthState);
      } catch {
        return reply.redirect(302, `${process.env.APP_URL}/onboarding?error=${serviceId}&reason=state_mismatch`);
      }

      try {
        const syncMode = request.session.gmailSyncMode as 'all_unread' | 'starred_only' | undefined;
        await connectIntegration(userId, serviceId, code, { gmailSyncMode: syncMode });

        // Clear session state
        request.session.oauthState = undefined;
        request.session.gmailSyncMode = undefined;

        return reply.redirect(302, `${process.env.APP_URL}/onboarding?connected=${serviceId}`);
      } catch (err) {
        logger.error('Integration callback error', {
          serviceId,
          error: (err as Error).message,
        });
        return reply.redirect(302, `${process.env.APP_URL}/onboarding?error=${serviceId}&reason=server_error`);
      }
    }
  );

  // POST /api/integrations/:serviceId/callback — OAuth callback for Apple (form_post)
  app.post(
    '/api/integrations/:serviceId/callback',
    async (request: FastifyRequest<{ Params: { serviceId: string }; Body: { code?: string; state?: string; error?: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const { serviceId } = request.params;
      const { code, state, error: oauthError } = request.body ?? {};

      if (!isValidServiceId(serviceId)) {
        return reply.redirect(302, `${process.env.APP_URL}/onboarding?error=${serviceId}&reason=invalid`);
      }

      if (oauthError || !code) {
        return reply.redirect(302, `${process.env.APP_URL}/onboarding?error=${serviceId}&reason=denied`);
      }

      try {
        validateState(state, request.session.oauthState);
      } catch {
        return reply.redirect(302, `${process.env.APP_URL}/onboarding?error=${serviceId}&reason=state_mismatch`);
      }

      try {
        await connectIntegration(userId, serviceId, code);

        request.session.oauthState = undefined;
        request.session.gmailSyncMode = undefined;

        return reply.redirect(302, `${process.env.APP_URL}/onboarding?connected=${serviceId}`);
      } catch (err) {
        logger.error('Integration POST callback error', {
          serviceId,
          error: (err as Error).message,
        });
        return reply.redirect(302, `${process.env.APP_URL}/onboarding?error=${serviceId}&reason=server_error`);
      }
    }
  );

  // DELETE /api/integrations/:serviceId — disconnect
  app.delete(
    '/api/integrations/:serviceId',
    async (request: FastifyRequest<{ Params: { serviceId: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const { serviceId } = request.params;
      if (!isValidServiceId(serviceId)) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Unknown serviceId' });
      }

      try {
        await disconnectIntegration(userId, serviceId);
        return reply.status(204).send();
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('not found') || msg.includes('already disconnected')) {
          return reply.status(404).send({ error: 'Not Found', message: msg });
        }
        throw err;
      }
    }
  );

  // POST /api/integrations/:serviceId/reconnect — re-authorize existing integration
  app.post(
    '/api/integrations/:serviceId/reconnect',
    async (request: FastifyRequest<{ Params: { serviceId: string }; Querystring: { syncMode?: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const { serviceId } = request.params;
      if (!isValidServiceId(serviceId)) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Unknown serviceId' });
      }

      const query = connectQuerySchema.safeParse(request.query);
      const syncMode = query.success ? query.data.syncMode : undefined;

      const state = generateState();
      request.session.oauthState = state;
      if (syncMode) request.session.gmailSyncMode = syncMode;

      const authUrl = await getAuthorizationUrl(serviceId, state, { gmailSyncMode: syncMode });
      return reply.redirect(302, authUrl);
    }
  );

  // POST /api/integrations/sync — manual sync trigger
  app.post('/api/integrations/sync', async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    const count = await triggerManualSync(userId);
    if (count === 0) {
      return reply.status(200).send({ message: 'No connected integrations' });
    }
    return reply.status(202).send({ message: 'Sync queued', count });
  });

  // GET /api/integrations/:serviceId/sub-sources — list available sub-sources
  app.get(
    '/api/integrations/:serviceId/sub-sources',
    async (request: FastifyRequest<{ Params: { serviceId: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;
      const { serviceId } = request.params;
      if (!isValidServiceId(serviceId)) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Unknown serviceId' });
      }
      try {
        const subSources = await getSubSources(userId, serviceId);
        return reply.send({ subSources });
      } catch (err: any) {
        if (err.code === 'INTEGRATION_NOT_FOUND') {
          return reply.status(404).send({ error: 'NotFound', message: err.message });
        }
        if (err.code === 'PROVIDER_ERROR') {
          return reply.status(502).send({ error: 'SubSourceFetchError', message: err.message });
        }
        logger.error('getSubSources error', { error: err.message });
        return reply.status(502).send({ error: 'SubSourceFetchError', message: err.message });
      }
    }
  );

  // PUT /api/integrations/:serviceId/import-filter — update import filter
  app.put(
    '/api/integrations/:serviceId/import-filter',
    async (request: FastifyRequest<{ Params: { serviceId: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;
      const { serviceId } = request.params;
      if (!isValidServiceId(serviceId)) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Unknown serviceId' });
      }
      const parsed = importFilterBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'ValidationError', message: parsed.error.errors[0]?.message });
      }
      try {
        const result = await updateImportFilter(
          userId,
          serviceId,
          parsed.data.importEverything,
          parsed.data.selectedSubSourceIds
        );
        return reply.send(result);
      } catch (err: any) {
        if (err.code === 'INTEGRATION_NOT_FOUND') {
          return reply.status(404).send({ error: 'NotFound', message: err.message });
        }
        return reply.status(500).send({ error: 'InternalError', message: err.message });
      }
    }
  );
}
