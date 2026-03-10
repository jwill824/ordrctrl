# Tasks: Inbound Source Sync

**Input**: Design documents from `specs/007-source-sync/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- **Tests**: Included per Constitution IV (test coverage required for all new business logic)

---

## Phase 1: Setup (Schema Migration)

**Purpose**: Apply the data model changes that all subsequent phases depend on.

- [ ] T001 Create Prisma migration: add `GmailCompletionMode` enum (`inbox_removal`, `read`), add `gmailCompletionMode GmailCompletionMode?` field to `Integration` model, and add `completedAtSource Boolean @default(false)` field + `@@index([integrationId, completedAtSource])` to `SyncCacheItem` model in `backend/prisma/schema.prisma`
- [ ] T002 Run and verify migration applies cleanly: `pnpm --filter backend prisma migrate dev --name inbound-source-sync` and confirm zero data loss on existing records

**Checkpoint**: Database schema updated — all new fields exist with correct defaults

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core logic that ALL user stories depend on. Must be complete before US1–US3.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 Add `completed?: boolean` field to the `NormalizedItem` interface in `backend/src/integrations/_adapter/types.ts` (optional field; `undefined` = adapter does not report completion state)
- [ ] T004 Add `markMissingItemsAsSourceCompleted(integrationId: string, returnedExternalIds: string[]): Promise<void>` function to `backend/src/sync/cache.service.ts` — queries all non-expired `SyncCacheItem` rows for the integration where `externalId NOT IN returnedExternalIds` and `completedInOrdrctrl = false`, then sets `completedAtSource = true` on those rows (set-difference: items absent from sync results are considered source-complete)
- [ ] T005 Add `applySourceCompletions(integrationId: string): Promise<void>` function to `backend/src/sync/cache.service.ts` — queries `SyncCacheItem` rows where `completedAtSource = true AND completedInOrdrctrl = false`, loads their `SyncOverride` relations, and for each item with NO `REOPENED` override sets `completedInOrdrctrl = true` and `completedAt = now()` (items with a REOPENED override are skipped — override wins)
- [ ] T006 Update the sync worker in `backend/src/sync/sync.worker.ts` to call `markMissingItemsAsSourceCompleted(integrationId, returnedExternalIds)` and then `applySourceCompletions(integrationId)` after each successful `persistCacheItems()` call

**Checkpoint**: Foundation complete — source completion detection and application logic is wired in. All user stories can now begin.

---

## Phase 3: User Stories 1 & 2 — Source Completion + Override Protection (Priority: P1) 🎯 MVP

**Goal (US1)**: When a source marks a task complete, ordrctrl auto-completes it in the feed on next sync.
**Goal (US2)**: A user's Reopened Override always wins — source completion never overrides explicit user intent.

**Independent Test**:
- US1: Connect Microsoft Tasks, complete a task in the source, trigger a sync → task appears in ordrctrl completed section.
- US2: Complete source task, uncheck in ordrctrl, trigger sync → task remains open.

### Implementation for User Stories 1 & 2

- [ ] T007 [US1] Update `backend/src/integrations/microsoft-tasks/index.ts` — change the task fetch query from `$filter=status ne 'completed'` to fetch ALL tasks (remove the filter), and set `NormalizedItem.completed = task.status === 'completed'` for each returned task
- [ ] T008 [P] [US1] Update `backend/src/integrations/gmail/index.ts` — add explicit `completed: false` on all returned `NormalizedItem`s (default inbox_removal mode relies on the Phase 2 set-difference logic; the adapter itself needs no query change, but `completed: false` makes intent explicit for items still in inbox)

### Tests for User Stories 1 & 2

- [ ] T009 [P] [US1] Write unit tests for `markMissingItemsAsSourceCompleted` in `backend/tests/unit/source-sync.cache.test.ts` — test: (a) items absent from returned batch get `completedAtSource=true`; (b) items present in returned batch are unaffected; (c) items with `completedInOrdrctrl=true` already are not re-processed
- [ ] T010 [P] [US1] Write unit tests for `applySourceCompletions` in `backend/tests/unit/source-sync.cache.test.ts` — test: (a) `completedAtSource=true` with no override → sets `completedInOrdrctrl=true`; (b) `completedAtSource=true` with NO REOPENED override → completes; (c) source completion arrives but item already `completedInOrdrctrl=true` → no change
- [ ] T011 [P] [US2] Write unit tests for override protection in `backend/tests/unit/source-sync.cache.test.ts` — test: (a) `completedAtSource=true` with REOPENED override present → `completedInOrdrctrl` stays `false`; (b) REOPENED override exists, user then manually completes in ordrctrl (clears override) → item completes normally on next apply call
- [ ] T012 [P] [US1] Write unit tests for updated Microsoft Tasks adapter sync in `backend/tests/unit/microsoft-tasks.source-completion.test.ts` — test: (a) completed task in source returns `NormalizedItem.completed=true`; (b) active task returns `NormalizedItem.completed=false`; (c) all tasks returned regardless of status (both complete and active)

**Checkpoint**: US1 + US2 fully functional. Microsoft Tasks source completion flows into ordrctrl. Override protection verified by tests. Can demo MVP.

---

## Phase 4: User Story 3 — Gmail Read Mode Config + Settings UI (Priority: P2)

**Goal**: Users can optionally configure Gmail to treat "read" emails as complete, in addition to the default inbox-removal behavior.

**Independent Test**: Update Gmail integration to `read` mode via settings, read an email in Gmail without archiving, trigger sync → email auto-completes in ordrctrl feed.

### Implementation for User Story 3

- [ ] T013 [US3] Update `backend/src/integrations/gmail/index.ts` — when `gmailCompletionMode === 'read'`, change the Gmail query to `in:inbox` (all inbox messages, not just unread), fetch message metadata including `labelIds`, and set `NormalizedItem.completed = !labelIds.includes('UNREAD')` for each message (read = no UNREAD label = source complete)
- [ ] T014 [P] [US3] Add `PATCH /api/integrations/gmail/completion-mode` endpoint to `backend/src/api/integrations.routes.ts` — validates `completionMode` is `inbox_removal` or `read`, updates the authenticated user's Gmail integration's `gmailCompletionMode` field, returns `{ serviceId: 'gmail', completionMode }` on success
- [ ] T015 [P] [US3] Update `GET /api/integrations` response handler in `backend/src/api/integrations.routes.ts` to include `gmailCompletionMode` in the Gmail integration entry so the frontend can show current state
- [ ] T016 [P] [US3] Add `updateGmailCompletionMode(mode: 'inbox_removal' | 'read'): Promise<void>` function to `frontend/src/services/integrations.service.ts`
- [ ] T017 [US3] Create `frontend/src/components/integrations/GmailCompletionModeSelector.tsx` — a toggle/radio component with two options: "Inbox removal (zero inbox)" (default) and "Mark as read"; fetches current mode from props, calls `updateGmailCompletionMode` on change, shows loading/error states
- [ ] T018 [US3] Integrate `GmailCompletionModeSelector` into the Gmail integration settings section in the frontend — render below the existing `GmailSyncModeSelector` in the integrations settings UI

### Tests for User Story 3

- [ ] T019 [P] [US3] Write unit tests for Gmail adapter `read` mode in `backend/tests/unit/gmail.source-completion.test.ts` — test: (a) message with no UNREAD label returns `NormalizedItem.completed=true`; (b) message with UNREAD label returns `NormalizedItem.completed=false`; (c) default `inbox_removal` mode is unaffected (existing tests still pass)
- [ ] T020 [P] [US3] Write unit tests for `GmailCompletionModeSelector` component in `frontend/tests/unit/components/integrations/GmailCompletionModeSelector.test.tsx` — test: (a) renders both options with correct default selected; (b) calls `updateGmailCompletionMode` on selection change; (c) shows loading state during update; (d) shows error state on failure

**Checkpoint**: Gmail read mode fully functional. Settings UI shows current mode and allows switching. All completion modes covered.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final touches, documentation, and validation across all user stories.

- [ ] T021 [P] Update `README.md` to document the Gmail completion mode options (inbox removal vs. read) under the Gmail integration section
- [ ] T022 [P] Update `specs/007-source-sync/spec.md` status from `Draft` to `Complete`
- [ ] T023 Run all backend unit tests and confirm 0 failures: `pnpm --filter backend test`
- [ ] T024 Run all frontend unit tests and confirm 0 failures: `pnpm --filter frontend test`
- [ ] T025 Run frontend lint and confirm 0 errors: `pnpm --filter frontend lint`
- [ ] T026 Run `pnpm --filter frontend build` and confirm build passes
- [ ] T027 Validate quickstart.md scenarios manually: run each test scenario in `specs/007-source-sync/quickstart.md` against the running app

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    └──► Phase 2 (Foundational) — BLOCKS all user stories
              ├──► Phase 3 (US1 + US2, P1) ◄── MVP
              └──► Phase 4 (US3, P2)
                         └──► Phase 5 (Polish)
```

### User Story Dependencies

- **US1 + US2 (Phase 3)**: Depends on Phase 2 (foundational cache logic must be in place)
- **US3 (Phase 4)**: Depends on Phase 2 (same cache layer); independent of US1/US2 implementation but logically builds on it
- **Polish (Phase 5)**: Depends on all desired stories being complete

### Within Each Phase

- T003 (NormalizedItem) must complete before T007, T008, T013 (adapter changes reference the type)
- T004 + T005 (cache functions) must complete before T006 (worker integration)
- T006 (worker) must complete before US1/US2 can be tested end-to-end
- T014 + T015 (backend endpoints) must complete before T016 (frontend service can call them)
- T016 must complete before T017 (component needs the service function)
- T017 must complete before T018 (settings UI integration)

### Parallel Opportunities

- T003, T004, T005 are all different logical units in cache.service.ts — T004 and T005 can be drafted in parallel but T003 must finish first (type dependency)
- T007 and T008 (adapter updates) are in different files — fully parallel
- T009, T010, T011, T012 (Phase 3 tests) are all in different files or test sections — fully parallel
- T013, T014, T015, T016 (Phase 4 implementation) involve different files — T013/T014/T015/T016 all parallel
- T019 and T020 (Phase 4 tests) — fully parallel

---

## Parallel Example: Phase 3 (US1 + US2)

```bash
# After Phase 2 is complete, launch adapter updates in parallel:
Task T007: Update Microsoft Tasks adapter (backend/src/integrations/microsoft-tasks/index.ts)
Task T008: Update Gmail adapter explicit completed=false (backend/src/integrations/gmail/index.ts)

# Then launch all tests for Phase 3 in parallel:
Task T009: markMissingItemsAsSourceCompleted unit tests
Task T010: applySourceCompletions unit tests
Task T011: Override protection unit tests
Task T012: MS Tasks adapter source completion tests
```

## Parallel Example: Phase 4 (US3)

```bash
# Backend and frontend work fully parallel:
Task T013: Gmail adapter read mode (backend)
Task T014: PATCH completion-mode endpoint (backend)
Task T015: GET integrations gmailCompletionMode (backend)
Task T016: updateGmailCompletionMode service (frontend)

# Tests after implementation:
Task T019: Gmail adapter read mode tests
Task T020: GmailCompletionModeSelector component tests
```

---

## Implementation Strategy

### MVP First (US1 + US2 — Phase 1–3 only)

1. Complete Phase 1: Schema migration
2. Complete Phase 2: Foundational cache logic + worker wiring
3. Complete Phase 3: MS Tasks adapter + tests for source completion + override protection
4. **STOP and VALIDATE**: Verify MS Tasks source completion works end-to-end
5. Gmail inbox_removal mode works automatically (no adapter changes needed for default)
6. Deploy/demo — users see source-completed tasks auto-close in feed

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready (schema + cache logic)
2. Phase 3 → US1 + US2 → Test independently → **MVP deployable**
3. Phase 4 → US3 (Gmail read mode + settings) → Test independently → Enhanced Gmail support
4. Phase 5 → Polish → Ready for merge

### Notes

- [P] tasks = different files, no pending dependencies — safe to parallelize
- [Story] label traces each task to the user story it satisfies
- Override protection (US2) is tested in Phase 3 but implemented in Phase 2 — this is intentional; T005 contains the override check, Phase 3 tests verify it
- Gmail default inbox_removal mode works with zero adapter changes — the Phase 2 set-difference logic handles it
- Total tasks: 27 | Phase 1: 2 | Phase 2: 4 | Phase 3: 6 | Phase 4: 8 | Phase 5: 7
