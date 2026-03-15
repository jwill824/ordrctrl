import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authService } from '../auth/auth.service.js';
import { requestPasswordReset, resetPassword } from '../auth/password-reset.service.js';
import {
  getGoogleAuthorizationUrl,
  exchangeGoogleCode,
  generateOAuthState,
} from '../auth/providers/google.js';
import {
  getAppleAuthorizationUrl,
  exchangeAppleCode,
} from '../auth/providers/apple.js';
import { setOAuthState, getAndDeleteOAuthState, type OAuthStateEntry } from '../auth/oauth-state.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/db.js';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number'),
});

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/auth/register
  app.post('/api/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = registerSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(422).send({
        error: 'Validation Error',
        message: 'Invalid email or password format',
        details: result.error.flatten(),
      });
    }

    try {
      await authService.register(result.data);
      return reply.status(201).send({
        message: 'Verification email sent. Please check your inbox.',
      });
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number };
      return reply.status(e.statusCode || 500).send({
        error: e.message,
        message: e.message,
      });
    }
  });

  // POST /api/auth/verify-email
  app.post('/api/auth/verify-email', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = verifyEmailSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid token' });
    }

    try {
      const user = await authService.verifyEmail(result.data.token);
      (request.session as any).userId = user.id;
      return reply.send({ user });
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number };
      return reply.status(e.statusCode || 400).send({ error: e.message });
    }
  });

  // POST /api/auth/login
  app.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = loginSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(422).send({ error: 'Validation Error', message: 'Invalid input' });
    }

    try {
      const user = await authService.login(result.data);
      (request.session as any).userId = user.id;
      return reply.send({
        user: { id: user.id, email: user.email, emailVerified: user.emailVerified },
        hasIntegrations: user.hasIntegrations,
      });
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number };
      return reply.status(e.statusCode || 401).send({ error: e.message, message: e.message });
    }
  });

  // POST /api/auth/logout
  app.post('/api/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.session as any;
    if (!session.userId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }
    await request.session.destroy();
    return reply.status(204).send();
  });

  // POST /api/auth/forgot-password
  app.post('/api/auth/forgot-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = forgotPasswordSchema.safeParse(request.body);
    if (!result.success) {
      return reply.send({ message: 'If that email exists, a reset link has been sent.' });
    }

    await requestPasswordReset(result.data.email);
    return reply.send({ message: 'If that email exists, a reset link has been sent.' });
  });

  // POST /api/auth/reset-password
  app.post('/api/auth/reset-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = resetPasswordSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(422).send({
        error: 'Validation Error',
        message: 'Invalid input',
        details: result.error.flatten(),
      });
    }

    try {
      const userId = await resetPassword(result.data.token, result.data.password);
      (request.session as any).userId = userId;
      return reply.send({ message: 'Password updated successfully.' });
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number };
      return reply.status(e.statusCode || 400).send({ error: e.message });
    }
  });

  // GET /api/auth/me
  app.get('/api/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request.session as any).userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailVerified: true },
    });
    if (!user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    return reply.send(user);
  });

  // GET /api/auth/google — initiate Google OAuth
  app.get('/api/auth/google', async (request: FastifyRequest, reply: FastifyReply) => {
    const { platform } = request.query as { platform?: string };
    const state = generateOAuthState();
    await setOAuthState(state, { platform: (platform ?? 'web') as OAuthStateEntry['platform'] });
    const authUrl = await getGoogleAuthorizationUrl(state);
    return reply.redirect(authUrl);
  });

  // GET /api/auth/google/callback
  app.get('/api/auth/google/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state } = request.query as { code?: string; state?: string };
    const entry = await getAndDeleteOAuthState(state ?? '');
    const isNative = entry ? ['tauri', 'capacitor'].includes(entry.platform) : false;

    if (!code || !state || !entry) {
      const dest = isNative
        ? 'ordrctrl://auth/callback?status=error&error=invalid_state'
        : `${process.env.APP_URL}/login?error=oauth&reason=invalid_state`;
      return reply.redirect(dest);
    }

    try {
      const profile = await exchangeGoogleCode(code, state, state);
      const user = await authService.socialLogin({
        email: profile.email,
        providerAccountId: profile.sub,
        provider: 'google',
        accessToken: profile.accessToken,
        refreshToken: profile.refreshToken,
        expiresAt: profile.expiresAt,
      });

      (request.session as any).userId = user.id;

      if (isNative) {
        return reply.redirect(
          user.isNewUser
            ? 'ordrctrl://auth/callback?status=success&next=onboarding'
            : 'ordrctrl://auth/callback?status=success'
        );
      }

      return reply.redirect(
        user.isNewUser
          ? `${process.env.APP_URL}/onboarding`
          : `${process.env.APP_URL}/feed`
      );
    } catch (err) {
      logger.error('Google OAuth callback error', { error: (err as Error).message });
      const dest = isNative
        ? 'ordrctrl://auth/callback?status=error&error=server_error'
        : `${process.env.APP_URL}/login?error=oauth&reason=server_error`;
      return reply.redirect(dest);
    }
  });

  // GET /api/auth/apple — initiate Apple OAuth
  app.get('/api/auth/apple', async (request: FastifyRequest, reply: FastifyReply) => {
    const { platform } = request.query as { platform?: string };
    const state = generateOAuthState();
    await setOAuthState(state, { platform: (platform ?? 'web') as OAuthStateEntry['platform'] });
    const authUrl = await getAppleAuthorizationUrl(state);
    return reply.redirect(authUrl);
  });

  // POST /api/auth/apple/callback (Apple uses POST)
  app.post('/api/auth/apple/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      code?: string;
      state?: string;
      user?: string;
    };

    const code = body.code;
    const state = body.state;
    const entry = await getAndDeleteOAuthState(state ?? '');
    const isNative = entry ? ['tauri', 'capacitor'].includes(entry.platform) : false;

    if (!code || !state || !entry) {
      const dest = isNative
        ? 'ordrctrl://auth/callback?status=error&error=invalid_state'
        : `${process.env.APP_URL}/login?error=oauth&reason=invalid_state`;
      return reply.redirect(dest);
    }

    let userPayload: { name?: { firstName?: string; lastName?: string }; email?: string } | undefined;
    if (body.user) {
      try {
        userPayload = JSON.parse(body.user);
      } catch {
        // ignore parse errors
      }
    }

    try {
      const profile = await exchangeAppleCode(code, state, state, userPayload);
      const user = await authService.socialLogin({
        email: profile.email,
        providerAccountId: profile.sub,
        provider: 'apple',
        accessToken: profile.accessToken,
        refreshToken: profile.refreshToken,
        expiresAt: profile.expiresAt,
      });

      (request.session as any).userId = user.id;

      if (isNative) {
        return reply.redirect(
          user.isNewUser
            ? 'ordrctrl://auth/callback?status=success&next=onboarding'
            : 'ordrctrl://auth/callback?status=success'
        );
      }

      return reply.redirect(
        user.isNewUser
          ? `${process.env.APP_URL}/onboarding`
          : `${process.env.APP_URL}/feed`
      );
    } catch (err) {
      logger.error('Apple OAuth callback error', { error: (err as Error).message });
      const dest = isNative
        ? 'ordrctrl://auth/callback?status=error&error=server_error'
        : `${process.env.APP_URL}/login?error=oauth&reason=server_error`;
      return reply.redirect(dest);
    }
  });
}
