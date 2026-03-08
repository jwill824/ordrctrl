// T034 — Gmail Integration Adapter
// OAuth 2.0 via Google + Gmail API (all-unread vs starred-only sync modes)

import { Issuer, type Client } from 'openid-client';
import { prisma } from '../../lib/db.js';
import { encrypt, decrypt } from '../../lib/encryption.js';
import { logger } from '../../lib/logger.js';
import {
  type IntegrationAdapter,
  type NormalizedItem,
  type ConnectOptions,
  type SubSource,
  TokenRefreshError,
} from '../_adapter/types.js';

let gmailClient: Client | null = null;

async function getGmailClient(): Promise<Client> {
  if (gmailClient) return gmailClient;
  const googleIssuer = await Issuer.discover('https://accounts.google.com');
  gmailClient = new googleIssuer.Client({
    client_id: process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uris: [`${process.env.API_URL}/api/integrations/gmail/callback`],
    response_types: ['code'],
  });
  return gmailClient;
}

export class GmailAdapter implements IntegrationAdapter {
  readonly serviceId = 'gmail' as const;

  async getAuthorizationUrl(state: string, options?: ConnectOptions): Promise<string> {
    const client = await getGmailClient();
    return client.authorizationUrl({
      scope: 'openid email https://www.googleapis.com/auth/gmail.readonly',
      state,
      redirect_uri: `${process.env.API_URL}/api/integrations/gmail/callback`,
      access_type: 'offline',
      prompt: 'consent',
    });
  }

  async connect(
    userId: string,
    authCode: string,
    options?: ConnectOptions
  ): Promise<{ integrationId: string }> {
    const client = await getGmailClient();
    const redirectUri = `${process.env.API_URL}/api/integrations/gmail/callback`;
    const tokenSet = await client.callback(redirectUri, { code: authCode });

    const accessToken = tokenSet.access_token!;
    const refreshToken = tokenSet.refresh_token;
    const expiresAt = tokenSet.expires_at
      ? new Date(tokenSet.expires_at * 1000)
      : null;

    const syncMode = options?.gmailSyncMode ?? 'starred_only';

    // Upsert integration record
    const integration = await prisma.integration.upsert({
      where: { userId_serviceId: { userId, serviceId: 'gmail' } },
      create: {
        userId,
        serviceId: 'gmail',
        status: 'connected',
        encryptedAccessToken: encrypt(accessToken),
        encryptedRefreshToken: refreshToken ? encrypt(refreshToken) : null,
        tokenExpiresAt: expiresAt,
        gmailSyncMode: syncMode === 'all_unread' ? 'all_unread' : 'starred_only',
        lastSyncError: null,
      },
      update: {
        status: 'connected',
        encryptedAccessToken: encrypt(accessToken),
        encryptedRefreshToken: refreshToken ? encrypt(refreshToken) : null,
        tokenExpiresAt: expiresAt,
        gmailSyncMode: syncMode === 'all_unread' ? 'all_unread' : 'starred_only',
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

    // Attempt token revocation at Google
    if (integration.encryptedAccessToken) {
      try {
        const accessToken = decrypt(integration.encryptedAccessToken);
        await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
          method: 'POST',
        });
      } catch (err) {
        logger.warn('Gmail token revocation failed', {
          integrationId,
          error: (err as Error).message,
        });
      }
    }

    // Delete cache items and mark disconnected (clear tokens)
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
    const syncMode = integration.gmailSyncMode ?? 'starred_only';
    const importEverything = integration.importEverything ?? true;
    const selectedSubSourceIds = integration.selectedSubSourceIds ?? [];

    // Build Gmail query based on sync mode
    const q = syncMode === 'all_unread' ? 'is:unread' : 'is:starred is:unread';

    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=50`;
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listRes.ok) {
      throw new TokenRefreshError(integrationId, `Gmail list failed: ${listRes.status}`);
    }

    const listData = (await listRes.json()) as {
      messages?: Array<{ id: string; threadId: string }>;
    };

    const messages = listData.messages ?? [];
    const items: NormalizedItem[] = [];

    // Fetch each message's subject + date (batch in practice; sequential for MVP)
    for (const msg of messages.slice(0, 20)) {
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!msgRes.ok) continue;
        const msgData = (await msgRes.json()) as {
          id: string;
          labelIds?: string[];
          payload?: { headers?: Array<{ name: string; value: string }> };
          internalDate?: string;
        };

        const headers = msgData.payload?.headers ?? [];
        const subject =
          headers.find((h) => h.name === 'Subject')?.value ?? '(no subject)';
        const dateHeader = headers.find((h) => h.name === 'Date')?.value;
        const dueAt = dateHeader ? new Date(dateHeader) : null;
        const subSourceId = msgData.labelIds?.[0];

        items.push({
          externalId: msgData.id,
          itemType: 'message',
          title: subject,
          dueAt,
          startAt: null,
          endAt: null,
          subSourceId,
          rawPayload: { id: msgData.id, internalDate: msgData.internalDate },
        });
      } catch (err) {
        logger.warn('Gmail message fetch failed', { id: msg.id, error: (err as Error).message });
      }
    }

    // Apply selective import filter
    if (!importEverything) {
      if (selectedSubSourceIds.length === 0) return [];
      return items.filter(
        (item) => item.subSourceId && selectedSubSourceIds.includes(item.subSourceId)
      );
    }

    return items;
  }

  async listSubSources(integrationId: string): Promise<SubSource[]> {
    try {
      const integration = await prisma.integration.findUnique({
        where: { id: integrationId },
      });
      if (!integration) return [];

      const accessToken = decrypt(integration.encryptedAccessToken);
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) return [];

      const data = (await res.json()) as {
        labels?: Array<{ id: string; name: string }>;
      };

      return (data.labels ?? []).map((label) => ({
        id: label.id,
        label: label.name,
        type: 'label' as const,
      }));
    } catch {
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
      const client = await getGmailClient();
      const refreshToken = decrypt(integration.encryptedRefreshToken);
      const tokenSet = await client.refresh(refreshToken);

      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          encryptedAccessToken: encrypt(tokenSet.access_token!),
          tokenExpiresAt: tokenSet.expires_at
            ? new Date(tokenSet.expires_at * 1000)
            : null,
        },
      });
    } catch (err) {
      throw new TokenRefreshError(integrationId, (err as Error).message);
    }
  }
}
