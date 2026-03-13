# Data Model: Task Content Enhancements

**Branch**: `013-task-content-enhancements` | **Feature**: #44 + #38  
**Status**: Final — confirmed against existing schema in `backend/prisma/schema.prisma`

---

## Schema Changes (Prisma / PostgreSQL)

### 1. `OverrideType` enum — add `DESCRIPTION_OVERRIDE`

```prisma
enum OverrideType {
  REOPENED
  DISMISSED
  DESCRIPTION_OVERRIDE   // NEW — user-authored description for a synced task
}
```

**Migration**: Add enum value via `ALTER TYPE "OverrideType" ADD VALUE 'DESCRIPTION_OVERRIDE';`
(additive; no existing rows affected).

---

### 2. `SyncOverride` — add `value` column

```prisma
model SyncOverride {
  id              String       @id @default(uuid())
  userId          String
  syncCacheItemId String
  overrideType    OverrideType
  value           String?      // NEW — payload for value-bearing overrides (e.g., DESCRIPTION_OVERRIDE)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt  // NEW — tracks last edit time for description overrides

  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  syncCacheItem SyncCacheItem @relation(fields: [syncCacheItemId], references: [id], onDelete: Cascade)

  @@unique([syncCacheItemId, overrideType])
  @@index([userId])
}
```

**Changes from current**:
- `value String?` — nullable text payload; `null` for flag-only overrides (`DISMISSED`,
  `REOPENED`); required non-empty string for `DESCRIPTION_OVERRIDE`.
- `updatedAt DateTime @updatedAt` — Prisma auto-managed timestamp; needed so the UI can show
  "edited at" metadata for description overrides.

**Constraint preserved**: `@@unique([syncCacheItemId, overrideType])` ensures at most one
description override per item. Upsert semantics: setting a new description updates the existing
`DESCRIPTION_OVERRIDE` row; clearing deletes it.

---

### 3. `SyncCacheItem` — add `body` and `url` columns

```prisma
model SyncCacheItem {
  // ... existing fields unchanged ...
  body             String?   // NEW — original integration-supplied description/body text
  url              String?   // NEW — deep-link back to the source item (e.g., Gmail thread URL)

  // ... existing relations and indexes unchanged ...
}
```

**`body`**: The unformatted text body from the source integration (email snippet, calendar event
description, task note). Populated by each adapter at sync time. Inherits the 24 h TTL via
`expiresAt`. Never mutated after initial sync — user edits go to `SyncOverride.value`.

**`url`**: The direct link back to the source item. Populated per integration:

| Integration | Source field | Example value |
|---|---|---|
| Gmail | Constructed from `messageId` | `https://mail.google.com/mail/u/0/#inbox/<threadId>` |
| Microsoft Tasks | `webLink` | `https://to-do.microsoft.com/tasks/id/<taskId>` |
| Apple Calendar | `VEVENT URL:` property | `https://...` or `webcal://...` |
| Apple Reminders | Not available | `null` |

---

## Frontend Type Changes

### `FeedItem` (frontend/src/services/feed.service.ts)

```ts
export interface FeedItem {
  // --- existing fields (unchanged) ---
  id: string;                     // "sync:<uuid>" | "native:<uuid>"
  source: string;
  serviceId: string;
  itemType: 'task' | 'event' | 'message';
  title: string;
  dueAt: string | null;
  startAt: string | null;
  endAt: string | null;
  completed: boolean;
  completedAt: string | null;
  isDuplicateSuspect: boolean;
  dismissed: boolean;
  hasUserDueAt: boolean;

  // --- NEW fields ---
  originalBody: string | null;          // Original integration-supplied body (SyncCacheItem.body)
  description: string | null;           // Effective description: override if set, else originalBody
  hasDescriptionOverride: boolean;      // true when a DESCRIPTION_OVERRIDE record exists
  descriptionOverride: string | null;   // The user-authored override text (null if none)
  descriptionUpdatedAt: string | null;  // ISO string — when the override was last saved
  sourceUrl: string | null;             // SyncCacheItem.url — null for native tasks or missing URL
}
```

**Field semantics**:
- `description` is the display field: components read this for the effective description.
- `originalBody` is always the raw integration text; components show this in the "view original"
  expandable section.
- `hasDescriptionOverride` drives the "edited" badge visibility without a null check on
  `descriptionOverride`.
- `sourceUrl` drives "Open in [source]" visibility: render the button only when non-null.
- Native tasks (`serviceId === 'ordrctrl'`) always have `originalBody: null`, `sourceUrl: null`,
  `hasDescriptionOverride: false`.

---

## Entity Relationships

```
User
 └── SyncOverride (userId FK, onDelete: Cascade)
       └─ overrideType: DESCRIPTION_OVERRIDE
       └─ value: "user text"
       └─ updatedAt
 └── Integration
       └── SyncCacheItem (integrationId FK, onDelete: Cascade)
             └─ body: "original body"
             └─ url: "https://..."
             └── SyncOverride[] (syncCacheItemId FK, onDelete: Cascade)
```

The unique constraint `(syncCacheItemId, overrideType)` on `SyncOverride` means:
- One `DISMISSED` record per item
- One `DESCRIPTION_OVERRIDE` record per item
- One `REOPENED` record per item

---

## State Transitions: Description Override

```
          ┌────────────────────────────────────────────────────┐
          │                  Synced Task                       │
          │  [originalBody from SyncCacheItem.body]            │
          └────────────────────────────────────────────────────┘
                              │
        User opens EditTaskModal, types description, saves
                              ▼
          ┌────────────────────────────────────────────────────┐
          │  State: DESCRIPTION_OVERRIDE set                   │
          │  SyncOverride{ overrideType: DESCRIPTION_OVERRIDE  │
          │                value: "user text"                  │
          │                updatedAt: <timestamp> }            │
          │  FeedItem.hasDescriptionOverride = true            │
          │  FeedItem.description = "user text"                │
          │  FeedItem.originalBody = <original, unchanged>     │
          └────────────────────────────────────────────────────┘
                   │                         │
      User edits again, saves        User clears and saves
                   │                         │
                   ▼                         ▼
          ┌──────────────────┐    ┌──────────────────────────┐
          │  Override updated │    │  DESCRIPTION_OVERRIDE    │
          │  (upsert — same  │    │  row deleted             │
          │  SyncOverride id)│    │  hasDescriptionOverride  │
          │  value: "new"     │    │  → false                 │
          └──────────────────┘    │  description → original  │
                                  └──────────────────────────┘
```

**Cancel / discard**: No state transition occurs. The modal closes; the existing `SyncOverride`
row (or absence thereof) is unchanged.

**Integration re-sync**: `SyncCacheItem.body` and `SyncCacheItem.url` may be updated by the
adapter upsert. `SyncOverride` records are untouched — the user's description override survives
re-sync.

**Cache expiry / cascade delete**: When `SyncCacheItem` is deleted (TTL expiry or hard-delete),
all associated `SyncOverride` rows — including `DESCRIPTION_OVERRIDE` — are cascade-deleted.

---

## Validation Rules

| Field | Rule |
|---|---|
| `SyncOverride.value` when `overrideType = DESCRIPTION_OVERRIDE` | Required; non-empty after trim; max 50 000 characters |
| `SyncOverride.value` when `overrideType != DESCRIPTION_OVERRIDE` | Must be `null` (existing flag-only overrides carry no payload) |
| `SyncCacheItem.body` | Optional; stored verbatim from adapter; no length limit enforced (TTL bounds retention) |
| `SyncCacheItem.url` | Optional; must be a valid URL string if present (validated by adapter); stored as-is |
