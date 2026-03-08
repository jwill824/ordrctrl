# Research: Uncheck Completed Tasks

## 1. Sync Conflict Resolution Pattern

**Decision**: Local override always wins — user action takes precedence over source system state.

**Rationale**: ordrctrl is a personal workspace of record. When a user explicitly reopens a
task, that intent must be preserved across sync cycles. This matches the behavior of apps like
Fantastical and Todoist, where the local app state is authoritative and sync is additive, not
destructive.

**Implementation**: A `SyncOverride` record (new Prisma model) is written when the user
uncompletes a sync-sourced item. The background sync job checks for an existing override before
applying a "completed" state from the source — if an override exists, the source state is
ignored.

**Alternatives considered**:
- Source wins: Rejected — would silently undo user actions, creating a confusing UX.
- User prompted at sync time: Rejected — too much friction for a common background operation.

---

## 2. Optimistic UI Update Pattern

**Decision**: Move item from `completed` array back to `items` array immediately on uncheck,
roll back on API failure.

**Rationale**: The existing `completeItem()` in `useFeed.ts` already uses this pattern. Keeping
the same approach ensures consistency in perceived performance and error handling behavior.

**Implementation**: In `useFeed.ts`, `uncompleteItem()` will:
1. Remove item from `completed` state immediately
2. Re-insert at top of `items` state
3. Call backend API
4. On failure: reverse the move and show an error toast

**Alternatives considered**:
- Wait for API before updating UI: Rejected — latency would make checkbox feel broken.

---

## 3. Inline Notice for Integration-Sourced Items

**Decision**: Show a brief dismissible inline notice below the reopened item the first time
it appears back in the active feed, informing the user the change is local to ordrctrl only.

**Rationale**: The spec (FR-003) requires this notice. One-time-per-item is sufficient —
showing it on every view would be noisy. A "don't show again" option is out of scope.

**Implementation**: Pass an `isJustReopened` flag from the `uncompleteItem()` state update.
`FeedItem.tsx` renders a small inline note when `isJustReopened === true`. The flag lives
only in client-side state (not persisted) and clears on page reload.

**Alternatives considered**:
- Toast notification: Rejected — toast is ephemeral and easy to miss; inline is more
  discoverable and tied to the specific item.
- Always show notice: Rejected — per spec, this is informational, not a permanent label.

---

## 4. API Design: Toggle vs. Separate Endpoints

**Decision**: Separate endpoint — `PATCH /api/feed/items/:itemId/uncomplete` — rather than
modifying the existing `complete` endpoint to toggle.

**Rationale**: Separate endpoints are more explicit, easier to test, and prevent accidental
double-fire toggling. The existing `complete` endpoint remains unchanged (no regression risk).

**Alternatives considered**:
- Single toggle endpoint (`PATCH /api/feed/items/:itemId/toggle`): Rejected — harder to
  test intent; toggling can produce unexpected results if requests are duplicated.
- Modify `updateTask()` to accept `completed: false`: Rejected — `updateTask` currently
  intentionally excludes the `completed` field for safety; changing that broadens scope.

---

## 5. SyncOverride Schema Design

**Decision**: Add a new `SyncOverride` Prisma model linked to `SyncCacheItem`.

**Rationale**: Keeping override records separate from `SyncCacheItem` preserves the cache
table's role as a pure sync mirror and allows the override concept to be extended toward
two-way sync (issue #10) without schema migration later.

**Fields**:
- `id` — UUID primary key
- `userId` — owner (for authorization checks)
- `syncCacheItemId` — FK to `SyncCacheItem`
- `overrideType` — enum: `REOPENED` (extensible to `COMPLETED`, `EDITED` for two-way sync)
- `createdAt` — timestamp

**Alternatives considered**:
- Add `userOverrideCompleted: Boolean` directly to `SyncCacheItem`: Rejected — pollutes the
  cache model and doesn't extend cleanly to future override types.
