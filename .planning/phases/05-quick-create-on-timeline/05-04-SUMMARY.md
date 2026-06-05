---
phase: "05"
plan: "04"
---

# T04: Wired QuickCreateSheet into FeedPage FAB for planner mode; fixed useNativeTasks tests to match extended create signature.

**Wired QuickCreateSheet into FeedPage FAB for planner mode; fixed useNativeTasks tests to match extended create signature.**

## What Happened

Added `QuickCreateSheet` import to `page.tsx` and destructured `createScheduledTask` from `useFeed`. Added `showQuickCreate` state and an IIFE-computed `quickCreateDefaultStartAt` (current time rounded to nearest 15 min via local `Date` manipulation, avoiding the `now` name already in scope from `usePlannerTimeline`). Modified the FAB condition to also hide when `showQuickCreate` is true, and its `onClick` to branch on `viewMode === 'planner'` — calling `setShowQuickCreate(true)` in planner mode and `setShowAddForm(true)` otherwise. Rendered `<QuickCreateSheet>` just after the FAB, guarded by `showQuickCreate && viewMode === 'planner'`, with `onSubmit` calling `createScheduledTask` then closing the sheet, and `onCancel` closing it. Also fixed 2 pre-existing test failures in `useNativeTasks.test.ts` where assertions used the old 2-param `createTask` signature; after T01 extended `create` to accept `startAt` and `duration`, the hook passes all 4 args to `tasksService.createTask`. Updated both assertions to `toHaveBeenCalledWith('...', '...', undefined, undefined)`.

## Verification

TypeScript: `node_modules/.bin/tsc --noEmit` — exit 0, no errors. Vitest: `npx vitest run` — 145 tests pass across 18 test files, 0 failures.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd frontend && node_modules/.bin/tsc --noEmit` | 0 | pass | 8200ms |
| 2 | `cd frontend && npx vitest run` | 0 | pass — 145 tests, 18 files, 0 failures | 3230ms |

## Deviations

Fixed 2 pre-existing test failures in useNativeTasks.test.ts that predated T04 — the tests were written against the original 2-param create() signature and broke when T01 extended it to 4 params. Updated assertions to match the actual call site.

## Known Issues

none

## Files Created/Modified

- `frontend/src/app/feed/page.tsx`
- `frontend/tests/unit/hooks/useNativeTasks.test.ts`
