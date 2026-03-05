import bcrypt from 'bcryptjs';
import { prisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { sendVerificationEmail } from '../lib/email.js';
import { issueVerificationToken } from './verification.service.js';
import type { AuthProvider } from '@prisma/client';

const SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface RegisterInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

export interface SocialLoginInput {
  email: string;
  providerAccountId: string;
  provider: AuthProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export class AuthService {
  /**
   * Register a new email/password account.
   * FR-001, FR-002
   */
  async register(input: RegisterInput): Promise<{ userId: string }> {
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existing) {
      const error = new Error('Email already registered') as Error & { statusCode: number };
      error.statusCode = 409;
      throw error;
    }

    const passwordHash = await this.hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        authProvider: 'email',
        emailVerified: false,
      },
    });

    logger.info('User registered', { userId: user.id });

    // Issue verification token and send email
    const token = await issueVerificationToken(user.id);
    await sendVerificationEmail(user.email, token);

    return { userId: user.id };
  }

  /**
   * Verify email with token.
   * FR-003
   */
  async verifyEmail(token: string): Promise<AuthUser> {
    const user = await prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });

    if (!user) {
      const error = new Error('Invalid or already used token') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
      },
    });

    logger.info('Email verified', { userId: user.id });

    return {
      id: updated.id,
      email: updated.email,
      emailVerified: updated.emailVerified,
    };
  }

  /**
   * Authenticate with email and password.
   * FR-004, FR-006, FR-007
   */
  async login(input: LoginInput): Promise<AuthUser & { hasIntegrations: boolean }> {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: {
        integrations: {
          where: { status: { not: 'disconnected' } },
          take: 1,
        },
      },
    });

    if (!user) {
      const error = new Error('Invalid credentials') as Error & { statusCode: number };
      error.statusCode = 401;
      throw error;
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const error = new Error('Account temporarily locked due to too many failed attempts') as Error & { statusCode: number };
      error.statusCode = 429;
      throw error;
    }

    // Require password (social-only accounts cannot use password login)
    if (!user.passwordHash) {
      const error = new Error('Invalid credentials') as Error & { statusCode: number };
      error.statusCode = 401;
      throw error;
    }

    const passwordValid = await this.validatePassword(input.password, user.passwordHash);

    if (!passwordValid) {
      // Increment login attempts
      const newAttempts = user.loginAttempts + 1;
      const lockData =
        newAttempts >= MAX_LOGIN_ATTEMPTS
          ? { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) }
          : {};

      await prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: newAttempts, ...lockData },
      });

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const error = new Error('Too many failed attempts — account locked for 15 minutes') as Error & { statusCode: number };
        error.statusCode = 429;
        throw error;
      }

      const error = new Error('Invalid credentials') as Error & { statusCode: number };
      error.statusCode = 401;
      throw error;
    }

    // Check email verification
    if (!user.emailVerified) {
      const error = new Error('Please verify your email before logging in') as Error & { statusCode: number };
      error.statusCode = 403;
      throw error;
    }

    // Reset login attempts on success
    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null },
    });

    logger.info('User logged in', { userId: user.id });

    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      hasIntegrations: user.integrations.length > 0,
    };
  }

  /**
   * Find or create a user from a social login (Google/Apple).
   * FR-008
   */
  async socialLogin(input: SocialLoginInput): Promise<AuthUser & { isNewUser: boolean }> {
    // Try to find by provider account ID first
    let user = await prisma.user.findFirst({
      where: {
        providerAccountId: input.providerAccountId,
        authProvider: input.provider,
      },
    });

    if (!user) {
      // Try to find by email (link accounts)
      user = await prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
      });
    }

    const isNewUser = !user;

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: input.email.toLowerCase(),
          authProvider: input.provider,
          providerAccountId: input.providerAccountId,
          emailVerified: true, // Social logins are pre-verified
          passwordHash: null,
        },
      });
      logger.info('Social login: new user created', { userId: user.id, provider: input.provider });
    } else {
      // Update provider info if linking
      await prisma.user.update({
        where: { id: user.id },
        data: {
          providerAccountId: input.providerAccountId,
          emailVerified: true,
        },
      });
      logger.info('Social login: existing user', { userId: user.id, provider: input.provider });
    }

    return {
      id: user.id,
      email: user.email,
      emailVerified: true,
      isNewUser,
    };
  }

  /**
   * Hash a password with bcrypt.
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Compare a password against a bcrypt hash.
   */
  async validatePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

export const authService = new AuthService();
