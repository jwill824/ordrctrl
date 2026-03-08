# Tasks: Uncheck Completed Tasks

**Input**: Design documents from `/specs/002-uncheck-completed/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅, quickstart.md ✅

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1 = native tasks, US2 = sync-sourced tasks)
- Paths follow web app convention: `backend/` and `frontend/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema migration and new model — required before any service or route work.

- [ ] T001 Add `OverrideType` enum and `SyncOverride` model to `backend/prisma/schema.prisma`
- [ ] T002 Generate and run Prisma migration: `prisma migrate dev --name add-sync-override` (creates `backend/prisma/migrations/`)
- [ ] T003 Regenerate Prisma client after migration (`prisma generate`)

**Checkpoint**: `SyncOverride` table exists in the database. Prisma client reflects the new model.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend service functions and API routes that both user stories depend on.

- [ ] T004 Add `uncompleteNativeTask(taskId, userId)` to `backend/src/tasks/task.service.ts` — sets `completed=false, completedAt=null`, throws `ITEM_NOT_FOUND` / `FORBIDDEN` / `ITEM_NOT_COMPLETED` as needed
- [ ] T005 [P] Add `uncompleteNativeTask(taskId, userId)` to `backend/src/feed/feed.service.ts` — thin wrapper calling task service, returns normalized feed item shape
- [ ] T006 [P] Add `uncompleteSyncItem(itemId, userId)` to `backend/src/feed/feed.service.ts` — sets `completedInOrdrctrl=false, completedAt=null` AND creates `SyncOverride(REOPENED)` record; returns `isLocalOverride: true`
- [ ] T007 Add `PATCH /api/feed/items/:itemId/uncomplete` route to `backend/src/api/feed.routes.ts` — authenticates user, resolves item type, delegates to correct service function, returns contract response from `contracts/api.md`
- [ ] T008 Add `PATCH /api/tasks/:id/uncomplete` route to `backend/src/api/tasks.routes.ts` — authenticates user, calls `uncompleteTask`, returns contract response
- [ ] T009 Modify `PATCH /api/feed/items/:itemId/complete` handler in `backend/src/api/feed.routes.ts` to delete any existing `SyncOverride(REOPENED)` for the item when re-completing a sync-sourced task

**Checkpoint**: `PATCH /api/feed/items/:itemId/uncomplete` and `PATCH /api/tasks/:id/uncomplete` return correct responses. Re-completing a reopened sync item deletes the override. Backend tests pass (`pnpm test`).

---

## Phase 3: User Story 1 — Reopen a Native Task (Priority: P1) 🎯 MVP

**Goal**: A user can uncheck a completed native ordrctrl task and have it return to the active feed, persisted across sessions.

**Independent Test**: Create a native task → mark it complete → uncheck it from the Completed section → verify it appears in the active feed → refresh page → verify it remains in the active feed. No integrations needed.

### Implementation

- [ ] T010 [US1] Add `uncompleteItem(itemId: string): Promise<void>` to `frontend/src/services/feed.service.ts` — calls `PATCH /api/feed/items/:itemId/uncomplete`
- [ ] T011 [US1] Add `uncompleteItem(itemId)` callback to `frontend/src/hooks/useFeed.ts` — optimistic update: immediately removes item from `completed` array and re-inserts at top of `items` array; rolls back both arrays and shows error toast on API failure
- [ ] T012 [US1] Update `frontend/src/components/feed/CompletedSection.tsx` to accept and forward `onUncomplete` prop to each `FeedItemRow`
- [ ] T013 [US1] Update `frontend/src/components/feed/FeedItem.tsx` to enable checkbox click for completed items: when `item.completed === true`, clicking checkbox calls `onUncomplete(item.id)` instead of being a no-op; update aria-label to "Reopen task"
- [ ] T014 [US1] Wire `onUncomplete={uncompleteItem}` from `useFeed` hook into `<CompletedSection>` in `frontend/src/app/feed/page.tsx`

**Checkpoint**: Native task can be checked, unchecked, and rechecked repeatedly. State persists on page reload. Error state rolls back the UI correctly.

---

## Phase 4: User Story 2 — Reopen an Integration-Sourced Task (Priority: P2)

**Goal**: A user can uncheck a completed sync-sourced task. The item returns to the active feed with its integration badge, and a sync override prevents the next sync cycle from re-completing it.

**Independent Test**: Connect any integration → let it sync → mark a synced item complete → uncheck it → verify it reappears with its source badge and the inline "local change" notice → trigger a manual sync → verify the item remains open in the feed.

### Implementation

- [ ] T015 [P] [US2] Update `frontend/src/hooks/useFeed.ts` `uncompleteItem()` to read `isLocalOverride` from the API response and attach it as `isJustReopened: true` flag on the item in the `items` state array
- [ ] T016 [P] [US2] Update `frontend/src/components/feed/FeedItem.tsx` to render a dismissible inline notice below the item when `item.isJustReopened === true` and `item.source !== 'ordrctrl'`: text reads "This change is local to ordrctrl and won't update [source name]." Notice clears when dismissed or on next render cycle
- [ ] T017 [US2] Update background sync job (locate in `backend/src/`) to check for an existing `SyncOverride(REOPENED)` before setting `completedInOrdrctrl=true` on a `SyncCacheItem` — if override exists, skip the completion update for that item

**Checkpoint**: Synced task can be unchecked. Inline notice appears and can be dismissed. Manual sync does not re-complete the item. Re-checking the item removes the sync override and allows future syncs to set it complete again.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, accessibility, and error handling across both user stories.

- [ ] T018 [P] Add Vitest unit tests for `uncompleteNativeTask()` and `uncompleteSyncItem()` in `backend/tests/unit/feed.service.test.ts` — cover success, `ITEM_NOT_COMPLETED`, `FORBIDDEN`, `ITEM_NOT_FOUND` cases
- [ ] T019 [P] Add Vitest contract tests for `PATCH /api/feed/items/:itemId/uncomplete` in `backend/tests/contract/feed.routes.test.ts` — cover 200, 400, 403, 404 responses per `contracts/api.md`
- [ ] T020 [P] Add Playwright E2E test for native task uncheck flow in `frontend/tests/e2e/feed.spec.ts`
- [ ] T021 Verify `CompletedSection` collapses or shows empty state when last item is unchecked — fix in `frontend/src/components/feed/CompletedSection.tsx` if needed
- [ ] T022 Verify keyboard navigation works for unchecking (checkbox focusable and operable via Space/Enter) in `frontend/src/components/feed/FeedItem.tsx`
- [ ] T023 Verify error toast displays correctly when `uncompleteItem()` API call fails and optimistic update is rolled back — test in `frontend/src/hooks/useFeed.ts`
- [ ] T024 Run `quickstart.md` validation: confirm full flow works end-to-end with `docker compose up` + fresh migration

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (T001–T003 complete, schema migrated)
- **Phase 3 (US1)**: Depends on Phase 2 (T004–T009 complete)
- **Phase 4 (US2)**: Depends on Phase 2 (T004–T009 complete) — can run in parallel with Phase 3
- **Phase 5 (Polish)**: Depends on Phase 3 and Phase 4 complete

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only — no dependency on US2
- **US2 (P2)**: Depends on Foundational only — no dependency on US1 (backend already handles both via service layer)

### Within Each Phase

- T005 and T006 can run in parallel (different service functions, same file — coordinate)
- T010–T014 are sequential within US1 (service → hook → component → wire-up)
- T015 and T016 can run in parallel within US2 (different concerns)
- T018–T020 can all run in parallel in Polish phase

---

## Parallel Example: Phase 2 (Foundational)

```bash
# After T004 completes:
Task T005: "Add uncompleteNativeTask() to backend/src/feed/feed.service.ts"
Task T006: "Add uncompleteSyncItem() to backend/src/feed/feed.service.ts"
# Then T007–T009 sequentially
```

## Parallel Example: Phase 3 + Phase 4 (if two developers)

```bash
# Developer A: Phase 3 (US1 - native tasks)
Task T010 → T011 → T012 → T013 → T014

# Developer B: Phase 4 (US2 - sync override)
Task T015, T016 (parallel) → T017
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Schema migration (T001–T003)
2. Complete Phase 2: Backend services + routes (T004–T009)
3. Complete Phase 3: Frontend for native tasks (T010–T014)
4. **STOP and VALIDATE**: Native task uncheck works end-to-end
5. Ship if ready — US2 adds sync protection but US1 delivers the core user value

### Incremental Delivery

1. **Phase 1 + 2** → Backend API is complete and testable with curl
2. **Phase 3** → Native task uncheck works in UI (MVP shippable)
3. **Phase 4** → Sync-sourced task uncheck works with override protection
4. **Phase 5** → Tests, edge cases, accessibility hardened

---

## Notes

- [P] tasks = different files or independent concerns, no blocking dependencies
- `SyncOverride` is intentionally minimal — `overrideType` enum is extensible toward two-way sync (issue #10) without schema changes
- Re-completing a reopened item MUST delete the `SyncOverride` record (T009) — verify this in Polish phase
- `isJustReopened` flag is client-state only — not persisted, clears on page reload
