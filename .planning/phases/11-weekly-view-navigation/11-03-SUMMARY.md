---
phase: 11-weekly-view-navigation
plan: "03"
subsystem: frontend/testing
tags: [playwright, e2e, weekly-navigation, test]
dependency_graph:
  requires: [11-02]
  provides: [e2e-weekly-navigation-tests]
  affects: [frontend/tests/e2e]
tech_stack:
  added: []
  patterns: [playwright-e2e, session-cookie-auth, skip-guard]
key_files:
  created:
    - frontend/tests/e2e/weekly-navigation.spec.ts
  modified: []
decisions:
  - "Self-contained date helpers in test file (no src imports) per e2e test isolation policy"
  - "Tests skip gracefully when E2E_SESSION_COOKIE unset — zero noise in CI without secrets"
metrics:
  duration: "~1 minute"
  completed: "2026-06-06"
  tasks_completed: 1
  tasks_total: 2
  files_changed: 1
---

# Phase 11 Plan 03: Playwright E2E Tests for Weekly Navigation Summary

**One-liner:** Playwright e2e test suite with 4 test cases (TC-WN-01–04) covering prev/next/today week navigation, using session-cookie auth guard and self-contained date helpers.

## Tasks Completed

### Task 1: Write Playwright e2e tests for week navigation ✅

- **Commit:** `749268e` — `test(frontend): add Playwright e2e tests for weekly view navigation (TC-WN-01–04)`
- **File created:** `frontend/tests/e2e/weekly-navigation.spec.ts` (90 lines)
- **Test cases:**
  - **TC-WN-01:** Clicking ← moves view back one week → asserts "Today" button appears
  - **TC-WN-02:** Clicking → moves view forward one week → asserts "Today" button appears
  - **TC-WN-03:** Tapping Today from an offset week returns to current week → asserts date range label reappears
  - **TC-WN-04:** Center shows date range label when on current week → asserts formatted range visible on load
- **TypeScript:** No compilation errors (`tsc --noEmit` clean)
- **Unit test regressions:** None — all 204 unit tests pass

### Task 2: Human verify — weekly navigation works end-to-end

**Status: PENDING HUMAN CHECKPOINT**

Human must start dev server, navigate to `/feed`, switch to Week view, and verify:
1. ← and → nav buttons appear and shift the week correctly
2. "Today" button appears when off the current week and returns to current week on tap
3. Center label shows date range on current week, switches to "Today" text when offset

## Deviations from Plan

None — plan executed exactly as written. The exact test content specified in the task prompt was used verbatim.

## Verification

- `frontend/tests/e2e/weekly-navigation.spec.ts` exists: ✅
- 4 test cases (TC-WN-01 through TC-WN-04): ✅
- TypeScript clean: ✅
- Unit test regressions: None (204/204 pass)
- Tests skip gracefully when `E2E_SESSION_COOKIE` unset: ✅

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. Test file reads only the rendered DOM and uses an existing session cookie pattern identical to `feed.spec.ts`. No new threat surface.

## Self-Check: PASSED

- `frontend/tests/e2e/weekly-navigation.spec.ts` exists ✅
- Commit `749268e` exists in git log ✅
