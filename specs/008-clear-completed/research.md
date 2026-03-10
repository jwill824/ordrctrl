# Research: Clear Completed Tasks

**Branch**: `008-clear-completed` | **Date**: 2026-03-10

## Decision Log

### D-001: Clear Action Maps to Existing Dismiss Behavior

**Decision**: "Clearing" a completed task = dismissing it via the existing dismiss mechanism.  
**Rationale**: `dismissFeedItem()` already handles both sync items (`SyncOverride(DISMISSED)`) and native tasks (`dismissed: true`). Reusing this pattern means cleared items appear in the dismissed items page (individually restorable), no new data lifecycle is introduced, and the behavior is immediately familiar.  
**Alternatives considered**: Separate "cleared" state on items — rejected because it duplicates dismissed semantics without user benefit and increases schema complexity.

### D-002: New Bulk Endpoint Required

**Decision**: Add `DELETE /api/feed/completed` as a new bulk clear endpoint.  
**Rationale**: No bulk dismiss endpoint exists. Per-item dismiss loop from the server is inefficient for 100+ items. A single bulk operation can be done in two DB statements (one for sync, one for native) regardless of count.  
**Alternatives considered**: Client-side loop calling individual dismiss endpoints — rejected because it creates N network roundtrips and partial-failure risk.

### D-003: Exclude REOPENED-Override Items From Clear

**Decision**: The clear endpoint fetches completed items then filters out any `SyncCacheItem` that has an active `SyncOverride(REOPENED)` for the same user. Native tasks have no REOPENED concept (they use the `completed` flag directly) so native items are filtered only by `completed = true AND dismissed = false`.  
**Rationale**: An item with a REOPENED override is treated as "active" per the spec and user intent. Clearing it would violate that intent.  
**Alternatives considered**: Clearing REOPENED items too — rejected per spec requirement FR-007.

### D-004: User Settings for Auto-Clear (P2) — Defer Schema Change

**Decision**: No `UserSettings` table or column exists. For P2 auto-clear, add a `settings` JSON column to the `User` model rather than a dedicated table.  
**Rationale**: A JSON column on `User` is the simplest path consistent with the Constitution's simplicity principle. It avoids a new table join for a small preferences payload. Since this is a P2 story, the schema change is scoped to Phase 2 of implementation only — P1 ships with no schema changes.  
**Alternatives considered**: New `UserSettings` table — rejected as over-engineered for one setting; `autoClearWindowDays Int?` directly on `User` — viable but inflexible for future settings growth; JSON column wins.

### D-005: Auto-Clear Fires in the Sync Cycle

**Decision**: Auto-clear logic runs as a post-sync step in `sync.worker.ts` after each sync job completes.  
**Rationale**: The sync cycle runs on a 15-minute interval (BullMQ). Piggy-backing on this interval avoids a new cron job, new infrastructure, and keeps side-effect timing consistent with spec requirement SC-005 (≤ 15 min after window expiry).  
**Alternatives considered**: Separate scheduled job — rejected as unnecessary infrastructure complexity; On-demand check at feed render time — rejected because it would add latency to every feed load.

### D-006: Frontend State — React Query Not Used; Pattern Follows useFeed Hook

**Decision**: The clear action follows the existing `useFeed` hook pattern: add `clearCompleted` to the hook, call `feedService.clearAllCompleted()`, optimistically empty the completed array, show a count toast.  
**Rationale**: The app doesn't use React Query — it uses direct fetch + manual state + custom hooks. Adding `clearCompleted` to `useFeed` is consistent with `dismissItem`, `completeItem`, etc. already defined there.  
**Alternatives considered**: React Query mutation — rejected as inconsistent with codebase pattern.

### D-007: Confirmation UX — Toast (No Modal Dialog)

**Decision**: Show a toast notification (same visual style as existing undo toast) confirming how many items were cleared. No confirmation dialog before the action.  
**Rationale**: The spec explicitly states "no confirmation dialog — fast and clean by design." The toast provides sufficient feedback without blocking the workflow. Items are restorable individually from dismissed items.  
**Alternatives considered**: Confirmation modal ("Are you sure?") — rejected per spec design decision.
