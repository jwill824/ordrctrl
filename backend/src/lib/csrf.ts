// T065 — CSRF state parameter validation utility
// Used by all OAuth callback routes

import crypto from 'crypto';

const STATE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generate a cryptographically secure OAuth state parameter.
 */
export function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate that the returned state matches the session state.
 * Throws on mismatch (potential CSRF attack).
 */
export function validateState(
  returnedState: string | undefined,
  sessionState: string | undefined
): void {
  if (!returnedState || !sessionState) {
    throw new Error('Missing OAuth state parameter');
  }
  if (!crypto.timingSafeEqual(
    Buffer.from(returnedState),
    Buffer.from(sessionState)
  )) {
    throw new Error('OAuth state mismatch — possible CSRF attack');
  }
}
