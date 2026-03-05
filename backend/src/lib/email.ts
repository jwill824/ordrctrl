import { Resend } from 'resend';
import { logger } from './logger.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'noreply@ordrctrl.local';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sends an email verification link to a new user.
 */
export async function sendVerificationEmail(
  to: string,
  token: string
): Promise<SendResult> {
  const verifyUrl = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`;

  // In test/dev mode, log the URL instead of sending
  if (process.env.RESEND_API_KEY === 'test' || !process.env.RESEND_API_KEY) {
    logger.info('DEV: Verification email (not sent)', { to, verifyUrl });
    return { success: true, messageId: 'dev-mode' };
  }

  try {
    const result = await resend.emails.send({
      from: FROM,
      to,
      subject: 'Verify your ordrctrl account',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Welcome to ordrctrl</h1>
          <p>Click the link below to verify your email address:</p>
          <a href="${verifyUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
            Verify Email
          </a>
          <p style="margin-top: 16px; color: #666; font-size: 14px;">
            This link expires in 24 hours. If you didn't create an account, ignore this email.
          </p>
        </div>
      `,
      text: `Welcome to ordrctrl. Verify your email: ${verifyUrl}\n\nThis link expires in 24 hours.`,
    });

    return { success: true, messageId: result.data?.id };
  } catch (err) {
    logger.error('Failed to send verification email', { error: (err as Error).message });
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Sends a password reset link.
 */
export async function sendPasswordResetEmail(
  to: string,
  token: string
): Promise<SendResult> {
  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;

  if (process.env.RESEND_API_KEY === 'test' || !process.env.RESEND_API_KEY) {
    logger.info('DEV: Password reset email (not sent)', { to, resetUrl });
    return { success: true, messageId: 'dev-mode' };
  }

  try {
    const result = await resend.emails.send({
      from: FROM,
      to,
      subject: 'Reset your ordrctrl password',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Reset your password</h1>
          <p>Click the link below to set a new password:</p>
          <a href="${resetUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
            Reset Password
          </a>
          <p style="margin-top: 16px; color: #666; font-size: 14px;">
            This link expires in 1 hour. If you didn't request a reset, ignore this email.
          </p>
        </div>
      `,
      text: `Reset your ordrctrl password: ${resetUrl}\n\nThis link expires in 1 hour.`,
    });

    return { success: true, messageId: result.data?.id };
  } catch (err) {
    logger.error('Failed to send password reset email', { error: (err as Error).message });
    return { success: false, error: (err as Error).message };
  }
}
