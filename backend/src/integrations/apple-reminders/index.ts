// T035 — Apple Reminders Integration Adapter
// Uses Sign in with Apple OAuth + iCloud CalDAV (VEVENT/VTODO) for Reminders data

import { prisma } from '../../lib/db.js';
import { encrypt, decrypt } from '../../lib/encryption.js';
import { logger } from '../../lib/logger.js';
import {
  type IntegrationAdapter,
  type NormalizedItem,
  type ConnectOptions,
  TokenRefreshError,
} from '../_adapter/types.js';

// Apple OAuth endpoints
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';

// Apple iCloud CalDAV base URL for reminders (VCALENDAR / VTODO)
const CALDAV_BASE = 'https://caldav.icloud.com';

/**
 * Generate a signed JWT client_secret for Apple OAuth (required by Apple's spec).
 * Apple requires ES256 JWT signed with the private key from Apple Developer portal.
 */
async function buildAppleClientSecret(): Promise<string> {
  const { SignJWT } = await import('jose');
  const { createPrivateKey } = await import('crypto');

  const privateKeyPem = process.env.APPLE_REMINDERS_PRIVATE_KEY!;
  const keyId = process.env.APPLE_REMINDERS_KEY_ID!;
  const teamId = process.env.APPLE_REMINDERS_TEAM_ID!;
  const clientId = process.env.APPLE_REMINDERS_CLIENT_ID!;

  const privateKey = createPrivateKey({ key: privateKeyPem, format: 'pem' });

  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuedAt()
    .setIssuer(teamId)
    .setAudience('https://appleid.apple.com')
    .setSubject(clientId)
    .setExpirationTime('1h')
    .sign(privateKey);
}

export class AppleRemindersAdapter implements IntegrationAdapter {
  readonly serviceId = 'apple_reminders' as const;

  async getAuthorizationUrl(state: string, _options?: ConnectOptions): Promise<string> {
    const clientId = process.env.APPLE_REMINDERS_CLIENT_ID!;
    const redirectUri = encodeURIComponent(
      `${process.env.API_URL}/api/integrations/apple_reminders/callback`
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
    const clientId = process.env.APPLE_REMINDERS_CLIENT_ID!;
    const redirectUri = `${process.env.API_URL}/api/integrations/apple_reminders/callback`;
    const clientSecret = await buildAppleClientSecret();

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    const res = await fetch(APPLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      throw new Error(`Apple token exchange failed: ${await res.text()}`);
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
      where: { userId_serviceId: { userId, serviceId: 'apple_reminders' } },
      create: {
        userId,
        serviceId: 'apple_reminders',
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
        const clientId = process.env.APPLE_REMINDERS_CLIENT_ID!;
        const clientSecret = await buildAppleClientSecret();
        const refreshToken = decrypt(integration.encryptedRefreshToken);
        const params = new URLSearchParams({
          client_id: clientId,
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
        logger.warn('Apple Reminders token revocation failed', {
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
      // Query iCloud CalDAV for VTODO items (reminders)
      const propfindBody = `<?xml version="1.0" encoding="UTF-8"?>
<A:propfind xmlns:A="DAV:">
  <A:prop>
    <A:resourcetype/>
    <A:displayname/>
  </A:prop>
</A:propfind>`;

      // First PROPFIND to discover the principal URL
      const principalRes = await fetch(`${CALDAV_BASE}/`, {
        method: 'PROPFIND',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/xml; charset=utf-8',
          Depth: '0',
        },
        body: propfindBody,
      });

      if (!principalRes.ok) {
        logger.warn('Apple Reminders CalDAV discovery failed', {
          integrationId,
          status: principalRes.status,
        });
        return [];
      }

      // Query VTODO items via REPORT
      const reportBody = `<?xml version="1.0" encoding="UTF-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VTODO">
        <C:prop-filter name="STATUS">
          <C:text-match negate-condition="yes">COMPLETED</C:text-match>
        </C:prop-filter>
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
      return parseVTodoItems(calText);
    } catch (err) {
      logger.error('Apple Reminders sync error', {
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
      const clientId = process.env.APPLE_REMINDERS_CLIENT_ID!;
      const clientSecret = await buildAppleClientSecret();
      const refreshToken = decrypt(integration.encryptedRefreshToken);

      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
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

// Parse VTODO items from CalDAV REPORT XML response
function parseVTodoItems(xmlText: string): NormalizedItem[] {
  const items: NormalizedItem[] = [];

  // Simple regex-based parsing for MVP (production would use a proper XML/iCal parser)
  const calDataMatches = xmlText.matchAll(
    /<cal:calendar-data[^>]*>([\s\S]*?)<\/cal:calendar-data>/gi
  );

  for (const match of calDataMatches) {
    const calData = match[1].replace(/&#13;/g, '').replace(/\r/g, '');

    const uidMatch = calData.match(/^UID:(.+)$/m);
    const summaryMatch = calData.match(/^SUMMARY:(.+)$/m);
    const dueMatch = calData.match(/^DUE(?:;[^:]*)?:(\d{8}(?:T\d{6}Z?)?)/m);

    if (!uidMatch || !summaryMatch) continue;

    const externalId = uidMatch[1].trim();
    const title = summaryMatch[1].trim();
    let dueAt: Date | null = null;

    if (dueMatch) {
      const dStr = dueMatch[1];
      try {
        if (dStr.length === 8) {
          dueAt = new Date(`${dStr.slice(0, 4)}-${dStr.slice(4, 6)}-${dStr.slice(6, 8)}`);
        } else {
          dueAt = new Date(dStr);
        }
      } catch {
        // ignore parse errors
      }
    }

    items.push({
      externalId,
      itemType: 'task',
      title,
      dueAt,
      startAt: null,
      endAt: null,
      rawPayload: { calData: '[redacted]' },
    });
  }

  return items;
}
