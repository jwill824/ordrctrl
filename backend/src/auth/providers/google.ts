import { Issuer, generators, type Client } from 'openid-client';
import { logger } from '../../lib/logger.js';

let googleClient: Client | null = null;

export async function getGoogleClient(): Promise<Client> {
  if (googleClient) return googleClient;

  const googleIssuer = await Issuer.discover('https://accounts.google.com');

  googleClient = new googleIssuer.Client({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uris: [`${process.env.API_URL}/api/auth/google/callback`],
    response_types: ['code'],
  });

  return googleClient;
}

export function generateOAuthState(): string {
  return generators.state();
}

export async function getGoogleAuthorizationUrl(state: string): Promise<string> {
  const client = await getGoogleClient();
  return client.authorizationUrl({
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'consent',
  });
}

export async function exchangeGoogleCode(
  code: string,
  state: string,
  expectedState: string
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

  const client = await getGoogleClient();
  const params = client.callbackParams(`?code=${code}&state=${state}`);

  const tokenSet = await client.callback(
    `${process.env.API_URL}/api/auth/google/callback`,
    params,
    { state: expectedState }
  );

  const userinfo = await client.userinfo(tokenSet);

  return {
    sub: userinfo.sub,
    email: userinfo.email!,
    name: userinfo.name,
    accessToken: tokenSet.access_token!,
    refreshToken: tokenSet.refresh_token,
    expiresAt: tokenSet.expires_at
      ? new Date(tokenSet.expires_at * 1000)
      : undefined,
  };
}
