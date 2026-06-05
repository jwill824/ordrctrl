---
phase: "02"
plan: "01"
---

# T01: Extended TimelineViewMode to include 'planner', updated NativeTask type with startAt/endAt/duration fields, and threaded 'planner' through backend Zod validation and user service types.

**Extended TimelineViewMode to include 'planner', updated NativeTask type with startAt/endAt/duration fields, and threaded 'planner' through backend Zod validation and user service types.**

## What Happened

All five target files were read, then edited surgically:

1. `frontend/src/types/timeline.ts`: Added `'planner'` to `TimelineViewMode` union.
2. `frontend/src/services/user.service.ts`: Added `'planner'` to the `feedViewMode` union in `UserSettings`.
3. `frontend/src/services/tasks.service.ts`: Updated `NativeTask` interface — `startAt` and `endAt` changed from literal `null` to `string | null`, and `duration: number | null` added. Updated `createTask` signature to accept optional `startAt` and `duration` parameters. Updated `updateTask` fields type to include optional `startAt` and `duration`.
4. `backend/src/api/user.routes.ts`: Updated `z.enum(['feed', 'timeline'])` to `z.enum(['feed', 'timeline', 'planner'])` in the Zod patch schema.
5. `backend/src/user/user.service.ts`: Added `'planner'` to the `feedViewMode` union in the `UserSettings` interface.

Frontend `node_modules` were not present; `npm install` was run to install them before type-checking. Both `frontend` and `backend` TypeScript checks passed with zero errors.

## Verification

Ran `node_modules/.bin/tsc --noEmit` in both `frontend/` and `backend/`. Both exited 0 with no errors.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd frontend && node_modules/.bin/tsc --noEmit` | 0 | pass | 8000ms |
| 2 | `cd backend && node_modules/.bin/tsc --noEmit` | 0 | pass | 4000ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `frontend/src/types/timeline.ts`
- `frontend/src/services/user.service.ts`
- `frontend/src/services/tasks.service.ts`
- `backend/src/api/user.routes.ts`
- `backend/src/user/user.service.ts`
