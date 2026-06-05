---
phase: "02"
plan: "02"
---

# T02: Created usePlannerTimeline hook splitting FeedItems into scheduled/unscheduled with durationMinutes, plus 8 passing unit tests

**Created usePlannerTimeline hook splitting FeedItems into scheduled/unscheduled with durationMinutes, plus 8 passing unit tests**

## What Happened

Created `frontend/src/hooks/usePlannerTimeline.ts` following the same pattern as useTimeline: accepts `{ items, sourceFilter }`, applies sourceFilter if non-null, splits items into scheduled (startAt !== null AND endAt !== null) and unscheduled, sorts scheduled by startAt ascending, and computes durationMinutes for each scheduled item from (endAt - startAt) / 60000. Exports PlannerItem type extending FeedItem with durationMinutes. Uses useLiveDate() to return now. Wraps all computation in useMemo keyed on items and sourceFilter. Created `frontend/tests/unit/hooks/usePlannerTimeline.test.ts` (placed in hooks/ subdirectory matching project convention) with 8 tests covering: empty input, scheduled/unscheduled split, sort order, durationMinutes calculation, sourceFilter by serviceId, sourceFilter by source field, now Date returned, and partial items (startAt but no endAt treated as unscheduled). All 8 tests pass.

## Verification

Ran `cd frontend && npx vitest run tests/unit/hooks/usePlannerTimeline.test.ts` — 8 tests passed in 553ms.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd frontend && npx vitest run tests/unit/hooks/usePlannerTimeline.test.ts` | 0 | pass | 553ms |

## Deviations

Test file path is `tests/unit/hooks/usePlannerTimeline.test.ts` rather than `tests/unit/usePlannerTimeline.test.ts` as written in the task plan — placed in hooks/ subdirectory to match the established project convention for all hook tests.

## Known Issues

None.

## Files Created/Modified

- `frontend/src/hooks/usePlannerTimeline.ts`
- `frontend/tests/unit/hooks/usePlannerTimeline.test.ts`
