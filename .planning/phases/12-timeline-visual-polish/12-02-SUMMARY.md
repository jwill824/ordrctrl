---
phase: 12-timeline-visual-polish
plan: "02"
subsystem: backend
tags: [feed, tasks, color, icon, sync-override, prisma]
dependency_graph:
  requires: [12-01]
  provides: [color/icon on FeedItem, setColorIconOverride, PATCH /api/feed/:itemId/override]
  affects: [frontend feed consumers, task creation/update API]
tech_stack:
  added: []
  patterns: [override-map pattern extended for COLOR/ICON, nullable upsert pattern]
key_files:
  created: []
  modified:
    - backend/src/feed/feed.service.ts
    - backend/src/tasks/task.service.ts
    - backend/src/api/tasks.routes.ts
    - backend/src/api/feed.routes.ts
decisions:
  - "Prisma client regenerated via `prisma generate` — migration in 12-01 did not auto-generate on this machine"
  - "setColorIconOverride uses upsert/deleteMany pattern (same as setDescriptionOverride) for idempotency"
  - "buildDismissedFeed hardcodes color default with no override lookup — performance/simplicity tradeoff for dismissed view"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-06"
  tasks_completed: 2
  files_modified: 4
---

# Phase 12 Plan 02: Color/Icon Backend Pipeline Summary

Wire color and icon through the entire backend data pipeline — feed service resolves COLOR_OVERRIDE/ICON_OVERRIDE for integration items using the same map pattern as TITLE_OVERRIDE, task service persists color/icon on NativeTask, tasks route validates hex color and enforces icon max-10, and a new override route allows setting color/icon on sync items.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Extend FeedItem + buildFeed for color/icon | 3b161d6 | feed.service.ts |
| 2 | task.service color/icon, tasks.routes validation, feed.routes override endpoint | 3b161d6 | task.service.ts, tasks.routes.ts, feed.routes.ts |

## What Was Built

### feed.service.ts
- `FeedItem` interface gains `color: string` (never null, default `#3B82F6`) and `icon: string | null`
- `buildFeed` extends `allOverrides` query to include `COLOR_OVERRIDE` and `ICON_OVERRIDE`
- Two new override maps: `colorOverrideMap` and `iconOverrideMap`
- Sync items in `buildFeed` resolve `color` from `colorOverrideMap` (fallback `#3B82F6`) and `icon` from `iconOverrideMap` (fallback `null`)
- Native tasks in `buildFeed` use `task.color ?? '#3B82F6'` and `task.icon ?? null`
- `buildDismissedFeed` populates `color: '#3B82F6'` and `icon: null` as defaults (no override lookup)
- `buildSingleSyncFeedItem` gains `color: '#3B82F6'` and `icon: null` defaults to satisfy required `FeedItem` shape
- New exported function `setColorIconOverride(userId, syncCacheItemId, type, value)` — upserts when value non-null, deleteMany when null

### task.service.ts
- `CreateTaskInput` gains `color?: string | null` and `icon?: string | null`
- `UpdateTaskInput` gains `color?: string | null` and `icon?: string | null`
- `NativeTaskResult` gains `color: string` and `icon: string | null`
- `toFeedItem` accepts and maps `color` / `icon` from Prisma task
- `createTask` passes `color: input.color ?? '#3B82F6'` and `icon: input.icon ?? null`
- `updateTask` conditionally spreads `color` and `icon` into prisma update

### tasks.routes.ts
- `createTaskSchema` adds `color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable()` and `icon: z.string().max(10).optional().nullable()`
- `updateTaskSchema` adds same validators
- POST handler passes `color: color ?? '#3B82F6'` to `createTask`
- PATCH handler spreads `color` and `icon` conditionally into `updateTask`

### feed.routes.ts
- Imports `setColorIconOverride` from `feed.service.js`
- New route `PATCH /api/feed/:itemId/override`:
  - 400 if itemId lacks `sync:` prefix
  - 422 on schema validation failure
  - 400 on invalid hex color or icon > 10 chars
  - Calls `setColorIconOverride`; returns `{ ok: true }`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma client not regenerated after Plan 12-01 migration**
- **Found during:** Task 1 — `tsc --noEmit` failed because `OverrideType` enum lacked `COLOR_OVERRIDE`/`ICON_OVERRIDE` and `NativeTask` lacked `color`/`icon` fields
- **Issue:** Plan 12-01 ran `migrate dev` which auto-generates the client, but on this machine the regenerated client was not current
- **Fix:** Ran `npx prisma generate` explicitly before re-running `tsc --noEmit`
- **Files modified:** node_modules only (generated client)
- **Commit:** 3b161d6 (fix inline — no separate commit needed)

## Known Stubs

None — all fields are fully wired through the pipeline with real data sources and fallback defaults.

## Threat Surface Scan

The threat model in the plan covers all new surface:
- `PATCH /api/feed/:itemId/override` — hex validation enforced, `sync:` prefix check prevents cross-type access, `userId` scopes DB operations
- `PATCH /api/tasks/:id` color — hex regex enforced by Zod schema

No new surface outside the plan's threat model.

## Verification

- `npx tsc --noEmit`: exit 0 ✓
- `pnpm test`: 254/254 passed ✓
- `grep "color: string" backend/src/feed/feed.service.ts`: FeedItem field present ✓
- `grep "COLOR_OVERRIDE\|ICON_OVERRIDE" backend/src/feed/feed.service.ts`: both enum values used ✓
- `grep "3B82F6" backend/src/api/tasks.routes.ts`: default color constant present ✓
- `grep "itemId/override" backend/src/api/feed.routes.ts`: new route registered ✓

## Self-Check: PASSED

- `backend/src/feed/feed.service.ts` — FOUND
- `backend/src/tasks/task.service.ts` — FOUND
- `backend/src/api/tasks.routes.ts` — FOUND
- `backend/src/api/feed.routes.ts` — FOUND
- Commit 3b161d6 — FOUND
