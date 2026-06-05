# Requirements — v1.1 Timeline & Planner UX Polish

This file is the explicit capability and coverage contract for milestone v1.1.

## Active

### LAYOUT — Timeline Correctness

- [ ] **LAYOUT-01** — Task block height is proportional to duration (hourHeight px per hour), so a 30-min task is visually half the height of a 1-hour task
  - Class: core-capability
  - Why it matters: Correct proportional sizing is the foundation of a spatial planner — it's how users read how much time a task consumes at a glance
  - Source: user

- [ ] **LAYOUT-02** — Task blocks are vertically positioned at the correct time offset from midnight (top = startMinutes / 60 * hourHeight)
  - Class: core-capability
  - Why it matters: Incorrect positioning breaks the mental model of the timeline — tasks must appear at the time they actually happen
  - Source: user

- [ ] **LAYOUT-03** — Planner view auto-scrolls to center the current time in the viewport when opened
  - Class: primary-user-loop
  - Why it matters: Opening the planner should show "now" — not midnight or the top of the day — so the user immediately sees what's happening right now
  - Source: user

### DRAG — Drag to Reschedule

- [ ] **DRAG-01** — User can drag a task block vertically to change its startAt, with the block snapping to 15-minute intervals during drag
  - Class: primary-user-loop
  - Why it matters: Rescheduling by dragging is the core interaction that makes a visual planner feel like Structured rather than a static display
  - Source: user

- [ ] **DRAG-02** — User can drag the bottom edge of a task block to resize its duration, snapping to 15-minute intervals
  - Class: primary-user-loop
  - Why it matters: Resizing duration inline is the natural complement to dragging — users need to adjust how long a task takes without opening an edit form
  - Source: user

- [ ] **DRAG-03** — Drag and resize changes are persisted to the backend on pointer/touch release with optimistic update and revert-on-failure
  - Class: core-capability
  - Why it matters: Changes must survive a session — an optimistic update with server sync ensures the UI feels instant while data is durable
  - Source: user

- [ ] **DRAG-04** — Drag and resize interactions handle both touch events (Capacitor mobile) and mouse events (Tauri desktop) via unified pointer event handlers
  - Class: core-capability
  - Why it matters: The app runs in both mobile WebView and desktop WebView — using pointer events ensures one implementation covers both input models without platform-specific code
  - Source: inferred

### EDIT — Tap to Edit

- [ ] **EDIT-01** — Tapping a task block (distinct from starting a drag) opens a bottom sheet pre-filled with the task's current title, startAt, and duration
  - Class: primary-user-loop
  - Why it matters: Tapping a block to edit it is the standard mobile planner interaction — it must be clearly distinct from a drag gesture (short tap vs sustained touch)
  - Source: user

- [ ] **EDIT-02** — Saving from the edit sheet updates the task optimistically in the timeline and syncs to the backend, reverting on failure
  - Class: core-capability
  - Why it matters: Consistent with the drag-persist pattern — all mutations go through the same optimistic update path
  - Source: user

### QC — Quick-Create Input UX

- [ ] **QC-01** — Time input in the create/edit sheet uses a scroll-wheel picker (hour and minute columns) rather than a text field
  - Class: primary-user-loop
  - Why it matters: Scroll-wheel time pickers are the dominant mobile time-entry pattern (iOS Clock, Structured) — they are faster and less error-prone than typing
  - Source: user

- [ ] **QC-02** — Duration input uses a stepper control (tap + / − in 15-minute increments) with a display showing the selected duration
  - Class: primary-user-loop
  - Why it matters: Duration is always a small set of values (15, 30, 45, 60 min…) — a stepper is more efficient than a text field or dropdown
  - Source: user

### WEEK — Weekly View Navigation

- [ ] **WEEK-01** — Weekly view has prev/next navigation controls to move between weeks
  - Class: core-capability
  - Why it matters: The current weekly view is locked to the current week — users cannot plan ahead or review past weeks
  - Source: user

- [ ] **WEEK-02** — A "Today" button in the weekly view returns to the current week from any week offset
  - Class: core-capability
  - Why it matters: After navigating to a future/past week, users need a fast way back to today without tapping prev/next repeatedly
  - Source: user

### NAV — App Navigation Restructure

- [ ] **NAV-01** — App uses a 3-tab bottom navigation bar: Planner | Inbox | Integrations
  - Class: core-capability
  - Why it matters: 5 top-level segmented tabs (Feed/Timeline/Planner/List/Week) is too many; the bottom tab pattern is the standard mobile primary navigation pattern (iOS, Android)
  - Source: user

- [ ] **NAV-02** — Planner tab shows the daily timeline view by default, with a Day / Week toggle control within the tab
  - Class: core-capability
  - Why it matters: The daily and weekly timeline views are variant views of the same planner context — they belong under one tab with an in-tab toggle, not as two top-level tabs
  - Source: user

- [ ] **NAV-03** — Inbox tab shows undated native tasks and integration-sourced items (Gmail flags, Microsoft tasks, Apple Calendar events) pending scheduling, with the ability to add a date and push the item to the Planner
  - Class: primary-user-loop
  - Why it matters: Structured's inbox model — a staging area where tasks live until they have a time — is the core workflow that connects task capture to the visual planner
  - Source: user

- [ ] **NAV-04** — Integrations tab shows connected accounts (Gmail, Microsoft, Apple Calendar) and sync status
  - Class: secondary
  - Why it matters: Surfacing integration health in a dedicated tab makes it discoverable and removes it from the main planning flow
  - Source: user

- [ ] **NAV-05** — On desktop viewport widths (≥768px), navigation renders as a left sidebar instead of a bottom tab bar
  - Class: core-capability
  - Why it matters: Bottom tabs are native to mobile but look awkward on wide desktop layouts in Tauri — a sidebar is the standard desktop navigation pattern
  - Source: user

## Future Requirements

- Drag task from Inbox onto the timeline to schedule it
- Haptic feedback on drag snap (Capacitor only)
- Conflict detection (overlapping task blocks)
- Recurring tasks

## Out of Scope — v1.1

- Native Capacitor/Tauri builds (browser verification only, per v1.0 precedent)
- Keyboard shortcut navigation (desktop polish — v1.2+)
- Offline mode
- Multi-day tasks spanning past midnight

## Traceability

| REQ-ID | Description | Phase | Status |
|--------|-------------|-------|--------|
| LAYOUT-01 | Block height proportional to duration | — | Pending |
| LAYOUT-02 | Block position correct time offset | — | Pending |
| LAYOUT-03 | Auto-scroll to current time on open | — | Pending |
| DRAG-01 | Drag block to change startAt | — | Pending |
| DRAG-02 | Drag bottom edge to resize duration | — | Pending |
| DRAG-03 | Persist drag/resize on release | — | Pending |
| DRAG-04 | Pointer events for touch + mouse | — | Pending |
| EDIT-01 | Tap block opens pre-filled edit sheet | — | Pending |
| EDIT-02 | Edit sheet saves optimistically | — | Pending |
| QC-01 | Scroll-wheel time picker | — | Pending |
| QC-02 | Duration stepper control | — | Pending |
| WEEK-01 | Prev/next week navigation | — | Pending |
| WEEK-02 | Today button in weekly view | — | Pending |
| NAV-01 | 3-tab bottom navigation | — | Pending |
| NAV-02 | Planner tab with Day/Week toggle | — | Pending |
| NAV-03 | Inbox tab as task staging area | — | Pending |
| NAV-04 | Integrations tab | — | Pending |
| NAV-05 | Sidebar nav on desktop viewport | — | Pending |
