---
phase: "05"
plan: "01"
---

# T01: Created nativeTaskToFeedItem utility and extended useNativeTasks.create to accept startAt and duration

**Created nativeTaskToFeedItem utility and extended useNativeTasks.create to accept startAt and duration**

## What Happened

Read the three input files to understand the existing NativeTask and FeedItem shapes, then:

1. Created `frontend/src/utils/feedItemUtils.ts` with `nativeTaskToFeedItem(task: NativeTask): FeedItem`. The mapping prefixes the id with `native:`, sets source/serviceId to `ordrctrl`, itemType to `task`, carries through all date/completion/status fields directly from NativeTask, and nulls/defaults all override and description fields (originalTitle, hasTitleOverride, originalBody, description, hasDescriptionOverride, descriptionOverride, descriptionUpdatedAt, sourceUrl) and sets dismissed=false, hasUserDueAt=false.

2. Extended `useNativeTasks.create` from `(title, dueAt?)` to `(title, dueAt?, startAt?, duration?)` and threaded both new optional parameters through to `tasksService.createTask`, which already accepted them.

TypeScript compiled clean with no errors.

## Verification

Ran `cd frontend && node_modules/.bin/tsc --noEmit` — exited 0, no output, no type errors.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd frontend && node_modules/.bin/tsc --noEmit` | 0 | pass | 4200ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `frontend/src/utils/feedItemUtils.ts`
- `frontend/src/hooks/useNativeTasks.ts`
