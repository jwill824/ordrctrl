# Research: Inbound Source Sync (007)

## Key Questions Resolved

---

### Decision 1: How to detect Gmail source completion

**Question**: Gmail has no explicit `completed` boolean. What mechanism detects that an email
is "done" in Gmail?

**Decision**: Two configurable triggers, per integration setting (`gmailCompletionMode`):

- **`inbox_removal`** (default): An email is considered source-complete when it no longer appears
  in the Gmail sync query results (i.e., it has been archived, moved, or deleted from the inbox).
  Detected via a set-difference: items previously in cache for this integration that are absent
  from the latest sync batch are marked `completedAtSource = true`.

- **`read`**: An email is considered source-complete when it has been read. The adapter queries
  all inbox messages (not just unread) and marks messages where `UNREAD` is absent from labelIds
  as `completed = true` in the returned NormalizedItem.

**Rationale**: Zero-inbox is the dominant mental model for Gmail power users. Inbox departure
is the most intuitive "done" signal. Read-as-done is an optional mode for users who prefer it.

**Alternatives considered**:
- Gmail History API (delta sync): more efficient but significantly more complex and not needed
  at MVP scale (max 20 messages per sync).
- Webhook/Push notifications via Gmail Pub/Sub: out of scope; pull-only architecture is
  sufficient for the 15-minute sync cadence.

---

### Decision 2: How to detect Microsoft Tasks source completion

**Question**: The current adapter filters `status ne 'completed'` — so completed tasks are
never fetched. How do we detect when a task becomes complete in the source?

**Decision**: Change the Microsoft Tasks adapter to fetch ALL tasks (remove the `status ne
'completed'` filter) and include a `completed: boolean` field in the returned NormalizedItem
derived from the task's `status` field (`notStarted`/`inProgress` = false, `completed` = true).

**Rationale**: Microsoft Tasks tasks are bounded per list; fetching all tasks (complete + active)
is acceptable at MVP scale. This is simpler than set-difference and gives explicit completion
signal from the source, making override logic cleaner.

**Alternatives considered**:
- Set-difference approach (same as Gmail): Would work but is indirect; Microsoft Tasks provides
  an explicit `status` field, so it's cleaner to use it directly.
- Delta query via MS Graph `$deltaToken`: More efficient but more complex; out of scope for MVP.

---

### Decision 3: NormalizedItem extension strategy

**Question**: Should `completed` be added to `NormalizedItem` directly or inferred from
rawPayload in the cache service?

**Decision**: Add `completed?: boolean` directly to the `NormalizedItem` interface. Defaults to
`undefined` (treated as false / not applicable) for adapters that do not report completion state
(e.g., Apple Calendar).

**Rationale**: Keeps completion logic centralized in the cache service rather than scattered
across callers. Backward-compatible — existing adapters need no changes unless they report
completion state.

**Alternatives considered**:
- Infer from rawPayload in cache service: Couples the cache service to adapter-specific payload
  shapes; violates Integration Modularity principle (Constitution I).

---

### Decision 4: Cache service source completion application logic

**Question**: How does the cache service apply `completedAtSource` to `completedInOrdrctrl`
while respecting Reopened Overrides?

**Decision**: After each sync batch is persisted, the cache service runs two steps:

1. **Mark missing items**: Items in the cache for this integration that were NOT in the current
   sync batch are updated to `completedAtSource = true` (set-difference). This covers Gmail
   inbox-removal mode and any adapter that stops returning an item.

2. **Apply source completions**: Query all non-expired cache items for this integration where
   `completedAtSource = true` AND `completedInOrdrctrl = false`. For each item, check if a
   REOPENED SyncOverride exists. If no override exists, set `completedInOrdrctrl = true` and
   record `completedAt`.

Items with a REOPENED override are skipped — the override wins.

**Rationale**: Two-step approach keeps the logic readable and testable in isolation. The
set-difference step handles implicit completion (items disappearing from results); the apply
step handles explicit completion (adapter returns `completed: true`).

---

### Decision 5: Gmail completion mode configuration storage

**Question**: Where and how is the per-integration Gmail completion mode stored?

**Decision**: Add `gmailCompletionMode` as a new optional enum field on the `Integration` model
(`inbox_removal | read`), defaulting to `inbox_removal`. New API endpoint
`PATCH /api/integrations/gmail/completion-mode` to update it.

**Rationale**: Follows the existing pattern of integration-specific config fields on the
Integration model (e.g., `gmailSyncMode`, `calendarEventWindowDays`). No new table needed.

---

### Decision 6: Apple Calendar handling

**Question**: Does Apple Calendar need changes for source completion?

**Decision**: No changes to the Apple Calendar adapter. Past events naturally fall off the
adapter's date window and stop being returned — the set-difference logic in the cache service
will mark them `completedAtSource = true` automatically. This is the correct behavior: a
calendar event that has ended is implicitly complete.

---

### Decision 7: Metadata update behavior (FR-004)

**Question**: Does title/due date sync already work, or are changes needed?

**Decision**: Metadata updates (title, dueAt, startAt, endAt) already work via the existing
upsert logic in `persistCacheItems`. The update block already overwrites these fields. No
changes needed for metadata sync. FR-004 is satisfied by existing behavior and confirmed
in this research.

---

## Summary of Changes Required

| Component | Change | Scope |
|-----------|--------|-------|
| `NormalizedItem` interface | Add `completed?: boolean` | 1 file |
| `SyncCacheItem` Prisma model | Add `completedAtSource Boolean @default(false)` | Schema migration |
| `Integration` Prisma model | Add `gmailCompletionMode GmailCompletionMode?` | Schema migration |
| Prisma schema | Add `GmailCompletionMode` enum | Schema migration |
| `cache.service.ts` | Add set-difference + source completion apply logic | 1 file |
| `gmail/index.ts` | Support `inbox_removal` and `read` completion modes | 1 file |
| `microsoft-tasks/index.ts` | Fetch all tasks; return `completed` in NormalizedItem | 1 file |
| `integrations.routes.ts` | Add `PATCH /gmail/completion-mode` endpoint | 1 file |
| `integrations.service.ts` (frontend) | Add `updateGmailCompletionMode()` | 1 file |
| `GmailCompletionModeSelector.tsx` | New settings toggle component | 1 file |
| Backend unit tests | Source completion logic, adapter changes | 3 test files |
| Frontend unit tests | GmailCompletionModeSelector component | 1 test file |
