---
phase: "04"
plan: "04"
---

# T04: Wired WeeklyPlannerView into FeedPage with 'week' segmented control, weekStart/plannerDate state, day-tap navigation to daily planner, and full-width horizontal scroll layout.

**Wired WeeklyPlannerView into FeedPage with 'week' segmented control, weekStart/plannerDate state, day-tap navigation to daily planner, and full-width horizontal scroll layout.**

## What Happened

Edited frontend/src/app/feed/page.tsx to complete the weekly view integration:

1. Added imports: WeeklyPlannerView from @/components/timeline, useWeeklyPlanner from @/hooks/useWeeklyPlanner, and getWeekStart from @/utils/dateUtils.

2. Added plannerDate and weekStart state (both initialized to current date), called useWeeklyPlanner to produce dayMap/weekDays, and defined handleDayTap which sets plannerDate then calls handleModeChange('planner') to navigate to daily planner.

3. Updated usePlannerTimeline call to pass targetDate: viewMode === 'planner' ? plannerDate : undefined — so daily planner shows only that day's items, while other modes show all items.

4. Added 'week' to the segmented control array making it 5 modes: feed, timeline, planner, list, week.

5. Changed the outer scroll container to use a template literal: overflow-x-auto when viewMode === 'week', overflow-x-hidden otherwise.

6. Rendered WeeklyPlannerView outside the max-w-[40rem] main wrapper — it appears in a full-width px-3 pt-4 pb-28 div, guarded by `!showDismissed && !loading && viewMode === 'week'`. The existing `<main>` wrapper is entirely suppressed when viewMode === 'week' via `{viewMode !== 'week' && <main>...}`.

One TypeScript narrowing error occurred during implementation: the redundant `viewMode !== 'week'` guard inside the already-narrowed `<main>` block caused TS2367. Resolved by removing the redundant check — TypeScript already narrows viewMode to exclude 'week' inside the `{viewMode !== 'week' && ...}` block.

## Verification

tsc --noEmit: exit 0 (clean). npx vitest run: 145 tests across 18 test files, all passing.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd frontend && node_modules/.bin/tsc --noEmit` | 0 | pass | 8200ms |
| 2 | `cd frontend && npx vitest run` | 0 | pass — 145 tests, 18 files | 7500ms |

## Deviations

none

## Known Issues

weekStart is initialized but its setter is never called — no prev/next week navigation is in T04 scope. The state is present for future slice work.

## Files Created/Modified

- `frontend/src/app/feed/page.tsx`
