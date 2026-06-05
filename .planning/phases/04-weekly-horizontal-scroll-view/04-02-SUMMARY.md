---
phase: "04"
plan: "02"
---

# T02: Created useWeeklyPlanner hook that partitions FeedItems into a Map<string, PlannerItem[]> keyed by local YYYY-MM-DD date, with 9 passing unit tests.

**Created useWeeklyPlanner hook that partitions FeedItems into a Map<string, PlannerItem[]> keyed by local YYYY-MM-DD date, with 9 passing unit tests.**

## What Happened

Created two new files:

1. `frontend/src/hooks/useWeeklyPlanner.ts`: A pure-logic hook accepting `{ items, weekStart, sourceFilter }`. Uses `useMemo` to: (a) apply sourceFilter (same serviceId/source match as usePlannerTimeline), (b) filter to items with both startAt and endAt non-null, (c) bucket each item into a dayMap by local calendar date using `toLocalMidnight` + local date component formatting (avoids UTC-shift bug of calling .toISOString() on a local-midnight Date), (d) compute durationMinutes per item, (e) sort each bucket by startAt ascending. Returns `{ dayMap: Map<string, PlannerItem[]>, weekDays: Date[] }`. PlannerItem is re-exported from usePlannerTimeline (no duplicate type definition). The dayMap is pre-initialized with all 7 weekDays as keys with empty arrays, so callers can safely iterate all 7 days even when no items exist.

2. `frontend/tests/unit/hooks/useWeeklyPlanner.test.ts`: 9 tests covering: empty items returns 7-key dayMap with 0 items; weekDays array has correct dates; items bucketed into correct day columns; items without startAt/endAt excluded; items outside the week are not placed; sourceFilter excludes non-matching items; day boundary items land in exactly one bucket; durationMinutes computed correctly; same-day items sorted ascending by startAt.

Key decision: Used local date component formatting (`getFullYear()`/`getMonth()`/`getDate()`) rather than `toLocalMidnight().toISOString().slice(0, 10)` for the dayMap key — the latter would shift to the previous UTC date in negative-offset timezones because `.toISOString()` converts local midnight back to UTC.

## Verification

Ran `npx vitest run tests/unit/hooks/useWeeklyPlanner.test.ts` — 9/9 tests pass. Ran `node_modules/.bin/tsc --noEmit` — clean, no errors.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd /Users/jeff.williams/Developer/personal/ordrctrl/frontend && npx vitest run tests/unit/hooks/useWeeklyPlanner.test.ts` | 0 | pass | 373ms |
| 2 | `cd /Users/jeff.williams/Developer/personal/ordrctrl/frontend && node_modules/.bin/tsc --noEmit` | 0 | pass | 4200ms |

## Deviations

The task plan said to use `toLocalMidnight(item.startAt).toISOString().slice(0, 10)` for the day key. Instead used local date components (`getFullYear/getMonth/getDate`) to avoid the UTC-shift bug where calling `.toISOString()` on a local-midnight Date shifts to the previous UTC date in negative-offset timezones (e.g., UTC-5). This is consistent with how the weekDays keys are built and is more correct.

## Known Issues

none

## Files Created/Modified

- `frontend/src/hooks/useWeeklyPlanner.ts`
- `frontend/tests/unit/hooks/useWeeklyPlanner.test.ts`
