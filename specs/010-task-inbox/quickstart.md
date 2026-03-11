# Quickstart: Task Inbox (010)

## Overview

This guide covers the key development areas for the Task Inbox feature. All work happens on the `010-task-inbox` branch.

---

## Architecture in One Sentence

New `SyncCacheItem.pendingInbox` flag routes items to the inbox (`true`) or feed (`false`). Accepting from the inbox flips the flag. Dismissing from the inbox creates a `SyncOverride(DISMISSED)`.

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
| `frontend/src/app/feed/page.tsx` | Refresh button badge reads inbox count (not newItemCount) |

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

The existing `newItemCount` badge on the feed Refresh button should be replaced with (or unified with) the inbox count from `useInboxCount()`. Clicking the refresh button should still refresh the feed; the badge is an informational indicator pointing users toward `/inbox`.

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

- [ ] `buildInbox` returns only `pendingInbox=true` items
- [ ] `buildInbox` excludes dismissed items
- [ ] `buildInbox` groups by integrationId correctly
- [ ] `acceptInboxItem` sets `pendingInbox=false`
- [ ] `acceptInboxItem` throws 409 for non-inbox items
- [ ] `dismissInboxItem` sets `pendingInbox=false` and creates DISMISSED override
- [ ] `acceptAll` accepts only items matching integrationId
- [ ] `dismissAll` dismisses only items matching integrationId
- [ ] `getInboxCount` returns correct count

### Backend contract tests (`inbox.routes.test.ts`)

- [ ] `GET /api/inbox` → 200 with grouped structure
- [ ] `GET /api/inbox/count` → 200 `{ count: N }`
- [ ] `PATCH /api/inbox/items/:id/accept` → 200; 404 if not found
- [ ] `PATCH /api/inbox/items/:id/dismiss` → 200; 404 if not found
- [ ] `POST /api/inbox/accept-all` → 200 `{ accepted: N }`
- [ ] `POST /api/inbox/dismiss-all` → 200 `{ dismissed: N }`

### Feed regression tests

- [ ] `GET /api/feed` no longer returns `pendingInbox=true` items
- [ ] Accepting an inbox item makes it appear in `GET /api/feed`
- [ ] Dismissing an inbox item does NOT appear in feed

### Frontend unit tests

- [ ] `InboxItem` renders accept and dismiss buttons
- [ ] `InboxGroup` renders Accept All / Dismiss All buttons
- [ ] `InboxGroup` calls `dismissAll` when Dismiss All clicked
- [ ] `InboxPage` renders empty state when inbox is empty
- [ ] `AccountMenu` shows badge when count > 0, no badge when count = 0
