// T010 — InboxService
// buildInbox, getInboxCount, acceptInboxItem, dismissInboxItem, acceptAll, dismissAll

import { prisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';

export interface InboxItem {
  id: string; // "inbox:<syncCacheItemId>"
  externalId: string;
  title: string;
  itemType: 'task' | 'event' | 'message';
  dueAt?: string;
  startAt?: string;
  endAt?: string;
  syncedAt: string;
  integration: {
    id: string;
    serviceId: string;
    label?: string;
    accountIdentifier: string;
  };
}

export interface InboxGroup {
  integrationId: string;
  serviceId: string;
  accountLabel: string;
  accountIdentifier: string;
  items: InboxItem[];
}

export interface InboxResult {
  groups: InboxGroup[];
  total: number;
}

export class InboxError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'InboxError';
  }
}

/**
 * Build the inbox for a user: all pendingInbox items not yet dismissed,
 * grouped by integration.
 */
export async function buildInbox(userId: string): Promise<InboxResult> {
  // Get dismissed IDs to exclude
  const dismissedOverrides = await prisma.syncOverride.findMany({
    where: { userId, overrideType: 'DISMISSED' },
    select: { syncCacheItemId: true },
  });
  const dismissedIds = dismissedOverrides.map((d) => d.syncCacheItemId);

  logger.info('[buildInbox] query params', { userId, dismissedCount: dismissedIds.length });

  const items = await prisma.syncCacheItem.findMany({
    where: {
      userId,
      pendingInbox: true,
      expiresAt: { gt: new Date() },
      ...(dismissedIds.length > 0 ? { id: { notIn: dismissedIds } } : {}),
    },
    include: {
      integration: {
        select: { id: true, serviceId: true, label: true, accountIdentifier: true },
      },
    },
    orderBy: { syncedAt: 'asc' },
  });

  // Group by integrationId
  const groupMap = new Map<string, InboxGroup>();
  for (const item of items) {
    if (!groupMap.has(item.integrationId)) {
      groupMap.set(item.integrationId, {
        integrationId: item.integrationId,
        serviceId: item.integration.serviceId,
        accountLabel: item.integration.label ?? '',
        accountIdentifier: item.integration.accountIdentifier,
        items: [],
      });
    }
    groupMap.get(item.integrationId)!.items.push({
      id: `inbox:${item.id}`,
      externalId: item.externalId,
      title: item.title,
      itemType: item.itemType as 'task' | 'event' | 'message',
      dueAt: item.dueAt?.toISOString(),
      startAt: item.startAt?.toISOString(),
      endAt: item.endAt?.toISOString(),
      syncedAt: item.syncedAt.toISOString(),
      integration: {
        id: item.integration.id,
        serviceId: item.integration.serviceId,
        label: item.integration.label ?? undefined,
        accountIdentifier: item.integration.accountIdentifier,
      },
    });
  }

  const groups = Array.from(groupMap.values());
  logger.info('[buildInbox] result', { userId, itemCount: items.length, groupCount: groups.length });
  return { groups, total: items.length };
}

/**
 * Return the count of un-dismissed pendingInbox items for a user.
 */
export async function getInboxCount(userId: string): Promise<number> {
  const dismissedOverrides = await prisma.syncOverride.findMany({
    where: { userId, overrideType: 'DISMISSED' },
    select: { syncCacheItemId: true },
  });
  const dismissedIds = dismissedOverrides.map((d) => d.syncCacheItemId);

  return prisma.syncCacheItem.count({
    where: {
      userId,
      pendingInbox: true,
      expiresAt: { gt: new Date() },
      ...(dismissedIds.length > 0 ? { id: { notIn: dismissedIds } } : {}),
    },
  });
}

/**
 * Accept an inbox item: set pendingInbox = false so it moves into the feed.
 */
export async function acceptInboxItem(userId: string, itemId: string): Promise<void> {
  const item = await prisma.syncCacheItem.findFirst({
    where: { id: itemId, userId },
  });

  if (!item) {
    const err = new InboxError('ITEM_NOT_FOUND', `Item ${itemId} not found`);
    throw err;
  }

  if (!item.pendingInbox) {
    const err = new InboxError('ALREADY_ACCEPTED', `Item ${itemId} has already been accepted`);
    throw err;
  }

  await prisma.syncCacheItem.update({
    where: { id: itemId },
    data: { pendingInbox: false },
  });
}

/**
 * Dismiss an inbox item: create a DISMISSED SyncOverride.
 * Uses a transaction: pendingInbox stays true but the item is excluded via override.
 */
export async function dismissInboxItem(userId: string, itemId: string): Promise<void> {
  const item = await prisma.syncCacheItem.findFirst({
    where: { id: itemId, userId },
  });

  if (!item) {
    const err = new InboxError('ITEM_NOT_FOUND', `Item ${itemId} not found`);
    throw err;
  }

  await prisma.$transaction(async (tx) => {
    // Create DISMISSED override (upsert to be idempotent)
    await tx.syncOverride.upsert({
      where: { syncCacheItemId_overrideType: { syncCacheItemId: itemId, overrideType: 'DISMISSED' } },
      create: { userId, syncCacheItemId: itemId, overrideType: 'DISMISSED' },
      update: {},
    });
  });
}

/**
 * Accept all pendingInbox items for a specific integration.
 * Returns the count of items accepted.
 */
export async function acceptAll(userId: string, integrationId: string): Promise<number> {
  // Verify integration exists and belongs to user
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, userId },
  });

  if (!integration) {
    const err = new InboxError('INTEGRATION_NOT_FOUND', `Integration ${integrationId} not found`);
    throw err;
  }

  const result = await prisma.syncCacheItem.updateMany({
    where: {
      userId,
      integrationId,
      pendingInbox: true,
      expiresAt: { gt: new Date() },
    },
    data: { pendingInbox: false },
  });

  return result.count;
}

/**
 * Dismiss all pendingInbox items for a specific integration.
 * Creates DISMISSED SyncOverride records atomically.
 * Returns the count of items dismissed.
 */
export async function dismissAll(userId: string, integrationId: string): Promise<number> {
  // Verify integration exists and belongs to user
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, userId },
  });

  if (!integration) {
    const err = new InboxError('INTEGRATION_NOT_FOUND', `Integration ${integrationId} not found`);
    throw err;
  }

  // Get IDs of items already dismissed to avoid duplicates
  const alreadyDismissed = await prisma.syncOverride.findMany({
    where: { userId, overrideType: 'DISMISSED' },
    select: { syncCacheItemId: true },
  });
  const alreadyDismissedIds = new Set(alreadyDismissed.map((d) => d.syncCacheItemId));

  const pendingItems = await prisma.syncCacheItem.findMany({
    where: {
      userId,
      integrationId,
      pendingInbox: true,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  const itemsToDismiss = pendingItems.filter((i) => !alreadyDismissedIds.has(i.id));
  if (itemsToDismiss.length === 0) return 0;

  await prisma.$transaction(
    itemsToDismiss.map((item) =>
      prisma.syncOverride.create({
        data: { userId, syncCacheItemId: item.id, overrideType: 'DISMISSED' },
      })
    )
  );

  return itemsToDismiss.length;
}
