// T039 — IntegrationService

import { prisma } from '../lib/db.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { logger } from '../lib/logger.js';
import { syncQueue } from '../lib/queue.js';
import { getAdapter } from '../integrations/index.js';
import type { ServiceId, ConnectOptions, SubSource, NormalizedItem } from '../integrations/_adapter/types.js';
import {
  InvalidCredentialsError,
  ProviderUnavailableError,
} from '../integrations/_adapter/types.js';

export class AppError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export type IntegrationStatus = 'connected' | 'error' | 'disconnected';

export interface IntegrationStatusItem {
  serviceId: ServiceId;
  status: IntegrationStatus;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  gmailSyncMode: 'all_unread' | 'starred_only' | null;
  importEverything: boolean;
  selectedSubSourceIds: string[];
  maskedEmail: string | null;
  calendarEventWindowDays: number | null;
}

const ALL_SERVICE_IDS: ServiceId[] = [
  'gmail',
  'apple_reminders',
  'microsoft_tasks',
  'apple_calendar',
];

const APPLE_SERVICE_IDS: ServiceId[] = ['apple_reminders', 'apple_calendar'];

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
}

/**
 * List all 4 integrations for a user with current status.
 * Disconnected integrations are returned as placeholders.
 */
export async function listIntegrations(userId: string): Promise<IntegrationStatusItem[]> {
  const integrations = await prisma.integration.findMany({
    where: { userId },
    select: {
      serviceId: true,
      status: true,
      lastSyncAt: true,
      lastSyncError: true,
      gmailSyncMode: true,
      importEverything: true,
      selectedSubSourceIds: true,
      encryptedAccessToken: true,
      calendarEventWindowDays: true,
    },
  });

  const byService = new Map(integrations.map((i) => [i.serviceId, i]));

  return ALL_SERVICE_IDS.map((serviceId) => {
    const found = byService.get(serviceId);
    const isApple = APPLE_SERVICE_IDS.includes(serviceId);

    let maskedEmail: string | null = null;
    if (isApple && found && found.status !== 'disconnected' && found.encryptedAccessToken) {
      try {
        const email = decrypt(found.encryptedAccessToken);
        maskedEmail = maskEmail(email);
      } catch {
        maskedEmail = null;
      }
    }

    let calendarEventWindowDays: number | null = null;
    if (serviceId === 'apple_calendar' && found && found.status !== 'disconnected') {
      calendarEventWindowDays = found.calendarEventWindowDays ?? 30;
    }

    return {
      serviceId,
      status: (found?.status ?? 'disconnected') as IntegrationStatus,
      lastSyncAt: found?.lastSyncAt?.toISOString() ?? null,
      lastSyncError: found?.lastSyncError ?? null,
      gmailSyncMode:
        found?.gmailSyncMode === 'all_unread'
          ? 'all_unread'
          : found?.gmailSyncMode === 'starred_only'
          ? 'starred_only'
          : null,
      importEverything: found?.importEverything ?? true,
      selectedSubSourceIds: found?.selectedSubSourceIds ?? [],
      maskedEmail,
      calendarEventWindowDays,
    };
  });
}

/**
 * Get the OAuth authorization URL for a service.
 */
export async function getAuthorizationUrl(
  serviceId: ServiceId,
  state: string,
  options?: ConnectOptions
): Promise<string> {
  const adapter = getAdapter(serviceId);
  return adapter.getAuthorizationUrl(state, options);
}

type RawConnectPayload =
  | { type: 'oauth'; authCode: string }
  | { type: 'credential'; email: string; password: string }
  | { type: 'use-existing' };

/**
 * Complete connection: exchange code/credentials for tokens, store integration.
 * Queues an immediate sync job.
 */
export async function connectIntegration(
  userId: string,
  serviceId: ServiceId,
  rawPayload: RawConnectPayload,
  options?: ConnectOptions
): Promise<{ integrationId: string }> {
  const adapter = getAdapter(serviceId);

  let adapterPayload: import('../integrations/_adapter/types.js').ConnectPayload;

  if (rawPayload.type === 'use-existing') {
    // Find sibling Apple integration with credentials
    const siblingServiceId: ServiceId =
      serviceId === 'apple_reminders' ? 'apple_calendar' : 'apple_reminders';
    const sibling = await prisma.integration.findUnique({
      where: { userId_serviceId: { userId, serviceId: siblingServiceId } },
    });
    if (!sibling || sibling.status !== 'connected' || !sibling.encryptedAccessToken || !sibling.encryptedRefreshToken) {
      throw new AppError('NO_EXISTING_CREDENTIALS', 'No connected Apple integration with credentials found');
    }
    const email = decrypt(sibling.encryptedAccessToken);
    const password = decrypt(sibling.encryptedRefreshToken);
    adapterPayload = { type: 'credential', email, password };
  } else if (rawPayload.type === 'credential') {
    const asp = rawPayload.password.replace(/-/g, '');
    adapterPayload = { type: 'credential', email: rawPayload.email, password: asp };
  } else {
    adapterPayload = { type: 'oauth', authCode: rawPayload.authCode };
  }

  const result = await adapter.connect(userId, adapterPayload, options);

  // Queue immediate sync
  await syncQueue.add('sync', { integrationId: result.integrationId, userId });

  logger.info('Integration connected', { userId, serviceId, integrationId: result.integrationId });
  return result;
}

/**
 * Disconnect an integration: revoke tokens, clear cache.
 */
export async function disconnectIntegration(
  userId: string,
  serviceId: ServiceId
): Promise<void> {
  const integration = await prisma.integration.findUnique({
    where: { userId_serviceId: { userId, serviceId } },
  });

  if (!integration || integration.status === 'disconnected') {
    throw new Error('Integration not found or already disconnected');
  }

  const adapter = getAdapter(serviceId);
  await adapter.disconnect(integration.id);

  // Apple cross-check: if sibling is also disconnected and has stale credentials, purge them
  if (APPLE_SERVICE_IDS.includes(serviceId)) {
    const siblingServiceId: ServiceId =
      serviceId === 'apple_reminders' ? 'apple_calendar' : 'apple_reminders';
    const sibling = await prisma.integration.findUnique({
      where: { userId_serviceId: { userId, serviceId: siblingServiceId } },
    });
    if (sibling && sibling.status === 'disconnected' && sibling.encryptedAccessToken) {
      await prisma.integration.update({
        where: { id: sibling.id },
        data: { encryptedAccessToken: '', encryptedRefreshToken: null },
      });
    }
  }

  logger.info('Integration disconnected', { userId, serviceId });
}

/**
 * Update Gmail sync mode for a connected Gmail integration.
 */
export async function updateGmailSyncMode(
  userId: string,
  syncMode: 'all_unread' | 'starred_only'
): Promise<void> {
  await prisma.integration.updateMany({
    where: { userId, serviceId: 'gmail' },
    data: {
      gmailSyncMode: syncMode === 'all_unread' ? 'all_unread' : 'starred_only',
    },
  });
}

/**
 * Queue manual sync for all connected integrations of a user.
 */
export async function triggerManualSync(userId: string): Promise<number> {
  const integrations = await prisma.integration.findMany({
    where: { userId, status: 'connected' },
    select: { id: true },
  });

  for (const integration of integrations) {
    await syncQueue.add('sync', { integrationId: integration.id, userId });
  }

  return integrations.length;
}

/**
 * Get available sub-sources for a connected integration.
 */
export async function getSubSources(userId: string, serviceId: ServiceId): Promise<SubSource[]> {
  const integration = await prisma.integration.findUnique({
    where: { userId_serviceId: { userId, serviceId } },
  });
  if (!integration || integration.status !== 'connected') {
    const err = new Error(`Integration not found: ${serviceId}`);
    (err as any).code = 'INTEGRATION_NOT_FOUND';
    throw err;
  }
  const adapter = getAdapter(serviceId);
  if (!adapter.listSubSources) return [];
  try {
    return await adapter.listSubSources(integration.id);
  } catch (err) {
    const provErr = new Error((err as Error).message);
    (provErr as any).code = 'PROVIDER_ERROR';
    throw provErr;
  }
}

/**
 * Update import filter (importEverything + selectedSubSourceIds) for an integration.
 */
export async function updateImportFilter(
  userId: string,
  serviceId: ServiceId,
  importEverything: boolean,
  selectedSubSourceIds: string[]
): Promise<IntegrationStatusItem> {
  const integration = await prisma.integration.findUnique({
    where: { userId_serviceId: { userId, serviceId } },
  });
  if (!integration || integration.status !== 'connected') {
    const err = new Error(`Integration not found: ${serviceId}`);
    (err as any).code = 'INTEGRATION_NOT_FOUND';
    throw err;
  }
  const updated = await prisma.integration.update({
    where: { userId_serviceId: { userId, serviceId } },
    data: { importEverything, selectedSubSourceIds },
    select: {
      serviceId: true,
      status: true,
      lastSyncAt: true,
      lastSyncError: true,
      gmailSyncMode: true,
      importEverything: true,
      selectedSubSourceIds: true,
      encryptedAccessToken: true,
      calendarEventWindowDays: true,
      updatedAt: true,
    },
  });

  const isApple = APPLE_SERVICE_IDS.includes(updated.serviceId as ServiceId);
  let maskedEmail: string | null = null;
  if (isApple && updated.status !== 'disconnected' && updated.encryptedAccessToken) {
    try { maskedEmail = maskEmail(decrypt(updated.encryptedAccessToken)); } catch { /* ignore */ }
  }

  return {
    serviceId: updated.serviceId as ServiceId,
    status: updated.status as IntegrationStatus,
    lastSyncAt: updated.lastSyncAt?.toISOString() ?? null,
    lastSyncError: updated.lastSyncError ?? null,
    gmailSyncMode:
      updated.gmailSyncMode === 'all_unread'
        ? 'all_unread'
        : updated.gmailSyncMode === 'starred_only'
        ? 'starred_only'
        : null,
    importEverything: updated.importEverything,
    selectedSubSourceIds: updated.selectedSubSourceIds,
    maskedEmail,
    calendarEventWindowDays:
      updated.serviceId === 'apple_calendar' && updated.status !== 'disconnected'
        ? updated.calendarEventWindowDays ?? 30
        : null,
  };
}

/**
 * Update calendarEventWindowDays for the apple_calendar integration.
 */
export async function updateCalendarEventWindow(
  userId: string,
  days: 7 | 14 | 30 | 60
): Promise<void> {
  const integration = await prisma.integration.findUnique({
    where: { userId_serviceId: { userId, serviceId: 'apple_calendar' } },
  });
  if (!integration || integration.status === 'disconnected') {
    throw new AppError('INTEGRATION_NOT_FOUND', 'Apple Calendar integration not found or disconnected');
  }
  await prisma.integration.update({
    where: { id: integration.id },
    data: { calendarEventWindowDays: days },
  });
}

/**
 * Run a sync job with proper error handling.
 */
export async function runSyncJob(integrationId: string, userId: string): Promise<NormalizedItem[]> {
  const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
  if (!integration) return [];

  const adapter = getAdapter(integration.serviceId as ServiceId);

  try {
    const items = await adapter.sync(integrationId);
    await prisma.integration.update({
      where: { id: integrationId },
      data: { lastSyncAt: new Date(), lastSyncError: null },
    });
    return items;
  } catch (err) {
    if (err instanceof InvalidCredentialsError || err instanceof ProviderUnavailableError) {
      await prisma.integration.update({
        where: { id: integrationId },
        data: { status: 'error', lastSyncError: (err as Error).message },
      });
    }
    throw err;
  }
}
