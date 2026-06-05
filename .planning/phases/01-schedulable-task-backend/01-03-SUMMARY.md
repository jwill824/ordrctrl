---
phase: "01"
plan: "03"
---

# T03: Added Vitest unit tests for startAt, duration, computed endAt, and validation across task.service.test.ts, task.routes.test.ts, and feed.service.test.ts

**Added Vitest unit tests for startAt, duration, computed endAt, and validation across task.service.test.ts, task.routes.test.ts, and feed.service.test.ts**

## What Happened

Created two new test files and extended an existing one to cover all scheduling-related logic introduced in T01 and T02.

**backend/tests/unit/task.service.test.ts** (11 tests): Tests toFeedItem() directly by going through createTask() and updateTask() with Prisma mocked via vi.mock. Covers: endAt computed correctly when both startAt+duration present; null endAt when either field is null; duration value passthrough; startAt ISO string serialization; 90-minute endAt arithmetic (verifying minutes not seconds); createTask() data shape passed to prisma.create; updateTask() recomputes endAt and null-clears scheduling.

**backend/tests/unit/task.routes.test.ts** (12 tests): Builds real Fastify app with cookie/session plugins, mocks task.service.js module. Covers: POST 201 with computed endAt; POST 201 null fields when unscheduled; service called with parsed Date; 422 on non-ISO startAt; 422 on negative/zero/non-integer duration; 401 unauthenticated; PATCH 200 updates scheduling; PATCH 200 null-clears; PATCH 404 not found; PATCH 422 invalid startAt.

**backend/tests/unit/feed.service.test.ts** (2 new tests in existing file): Added native task sorting cases inside the existing sortFeedItems describe block — scheduled native task sorts before later calendar event; unscheduled native task falls into undated bucket.

All 254 tests across 22 files passed. Redis/DB ECONNREFUSED stderr in contract tests is pre-existing infrastructure noise (no dev containers running) and is not caused by this change.

## Verification

cd backend && npm test — 254 tests, 22 test files, all passed. test.service.test.ts (11 tests) and task.routes.test.ts (12 tests) are new; 2 tests added to feed.service.test.ts.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd backend && npm test` | 0 | pass | 1160ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `backend/tests/unit/task.service.test.ts`
- `backend/tests/unit/task.routes.test.ts`
- `backend/tests/unit/feed.service.test.ts`
