// T050 — Feed API routes
// GET /api/feed
// PATCH /api/feed/items/:itemId/complete
// PATCH /api/feed/items/:itemId/dismiss
// DELETE /api/feed/items/:itemId/dismiss
// GET /api/feed/dismissed
// (POST /api/integrations/sync is in integrations.routes.ts)

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  buildFeed,
  buildDismissedFeed,
  completeSyncItem,
  completeNativeTask,
  uncompleteNativeTask,
  uncompleteSyncItem,
  clearCompletedItems,
  dismissFeedItem,
  restoreFeedItem,
  getDismissedItems,
  permanentDeleteFeedItem,
  setUserDueAt,
  setDescriptionOverride,
} from '../feed/feed.service.js';
import { dismissParamSchema, dismissedQuerySchema } from './schemas/feed.schemas.js';

function requireAuth(request: FastifyRequest, reply: FastifyReply): string | null {
  const userId = request.session.userId;
  if (!userId) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Not authenticated' });
    return null;
  }
  return userId;
}

export async function registerFeedRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/feed
  app.get(
    '/api/feed',
    async (
      request: FastifyRequest<{ Querystring: { includeCompleted?: string; showDismissed?: string } }>,
      reply
    ) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const showDismissed = request.query.showDismissed === 'true';
      if (showDismissed) {
        const result = await buildDismissedFeed(userId);
        return reply.send({ items: result.items, completed: [], syncStatus: {} });
      }

      const includeCompleted = request.query.includeCompleted === 'true';
      const feed = await buildFeed(userId, includeCompleted);
      return reply.send(feed);
    }
  );

  // PATCH /api/feed/items/:itemId/complete
  app.patch(
    '/api/feed/items/:itemId/complete',
    async (
      request: FastifyRequest<{ Params: { itemId: string } }>,
      reply
    ) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const { itemId } = request.params;

      // itemId format: "sync:<uuid>" or "native:<uuid>"
      const [type, rawId] = itemId.split(':');

      if (!type || !rawId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid itemId format. Expected "sync:<uuid>" or "native:<uuid>"',
        });
      }

      try {
        let result;
        if (type === 'sync') {
          result = await completeSyncItem(rawId, userId);
        } else if (type === 'native') {
          result = await completeNativeTask(rawId, userId);
        } else {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Invalid item type. Use "sync" or "native"',
          });
        }

        return reply.send(result);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('not found')) {
          return reply.status(404).send({ error: 'Not Found', message: msg });
        }
        throw err;
      }
    }
  );

  // PATCH /api/feed/items/:itemId/uncomplete
  app.patch(
    '/api/feed/items/:itemId/uncomplete',
    async (
      request: FastifyRequest<{ Params: { itemId: string } }>,
      reply
    ) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const { itemId } = request.params;

      const [type, rawId] = itemId.split(':');

      if (!type || !rawId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid itemId format. Expected "sync:<uuid>" or "native:<uuid>"',
        });
      }

      try {
        let result;
        if (type === 'sync') {
          result = await uncompleteSyncItem(rawId, userId);
        } else if (type === 'native') {
          result = await uncompleteNativeTask(rawId, userId);
        } else {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Invalid item type. Use "sync" or "native"',
          });
        }

        return reply.send(result);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('not found')) {
          return reply.status(404).send({ error: 'Not Found', message: msg });
        }
        if (msg.includes('not completed')) {
          return reply.status(400).send({ error: 'Bad Request', code: 'ITEM_NOT_COMPLETED', message: msg });
        }
        throw err;
      }
    }
  );

  // POST /api/feed/completed/clear
  app.post(
    '/api/feed/completed/clear',
    async (request: FastifyRequest, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const result = await clearCompletedItems(userId);
      return reply.send(result);
    }
  );

  // T009 — PATCH /api/feed/items/:itemId/dismiss
  app.patch(
    '/api/feed/items/:itemId/dismiss',
    async (request: FastifyRequest<{ Params: { itemId: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const parsed = dismissParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Bad Request', code: 'INVALID_ITEM_ID', message: parsed.error.errors[0].message });
      }

      const { itemId } = parsed.data;
      try {
        await dismissFeedItem(userId, itemId);
        return reply.send({ id: itemId, dismissed: true });
      } catch (err) {
        const code = (err as NodeJS.ErrnoException & { code?: string }).code;
        if (code === 'ITEM_NOT_FOUND') return reply.status(404).send({ error: 'Not Found', code, message: (err as Error).message });
        if (code === 'ALREADY_DISMISSED') return reply.status(409).send({ error: 'Conflict', code, message: (err as Error).message });
        throw err;
      }
    }
  );

  // T014 — DELETE /api/feed/items/:itemId/dismiss (undo / restore)
  app.delete(
    '/api/feed/items/:itemId/dismiss',
    async (request: FastifyRequest<{ Params: { itemId: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const parsed = dismissParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Bad Request', code: 'INVALID_ITEM_ID', message: parsed.error.errors[0].message });
      }

      const { itemId } = parsed.data;
      try {
        await restoreFeedItem(userId, itemId);
        return reply.send({ id: itemId, dismissed: false });
      } catch (err) {
        const code = (err as NodeJS.ErrnoException & { code?: string }).code;
        if (code === 'ITEM_NOT_FOUND') return reply.status(404).send({ error: 'Not Found', code, message: (err as Error).message });
        if (code === 'NOT_DISMISSED') return reply.status(404).send({ error: 'Not Found', code, message: (err as Error).message });
        throw err;
      }
    }
  );

  // T020 — GET /api/feed/dismissed
  app.get(
    '/api/feed/dismissed',
    async (request: FastifyRequest<{ Querystring: { limit?: string; cursor?: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const parsed = dismissedQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Bad Request', message: parsed.error.errors[0].message });
      }

      const { limit, cursor } = parsed.data;
      try {
        const result = await getDismissedItems(userId, limit, cursor);
        return reply.send(result);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException & { code?: string }).code;
        if (code === 'INVALID_CURSOR') return reply.status(400).send({ error: 'Bad Request', code, message: (err as Error).message });
        throw err;
      }
    }
  );

  // T018 — DELETE /api/feed/items/:itemId/permanent
  app.delete(
    '/api/feed/items/:itemId/permanent',
    async (request: FastifyRequest<{ Params: { itemId: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const { itemId } = request.params;
      const [type, rawId] = itemId.split(':');
      if (!type || !rawId) {
        return reply.status(400).send({ error: 'Bad Request', code: 'INVALID_ITEM_ID', message: 'Invalid itemId format' });
      }

      try {
        await permanentDeleteFeedItem(userId, itemId);
        return reply.send({});
      } catch (err) {
        const code = (err as NodeJS.ErrnoException & { code?: string }).code;
        if (code === 'ITEM_NOT_FOUND') return reply.status(404).send({ error: 'Not Found', code, message: (err as Error).message });
        if (code === 'NOT_DISMISSED') return reply.status(409).send({ error: 'Conflict', code, message: (err as Error).message });
        throw err;
      }
    }
  );

  // T028 — PATCH /api/feed/items/:itemId/user-due-date
  app.patch(
    '/api/feed/items/:itemId/user-due-date',
    async (request: FastifyRequest<{ Params: { itemId: string }; Body: { dueAt: string | null } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const { itemId } = request.params;
      const [type, rawId] = itemId.split(':');

      if (!type || !rawId || type !== 'sync') {
        return reply.status(400).send({ error: 'Bad Request', code: 'INVALID_ITEM_ID', message: 'User due date is only supported for synced items (sync: prefix)' });
      }

      const { dueAt: dueAtRaw } = request.body ?? {};
      let dueAt: Date | null = null;
      if (dueAtRaw !== null && dueAtRaw !== undefined) {
        const parsed = new Date(dueAtRaw);
        if (isNaN(parsed.getTime())) {
          return reply.status(400).send({ error: 'Bad Request', code: 'INVALID_DATE', message: 'dueAt must be a valid ISO date string or null' });
        }
        dueAt = parsed;
      }

      try {
        await setUserDueAt(userId, rawId, dueAt);
        return reply.send({});
      } catch (err) {
        const code = (err as NodeJS.ErrnoException & { code?: string }).code;
        if (code === 'ITEM_NOT_FOUND') return reply.status(404).send({ error: 'Not Found', code, message: (err as Error).message });
        throw err;
      }
    }
  );

  // T014 — PATCH /api/feed/items/:itemId/description-override
  app.patch(
    '/api/feed/items/:itemId/description-override',
    async (
      request: FastifyRequest<{ Params: { itemId: string }; Body: { value: string | null } }>,
      reply
    ) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const { itemId } = request.params;
      const [type, rawId] = itemId.split(':');

      if (!type || !rawId || type !== 'sync') {
        return reply.status(400).send({
          error: 'Bad Request',
          code: 'INVALID_ITEM_ID',
          message: 'Description override is only supported for synced items (sync: prefix)',
        });
      }

      const { value } = request.body ?? {};

      if (value !== null && value !== undefined) {
        if (typeof value !== 'string' || value.trim().length === 0) {
          return reply.status(400).send({
            error: 'Bad Request',
            code: 'INVALID_VALUE',
            message: 'value must be a non-empty string or null',
          });
        }
        if (value.length > 50000) {
          return reply.status(400).send({
            error: 'Bad Request',
            code: 'VALUE_TOO_LONG',
            message: 'value must not exceed 50000 characters',
          });
        }
      }

      try {
        const result = await setDescriptionOverride(userId, rawId, value ?? null);
        return reply.send(result);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException & { code?: string }).code;
        if (code === 'ITEM_NOT_FOUND') return reply.status(404).send({ error: 'Not Found', code, message: (err as Error).message });
        throw err;
      }
    }
  );
}

