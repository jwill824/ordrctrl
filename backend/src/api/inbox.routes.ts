// T010 — Inbox API routes
// GET /api/inbox
// GET /api/inbox/count
// PATCH /api/inbox/items/:itemId/accept
// PATCH /api/inbox/items/:itemId/dismiss
// POST /api/inbox/accept-all
// POST /api/inbox/dismiss-all

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  buildInbox,
  getInboxCount,
  acceptInboxItem,
  dismissInboxItem,
  acceptAll,
  dismissAll,
  InboxError,
} from '../inbox/inbox.service.js';

function requireAuth(request: FastifyRequest, reply: FastifyReply): string | null {
  const userId = request.session.userId;
  if (!userId) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Not authenticated' });
    return null;
  }
  return userId;
}

const itemIdSchema = z.object({
  itemId: z.string().min(1, 'itemId is required'),
});

const bulkBodySchema = z.object({
  integrationId: z.string().min(1, 'integrationId is required'),
});

export async function registerInboxRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/inbox
  app.get('/api/inbox', async (request: FastifyRequest, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    try {
      const result = await buildInbox(userId);
      app.log.info({ userId, total: result.total, groups: result.groups.length }, '[inbox] buildInbox result');
      return reply.send(result);
    } catch (err) {
      app.log.error({ userId, err }, '[inbox] buildInbox error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/inbox/count
  app.get('/api/inbox/count', async (request: FastifyRequest, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    const count = await getInboxCount(userId);
    return reply.send({ count });
  });

  // PATCH /api/inbox/items/:itemId/accept
  app.patch(
    '/api/inbox/items/:itemId/accept',
    async (request: FastifyRequest<{ Params: { itemId: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const parsed = itemIdSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'Bad Request', code: 'INVALID_ITEM_ID', message: parsed.error.errors[0].message });
      }

      const { itemId } = parsed.data;

      // Strip "inbox:" prefix if present
      const rawId = itemId.startsWith('inbox:') ? itemId.slice(6) : itemId;

      try {
        await acceptInboxItem(userId, rawId);
        return reply.send({});
      } catch (err) {
        if (err instanceof InboxError) {
          if (err.code === 'ITEM_NOT_FOUND')
            return reply.status(404).send({ error: 'Not Found', code: err.code, message: err.message });
          if (err.code === 'ALREADY_ACCEPTED')
            return reply.status(409).send({ error: 'Conflict', code: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // PATCH /api/inbox/items/:itemId/dismiss
  app.patch(
    '/api/inbox/items/:itemId/dismiss',
    async (request: FastifyRequest<{ Params: { itemId: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const parsed = itemIdSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'Bad Request', code: 'INVALID_ITEM_ID', message: parsed.error.errors[0].message });
      }

      const { itemId } = parsed.data;

      // Strip "inbox:" prefix if present
      const rawId = itemId.startsWith('inbox:') ? itemId.slice(6) : itemId;

      try {
        await dismissInboxItem(userId, rawId);
        return reply.send({});
      } catch (err) {
        if (err instanceof InboxError) {
          if (err.code === 'ITEM_NOT_FOUND')
            return reply.status(404).send({ error: 'Not Found', code: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // POST /api/inbox/accept-all
  app.post(
    '/api/inbox/accept-all',
    async (request: FastifyRequest<{ Body: { integrationId?: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const parsed = bulkBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'Bad Request', code: 'MISSING_INTEGRATION_ID', message: parsed.error.errors[0].message });
      }

      const { integrationId } = parsed.data;

      try {
        const accepted = await acceptAll(userId, integrationId);
        return reply.send({ accepted });
      } catch (err) {
        if (err instanceof InboxError) {
          if (err.code === 'INTEGRATION_NOT_FOUND')
            return reply.status(404).send({ error: 'Not Found', code: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // POST /api/inbox/dismiss-all
  app.post(
    '/api/inbox/dismiss-all',
    async (request: FastifyRequest<{ Body: { integrationId?: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const parsed = bulkBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'Bad Request', code: 'MISSING_INTEGRATION_ID', message: parsed.error.errors[0].message });
      }

      const { integrationId } = parsed.data;

      try {
        const dismissed = await dismissAll(userId, integrationId);
        return reply.send({ dismissed });
      } catch (err) {
        if (err instanceof InboxError) {
          if (err.code === 'INTEGRATION_NOT_FOUND')
            return reply.status(404).send({ error: 'Not Found', code: err.code, message: err.message });
        }
        throw err;
      }
    }
  );
}
