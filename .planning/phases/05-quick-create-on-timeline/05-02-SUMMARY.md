---
phase: "05"
plan: "02"
---

# T02: Added createScheduledTask to useFeed with optimistic insert, server reconciliation, and revert-on-failure

**Added createScheduledTask to useFeed with optimistic insert, server reconciliation, and revert-on-failure**

## What Happened

Implemented `createScheduledTask(title, startAt, duration)` in `frontend/src/hooks/useFeed.ts` following the established optimistic-mutation pattern in the hook.

Steps taken:

1. Added imports for `createTask` from `@/services/tasks.service` and `nativeTaskToFeedItem` from `@/utils/feedItemUtils` at the top of useFeed.ts.
2. Added `createScheduledTask` to the `UseFeedReturn` interface.
3. Implemented the function with `useCallback`:
   - Constructs a synthetic optimistic FeedItem with id `optimistic:${Date.now()}`, source `ordrctrl`, computed `endAt` (startAt + duration * 60000 ms, consistent with MEM005), and all override/description fields nulled.
   - Immediately prepends the optimistic item via `setData`.
   - Calls `createTask(title, null, startAt, duration)` from the tasks service.
   - On success: maps the response through `nativeTaskToFeedItem` and replaces the optimistic item by filtering on tempId and prepending the real item.
   - On failure: removes the optimistic item (revert), re-throws the error for the caller to handle.
4. Added `createScheduledTask` to the return object.

## Verification

TypeScript compile: `cd frontend && node_modules/.bin/tsc --noEmit` — exited 0, no errors.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd frontend && node_modules/.bin/tsc --noEmit` | 0 | pass | 8000ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `frontend/src/hooks/useFeed.ts`
