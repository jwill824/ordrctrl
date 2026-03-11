# Tasks: Task Inbox

**Input**: Design documents from `specs/010-task-inbox/`
**Branch**: `010-task-inbox` | **GitHub Issue**: [#32](https://github.com/jwill824/ordrctrl/issues/32)
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create new directories and confirm branch is current

- [ ] T001 Confirm branch `010-task-inbox` is checked out and up to date with `git status`
- [ ] T002 [P] Create `backend/src/inbox/` directory (will hold `inbox.service.ts`)
- [ ] T003 [P] Create `frontend/src/components/inbox/` directory (will hold inbox UI components)
- [ ] T004 [P] Create `frontend/src/hooks/` directory if it does not exist
- [ ] T005 [P] Create `frontend/src/app/inbox/` directory (Next.js `/inbox` route)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB schema change + cache/feed write-path changes that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Add `pendingInbox Boolean @default(false)` field and `@@index([userId, pendingInbox])` to `SyncCacheItem` model in `backend/prisma/schema.prisma`
- [ ] T007 Run `pnpm --filter backend prisma migrate dev --name add_pending_inbox_to_sync_cache_item` to generate and apply migration; commit the generated migration file under `backend/prisma/migrations/`
- [ ] T008 Run `pnpm --filter backend prisma:generate` to regenerate the Prisma client after schema change
- [ ] T009 Modify `persistCacheItems()` in `backend/src/sync/cache.service.ts` — in the `upsert` **create** branch, add `pendingInbox: true`; leave the **update** branch unchanged (do NOT include `pendingInbox` in update)
- [ ] T010 Modify `getCacheItemsForUser()` in `backend/src/feed/feed.service.ts` — add `pendingInbox: false` to the Prisma `where` clause so only accepted items appear in the feed
- [ ] T011 Run `pnpm --filter backend test` to confirm all existing backend tests still pass after schema and filter changes

**Checkpoint**: DB migrated, cache writes to inbox, feed excludes inbox items — foundation ready

---

## Phase 3: User Story 1 — View Staged Tasks in Inbox (Priority: P1) 🎯 MVP

**Goal**: New synced items land in inbox (not feed); user can view them grouped by source integration

**Independent Test**: Trigger a manual sync for any connected integration. Verify items appear at `GET /api/inbox` and NOT in `GET /api/feed`. Verify items are grouped by `integrationId` with `accountIdentifier` shown.

### Implementation

- [ ] T012 [US1] Create `backend/src/inbox/inbox.service.ts` — implement `buildInbox(userId)`: query `SyncCacheItem` where `pendingInbox=true AND expiresAt>now AND id NOT IN dismissedIds`; join `Integration` for group metadata; group by `integrationId`; return `InboxResult` with `groups[]` and `total`
- [ ] T013 [US1] Create `backend/src/inbox/inbox.service.ts` — implement `getInboxCount(userId)`: lightweight count query for `pendingInbox=true AND expiresAt>now AND id NOT IN dismissedIds`
- [ ] T014 [US1] Create `backend/src/api/inbox.routes.ts` — implement `GET /api/inbox` route handler calling `buildInbox()`; require authenticated session (same pattern as `feed.routes.ts`); return `InboxResult` as JSON
- [ ] T015 [US1] Create `backend/src/api/inbox.routes.ts` — implement `GET /api/inbox/count` route handler calling `getInboxCount()`; return `{ count: number }`
- [ ] T016 [US1] Register `registerInboxRoutes(app)` in `backend/src/server.ts` (same pattern as `registerFeedRoutes`)
- [ ] T017 [US1] Create `frontend/src/services/inbox.service.ts` — implement `getInbox(): Promise<InboxResult>` and `getInboxCount(): Promise<{ count: number }>` calling `/api/inbox` and `/api/inbox/count`
- [ ] T018 [US1] Create `frontend/src/hooks/useInbox.ts` — React hook wrapping `inbox.service.ts` with `{ groups, total, loading, error, refresh }` state
- [ ] T019 [US1] Create `frontend/src/components/inbox/InboxItem.tsx` — renders a single inbox item row: title, itemType icon, dueAt/startAt date, source label; no action buttons yet (added in US2)
- [ ] T020 [US1] Create `frontend/src/components/inbox/InboxGroup.tsx` — renders a group header (service icon + accountIdentifier) and a list of `InboxItem` rows; no bulk action buttons yet (added in US3)
- [ ] T021 [US1] Create `frontend/src/components/inbox/InboxPage.tsx` — renders full inbox using `useInbox()`; shows list of `InboxGroup` components; shows empty state ("Your inbox is empty") when `total === 0`
- [ ] T022 [US1] Create `frontend/src/app/inbox/page.tsx` — Next.js page component that renders `<InboxPage />`
- [ ] T023 [US1] Write backend unit tests for `buildInbox` and `getInboxCount` in `backend/tests/unit/inbox/inbox.service.test.ts` — cover: returns only `pendingInbox=true` items, excludes dismissed items, groups by integrationId correctly, returns empty when inbox is empty
- [ ] T024 [US1] Write backend contract tests in `backend/tests/contract/inbox.routes.test.ts` — cover: `GET /api/inbox` → 200 with grouped structure; `GET /api/inbox/count` → 200 `{ count: N }` (mock `inbox.service.ts` and `sync.scheduler.ts`)
- [ ] T025 [US1] Run `pnpm --filter backend test` and `pnpm --filter frontend test` to confirm all tests pass

**Checkpoint**: User can navigate to `/inbox` and see staged tasks grouped by source; feed is clean

---

## Phase 4: User Story 2 — Triage Individual Tasks (Priority: P2)

**Goal**: Accept moves item to feed; dismiss moves item to dismissed archive

**Independent Test**: Accept one inbox item → verify it appears in `GET /api/feed` and is absent from `GET /api/inbox`. Dismiss one inbox item → verify it appears in `GET /api/feed/dismissed` and is absent from both inbox and feed.

### Implementation

- [ ] T026 [US2] Add `acceptInboxItem(userId, syncCacheItemId)` to `backend/src/inbox/inbox.service.ts` — verify item exists and belongs to user; verify `pendingInbox=true` (throw `AppError('ALREADY_ACCEPTED')` if not); call `prisma.syncCacheItem.update({ id, data: { pendingInbox: false } })`
- [ ] T027 [US2] Add `dismissInboxItem(userId, syncCacheItemId)` to `backend/src/inbox/inbox.service.ts` — verify item exists and belongs to user; in a transaction: set `pendingInbox=false` AND upsert `SyncOverride({ userId, syncCacheItemId, overrideType: 'DISMISSED' })`
- [ ] T028 [US2] Add `PATCH /api/inbox/items/:itemId/accept` route to `backend/src/api/inbox.routes.ts` — strip `inbox:` prefix from itemId; call `acceptInboxItem()`; return `200 {}`; handle 404 (ITEM_NOT_FOUND), 409 (ALREADY_ACCEPTED), 400 (INVALID_ITEM_ID)
- [ ] T029 [US2] Add `PATCH /api/inbox/items/:itemId/dismiss` route to `backend/src/api/inbox.routes.ts` — strip `inbox:` prefix; call `dismissInboxItem()`; return `200 {}`; handle 404 (ITEM_NOT_FOUND), 400 (INVALID_ITEM_ID)
- [ ] T030 [US2] Add `acceptItem(itemId)` and `dismissItem(itemId)` to `frontend/src/services/inbox.service.ts` calling `PATCH /api/inbox/items/:itemId/accept` and `PATCH /api/inbox/items/:itemId/dismiss`
- [ ] T031 [US2] Update `frontend/src/components/inbox/InboxItem.tsx` — add Accept button (✓) and Dismiss button (✕); on click call `acceptItem`/`dismissItem` from `useInbox` hook; optimistically remove item from local group state
- [ ] T032 [US2] Update `frontend/src/hooks/useInbox.ts` — expose `acceptItem(itemId)` and `dismissItem(itemId)` methods that call the service then call `refresh()`
- [ ] T033 [US2] Write unit tests for `acceptInboxItem` and `dismissInboxItem` in `backend/tests/unit/inbox/inbox.service.test.ts` — cover: accept sets `pendingInbox=false`; accept throws 409 for non-inbox items; dismiss sets `pendingInbox=false` and creates DISMISSED override
- [ ] T034 [US2] Add contract tests to `backend/tests/contract/inbox.routes.test.ts` — cover: `PATCH /accept` → 200; `PATCH /accept` → 404 if not found; `PATCH /accept` → 409 if already accepted; `PATCH /dismiss` → 200; `PATCH /dismiss` → 404 if not found
- [ ] T035 [US2] Write frontend unit tests in `frontend/tests/unit/components/inbox/InboxItem.test.tsx` — cover: renders accept and dismiss buttons; calls correct handler on click; item removed from view after action
- [ ] T036 [US2] Run `pnpm --filter backend test` and `pnpm --filter frontend test` to confirm all tests pass

**Checkpoint**: Individual accept and dismiss work end-to-end; feed and dismissed archive reflect changes

---

## Phase 5: User Story 3 — Bulk Triage by Source (Priority: P3)

**Goal**: "Accept All" / "Dismiss All" buttons per integration group handle all items at once

**Independent Test**: With 5+ items from one source, click "Accept All" → all items from that source appear in feed; inbox group disappears. Click "Dismiss All" on another group → all items appear in dismissed archive.

### Implementation

- [ ] T037 [US3] Add `acceptAll(userId, integrationId)` to `backend/src/inbox/inbox.service.ts` — verify integration belongs to user; `prisma.syncCacheItem.updateMany({ where: { userId, integrationId, pendingInbox: true, expiresAt: { gt: now } }, data: { pendingInbox: false } })`; return `{ accepted: count }`
- [ ] T038 [US3] Add `dismissAll(userId, integrationId)` to `backend/src/inbox/inbox.service.ts` — verify integration belongs to user; fetch all pending inbox item IDs for that integration; in a transaction: `updateMany` to set `pendingInbox=false` + create `SyncOverride(DISMISSED)` for each; return `{ dismissed: count }`
- [ ] T039 [US3] Add `POST /api/inbox/accept-all` route to `backend/src/api/inbox.routes.ts` — validate `integrationId` in body; call `acceptAll()`; return `200 { accepted: N }`; handle 400 (MISSING_INTEGRATION_ID), 404 (INTEGRATION_NOT_FOUND)
- [ ] T040 [US3] Add `POST /api/inbox/dismiss-all` route to `backend/src/api/inbox.routes.ts` — validate `integrationId` in body; call `dismissAll()`; return `200 { dismissed: N }`; handle 400, 404
- [ ] T041 [US3] Add `acceptAll(integrationId)` and `dismissAll(integrationId)` to `frontend/src/services/inbox.service.ts` calling `POST /api/inbox/accept-all` and `POST /api/inbox/dismiss-all`
- [ ] T042 [US3] Update `frontend/src/components/inbox/InboxGroup.tsx` — add "Accept All" and "Dismiss All" buttons to group header; on click call `acceptAll`/`dismissAll`; optimistically remove the entire group from view
- [ ] T043 [US3] Update `frontend/src/hooks/useInbox.ts` — expose `acceptAll(integrationId)` and `dismissAll(integrationId)` methods
- [ ] T044 [US3] Write unit tests for `acceptAll` and `dismissAll` in `backend/tests/unit/inbox/inbox.service.test.ts` — cover: accepts only items matching integrationId; dismissAll creates DISMISSED overrides; items from other integrations unaffected
- [ ] T045 [US3] Add contract tests to `backend/tests/contract/inbox.routes.test.ts` — cover: `POST /accept-all` → 200 `{ accepted: N }`; `POST /dismiss-all` → 200 `{ dismissed: N }`; 404 for unknown integrationId
- [ ] T046 [US3] Write frontend unit tests in `frontend/tests/unit/components/inbox/InboxGroup.test.tsx` — cover: renders Accept All and Dismiss All buttons; calls correct handler on click; group removed from view after bulk action; items from other groups unaffected
- [ ] T047 [US3] Run `pnpm --filter backend test` and `pnpm --filter frontend test` to confirm all tests pass

**Checkpoint**: Bulk triage works per source group; other groups remain unaffected

---

## Phase 6: User Story 4 — Inbox Count Badge in Navigation (Priority: P4)

**Goal**: Navigation shows pending inbox count; updates immediately after any triage action

**Independent Test**: Sync produces 3 new items → AccountMenu shows badge "3". Accept one → badge shows "2". Empty inbox → no badge shown.

### Implementation

- [ ] T048 [US4] Create `frontend/src/hooks/useInboxCount.ts` — lightweight hook that calls `getInboxCount()` on mount and after a configurable poll interval (default: same as feed refresh); exposes `{ count, refresh }`
- [ ] T049 [US4] Modify `frontend/src/components/AccountMenu.tsx` — import `useInboxCount`; add "Inbox" `<Link href="/inbox">` menu item above existing items; render a small badge `<span>` with `count` when `count > 0`; no badge when `count === 0`
- [ ] T050 [US4] Modify `frontend/src/app/feed/page.tsx` — replace or augment the existing `newItemCount` badge on the Refresh button with `useInboxCount()` count; badge clicking or hovering should indicate items are in `/inbox`
- [ ] T051 [US4] Update `frontend/src/hooks/useInbox.ts` — after `acceptItem`, `dismissItem`, `acceptAll`, `dismissAll` resolve, call `refreshCount()` from `useInboxCount` (or trigger a re-fetch) so the nav badge updates immediately
- [ ] T052 [US4] Run `pnpm --filter frontend build` to confirm no TypeScript or build errors introduced by AccountMenu and feed page changes

**Checkpoint**: Navigation badge reflects live inbox count across all pages; updates immediately on triage

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Feed regression validation, edge cases, and final cleanup

- [ ] T053 [P] Verify feed regression: run `pnpm --filter backend test` and confirm `GET /api/feed` test cases do not return items with `pendingInbox=true` — add feed regression test case to `backend/tests/contract/feed.routes.test.ts` if not already covered
- [ ] T054 [P] Verify dismissed archive: confirm dismissed inbox items appear at `GET /api/feed/dismissed` and do NOT appear in feed or inbox — add test case to `backend/tests/contract/inbox.routes.test.ts`
- [ ] T055 [P] Add empty-group guard to `frontend/src/components/inbox/InboxGroup.tsx` — if `items.length === 0`, render nothing (group header must not render with empty list)
- [ ] T056 Handle disconnected-integration edge case in `frontend/src/components/inbox/InboxGroup.tsx` — if integration status is `disconnected` or `error`, still render group with a status indicator; accept/dismiss still work
- [ ] T057 Run full CI locally: `pnpm --filter backend test && pnpm --filter frontend test && pnpm --filter frontend build` — all must pass
- [ ] T058 Update `specs/010-task-inbox/spec.md` status from `Draft` to `Implemented`
- [ ] T059 Commit all changes with message `feat(010): implement task inbox staging area`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS** all user story phases
- **Phase 3 (US1)**: Depends on Phase 2 — read-only inbox surface
- **Phase 4 (US2)**: Depends on Phase 3 — triage actions require inbox view to exist
- **Phase 5 (US3)**: Depends on Phase 4 — bulk actions build on individual triage
- **Phase 6 (US4)**: Can start after Phase 3 — badge only needs count endpoint (T013/T015)
- **Phase 7 (Polish)**: Depends on all story phases complete

### Parallel Opportunities per Phase

**Phase 2**: T006 (schema) → T007 (migrate) → T008 (generate) → then T009 and T010 can run in parallel

**Phase 3**: T012/T013 (service) can run in parallel with T017 (frontend service); T019/T020 (components) in parallel with T014/T015 (routes)

**Phase 4**: T026/T027 (service) in parallel with T030 (frontend service); T031/T032 (component+hook) in parallel with T028/T029 (routes)

**Phase 5**: T037/T038 (service) in parallel with T041 (frontend service); T042/T043 (component+hook) in parallel with T039/T040 (routes)

**Phase 7**: T053, T054, T055 all in parallel

---

## Parallel Example: Phase 3 (US1)

```text
# After T008 (prisma generate) completes:
Parallel group A (backend):
  T012 - inbox.service.ts buildInbox()
  T013 - inbox.service.ts getInboxCount()

# After T012/T013:
  T014 - inbox.routes.ts GET /api/inbox
  T015 - inbox.routes.ts GET /api/inbox/count
  T016 - server.ts registration

Parallel group B (frontend, can start alongside group A):
  T017 - inbox.service.ts (frontend)
  T018 - useInbox.ts hook
  T019 - InboxItem.tsx component
  T020 - InboxGroup.tsx component

# After T017-T020:
  T021 - InboxPage.tsx
  T022 - app/inbox/page.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (**CRITICAL** — blocks everything)
3. Complete Phase 3: US1 (inbox view + read endpoints)
4. **STOP and VALIDATE**: Navigate to `/inbox`, trigger a sync, confirm items appear there and NOT in feed
5. Deploy/demo if ready — this alone delivers SC-001 (zero items bypass inbox)

### Incremental Delivery

- **After US1**: Inbox is visible, feed is clean. Working MVP.
- **After US2**: Users can triage one item at a time. Core workflow complete.
- **After US3**: Bulk triage for power users. Gmail-heavy users unblocked.
- **After US4**: Navigation badge drives daily engagement. Feature fully complete.

---

## Notes

- [P] = parallelizable (different files, no blocking dependency)
- All backend tests use Vitest; frontend tests use Jest + RTL
- `inbox:` prefix on item IDs must be stripped in route handlers before DB lookup
- `pendingInbox` update branch must be intentionally omitted — re-syncs must not reset accepted items
- `dismissAll` requires a transaction to keep `pendingInbox=false` + `SyncOverride` creation atomic
