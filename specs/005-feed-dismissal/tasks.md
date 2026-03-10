# Tasks: Per-Item Feed Dismissal

**Feature**: `005-feed-dismissal`
**Branch**: `005-feed-dismissal`
**Input**: Design documents from `/specs/005-feed-dismissal/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/api.md ✅ quickstart.md ✅

**Tests**: Included — required by Constitution Principle IV (unit + contract tests).

**Organization**: Tasks are grouped by user story (US1 → US2 → US3) to enable independent implementation and validation of each story increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unresolved dependencies)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`)

---

## Phase 1: Setup

**Purpose**: Confirm branch and dev environment. No project initialization required — this feature extends existing infrastructure.

- [x] T001 Verify `005-feed-dismissal` branch is active and `pnpm dev` starts cleanly from repo root

---

## Phase 2: Foundational — Schema Migration

**Purpose**: Additive Prisma schema changes that MUST land before any service or route work can proceed.

**⚠️ CRITICAL**: All Phase 3–5 tasks depend on these migrations being applied and Prisma client regenerated.

- [x] T002 Add `DISMISSED` to `OverrideType` enum in `backend/prisma/schema.prisma`
- [x] T003 Add `dismissed Boolean @default(false)` field to `NativeTask` model in `backend/prisma/schema.prisma`
- [x] T004 Run `pnpm prisma migrate dev --name add-dismissed-override-type` and `pnpm prisma generate` in `backend/`

**Checkpoint**: Migration applied, Prisma client updated — user story implementation can begin.

---

## Phase 3: User Story 1 — Dismiss a Feed Item (Priority: P1) 🎯 MVP

**Goal**: Users can dismiss any feed item with a single action; it disappears immediately from the feed and does not reappear on future syncs.

**Independent Test**: Open the feed → dismiss any item → verify it disappears immediately → trigger a manual sync → verify the item does not reappear.

### Backend — US1

- [x] T005 [P] [US1] Add `DismissParamsSchema` (itemId regex: `/^(sync|native):[0-9a-f-]{36}$/`) to `backend/src/api/schemas/feed.schemas.ts`
- [x] T006 [P] [US1] Implement `dismissFeedItem(userId: string, itemId: string)` in `backend/src/feed/feed.service.ts` — for `sync:` prefix use `prisma.syncOverride.upsert` with `overrideType: 'DISMISSED'`; for `native:` prefix use `prisma.nativeTask.update({ data: { dismissed: true } })`; throw 404 if item not found or not owned by user
- [x] T007 [US1] Update `getCacheItemsForUser()` (or equivalent feed query) in `backend/src/feed/feed.service.ts` to fetch dismissed `syncCacheItemId`s via `prisma.syncOverride.findMany({ where: { userId, overrideType: 'DISMISSED' } })` and exclude them with `id: { notIn: dismissedIds }`
- [x] T008 [US1] Update native task query in `buildFeed()` in `backend/src/feed/feed.service.ts` to add `dismissed: false` filter to `prisma.nativeTask.findMany()`
- [x] T009 [US1] Add `PATCH /api/feed/items/:itemId/dismiss` route to `backend/src/api/feed.routes.ts` — validate params with `DismissParamsSchema`, call `feedService.dismissFeedItem(req.user.id, itemId)`, return `{ id: itemId, dismissed: true }`; handle 404 (ITEM_NOT_FOUND) and 409 (ALREADY_DISMISSED)

### Frontend — US1

- [x] T010 [P] [US1] Add `dismissItem(itemId: string)` function to `frontend/src/services/feed.service.ts` — `PATCH /api/feed/items/${itemId}/dismiss`
- [x] T011 [US1] Add optimistic dismiss mutation to `frontend/src/hooks/useFeed.ts` — on `onMutate`: remove item from React Query cache immediately; on `onError`: call `queryClient.invalidateQueries({ queryKey: ['feed'] })` to restore
- [x] T012 [US1] Add dismiss button to `frontend/src/components/feed/FeedItem.tsx` — single action (icon button or hover affordance), triggers the dismiss mutation from `useFeed`

**Checkpoint**: US1 fully functional. A dismissed item persists across page refreshes and syncs.

---

## Phase 4: User Story 2 — Undo a Dismissal (Priority: P2)

**Goal**: Immediately after dismissing, users see a "Dismissed. [Undo]" toast. Clicking Undo restores the item.

**Independent Test**: Dismiss a feed item → click Undo in the toast → verify item is restored to the feed → trigger a sync → verify item continues to appear normally.

### Backend — US2

- [x] T013 [P] [US2] Implement `restoreFeedItem(userId: string, itemId: string)` in `backend/src/feed/feed.service.ts` — for `sync:` prefix delete the `DISMISSED` `SyncOverride` record; for `native:` prefix set `dismissed: false`; throw 404 if item not found or not currently dismissed
- [x] T014 [US2] Add `DELETE /api/feed/items/:itemId/dismiss` route to `backend/src/api/feed.routes.ts` — validate params with `DismissParamsSchema`, call `feedService.restoreFeedItem(req.user.id, itemId)`, return `{ id: itemId, dismissed: false }`; handle 404 (ITEM_NOT_FOUND, NOT_DISMISSED)

### Frontend — US2

- [x] T015 [P] [US2] Add `restoreItem(itemId: string)` function to `frontend/src/services/feed.service.ts` — `DELETE /api/feed/items/${itemId}/dismiss`
- [x] T016 [US2] Extend dismiss mutation in `frontend/src/hooks/useFeed.ts` to trigger a "Dismissed. [Undo]" toast on successful `onSuccess` — toast action calls `restoreItem(itemId)` then `queryClient.invalidateQueries({ queryKey: ['feed'] })`
- [x] T017 [US2] Update `frontend/src/components/feed/FeedItem.tsx` to ensure undo toast is displayed after dismiss and removed when navigating away (follow existing toast pattern in codebase)

**Checkpoint**: US2 fully functional. Undo restores the item immediately; navigating away ends the undo window.

---

## Phase 5: User Story 3 — View and Manage Dismissed Items (Priority: P3)

**Goal**: Users can navigate to Settings → Dismissed Items to see all dismissed items with title, source, and dismissal date. They can restore any item individually.

**Independent Test**: Dismiss 3+ items across different integrations → navigate to Settings → Dismissed Items → verify all 3 appear with correct metadata → restore one → verify it reappears in the feed.

### Backend — US3

- [x] T018 [P] [US3] Add `DismissedQuerySchema` Zod schema for pagination (`limit: z.coerce.number().int().min(1).max(100).default(20)`, `cursor: z.string().optional()`) to `backend/src/api/schemas/feed.schemas.ts`
- [x] T019 [P] [US3] Implement `getDismissedItems(userId: string, limit: number, cursor?: string)` in `backend/src/feed/feed.service.ts` — query dismissed `SyncOverride` records joined with `SyncCacheItem` for title/source, and dismissed `NativeTask` records; merge and sort by `dismissedAt` descending; return `{ items, nextCursor, hasMore }` with cursor-based pagination
- [x] T020 [US3] Add `GET /api/feed/dismissed` route to `backend/src/api/feed.routes.ts` — validate query with `DismissedQuerySchema`, call `feedService.getDismissedItems(req.user.id, limit, cursor)`, return paginated response matching `contracts/api.md` shape

### Frontend — US3

- [x] T021 [P] [US3] Add `getDismissedItems(params?: { limit?: number; cursor?: string })` function to `frontend/src/services/feed.service.ts` — `GET /api/feed/dismissed`
- [x] T022 [US3] Create `frontend/src/components/feed/DismissedItemsPage.tsx` — paginated list of dismissed items showing title, source badge, and dismissal date; restore button per item calling `restoreItem()`; empty state message when list is empty; load-more pagination control
- [x] T023 [US3] Create `frontend/src/app/settings/dismissed/page.tsx` — settings page that renders `DismissedItemsPage` component
- [x] T024 [US3] Add "Dismissed Items" navigation link to the settings sidebar/nav (alongside existing Integrations entry) — points to `/settings/dismissed`

**Checkpoint**: US3 fully functional. All three user stories independently testable and complete.

---

## Phase 6: Tests & Polish

**Purpose**: Fulfill Constitution Principle IV (test coverage required) and clean up cross-cutting concerns.

- [x] T025 [P] Add unit tests for `dismissFeedItem()` — sync item success, native item success, item not found (404), already dismissed (upsert idempotency) in `backend/tests/unit/feed.service.test.ts`
- [x] T026 [P] Add unit tests for `restoreFeedItem()` — sync item restore, native item restore, item not dismissed (404), item not found (404) in `backend/tests/unit/feed.service.test.ts`
- [x] T027 [P] Add unit test for `buildFeed()` dismissal filter — dismissed sync items excluded, dismissed native tasks excluded, active items still present in `backend/tests/unit/feed.service.test.ts`
- [x] T028 [P] Add contract tests for `PATCH /items/:itemId/dismiss` and `DELETE /items/:itemId/dismiss` — success, invalid itemId format (400), item not found (404) in `backend/tests/contract/feed.test.ts`
- [x] T029 [P] Add contract tests for `GET /api/feed/dismissed` — paginated response shape, empty list, invalid limit (400) in `backend/tests/contract/feed.test.ts`
- [x] T030 Verify dismissed items are excluded from all feed count/metrics queries across `backend/src/feed/feed.service.ts` (SC-005 compliance check)
- [x] T031 Run `pnpm test` in `backend/` and resolve any failures

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundation) → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3) → Phase 6 (Polish)
```

- **Phase 1**: No dependencies — start immediately
- **Phase 2**: Depends on Phase 1 — **BLOCKS all user story work**
- **Phase 3 (US1)**: Depends on Phase 2 (schema migration must be applied)
- **Phase 4 (US2)**: Depends on Phase 2; integrates with US1 dismiss flow but independently testable
- **Phase 5 (US3)**: Depends on Phase 2; builds on US1/US2 but uses the same `DELETE /dismiss` endpoint
- **Phase 6**: Depends on all story phases complete

### User Story Dependencies

- **US1 (P1)**: Depends only on Phase 2 — pure new capability
- **US2 (P2)**: Depends on `PATCH /dismiss` route from US1 being in place; the undo toast integrates with the dismiss action
- **US3 (P3)**: Reuses the `DELETE /dismiss` endpoint from US2; independently testable via management page

### Within Each Phase

- Tasks marked `[P]` in the same phase can be worked in parallel
- Backend service functions (T006, T007, T008) should be complete before routes (T009)
- Frontend service layer (T010) should be in place before hooks (T011) and components (T012)

---

## Parallel Opportunities

### Phase 3 (US1) — Can parallelize:

```
T005 (schema) ──┐
T006 (service) ─┤→ T009 (route)    T010 (fe service) → T011 (hook) → T012 (component)
T007 (filter) ──┤
T008 (native) ──┘
```

Backend (T005–T009) and frontend (T010–T012) streams can proceed in parallel once T004 is done.

### Phase 4 (US2) — Can parallelize:

```
T013 (service) → T014 (route)    T015 (fe service) → T016 (hook) → T017 (component)
```

### Phase 5 (US3) — Can parallelize:

```
T018 (schema) ─┐
T019 (service) ─┤→ T020 (route)    T021 (fe service) → T022 (component) → T023/T024 (page + nav)
```

### Phase 6 — All test tasks marked [P] can run in parallel

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 1 + Phase 2 (schema migration)
2. Complete Phase 3 (US1): backend dismiss service + route + frontend dismiss button
3. **STOP and validate**: Dismiss an item, refresh, trigger sync — confirm it stays hidden
4. Deploy/demo MVP

### Incremental Delivery

1. ✅ MVP: Dismiss (US1) — feed is cleanable
2. ➕ Undo (US2) — safety net for accidental dismissals; reduces hesitation to dismiss
3. ➕ Management (US3) — power-user recovery; builds long-term trust

### Parallel Team Strategy

Once Phase 2 (migration) is done:
- **Developer A**: Backend stream (T005–T009, T013–T014, T018–T020)
- **Developer B**: Frontend stream (T010–T012, T015–T017, T021–T024)

---

## Notes

- `[P]` = safe to parallelize (different files, no dependency on an in-progress task)
- `[USn]` = maps task to user story for independent delivery tracking
- Constitution Principle IV mandates tests — Phase 6 is required, not optional
- Dismissed item lifecycle (cascade delete on `SyncCacheItem` expiry) is handled automatically by the existing `onDelete: Cascade` constraint — no additional task needed
- Edge case: Completing a dismissed item does NOT auto-restore it (dismiss takes precedence) — `PATCH /complete` requires no change; verify in T031

---

## Phase 7: User Story 4 — Triage Inbox on Refresh

**Goal**: Incoming items stage in a triage sheet on refresh instead of silently flooding the feed.

- [x] T032 Fix `POLL_INTERVAL_MS` from 60s to 900s (15 min) in `frontend/src/hooks/useFeed.ts` to match UI label "Auto-sync every 15 min"
- [x] T033 Add triage state to `useFeed.ts`: `pendingItems`, `isTriageOpen`, `triageLoading`, `newItemCount`, `knownIdsRef`; add `openTriage`, `closeTriage`, `acceptTriage`, `dismissTriageItem`, `dismissAllTriage` functions
- [x] T034 Update `refresh()` in `useFeed.ts`: opens triage sheet, sets `triageLoading`, triggers sync, fetches feed, splits incoming vs known items into `pendingItems`
- [x] T035 Add `backgroundPoll()` in `useFeed.ts`: silent 15-min poll, diffs against `knownIdsRef`, sets `newItemCount` badge without opening sheet
- [x] T036 Create `frontend/src/components/feed/TriageSheet.tsx`: bottom sheet with loading state, per-item dismiss (×), "Accept all" / "Dismiss all" bulk actions, empty "all clear" state
- [x] T037 Wire `TriageSheet` into `frontend/src/app/feed/page.tsx`: add `newItemCount` badge to refresh button; render `<TriageSheet>` with all handlers
- [x] T038 Update spec docs: append US4 to `spec.md`, append triage decision to `research.md`, append tasks to `tasks.md`
