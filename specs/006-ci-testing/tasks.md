---
description: "Task list for GitHub Actions CI Pipeline (006-ci-testing)"
---

# Tasks: GitHub Actions CI Pipeline

**Branch**: `006-ci-testing`  
**Input**: `/specs/006-ci-testing/` — spec.md, plan.md, research.md, quickstart.md, contracts/ci-workflow.md  
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · contracts/ci-workflow.md ✅

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to
- Exact file paths are included in every task description

---

## Phase 1: Fix Pre-Existing Test Failures (Foundational — Blocks CI Baseline)

**Purpose**: All 15 currently failing backend tests must be fixed so the CI pipeline starts
with a clean green baseline. Without this, every CI run shows red regardless of code health.

**⚠️ CRITICAL**: The CI workflow in Phase 2 is useless until this phase is complete.

- [x] T001 Delete orphaned test file `backend/tests/unit/apple-reminders.sync.test.ts` — the source module `src/integrations/apple-reminders/index.js` was removed in a prior sprint; this file now fails to load at import time

- [x] T002 Fix `backend/tests/unit/apple-calendar.sync.test.ts` — 5 failures caused by missing `headers` on fetch mock responses; the CalDAV adapter's `discoverCalendarHome()` calls `discoverRes.headers.get('Location')` but mock responses lack a `headers` property:
  - Add `headers: { get: vi.fn().mockReturnValue(null) }` to every `mockFetch.mockResolvedValue*` call in the file that doesn't already include headers
  - For the discovery (first fetch in `sync()` tests): mock a `status: 207` response whose `.text()` returns XML containing a `<C:calendar-home-set><D:href>/caldav/calendars/</D:href></C:calendar-home-set>` element so `extractCalendarHome()` succeeds and the function returns without falling through to the `headers.get('Location')` branch
  - The `listSubSources()` test first mock does not go through `discoverCalendarHome` — add `headers: { get: vi.fn().mockReturnValue(null) }` there to guard against any future path changes

- [x] T003 Fix `backend/tests/unit/integration.service.test.ts` — 6 failures across 4 root causes; fixes span both the test file and the service implementation:

  **Root cause A — `findFirst` not mocked** (breaks `use-existing` tests):
  - In the `vi.mock('../../src/lib/db.js')` factory at the top of the file, add `findFirst: vi.fn()` to the `prisma.integration` mock object alongside the existing `findUnique`, `findMany`, etc.
  - In `use-existing: copies credentials from connected sibling`: set `mockPrisma.integration.findFirst.mockResolvedValue({ id: 'sibling-int', status: 'connected', encryptedAccessToken: 'user@icloud.com', encryptedRefreshToken: 'sibling-asp' })` before calling `connectIntegration`
  - In `use-existing: throws NO_EXISTING_CREDENTIALS when no connected sibling`: set `mockPrisma.integration.findFirst.mockResolvedValue(null)`

  **Root cause B — `instanceof AppError` fails across ESM module boundary**:
  - In `throws NO_EXISTING_CREDENTIALS`: replace `expect(e).toBeInstanceOf(AppError)` / `rejects.toThrow(AppError)` with `expect(e.name).toBe('AppError')` and `expect(e.code).toBe('NO_EXISTING_CREDENTIALS')` — the thrown error is the real `AppError` from the service, but the test's imported class reference differs across the ESM boundary

  **Root cause C — `apple_reminders` removed from `ALL_SERVICE_IDS`** (breaks `maskedEmail` tests):
  - In `returns maskedEmail for Apple service with credentials`: change `serviceId: 'apple_reminders'` in the mock data to `serviceId: 'apple_calendar'`; update the finder: `items.find((i) => i.serviceId === 'apple_calendar')`
  - In `returns maskedEmail: null for disconnected Apple service`: same change — `serviceId: 'apple_reminders'` → `serviceId: 'apple_calendar'`; update finder to match

  **Root cause D — `disconnectIntegration` missing sibling credential-purge logic** (breaks 2 tests):
  - In `backend/src/integrations/integration.service.ts` → `disconnectIntegration()`: after calling `adapter.disconnect()`, add logic to find the Apple sibling integration (whichever of `apple_calendar` / `apple_reminders` is the OTHER service) and if that sibling's status is `disconnected` with non-empty `encryptedAccessToken`, clear its credentials with `prisma.integration.update({ where: { id: sibling.id }, data: { encryptedAccessToken: '', encryptedRefreshToken: null } })`
  - This consumes the second `mockResolvedValueOnce` set up in the `purges sibling credentials` test, which also fixes the leftover-mock-queue issue that causes `updateCalendarEventWindow` to receive a `disconnected` integration from a prior test's unspent mock

- [x] T004 Fix `backend/tests/contract/integration-connect.routes.test.ts` — 4 failures; the route at `POST /api/integrations/:serviceId/connect` validates `serviceId` against `VALID_SERVICE_IDS = ['gmail', 'microsoft_tasks', 'apple_calendar']`; `apple_reminders` was removed but the contract tests still send to `/apple_reminders/connect`, causing a 400 before the mock service is ever called:
  - Change the URL in the first 4 `app.inject` calls from `/api/integrations/apple_reminders/connect` to `/api/integrations/apple_calendar/connect`
  - The 5th test (`gmail → 400 UNSUPPORTED_SERVICE`) and all `PUT /event-window` tests are unaffected

- [x] T005 Run the full backend test suite and confirm zero failures: `pnpm --filter backend test` — expected output: `Tests  0 failed | 119 passed (119)` (or similar); this is the green baseline that CI will enforce going forward

**Checkpoint**: Full backend test suite exits 0. Phase 2 can now proceed.

---

## Phase 2: User Story 1 — Automated Checks on Every Pull Request (Priority: P1) 🎯 MVP

**Goal**: Every PR and push to main automatically runs 4 named status checks. A failing check
blocks the PR from merging. CI completes in under 10 minutes.

**Independent Test**: Open a PR with a deliberate test failure → verify the PR shows a failing
status check with the test name → fix the failure → verify all 4 checks go green.

> **Note**: User Story 2 (CI on push to main) and User Story 4 (clear status check names) are
> delivered by the same workflow file — they require no separate tasks.

- [x] T006 [US1] Create `.github/workflows/ci.yml` implementing the 4-job parallel CI pipeline per `contracts/ci-workflow.md`:
  - **Triggers**: `push` to `main` and `pull_request` targeting `main`
  - **Concurrency**: group `ci-${{ github.ref }}`, `cancel-in-progress: true`
  - **Job `backend-unit`** (`timeout-minutes: 10`): checkout → `pnpm/action-setup@v4` (version: 9) → `actions/setup-node@v4` (node-version: 20, cache: pnpm) → `pnpm install --frozen-lockfile` → `pnpm --filter backend test`
  - **Job `backend-contract`** (`timeout-minutes: 10`): same 5-step structure → `pnpm --filter backend test:contract`
  - **Job `frontend-lint`** (`timeout-minutes: 10`): same 5-step structure → `pnpm --filter frontend lint`
  - **Job `frontend-build`** (`timeout-minutes: 10`): same 5-step structure → `pnpm --filter frontend build`
  - All 4 jobs run in parallel (no `needs:` dependencies)
  - No secrets required — all backend tests use `vi.mock`; do NOT add any `secrets:` keys to `pull_request` triggered jobs
  - Job IDs MUST exactly match the contract: `backend-unit`, `backend-contract`, `frontend-lint`, `frontend-build` — these names become the PR status check names referenced in branch protection

- [x] T007 [US1] Validate the workflow YAML syntax: run `gh workflow list` after pushing the branch or use a YAML linter (`npx js-yaml .github/workflows/ci.yml`) to confirm the file parses without errors; a malformed file fails silently (no checks appear on PRs) rather than failing loudly

**Checkpoint**: Push a commit to the `006-ci-testing` branch and verify all 4 jobs appear in the
GitHub Actions tab. Confirm job names match exactly: `backend-unit`, `backend-contract`,
`frontend-lint`, `frontend-build`.

---

## Phase 3: Polish & Cross-Cutting Concerns

**Purpose**: Ensure branch protection is documented and the feature is complete end-to-end.

- [x] T008 Verify `specs/006-ci-testing/quickstart.md` is accurate and complete — confirm the branch protection instructions match the actual job names from T006; add any clarifications needed for contributors who will set up the branch protection rule (requires repo admin access — cannot be automated in CI)

---

## Dependency Graph

```
T001 (delete orphan)  ──┐
T002 (calendar mocks) ──┤
T003 (service fixes)  ──┼──▶ T005 (verify 0 failures) ──▶ T006 (ci.yml) ──▶ T007 (validate)
T004 (route schema)   ──┘                                                         │
                                                                                  ▼
                                                                              T008 (docs)
```

T001–T004 are independent of each other (different files) and can be executed in parallel.
T005 depends on T001–T004 all being complete.
T006–T007 depend on T005 (green baseline required before CI is meaningful).
T008 is independent of T006–T007 but logically follows.

---

## Parallel Execution

**Phase 1** (fix tests): T001, T002, T003, T004 can be worked in parallel — each touches a distinct file.

**Phase 2** (CI workflow): T006 and T008 can be worked in parallel once T005 is done.

---

## Implementation Strategy

**MVP (ship this first)**: Complete T001–T007 in order. The result is a fully working CI pipeline
with a clean green baseline on every PR. Branch protection (T008) is a documentation-only
task that can follow.

**Suggested commit sequence**:
1. `fix(tests): delete orphaned apple-reminders test` (T001)
2. `fix(tests): add headers mock to apple-calendar fetch responses` (T002)
3. `fix(tests,service): repair integration.service mocks and add sibling credential purge` (T003)
4. `fix(tests): update contract tests to use apple_calendar serviceId` (T004)
5. `ci: add GitHub Actions workflow with 4 parallel jobs` (T006 + T007)

---

## Summary

| Phase | Tasks | Story | Parallelizable |
|-------|-------|-------|---------------|
| Foundational — fix tests | T001–T005 | US3 (P2) | T001–T004 in parallel |
| CI Workflow | T006–T007 | US1 (P1), US2 (P2), US4 (P3) | T007 after T006 |
| Polish | T008 | — | Independent |

**Total tasks**: 8  
**Test tasks**: 0 (not requested — tests are the thing being fixed, not added)  
**Parallel opportunities**: T001–T004 (Phase 1), T008 (Polish)  
**Suggested MVP scope**: T001–T007 (complete CI pipeline with green baseline)

**Format validation**: All 8 tasks follow the checklist format — checkbox ✅ · Task ID ✅ · [P] where applicable ✅ · [Story] on US-phase tasks ✅ · file paths in every description ✅
