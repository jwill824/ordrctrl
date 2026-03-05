import Fastify, { type FastifyInstance } from 'fastify';
import FastifyCors from '@fastify/cors';
import FastifyCookie from '@fastify/cookie';
import FastifySensible from '@fastify/sensible';
import { registerSessionPlugin } from './auth/session.plugin.js';
import { registerAuthRoutes } from './api/auth.routes.js';
import { registerIntegrationRoutes } from './api/integrations.routes.js';
import { registerFeedRoutes } from './api/feed.routes.js';
import { registerTaskRoutes } from './api/tasks.routes.js';
import { errorHandler, notFoundHandler } from './api/error-handler.js';

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    trustProxy: true,
  });

  // CORS
  await app.register(FastifyCors, {
    origin: process.env.APP_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Cookie support
  await app.register(FastifyCookie);

  // Sensible defaults
  await app.register(FastifySensible);

  // Session (Redis-backed)
  await registerSessionPlugin(app);

  // Health check
  app.get('/healthz', async (_request, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Auth routes
  await registerAuthRoutes(app);

  // Integration routes (Phase 4)
  await registerIntegrationRoutes(app);

  // Feed routes (Phase 5)
  await registerFeedRoutes(app);

  // Native task routes (Phase 6)
  await registerTaskRoutes(app);

  // Error handlers
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  return app;
}
