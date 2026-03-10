# Developer Quickstart: Clear Completed Tasks

**Branch**: `008-clear-completed`

## Setup

No new environment variables or services required. Standard dev setup applies:

```bash
# From repo root
pnpm install
cd backend && npx prisma generate   # re-run after P2 schema migration
cd ../frontend && pnpm dev          # or pnpm dev from root
```

## P1 Checklist (no migration required)

- [ ] Add `clearCompletedItems()` to `backend/src/feed/feed.service.ts`
- [ ] Add `POST /api/feed/completed/clear` to `backend/src/api/feed.routes.ts`
- [ ] Add `clearAllCompleted()` to frontend `feedService.ts`
- [ ] Add `clearCompleted` + `clearedToast` to `useFeed.ts`
- [ ] Update `CompletedSection.tsx` with "Clear" button + `onClear` prop
- [ ] Add/extend toast for cleared count

## P2 Checklist (requires migration)

- [ ] Add `settings Json?` to `User` in `schema.prisma`
- [ ] Run `cd backend && npx prisma migrate dev --name add-user-settings`
- [ ] Add user settings service + routes
- [ ] Add auto-clear hook in `sync.worker.ts`
- [ ] Add auto-clear settings UI in frontend

## Running Tests

```bash
# Backend unit tests
cd backend && pnpm test

# Frontend unit tests
cd frontend && pnpm test

# E2E (requires running stack)
pnpm test:e2e
```
