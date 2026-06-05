---
phase: "01"
plan: "02"
---

# T02: Wired startAt, duration, and computed endAt through Zod validation, service types, createTask/updateTask, and both native-task feed mappings

**Wired startAt, duration, and computed endAt through Zod validation, service types, createTask/updateTask, and both native-task feed mappings**

## What Happened

All three application-layer files were updated to thread the new scheduling fields:

1. **tasks.routes.ts**: Added `startAt: z.string().datetime().optional().nullable()` and `duration: z.number().int().min(1).optional().nullable()` to both `createTaskSchema` and `updateTaskSchema`. POST handler destructures and converts `startAt` to `Date | null`; PATCH handler uses conditional spread matching the existing `dueAt` pattern.

2. **task.service.ts**: Updated `CreateTaskInput` and `UpdateTaskInput` interfaces with `startAt?: Date | null` and `duration?: number | null`. Updated `NativeTaskResult` to change `startAt: null` → `string | null`, add `duration: number | null`, and change `endAt: null` → `string | null`. Updated `toFeedItem()` parameter type and body to compute `endAt` as `startAt + duration * 60000` ms (ISO string), or null if either field is absent. Updated `prisma.nativeTask.create` data to include the new fields; `updateTask()` uses conditional spread.

3. **feed.service.ts**: Updated both native-task mapping blocks — `buildFeed()` (~line 133) and `buildDismissedFeed()` (~line 730) — to replace `startAt: null` with `task.startAt?.toISOString() ?? null` and `endAt: null` with the computed endAt expression.

## Verification

Ran `cd backend && node_modules/.bin/tsc --noEmit`. The only errors reported were 6 pre-existing `oauthState` property errors in `integrations.routes.ts` (unrelated to this task). All files touched by T02 — tasks.routes.ts, task.service.ts, feed.service.ts — produced zero type errors.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd backend && node_modules/.bin/tsc --noEmit 2>&1 | grep -v integrations.routes.ts` | 0 | pass — no errors in T02 files | 8200ms |

## Deviations

none

## Known Issues

6 pre-existing TS errors in integrations.routes.ts (oauthState property) are unrelated to this task and were present before T02.

## Files Created/Modified

- `backend/src/api/tasks.routes.ts`
- `backend/src/tasks/task.service.ts`
- `backend/src/feed/feed.service.ts`
