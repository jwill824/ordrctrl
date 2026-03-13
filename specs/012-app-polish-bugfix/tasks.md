# Tasks: App Polish & Bug Fix Bundle

**Branch**: `012-app-polish-bugfix` | **Issues**: #45 (refresh bug), #41 (menu cleanup), #40 (dead code)  
**Input**: `specs/012-app-polish-bugfix/` — spec.md, plan.md, research.md, data-model.md, quickstart.md  
**Generated**: 2025-07-24  
**Scope**: Frontend-only surgical fixes; no backend changes, no new dependencies, no schema changes

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: User story this task belongs to — [US1], [US2], [US3]
- Exact file paths included in every task description

---

## Phase 1: Setup (Pre-flight Baseline)

**Purpose**: Confirm the test suite is fully green before any changes are made. Establishes the
passing baseline so any regression introduced during implementation is immediately detectable.

- [X] T001 [P] Run baseline frontend test suite and confirm all tests pass: `cd frontend && pnpm test`
- [X] T002 [P] Run baseline backend test suite and confirm all tests pass: `cd backend && pnpm test`

**Checkpoint**: Both test suites green → safe to begin user story work

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No shared infrastructure is needed for this bug-fix bundle. All three user stories
touch different files and can proceed independently once the pre-flight baseline is confirmed.

> **Note**: One cross-story sequencing constraint exists: **T009 (US-2 redirect) must be merged
> before T014 (US-3 page deletion)** so the `/settings/dismissed` URL never returns a 404 between
> the two changes. Within a single branch this means implement T009 before T014.

**Checkpoint**: Pre-flight complete (Phase 1 done) → all three user story phases may begin

---

## Phase 3: User Story 1 — Manual Refresh Surfaces New Tasks (Priority: P1) 🎯 MVP

**Goal**: Fix the `useFeed` polling loop so it forwards the hook's own `showDismissed` and
`includeCompleted` options instead of hardcoding `showDismissed: false`. Dismissed items will no
longer flicker out during a refresh cycle. Add a non-blocking timeout notice (FR-005).

**Independent Test**: Open `/feed?showDismissed=true`, confirm dismissed items are visible, click
Refresh, verify dismissed items remain visible throughout the polling cycle and the feed updates
without a full page reload.

### Implementation

- [X] T003 [US1] Fix polling loop options in `frontend/src/hooks/useFeed.ts` (~line 132): change `feedService.fetchFeed({ showDismissed: false })` → `feedService.fetchFeed({ includeCompleted: true, showDismissed })`
- [X] T004 [US1] Add sync-timeout error notice in `frontend/src/hooks/useFeed.ts`: after the polling `while` loop, if `Date.now() >= deadline` call `setError('Sync is taking longer than expected. Showing latest available data.')` before `reloadFeed()` (FR-005)

### Regression Tests for User Story 1

- [X] T005 [US1] Add unit test — `refresh() with showDismissed:true passes showDismissed:true to fetchFeed during polling` in `frontend/tests/unit/hooks/useFeed.test.ts`
- [X] T006 [US1] Add unit test — `refresh() with showDismissed:false passes showDismissed:false to fetchFeed during polling` in `frontend/tests/unit/hooks/useFeed.test.ts`
- [X] T007 [US1] Add unit test — `refresh() always includes includeCompleted:true in polling fetchFeed calls` in `frontend/tests/unit/hooks/useFeed.test.ts`
- [X] T008 [US1] Add unit test — `refresh() sets error state when polling deadline is exceeded without sync completion` in `frontend/tests/unit/hooks/useFeed.test.ts`
- [X] T009 [US1] Run US-1 regression tests to confirm all new and existing hook tests pass: `cd frontend && pnpm test tests/unit/hooks/useFeed.test.ts`

**Checkpoint**: Refresh fix verified — dismissed items persist during polling, timeout notice fires, all tests green

---

## Phase 4: User Story 2 — Simplified Navigation Menu (Priority: P2)

**Goal**: Add a permanent (308) redirect for `/settings/dismissed` → `/feed?showDismissed=true`
in `next.config.js` so any bookmarked URLs resolve gracefully after the route page is deleted in
US-3. Confirm `AccountMenu` has no stale or orphaned entries.

**Independent Test**: Visit `http://localhost:3000/settings/dismissed` and confirm a 308 redirect
to `/feed?showDismissed=true`. Click every item in `AccountMenu` and confirm each navigates to a
working, current destination.

### Implementation

- [X] T010 [US2] Audit `AccountMenu` for stale entries: `grep -r "triage\|settings/dismissed" frontend/src/` and confirm zero hits in the component file; document the current 5-item menu matches the verified table in `research.md`
- [X] T011 [US2] Add permanent redirect rule to `frontend/next.config.js`: source `/settings/dismissed`, destination `/feed?showDismissed=true`, `permanent: true` (308)

### Regression Tests for User Story 2

- [X] T012 [US2] Run frontend production build to verify redirect configuration compiles with zero errors: `cd frontend && pnpm build`

**Checkpoint**: Redirect active — `/settings/dismissed` resolves to the feed; AccountMenu verified clean

---

## Phase 5: User Story 3 — Dead Code Removed (Priority: P3)

**Goal**: Delete the `/settings/dismissed` redirect page and the three dead symbols
(`getDismissedItems()`, `DismissedItem`, `DismissedItemsResponse`) from `feed.service.ts`.
Remove the corresponding test block. Build must complete cleanly with zero errors or stale-import
warnings.

**Prerequisite**: T011 (next.config.js redirect) must be committed first so the URL never 404s.

**Independent Test**: Run `pnpm build` — zero errors. Run `grep -r "getDismissedItems\|DismissedItem\|settings/dismissed" frontend/src/` — zero results.

### Implementation

- [X] T013 [US3] Remove `DismissedItem` interface and `DismissedItemsResponse` interface from `frontend/src/services/feed.service.ts` (approximately lines 35 and 43)
- [X] T014 [US3] Remove `getDismissedItems()` function from `frontend/src/services/feed.service.ts` (approximately lines 109–120)
- [X] T015 [US3] Delete `frontend/src/app/settings/dismissed/page.tsx` and remove the now-empty `frontend/src/app/settings/dismissed/` directory
- [X] T016 [US3] Remove the `getDismissedItems` describe/test block from `frontend/tests/unit/services/feed.service.test.ts`

### Verification & Regression Tests for User Story 3

- [X] T017 [US3] Run symbol grep to confirm zero remaining references: `grep -r "getDismissedItems\|DismissedItem\|DismissedItemsResponse" frontend/src/` (expect: no output)
- [X] T018 [US3] Run route grep to confirm zero remaining references to the deleted route in source: `grep -r "settings/dismissed" frontend/src/` (expect: no output; `next.config.js` is outside `src/` — that reference is intentional)
- [X] T019 [US3] Run US-3 regression tests to confirm feed service tests still pass: `cd frontend && pnpm test tests/unit/services/feed.service.test.ts`

**Checkpoint**: Dead code gone — symbols removed, page deleted, directory cleaned, tests updated, no stale references

---

## Phase 6: Polish & Full Regression

**Purpose**: End-to-end validation confirming all three user stories work together, no cross-story
regressions, and the production build is clean.

- [X] T020 [P] Run full frontend test suite to confirm all stories' tests pass and nothing regressed: `cd frontend && pnpm test`
- [X] T021 [P] Run full backend test suite to confirm backend is untouched and green: `cd backend && pnpm test`
- [X] T022 Run full frontend production build and confirm zero errors/warnings attributable to removed code: `cd frontend && pnpm build`
- [X] T023 Run manual smoke test sequence per `specs/012-app-polish-bugfix/quickstart.md`: visit `/feed`, `/inbox`, `/feed?showDismissed=true` (verify refresh no flicker), `/settings/dismissed` (verify 308 redirect), and click through all `AccountMenu` items to confirm each navigates correctly

**Checkpoint**: All stories independently verified, full suite green, production build clean → branch ready for PR

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Pre-flight)
  └─► Phase 3 (US-1)  ← independent, no prerequisites beyond baseline
  └─► Phase 4 (US-2)  ← independent, no prerequisites beyond baseline
       └─► Phase 5 (US-3)  ← T011 (redirect) must precede T015 (page deletion)
  └─► Phase 6 (Regression)  ← requires all story phases complete
```

### Cross-Story Dependency (Single Constraint)

| Depends On | Required By | Reason |
|------------|-------------|--------|
| T011 (add next.config.js redirect) | T015 (delete page.tsx) | Redirect must be in place before the page is removed so `/settings/dismissed` never returns 404 |

### Within Each User Story

- US-1: T003 → T004 (both in `useFeed.ts`; T004 extends the same function) → T005–T008 (tests) → T009 (run)
- US-2: T010 (audit) → T011 (add redirect) → T012 (build verify)
- US-3: T011 must be done first (cross-story) → T013–T016 (removals, any order within story) → T017–T019 (verify)

### Parallel Opportunities

- T001 and T002 can run in parallel (different test suites, different directories)
- US-1, US-2, and US-3 phases can be worked in parallel by different developers after Phase 1 completes — with the single constraint that T011 precedes T015
- T020 and T021 (final regression) can run in parallel

---

## Parallel Example: Phase 1 Baseline

```bash
# Run both test suites simultaneously:
cd frontend && pnpm test   # T001
cd backend && pnpm test    # T002 — run in a second terminal
```

## Parallel Example: User Story 1 (Refresh Fix)

```bash
# Implement fix first (T003, T004 — same file, sequential):
# Edit frontend/src/hooks/useFeed.ts

# Then add tests (T005-T008 — same file, write sequentially):
# Edit frontend/tests/unit/hooks/useFeed.test.ts

# Then run to verify (T009):
cd frontend && pnpm test tests/unit/hooks/useFeed.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only — 9 tasks)

1. ✅ Complete Phase 1: Pre-flight baseline (T001–T002)
2. ✅ Complete Phase 3: US-1 refresh fix (T003–T009)
3. **STOP and VALIDATE**: Run `pnpm test tests/unit/hooks/useFeed.test.ts`, manually verify refresh on `/feed?showDismissed=true`
4. The single most impactful regression (#45) is fixed and deployable

### Incremental Delivery

1. Phase 1 → Baseline confirmed
2. Phase 3 (US-1) → Refresh fix working, tested → **Deployable MVP**
3. Phase 4 (US-2) → Redirect in place, AccountMenu verified → **Deployable**
4. Phase 5 (US-3) → Dead code gone, build clean → **Deployable**
5. Phase 6 → Full regression confirmed → **PR-ready**

### Parallel Team Strategy (if staffed)

After Phase 1 completes:
- **Developer A**: Phase 3 (US-1) — `useFeed.ts` and its test file
- **Developer B**: Phase 4 (US-2) + start Phase 5 — `next.config.js` then `feed.service.ts` cleanup (ensuring T011 lands before T015)

---

## Summary

| Phase | Tasks | Story | Parallelizable |
|-------|-------|-------|----------------|
| Phase 1 — Pre-flight | T001–T002 | — | Yes (T001 ∥ T002) |
| Phase 3 — US-1 Refresh Fix | T003–T009 | US1 | Phases can run ∥ with US2 |
| Phase 4 — US-2 Nav Redirect | T010–T012 | US2 | Phases can run ∥ with US1 |
| Phase 5 — US-3 Dead Code | T013–T019 | US3 | After T011 (US2 redirect) |
| Phase 6 — Full Regression | T020–T023 | — | T020 ∥ T021 |
| **Total** | **23 tasks** | | |

**Suggested MVP scope**: Phase 1 + Phase 3 only (T001–T009, 9 tasks) — fixes the P1 regression and is immediately shippable.
