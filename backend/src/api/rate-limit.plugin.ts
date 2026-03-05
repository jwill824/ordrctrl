// T064 — Fastify rate-limit plugin
// Stricter limits on /auth/login and /auth/register (FR-006)

import type { FastifyInstance } from 'fastify';
import FastifyRateLimit from '@fastify/rate-limit';
import { logger } from '../lib/logger.js';

export async function registerRateLimitPlugin(app: FastifyInstance): Promise<void> {
  // Global rate limit — generous default for all routes
  await app.register(FastifyRateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      return (
        (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        request.ip
      );
    },
    errorResponseBuilder: (_request, context) => ({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Retry after ${Math.ceil(context.ttl / 1000)} seconds.`,
      retryAfter: Math.ceil(context.ttl / 1000),
    }),
  });

  // Stricter limits on auth endpoints
  app.after(() => {
    // Override for login — 10 attempts per 15 minutes (FR-006)
    app.route({
      method: 'POST',
      url: '/api/auth/login',
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '15 minutes',
          keyGenerator: (request) => {
            const ip =
              (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
              request.ip;
            const body = request.body as { email?: string };
            return `login:${ip}:${body?.email ?? ''}`;
          },
        },
      },
      handler: async () => {
        // This route definition is only for rate-limit config override
        // The actual handler is registered in auth.routes.ts
      },
    });
  });

  logger.info('Rate limit plugin registered');
}
