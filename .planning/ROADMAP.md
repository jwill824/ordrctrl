# Roadmap: ordrctrl

## Milestones

- ✅ **v1.0 Timeline Visual Planner** — Phases 01–06 (shipped 2026-06-05)
- 🚧 **v1.1 Timeline & Planner UX Polish** — Phases 07–11 (in progress)

## Phases

<details>
<summary>✅ v1.0 Timeline Visual Planner (Phases 01–06) — SHIPPED 2026-06-05</summary>

- [x] Phase 01: Schedulable Task Backend (3/3 plans) — completed 2026-06-04
- [x] Phase 02: Daily Timeline View (5/5 plans) — completed 2026-06-04
- [x] Phase 03: Task List View and Toggle (3/3 plans) — completed 2026-06-04
- [x] Phase 04: Weekly Horizontal-Scroll View (5/5 plans) — completed 2026-06-04
- [x] Phase 05: Quick-Create on Timeline (4/4 plans) — completed 2026-06-04
- [x] Phase 06: Polish and Cross-Platform Verification (2/2 plans) — completed 2026-06-04

See: `.planning/milestones/v1.0-ROADMAP.md`

</details>

## 🚧 v1.1 Timeline & Planner UX Polish

- [x] **Phase 07: Navigation Restructure** — Replace 5-tab segmented control with 3-tab bottom nav (Planner | Inbox | Integrations) and responsive sidebar on desktop
- [x] **Phase 08: Timeline Layout Correctness** — Fix block height proportionality, time-axis positioning, and auto-scroll to current time on open
- [x] **Phase 09: Drag to Reschedule** — Drag blocks to change startAt, drag bottom edge to resize duration, with pointer-event unification and backend persist
- [x] **Phase 10: Tap to Edit + Quick-Create UX** — Tap-to-edit bottom sheet, scroll-wheel time picker, duration stepper, all-day tasks
- [x] **Phase 11: Weekly View Navigation** — Prev/next week controls and Today button in the weekly planner view
- [ ] **Phase 12: Timeline Visual Polish** — Structured-style per-task color coding, task icons, block elevation, and smooth animations
- [ ] **Phase 13: Unified TimelineCanvas** — Merge daily and weekly views into a single shared-axis canvas; Day/Week toggle changes column count rather than component; distinct ordrctrl visual identity per column

## Phase Details

### Phase 07: Navigation Restructure
**Goal**: Users navigate the app via a native-feeling 3-tab structure that scales from mobile bottom bar to desktop sidebar
**Depends on**: Nothing (restructures existing shell)
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, NAV-05
**Success Criteria** (what must be TRUE):
  1. On mobile, a bottom tab bar with three tabs (Planner, Inbox, Integrations) replaces the old segmented control as primary navigation
  2. Planner tab shows the daily timeline by default, with a Day / Week toggle inside the tab header
  3. Inbox tab shows unscheduled native tasks and integration items, and lets the user add a date to push any item into the Planner
  4. Integrations tab shows connected accounts (Gmail, Microsoft, Apple Calendar) and their sync status
  5. On desktop (≥768px) the bottom tabs are replaced by a left sidebar with the same three destinations
**Plans**: TBD
**UI hint**: yes

### Phase 08: Timeline Layout Correctness
**Goal**: The daily timeline accurately represents every task's duration and time position as a spatial fact
**Depends on**: Phase 07
**Requirements**: LAYOUT-01, LAYOUT-02, LAYOUT-03
**Success Criteria** (what must be TRUE):
  1. A 30-minute task block is visibly half the height of a 1-hour task block on the same timeline
  2. A task scheduled at 9:00 AM appears at the 9 AM mark on the time axis — not offset, not approximate
  3. Opening the planner scrolls the viewport automatically to center the current time without any user gesture
**Plans**: TBD
**UI hint**: yes

### Phase 09: Drag to Reschedule
**Goal**: Users can reschedule and resize tasks directly on the timeline by dragging, on both mobile and desktop
**Depends on**: Phase 08
**Requirements**: DRAG-01, DRAG-02, DRAG-03, DRAG-04
**Success Criteria** (what must be TRUE):
  1. Dragging a task block vertically repositions it on the timeline with 15-minute snap intervals visible during the drag
  2. Dragging the bottom edge of a block extends or shrinks its duration in 15-minute increments
  3. Releasing a drag or resize updates the timeline instantly (optimistic) and saves to the backend; a server error reverts the block to its original position
  4. Both interactions work identically via touch on mobile (Capacitor) and mouse on desktop (Tauri) through unified pointer event handlers
**Plans**: 5 plans
Plans:
- [x] 09-01-PLAN.md — Write RED tests for useDragToReschedule and DraggableTimeBlock; update DailyPlannerView Test G
- [x] 09-02-PLAN.md — Add timelineConstants, expand useNativeTasks.update, implement useDragToReschedule hook (GREEN)
- [x] 09-03-PLAN.md — Implement DraggableTimeBlock component with all 6 drag states and resize handle (GREEN)
- [ ] 09-04-PLAN.md — Wire DailyPlannerView + feed/page.tsx integration (handleReschedule, handleResize, touchAction toggle)
- [ ] 09-05-PLAN.md — Human verify: drag-move, drag-resize, revert animation, tap disambiguation, sync-item no-op
**UI hint**: yes

### Phase 10: Tap to Edit + Quick-Create UX
**Goal**: Users can edit any scheduled task inline and create tasks with a polished mobile-native time and duration input
**Depends on**: Phase 09
**Requirements**: EDIT-01, EDIT-02, QC-01, QC-02
**Success Criteria** (what must be TRUE):
  1. A short tap on a task block (not initiated as a drag) opens a bottom sheet pre-filled with that task's title, start time, and duration
  2. Saving from the edit sheet updates the task in the timeline immediately and syncs to the backend, reverting on failure
  3. Time input in both the create and edit sheets presents a scroll-wheel picker (hour column and minute column) rather than a text field
  4. Duration input shows a stepper control with + and − buttons in 15-minute increments and a live label of the selected duration
**Plans**: 5 plans
Plans:
- [ ] 10-01-PLAN.md — Write RED tests for useTaskSheet, TaskSheet, onTap in useDragToReschedule, DailyPlannerView Test G update
- [ ] 10-02-PLAN.md — Install react-mobile-picker; implement useTaskSheet hook, timeSlots utility, TimeSlotPicker adapter (GREEN)
- [ ] 10-03-PLAN.md — Implement TaskSheet component (rename QuickCreateSheet; integrate picker + stepper; edit mode + delete confirm) (GREEN)
- [ ] 10-04-PLAN.md — Wire onTap end-to-end: useDragToReschedule → DraggableTimeBlock → DailyPlannerView → feed/page.tsx; remove QuickCreateSheet shim
- [ ] 10-05-PLAN.md — Human verify: tap-to-edit, scroll-wheel picker, stepper, create mode, drag disambiguation, sync item regression
**UI hint**: yes

### Phase 11: Weekly View Navigation
**Goal**: Users can navigate the weekly planner to any week — past or future — and return to today in one tap
**Depends on**: Phase 07
**Requirements**: WEEK-01, WEEK-02
**Success Criteria** (what must be TRUE):
  1. The weekly view has visible prev and next controls; tapping each moves the view back or forward by exactly one week
  2. A "Today" button is always visible in the weekly view and returns the user to the current week from any offset in a single tap
**Plans**: 3 plans
Plans:
- [x] 11-01-PLAN.md — Add formatWeekRange utility to dateUtils.ts + unit tests
- [x] 11-02-PLAN.md — Add nav header row to WeeklyPlannerView + wire callbacks in feed/page.tsx
- [x] 11-03-PLAN.md — Playwright e2e tests for prev/next/today navigation + human verify
**UI hint**: yes

### Phase 12: Timeline Visual Polish
**Goal**: Timeline blocks feel visually alive and distinct — Structured-style color coding, task icons, elevation, and motion
**Depends on**: Phase 08
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-04, VIS-05
**Success Criteria** (what must be TRUE):
  1. Each task has an associated color; blocks render with a semi-transparent fill and a solid left accent in that color
  2. A task's color can be set from a palette in the edit/create sheet; a default color is assigned on creation
  3. Task blocks optionally display an emoji/icon prefix before the title
  4. Blocks have a subtle drop shadow that elevates them off the timeline grid
  5. Block position and height changes (from drag or save) animate smoothly with a short CSS transition
**Plans**: TBD
**UI hint**: yes

### Phase 13: Unified TimelineCanvas
**Goal**: Day and Week views become one component — same time axis, same block logic, different column count — with a distinctive ordrctrl visual identity
**Depends on**: Phase 11, Phase 12
**Requirements**: CANVAS-01, CANVAS-02, CANVAS-03, CANVAS-04, CANVAS-05
**Success Criteria** (what must be TRUE):
  1. A single `TimelineCanvas` component replaces `DailyPlannerView` and `WeeklyPlannerView`; Day/Week toggle changes a `columns` prop (1 vs 7), not the rendered component
  2. The shared time axis (hour labels) is always on the left regardless of column count
  3. In week mode, each day column has a distinct header showing the weekday abbreviation and date; the current day's column is visually highlighted
  4. Task blocks in narrow week columns gracefully degrade: title truncates, time label hides below a minimum block height
  5. Toggling between Day and Week modes animates the column layout (expand/collapse) with a 200ms transition
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|---|---|---|---|---|
| 01: Schedulable Task Backend | v1.0 | 3/3 | Complete | 2026-06-04 |
| 02: Daily Timeline View | v1.0 | 5/5 | Complete | 2026-06-04 |
| 03: Task List View and Toggle | v1.0 | 3/3 | Complete | 2026-06-04 |
| 04: Weekly Horizontal-Scroll View | v1.0 | 5/5 | Complete | 2026-06-04 |
| 05: Quick-Create on Timeline | v1.0 | 4/4 | Complete | 2026-06-04 |
| 06: Polish and Cross-Platform Verification | v1.0 | 2/2 | Complete | 2026-06-04 |
| 07: Navigation Restructure | v1.1 | 2/2 | Complete | 2026-06-05 |
| 08: Timeline Layout Correctness | v1.1 | 1/1 | Complete | 2026-06-05 |
| 09: Drag to Reschedule | v1.1 | 5/5 | Complete | — |
| 10: Tap to Edit + Quick-Create UX | v1.1 | 5/5 | Complete | 2026-06-06 |
| 11: Weekly View Navigation | v1.1 | 0/3 | Not started | — |
| 12: Timeline Visual Polish | v1.1 | 0/TBD | Not started | — |
| 13: Unified TimelineCanvas | v1.1 | 0/TBD | Not started | — |
