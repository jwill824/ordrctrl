# Developer Quickstart: Per-Item Feed Dismissal

**Feature**: `005-feed-dismissal`

---

## Overview

This feature adds the ability for users to dismiss individual feed items they no longer want to see. Dismissed items are hidden from the feed until explicitly restored. This guide covers local setup, schema migration, and the key code paths to understand.

---

## Prerequisites

- Node.js 20+
- `pnpm` installed globally
- PostgreSQL running locally (or via Docker)
- Feature branch: `005-feed-dismissal`

```bash
git checkout 005-feed-dismissal
pnpm install
```

---

## Running the Dev Environment

```bash
# From repo root — starts both backend and frontend
pnpm dev

# Backend only
cd backend && pnpm dev

# Frontend only
cd frontend && pnpm dev
```

---

## Applying the Migration

After implementing the schema changes in `backend/prisma/schema.prisma`:

```bash
cd backend

# Generate and apply the migration
pnpm prisma migrate dev --name add-dismissed-override-type

# Regenerate Prisma client
pnpm prisma generate
```

**What this migration adds**:
1. `DISMISSED` value to the `OverrideType` enum
2. `dismissed Boolean @default(false)` column on `NativeTask`

---

## Key Code Paths

### Backend — Dismiss a Feed Item

Service function in `backend/src/feed/feed.service.ts`:

```typescript
async function dismissFeedItem(userId: string, itemId: string): Promise<void> {
  if (itemId.startsWith('sync:')) {
    const cacheItemId = itemId.replace('sync:', '');
    await prisma.syncOverride.upsert({
      where: { syncCacheItemId_overrideType: { syncCacheItemId: cacheItemId, overrideType: 'DISMISSED' } },
      create: { userId, syncCacheItemId: cacheItemId, overrideType: 'DISMISSED' },
      update: {},
    });
  } else if (itemId.startsWith('native:')) {
    const nativeTaskId = itemId.replace('native:', '');
    await prisma.nativeTask.update({
      where: { id: nativeTaskId, userId },
      data: { dismissed: true },
    });
  }
}
```

Route in `backend/src/api/feed.routes.ts` — follows existing `complete`/`uncomplete` pattern:

```typescript
fastify.patch('/items/:itemId/dismiss', { preHandler: [authenticate] }, async (req, reply) => {
  const { itemId } = req.params;
  await feedService.dismissFeedItem(req.user.id, itemId);
  return reply.send({ id: itemId, dismissed: true });
});
```

### Backend — Feed Filter

In `getCacheItemsForUser()` or `buildFeed()` — add dismissed item exclusion:

```typescript
// 1. Get dismissed sync item IDs for this user
const dismissed = await prisma.syncOverride.findMany({
  where: { userId, overrideType: 'DISMISSED' },
  select: { syncCacheItemId: true },
});
const dismissedIds = dismissed.map(d => d.syncCacheItemId);

// 2. Exclude from sync cache query
const cacheItems = await prisma.syncCacheItem.findMany({
  where: { userId, id: { notIn: dismissedIds } },
});

// 3. Exclude dismissed native tasks
const nativeTasks = await prisma.nativeTask.findMany({
  where: { userId, dismissed: false },
});
```

### Frontend — Dismiss with Optimistic Update

In `frontend/src/hooks/useFeed.ts` or a new `useDismiss.ts`:

```typescript
const { mutate: dismiss } = useMutation({
  mutationFn: (itemId: string) => feedService.dismissItem(itemId),
  onMutate: (itemId) => {
    // Optimistically remove from feed
    queryClient.setQueryData(['feed'], (old) =>
      old?.filter(item => item.id !== itemId)
    );
    // Show undo toast
    toast.show({ message: 'Dismissed', action: { label: 'Undo', onClick: () => restore(itemId) } });
  },
  onError: (_, itemId) => {
    // Rollback on error
    queryClient.invalidateQueries({ queryKey: ['feed'] });
    toast.error('Could not dismiss item. Please try again.');
  },
});
```

---

## Running Tests

```bash
cd backend

# All tests
pnpm test

# Tests for this feature specifically
pnpm test --filter feed
```

**Tests to add for this feature**:
- `feed.service.test.ts`: `dismissFeedItem()` — sync item, native item, already-dismissed (upsert), item not found
- `feed.service.test.ts`: `restoreFeedItem()` — sync item, native item, not-dismissed (404), item not found
- `feed.service.test.ts`: `buildFeed()` — dismissed sync items excluded, dismissed native tasks excluded, active items still present
- `feed.routes.test.ts`: contract tests for `PATCH /items/:itemId/dismiss`, `DELETE /items/:itemId/dismiss`, `GET /dismissed`

---

## Troubleshooting

**"Unknown enum value: DISMISSED"**: Run `pnpm prisma generate` after applying the migration.

**Dismissed items still appearing in feed**: Check that `getCacheItemsForUser()` has the `notIn: dismissedIds` exclusion and that `nativeTask.findMany()` includes `dismissed: false`.

**Undo toast not appearing**: Verify the `onMutate` handler fires before the `mutationFn` resolves (React Query default behavior — `onMutate` is synchronous).
