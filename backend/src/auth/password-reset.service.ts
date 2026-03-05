import crypto from 'crypto';
import { prisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { sendPasswordResetEmail } from '../lib/email.js';

const TOKEN_EXPIRY_HOURS = 1;

/**
 * Request a password reset for the given email.
 * Always returns successfully to prevent email enumeration.
 * FR-005
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  // Silently succeed if user not found (prevent enumeration)
  if (!user || !user.passwordHash) {
    logger.info('Password reset requested for unknown/social user', {});
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: token,
      passwordResetExpiry: expiry,
    },
  });

  await sendPasswordResetEmail(user.email, token);
  logger.info('Password reset email sent', { userId: user.id });
}

/**
 * Validate a password reset token.
 * Returns userId if valid and not expired.
 */
export async function validatePasswordResetToken(token: string): Promise<string> {
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpiry: { gt: new Date() },
    },
  });

  if (!user) {
    const err = Object.assign(new Error('Invalid or expired reset token'), { statusCode: 410 });
    throw err;
  }

  return user.id;
}

/**
 * Update password after reset token validation.
 * FR-005
 */
export async function resetPassword(token: string, newPassword: string): Promise<string> {
  const userId = await validatePasswordResetToken(token);

  const { authService } = await import('./auth.service.js');
  const passwordHash = await authService.hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiry: null,
      loginAttempts: 0,
      lockedUntil: null,
    },
  });

  logger.info('Password reset completed', { userId });
  return userId;
}
