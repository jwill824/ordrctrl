---
phase: 09-drag-to-reschedule
plan: "02"
subsystem: frontend/hooks
tags: [tdd, drag-to-reschedule, hooks, green-phase, snap-math, state-machine]
dependency_graph:
  requires:
    - 09-01 (RED test suite for useDragToReschedule + DraggableTimeBlock)
  provides:
    - useDragToReschedule hook with full snap/clamp/revert state machine
    - snapToGrid pure helper exported from hook module
    - Phase 09 drag constants in timelineConstants.ts
    - expanded useNativeTasks.update signature accepting startAt + duration
  affects:
    - frontend/src/hooks/useDragToReschedule.ts
    - frontend/src/components/timeline/timelineConstants.ts
    - frontend/src/hooks/useNativeTasks.ts
    - frontend/tests/unit/setup.ts
tech_stack:
  added: []
  patterns:
    - TDD GREEN phase — implement code to make RED tests pass
    - AbortController pattern for window event listener cleanup
    - dragStateRef mirror pattern (ref + useState) to avoid stale closures in event handlers
    - PointerEvent polyfill for jsdom 24 (class extending MouseEvent)
    - lastClientY closure variable to capture final drag position independent of pointerup clientY
key_files:
  created:
    - frontend/src/hooks/useDragToReschedule.ts
  modified:
    - frontend/src/components/timeline/timelineConstants.ts
    - frontend/src/hooks/useNativeTasks.ts
    - frontend/tests/unit/setup.ts
decisions:
  - "Used window listeners (not document) because tests dispatch PointerEvent directly on window"
  - "lastClientY closure variable captures final pointer position; pointerup event in jsdom tests has clientY=0 (default), so relying on pe.clientY in pointerup would compute wrong delta"
  - "PointerEvent polyfill added to global setup.ts — affects all tests but PointerEvent is universally useful; deviation from Wave 1 comment (which restricted setPointerCapture mock to per-file beforeEach)"
  - "No intent threshold for drag-resize (only drag-move) — resize handles are small targets with intentional user action"
metrics:
  duration: "~7 minutes"
  completed: "2026-06-05"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 3
requirements:
  - DRAG-01
  - DRAG-02
  - DRAG-03
  - DRAG-04
---

# Phase 09 Plan 02: Implement useDragToReschedule Hook (GREEN Wave) Summary

> Pure drag state machine with 15-min snap grid, boundary clamping, pointer event handlers, and persist/revert flow — all W0-A through W0-G tests GREEN.

## What Was Built

### Task 1: Phase 09 constants + useNativeTasks.update expansion
Commit: `9fbcb86`

Added 5 new exports to `timelineConstants.ts` (9 total exports):
- `SNAP_MINUTES = 15`
- `SNAP_PX = (SNAP_MINUTES / 60) * PX_PER_HOUR` → 20px (derived, not hardcoded)
- `DRAG_INTENT_THRESHOLD_PX = 8`
- `RESIZE_HANDLE_HEIGHT_PX = 20`
- `MIN_DRAG_DURATION_MINUTES = 15`

Expanded `useNativeTasks.update` fields type to accept `startAt?: string | null` and `duration?: number | null`.

### Task 2: useDragToReschedule hook implementation
Commit: `d92f91b`

Created `frontend/src/hooks/useDragToReschedule.ts`:

**Exports:** `useDragToReschedule`, `snapToGrid`, `getHasTouched`, `DragState` type

**Snap math:** `snapToGrid(min) = Math.round(min / 15) * 15`

**State machine:** idle → drag-move (≥8px threshold) or drag-resize (immediate) → persisting → idle (success) or reverting → error-tint → idle (failure, 300ms + 1500ms timers)

**Drag move flow:** `computeNewStart(originalStartMin, deltaY)` = `clamp(snapToGrid(original + deltaMin), 0, 1425)`

**Drag resize flow:** `computeNewDuration(originalDurationMin, originalStartMin, deltaY)` = `min(max(15, snapToGrid(original + deltaMin)), 1440 - originalStart)`

**ISO conversion:** `newDate.setHours(floor(snappedMin/60), snappedMin%60, 0, 0)` → preserves original date, sets only time

**AbortController cleanup:** single controller per drag session; `window.addEventListener` with `signal` → automatic cleanup on pointerup/cancel or component unmount

**PointerEvent polyfill** added to `tests/unit/setup.ts` — jsdom 24 does not implement `PointerEvent`. Class extending `MouseEvent` with `pointerId` property.

## Test Results

| Suite | Before | After |
|-------|--------|-------|
| useDragToReschedule.test.ts | FAIL (module not found) | ✅ 13/13 GREEN |
| DraggableTimeBlock.test.tsx | FAIL (module not found) | Still RED (Plan 03) |
| All other suites | 171 tests ✅ | 171 tests ✅ |
| **Total** | 171 pass / 2 files fail | **184 pass / 1 file fail** |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] PointerEvent not defined in jsdom 24**
- **Found during:** Task 2 first test run
- **Issue:** `ReferenceError: PointerEvent is not defined` — jsdom 24 does not implement the PointerEvent constructor. Tests call `new PointerEvent('pointermove', { pointerId: 1, clientY: 200, bubbles: true })`
- **Fix:** Added `PointerEvent` polyfill class (extends `MouseEvent`, adds `pointerId` property) to `tests/unit/setup.ts` global setup
- **Note:** Wave 1 comment "NOT in global setup.ts" applied to the `setPointerCapture` mock, which remains per-file. The `PointerEvent` class polyfill is a global concern affecting all test files equally
- **Files modified:** `frontend/tests/unit/setup.ts`
- **Commit:** `d92f91b`

**2. [Rule 3 - Blocking] Used window listeners instead of document listeners**
- **Found during:** Task 2 implementation analysis
- **Issue:** Plan specified "document listeners" but tests dispatch `PointerEvent` directly on `window`. Events dispatched on `window` do not bubble to `document`, so `document.addEventListener` would never fire
- **Fix:** Changed to `window.addEventListener` for `pointermove`, `pointerup`, `pointercancel`
- **Files modified:** `frontend/src/hooks/useDragToReschedule.ts`
- **Commit:** `d92f91b`

**3. [Rule 2 - Correctness] lastClientY closure for pointerup delta computation**
- **Found during:** Task 2 — analyzing W0-F test structure
- **Issue:** The pointerup event in tests is dispatched as `new PointerEvent('pointerup', { pointerId: 1, bubbles: true })` with no `clientY`, which defaults to 0. Using `pe.clientY - startY` in the pointerup handler would compute `0 - 200 = -200`, giving the wrong snapped position
- **Fix:** Introduced `let lastClientY = startY` closure variable updated on every `pointermove`, used for delta computation in `pointerup` handler (representing user's last known pointer position)
- **Files modified:** `frontend/src/hooks/useDragToReschedule.ts`
- **Commit:** `d92f91b`

## Known Stubs

None — hook is fully implemented. No placeholder data, no TODO stubs.

## Threat Flags

No new security-relevant surfaces introduced. The `taskId.startsWith('native:')` guard (T-09-01) is a concern for Plan 04 (feed/page.tsx integration), not this plan. The persisting re-entry guard (T-09-02) is implemented in `startMove` and `startResize`.

## Self-Check: PASSED

Files exist:
- `frontend/src/hooks/useDragToReschedule.ts` ✅
- `frontend/src/components/timeline/timelineConstants.ts` (modified) ✅
- `frontend/src/hooks/useNativeTasks.ts` (modified) ✅
- `frontend/tests/unit/setup.ts` (modified) ✅

Commits exist:
- `9fbcb86` — Task 1 constants + useNativeTasks ✅
- `d92f91b` — Task 2 useDragToReschedule ✅

Test results confirmed: 184 tests pass, 1 file (DraggableTimeBlock) still RED as expected.
