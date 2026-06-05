---
phase: 09-drag-to-reschedule
plan: "01"
subsystem: frontend/tests
tags: [tdd, drag-to-reschedule, unit-tests, wave-0, red-phase]
dependency_graph:
  requires: []
  provides:
    - RED test suite for useDragToReschedule hook (W0-A through W0-G)
    - RED test suite for DraggableTimeBlock component (W0-E, W0-H)
    - DailyPlannerView Test G updated with onReschedule/onResize props (W0-I)
  affects:
    - frontend/tests/unit/hooks/useDragToReschedule.test.ts
    - frontend/tests/unit/components/DraggableTimeBlock.test.tsx
    - frontend/tests/unit/components/DailyPlannerView.test.tsx
tech_stack:
  added: []
  patterns:
    - TDD RED phase — tests import non-existent modules to force failure
    - jsdom mock for setPointerCapture/releasePointerCapture scoped to beforeEach (not global setup.ts)
    - vi.useFakeTimers() for state machine timeout assertions (W0-G)
key_files:
  created:
    - frontend/tests/unit/hooks/useDragToReschedule.test.ts
    - frontend/tests/unit/components/DraggableTimeBlock.test.tsx
  modified:
    - frontend/tests/unit/components/DailyPlannerView.test.tsx
decisions:
  - jsdom mock placed in beforeEach per test file, not in global setup.ts, to avoid polluting other test suites
  - snapToGrid assertions tested via hook behavior (liveTop/liveHeight output) rather than exporting a standalone pure function
  - DailyPlannerView Test G updated with optional props now so it stays GREEN when Plan 03 adds them as required props to the component
metrics:
  duration: "~4 minutes"
  completed: "2026-06-05"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
requirements:
  - DRAG-01
  - DRAG-02
  - DRAG-03
  - DRAG-04
---

# Phase 09 Plan 01: Write RED Tests for Drag-to-Reschedule (Wave 0) Summary

> RED test suite for useDragToReschedule hook and DraggableTimeBlock component — both import non-existent modules, confirming TDD gate before any implementation.

## What Was Built

Created two new test files and updated one existing test file as the Wave 0 RED gate for Phase 09 drag-to-reschedule:

1. **`frontend/tests/unit/hooks/useDragToReschedule.test.ts`** (397 lines, 13 test cases) — Covers:
   - W0-A: `snapToGrid` math (6 cases: 0→0, 15→15, 7→0, 8→15, 22→15, 30→30)
   - W0-B: 10px drag → snaps to 20px (1 interval = 15min)
   - W0-C: Boundary clamping — past midnight → 0px, past 23:45 → 1900px
   - W0-D: Resize snap — +10px from 30min → 45min; -100px → clamped to 15min
   - W0-F: `onReschedule` called with `(item.id, ISO string)` on pointerUp
   - W0-G: Revert animation on rejection — `'reverting'` → 300ms → `'error-tint'` → 1500ms → `'idle'`

2. **`frontend/tests/unit/components/DraggableTimeBlock.test.tsx`** (80 lines, 2 test cases) — Covers:
   - W0-E: Resize handle element with `.h-5` CSS class renders in the block
   - W0-H: `setPointerCapture` called with `pointerId` on `pointerDown` on block body

3. **`frontend/tests/unit/components/DailyPlannerView.test.tsx`** (modified) — Test G updated:
   - Added `onReschedule={vi.fn()}` and `onResize={vi.fn()}` props to the render call
   - Test remains GREEN (props are currently unknown/no-op until Plan 03 adds them to the component)

## RED State Confirmed

```
Test Files  2 failed | 22 passed (24)
      Tests  171 passed (171)
```

Both new test files fail at import with:
```
Error: Failed to resolve import "@/hooks/useDragToReschedule"
Error: Failed to resolve import "@/components/timeline/DraggableTimeBlock"
```

Zero regressions in existing 171 tests.

## Validation Map Coverage

| ID | Req | Behavior | Status |
|----|-----|----------|--------|
| W0-A | DRAG-01 | `snapToGrid` returns nearest 15-min interval | ✅ RED (6 cases) |
| W0-B | DRAG-01 | Drag 10px → snaps to 20px (1 interval) | ✅ RED |
| W0-C | DRAG-01 | Start clamped at midnight and 23:45 | ✅ RED (2 cases) |
| W0-D | DRAG-02 | Resize delta → snapped duration ≥ 15 min | ✅ RED (2 cases) |
| W0-E | DRAG-02 | Resize handle renders with `h-5` class | ✅ RED |
| W0-F | DRAG-03 | `onReschedule` called with snapped ISO startAt on pointerUp | ✅ RED |
| W0-G | DRAG-03 | Revert animation triggered on `onReschedule` rejection | ✅ RED |
| W0-H | DRAG-04 | `setPointerCapture` called on pointerDown | ✅ RED |
| W0-I | existing | DailyPlannerView Test G — add new optional props | ✅ GREEN |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None — test-only files with no new network endpoints, auth paths, or schema changes.

## Known Stubs

None — this plan contains only test files. No production stubs introduced.

## TDD Gate Compliance

This plan is the RED gate (Phase 09, Wave 0). Commits:
1. `test(09-01)` commit `001cd7a` — RED gate (this plan)

GREEN gate (implementation) will be committed in Plans 02–04.

## Self-Check: PASSED

- `frontend/tests/unit/hooks/useDragToReschedule.test.ts` — FOUND (397 lines, 13 it() blocks)
- `frontend/tests/unit/components/DraggableTimeBlock.test.tsx` — FOUND (80 lines, 2 it() blocks)
- `frontend/tests/unit/components/DailyPlannerView.test.tsx` — FOUND (modified)
- Commit `001cd7a` — FOUND in git log
- Both new test files FAIL at import (RED confirmed)
- 171 pre-existing tests PASS (0 regressions)
