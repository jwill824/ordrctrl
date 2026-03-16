---
description: "Task list for 017-task-rename-polish"
---

# Tasks: Task Rename, Console Error Fix & Documentation Polish

**Input**: Design documents from `/specs/017-task-rename-polish/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prisma schema update — the only structural prerequisite in this feature

> ⚠️ Required only for User Story 1 (backend tasks). US2 and US3 can begin immediately without waiting for this phase.

- [x] T001 Add `TITLE_OVERRIDE` value to `OverrideType` enum in `backend/prisma/schema.prisma`
- [x] T002 Generate and apply Prisma migration for `TITLE_OVERRIDE` addition (run `prisma migrate dev` in `backend/`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No shared prerequisites across all three stories — this phase is not applicable.

> US1 depends on Phase 1 completion for its backend tasks. US2 and US3 are fully independent and can begin in parallel with Phase 1.

*(No tasks — see phase dependency notes below)*

---

## Phase 3: User Story 1 — Rename a Task (Priority: P1) 🎯 MVP

**Goal**: Users can rename any synced task to a custom title; the original title is preserved in the description; the custom title survives integration re-syncs; clearing the field reverts to the original synced title.

**Independent Test**: Open the app, find a synced task, open `EditTaskModal`, enter a custom title, save — verify the new title appears in the feed and `"Original: …"` is visible in the task description. Trigger a re-sync and confirm the custom title is not overwritten.

### Implementation for User Story 1

- [x] T003 [US1] Update feed assembly in `backend/src/feed/feed.service.ts` to fetch `TITLE_OVERRIDE` overrides alongside `DESCRIPTION_OVERRIDE` and populate `title` (custom wins), `hasTitleOverride`, and `originalTitle` on the `FeedItem` response shape
- [x] T004 [US1] Implement `setTitleOverride()` function in `backend/src/feed/feed.service.ts` — upsert or delete the `TITLE_OVERRIDE` `SyncOverride` row; when setting a title, idempotently prepend `"Original: {syncCacheItem.title}"` to the `DESCRIPTION_OVERRIDE` (skip if already starts with that prefix)
- [x] T005 [US1] Add `PATCH /api/feed/sync/:id/title-override` endpoint in `backend/src/api/feed.routes.ts` with request body validation (reject empty string; accept `null` to clear), `404` for unknown item, and return updated `FeedItem`
- [x] T006 [P] [US1] Extend `FeedItem` type with `hasTitleOverride: boolean` and `originalTitle: string | null` fields and add `setTitleOverride(id: string, value: string | null)` API call in `frontend/src/services/feed.service.ts`
- [x] T007 [US1] Add title input field for synced tasks in `frontend/src/components/tasks/EditTaskModal.tsx` — pre-fill with current title, show `"Original: …"` label when `hasTitleOverride` is true, wire save to `setTitleOverride(id, value)` and clear/revert to `setTitleOverride(id, null)`. Native tasks already support rename via `PUT /api/tasks/:id` (no modal change needed for native).

**Checkpoint**: User Story 1 is fully functional — rename, persist, revert, and re-sync survival all work. Validate using quickstart.md Scenarios 1–4.

---

## Phase 4: User Story 2 — Clean Developer Console (Priority: P2)

**Goal**: Zero recurring uncaught TypeErrors appear in the developer console during normal app usage.

**Independent Test**: Open the app in Chrome, log in, navigate between the feed and settings pages, and confirm no recurring `TypeError: Cannot read properties of null (reading 'id')` errors appear in the console.

### Implementation for User Story 2

- [ ] T008 [P] [US2] Investigate the `TypeError` by reproducing it in an incognito window with all extensions disabled; if the error disappears in incognito, confirm it originates from a browser extension content script (`content.js`) as identified in research.md Investigation 2
- [x] T009 [US2] Document finding in `docs/development.md` — add a "Known browser noise" section explaining that the `content.js TypeError` is a browser extension artifact, not app code; close GitHub issue #48 with a clear explanation comment

> **Note**: If the error persists in incognito, trace it via source maps and fix the null property access in app source before completing T009.

**Checkpoint**: Developer console is clean during a normal session. Validate using quickstart.md Scenario 5.

---

## Phase 5: User Story 3 — Accurate, Navigable Documentation (Priority: P3)

**Goal**: README, CONTRIBUTING, development guide, and architecture diagram are accurate, non-duplicated, and maintainable.

**Independent Test**: Read `README.md` → `CONTRIBUTING.md` → `docs/development.md` → `docs/architecture.md` in sequence — no duplicate sections, spec-numbered branch convention is present, no TL;DR block, and the architecture diagram renders as Mermaid in GitHub's markdown preview.

### Implementation for User Story 3

- [x] T010 [P] [US3] Update `CONTRIBUTING.md` branching section — replace generic git flow text with the spec-numbered `NNN-short-name` convention and include examples of valid and invalid branch names
- [x] T011 [P] [US3] Update `README.md` — remove the speckit workflow section and replace it with a single reference line: *"For contribution workflow and speckit, see [CONTRIBUTING.md](./CONTRIBUTING.md)."*
- [x] T012 [P] [US3] Remove the TL;DR section from `docs/development.md`
- [x] T013 [P] [US3] Convert the ASCII system architecture diagram to a Mermaid `graph TD` in `docs/architecture.md` — nodes: Browser, Vite SPA, Fastify API, PostgreSQL, Redis, Integration Services, Capacitor Shell, Tauri Shell; maintain the same level of abstraction as the current diagram

**Checkpoint**: Documentation is accurate and non-duplicated. Validate using quickstart.md Scenario 6.

---

## Final Phase: Polish & Validation

**Purpose**: End-to-end validation and regression confirmation

- [ ] T014 Run full quickstart.md validation (Scenarios 1–6) against local stack (`docker-compose up -d` + `pnpm dev`). Explicitly verify: (a) renaming a native task via the feed (FR-001/FR-006 native coverage), (b) rename completes in under 10 seconds from initiating the action (SC-001)
- [x] T015 [P] Run existing Vitest and Playwright test suites to confirm no regressions introduced by this feature
- [x] T016 [P] Write unit/contract tests for `setTitleOverride()` route in `backend/tests/unit/feed.routes.title.test.ts` — covers 200 set, 200 clear, 400 empty, 400 whitespace, 401 unauth, 404 not found (mirrors `feed.routes.description.test.ts` pattern)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Not applicable for this feature
- **Phase 3 (US1)**: Backend tasks (T003–T005) depend on Phase 1; frontend tasks (T006–T007) can begin in parallel with Phase 1 since the data model is defined in data-model.md
- **Phase 4 (US2)**: No phase dependencies — fully independent; start immediately
- **Phase 5 (US3)**: No phase dependencies — fully independent; start immediately
- **Final Phase**: Depends on all desired stories being complete

### User Story Dependencies

- **US1**: T003–T005 depend on Phase 1 (Prisma migration must be applied); T006 can start in parallel (different file); T007 depends on T006
- **US2**: No dependencies on US1 or US3 — fully independent
- **US3**: No dependencies on US1 or US2 — fully independent; all four doc tasks target different files

### Within User Story 1

```
T001 → T002 → T003 → T004 → T005   (Prisma → backend feed service → route)
             T006 → T007            (frontend — can start in parallel with T003)
```

---

## Parallel Execution Examples

### Immediate parallel start

```
Phase 1:  T001 → T002                    (Prisma migration — unblocks US1 backend)
US2:      T008 → T009                    (Console investigation — fully independent)
US3:      T010, T011, T012, T013         (All four doc tasks — different files, fully parallel)
```

### Once Phase 1 completes

```
US1 backend:   T003 → T004 → T005
US1 frontend:  T006 → T007
```

### Final

```
T014, T015   (validation and regression — after all stories complete)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Prisma migration (T001–T002)
2. Complete Phase 3: User Story 1 (T003–T007)
3. **STOP and VALIDATE**: Test rename end-to-end using quickstart.md Scenarios 1–4
4. Deploy/demo if ready

### Incremental Delivery

1. Phase 1 + US1 → Task rename working → **MVP**
2. US2 → Console clean → Developer quality win
3. US3 → Docs accurate → Contributor onboarding improved
4. Final Phase → Full validation and regression check

### Parallel Team / Agent Strategy

- **Dev A**: Phase 1 → US1 (T001–T007)
- **Dev B**: US2 (T008–T009) — start immediately, no dependencies
- **Dev C**: US3 (T010–T013) — start immediately, all four tasks fully parallelizable

---

## Notes

- [P] tasks = different files, no blocking dependencies on other in-flight tasks
- [Story] label maps each task to its user story for traceability
- US2 and US3 have zero dependencies on US1 or on each other
- T006 is marked [P] because it targets a different file than the backend tasks T003–T005
- Native task rename already works via `PUT /api/tasks/:id` — no changes needed for native tasks (confirmed in research.md)
- T008 may produce no code change if the error is confirmed as a browser extension artifact — that outcome satisfies SC-004
- Commit after each task or logical group; each story is independently mergeable
