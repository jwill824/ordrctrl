# Data Model: ordrctrl Initial MVP

**Branch**: `001-mvp-core` | **Date**: 2026-03-05

## Entities

---

### User

Represents an ordrctrl account holder.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | UUID | Primary key, generated |
| `email` | String | Unique, not null, validated format |
| `passwordHash` | String \| null | Null for social-login-only accounts |
| `authProvider` | Enum(`email`, `google`, `apple`) | Not null |
| `providerAccountId` | String \| null | External ID from Google/Apple; null for email accounts |
| `emailVerified` | Boolean | Default false; true after verification or social login |
| `emailVerifyToken` | String \| null | Short-lived token for email verification flow |
| `passwordResetToken` | String \| null | Short-lived token for password reset flow |
| `passwordResetExpiry` | DateTime \| null | Expiry for reset token |
| `loginAttempts` | Int | Default 0; incremented on failed login |
| `lockedUntil` | DateTime \| null | Set when login throttle threshold exceeded |
| `createdAt` | DateTime | Auto-set on creation |
| `updatedAt` | DateTime | Auto-updated |

**State transitions**:
- `emailVerified: false` → `emailVerified: true` (on email click or social login)
- `loginAttempts` resets to 0 on successful login
- `lockedUntil` is set when `loginAttempts >= 5`; clears after lockout period

**Relationships**: One User → many Integrations; one User → many NativeTasks

---

### Integration

Represents a connected third-party service for a specific user.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `userId` | UUID | Foreign key → User.id, not null |
| `serviceId` | Enum(`gmail`, `apple_reminders`, `microsoft_tasks`, `apple_calendar`) | Not null |
| `status` | Enum(`connected`, `error`, `disconnected`) | Default `connected` |
| `encryptedAccessToken` | String | AES-256-GCM encrypted; never null when connected |
| `encryptedRefreshToken` | String \| null | AES-256-GCM encrypted; null if provider doesn't issue refresh tokens |
| `tokenExpiresAt` | DateTime \| null | When the access token expires |
| `gmailSyncMode` | Enum(`all_unread`, `starred_only`) \| null | Only set for Gmail integrations |
| `lastSyncAt` | DateTime \| null | Timestamp of most recent successful sync |
| `lastSyncError` | String \| null | Human-readable last error message; null if no error |
| `createdAt` | DateTime | Auto-set |
| `updatedAt` | DateTime | Auto-updated |

**Constraints**:
- One user can have at most one Integration per `serviceId` (unique constraint on `[userId, serviceId]`)
- `encryptedAccessToken` and `encryptedRefreshToken` MUST use AES-256-GCM; plaintext tokens MUST NOT be stored

**State transitions**:
- `connected` → `error` (on sync failure or token refresh failure)
- `error` → `connected` (on successful re-authorization)
- `connected` / `error` → `disconnected` (on user-initiated disconnect; record retained with status for audit, tokens deleted)

**Relationships**: One Integration → many SyncCacheItems (cascading delete on disconnect)

---

### SyncCacheItem

A single normalized item retrieved from an integration during sync. Bounded TTL ≤24h.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `integrationId` | UUID | Foreign key → Integration.id |
| `userId` | UUID | Foreign key → User.id (denormalized for query performance) |
| `itemType` | Enum(`task`, `event`, `message`) | Not null |
| `externalId` | String | Original ID from the source service; not null |
| `title` | String | Normalized display title; not null |
| `dueAt` | DateTime \| null | Due date/time (tasks/reminders); null if none |
| `startAt` | DateTime \| null | Start time for calendar events |
| `endAt` | DateTime \| null | End time for calendar events |
| `completedInOrdrctrl` | Boolean | Default false; true when user marks complete locally |
| `completedAt` | DateTime \| null | Timestamp when marked complete in ordrctrl |
| `syncedAt` | DateTime | When this item was last written from sync; not null |
| `expiresAt` | DateTime | `syncedAt + 24h`; items past this are stale |
| `rawPayload` | JSONB | Original payload from source API (for debugging; not displayed) |

**Constraints**:
- Unique on `[integrationId, externalId]` — prevents duplicate sync entries
- `expiresAt` enforced via scheduled cleanup job (runs with sync queue)
- `rawPayload` MUST NOT be exposed in API responses or logs (security)

**Relationships**: Many SyncCacheItems → one Integration

---

### NativeTask

A task created directly within ordrctrl (not from any integration).

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `userId` | UUID | Foreign key → User.id |
| `title` | String | Not null, max 500 chars |
| `dueAt` | DateTime \| null | Optional due date |
| `completed` | Boolean | Default false |
| `completedAt` | DateTime \| null | Set when marked complete |
| `createdAt` | DateTime | Auto-set |
| `updatedAt` | DateTime | Auto-updated |

**State transitions**:
- `completed: false` → `completed: true` (user marks done; sets `completedAt`)
- `completed: true` → `completed: false` (user unmarks; clears `completedAt`) — future consideration
- Deleted on user request (hard delete for MVP)

**Note**: NativeTask is a separate entity from SyncCacheItem. The feed aggregation layer
normalizes both into a common `FeedItem` view model for the frontend.

---

## Feed View Model (not persisted)

The `FeedItem` is a runtime view model assembled by the feed aggregation service from
SyncCacheItems and NativeTasks. It is never written to the database.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | `"sync:{syncCacheItemId}"` or `"native:{nativeTaskId}"` |
| `source` | String | `"Gmail"`, `"Apple Reminders"`, `"Microsoft Tasks"`, `"Apple Calendar"`, or `"ordrctrl"` |
| `itemType` | Enum(`task`, `event`, `message`) | Type for display purposes |
| `title` | String | Display title |
| `dueAt` | DateTime \| null | Sorting key for chronological feed |
| `completed` | Boolean | Whether marked complete in ordrctrl |
| `completedAt` | DateTime \| null | When completed |
| `isDuplicateSuspect` | Boolean | True if another FeedItem with the same title exists from a different source |
| `syncError` | Boolean | True if the source integration is in `error` status |

---

## Duplicate Detection Rule

Two FeedItems are flagged as duplicate suspects when:
- `title` (case-insensitive, trimmed) matches exactly
- `source` is different between the two items

Both items are shown; `isDuplicateSuspect: true` is set on each. No merging occurs.

---

## Feed Ordering Rules

1. Items with `dueAt` set → sorted ascending by `dueAt` (soonest first)
2. Calendar events (`itemType: event`) → sorted by `startAt` ascending
3. Items with no `dueAt` and no `startAt` → appended after dated items, sorted by `syncedAt` descending (most recently synced first)
4. Completed items → excluded from main feed; available in separate "Completed" section sorted by `completedAt` descending
