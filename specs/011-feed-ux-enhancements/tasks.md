# Tasks: Feed UX Enhancements & Cleanup (011)

**Input**: Design documents from `/specs/011-feed-ux-enhancements/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/feed-api.md ✅, quickstart.md ✅
**GitHub Issues**: #29, #33, #34, #35, #36

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- All paths are relative to repo root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migration and schema change required before any user story work

- [x] T001 Add `userDueAt DateTime?` field to `SyncCacheItem` model in `backend/prisma/schema.prisma`
- [x] T002 Run `pnpm prisma migrate dev --name add_user_due_at_to_sync_cache_item` in `backend/` and commit the generated migration file
- [x] T003 Run `pnpm prisma generate` in `backend/` to regenerate the Prisma client

**Checkpoint**: Schema migration applied — all user story work can now begin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend `FeedItem` shape changes required by multiple user stories (sections, dismissed view, user due date)

**⚠️ CRITICAL**: US3, US4, and US5 all depend on the updated `FeedItem` type; complete before those stories

- [x] T004 Add `dismissed: boolean` and `hasUserDueAt: boolean` fields to the `FeedItem` interface and `buildFeed()` item mapping in `backend/src/feed/feed.service.ts`; set `dismissed: false` and `hasUserDueAt: false` for all active items for now
- [x] T005 Implement the effective due date merge in `buildFeed()` in `backend/src/feed/feed.service.ts`: `const effectiveDueAt = item.dueAt ?? item.userDueAt ?? null; const hasUserDueAt = item.dueAt === null && item.userDueAt !== null;` and update the `dueAt` and `hasUserDueAt` fields on each `FeedItem`
- [x] T006 Add corresponding `dismissed` and `hasUserDueAt` fields to the `FeedItem` TypeScript type in `frontend/src/services/feed.service.ts` (or the shared types file if one exists)

**Checkpoint**: Foundation ready — updated `FeedItem` shape supports all upcoming user story work

---

## Phase 3: User Story 1 — Remove Onboarding Page (Priority: P1) 🎯 MVP

**Goal**: Users navigating to `/onboarding` are automatically redirected to `/feed` (authenticated) or `/sign-in` (unauthenticated) without seeing any page content.

**Independent Test**: Navigate to `http://localhost:3000/onboarding` while logged in → should land on `/feed`. Log out → navigate to `/onboarding` → should land on `/sign-in`.

- [x] T007 [US1] Replace the contents of `frontend/src/app/onboarding/page.tsx` with a React Router `<Navigate>` redirect to `/feed`; the spec-014 Vite migration superseded the original Next.js `getServerSession()` approach — implemented as `export default function OnboardingPage() { return <Navigate to="/feed" replace />; }`
- [x] T008 [US1] Verify no other files import from `frontend/src/app/onboarding/page.tsx` or `OnboardingContent`; remove any now-dead imports

**Checkpoint**: Navigating to `/onboarding` always redirects. No onboarding UI is rendered.

---

## Phase 4: User Story 2 — Fix Task Date/Time Staleness on Refresh (Priority: P2)

**Goal**: Relative date labels ("due in 2 days", "overdue") on feed tasks update as real time passes, without requiring a full page reload.

**Independent Test**: Load the feed with a task whose due date is the current time + 2 minutes. Wait 2 minutes. Without refreshing the page, the label should update from "due in 2 minutes" to "due in 1 minute" (or "overdue").

- [x] T009 [US2] Create `frontend/src/hooks/useLiveDate.ts` — exports `useLiveDate(intervalMs = 60_000): Date` that stores `new Date()` in state and updates it on `setInterval`; clears interval on unmount
- [x] T010 [P] [US2] Create `frontend/tests/unit/hooks/useLiveDate.test.ts` — tests that: (1) hook returns current Date on mount, (2) value updates after interval fires (use `vi.useFakeTimers`)
- [x] T011 [US2] Update any relative-date formatting in `frontend/src/components/feed/FeedItemRow.tsx` (and any shared date utility) to accept a `now` parameter and use `useLiveDate()` so labels re-render as time passes

**Checkpoint**: Relative date labels tick forward in the browser without manual refresh.

---

## Phase 5: User Story 3 — Feed Sections by Date (Priority: P3)

**Goal**: The main feed displays tasks in two clearly labeled sections — "Upcoming" (tasks with a due date) and "No Date" (tasks without) — preserving existing sort order within each section.

**Independent Test**: Load the feed with a mix of dated and undated tasks. Verify two section headers appear ("Upcoming" and "No Date"), dated tasks appear only in Upcoming ordered by due date, undated tasks appear only in No Date.

- [x] T012 [US3] Create `frontend/src/components/feed/FeedSection.tsx` — accepts `label: string`, `items: FeedItem[]`, `emptyMessage?: string`, and all action handler props (`onComplete`, `onDismiss`, `onRestore`, `onEdit`); renders section header followed by `FeedItemRow` for each item; renders `emptyMessage` if items is empty; renders `null` if items is empty and no `emptyMessage` prop provided
- [x] T013 [P] [US3] Create `frontend/tests/unit/components/feed/FeedSection.test.tsx` — tests that: (1) section label renders, (2) items render correctly, (3) `emptyMessage` renders when items empty, (4) nothing renders when items empty and no `emptyMessage`
- [x] T014 [US3] Update `frontend/src/app/feed/page.tsx` to split `items` from `useFeed()` into two arrays: `datedItems` (where `item.dueAt !== null`) and `undatedItems` (where `item.dueAt === null`); replace the flat item map with two `<FeedSection>` components (label "Upcoming" and "No Date"); pass all handlers through

**Checkpoint**: Feed displays Upcoming and No Date sections. Existing functionality (complete, dismiss, restore) works within sections.

---

## Phase 6: User Story 4 — Update Dismissed Workflow (Priority: P4)

**Goal**: Dismissed items appear inline on `/feed?showDismissed=true`. Users can permanently delete dismissed items. The old `/settings/dismissed` route redirects to the new URL. The dismissed items menu entry already points to the correct URL.

**Independent Test**: Dismiss a task. Click "Dismissed items" in the menu → lands on `/feed?showDismissed=true` showing the dismissed task. Click permanent delete → task disappears and cannot be found in any view. Navigate to `/settings/dismissed` → redirects to `/feed?showDismissed=true`.

### Backend

- [x] T015 [US4] Add `buildDismissedFeed(userId: string)` function to `backend/src/feed/feed.service.ts` — queries `SyncCacheItem` records with a `SyncOverride(DISMISSED)` and `NativeTask` records with `dismissed: true`; returns `{ items: FeedItem[] }` with `dismissed: true` on each item; ordered by most-recently-dismissed first
- [x] T016 [P] [US4] Add `permanentDeleteFeedItem(userId: string, itemId: string)` function to `backend/src/feed/feed.service.ts` — parses `sync:` vs `native:` prefix; for sync items: verifies a `SyncOverride(DISMISSED)` exists (else throws 409 `NOT_DISMISSED`), then hard-deletes the `SyncCacheItem` row; for native items: verifies `dismissed: true` (else 409), then hard-deletes the `NativeTask` row
- [x] T017 [US4] Extend `GET /api/feed` handler in `backend/src/api/feed.routes.ts` to read the `?showDismissed=true` query param; when present call `buildDismissedFeed(userId)` instead of `buildFeed(userId)`
- [x] T018 [US4] Add `DELETE /api/feed/items/:itemId/permanent` route to `backend/src/api/feed.routes.ts` — calls `permanentDeleteFeedItem(userId, itemId)`; returns 200 `{}`; surfaces 404 / 409 / 400 errors with appropriate codes

### Backend Tests

- [x] T019 [P] [US4] Add unit tests to `backend/tests/unit/feed/feed.service.test.ts` covering: `buildDismissedFeed()` returns only dismissed items; `permanentDeleteFeedItem()` succeeds for dismissed sync item; `permanentDeleteFeedItem()` succeeds for dismissed native item; `permanentDeleteFeedItem()` throws 409 for active (non-dismissed) item
- [x] T020 [P] [US4] Add contract tests to `backend/tests/contract/feed.routes.test.ts` covering: `GET /api/feed?showDismissed=true` returns items with `dismissed: true`; `DELETE /api/feed/items/:id/permanent` returns 200 for dismissed item; `DELETE /api/feed/items/:id/permanent` returns 409 for non-dismissed item

### Frontend

- [x] T021 [US4] Add `permanentDeleteItem(itemId: string): Promise<void>` to `frontend/src/services/feed.service.ts` — calls `DELETE /api/feed/items/:itemId/permanent`; extend `fetchFeed()` to accept `{ showDismissed?: boolean }` option and append `?showDismissed=true` to the URL when set
- [x] T022 [US4] Add `permanentDeleteItem(itemId)` action and `showDismissed` option to `frontend/src/hooks/useFeed.ts` — when `showDismissed: true`, fetch dismissed feed; expose `permanentDeleteItem` that calls the service and removes the item from local state
- [x] T023 [US4] Update `frontend/src/app/feed/page.tsx` to read `showDismissed` from `useSearchParams()`; pass `{ showDismissed }` to `useFeed()`; when `showDismissed` is true render a single `<FeedSection label="Dismissed">` with `permanentDeleteItem` wired to a delete button per row; when false render normal Upcoming / No Date sections
- [x] T024 [US4] Update `frontend/src/components/feed/FeedItemRow.tsx` to accept an `onPermanentDelete?: () => void` prop; when provided (dismissed view only), render a "Delete permanently" button alongside the restore button
- [x] T025 [US4] Replace `frontend/src/app/settings/dismissed/page.tsx` contents with a React Router `<Navigate to="/feed?showDismissed=true" replace />`; the spec-014 Vite migration superseded the original Next.js `redirect()` Server Component approach

### Frontend Tests

- [x] T026 [P] [US4] Update `frontend/tests/unit/components/feed/FeedItemRow.test.tsx` — add tests: (1) permanent delete button renders when `onPermanentDelete` prop is provided, (2) permanent delete button is NOT rendered when `onPermanentDelete` is absent

**Checkpoint**: Dismissed items visible inline at `/feed?showDismissed=true`. Permanent delete works. Old route redirects. Normal feed unaffected.

---

## Phase 7: User Story 5 — Edit and Assign Due Dates on Tasks (Priority: P5)

**Goal**: Users can add or change a due date on any feed task (synced or native). The feed immediately reflects the change and the task moves to the correct section (Upcoming / No Date).

**Independent Test**: Find an undated synced task. Open edit → add a due date → save. Task immediately moves from "No Date" to "Upcoming" section. Edit again → clear date → task moves back to "No Date".

### Backend

- [x] T027 [US5] Add `setUserDueAt(userId: string, syncCacheItemId: string, dueAt: Date | null)` function to `backend/src/feed/feed.service.ts` — verifies item exists and `userId` matches (else 404); updates `SyncCacheItem.userDueAt`
- [x] T028 [US5] Add `PATCH /api/feed/items/:itemId/user-due-date` route to `backend/src/api/feed.routes.ts` — accepts `{ dueAt: string | null }` body; validates `itemId` has `sync:` prefix (else 400 `INVALID_ITEM_ID`); parses `dueAt` as ISO string (else 400 `INVALID_DATE`); calls `setUserDueAt()`; returns 200 `{}`

### Backend Tests

- [x] T029 [P] [US5] Add unit tests to `backend/tests/unit/feed/feed.service.test.ts` covering: `setUserDueAt()` sets `userDueAt`; `buildFeed()` returns `effectiveDueAt = dueAt` when source `dueAt` non-null (source wins); `buildFeed()` returns `effectiveDueAt = userDueAt` when source `dueAt` is null; `buildFeed()` sets `hasUserDueAt: true` when user override is applied
- [x] T030 [P] [US5] Add contract tests to `backend/tests/contract/feed.routes.test.ts` covering: `PATCH /items/:id/user-due-date` sets date and subsequent `GET /api/feed` reflects updated `dueAt`; `PATCH` with `null` clears user date; `PATCH` with native item ID returns 400 `INVALID_ITEM_ID`

### Frontend

- [x] T031 [US5] Add `setUserDueAt(itemId: string, dueAt: string | null): Promise<void>` to `frontend/src/services/feed.service.ts` — calls `PATCH /api/feed/items/:itemId/user-due-date`
- [x] T032 [US5] Add `setUserDueAt(itemId, dueAt)` action to `frontend/src/hooks/useFeed.ts` — calls the service; updates the matching item's `dueAt` and `hasUserDueAt` in local state immediately (optimistic update)
- [x] T033 [US5] Update `frontend/src/components/feed/EditTaskModal.tsx` to support synced items (`sync:` prefix IDs): when item is synced, call `setUserDueAt(itemId, date)` on save instead of `updateTask()`; when `hasUserDueAt` is true show an "(override)" label next to the date field; add a "Clear date" button that calls `setUserDueAt(itemId, null)` and closes the modal
- [x] T034 [US5] Wire the edit action for synced items in `frontend/src/app/feed/page.tsx` (or `useFeed.ts`): clicking a synced item should open `EditTaskModal` (today it is only opened for `native:` items); pass `onSetUserDueAt` handler

**Checkpoint**: Users can add/change/clear due dates on both native and synced tasks. Tasks move between sections immediately on save.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, removal of dead code, and final validation

- [x] T035 [P] Remove `frontend/src/components/feed/DismissedItemsPage.tsx` and its test file `frontend/tests/unit/components/feed/DismissedItemsPage.test.tsx` (if it exists) — the dismissed view is now inline on the feed page
- [x] T036 [P] Remove the `frontend/src/app/settings/dismissed/` route directory if empty after T025 redirect (keep only if the redirect `page.tsx` is the only file)
- [x] T037 Run the full backend test suite (`pnpm --filter backend test`) and fix any regressions
- [x] T038 Run the full frontend test suite (`pnpm --filter frontend test`) and fix any regressions
- [x] T039 Update `specs/011-feed-ux-enhancements/spec.md` status to `Implemented`

**Checkpoint**: All tests green. Dead code removed. Spec status updated.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (Prisma client must be regenerated)
- **Phase 3 (US1 — Onboarding)**: No dependency on Phase 2; can run in parallel with Phase 2
- **Phase 4 (US2 — Date Staleness)**: No backend dependencies; can run after Phase 1
- **Phase 5 (US3 — Feed Sections)**: Depends on Phase 2 (needs updated `FeedItem` type)
- **Phase 6 (US4 — Dismissed Workflow)**: Depends on Phase 2 (needs `FeedItem.dismissed`)
- **Phase 7 (US5 — User Due Dates)**: Depends on Phase 2 (needs `userDueAt` column + effective merge)
- **Phase 8 (Polish)**: Depends on all story phases being complete

### User Story Dependencies

| Story | Depends On | Notes |
|-------|------------|-------|
| US1 (Onboarding) | Nothing | Fully independent |
| US2 (Date Staleness) | Phase 1 only | Frontend-only after migration |
| US3 (Feed Sections) | Phase 2 | Needs `FeedItem` type update |
| US4 (Dismissed) | Phase 2 | Needs `FeedItem.dismissed` field |
| US5 (User Due Dates) | Phase 1 + Phase 2 | Needs `userDueAt` column + merge logic |

### Parallel Opportunities Within Each Story

```
Phase 6 (US4) parallel batch:
  T015 buildDismissedFeed()           ← independent
  T016 permanentDeleteFeedItem()      ← independent
  T019 backend unit tests             ← independent
  T020 backend contract tests         ← independent

Phase 7 (US5) parallel batch:
  T029 backend unit tests             ← independent
  T030 backend contract tests         ← independent
  T031 setUserDueAt() frontend svc    ← independent
```

---

## Implementation Strategy

### MVP First (US1 — Onboarding Redirect)

1. Complete Phase 1 (migration — needed for later stories)
2. Complete Phase 3 (US1) — no backend dependency
3. **STOP and VALIDATE**: `/onboarding` redirects correctly
4. Ship this as immediate improvement

### Incremental Delivery

1. Phase 1 + Phase 2 → Foundation ready
2. Phase 3 (US1) → Remove broken page ✅
3. Phase 4 (US2) → Fix stale dates ✅
4. Phase 5 (US3) → Feed sections ✅
5. Phase 6 (US4) → Dismissed inline + permanent delete ✅
6. Phase 7 (US5) → User-assigned due dates ✅
7. Phase 8 → Polish + cleanup ✅

### Task Count Summary

| Phase | Tasks | Story |
|-------|-------|-------|
| Phase 1: Setup | 3 | — |
| Phase 2: Foundational | 3 | — |
| Phase 3 | 2 | US1 (Onboarding) |
| Phase 4 | 3 | US2 (Date Staleness) |
| Phase 5 | 3 | US3 (Feed Sections) |
| Phase 6 | 12 | US4 (Dismissed Workflow) |
| Phase 7 | 8 | US5 (User Due Dates) |
| Phase 8: Polish | 5 | — |
| **Total** | **39** | |
