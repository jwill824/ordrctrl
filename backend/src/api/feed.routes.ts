// T050 — Feed API routes
// GET /api/feed
// PATCH /api/feed/items/:itemId/complete
// (POST /api/integrations/sync is in integrations.routes.ts)

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  buildFeed,
  completeSyncItem,
  completeNativeTask,
  uncompleteNativeTask,
  uncompleteSyncItem,
} from '../feed/feed.service.js';
import { logger } from '../lib/logger.js';

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
      request: FastifyRequest<{ Querystring: { includeCompleted?: string } }>,
      reply
    ) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

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
}
