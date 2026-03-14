// T036 — Microsoft Tasks Integration Adapter
// Microsoft Graph API OAuth 2.0 + To Do tasks endpoint

import { prisma } from '../../lib/db.js';
import { encrypt, decrypt } from '../../lib/encryption.js';
import { logger } from '../../lib/logger.js';
import {
  type IntegrationAdapter,
  type NormalizedItem,
  type ConnectOptions,
  type ConnectPayload,
  type SubSource,
  TokenRefreshError,
  NotSupportedError,
  AccountLimitError,
} from '../_adapter/types.js';

const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MS_GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export class MicrosoftTasksAdapter implements IntegrationAdapter {
  readonly serviceId = 'microsoft_tasks' as const;

  async getAuthorizationUrl(state: string, _options?: ConnectOptions): Promise<string> {
    const clientId = process.env.MICROSOFT_CLIENT_ID!;
    const redirectUri = encodeURIComponent(
      `${process.env.API_URL}/api/integrations/microsoft_tasks/callback`
    );
    const scope = encodeURIComponent(
      'offline_access User.Read Tasks.Read Tasks.ReadWrite'
    );
    const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
    return (
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize` +
      `?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}` +
      `&scope=${scope}&state=${state}&response_mode=query`
    );
  }

  async connect(
    userId: string,
    payload: ConnectPayload,
    _options?: ConnectOptions
  ): Promise<{ integrationId: string; accountIdentifier: string }> {
    if (payload.type !== 'oauth') throw new NotSupportedError('microsoft_tasks', 'connect with non-OAuth payload');
    const { authCode } = payload;
    const clientId = process.env.MICROSOFT_CLIENT_ID!;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;
    const redirectUri = `${process.env.API_URL}/api/integrations/microsoft_tasks/callback`;
    const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code: authCode,
      scope: 'offline_access User.Read Tasks.Read Tasks.ReadWrite',
    });

    const res = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      }
    );

    if (!res.ok) {
      throw new Error(`Microsoft token exchange failed: ${await res.text()}`);
    }

    const tokenData = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    // Fetch account identifier from MS Graph
    let accountIdentifier = 'unknown@microsoft.com';
    try {
      const meRes = await fetch(`${MS_GRAPH_BASE}/me`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (meRes.ok) {
        const meData = (await meRes.json()) as { mail?: string; userPrincipalName?: string };
        accountIdentifier = meData.mail ?? meData.userPrincipalName ?? 'unknown@microsoft.com';
      }
    } catch {
      // keep default
    }

    const existing = await prisma.integration.findFirst({
      where: { userId, serviceId: 'microsoft_tasks', accountIdentifier },
    });

    let integration;
    if (existing) {
      integration = await prisma.integration.update({
        where: { id: existing.id },
        data: {
          status: 'connected',
          encryptedAccessToken: encrypt(tokenData.access_token),
          encryptedRefreshToken: tokenData.refresh_token
            ? encrypt(tokenData.refresh_token)
            : null,
          tokenExpiresAt: expiresAt,
          lastSyncError: null,
        },
      });
    } else {
      const count = await prisma.integration.count({ where: { userId, serviceId: 'microsoft_tasks' } });
      if (count >= 5) throw new AccountLimitError('microsoft_tasks', 5);

      integration = await prisma.integration.create({
        data: {
          userId,
          serviceId: 'microsoft_tasks',
          accountIdentifier,
          status: 'connected',
          encryptedAccessToken: encrypt(tokenData.access_token),
          encryptedRefreshToken: tokenData.refresh_token
            ? encrypt(tokenData.refresh_token)
            : null,
          tokenExpiresAt: expiresAt,
          lastSyncError: null,
        },
      });
    }

    return { integrationId: integration.id, accountIdentifier };
  }

  async disconnect(integrationId: string): Promise<void> {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });
    if (!integration) return;

    // Microsoft doesn't support server-side token revocation via a simple endpoint
    // Tokens expire naturally; we clear locally

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
    if (!integration || integration.status === 'disconnected') return [];

    const accessToken = decrypt(integration.encryptedAccessToken);
    const importEverything = integration.importEverything ?? true;
    const selectedSubSourceIds = integration.selectedSubSourceIds ?? [];

    try {
      // Fetch all task lists
      const listsRes = await fetch(`${MS_GRAPH_BASE}/me/todo/lists`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (listsRes.status === 401) {
        throw new TokenRefreshError(integrationId, 'Access token expired');
      }

      if (!listsRes.ok) return [];

      const listsData = (await listsRes.json()) as {
        value: Array<{ id: string; displayName: string }>;
      };

      // If selective import with no selections, return early without any fetching
      if (!importEverything && selectedSubSourceIds.length === 0) return [];

      const items: NormalizedItem[] = [];

      for (const list of listsData.value) {
        const tasksRes = await fetch(
          `${MS_GRAPH_BASE}/me/todo/lists/${list.id}/tasks?$top=50`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!tasksRes.ok) continue;

        const tasksData = (await tasksRes.json()) as {
          value: Array<{
            id: string;
            title: string;
            dueDateTime?: { dateTime: string; timeZone: string };
            status: string;
            webLink?: string;
            body?: { content?: string; contentType?: string };
          }>;
        };

        for (const task of tasksData.value) {
          let dueAt: Date | null = null;
          if (task.dueDateTime?.dateTime) {
            dueAt = new Date(task.dueDateTime.dateTime);
          }

          // Store webLink (web URL) as url — it contains the correctly-encoded task ID
          // that the native app also uses for routing. Frontend will attempt ms-to-do://
          // deep link first and fall back to this web URL.
          const url = task.webLink ?? `https://to-do.microsoft.com/tasks/id/${encodeURIComponent(task.id)}`;
          const body = task.body?.content ?? null;

          items.push({
            externalId: task.id,
            itemType: 'task',
            title: task.title,
            dueAt,
            startAt: null,
            endAt: null,
            subSourceId: list.id,
            completed: task.status === 'completed',
            body,
            url,
            rawPayload: { listId: list.id, status: task.status },
          });
        }
      }

      // Post-fetch filter by selectedSubSourceIds
      if (!importEverything) {
        return items.filter((item) => item.subSourceId && selectedSubSourceIds.includes(item.subSourceId));
      }

      return items;
    } catch (err) {
      if (err instanceof TokenRefreshError) throw err;
      logger.error('Microsoft Tasks sync error', {
        integrationId,
        error: (err as Error).message,
      });
      return [];
    }
  }

  async listSubSources(integrationId: string): Promise<SubSource[]> {
    try {
      const integration = await prisma.integration.findUnique({
        where: { id: integrationId },
      });
      if (!integration) return [];

      const accessToken = decrypt(integration.encryptedAccessToken);
      const res = await fetch(`${MS_GRAPH_BASE}/me/todo/lists`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) return [];

      const data = (await res.json()) as {
        value: Array<{ id: string; displayName: string }>;
      };

      return data.value.map((list) => ({
        id: list.id,
        label: list.displayName,
        type: 'list' as const,
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
      const clientId = process.env.MICROSOFT_CLIENT_ID!;
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;
      const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
      const refreshToken = decrypt(integration.encryptedRefreshToken);

      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: 'offline_access User.Read Tasks.Read Tasks.ReadWrite',
      });

      const res = await fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        }
      );

      if (!res.ok) {
        throw new Error(`Token refresh failed: ${await res.text()}`);
      }

      const tokenData = (await res.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };

      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          encryptedAccessToken: encrypt(tokenData.access_token),
          encryptedRefreshToken: tokenData.refresh_token
            ? encrypt(tokenData.refresh_token)
            : integration.encryptedRefreshToken,
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
