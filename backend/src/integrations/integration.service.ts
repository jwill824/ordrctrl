// T039 — IntegrationService
// connect (initiate OAuth), disconnect, status, updateGmailSyncMode

import { prisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { syncQueue } from '../lib/queue.js';
import { getAdapter } from '../integrations/index.js';
import type { ServiceId } from '../integrations/_adapter/types.js';
import type { ConnectOptions } from '../integrations/_adapter/types.js';
import type { SubSource } from '../integrations/_adapter/types.js';

export type IntegrationStatus = 'connected' | 'error' | 'disconnected';

export interface IntegrationStatusItem {
  serviceId: ServiceId;
  status: IntegrationStatus;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  gmailSyncMode: 'all_unread' | 'starred_only' | null;
  importEverything: boolean;
  selectedSubSourceIds: string[];
}

const ALL_SERVICE_IDS: ServiceId[] = [
  'gmail',
  'apple_reminders',
  'microsoft_tasks',
  'apple_calendar',
];

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
    },
  });

  const byService = new Map(integrations.map((i) => [i.serviceId, i]));

  return ALL_SERVICE_IDS.map((serviceId) => {
    const found = byService.get(serviceId);
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

/**
 * Complete OAuth connection: exchange code for tokens, store integration.
 * Queues an immediate sync job.
 */
export async function connectIntegration(
  userId: string,
  serviceId: ServiceId,
  authCode: string,
  options?: ConnectOptions
): Promise<{ integrationId: string }> {
  const adapter = getAdapter(serviceId);
  const result = await adapter.connect(userId, authCode, options);

  // Queue immediate sync
  await syncQueue.add('sync', {
    integrationId: result.integrationId,
    userId,
  });

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
      updatedAt: true,
    },
  });
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
  };
}
