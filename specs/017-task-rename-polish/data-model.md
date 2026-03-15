# Data Model: Task Rename, Console Error Fix & Documentation Polish

**Spec**: 017-task-rename-polish | **Phase**: 1 Design

## Overview

No new database tables. One enum value added to an existing enum. One view model extended.

---

## Database Changes

### `OverrideType` enum (PostgreSQL / Prisma)

**File**: `backend/prisma/schema.prisma`

Current:
```prisma
enum OverrideType {
  REOPENED
  DISMISSED
  DESCRIPTION_OVERRIDE
}
```

After:
```prisma
enum OverrideType {
  REOPENED
  DISMISSED
  DESCRIPTION_OVERRIDE
  TITLE_OVERRIDE   // ← New
}
```

**Migration**: Prisma will generate an `ALTER TYPE ... ADD VALUE` migration. This is non-destructive; no data backfill required.

### `SyncOverride` table (unchanged)

```prisma
model SyncOverride {
  id              String       @id @default(cuid())
  syncCacheItemId String
  overrideType    OverrideType
  value           String?      // Stores the custom title string for TITLE_OVERRIDE
  syncCacheItem   SyncCacheItem @relation(fields: [syncCacheItemId], references: [id])
  @@unique([syncCacheItemId, overrideType])  // One override per type per item
}
```

The `@@unique` constraint ensures idempotent upserts — setting a title override twice is always a safe UPDATE.

---

## View Model Changes (frontend)

### `FeedItem` type

**File**: `frontend/src/services/feed.service.ts`

Current relevant fields:
```ts
export type FeedItem = {
  id: string
  title: string
  // ... other fields
  hasDescriptionOverride: boolean
  descriptionOverride: string | null
  descriptionUpdatedAt: string | null
  // ...
}
```

After (additions only):
```ts
export type FeedItem = {
  id: string
  title: string                  // display title (custom if set, else original synced title)
  // ... other fields
  hasDescriptionOverride: boolean
  descriptionOverride: string | null
  descriptionUpdatedAt: string | null
  hasTitleOverride: boolean      // ← New: true if user has set a custom title
  originalTitle: string | null   // ← New: always the raw SyncCacheItem.title; null for native tasks
}
```

### `FeedItem` API Response shape (backend)

**File**: `backend/src/feed/feed.service.ts`

Current assembly (excerpt):
```ts
title: item.title,
// ... no title override handling
hasDescriptionOverride: !!descOverride,
descriptionOverride: descOverride?.value ?? null,
```

After:
```ts
title: titleOverride?.value ?? item.title,   // custom title wins
originalTitle: item.title,                   // always the raw synced title
hasTitleOverride: !!titleOverride,
hasDescriptionOverride: !!descOverride,
descriptionOverride: descOverride?.value ?? null,
```

For native tasks (`NativeTask`), `originalTitle: null` and `hasTitleOverride: false` since there is no external sync source.

---

## API Contract Changes

### New endpoint

`PATCH /api/feed/sync/:id/title-override`

**Request body**:
```json
{ "value": "My custom title" }
```
or to clear:
```json
{ "value": null }
```

**Response**: Updated `FeedItem` (full object, same shape as `GET /api/feed`)

**Side effects**:
- If `value !== null`: upserts `TITLE_OVERRIDE`, then upserts `DESCRIPTION_OVERRIDE` to prepend `"Original: {syncCacheItem.title}"` (skipped if description override already starts with that prefix — idempotency check).
- If `value === null`: deletes `TITLE_OVERRIDE` record; `DESCRIPTION_OVERRIDE` is left untouched.

**Error cases**:
- `404` — sync item not found or does not belong to the authenticated user
- `400` — `value` is an empty string (title cannot be blank; use `null` to clear instead)

---

## No Changes

The following are explicitly **unchanged** by this spec:

- `NativeTask` model — rename is a direct title update via existing `PUT /api/tasks/:id`
- `SyncCacheItem` model — no new fields; the raw `title` remains the sync source of truth
- `Integration` model — no changes
- All other `OverrideType` values and their handling — `REOPENED`, `DISMISSED`, `DESCRIPTION_OVERRIDE` logic untouched
