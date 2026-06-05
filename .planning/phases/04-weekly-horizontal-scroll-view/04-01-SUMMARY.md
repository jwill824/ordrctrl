---
phase: "04"
plan: "01"
---

# T01: Added getWeekStart/addDays to dateUtils, added 'week' to TimelineViewMode and feedViewMode, and added backward-compatible targetDate filtering to usePlannerTimeline.

**Added getWeekStart/addDays to dateUtils, added 'week' to TimelineViewMode and feedViewMode, and added backward-compatible targetDate filtering to usePlannerTimeline.**

## What Happened

Read all four target files before editing. Added getWeekStart(date) — returns Monday 00:00:00 of the ISO week containing the given date — and addDays(date, n) — returns a new Date offset by n calendar days — to dateUtils.ts. Added 'week' to the TimelineViewMode union in timeline.ts and to the feedViewMode literal union in UserSettings in user.service.ts. Extended UsePlannerTimelineOptions with an optional targetDate: Date field in usePlannerTimeline.ts; when provided, the memo filters scheduled items to only those whose startAt falls on the same local calendar day (using toLocalMidnight from dateUtils for correct all-day/timed handling), placing non-matching timed items in the unscheduled bucket. Omitting targetDate preserves prior behavior exactly. The targetDate is included in the useMemo dependency array.

## Verification

Ran frontend tsc --noEmit (exit 0) and vitest run on usePlannerTimeline.test.ts (8/8 tests pass, exit 0).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd frontend && node_modules/.bin/tsc --noEmit` | 0 | pass | 5200ms |
| 2 | `npx vitest run tests/unit/hooks/usePlannerTimeline.test.ts` | 0 | pass | 415ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `frontend/src/utils/dateUtils.ts`
- `frontend/src/types/timeline.ts`
- `frontend/src/services/user.service.ts`
- `frontend/src/hooks/usePlannerTimeline.ts`
