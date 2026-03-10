// T040 — Integrations API routes

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
  updateCalendarEventWindow,
  updateGmailCompletionMode,
  updateGmailSyncMode,
  updateLabel,
  pauseIntegration,
  AppError,
} from '../integrations/integration.service.js';
import type { ServiceId } from '../integrations/_adapter/types.js';
import {
  InvalidCredentialsError,
  ProviderUnavailableError,
  AccountLimitError,
  DuplicateAccountError,
} from '../integrations/_adapter/types.js';
import { generateState, validateState } from '../lib/csrf.js';
import { logger } from '../lib/logger.js';
import { importFilterBodySchema } from './schemas/integrations.schemas.js';

const VALID_SERVICE_IDS = ['gmail', 'microsoft_tasks', 'apple_calendar'];
const APPLE_SERVICE_IDS = ['apple_calendar'];

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

const appleConnectBodySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('credential'),
    email: z.string().email(),
    password: z.string().min(1),
    calendarEventWindowDays: z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(60)]).optional(),
  }),
  z.object({
    type: z.literal('use-existing'),
  }),
]);

const eventWindowBodySchema = z.object({
  days: z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(60)]),
});

const labelBodySchema = z.object({ label: z.string().max(50) });
const pauseBodySchema = z.object({ paused: z.boolean() });

export async function registerIntegrationRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/integrations — list all with status
  app.get('/api/integrations', async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;
    const integrations = await listIntegrations(userId);
    return reply.send({ integrations });
  });

  // GET /api/integrations/:serviceId/connect — initiate OAuth (multi-account: no conflict check)
  app.get(
    '/api/integrations/:serviceId/connect',
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

  // POST /api/integrations/:serviceId/connect — credential-based connect for Apple
  app.post(
    '/api/integrations/:serviceId/connect',
    async (request: FastifyRequest<{ Params: { serviceId: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const { serviceId } = request.params;
      if (!isValidServiceId(serviceId) || !APPLE_SERVICE_IDS.includes(serviceId)) {
        return reply.status(400).send({ error: 'UNSUPPORTED_SERVICE', message: 'This endpoint is only for Apple services' });
      }

      const parsed = appleConnectBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'ValidationError', message: parsed.error.errors[0]?.message });
      }

      const body = parsed.data;
      const options =
        body.type === 'credential' && body.calendarEventWindowDays
          ? { calendarEventWindowDays: body.calendarEventWindowDays }
          : undefined;

      try {
        const result = await connectIntegration(userId, serviceId, body, options);
        return reply.status(200).send({ integrationId: result.integrationId, accountIdentifier: result.accountIdentifier, status: 'connected' });
      } catch (err) {
        if (err instanceof InvalidCredentialsError) {
          return reply.status(401).send({ error: 'INVALID_CREDENTIALS', message: (err as Error).message });
        }
        if (err instanceof ProviderUnavailableError) {
          return reply.status(503).send({ error: 'PROVIDER_UNAVAILABLE', message: (err as Error).message });
        }
        if (err instanceof AppError && err.code === 'NO_EXISTING_CREDENTIALS') {
          return reply.status(409).send({ error: 'NO_EXISTING_CREDENTIALS', message: err.message });
        }
        if (err instanceof AccountLimitError) {
          return reply.status(409).send({ error: 'ACCOUNT_LIMIT_REACHED', message: (err as Error).message });
        }
        if (err instanceof DuplicateAccountError) {
          return reply.status(409).send({ error: 'DUPLICATE_ACCOUNT', message: (err as Error).message });
        }
        logger.error('Apple connect error', { serviceId, error: (err as Error).message });
        return reply.status(500).send({ error: 'InternalError', message: (err as Error).message });
      }
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
        await connectIntegration(userId, serviceId, { type: 'oauth', authCode: code }, { gmailSyncMode: syncMode });

        request.session.oauthState = undefined;
        request.session.gmailSyncMode = undefined;

        return reply.redirect(302, `${process.env.APP_URL}/onboarding?connected=${serviceId}`);
      } catch (err) {
        if (err instanceof DuplicateAccountError) {
          return reply.redirect(302, `${process.env.APP_URL}/onboarding?error=duplicate_account&serviceId=${serviceId}`);
        }
        if (err instanceof AccountLimitError) {
          return reply.redirect(302, `${process.env.APP_URL}/onboarding?error=account_limit_reached&serviceId=${serviceId}`);
        }
        logger.error('Integration callback error', { serviceId, error: (err as Error).message });
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
        await connectIntegration(userId, serviceId, { type: 'oauth', authCode: code });

        request.session.oauthState = undefined;
        request.session.gmailSyncMode = undefined;

        return reply.redirect(302, `${process.env.APP_URL}/onboarding?connected=${serviceId}`);
      } catch (err) {
        if (err instanceof DuplicateAccountError) {
          return reply.redirect(302, `${process.env.APP_URL}/onboarding?error=duplicate_account&serviceId=${serviceId}`);
        }
        if (err instanceof AccountLimitError) {
          return reply.redirect(302, `${process.env.APP_URL}/onboarding?error=account_limit_reached&serviceId=${serviceId}`);
        }
        logger.error('Integration POST callback error', { serviceId, error: (err as Error).message });
        return reply.redirect(302, `${process.env.APP_URL}/onboarding?error=${serviceId}&reason=server_error`);
      }
    }
  );

  // DELETE /api/integrations/:integrationId — disconnect by integration ID
  app.delete(
    '/api/integrations/:integrationId',
    async (request: FastifyRequest<{ Params: { integrationId: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const { integrationId } = request.params;

      try {
        await disconnectIntegration(userId, integrationId);
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

  // GET /api/integrations/:integrationId/sub-sources — list available sub-sources
  app.get(
    '/api/integrations/:integrationId/sub-sources',
    async (request: FastifyRequest<{ Params: { integrationId: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;
      const { integrationId } = request.params;
      try {
        const subSources = await getSubSources(userId, integrationId);
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

  // PUT /api/integrations/:integrationId/import-filter — update import filter
  app.put(
    '/api/integrations/:integrationId/import-filter',
    async (request: FastifyRequest<{ Params: { integrationId: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;
      const { integrationId } = request.params;
      const parsed = importFilterBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'ValidationError', message: parsed.error.errors[0]?.message });
      }
      try {
        const result = await updateImportFilter(
          userId,
          integrationId,
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

  // PUT /api/integrations/:integrationId/event-window — update calendar event window
  app.put(
    '/api/integrations/:integrationId/event-window',
    async (request: FastifyRequest<{ Params: { integrationId: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const { integrationId } = request.params;

      const parsed = eventWindowBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'ValidationError', message: parsed.error.errors[0]?.message });
      }

      try {
        await updateCalendarEventWindow(userId, integrationId, parsed.data.days);
        return reply.status(200).send({ calendarEventWindowDays: parsed.data.days });
      } catch (err: any) {
        if (err instanceof AppError && err.code === 'INTEGRATION_NOT_FOUND') {
          return reply.status(404).send({ error: 'INTEGRATION_NOT_FOUND', message: err.message });
        }
        return reply.status(500).send({ error: 'InternalError', message: err.message });
      }
    }
  );

  // PATCH /api/integrations/:integrationId/completion-mode — update Gmail completion mode
  const completionModeBodySchema = z.object({
    mode: z.enum(['inbox_removal', 'read']),
  });

  app.patch(
    '/api/integrations/:integrationId/completion-mode',
    async (request: FastifyRequest<{ Params: { integrationId: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const { integrationId } = request.params;

      const parsed = completionModeBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'ValidationError', message: parsed.error.errors[0]?.message });
      }

      try {
        const result = await updateGmailCompletionMode(userId, integrationId, parsed.data.mode);
        return reply.status(200).send(result);
      } catch (err: any) {
        if (err instanceof AppError && err.code === 'INTEGRATION_NOT_FOUND') {
          return reply.status(404).send({ error: 'INTEGRATION_NOT_FOUND', message: err.message });
        }
        return reply.status(500).send({ error: 'InternalError', message: err.message });
      }
    }
  );

  // PATCH /api/integrations/:integrationId/label — set/clear nickname
  app.patch(
    '/api/integrations/:integrationId/label',
    async (request: FastifyRequest<{ Params: { integrationId: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;
      const { integrationId } = request.params;
      const parsed = labelBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Validation failed', details: parsed.error.errors });
      }
      try {
        const result = await updateLabel(userId, integrationId, parsed.data.label || null);
        return reply.send({ id: result.id, label: result.label, accountIdentifier: result.accountIdentifier });
      } catch (err: any) {
        if (err instanceof AppError && err.code === 'NOT_FOUND') return reply.status(404).send({ error: 'Not found' });
        if (err instanceof AppError && err.code === 'VALIDATION_FAILED') return reply.status(400).send({ error: err.message });
        return reply.status(500).send({ error: 'InternalError', message: err.message });
      }
    }
  );

  // PATCH /api/integrations/:integrationId/pause — pause/resume an integration
  app.patch(
    '/api/integrations/:integrationId/pause',
    async (request: FastifyRequest<{ Params: { integrationId: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;
      const { integrationId } = request.params;
      const parsed = pauseBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Validation failed', details: parsed.error.errors });
      }
      try {
        const result = await pauseIntegration(userId, integrationId, parsed.data.paused);
        return reply.send(result);
      } catch (err: any) {
        if (err instanceof AppError && err.code === 'NOT_FOUND') return reply.status(404).send({ error: 'Not found' });
        if (err instanceof AppError && err.code === 'INVALID_STATE') return reply.status(400).send({ error: err.message });
        return reply.status(500).send({ error: 'InternalError', message: err.message });
      }
    }
  );
}
