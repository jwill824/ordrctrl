// T058 — Native tasks API routes
// POST /api/tasks
// PATCH /api/tasks/:id
// DELETE /api/tasks/:id

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  createTask,
  updateTask,
  deleteTask,
} from '../tasks/task.service.js';

function requireAuth(request: FastifyRequest, reply: FastifyReply): string | null {
  const userId = request.session.userId;
  if (!userId) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Not authenticated' });
    return null;
  }
  return userId;
}

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  dueAt: z.string().datetime().optional().nullable(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  dueAt: z.string().datetime().optional().nullable(),
});

export async function registerTaskRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/tasks
  app.post('/api/tasks', async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    const result = createTaskSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(422).send({
        error: 'Validation Error',
        details: result.error.flatten(),
      });
    }

    const { title, dueAt } = result.data;
    const task = await createTask(userId, {
      title,
      dueAt: dueAt ? new Date(dueAt) : null,
    });

    return reply.status(201).send(task);
  });

  // PATCH /api/tasks/:id
  app.patch(
    '/api/tasks/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const { id } = request.params;

      const result = updateTaskSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(422).send({
          error: 'Validation Error',
          details: result.error.flatten(),
        });
      }

      const { title, dueAt } = result.data;

      try {
        const task = await updateTask(userId, id, {
          ...(title !== undefined && { title }),
          ...(dueAt !== undefined && { dueAt: dueAt ? new Date(dueAt) : null }),
        });
        return reply.send(task);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('not found')) {
          return reply.status(404).send({ error: 'Not Found', message: msg });
        }
        throw err;
      }
    }
  );

  // DELETE /api/tasks/:id
  app.delete(
    '/api/tasks/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const userId = requireAuth(request, reply);
      if (!userId) return;

      const { id } = request.params;

      try {
        await deleteTask(userId, id);
        return reply.status(204).send();
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('not found')) {
          return reply.status(404).send({ error: 'Not Found', message: msg });
        }
        throw err;
      }
    }
  );
}
