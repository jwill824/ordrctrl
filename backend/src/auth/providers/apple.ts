import { Issuer, generators, type Client } from 'openid-client';
import crypto from 'crypto';
import { logger } from '../../lib/logger.js';

let appleClient: Client | null = null;

export async function getAppleClient(): Promise<Client> {
  if (appleClient) return appleClient;

  const appleIssuer = await Issuer.discover('https://appleid.apple.com');

  appleClient = new appleIssuer.Client({
    client_id: process.env.APPLE_CLIENT_ID!,
    redirect_uris: [`${process.env.API_URL}/api/auth/apple/callback`],
    response_types: ['code'],
    token_endpoint_auth_method: 'private_key_jwt',
  });

  return appleClient;
}

export function generateOAuthState(): string {
  return generators.state();
}

export async function getAppleAuthorizationUrl(state: string): Promise<string> {
  const client = await getAppleClient();
  return client.authorizationUrl({
    scope: 'openid email name',
    state,
    response_mode: 'form_post',
  });
}

export async function exchangeAppleCode(
  code: string,
  state: string,
  expectedState: string,
  userPayload?: { name?: { firstName?: string; lastName?: string }; email?: string }
): Promise<{
  sub: string;
  email: string;
  name?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}> {
  if (state !== expectedState) {
    throw new Error('OAuth state mismatch — possible CSRF attack');
  }

  const client = await getAppleClient();

  // Build client secret (JWT signed with Apple private key)
  const privateKey = process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n');
  const teamId = process.env.APPLE_TEAM_ID!;
  const keyId = process.env.APPLE_KEY_ID!;
  const clientId = process.env.APPLE_CLIENT_ID!;

  // Create client secret JWT
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: teamId,
      iat: now,
      exp: now + 86400,
      aud: 'https://appleid.apple.com',
      sub: clientId,
    })
  ).toString('base64url');

  const signingInput = `${header}.${payload}`;
  const sign = crypto.createSign('SHA256');
  sign.update(signingInput);
  const signature = sign.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' }, 'base64url');
  const clientSecret = `${signingInput}.${signature}`;

  const tokenSet = await client.callback(
    `${process.env.API_URL}/api/auth/apple/callback`,
    { code, state },
    { state: expectedState },
    { clientAssertionPayload: { sub: clientId }, exchangeBody: { client_secret: clientSecret } }
  );

  // Apple only provides email on first login; may come from userPayload
  const email = userPayload?.email || (tokenSet.claims()?.email as string) || '';
  const firstName = userPayload?.name?.firstName;
  const lastName = userPayload?.name?.lastName;
  const name = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName;

  return {
    sub: tokenSet.claims().sub,
    email,
    name,
    accessToken: tokenSet.access_token!,
    refreshToken: tokenSet.refresh_token,
    expiresAt: tokenSet.expires_at ? new Date(tokenSet.expires_at * 1000) : undefined,
  };
}
