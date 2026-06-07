---
phase: 11-weekly-view-navigation
plan: "01"
subsystem: frontend/utils
tags: [dateUtils, weeklyPlanner, formatting]
dependency_graph:
  requires: []
  provides:
    - formatWeekRange export in frontend/src/utils/dateUtils.ts
  affects:
    - frontend/src/utils/dateUtils.ts
    - frontend/tests/unit/utils/dateUtils.test.ts
tech_stack:
  added: []
  patterns:
    - Pure date utility using toLocaleDateString('en-US', ...) for locale-safe formatting
    - addDays() reuse for end-of-week calculation
key_files:
  modified:
    - frontend/src/utils/dateUtils.ts
  created:
    - frontend/tests/unit/utils/dateUtils.test.ts
decisions:
  - Same-month format omits repeated month label ("Jun 1–7") — no spaces around en-dash (U+2013)
  - Cross-month/cross-year format repeats month abbreviations with spaces around en-dash ("Jun 30 – Jul 6")
  - getMonth() comparison used to distinguish same-month vs cross-month
metrics:
  duration: 60s
  completed: 2026-06-06T19:54:47Z
  tasks_completed: 2
  files_changed: 2
---

# Phase 11 Plan 01: formatWeekRange Utility Summary

**One-liner:** `formatWeekRange` added to dateUtils using `toLocaleDateString('en-US')` + en-dash logic for same-month vs cross-month week labels.

## What Was Built

Added `formatWeekRange(weekStart: Date): string` to `frontend/src/utils/dateUtils.ts`. The function:
- Computes the Sunday end date via `addDays(weekStart, 6)` (already exported)
- Formats each date with `toLocaleDateString('en-US', { month: 'short', day: 'numeric' })`
- Returns `"Jun 1–7"` (same month, no spaces, en-dash U+2013) or `"Jun 30 – Jul 6"` (cross-month, spaces around en-dash)

Created `frontend/tests/unit/utils/dateUtils.test.ts` with 5 `it()` cases covering:
1. Same-month: `new Date(2026, 5, 1)` → `"Jun 1–7"`
2. Cross-month (D-05 example): `new Date(2026, 5, 30)` → `"Jun 30 – Jul 6"`
3. Cross-year: `new Date(2025, 11, 29)` → `"Dec 29 – Jan 4"`
4. Same month, mid-month: `new Date(2026, 5, 8)` → `"Jun 8–14"`
5. Cross-month Jul→Aug: `new Date(2026, 6, 27)` → `"Jul 27 – Aug 2"`

## Commits

| Hash | Message |
|------|---------|
| 65e4fde | feat(frontend): add formatWeekRange utility to dateUtils |

## Test Results

```
✓ tests/unit/utils/dateUtils.test.ts  (5 tests) 9ms
Test Files  1 passed (1)
     Tests  5 passed (5)
```

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None — pure utility function with no I/O, no network, no trust boundary.

## Self-Check: PASSED

- [x] `frontend/src/utils/dateUtils.ts` — `grep -c 'export function formatWeekRange'` → 1
- [x] `frontend/tests/unit/utils/dateUtils.test.ts` — exists, 24 lines, 5 tests
- [x] `pnpm vitest run dateUtils` — exit 0, 5/5 pass
- [x] Commit 65e4fde exists
