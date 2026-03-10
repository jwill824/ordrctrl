# Research: Per-Item Feed Dismissal

**Feature**: `005-feed-dismissal`
**Status**: Complete — all decisions resolved

---

## 1. Dismissal Storage — Sync Items vs Native Tasks

### Decision
Two separate storage mechanisms — one per item origin:

- **Sync-sourced items** (`sync:<uuid>`): Add `DISMISSED` to the existing `OverrideType` enum and create a `SyncOverride` record (`overrideType = DISMISSED`). This is identical to how `REOPENED` works — same table, same unique constraint (`syncCacheItemId + overrideType`).
- **Native tasks** (`native:<uuid>`): Add a `dismissed Boolean @default(false)` field directly to the `NativeTask` model. Native tasks are fully owned by ordrctrl, so a simple boolean is the minimal approach — no override indirection needed.

### Rationale
- `SyncOverride` exists because sync items are owned by the source system — ordrctrl records the user's _intent_ without modifying the source. A native task IS the source, so a boolean field is simpler and appropriate.
- Reusing `SyncOverride` for sync items means zero new infrastructure — the feed query already knows how to join this table.
- The `dismissed` boolean on `NativeTask` is a single-migration, single-field change with no schema complexity.

### Alternatives Considered
- **Unified dismissal table**: A new `DismissedItem` table covering both types. Rejected — unnecessary complexity when the two types have fundamentally different ownership models.
- **Soft-delete on `SyncCacheItem`**: Add a `dismissed` boolean to `SyncCacheItem` directly. Rejected — `SyncCacheItem` is a sync-managed cache; overriding it would be overwritten on next sync. `SyncOverride` is the correct layer for user intent.

---

## 2. Feed Query Filter — Excluding Dismissed Items

### Decision
Update `getCacheItemsForUser()` in `cache.service.ts` and `buildFeed()` in `feed.service.ts`:

- For sync items: add a `NOT EXISTS` / `where` clause that excludes `SyncCacheItem` records that have a `SyncOverride` with `overrideType = DISMISSED` for the requesting user.
- For native tasks: add `where: { dismissed: false }` to the `prisma.nativeTask.findMany()` call.

Both dismissed counts are excluded from metrics (active item count, feed stats).

### Rationale
- Filtering at the query layer is the correct place — dismissed items never enter the feed pipeline at all, keeping `buildFeed()` clean.
- The existing `REOPENED` filtering pattern demonstrates the query approach is already established.

### Alternatives Considered
- **Post-query filter in service layer**: Pull all items then filter in memory. Rejected — poor performance as dismissed item count grows; violates SC-004.

---

## 3. Undo Mechanism — Session-Scoped

### Decision
Undo is client-side session-scoped with immediate server confirmation:

1. User clicks Dismiss → frontend optimistically removes the item from the feed UI and shows a transient "Dismissed. [Undo]" toast.
2. In parallel, `PATCH /api/feed/items/:itemId/dismiss` is called to persist the dismissal.
3. If the user clicks Undo before navigating away → `DELETE /api/feed/items/:itemId/dismiss` removes the override and the item is restored to the feed.
4. If the user navigates away or the toast auto-dismisses → no undo action possible; item remains dismissed.
5. On server error for the dismiss call → frontend rolls back the optimistic remove and shows an error message.

The undo window is UI-driven (toast visible) — no server-side timer or pending state needed.

### Rationale
- Session-scoped undo is simpler than a server-side "pending dismissal" state. The spec explicitly defines the window as navigating away ending the undo opportunity.
- Standard toast-with-undo pattern (used by Gmail, Notion, Linear) — well understood by users.
- Backend is stateless across the dismiss/undo cycle — just create/delete the override record.

### Alternatives Considered
- **Timed server-side pending state**: Hold dismissal in a "pending" state for 5–10 seconds server-side before committing. Rejected — unnecessary complexity; spec does not require a time-bounded window.
- **Confirmation dialog instead of undo**: Ask before dismissing. Rejected — adds friction to a high-frequency action; undo-toast pattern is less disruptive.

---

## 4. Dismissed Items Management Page (P3)

### Decision
A paginated `GET /api/feed/dismissed` endpoint returns dismissed items with metadata. The frontend page is accessible from Settings. Page size: 20 items per page, cursor-based pagination.

Response shape per item:
```
{ id, title, source, itemType, dismissedAt }
```

Restore action: `DELETE /api/feed/items/:itemId/dismiss` (same endpoint as undo — idempotent).

### Rationale
- Reusing the same restore endpoint for both undo and management page restore keeps the API surface minimal.
- Cursor-based pagination handles large dismissed lists without expensive COUNT queries.
- Settings is the natural home for management pages — consistent with integration settings.

### Alternatives Considered
- **Inline in feed with filter toggle**: Show/hide dismissed items in the feed with a toggle. Rejected — mixes active and dismissed concerns in the primary surface; violates Constitution Principle II (minimalism).

---

## 5. Dismissed Item Lifecycle — Source Deletion

### Decision
When a `SyncCacheItem` expires (TTL cleanup) or is deleted, `onDelete: Cascade` on the `SyncOverride` foreign key automatically cleans up the associated `DISMISSED` override record. No additional cleanup logic needed.

If the source integration is disconnected and reconnected later, new `SyncCacheItem` records will be created with new IDs — previous dismissal records will have already been cascaded away, so items resurface. This is acceptable: a reconnect is a fresh start.

### Rationale
- `onDelete: Cascade` is already configured on `SyncOverride.syncCacheItemId`. Zero implementation cost.
- Resurfacing items after a reconnect matches user expectations — they reconnected to get fresh data.

---

## Summary of Decisions

| # | Topic | Decision |
|---|-------|----------|
| 1 | Storage (sync items) | `SyncOverride` with `DISMISSED` enum value |
| 2 | Storage (native tasks) | `dismissed Boolean @default(false)` on `NativeTask` |
| 3 | Feed filter | Query-layer exclusion in `cache.service.ts` + `feed.service.ts` |
| 4 | Undo | Client-side toast, `DELETE /dismiss` endpoint, session-scoped |
| 5 | Management page | `GET /api/feed/dismissed` paginated; restore via same `DELETE /dismiss` |
| 6 | Lifecycle cleanup | `onDelete: Cascade` handles sync item deletion automatically |
