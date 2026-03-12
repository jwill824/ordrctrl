# Data Model: Feed UX Enhancements & Cleanup (011)

## Schema Changes

### 1. `SyncCacheItem` — Add `userDueAt` field

```prisma
model SyncCacheItem {
  id                   String    @id @default(uuid())
  integrationId        String
  userId               String
  itemType             ItemType
  externalId           String
  title                String
  dueAt                DateTime?   // source-provided date (updated on every sync)
  startAt              DateTime?
  endAt                DateTime?
  completedInOrdrctrl  Boolean   @default(false)
  completedAt          DateTime?
  completedAtSource    Boolean   @default(false)
  syncedAt             DateTime  @default(now())
  expiresAt            DateTime
  pendingInbox         Boolean   @default(false)
  rawPayload           Json

  // NEW FIELD
  userDueAt            DateTime?
  // null = no user override; use source dueAt
  // non-null = user-assigned date; used only when source dueAt is null

  integration          Integration   @relation(fields: [integrationId], references: [id], onDelete: Cascade)
  overrides            SyncOverride[]

  @@unique([integrationId, externalId])
  @@index([userId])
  @@index([userId, pendingInbox])
}
```

**Migration**: `ALTER TABLE "SyncCacheItem" ADD COLUMN "userDueAt" TIMESTAMP(3);`

All existing rows default to `NULL` — no impact on current behavior.

---

## No Other Schema Changes

All other changes in this feature are frontend-only or are behavioral changes to existing queries:

| Concern | Approach | Schema Impact |
|---------|----------|---------------|
| Onboarding redirect | Next.js server-side `redirect()` | None |
| Date staleness fix | `useLiveDate` hook ticks every minute | None |
| Feed sections | Split `FeedItem[]` by `effectiveDueAt` in frontend | None |
| Dismissed inline view | `GET /api/feed?showDismissed=true` query param | None |
| Permanent delete | `DELETE /api/feed/items/:itemId/permanent` — hard deletes existing row | None (existing cascade) |
| User-assigned due date | `userDueAt` field on `SyncCacheItem` | **ONE new nullable column** |

---

## Effective Due Date Merge Logic

The `buildFeed()` service computes an **effective due date** for each item:

```typescript
// Merge rule: source is authoritative when it provides a date
const effectiveDueAt = dueAt ?? userDueAt ?? null;
// dueAt     = source-provided date (from integration sync)
// userDueAt = user-assigned date (from PATCH /items/:id/user-due-date)
// If dueAt is non-null: source wins (effectiveDueAt = dueAt)
// If dueAt is null AND userDueAt is non-null: user override used
// If both null: task is undated
```

This is exposed as `dueAt` in the `FeedItem` response — the frontend does not need to know about `userDueAt` as a separate field. The API also exposes `hasUserDueAt: boolean` so the UI can show an "overridden date" indicator when appropriate.

---

## FeedItem Shape Changes

One new boolean field added to `FeedItem`:

```typescript
export interface FeedItem {
  id: string;
  source: string;
  serviceId: string;
  itemType: 'task' | 'event' | 'message';
  title: string;
  dueAt: string | null;           // effectiveDueAt (userDueAt ?? source dueAt)
  startAt: string | null;
  endAt: string | null;
  completed: boolean;
  completedAt: string | null;
  isDuplicateSuspect: boolean;
  dismissed: boolean;             // NEW (needed to distinguish in showDismissed view)
  hasUserDueAt: boolean;          // NEW — true if userDueAt was applied (for UI indicator)
}
```

---

## Dismissed Items — No Schema Change

Permanent delete is a hard `DELETE` on the underlying row. The cascade defined in Prisma (`onDelete: Cascade` on `SyncOverride → SyncCacheItem`) means `SyncOverride` records are automatically removed when the parent `SyncCacheItem` is deleted.

For `NativeTask` permanent delete, the `NativeTask` row is deleted directly (`dismissed: true` is required first as a safety check).

---

## Entity Relationships (unchanged)

```
User
 ├── Integration (1:N)
 │    └── SyncCacheItem (1:N)     ← userDueAt added here
 │         └── SyncOverride (1:N) ← cascade-deleted on SyncCacheItem delete
 └── NativeTask (1:N)             ← unchanged; uses existing dueAt field
```
