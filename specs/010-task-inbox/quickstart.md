# Quickstart: Task Inbox (010)

## Overview

This guide covers the key development areas for the Task Inbox feature. All work happens on the `010-task-inbox` branch.

---

## Architecture in One Sentence

New `SyncCacheItem.pendingInbox` flag routes items to the inbox (`true`) or feed (`false`). Accepting from the inbox flips the flag. Dismissing from the inbox creates a `SyncOverride(DISMISSED)`.

---

## How New Items Flow

```
Sync runs
   │
   ├── New item (CREATE branch of upsert) → pendingInbox = true → /inbox page
   └── Existing item (UPDATE branch)      → pendingInbox unchanged → stays in feed

User opens /inbox
   ├── Accept → pendingInbox = false → item appears in feed
   └── Dismiss → SyncOverride(DISMISSED) created → item goes to dismissed archive
```

The old TriageSheet bottom-sheet (from the pre-inbox era) has been **removed**. The `/inbox` page is now the sole staging area for new sync items. Native tasks (created directly in ordrctrl) bypass the inbox entirely and go straight to the feed.

---

## File Map

### Backend (new)

| File | Purpose |
|------|---------|
| `backend/src/inbox/inbox.service.ts` | `buildInbox()`, `acceptItem()`, `dismissItem()`, `acceptAll()`, `dismissAll()`, `getCount()` |
| `backend/src/api/inbox.routes.ts` | Fastify route handlers for all `/api/inbox/*` endpoints |
| `backend/tests/unit/inbox/inbox.service.test.ts` | Unit tests for inbox service logic |
| `backend/tests/contract/inbox.routes.test.ts` | Contract tests for all inbox API routes |

### Backend (modified)

| File | What Changed |
|------|-------------|
| `backend/prisma/schema.prisma` | Added `pendingInbox Boolean @default(false)` + index to `SyncCacheItem` |
| `backend/prisma/migrations/` | Migration: `add_pending_inbox_to_sync_cache_item` |
| `backend/src/sync/cache.service.ts` | Set `pendingInbox: true` in the `create` branch of `persistCacheItems()` |
| `backend/src/feed/feed.service.ts` | Added `pendingInbox: false` filter in `getCacheItemsForUser()` |
| `backend/src/app.ts` | Registered `inbox.routes.ts` |
| `backend/src/sync/sync.worker.ts` | Handles `InvalidCredentialsError` (403) separately from `TokenRefreshError` (401) |
| `backend/src/integrations/gmail/index.ts` | 403 from Gmail throws `InvalidCredentialsError` instead of `TokenRefreshError` |

### Frontend (new)

| File | Purpose |
|------|---------|
| `frontend/src/services/inbox.service.ts` | API calls: `fetchInbox()`, `fetchInboxCount()`, `acceptItem()`, etc. |
| `frontend/src/hooks/useInbox.ts` | React hook with loading/error state, 15s polling, visibilitychange refresh |
| `frontend/src/hooks/useInboxCount.ts` | Lightweight hook; polls `GET /api/inbox/count` every 15 min |
| `frontend/src/app/inbox/page.tsx` | `/inbox` route — renders `InboxPage` |
| `frontend/src/components/inbox/InboxPage.tsx` | Full inbox view: loading, empty state, groups list, ↻ Refresh button |
| `frontend/src/components/inbox/InboxGroup.tsx` | Source group with Accept All / Dismiss All header |
| `frontend/src/components/inbox/InboxItem.tsx` | Individual item row with Accept / Dismiss buttons |
| `frontend/tests/unit/components/inbox/InboxItem.test.tsx` | Unit tests |
| `frontend/tests/unit/components/inbox/InboxGroup.test.tsx` | Unit tests |

### Frontend (modified)

| File | What Changed |
|------|-------------|
| `frontend/src/components/AccountMenu.tsx` | Added "Inbox" link with count badge |
| `frontend/src/app/feed/page.tsx` | Refresh button becomes inbox link when `inboxCount > 0`; `refreshing` spinner replaces old `triageLoading` |
| `frontend/src/hooks/useFeed.ts` | All triage state/logic removed; `refresh()` now polls until sync completes |

### Frontend (deleted)

| File | Reason |
|------|--------|
| `frontend/src/components/feed/TriageSheet.tsx` | Replaced by `/inbox` page |
| `frontend/tests/unit/components/feed/TriageSheet.test.tsx` | Component deleted |

---

## Backend Implementation Notes

### `pendingInbox` flag behavior

```typescript
// cache.service.ts — persistCacheItems upsert
create: {
  // ... existing fields ...
  pendingInbox: true,   // ALL new items go to inbox
}
update: {
  // ... existing fields ...
  // pendingInbox NOT included — accepted/dismissed state survives re-syncs
}
```

### Feed excludes inbox items

```typescript
// cache.service.ts — getCacheItemsForUser()
where: {
  userId,
  expiresAt: { gt: new Date() },
  pendingInbox: false,   // only accepted items appear in feed
  ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
}
```

### Inbox query

```typescript
// inbox.service.ts — buildInbox()
const dismissedOverrides = await prisma.syncOverride.findMany({
  where: { userId, overrideType: 'DISMISSED' },
});
const items = await prisma.syncCacheItem.findMany({
  where: { userId, pendingInbox: true, expiresAt: { gt: new Date() },
    ...(dismissedIds.length > 0 ? { id: { notIn: dismissedIds } } : {}) },
  include: { integration: { select: { id, serviceId, label, accountIdentifier } } },
  orderBy: { syncedAt: 'asc' },   // FIFO — oldest first
});
```

### Gmail 403 vs 401 handling

- **401** (Unauthorized / token expired) → throw `TokenRefreshError` → sync worker retries with refreshed token
- **403** (Permission denied / missing scope) → throw `InvalidCredentialsError` → sync worker marks integration `error` immediately, no refresh attempt

This matters because attempting a token refresh on a 403 always fails with `invalid_grant`, producing a confusing error message.

---

## Frontend Implementation Notes

### Refresh button behavior (feed page)

```
inboxCount > 0  → button becomes a Link to /inbox (badge shows count)
inboxCount = 0  → button triggers sync; spins while refreshing
```

### `refresh()` waits for sync completion

```typescript
// useFeed.ts — refresh()
// 1. Snapshot current lastSyncAt for all connected integrations
// 2. POST /api/integrations/sync (enqueue jobs — returns 202)
// 3. Poll GET /api/feed every 2s until all lastSyncAt timestamps advance
// 4. Final reloadFeed() once all syncs complete (30s timeout)
```

This ensures the feed reflects newly synced items (and inbox count updates) after clicking refresh, without requiring a full browser reload.

### `useInbox` refresh triggers

- On mount (initial load)
- Every 15 seconds (polling)
- On `document.visibilitychange` (tab becomes visible)
- On ↻ Refresh button click in InboxPage

---

## Key Gotchas

1. **Migration default**: `pendingInbox DEFAULT false` — existing items stay in feed. Do NOT set default to `true`.

2. **Update path**: `persistCacheItems()` upsert's `update` branch must NOT include `pendingInbox`. If it did, every re-sync would reset accepted items back to inbox.

3. **Dismiss from inbox vs feed**: Both paths create `SyncOverride(DISMISSED)`. The inbox dismiss also sets `pendingInbox = false`. The feed dismiss path assumes `pendingInbox = false` already.

4. **Item ID prefix**: Inbox items use `"inbox:<uuid>"` prefix. Strip prefix in route handlers before DB operations.

5. **Empty groups**: If all items in a group are accepted/dismissed, the group disappears automatically (frontend filters out empty groups).

6. **dismissedCount in buildInbox**: `SyncOverride(DISMISSED)` records accumulate over time from both inbox and feed dismissals. All dismissed IDs are excluded from inbox query — this is correct behavior (dismissed = never show again unless source item genuinely changes).

7. **Sync is async**: `POST /api/integrations/sync` returns 202 immediately. The frontend `refresh()` polls `lastSyncAt` to know when jobs complete before reloading.

8. **Gmail 403 is permanent**: If Gmail returns 403, the integration needs to be disconnected and re-authorized. A token refresh cannot fix missing OAuth scopes.

---

## Test Checklist

### Backend (190 tests passing)

- [x] `buildInbox` returns only `pendingInbox=true` items
- [x] `buildInbox` excludes dismissed items
- [x] `buildInbox` groups by integrationId correctly
- [x] `acceptInboxItem` sets `pendingInbox=false`
- [x] `acceptInboxItem` throws 409 for non-inbox items
- [x] `dismissInboxItem` sets `pendingInbox=false` and creates DISMISSED override
- [x] `acceptAll` accepts only items matching integrationId
- [x] `dismissAll` dismisses only items matching integrationId
- [x] `getInboxCount` returns correct count
- [x] All inbox API routes: `GET /api/inbox`, `GET /api/inbox/count`, PATCH accept/dismiss, POST accept-all/dismiss-all

### Frontend (93 tests passing)

- [x] `InboxItem` renders accept and dismiss buttons
- [x] `InboxGroup` renders Accept All / Dismiss All buttons
- [x] `InboxPage` renders empty state when inbox is empty
- [x] `AccountMenu` shows badge when count > 0


### Backend (new)

| File | Purpose |
|------|---------|
| `backend/src/inbox/inbox.service.ts` | `buildInbox()`, `acceptItem()`, `dismissItem()`, `acceptAll()`, `dismissAll()`, `getCount()` |
| `backend/src/api/inbox.routes.ts` | Fastify route handlers for all `/api/inbox/*` endpoints |
| `backend/tests/unit/inbox/inbox.service.test.ts` | Unit tests for inbox service logic |
| `backend/tests/contract/inbox.routes.test.ts` | Contract tests for all inbox API routes |

### Backend (modified)

| File | What Changes |
|------|-------------|
| `backend/prisma/schema.prisma` | Add `pendingInbox Boolean @default(false)` + index to `SyncCacheItem` |
| `backend/prisma/migrations/` | New migration: `add_pending_inbox_to_sync_cache_item` |
| `backend/src/sync/cache.service.ts` | Set `pendingInbox: true` in the `create` branch of `persistCacheItems()` |
| `backend/src/feed/feed.service.ts` | Add `pendingInbox: false` filter in `getCacheItemsForUser()` |
| `backend/src/server.ts` | Register `inbox.routes.ts` |

### Frontend (new)

| File | Purpose |
|------|---------|
| `frontend/src/services/inbox.service.ts` | API calls: `getInbox()`, `getInboxCount()`, `acceptItem()`, etc. |
| `frontend/src/hooks/useInbox.ts` | React hook wrapping `inbox.service.ts` with loading/error state |
| `frontend/src/app/inbox/page.tsx` | `/inbox` page — renders `InboxGroup` list |
| `frontend/src/components/inbox/InboxPage.tsx` | Main inbox view component |
| `frontend/src/components/inbox/InboxGroup.tsx` | Source group with Accept All / Dismiss All header |
| `frontend/src/components/inbox/InboxItem.tsx` | Individual item row with Accept / Dismiss buttons |
| `frontend/tests/unit/components/inbox/InboxItem.test.tsx` | Unit tests |
| `frontend/tests/unit/components/inbox/InboxGroup.test.tsx` | Unit tests |

### Frontend (modified)

| File | What Changes |
|------|-------------|
| `frontend/src/components/AccountMenu.tsx` | Add "Inbox" link with count badge |
| `frontend/src/app/feed/page.tsx` | Refresh button becomes `<Link href="/inbox">` with badge when `inboxCount > 0`; `refreshing` spinner replaces removed `triageLoading`; TriageSheet removed |
| `frontend/src/hooks/useFeed.ts` | All triage state removed (`pendingItems`, `isTriageOpen`, `triageLoading`, `newItemCount`); `refresh()` polls `lastSyncAt` on integrations until all syncs complete (2s interval, 30s timeout) before reloading feed |

---

## Backend Implementation Guide

### Step 1: DB Migration

```bash
cd backend
# Add pendingInbox to schema.prisma, then:
pnpm prisma migrate dev --name add_pending_inbox_to_sync_cache_item
pnpm prisma:generate
```

### Step 2: `cache.service.ts` — Set `pendingInbox: true` on create

```typescript
// In persistCacheItems(), upsert create branch:
create: {
  // ... existing fields ...
  pendingInbox: true,   // NEW
}
// update branch: do NOT include pendingInbox
```

### Step 3: `feed.service.ts` — Filter to accepted items only

```typescript
// In getCacheItemsForUser():
where: {
  userId,
  expiresAt: { gt: now },
  pendingInbox: false,          // NEW
  id: { notIn: dismissedIds },
}
```

### Step 4: `inbox.service.ts` — Core logic

```typescript
export async function buildInbox(userId: string): Promise<InboxResult>
export async function getInboxCount(userId: string): Promise<number>
export async function acceptInboxItem(userId: string, syncCacheItemId: string): Promise<void>
export async function dismissInboxItem(userId: string, syncCacheItemId: string): Promise<void>
export async function acceptAll(userId: string, integrationId: string): Promise<{ accepted: number }>
export async function dismissAll(userId: string, integrationId: string): Promise<{ dismissed: number }>
```

**`acceptInboxItem` logic:**
1. Verify item exists and `userId` matches
2. Verify `pendingInbox = true` (otherwise 409)
3. `prisma.syncCacheItem.update({ id, data: { pendingInbox: false } })`

**`dismissInboxItem` logic:**
1. Verify item exists and `userId` matches
2. Set `pendingInbox = false` AND create `SyncOverride(DISMISSED)` in a transaction

**`buildInbox` logic:**
1. Fetch all `SyncOverride(DISMISSED)` IDs for user
2. Query `SyncCacheItem` where `userId AND pendingInbox=true AND expiresAt>now AND id NOT IN dismissedIds`
3. Join `Integration` for group metadata
4. Group by `integrationId`, build `InboxGroup[]`

### Step 5: `inbox.routes.ts` — Register routes

```typescript
// Register in server.ts same way as feed.routes.ts
await registerInboxRoutes(app);
```

---

## Frontend Implementation Guide

### InboxGroup component layout

```
┌──────────────────────────────────────────────────────┐
│ 📧 Gmail · personal@gmail.com          [Accept All] [Dismiss All] │
├──────────────────────────────────────────────────────┤
│ ▸ Project update from Alice                [✓] [✕]   │
│ ▸ Invoice #4421 from Acme Corp             [✓] [✕]   │
└──────────────────────────────────────────────────────┘
```

`[✓]` = Accept  `[✕]` = Dismiss

### AccountMenu badge

```tsx
// In AccountMenu.tsx, add inbox count:
const { count } = useInboxCount();   // polls GET /api/inbox/count

<Link href="/inbox">
  Inbox
  {count > 0 && <Badge>{count}</Badge>}
</Link>
```

### Feed page — Refresh button

The refresh button badge reads `inboxCount` from `useInboxCount()`. When `inboxCount > 0`, the button becomes a `<Link href="/inbox">` with the count badge — clicking navigates directly to the inbox. When the inbox is empty, it stays as a standard refresh button that triggers sync and waits for all integration `lastSyncAt` timestamps to advance before reloading the feed.

> **TriageSheet removed**: The `TriageSheet` component (bottom-sheet staging area) was removed during implementation. The inbox page replaces it entirely. The `useFeed` hook no longer contains any triage state.

---

## Key Gotchas

1. **Migration default**: `pendingInbox DEFAULT false` — existing items stay in feed. Do NOT set default to `true`.

2. **Update path**: `persistCacheItems()` upsert's `update` branch must NOT include `pendingInbox`. If it did, every re-sync would reset accepted items back to inbox.

3. **Dismiss from inbox vs feed**: Both paths create `SyncOverride(DISMISSED)`. The inbox dismiss also sets `pendingInbox = false`. The feed dismiss path (`feed.service.ts`) assumes `pendingInbox = false` already — no change needed there.

4. **Item ID prefix**: Inbox items use `"inbox:<uuid>"` prefix for consistency with `"sync:<uuid>"` and `"native:<uuid>"` in the feed. Strip prefix in route handlers before DB operations.

5. **Empty groups**: If all items in a group are accepted/dismissed, the group disappears. Frontend should handle empty groups gracefully (don't render the group header).

6. **Count endpoint performance**: The `/api/inbox/count` query should use the `@@index([userId, pendingInbox])` index. Verify EXPLAIN plan if the table grows large.

---

## Test Checklist

### Backend unit tests (`inbox.service.test.ts`)

- [x] `buildInbox` returns only `pendingInbox=true` items
- [x] `buildInbox` excludes dismissed items
- [x] `buildInbox` groups by integrationId correctly
- [x] `acceptInboxItem` sets `pendingInbox=false`
- [x] `acceptInboxItem` throws 409 for non-inbox items
- [x] `dismissInboxItem` sets `pendingInbox=false` and creates DISMISSED override
- [x] `acceptAll` accepts only items matching integrationId
- [x] `dismissAll` dismisses only items matching integrationId
- [x] `getInboxCount` returns correct count

### Backend contract tests (`inbox.routes.test.ts`)

- [x] `GET /api/inbox` → 200 with grouped structure
- [x] `GET /api/inbox/count` → 200 `{ count: N }`
- [x] `PATCH /api/inbox/items/:id/accept` → 200; 404 if not found
- [x] `PATCH /api/inbox/items/:id/dismiss` → 200; 404 if not found
- [x] `POST /api/inbox/accept-all` → 200 `{ accepted: N }`
- [x] `POST /api/inbox/dismiss-all` → 200 `{ dismissed: N }`

### Feed regression tests

- [x] `GET /api/feed` no longer returns `pendingInbox=true` items
- [x] Accepting an inbox item makes it appear in `GET /api/feed`
- [x] Dismissing an inbox item does NOT appear in feed

### Frontend unit tests

- [x] `InboxItem` renders accept and dismiss buttons
- [x] `InboxGroup` renders Accept All / Dismiss All buttons
- [x] `InboxGroup` calls `dismissAll` when Dismiss All clicked
- [x] `InboxPage` renders empty state when inbox is empty
- [x] `AccountMenu` shows badge when count > 0, no badge when count = 0
