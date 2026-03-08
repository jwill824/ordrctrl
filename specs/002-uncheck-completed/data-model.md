# Data Model: Uncheck Completed Tasks

## Existing Models (relevant fields)

### NativeTask *(no schema changes needed)*

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` UUID | Primary key |
| `userId` | `String` | FK → User |
| `completed` | `Boolean` | `false` = open, `true` = complete |
| `completedAt` | `DateTime?` | Null when open |

**Uncomplete behavior**: Set `completed = false`, `completedAt = null`.

---

### SyncCacheItem *(no schema changes needed)*

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` UUID | Primary key |
| `userId` | `String` | FK → User |
| `completedInOrdrctrl` | `Boolean` | `true` when user marked complete in ordrctrl |
| `completedAt` | `DateTime?` | Null when open |

**Uncomplete behavior**: Set `completedInOrdrctrl = false`, `completedAt = null`.

---

## New Model: SyncOverride

Tracks when a user has explicitly overridden the source system's completion state for a
synced item. The sync engine checks for an active `REOPENED` override before applying a
"completed" state from the source.

```prisma
model SyncOverride {
  id              String         @id @default(uuid())
  userId          String
  syncCacheItemId String
  overrideType    OverrideType
  createdAt       DateTime       @default(now())

  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  syncCacheItem   SyncCacheItem  @relation(fields: [syncCacheItemId], references: [id], onDelete: Cascade)

  @@unique([syncCacheItemId, overrideType])
  @@index([userId])
  @@index([syncCacheItemId])
}

enum OverrideType {
  REOPENED
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `userId` | String | Owner — used for authorization |
| `syncCacheItemId` | String | FK → SyncCacheItem (cascade delete) |
| `overrideType` | OverrideType | `REOPENED` for uncheck; extensible for future two-way sync |
| `createdAt` | DateTime | When the override was created |

### Constraints

- `@@unique([syncCacheItemId, overrideType])` — only one active override per item per type
- Cascade deletes: removing a SyncCacheItem removes its overrides automatically
- Re-checking a reopened item (re-completing it) MUST delete the associated `SyncOverride` record

---

## State Transitions

### Native Task

```
open ──[check]──► complete
complete ──[uncheck]──► open
```

### Sync Cache Item

```
open ──[check]──► completedInOrdrctrl=true
completedInOrdrctrl=true ──[uncheck]──► completedInOrdrctrl=false + SyncOverride(REOPENED) created
SyncOverride(REOPENED) exists ──[sync cycle, source=complete]──► ignore source state (override wins)
SyncOverride(REOPENED) exists ──[re-check by user]──► completedInOrdrctrl=true + SyncOverride deleted
```

---

## Sync Conflict Resolution Logic

When a sync cycle processes an item that the user has reopened:

```
if SyncOverride(REOPENED) exists for item:
    skip updating completedInOrdrctrl (user override wins)
else:
    apply source completion state as normal
```
