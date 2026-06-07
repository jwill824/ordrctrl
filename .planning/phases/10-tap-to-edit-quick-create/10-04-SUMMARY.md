# 10-04 Summary: onTap Wiring + useTaskSheet Integration

**Plan:** 10-04-PLAN.md
**Type:** Execute (GREEN wave — integration)
**Completed:** 2026-06-06
**Commit:** 39d3614

## What Was Built

### `frontend/src/hooks/useDragToReschedule.ts`
- Added `onTap?: () => void` to `UseDragToRescheduleProps`
- Fires `onTap?.()` in the tap-cancel branch (< `DRAG_INTENT_THRESHOLD_PX` movement, < 200ms elapsed)
- Added `onTap` to `startMove` `useCallback` dependency array

### `frontend/src/components/timeline/DraggableTimeBlock.tsx`
- Added `onTap?: () => void` to `DraggableTimeBlockProps`
- Passed `onTap` through to `useDragToReschedule`

### `frontend/src/components/timeline/DailyPlannerView.tsx`
- Added `onTap?: (item: PlannerItem) => void` to props interface
- Each `DraggableTimeBlock` receives `onTap={() => onTap?.(item)}`

### `frontend/src/app/feed/page.tsx`
- Replaced `showQuickCreate` state with `useTaskSheet()` hook (isOpen, task, mode, openCreate, openEdit, close)
- Added `handleBlockTap` callback: routes native items (`native:`) to `openEdit()`, sync items to `setEditingTask()` (EditTaskModal)
- FAB `onClick` now calls `openCreate()` instead of `setShowQuickCreate(true)`
- `DailyPlannerView` receives `onTap={handleBlockTap}`
- `TaskSheet` replaces `QuickCreateSheet` in the JSX (handles both create and edit modes)
- `EditTaskModal` unchanged — still handles sync item editing

### Deleted: `frontend/src/components/tasks/QuickCreateSheet.tsx`
No remaining consumers after `feed/page.tsx` update.

## Verification

| Check | Result |
|-------|--------|
| All 26 test files GREEN | ✅ |
| All 199 tests pass | ✅ |
| W0-K (onTap fires on short tap) GREEN | ✅ |
| W0-L (drag does NOT fire onTap) GREEN | ✅ |
| W0-M (backward compat without onTap) GREEN | ✅ |
| pnpm tsc --noEmit exits 0 | ✅ |
| QuickCreateSheet.tsx deleted | ✅ |
| grep QuickCreateSheet frontend/src → 0 results | ✅ |
