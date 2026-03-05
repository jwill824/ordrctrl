import type { FastifyInstance } from 'fastify';
import FastifySession from '@fastify/session';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

// Simple Redis session store implementation compatible with @fastify/session
class RedisSessionStore {
  private prefix = 'session:';
  private ttl: number;

  constructor(ttl = 7 * 24 * 60 * 60) {
    this.ttl = ttl; // in seconds
  }

  async get(
    sessionId: string,
    callback: (err: Error | null, session?: Record<string, unknown> | null) => void
  ): Promise<void> {
    try {
      const data = await redis.get(`${this.prefix}${sessionId}`);
      if (!data) {
        callback(null, null);
        return;
      }
      callback(null, JSON.parse(data));
    } catch (err) {
      logger.error('Session store get error', { error: (err as Error).message });
      callback(err as Error);
    }
  }

  async set(
    sessionId: string,
    session: Record<string, unknown>,
    callback: (err?: Error | null) => void
  ): Promise<void> {
    try {
      await redis.setex(
        `${this.prefix}${sessionId}`,
        this.ttl,
        JSON.stringify(session)
      );
      callback(null);
    } catch (err) {
      logger.error('Session store set error', { error: (err as Error).message });
      callback(err as Error);
    }
  }

  async destroy(sessionId: string, callback: (err?: Error | null) => void): Promise<void> {
    try {
      await redis.del(`${this.prefix}${sessionId}`);
      callback(null);
    } catch (err) {
      logger.error('Session store destroy error', { error: (err as Error).message });
      callback(err as Error);
    }
  }
}

export async function registerSessionPlugin(app: FastifyInstance): Promise<void> {
  await app.register(FastifySession, {
    secret: process.env.SESSION_SECRET || 'fallback-dev-secret-change-in-production',
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    },
    store: new RedisSessionStore() as any,
    saveUninitialized: false,
  });
}

// Session type augmentation
declare module '@fastify/session' {
  interface FastifySessionObject {
    userId?: string;
    oauthState?: string;
    gmailSyncMode?: string;
  }
}
