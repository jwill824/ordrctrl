# Tasks: Clear Completed Tasks

**Branch**: `008-clear-completed` | **Issue**: [#20](https://github.com/jwill824/ordrctrl/issues/20)  
**Input**: Design documents from `/specs/008-clear-completed/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (No Changes Required)

**Purpose**: Verify branch state and tooling. No new project structure is needed — all changes are additive to existing files.

- [ ] T001 Verify `008-clear-completed` branch is checked out and up to date with main
- [ ] T002 Confirm `pnpm install` passes and dev environment starts cleanly

**Checkpoint**: Dev environment ready ✅

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend service function and endpoint that both P1 user stories depend on. No schema changes required.

- [ ] T003 Add `clearCompletedItems(userId: string): Promise<{ clearedCount: number }>` to `backend/src/feed/feed.service.ts` — queries eligible sync items (completedInOrdrctrl=true, no DISMISSED/REOPENED override) and eligible native tasks (completed=true, dismissed=false), bulk-creates SyncOverride(DISMISSED) records with skipDuplicates and bulk-updates NativeTask.dismissed=true, returns total count
- [ ] T004 Add `POST /api/feed/completed/clear` route to `backend/src/api/feed.routes.ts` — auth-guarded, calls `clearCompletedItems(userId)`, returns `{ clearedCount: number }` with 200; returns 401 if unauthenticated
- [ ] T005 [P] Add `clearAllCompleted(): Promise<{ clearedCount: number }>` to `frontend/src/services/feedService.ts` — calls `POST /api/feed/completed/clear`, returns parsed response
- [ ] T006 [P] Write unit tests for `clearCompletedItems()` in `backend/tests/feed.service.test.ts` — test: clears eligible sync items, clears eligible native tasks, excludes items with REOPENED override, excludes already-dismissed items, returns correct count, handles 0 eligible items
- [ ] T007 [P] Write endpoint test for `POST /api/feed/completed/clear` in `backend/tests/feed.routes.test.ts` — test: returns 200 with clearedCount, returns 401 when unauthenticated, returns 200 with clearedCount=0 when nothing to clear

**Checkpoint**: Service + endpoint functional, passing tests ✅ — US1 and US2 can now be implemented

---

## Phase 3: User Story 1 — Clear All Completed Tasks at Once (Priority: P1) 🎯 MVP

**Goal**: User presses "Clear" in the feed's completed section and all completed tasks are immediately removed.

**Independent Test**: Complete 3+ tasks (mix of native and sync-backed), press "Clear completed" in the UI, verify the completed section disappears and items appear in Dismissed Items.

### Implementation for User Story 1

- [ ] T008 [US1] Add `clearCompleted: () => Promise<void>` and `clearedCount: number | null` state to `frontend/src/hooks/useFeed.ts` — call `feedService.clearAllCompleted()`, optimistically empty the `completed` array immediately, store count in `clearedCount` state, reload feed on success, revert optimistic update and set error on failure
- [ ] T009 [US1] Add `onClear: () => void` prop to `CompletedSection` interface and "Clear" button to section header in `frontend/src/components/feed/CompletedSection.tsx` — button appears only when `items.length > 0`, styled consistently with existing header text (text-zinc-400, small/uppercase), positioned right-aligned in the header row
- [ ] T010 [US1] Wire `clearCompleted` from `useFeed` to `CompletedSection` via `onClear` prop in `frontend/src/app/feed/page.tsx`
- [ ] T011 [P] [US1] Write component test for `CompletedSection` "Clear" button in `frontend/tests/components/CompletedSection.test.tsx` — test: button renders when items exist, button absent when items empty, button calls onClear on click
- [ ] T012 [P] [US1] Write hook test for `clearCompleted` in `frontend/tests/hooks/useFeed.test.ts` — test: optimistic empty of completed array, count stored on success, revert on error

**Checkpoint**: US1 fully functional ✅ — user can clear all completed tasks in one click

---

## Phase 4: User Story 2 — Confirmation and Feedback (Priority: P1)

**Goal**: After clearing, user sees a toast confirming how many items were cleared and where to find them. Errors are surfaced clearly.

**Independent Test**: After pressing "Clear completed," a toast appears with the correct item count. Dismissing it closes it. Navigating to Dismissed Items shows the cleared tasks.

### Implementation for User Story 2

- [ ] T013 [US2] Add cleared-count toast to `frontend/src/app/feed/page.tsx` — display toast when `clearedCount` is non-null (after clear), message format: "Cleared {n} completed task(s) — find them in Dismissed Items", include close button to dismiss toast, clear `clearedCount` on close (call `clearClearedToast()` or equivalent hook setter)
- [ ] T014 [P] [US2] Add `clearClearedToast: () => void` to `frontend/src/hooks/useFeed.ts` — resets `clearedCount` to null
- [ ] T015 [P] [US2] Add error toast handling for failed clear in `frontend/src/hooks/useFeed.ts` — on API error during `clearCompleted`, show existing error toast pattern and revert the optimistic completed-array state
- [ ] T016 [P] [US2] Write toast render test in `frontend/tests/components/ClearedToast.test.tsx` (or extend feed page test) — test: toast shows correct count, close button hides toast, toast absent before clear action fires

**Checkpoint**: US2 fully functional ✅ — feedback loop complete; combined with US1 this is the shippable MVP

---

## Phase 5: User Story 3 — Auto-Clear Completed Tasks After a Set Period (Priority: P2)

**Goal**: Users can configure a window (1, 3, 7, or 30 days) after which completed tasks are automatically cleared on the next sync cycle.

**Independent Test**: Enable auto-clear with 1-day window via settings, mark a task complete, simulate `completedAt` being >24 hours ago, trigger a manual sync, verify the task moves to dismissed items.

**⚠️ Requires database migration** — complete P1 MVP (Phases 1–4) before starting this phase.

### P2 Schema Change

- [ ] T017 Add `settings Json?` column to `User` model in `backend/prisma/schema.prisma` with inline comment `// user-level preferences e.g. { autoClearWindowDays: 7 }`
- [ ] T018 Generate and apply Prisma migration: `cd backend && npx prisma migrate dev --name add-user-settings`

### P2 Backend

- [ ] T019 [P] [US3] Create `backend/src/user/user.service.ts` — implement `getUserSettings(userId): Promise<UserSettings>` (returns `{ autoClearWindowDays: null }` if unset) and `updateUserSettings(userId, patch: Partial<UserSettings>): Promise<UserSettings>` with validation (autoClearWindowDays must be 1 | 3 | 7 | 30 | null)
- [ ] T020 [P] [US3] Create `backend/src/api/user.routes.ts` — add `GET /api/user/settings` (returns current settings) and `PATCH /api/user/settings` (validates + updates, returns 400 with error message for invalid window value)
- [ ] T021 [US3] Add `clearExpiredCompleted(userId: string, windowDays: number): Promise<void>` to `backend/src/feed/feed.service.ts` — queries completed items where `completedAt < now() - windowDays * 86400s`, uses same bulk dismiss logic as `clearCompletedItems()`, skips users where autoClearWindowDays is null
- [ ] T022 [US3] Add auto-clear post-sync hook to `backend/src/sync/sync.worker.ts` — after each sync job completes, fetch user settings, if `autoClearWindowDays` is set call `clearExpiredCompleted(userId, autoClearWindowDays)`
- [ ] T023 [P] [US3] Write unit tests for `getUserSettings`, `updateUserSettings`, and `clearExpiredCompleted` in `backend/tests/user.service.test.ts` and add `clearExpiredCompleted` tests to `backend/tests/feed.service.test.ts`
- [ ] T024 [P] [US3] Write endpoint tests for `GET /api/user/settings` and `PATCH /api/user/settings` in `backend/tests/user.routes.test.ts`

### P2 Frontend

- [ ] T025 [US3] Create auto-clear settings UI component `frontend/src/components/settings/AutoClearSettings.tsx` — dropdown with options: Disabled (default), 1 day, 3 days, 7 days, 30 days; calls `PATCH /api/user/settings` on change; shows current value on load via `GET /api/user/settings`
- [ ] T026 [P] [US3] Add settings page or settings section in `frontend/src/app/settings/page.tsx` (create if not exists) — include `AutoClearSettings` component with a descriptive label
- [ ] T027 [P] [US3] Write component test for `AutoClearSettings` in `frontend/tests/components/AutoClearSettings.test.tsx` — test: renders current value, calls API on change, shows all valid options

**Checkpoint**: US3 fully functional ✅ — auto-clear fires within one 15-min sync cycle

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T028 [P] Run full backend test suite: `cd backend && pnpm test` — confirm all new + existing tests pass
- [ ] T029 [P] Run full frontend test suite: `cd frontend && pnpm test` — confirm all new + existing tests pass
- [ ] T030 Run frontend build: `cd frontend && pnpm build` — confirm no type errors or lint failures
- [ ] T031 [P] Verify the "Clear" button is absent when no completed tasks exist (manual smoke test in dev)
- [ ] T032 [P] Verify cleared items appear in Dismissed Items page (manual smoke test in dev)
- [ ] T033 [P] Update `frontend/src/components/feed/CompletedSection.tsx` accessibility — ensure "Clear" button has appropriate `aria-label` (e.g., "Clear all completed tasks")
- [ ] T034 Commit all changes and push to `008-clear-completed`, open PR referencing issue #20

---

## Dependencies

### User Story Dependencies

- **US1 (P1)**: Requires Phase 2 (Foundational) complete — no dependencies on other stories
- **US2 (P1)**: Requires Phase 2 complete; integrates with US1's `clearCompleted` hook state — implement US1 first, then US2 adds the toast layer on top
- **US3 (P2)**: Requires Phase 2 complete + schema migration (T017–T018) — fully independent of US1/US2 implementation; can be developed on a sub-branch or after P1 ships

### Within Each Phase

- T003 → T004 (route depends on service function)
- T003 → T008 (hook depends on service function existing)
- T008 → T009 (component needs hook prop defined)
- T009 → T010 (page wires hook to component)
- T013 → T014 (toast dismiss needs clearClearedToast from hook)
- T017 → T018 (migration depends on schema change)
- T018 → T019, T020, T021, T022 (all P2 backend depends on migration)

---

## Parallel Opportunities

### Phase 2 (after T003 and T004 land)
```
T005 (frontend service)  |  T006 (backend service tests)  |  T007 (endpoint tests)
  ← can all run in parallel once T003+T004 are merged
```

### Phase 3 (US1)
```
T011 (component test)  |  T012 (hook test)
  ← can run in parallel with T008–T010 implementation
```

### Phase 4 (US2)
```
T014 (clearClearedToast)  |  T015 (error handling)  |  T016 (toast test)
  ← can all run in parallel, T013 is the integration point
```

### Phase 5 (US3)
```
T019 (user service)  |  T021 (clearExpiredCompleted)
  ← can run in parallel after T018
T025 (frontend component)  |  T026 (settings page)
  ← can run in parallel
```

---

## Implementation Strategy

### MVP First (US1 + US2 = P1 complete)

1. Complete Phase 1: Setup verification
2. Complete Phase 2: Foundational (T003–T007) — backend service + endpoint + tests
3. Complete Phase 3: US1 (T008–T012) — frontend hook + button
4. Complete Phase 4: US2 (T013–T016) — toast + error feedback
5. **STOP and VALIDATE**: End-to-end test: complete tasks → press Clear → see toast → check dismissed items
6. Open PR, merge P1 — ship MVP

### Incremental Delivery

- **After P1 merge**: Start Phase 5 for US3 auto-clear on a clean base
- US3 is additive — no P1 behavior changes; it only adds settings and a sync-cycle hook
- US3 can ship in a follow-up PR without blocking the P1 release

---

## Notes

- `[P]` tasks target different files — safe to run in parallel
- `[Story]` label maps each task to its user story for traceability
- No schema migration for P1 — zero risk to existing data
- Existing dismiss/restore flows are untouched; clear reuses that infrastructure
- Commit after each logical group (Foundational, US1, US2) for clean history
