// T037 — Apple Calendar Integration Adapter
// Uses Sign in with Apple OAuth + iCloud CalDAV VEVENT for calendar events

import { prisma } from '../../lib/db.js';
import { encrypt, decrypt } from '../../lib/encryption.js';
import { logger } from '../../lib/logger.js';
import {
  type IntegrationAdapter,
  type NormalizedItem,
  type ConnectOptions,
  TokenRefreshError,
} from '../_adapter/types.js';

const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';
const CALDAV_BASE = 'https://caldav.icloud.com';

async function buildAppleClientSecret(
  env: Record<'key' | 'keyId' | 'teamId' | 'clientId', string>
): Promise<string> {
  const { SignJWT } = await import('jose');
  const { createPrivateKey } = await import('crypto');
  const privateKey = createPrivateKey({ key: env.key, format: 'pem' });
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: env.keyId })
    .setIssuedAt()
    .setIssuer(env.teamId)
    .setAudience('https://appleid.apple.com')
    .setSubject(env.clientId)
    .setExpirationTime('1h')
    .sign(privateKey);
}

function getEnvConfig() {
  return {
    key: process.env.APPLE_CALENDAR_PRIVATE_KEY!,
    keyId: process.env.APPLE_CALENDAR_KEY_ID!,
    teamId: process.env.APPLE_CALENDAR_TEAM_ID!,
    clientId: process.env.APPLE_CALENDAR_CLIENT_ID!,
  };
}

export class AppleCalendarAdapter implements IntegrationAdapter {
  readonly serviceId = 'apple_calendar' as const;

  async getAuthorizationUrl(state: string, _options?: ConnectOptions): Promise<string> {
    const { clientId } = getEnvConfig();
    const redirectUri = encodeURIComponent(
      `${process.env.API_URL}/api/integrations/apple_calendar/callback`
    );
    const scope = encodeURIComponent('name email');
    return (
      `https://appleid.apple.com/auth/authorize?response_type=code` +
      `&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=${scope}&response_mode=form_post`
    );
  }

  async connect(
    userId: string,
    authCode: string,
    _options?: ConnectOptions
  ): Promise<{ integrationId: string }> {
    const env = getEnvConfig();
    const redirectUri = `${process.env.API_URL}/api/integrations/apple_calendar/callback`;
    const clientSecret = await buildAppleClientSecret(env);

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      client_id: env.clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    const res = await fetch(APPLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      throw new Error(`Apple Calendar token exchange failed: ${await res.text()}`);
    }

    const tokenData = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    const integration = await prisma.integration.upsert({
      where: { userId_serviceId: { userId, serviceId: 'apple_calendar' } },
      create: {
        userId,
        serviceId: 'apple_calendar',
        status: 'connected',
        encryptedAccessToken: encrypt(tokenData.access_token),
        encryptedRefreshToken: tokenData.refresh_token
          ? encrypt(tokenData.refresh_token)
          : null,
        tokenExpiresAt: expiresAt,
        lastSyncError: null,
      },
      update: {
        status: 'connected',
        encryptedAccessToken: encrypt(tokenData.access_token),
        encryptedRefreshToken: tokenData.refresh_token
          ? encrypt(tokenData.refresh_token)
          : null,
        tokenExpiresAt: expiresAt,
        lastSyncError: null,
      },
    });

    return { integrationId: integration.id };
  }

  async disconnect(integrationId: string): Promise<void> {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });
    if (!integration) return;

    if (integration.encryptedRefreshToken) {
      try {
        const env = getEnvConfig();
        const clientSecret = await buildAppleClientSecret(env);
        const refreshToken = decrypt(integration.encryptedRefreshToken);
        const params = new URLSearchParams({
          client_id: env.clientId,
          client_secret: clientSecret,
          token: refreshToken,
          token_type_hint: 'refresh_token',
        });
        await fetch(APPLE_REVOKE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });
      } catch (err) {
        logger.warn('Apple Calendar token revocation failed', {
          integrationId,
          error: (err as Error).message,
        });
      }
    }

    await prisma.$transaction([
      prisma.syncCacheItem.deleteMany({ where: { integrationId } }),
      prisma.integration.update({
        where: { id: integrationId },
        data: {
          status: 'disconnected',
          encryptedAccessToken: '',
          encryptedRefreshToken: null,
          tokenExpiresAt: null,
        },
      }),
    ]);
  }

  async sync(integrationId: string): Promise<NormalizedItem[]> {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });
    if (!integration || integration.status !== 'connected') return [];

    const accessToken = decrypt(integration.encryptedAccessToken);

    try {
      // Query upcoming calendar events (next 30 days) via CalDAV REPORT
      const now = new Date();
      const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const toCalDAVDate = (d: Date) =>
        d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

      const reportBody = `<?xml version="1.0" encoding="UTF-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${toCalDAVDate(now)}" end="${toCalDAVDate(future)}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

      const calRes = await fetch(`${CALDAV_BASE}/`, {
        method: 'REPORT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/xml; charset=utf-8',
          Depth: '1',
        },
        body: reportBody,
      });

      if (!calRes.ok) return [];

      const calText = await calRes.text();
      return parseVEventItems(calText);
    } catch (err) {
      logger.error('Apple Calendar sync error', {
        integrationId,
        error: (err as Error).message,
      });
      return [];
    }
  }

  async refreshToken(integrationId: string): Promise<void> {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });
    if (!integration?.encryptedRefreshToken) {
      throw new TokenRefreshError(integrationId, 'No refresh token stored');
    }

    try {
      const env = getEnvConfig();
      const clientSecret = await buildAppleClientSecret(env);
      const refreshToken = decrypt(integration.encryptedRefreshToken);

      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: env.clientId,
        client_secret: clientSecret,
      });

      const res = await fetch(APPLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!res.ok) {
        throw new Error(`Token refresh failed: ${await res.text()}`);
      }

      const tokenData = (await res.json()) as {
        access_token: string;
        expires_in?: number;
      };

      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          encryptedAccessToken: encrypt(tokenData.access_token),
          tokenExpiresAt: tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : null,
        },
      });
    } catch (err) {
      throw new TokenRefreshError(integrationId, (err as Error).message);
    }
  }
}

function parseVEventItems(xmlText: string): NormalizedItem[] {
  const items: NormalizedItem[] = [];

  const calDataMatches = xmlText.matchAll(
    /<cal:calendar-data[^>]*>([\s\S]*?)<\/cal:calendar-data>/gi
  );

  for (const match of calDataMatches) {
    const calData = match[1].replace(/&#13;/g, '').replace(/\r/g, '');

    const uidMatch = calData.match(/^UID:(.+)$/m);
    const summaryMatch = calData.match(/^SUMMARY:(.+)$/m);
    const dtStartMatch = calData.match(/^DTSTART(?:;[^:]*)?:(\d{8}(?:T\d{6}Z?)?)/m);
    const dtEndMatch = calData.match(/^DTEND(?:;[^:]*)?:(\d{8}(?:T\d{6}Z?)?)/m);

    if (!uidMatch || !summaryMatch) continue;

    const externalId = uidMatch[1].trim();
    const title = summaryMatch[1].trim();

    const parseICalDate = (s: string): Date | null => {
      try {
        if (s.length === 8) {
          return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
        }
        return new Date(s);
      } catch {
        return null;
      }
    };

    const startAt = dtStartMatch ? parseICalDate(dtStartMatch[1]) : null;
    const endAt = dtEndMatch ? parseICalDate(dtEndMatch[1]) : null;

    items.push({
      externalId,
      itemType: 'event',
      title,
      dueAt: null,
      startAt,
      endAt,
      rawPayload: { calData: '[redacted]' },
    });
  }

  return items;
}
