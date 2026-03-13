# Data Model: App Polish & Bug Fix Bundle

**Branch**: `012-app-polish-bugfix`  
**Phase**: 1 — Design & Contracts  
**Generated**: 2025-07-24

---

## Summary

This feature bundle makes **no changes to the database schema or Prisma models**.
All three issues (#45, #41, #40) are resolved purely in the frontend layer.
This document records the two in-memory data shapes that are directly relevant to
the refresh fix and the dead-code removal.

---

## Relevant Existing Types

### `FetchFeedOptions` (frontend/src/services/feed.service.ts)

The options object passed to `feedService.fetchFeed()`. This type governs the
behaviour of both the polling loop (which was broken) and the final reload (which
was correct).

```typescript
interface FetchFeedOptions {
  showDismissed?: boolean;   // Whether to include dismissed items in the response
  includeCompleted?: boolean; // Whether to include completed items in the response
}
```

**Canonical usage rule** (established by this fix):  
Every call to `fetchFeed()` inside `useFeed` — including polling-loop calls — MUST
forward both `showDismissed` and `includeCompleted` from the hook's resolved options.
Callers outside the hook MUST pass explicit values.

**Before fix (broken)**:
```typescript
// polling loop — ignores hook options
fetchFeed({ showDismissed: false })
```

**After fix**:
```typescript
// polling loop — consistent with reloadFeed()
fetchFeed({ includeCompleted: true, showDismissed })
```

---

### `FeedResponse` (frontend/src/services/feed.service.ts)

The shape returned by `GET /api/feed` and stored in `useFeed` state.

```typescript
interface FeedResponse {
  items: FeedItem[];           // Active (non-dismissed, non-completed) feed items
  completed: FeedItem[];       // Completed items (present when includeCompleted: true)
  syncStatus: Record<string, SyncStatus>; // Per-integration sync timestamps
}

interface SyncStatus {
  lastSyncAt: string | null;   // ISO 8601 timestamp; used by polling loop to detect sync completion
  status: 'syncing' | 'idle' | 'error';
}
```

**Polling loop termination condition** (unchanged; documented for clarity):
```typescript
const allDone = Object.entries(preSyncTimes).every(([id, before]) => {
  const after = feed.syncStatus[id]?.lastSyncAt;
  return after && after !== before;   // Integration has updated since pre-sync snapshot
});
```

---

## Removed Types (Dead Code — #40)

These types are removed as part of the cleanup. No callers outside tests reference them.

```typescript
// DELETED — frontend/src/services/feed.service.ts
interface DismissedItem {
  // ... fields
}

interface DismissedItemsResponse {
  items: DismissedItem[];
  // ... pagination fields
}
```

**Replacement**: Dismissed items are fetched via the standard `FeedResponse` path by
passing `showDismissed: true` to `fetchFeed()`. No separate endpoint or type needed.

---

## State Transitions

The `useFeed` hook manages three boolean/string state values relevant to refresh:

| State Variable | Before Refresh | During Polling | After Refresh |
|---------------|----------------|----------------|---------------|
| `refreshing` | `false` | `true` | `false` |
| `error` | previous value | unchanged (cleared only on success) | `null` on success; error string if timeout with no sync detected |
| `data` | last loaded feed | **updated each poll tick** (now with correct options) | updated to final `reloadFeed()` result |

**Key constraint**: `data` must reflect the same `showDismissed` / `includeCompleted`
options during polling as it does after the final reload. The fix enforces this.
