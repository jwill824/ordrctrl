---
description: "Task list for 019-task-timeline-view implementation"
---

# Tasks: Task Timeline View

**Input**: `specs/019-task-timeline-view/` — plan.md, spec.md, data-model.md, quickstart.md
**Branch**: `019-task-timeline-view`
**Scope**: Frontend-only — no new API endpoints, no DB migrations

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- File paths are relative to repository root

---

## Phase 1: Setup

**Purpose**: Establish directory structure for new timeline components

- [ ] T001 Create `frontend/src/components/timeline/` directory and initialize `frontend/src/components/timeline/index.ts` with empty barrel export

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types and settings extensions — MUST complete before any user story work

**⚠️ CRITICAL**: All three user story phases (US1–US4) depend on these types being in place

- [ ] T002 Define `TimelineBucket`, `TimelineGroupData`, and `TimelineViewMode` types in `frontend/src/types/timeline.ts` — use exact definitions from `data-model.md`
- [ ] T003 [P] Extend `UserSettings` interface in `backend/src/user/user.service.ts` with `feedViewMode?: 'feed' | 'timeline'` — no Prisma migration required (stored in existing `User.settings` JSON column)
- [ ] T004 [P] Extend frontend `UserSettings` type in `frontend/src/plugins/notifications.ts` with `feedViewMode?: 'feed' | 'timeline'` to align with backend type

**Checkpoint**: Foundation ready — T002 types importable; T003/T004 settings fields typed on both ends

---

## Phase 3: User Story 1 — View Tasks Organized by Due Date (Priority: P1) 🎯 MVP

**Goal**: Render `FeedItem[]` from `useFeed` grouped into date buckets in a scrollable timeline with auto-collapse behavior.

**Independent Test**: Load the app with tasks spanning multiple due dates. Open timeline view and verify tasks appear in the correct Overdue / Today / This Week / Later / Unscheduled buckets; empty buckets are hidden; Overdue and Today expand by default; This Week and Later start collapsed.

- [ ] T005 [P] [US1] Implement `useTimeline` hook in `frontend/src/hooks/useTimeline.ts` — midnight-normalized bucket assignment per `data-model.md` (`setHours(0,0,0,0)`), filter out `completed` and `dismissed` items, sort each bucket by `dueAt ASC` then `title ASC` (unscheduled by `title ASC` only), return only non-empty `TimelineGroupData[]` in canonical order: overdue → today → this-week → later → unscheduled; accept `FeedItem[]` and `now: Date` as inputs
- [ ] T006 [P] [US1] Create `TimelineGroup` component in `frontend/src/components/timeline/TimelineGroup.tsx` — sticky group header with label and task count badge, `useState(defaultExpanded)` for collapse/expand (state resets on each mount, no persistence), renders a `FeedItemRow` per item (directly reused from `frontend/src/components/feed/FeedItem.tsx`), threads `onComplete`/`onDismiss`/`onEdit` callback props through to each `FeedItemRow`; accept `TimelineGroupData` props plus the three action callbacks
- [ ] T007 [US1] Create `TimelineView` component in `frontend/src/components/timeline/TimelineView.tsx` — call `useTimeline(feedItems, now)` from `useLiveDate()`, map output to `TimelineGroup` instances, render empty-state message when all buckets are empty, accept and pass `onComplete`/`onDismiss`/`onEdit` action callbacks to each group; accept `feedItems: FeedItem[]` as prop
- [ ] T008 [US1] Export `TimelineView` and `TimelineGroup` from `frontend/src/components/timeline/index.ts`

**Checkpoint**: `<TimelineView feedItems={mockItems} onComplete={...} onDismiss={...} onEdit={...} />` renders correctly in a dev harness — groups visible, collapse/expand works, empty state renders when `feedItems` is empty

---

## Phase 4: User Story 2 — Navigate Between Feed and Timeline (Priority: P2)

**Goal**: Platform-adaptive navigation — lateral swipe on mobile (Capacitor), segmented toggle on desktop/web (Tauri + browser) — with preference persisted to the user account.

**Independent Test**: On mobile, swipe left from the feed to enter timeline; swipe right to return. On desktop/web, use the toggle control to switch. Close and reopen the app on each platform — verify the last-used view is restored.

- [ ] T009 [P] [US2] Create `TimelineSwipeContainer` component in `frontend/src/components/timeline/TimelineSwipeContainer.tsx` — vanilla pointer events (`onPointerDown`/`onPointerMove`/`onPointerUp`), 50 px horizontal threshold, `Math.abs(deltaX) > Math.abs(deltaY)` guard to avoid intercepting vertical scroll, side-by-side feed+timeline layout with CSS `translateX` transition; accept `onSwipeLeft`/`onSwipeRight` callbacks and `activeView: 'feed' | 'timeline'` prop
- [ ] T010 [US2] Integrate view switching into `frontend/src/app/feed/page.tsx` — use `usePlatform()` to branch: on `isMobile` wrap content with `TimelineSwipeContainer`; on desktop/web render a segmented toggle control in the feed header and conditionally render `FeedSection` or `TimelineView`; read `feedViewMode` from `getUserSettings()` on mount for initial state; write via `updateUserSettings({ feedViewMode })` on toggle/swipe with optimistic local state update
- [ ] T011 [US2] Export `TimelineSwipeContainer` from `frontend/src/components/timeline/index.ts`

**Checkpoint**: Full navigation flow works on iOS/Android (swipe), macOS/Windows (toggle), and web (toggle); preference survives cold app restart on each platform

---

## Phase 5: User Story 3 — Interact with Tasks Inline (Priority: P3)

**Goal**: Users can complete, dismiss, and open task details directly from the timeline without leaving the view; overdue tasks are visually distinct; offline state is communicated.

**Independent Test**: In timeline view, mark one task complete and dismiss another. Verify both are removed from the timeline immediately. Verify overdue tasks have distinct visual styling. Simulate offline — verify stale-data indicator appears.

- [ ] T012 [P] [US3] Add overdue visual distinction to `frontend/src/components/timeline/TimelineGroup.tsx` — apply a distinct Tailwind color class (e.g., `text-red-600` / `border-red-400`) to the overdue bucket header and to each `FeedItemRow` wrapper div when `bucket === 'overdue'`; satisfies FR-014
- [ ] T013 [P] [US3] Add offline stale-data indicator to `frontend/src/components/timeline/TimelineView.tsx` — detect offline/stale state (reuse existing network-state detection pattern from the feed page if available), render a banner or subtle badge below the timeline header when data may be stale
- [ ] T014 [US3] Add first-launch swipe discovery hint to `frontend/src/app/feed/page.tsx` — on mobile, check a `timelineHintShown` flag via `NativePrefs` (using the existing `readPref`/`writePref` pattern from `frontend/src/plugins/notifications.ts`); if absent, show a one-time peek animation or tooltip pointing left to signal the swipe affordance; write the flag after display so it never repeats

**Checkpoint**: Complete/dismiss actions in timeline remove tasks instantly and reflect in the feed; overdue bucket header and items are visually distinct from other buckets; offline indicator appears when stale

---

## Phase 6: User Story 4 — Filter Timeline by Source Integration (Priority: P4)

**Goal**: Users can narrow the timeline to tasks from a single source integration; empty groups hide automatically when a filter is active.

**Independent Test**: With tasks from at least two integrations, select a source filter. Verify only tasks from that source appear across all date groups; groups with no matching tasks are hidden. Clear the filter and verify all tasks return.

- [ ] T015 [P] [US4] Add optional `sourceFilter?: string` parameter to `useTimeline` in `frontend/src/hooks/useTimeline.ts` — pre-filter `FeedItem[]` by `item.source === sourceFilter` before bucketing when a filter value is provided; pass `undefined` for no filter (existing behavior unchanged)
- [ ] T016 [P] [US4] Add source filter UI to `frontend/src/components/timeline/TimelineView.tsx` — derive available source options from the unfiltered `feedItems` prop (deduplicated), render a horizontal chip row or compact dropdown above the group list, manage `activeSource` state locally, pass to `useTimeline` call; hide the filter control when fewer than two distinct sources are present
- [ ] T017 [US4] Wire `sourceFilter` state in `frontend/src/app/feed/page.tsx` — pass active source filter value down to `TimelineView` via prop; clear active filter when the user switches back to feed view

**Checkpoint**: Source filter chips appear when multiple integrations are present; selecting one filters across all date buckets; groups with no matching tasks disappear; clearing the filter restores all tasks

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Refinements that affect multiple user stories and final production readiness

- [ ] T018 Add sticky group header CSS to `frontend/src/components/timeline/TimelineGroup.tsx` — apply `position: sticky; top: 0` with appropriate `z-index` so the header remains visible while scrolling through a long group; satisfies FR-015
- [ ] T019 Add task count badge to collapsed group header in `frontend/src/components/timeline/TimelineGroup.tsx` — render `{items.length} tasks` (or equivalent) in the header when `isExpanded === false`; satisfies FR-017
- [ ] T020 Run `specs/019-task-timeline-view/quickstart.md` manual acceptance checklist end-to-end on iOS, Android, and desktop/web — resolve any gaps found before marking feature complete

**Checkpoint**: All FR and acceptance scenarios from `spec.md` pass on all target platforms (iOS, Android, macOS/Windows, web)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Requires Phase 1 — **blocks all user story phases**
- **US1 (Phase 3)**: Requires Phase 2
- **US2 (Phase 4)**: Requires Phase 3 (needs `TimelineView` + `TimelineGroup` to exist before page integration)
- **US3 (Phase 5)**: Requires Phase 3; can run in parallel with US2
- **US4 (Phase 6)**: Requires Phase 3; can run in parallel with US2 and US3
- **Polish (Phase 7)**: Requires all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational — standalone MVP deliverable
- **US2 (P2)**: Depends on US1 (page integration requires components to exist)
- **US3 (P3)**: Depends on US1; **independent of US2** — touches different parts of the same components
- **US4 (P4)**: Depends on US1 only; **independent of US2 and US3**

### Parallel Opportunities Within Phases

| Phase | Parallel tasks | Reason |
|-------|----------------|--------|
| Phase 2 | T003, T004 | Different files (backend vs. frontend) |
| Phase 3 | T005, T006 | Different files (hook vs. component) |
| Phase 4 | T009 alongside T010 | Different files (swipe container vs. page) |
| Phase 5 | T012, T013 | Different files (TimelineGroup vs. TimelineView) |
| Phase 6 | T015, T016 | Different files (hook vs. component) |

---

## Parallel Example: User Story 1

```bash
# Both can start immediately after Phase 2 (Foundational) completes:
Task T005: "Implement useTimeline hook in frontend/src/hooks/useTimeline.ts"
Task T006: "Create TimelineGroup component in frontend/src/components/timeline/TimelineGroup.tsx"

# After BOTH T005 and T006 complete:
Task T007: "Create TimelineView component in frontend/src/components/timeline/TimelineView.tsx"
Task T008: "Export TimelineView and TimelineGroup from frontend/src/components/timeline/index.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (critical — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Timeline renders with correctly grouped tasks; Overdue/Today expanded; This Week/Later collapsed; empty state works; actions (complete/dismiss) remove tasks
5. Ship or demo the core timeline as MVP

### Incremental Delivery

| Step | Phases | What ships |
|------|--------|------------|
| 1 | Phase 1–2 | Foundation (no visible change) |
| 2 | Phase 3 | Read-only timeline with groups **← MVP** |
| 3 | Phase 4 | Full swipe/toggle nav + preference persistence |
| 4 | Phase 5 | Inline actions + overdue styling + offline indicator |
| 5 | Phase 6 | Source integration filter |
| 6 | Phase 7 | Sticky headers, count badges, final QA |

### Parallel Team Strategy

After Phase 2 (Foundational) completes:

1. **Both developers**: Phase 3, US1 together (T005+T006 in parallel, then T007+T008)
2. Once US1 ships:
   - **Developer A**: Phase 4, US2 (page integration + swipe container)
   - **Developer B**: Phase 5, US3 (overdue styling + offline + hint) — different files
3. Phase 6 (US4) and Phase 7 (Polish) can follow sequentially or be split

---

## Notes

- `[P]` tasks operate on different files — safe to assign to separate developers simultaneously
- `FeedItemRow` is reused directly in `TimelineGroup` — no adaptation required; same prop contract
- `useFeed` is **unchanged** — `useTimeline` is a pure transform over the same `FeedItem[]` output
- Collapse state uses `useState(defaultExpanded)` and resets on each timeline open — **no persistence needed**
- All `diffDays` calculations **MUST** use midnight normalization (`setHours(0,0,0,0)`) — see `data-model.md` for the canonical algorithm; do NOT use millisecond diff from raw `Date` objects
- `useLiveDate()` hook provides the live `now` reference that updates every 60 seconds — import from existing hook, do not inline `new Date()` in render
