# Data Model: Task Inbox (010)

## Schema Changes

### 1. `SyncCacheItem` — Add `pendingInbox` field

```prisma
model SyncCacheItem {
  id                  String    @id @default(uuid())
  integrationId       String
  userId              String
  itemType            ItemType
  externalId          String
  title               String
  dueAt               DateTime?
  startAt             DateTime?
  endAt               DateTime?
  completedInOrdrctrl Boolean   @default(false)
  completedAt         DateTime?
  completedAtSource   Boolean   @default(false)
  syncedAt            DateTime  @default(now())
  expiresAt           DateTime
  rawPayload          Json

  // NEW FIELD
  pendingInbox        Boolean   @default(false)
  // false = in feed (existing items + accepted items)
  // true  = staged in inbox (new items awaiting user triage)

  integration         Integration @relation(fields: [integrationId], references: [id], onDelete: Cascade)
  overrides           SyncOverride[]

  @@unique([integrationId, externalId])
  @@index([userId])
  @@index([userId, pendingInbox])       // NEW INDEX for inbox queries
}
```

**Migration**: `ALTER TABLE "SyncCacheItem" ADD COLUMN "pendingInbox" BOOLEAN NOT NULL DEFAULT false;`

All existing rows default to `false` — grandfathered into the feed with no disruption (satisfies FR-011).

---

## No New Tables

The inbox feature requires no new tables. State is captured by:

1. `SyncCacheItem.pendingInbox = true` → item is in the inbox (pending triage)
2. `SyncCacheItem.pendingInbox = false` → item is in the feed (accepted)
3. `SyncOverride(DISMISSED)` → item is in the dismissed archive (dismiss from inbox or feed)

---

## Entity Relationships (unchanged)

```
User
 ├── Integration (1:N)
 │    └── SyncCacheItem (1:N)     ← pendingInbox added here
 │         └── SyncOverride (1:N)
 └── NativeTask (1:N)             ← unchanged, no inbox concept
```

---

## State Transitions: SyncCacheItem

```
                    [sync creates NEW item]
                            │
                            ▼
               ┌─────────────────────────┐
               │   INBOX                  │
               │   pendingInbox = true    │
               │   No SyncOverride        │
               └────────────┬────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
         [accept]      [dismiss]    [item expires]
         from /inbox   from /inbox        │
              │             │             ▼
              ▼             ▼        ┌─────────┐
   ┌──────────────┐  ┌────────────┐  │ EXPIRED │
   │   FEED        │  │ DISMISSED  │  │ (pruned)│
   │ pendingInbox  │  │ pendingInbox=false      │
   │ = false       │  │ + SyncOverride(DISMISSED)
   └──────┬───────┘  └────────────┘  └─────────┘
          │
     [dismiss from feed]
          │
          ▼
   ┌────────────┐
   │ DISMISSED  │
   │ pendingInbox=false
   │ + SyncOverride(DISMISSED)
   └────────────┘
```

> **Note**: The old TriageSheet staging flow (where items could be staged in a bottom-sheet on manual refresh) has been removed. The `/inbox` page is the sole staging area.

---

## Write Path Changes

### `cache.service.ts` — `persistCacheItems()`

```typescript
// BEFORE (on create):
create: {
  integrationId, userId, itemType, externalId, title,
  dueAt, startAt, endAt, syncedAt, expiresAt, rawPayload,
  completedInOrdrctrl: false,
  completedAtSource: item.completed ?? false,
}

// AFTER (on create):
create: {
  integrationId, userId, itemType, externalId, title,
  dueAt, startAt, endAt, syncedAt, expiresAt, rawPayload,
  completedInOrdrctrl: false,
  completedAtSource: item.completed ?? false,
  pendingInbox: true,   // NEW — routes all new items to inbox
}

// UPDATE branch: unchanged — pendingInbox is NOT touched
// (accepted/dismissed state survives re-syncs)
```

---

## Read Path Changes

### `feed.service.ts` — `getCacheItemsForUser()` / `buildFeed()`

```typescript
// BEFORE filter:
WHERE userId = $1
  AND expiresAt > now()
  AND id NOT IN (dismissedIds)

// AFTER filter — add pendingInbox clause:
WHERE userId = $1
  AND expiresAt > now()
  AND pendingInbox = false          // NEW — only accepted items in feed
  AND id NOT IN (dismissedIds)
```

### New `inbox.service.ts` — `buildInbox()`

```typescript
// Inbox query:
WHERE userId = $1
  AND expiresAt > now()
  AND pendingInbox = true
  AND id NOT IN (dismissedIds)   // don't show dismissed items in inbox
ORDER BY syncedAt ASC            // oldest first for triage (FIFO)

// Group by integrationId, join Integration for label/accountIdentifier
```

---

## Inbox Item Shape

The inbox item is the same as a FeedItem but without completion controls:

```typescript
interface InboxItem {
  id: string;                    // "inbox:<syncCacheItemId>"
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

interface InboxGroup {
  integrationId: string;
  serviceId: string;
  accountLabel: string;
  accountIdentifier: string;
  items: InboxItem[];
}

interface InboxResult {
  groups: InboxGroup[];
  total: number;
}
```
