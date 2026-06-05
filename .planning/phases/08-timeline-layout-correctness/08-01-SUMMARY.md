---
phase: 08-timeline-layout-correctness
plan: "01"
subsystem: frontend/timeline
tags: [tdd, pixel-math, layout, constants, vitest]
dependency_graph:
  requires: []
  provides:
    - "timelineConstants.ts with PX_PER_HOUR=80, BLOCK_MIN_HEIGHT=24, TIMELINE_HEIGHT=1920"
    - "Pixel-math regression tests for LAYOUT-01, LAYOUT-02, LAYOUT-03"
  affects:
    - frontend/src/components/timeline/DailyPlannerView.tsx
    - frontend/src/components/timeline/PlannerTimeBlock.tsx
tech_stack:
  added:
    - "frontend/src/components/timeline/timelineConstants.ts — shared layout constants"
  patterns:
    - "Single source of truth for PX_PER_HOUR constant (extracted from inline literal)"
    - "TDD RED/GREEN cycle with pixel-math assertions on component inline styles"
key_files:
  created:
    - frontend/src/components/timeline/timelineConstants.ts
    - frontend/tests/unit/components/DailyPlannerView.test.tsx
  modified:
    - frontend/src/components/timeline/DailyPlannerView.tsx
    - frontend/src/components/timeline/PlannerTimeBlock.tsx
decisions:
  - "PX_PER_HOUR raised from 64 to 80 — fixes the 20% proportionality deficit causing LAYOUT-01/02 failures"
  - "Defined Element.prototype.scrollIntoView in beforeEach (jsdom compat) before vi.spyOn — standard pattern for missing jsdom APIs"
  - "WeeklyPlannerView.tsx left untouched — its WEEKLY_HOUR_HEIGHT=24 is intentionally compact and out of scope"
metrics:
  duration: "2m 37s"
  completed: "2026-06-05T15:49:20Z"
  tasks_completed: 2
  tasks_pending: 1
  files_created: 2
  files_modified: 2
---

# Phase 08 Plan 01: Timeline Layout Correctness Summary

**One-liner:** Extracted `PX_PER_HOUR=80` to shared `timelineConstants.ts`, fixing 20% block-height proportionality deficit and aligning task tops to time-axis markers; 7 pixel-math regression tests green.

## What Was Built

Replaced the inline `HOUR_HEIGHT = 64` constant in `DailyPlannerView.tsx` with a shared `PX_PER_HOUR = 80` constant exported from the new `timelineConstants.ts` module. This single change corrects two layout defects:

- **LAYOUT-01:** 30-minute blocks now render at 40px (half of 60-minute's 80px) — ratio was off by 20% at old value 64
- **LAYOUT-02:** A 9:00 AM task top is now exactly 720px (9 × 80), aligning with the axis hour marker
- **LAYOUT-03:** Auto-scroll already worked architecturally; confirmed by Test G after height correction

Additionally fixed three `font-bold` → `font-semibold` drift instances on the filter pill buttons and the "Unscheduled" section header, and replaced the bare `24` literal in `PlannerTimeBlock.tsx` with `BLOCK_MIN_HEIGHT` from the constants file.

## Files Created

| File | Purpose |
|------|---------|
| `frontend/src/components/timeline/timelineConstants.ts` | Single source of truth: `PX_PER_HOUR=80`, `BLOCK_MIN_HEIGHT=24`, `TIMELINE_HOURS=24`, `TIMELINE_HEIGHT=1920` |
| `frontend/tests/unit/components/DailyPlannerView.test.tsx` | 7 pixel-math regression tests (Tests A–G) covering LAYOUT-01/02/03 |

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/components/timeline/DailyPlannerView.tsx` | Import `PX_PER_HOUR`; replace 6× `HOUR_HEIGHT` → `PX_PER_HOUR`; fix 3× `font-bold` → `font-semibold` |
| `frontend/src/components/timeline/PlannerTimeBlock.tsx` | Import `BLOCK_MIN_HEIGHT`; replace bare literal `24` |

## Test Results

```
Tests  7 passed (7)   — DailyPlannerView.test.tsx
Tests  171 passed (171) — full suite, zero regressions
```

## Commits

| Hash | Message |
|------|---------|
| `f55dccc` | `test(08): RED pixel-math tests for LAYOUT-01/02/03` |
| `142f823` | `feat(08): extract PX_PER_HOUR=80 to timelineConstants, fix block layout math` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] jsdom missing `scrollIntoView` on `Element.prototype`**
- **Found during:** Task 2 (GREEN — Test G)
- **Issue:** `vi.spyOn(Element.prototype, 'scrollIntoView')` throws `"scrollIntoView does not exist"` in jsdom because jsdom doesn't implement it
- **Fix:** Added `Element.prototype.scrollIntoView = vi.fn();` in `beforeEach` before the spy call — standard jsdom compatibility pattern
- **Files modified:** `frontend/tests/unit/components/DailyPlannerView.test.tsx`
- **Commit:** `142f823` (fix included in same GREEN commit)

## Known Stubs

None — all test assertions are against real computed values.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Pending: Human Verification (Task 3)

The following visual checks are awaiting human confirmation:

1. **LAYOUT-01 (Proportional heights):** 30-min block is visually half the height of a 60-min block (40px vs 80px)
2. **LAYOUT-02 (Axis alignment):** A task at 9:00 AM has its top edge flush with the 9am axis marker
3. **LAYOUT-03 (Auto-scroll):** Planner opens with current-time indicator centered in viewport
4. **Font weight:** Filter pills and "Unscheduled" header show semibold (not heavy bold)

**To verify:** `cd frontend && pnpm dev` → open http://localhost:5173 → navigate to Planner tab

## Self-Check: PASSED

- [x] `frontend/src/components/timeline/timelineConstants.ts` — EXISTS
- [x] `frontend/tests/unit/components/DailyPlannerView.test.tsx` — EXISTS
- [x] `f55dccc` — commit confirmed in git log
- [x] `142f823` — commit confirmed in git log
- [x] `grep -n 'HOUR_HEIGHT|font-bold' DailyPlannerView.tsx` — 0 matches
- [x] `grep 'BLOCK_MIN_HEIGHT' PlannerTimeBlock.tsx` — 1 match
- [x] Full vitest suite 171/171 passed
