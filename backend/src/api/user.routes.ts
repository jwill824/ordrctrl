// T020 — User settings API routes
// GET /api/user/settings
// PATCH /api/user/settings

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getUserSettings, updateUserSettings } from '../user/user.service.js';

function requireAuth(request: FastifyRequest, reply: FastifyReply): string | null {
  const userId = request.session.userId;
  if (!userId) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Not authenticated' });
    return null;
  }
  return userId;
}

const patchSettingsSchema = z.object({
  autoClearEnabled: z.boolean().optional(),
  autoClearWindowDays: z.number().int().min(1).max(365).optional(),
});

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/user/settings
  app.get('/api/user/settings', async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    const settings = await getUserSettings(userId);
    return reply.status(200).send(settings);
  });

  // PATCH /api/user/settings
  app.patch('/api/user/settings', async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    const result = patchSettingsSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Validation failed', details: result.error.errors });
    }

    const settings = await updateUserSettings(userId, result.data);
    return reply.status(200).send(settings);
  });
}
