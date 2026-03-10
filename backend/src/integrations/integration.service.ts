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
  AccountLimitError,
  DuplicateAccountError,
} from '../integrations/_adapter/types.js';

export class AppError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export type IntegrationStatus = 'connected' | 'error' | 'disconnected';

export interface IntegrationStatusItem {
  id: string;
  serviceId: ServiceId;
  accountIdentifier: string;
  label: string | null;
  paused: boolean;
  status: IntegrationStatus;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  gmailSyncMode: 'all_unread' | 'starred_only' | null;
  gmailCompletionMode: 'inbox_removal' | 'read' | null;
  importEverything: boolean;
  selectedSubSourceIds: string[];
  maskedEmail: string | null;
  calendarEventWindowDays: number | null;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
}

function mapIntegrationRow(found: {
  id: string;
  serviceId: string;
  accountIdentifier: string;
  label: string | null;
  paused: boolean;
  status: string;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
  gmailSyncMode: string | null;
  gmailCompletionMode: string | null;
  importEverything: boolean;
  selectedSubSourceIds: string[];
  encryptedAccessToken: string;
  calendarEventWindowDays: number;
}): IntegrationStatusItem {
  const isApple = found.serviceId === 'apple_calendar';
  let maskedEmail: string | null = null;
  if (isApple && found.status !== 'disconnected' && found.encryptedAccessToken) {
    try { maskedEmail = maskEmail(decrypt(found.encryptedAccessToken)); } catch { /* ignore */ }
  }
  return {
    id: found.id,
    serviceId: found.serviceId as ServiceId,
    accountIdentifier: found.accountIdentifier,
    label: found.label ?? null,
    paused: found.paused,
    status: found.status as IntegrationStatus,
    lastSyncAt: found.lastSyncAt?.toISOString() ?? null,
    lastSyncError: found.lastSyncError ?? null,
    gmailSyncMode: found.gmailSyncMode === 'all_unread' ? 'all_unread' : found.gmailSyncMode === 'starred_only' ? 'starred_only' : null,
    gmailCompletionMode: found.gmailCompletionMode === 'read' ? 'read' : found.gmailCompletionMode === 'inbox_removal' ? 'inbox_removal' : null,
    importEverything: found.importEverything,
    selectedSubSourceIds: found.selectedSubSourceIds,
    maskedEmail,
    calendarEventWindowDays: found.serviceId === 'apple_calendar' && found.status !== 'disconnected' ? found.calendarEventWindowDays ?? 30 : null,
  };
}

const INTEGRATION_SELECT = {
  id: true,
  serviceId: true,
  accountIdentifier: true,
  label: true,
  paused: true,
  status: true,
  lastSyncAt: true,
  lastSyncError: true,
  gmailSyncMode: true,
  gmailCompletionMode: true,
  importEverything: true,
  selectedSubSourceIds: true,
  encryptedAccessToken: true,
  calendarEventWindowDays: true,
} as const;

/**
 * List all integration rows for a user (actual connected/error rows only).
 */
export async function listIntegrations(userId: string): Promise<IntegrationStatusItem[]> {
  const integrations = await prisma.integration.findMany({
    where: { userId },
    select: INTEGRATION_SELECT,
  });

  return integrations.map(mapIntegrationRow);
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
): Promise<{ integrationId: string; accountIdentifier: string }> {
  const adapter = getAdapter(serviceId);

  let adapterPayload: import('../integrations/_adapter/types.js').ConnectPayload;

  if (rawPayload.type === 'use-existing') {
    const sibling = await prisma.integration.findFirst({
      where: { userId, serviceId: 'apple_calendar', status: 'connected' },
    });
    if (!sibling || !sibling.encryptedAccessToken || !sibling.encryptedRefreshToken) {
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
 * Disconnect an integration by integrationId.
 */
export async function disconnectIntegration(
  userId: string,
  integrationId: string
): Promise<void> {
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, userId },
  });

  if (!integration || integration.status === 'disconnected') {
    throw new Error('Integration not found or already disconnected');
  }

  const adapter = getAdapter(integration.serviceId as ServiceId);
  await adapter.disconnect(integration.id);

  logger.info('Integration disconnected', { userId, serviceId: integration.serviceId, integrationId });
}

/**
 * Update Gmail sync mode for a connected Gmail integration.
 */
export async function updateGmailSyncMode(
  userId: string,
  integrationId: string,
  syncMode: 'all_unread' | 'starred_only'
): Promise<void> {
  await prisma.integration.update({
    where: { id: integrationId },
    data: { gmailSyncMode: syncMode === 'all_unread' ? 'all_unread' : 'starred_only' },
  });
}

/**
 * Queue manual sync for all connected, non-paused integrations of a user.
 */
export async function triggerManualSync(userId: string): Promise<number> {
  const integrations = await prisma.integration.findMany({
    where: { userId, status: 'connected', paused: false },
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
export async function getSubSources(userId: string, integrationId: string): Promise<SubSource[]> {
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, userId },
  });
  if (!integration || integration.status !== 'connected') {
    const err = new Error(`Integration not found: ${integrationId}`);
    (err as any).code = 'INTEGRATION_NOT_FOUND';
    throw err;
  }
  const adapter = getAdapter(integration.serviceId as ServiceId);
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
  integrationId: string,
  importEverything: boolean,
  selectedSubSourceIds: string[]
): Promise<IntegrationStatusItem> {
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, userId },
  });
  if (!integration || integration.status !== 'connected') {
    const err = new Error(`Integration not found: ${integrationId}`);
    (err as any).code = 'INTEGRATION_NOT_FOUND';
    throw err;
  }
  const updated = await prisma.integration.update({
    where: { id: integration.id },
    data: { importEverything, selectedSubSourceIds },
    select: INTEGRATION_SELECT,
  });

  return mapIntegrationRow(updated);
}

/**
 * Update calendarEventWindowDays for the apple_calendar integration.
 */
export async function updateCalendarEventWindow(
  userId: string,
  integrationId: string,
  days: 7 | 14 | 30 | 60
): Promise<void> {
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, userId, serviceId: 'apple_calendar' },
  });
  if (!integration || integration.status === 'disconnected') {
    throw new AppError('INTEGRATION_NOT_FOUND', 'Apple Calendar integration not found or disconnected');
  }
  await prisma.integration.update({ where: { id: integration.id }, data: { calendarEventWindowDays: days } });
}

/**
 * Update gmailCompletionMode for the Gmail integration.
 */
export async function updateGmailCompletionMode(
  userId: string,
  integrationId: string,
  mode: 'inbox_removal' | 'read'
): Promise<{ gmailCompletionMode: 'inbox_removal' | 'read' }> {
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, userId, serviceId: 'gmail' },
  });
  if (!integration || integration.status === 'disconnected') {
    throw new AppError('INTEGRATION_NOT_FOUND', 'Gmail integration not found or disconnected');
  }
  await prisma.integration.update({ where: { id: integration.id }, data: { gmailCompletionMode: mode } });
  return { gmailCompletionMode: mode };
}

/**
 * Update the label/nickname for an integration.
 */
export async function updateLabel(
  userId: string,
  integrationId: string,
  label: string | null
): Promise<IntegrationStatusItem> {
  const cleanLabel = label?.trim() || null;
  if (cleanLabel && cleanLabel.length > 50) {
    throw new AppError('VALIDATION_FAILED', 'Label must be 50 characters or fewer');
  }
  const integration = await prisma.integration.findFirst({ where: { id: integrationId, userId } });
  if (!integration) {
    throw new AppError('NOT_FOUND', 'Integration not found');
  }
  const updated = await prisma.integration.update({
    where: { id: integration.id },
    data: { label: cleanLabel },
    select: INTEGRATION_SELECT,
  });
  return mapIntegrationRow(updated);
}

/**
 * Pause or resume an integration.
 * Resuming triggers an immediate sync.
 */
export async function pauseIntegration(
  userId: string,
  integrationId: string,
  paused: boolean
): Promise<{ id: string; paused: boolean; status: IntegrationStatus }> {
  const integration = await prisma.integration.findFirst({ where: { id: integrationId, userId } });
  if (!integration) throw new AppError('NOT_FOUND', 'Integration not found');
  if (paused && integration.status !== 'connected') {
    throw new AppError('INVALID_STATE', 'Cannot pause an integration that is not connected');
  }
  const updated = await prisma.integration.update({
    where: { id: integration.id },
    data: { paused },
    select: { id: true, paused: true, status: true },
  });
  if (!paused) {
    // Resume: trigger immediate sync
    await syncQueue.add('sync', { integrationId: updated.id, userId });
  }
  return { id: updated.id, paused: updated.paused, status: updated.status as IntegrationStatus };
}

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
