# Tasks: Task Content Enhancements

**Feature Branch**: `013-task-content-enhancements`  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)  
**Issues**: #44 (Edit task description), #38 (Open task source link)

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies at that point)
- **[Story]**: Which user story this task belongs to (US1 = description override, US2 = source links)

---

## Phase 1: Setup (none — monorepo already configured)

No setup tasks required. Project structure, package management, and tooling are already in place.

---

## Phase 2: Foundational — Schema & Adapter Types (Blocking Prerequisites)

**Purpose**: All user story work depends on these schema changes and type updates.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete.

- [ ] T001 Update `OverrideType` enum in `backend/prisma/schema.prisma` to add `DESCRIPTION_OVERRIDE` value
- [ ] T002 Update `SyncOverride` model in `backend/prisma/schema.prisma` to add `value String?` and `updatedAt DateTime @updatedAt` fields
- [ ] T003 Update `SyncCacheItem` model in `backend/prisma/schema.prisma` to add `body String?` and `url String?` fields
- [ ] T004 Generate and apply Prisma migration named `add_task_content_enhancements` — run `cd backend && pnpm prisma migrate dev --name add_task_content_enhancements`
- [ ] T005 Regenerate Prisma client after migration — run `cd backend && pnpm prisma generate`
- [ ] T006 [P] Update `NormalizedItem` adapter type in `backend/src/integrations/_adapter/types.ts` to add optional `body?: string | null` and `url?: string | null` fields
- [ ] T007 [P] Update Gmail adapter in `backend/src/integrations/gmail/index.ts` to populate `body` from email snippet and `url` constructed from `threadId` (format: `https://mail.google.com/mail/u/0/#inbox/<threadId>`)
- [ ] T008 [P] Update Microsoft Tasks adapter in `backend/src/integrations/microsoft-tasks/index.ts` to populate `body` from `body.content` and `url` from `webLink`
- [ ] T009 [P] Update Apple Calendar adapter in `backend/src/integrations/apple-calendar/index.ts` to populate `body` from `DESCRIPTION:` VEVENT property and `url` from `URL:` VEVENT property (null if absent)
- [ ] T010 Update cache service `backend/src/sync/cache.service.ts` to persist `body` and `url` from `NormalizedItem` in the `SyncCacheItem` upsert call

**Checkpoint**: Schema migrated, client regenerated, adapters populating body+url, cache persisting them. User story phases can now proceed.

---

## Phase 3: User Story 1 — Edit Synced Task Description (Priority: P1) 🎯 MVP

**Goal**: Users can write a personal description summary for any synced task, stored as a `DESCRIPTION_OVERRIDE` record. The original integration body is always preserved and accessible. An "edited" badge signals when an override is active.

**Independent Test**: Open the task detail modal for any synced task → edit description → save → verify override text shown with "edited" indicator → expand original → verify original body visible → clear override → verify original shown again with no indicator.

### Backend — Feed Service & Route

- [ ] T011 [US1] Update `buildFeed()` in `backend/src/feed/feed.service.ts` to include `body: true, url: true` in the `SyncCacheItem` select, and add a scoped `syncOverrides` sub-query filtered to `overrideType: 'DESCRIPTION_OVERRIDE'` (select `value`, `updatedAt`, take 1)
- [ ] T012 [US1] Update the per-item mapping in `buildFeed()` in `backend/src/feed/feed.service.ts` to compute and return `originalBody`, `description`, `hasDescriptionOverride`, `descriptionOverride`, `descriptionUpdatedAt`, and `sourceUrl` per the contracts/feed-get.md mapping logic
- [ ] T013 [US1] Add `setDescriptionOverride(userId, syncCacheItemId, value)` service function to `backend/src/feed/feed.service.ts` — upsert `SyncOverride{overrideType: DESCRIPTION_OVERRIDE, value: trimmedValue}` for non-null value; `deleteMany` where `syncCacheItemId + DESCRIPTION_OVERRIDE` for null value; verify item ownership before write; return `SetDescriptionOverrideResult`
- [ ] T014 [US1] Add `PATCH /api/feed/items/:itemId/description-override` route to `backend/src/api/feed.routes.ts` — validate `sync:` prefix, validate `value` (non-empty or null, ≤50 000 chars), call `setDescriptionOverride`, return 200/400/401/404 per contracts/description-override.md

### Backend — Tests

- [ ] T015 [P] [US1] Add/update unit tests in `backend/tests/unit/feed.service.test.ts` for `setDescriptionOverride` — test set, update, clear, item-not-found, and wrong-user cases
- [ ] T016 [P] [US1] Add endpoint integration tests in `backend/tests/unit/feed.routes.description.test.ts` — test 200 set, 200 clear, 400 invalid ID, 400 empty value, 400 too long, 401 unauthed, 404 not found

### Frontend — Types & Service

- [ ] T017 [US1] Update `FeedItem` interface in `frontend/src/services/feed.service.ts` to add `originalBody`, `description`, `hasDescriptionOverride`, `descriptionOverride`, `descriptionUpdatedAt`, and `sourceUrl` fields (per data-model.md frontend type changes)
- [ ] T018 [US1] Add `setDescriptionOverride(itemId, value)` function to `frontend/src/services/feed.service.ts` — calls `PATCH /api/feed/items/:itemId/description-override` with `{value}`, returns `SetDescriptionOverrideResult`

### Frontend — Hook

- [ ] T019 [US1] Add `setDescriptionOverride(itemId: string, value: string | null)` action to `frontend/src/hooks/useFeed.ts` — optimistically update the matching `FeedItem` in local state, call `feedService.setDescriptionOverride`, revert on error

### Frontend — EditTaskModal UI

- [ ] T020 [US1] Update `frontend/src/components/tasks/EditTaskModal.tsx` to display a description textarea pre-populated with `item.description` (or empty if null) when the item is a synced task (`serviceId !== 'ordrctrl'`)
- [ ] T021 [US1] Update `frontend/src/components/tasks/EditTaskModal.tsx` to show an "edited" badge (e.g. a small pill labelled "Edited") when `item.hasDescriptionOverride` is true
- [ ] T022 [US1] Update `frontend/src/components/tasks/EditTaskModal.tsx` to include an expandable "Original" section that displays `item.originalBody` when `item.originalBody` is non-null and `item.hasDescriptionOverride` is true
- [ ] T023 [US1] Wire Save / Cancel in `frontend/src/components/tasks/EditTaskModal.tsx` — Save calls `useFeed.setDescriptionOverride(item.id, value)`; Cancel closes without any state change; clearing the textarea and saving calls `setDescriptionOverride(item.id, null)` to remove the override

### Frontend — Tests

- [ ] T024 [P] [US1] Update component tests in `frontend/tests/unit/components/tasks/EditTaskModal.test.tsx` to cover: textarea pre-populated with description, "edited" badge visibility, original body expandable, save triggers setDescriptionOverride, cancel makes no call, clear+save sends null
- [ ] T025 [P] [US1] Update service tests in `frontend/tests/unit/services/feed.service.test.ts` to cover `setDescriptionOverride` making the correct PATCH request with value and null payloads

**Checkpoint**: Description override fully functional end-to-end. Story 1 can be demoed independently.

---

## Phase 4: User Story 2 — Open Task in Source App / Browser (Priority: P2)

**Goal**: For every synced task with a non-null `sourceUrl`, a clearly-labelled "Open in [source]" button appears. Clicking it hands off to the platform URL handler. No button shown when `sourceUrl` is null.

**Independent Test**: Open task detail for a Gmail task with a source URL → "Open in Gmail" button visible → click → Gmail opens in new tab. Open a task without a source URL → no button shown. Open a native task → no button shown.

### Source Label Map

Integration label map (use `item.serviceId` to look up display name):
- `gmail` → `"Open in Gmail"`
- `microsoft_tasks` → `"Open in To Do"`
- `apple_calendar` → `"Open in Calendar"`
- `apple_reminders` → `"Open in Reminders"`
- fallback → `"Open Source"`

### Frontend — FeedItem Component

- [ ] T026 [P] [US2] Add `SOURCE_LABEL_MAP` constant in `frontend/src/components/feed/FeedItem.tsx` mapping serviceId to display label (see label map above)
- [ ] T027 [US2] Add "Open in [source]" link/button to `frontend/src/components/feed/FeedItem.tsx` that renders only when `item.sourceUrl` is non-null — use `<a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">` with the mapped label

### Frontend — EditTaskModal UI

- [ ] T028 [US2] Add "Open in [source]" button to `frontend/src/components/tasks/EditTaskModal.tsx` that renders only when `item.sourceUrl` is non-null and `item.serviceId !== 'ordrctrl'` — same label map and `<a target="_blank">` pattern

### Frontend — Tests

- [ ] T029 [P] [US2] Update component tests in `frontend/tests/unit/components/feed/FeedItem.test.tsx` to cover: button shown for item with sourceUrl, correct label per serviceId, button absent when sourceUrl is null, button absent for native tasks
- [ ] T030 [P] [US2] Update component tests in `frontend/tests/unit/components/tasks/EditTaskModal.test.tsx` to cover: "Open in [source]" button shown/hidden per sourceUrl, correct label rendered

**Checkpoint**: Source link navigation fully functional end-to-end. Story 2 can be demoed independently of Story 1.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [ ] T031 Run full backend test suite `cd backend && pnpm test --run` and fix any regressions
- [ ] T032 Run full frontend test suite `cd frontend && pnpm test --run` and fix any regressions
- [ ] T033 Verify FR-013 compliance — open EditTaskModal for a native (`ordrctrl`) task and confirm neither description textarea, "edited" badge, original body section, nor "Open in [source]" button is rendered
- [ ] T034 Commit all changes with message referencing issues #44 and #38, push branch, open PR against main

---

## Dependencies

```
T001 → T002 → T003 → T004 → T005 → (T006, T007, T008, T009 can run in parallel after T005)
T010 depends on T006–T009

T011–T025 (US1) depend on T010 (Foundational complete)
T026–T030 (US2) depend on T017 (FeedItem type updated) — can run in parallel with US1 after T017

T031–T034 depend on all prior tasks
```

## Parallel Execution Opportunities

| Story | Can run in parallel after |
|---|---|
| T006, T007, T008, T009 | T005 (Prisma generate done) |
| T011–T016 (US1 backend) | T010 (cache service updated) |
| T017–T025 (US1 frontend) | T017 unblocks T018–T025; T015/T016/T024/T025 are [P] |
| T026–T030 (US2) | T017 (FeedItem type) |
| T031, T032 | each other (different workspaces) |

## Implementation Strategy

**MVP Scope (Story 1 only)**: Complete T001–T025. This delivers the full description-override capability and is independently shippable. Story 2 (T026–T030) can follow in the same branch or a separate PR.

**Suggested order within a single session**:
1. Schema + migration (T001–T005) — do these first, everything else depends on them
2. Adapter + cache updates (T006–T010) — parallel opportunity
3. Backend service + route + tests (T011–T016) — Story 1 backend complete
4. Frontend types + service + hook + modal UI + tests (T017–T025) — Story 1 frontend complete
5. Frontend source-link additions (T026–T030) — Story 2 (fast, frontend-only)
6. Full test run + PR (T031–T034)
