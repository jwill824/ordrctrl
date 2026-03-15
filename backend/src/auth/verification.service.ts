import crypto from 'crypto';
import { prisma } from '../lib/db.js';

/**
 * Issue a new email verification token for the given user.
 * Stores the token in the User record.
 */
export async function issueVerificationToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');

  await prisma.user.update({
    where: { id: userId },
    data: { emailVerifyToken: token },
  });

  return token;
}

/**
 * Validate an email verification token.
 * Returns the userId if valid, throws if invalid or expired.
 */
export async function validateVerificationToken(token: string): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { emailVerifyToken: token },
  });

  if (!user) {
    const error = new Error('Invalid or already used verification token') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  return user.id;
}

/**
 * Expire (clear) a verification token after use.
 */
export async function expireVerificationToken(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerifyToken: null },
  });
}
