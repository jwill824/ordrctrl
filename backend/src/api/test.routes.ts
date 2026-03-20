// Test-only routes — only registered when ENABLE_TEST_ROUTES=true.
// NEVER enable in production.
//
// POST   /api/test/create-user  — creates a pre-verified test user
// DELETE /api/test/delete-user  — deletes a test user by email

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';

const SALT_ROUNDS = 12;

const createUserSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number'),
});

const deleteUserSchema = z.object({
  email: z.string().email(),
});

export async function registerTestRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/test/create-user
  app.post('/api/test/create-user', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = createUserSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(422).send({ error: 'Validation Error', details: result.error.flatten() });
    }

    const { email, password } = result.data;
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        authProvider: 'email',
        emailVerified: true,
      },
    });

    logger.info('[test] Created test user', { userId: user.id, email: user.email });
    return reply.status(201).send({ email: user.email });
  });

  // DELETE /api/test/delete-user
  app.delete('/api/test/delete-user', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = deleteUserSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(422).send({ error: 'Validation Error', details: result.error.flatten() });
    }

    const { email } = result.data;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    await prisma.user.delete({ where: { id: user.id } });
    logger.info('[test] Deleted test user', { userId: user.id, email: user.email });
    return reply.status(204).send();
  });

  // POST /api/test/cleanup — deletes all users with @ordrctrl.test emails (orphan cleanup)
  app.post('/api/test/cleanup', async (_request: FastifyRequest, reply: FastifyReply) => {
    const deleted = await prisma.user.deleteMany({
      where: { email: { endsWith: '@ordrctrl.test' } },
    });
    logger.info('[test] Cleaned up test users', { count: deleted.count });
    return reply.status(200).send({ deleted: deleted.count });
  });
}
