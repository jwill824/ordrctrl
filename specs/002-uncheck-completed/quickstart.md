# Quickstart: Uncheck Completed Tasks

## What this feature changes

Users can now click a completed task's checkbox in the Completed section to move it back
to the active feed. The change persists across sessions and survives sync cycles.

## Key files touched

| Layer | File | Change |
|-------|------|--------|
| DB Schema | `backend/prisma/schema.prisma` | Add `SyncOverride` model + `OverrideType` enum |
| DB Migration | `backend/prisma/migrations/` | New migration file |
| Service | `backend/src/feed/feed.service.ts` | Add `uncompleteNativeTask()`, `uncompleteSyncItem()` |
| Service | `backend/src/tasks/task.service.ts` | Add `uncompleteTask()` |
| Routes | `backend/src/api/feed.routes.ts` | Add `PATCH /api/feed/items/:itemId/uncomplete` |
| Routes | `backend/src/api/tasks.routes.ts` | Add `PATCH /api/tasks/:id/uncomplete` |
| Routes | `backend/src/api/feed.routes.ts` | Modify complete handler to delete SyncOverride on re-complete |
| API client | `frontend/src/services/feed.service.ts` | Add `uncompleteItem()` |
| Hook | `frontend/src/hooks/useFeed.ts` | Add `uncompleteItem()` with optimistic update |
| Component | `frontend/src/components/feed/CompletedSection.tsx` | Pass `onUncomplete` to FeedItemRow |
| Component | `frontend/src/components/feed/FeedItem.tsx` | Enable checkbox click for completed items |

## Running locally

```bash
# From repo root — start all services
docker compose up -d

# Apply new migration after schema change
cd backend && pnpm prisma migrate dev --name add-sync-override

# Run backend tests
cd backend && pnpm test

# Run frontend E2E tests
cd frontend && pnpm test:e2e
```

## Key behavioral notes

- **Native tasks**: Uncomplete sets `completed=false, completedAt=null`. No override needed.
- **Sync items**: Uncomplete sets `completedInOrdrctrl=false, completedAt=null` AND creates
  a `SyncOverride(REOPENED)` record. The sync job skips re-completing items with an active override.
- **Re-checking a reopened sync item**: Deletes the `SyncOverride` record, restoring normal sync behavior.
- **Inline notice**: Frontend shows a one-time notice on sync-sourced reopened items indicating
  the change is local to ordrctrl. Flag lives in client state only (not persisted).
- **Optimistic update**: UI moves the item immediately; rolls back on API failure.
