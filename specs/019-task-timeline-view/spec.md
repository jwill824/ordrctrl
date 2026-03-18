# Feature Specification: Task Timeline View

**Feature Branch**: `019-task-timeline-view`
**Created**: 2026-03-17
**Status**: Draft
**GitHub Issue**: [#21](https://github.com/jwill824/ordrctrl/issues/21)

## Overview

ordrctrl's main feed shows all active tasks in a flat list, which works well for triaging but makes it hard to understand the shape of upcoming work over time. Users have no way to see what's due today vs. this week vs. later, or to identify gaps and clusters in their schedule.

This feature introduces a **Task Timeline View**: a chronological, date-grouped visualization of tasks. Users can see tasks organized by when they're due — past-due, today, this week, and later — giving a clear picture of workload distribution and helping users prioritize and plan without leaving ordrctrl.

## Clarifications

### Session 2026-03-17

- Q: Should the timeline show only tasks already accepted into the feed, or also Inbox items (pending triage) that have a due date? → A: Feed-only — timeline shows accepted tasks only; Inbox items are excluded.
- Q: How is the timeline view accessed/surfaced in navigation? → A: Platform-adaptive — swipe left/right gesture on mobile (iOS/Android); UI toggle (segmented control or equivalent) on desktop and web.
- Q: Should date groups be collapsible, and what is the default expand/collapse state? → A: Auto-collapse — "Overdue" and "Today" are always expanded by default; "This Week" and "Later" start collapsed; users can expand them by tapping the group header.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Tasks Organized by Due Date (Priority: P1)

A user switches to the timeline view and sees all their active feed tasks grouped into meaningful date buckets: overdue, due today, due this week, and due later. Tasks without a due date appear in a separate "Unscheduled" group at the end.

**Why this priority**: This is the foundational view. Without date grouping, the timeline has no meaning. It immediately answers the user's most common planning question: "What do I need to do and when?"

**Independent Test**: With a mix of tasks across multiple due dates in the feed, switch to timeline view and verify tasks appear in the correct date buckets. Delivers the core planning value on its own.

**Acceptance Scenarios**:

1. **Given** the user has active tasks with varied due dates, **When** they open the timeline view, **Then** "Overdue" and "Today" groups are fully expanded; "This Week" and "Later" groups are collapsed by default.
2. **Given** a task is past its due date, **When** the user views the timeline, **Then** that task appears in the "Overdue" group, visually distinguished from on-time tasks.
3. **Given** a task has no due date, **When** the user views the timeline, **Then** it appears in an "Unscheduled" section rather than being hidden.
4. **Given** a date group has no tasks, **When** the user views the timeline, **Then** that group is not shown (empty groups are hidden).
5. **Given** "This Week" or "Later" is collapsed, **When** the user taps the group header, **Then** the group expands to show all tasks within it.
6. **Given** the user completes or dismisses a task in the timeline view, **When** the action is confirmed, **Then** the task disappears from the timeline and the group updates or hides if now empty.

---

### User Story 2 - Navigate Between Timeline and Feed (Priority: P2)

A user can freely switch between the existing flat feed view and the new timeline view. On mobile (iOS/Android), swiping left on the feed enters the timeline; swiping right returns to the feed. On desktop and web, a UI toggle (e.g., segmented control) switches between the two views. Their preference is remembered across sessions.

**Why this priority**: The timeline is a complementary view, not a replacement. Users need to move fluidly between planning (timeline) and triage (feed). Persistence avoids re-navigating on every app open.

**Independent Test**: On mobile, swipe left on the feed to enter the timeline view; verify tasks match; swipe right to return. On desktop/web, use the toggle to switch views. Verify the chosen view persists after closing and reopening the app on each platform.

**Acceptance Scenarios**:

1. **Given** the user is in the feed view on mobile, **When** they swipe left, **Then** the timeline view slides in showing the same active tasks grouped by due date.
2. **Given** the user is in the timeline view on mobile, **When** they swipe right, **Then** the feed view slides back in.
3. **Given** the user is on desktop or web, **When** they use the feed/timeline toggle, **Then** the view switches between the flat list and the date-grouped timeline.
4. **Given** the user switches to timeline view, **When** they close and reopen the app, **Then** the timeline view is still active (preference persisted).
5. **Given** the user takes an action (complete or dismiss) in the timeline view, **When** they return to feed view, **Then** the feed reflects the same change.

---

### User Story 3 - Interact with Tasks Inline (Priority: P3)

A user can take the same actions on tasks in the timeline view as in the feed: complete, dismiss, open details. They do not need to leave the timeline to act on a task.

**Why this priority**: A read-only timeline has limited utility. Inline actions make the timeline a full first-class workspace, not just a planning dashboard. Builds on P1/P2.

**Independent Test**: In the timeline view, complete one task and dismiss another. Verify both actions complete successfully, the tasks are removed from the timeline, and the changes are reflected in the feed view.

**Acceptance Scenarios**:

1. **Given** a task is visible in the timeline, **When** the user marks it complete, **Then** it is removed from the timeline (and feed) immediately.
2. **Given** a task is visible in the timeline, **When** the user dismisses it, **Then** it moves to the dismissed archive and is removed from the timeline.
3. **Given** a task is visible in the timeline, **When** the user taps to open it, **Then** the task detail view opens (same as from the feed).

---

### User Story 4 - Filter Timeline by Source Integration (Priority: P4)

A user can narrow the timeline to show only tasks from a specific source integration (e.g., only Apple Calendar tasks, or only Apple Reminders), allowing focused planning per context.

**Why this priority**: Users managing tasks from multiple integrations benefit from context-specific planning. This is a refinement on top of the core timeline — valuable but not blocking initial delivery.

**Independent Test**: With tasks from at least two integrations in the timeline, apply a filter for one integration. Verify only tasks from that source are displayed across all date groups.

**Acceptance Scenarios**:

1. **Given** the timeline has tasks from multiple integrations, **When** the user applies a source filter, **Then** only tasks from the selected source are shown.
2. **Given** a source filter is active, **When** the user clears the filter, **Then** all tasks reappear across all groups.
3. **Given** a source filter is active and a date group has no matching tasks, **When** the filter is applied, **Then** that date group is hidden.

---

### Edge Cases

- What happens when all tasks are overdue? The "Overdue" group is shown; all other groups are hidden. The user sees the full overdue list with no "This Week" or "Later" noise.
- What happens when the user has no tasks at all? The timeline shows an empty state message indicating there are no tasks to display.
- What happens when a task's due date changes (e.g., updated in a source integration after sync)? The task moves to the correct date group on the next sync or page refresh.
- What happens when there are hundreds of tasks in one date group (e.g., many overdue)? Since "Overdue" and "Today" are always expanded, their content is scrollable with a sticky header. "This Week" and "Later" start collapsed, so large future task counts don't overwhelm the initial view; the user expands them deliberately.
- What happens when the device's date/time changes (timezone shift or manual adjustment)? The timeline re-calculates group membership based on the new local date/time on next view render.
- What happens when the user is offline? The timeline shows the last cached task state with a visual indicator that data may be stale.
- What happens on first launch before the user discovers the swipe gesture? A one-time hint or visual indicator (e.g., a peek animation or tooltip) is shown on the feed to signal the swipe affordance exists.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a timeline view accessible via lateral swipe on mobile (swipe left from feed → timeline; swipe right → feed) and via a UI toggle on desktop and web.
- **FR-001a**: The timeline view MUST only display tasks that have been accepted into the feed; Inbox items pending triage are explicitly excluded.
- **FR-002**: The timeline view MUST display active tasks grouped into the following date buckets: Overdue, Today, This Week, Later, and Unscheduled.
- **FR-003**: The "Overdue" group MUST include all tasks whose due date is before today's date and that are not yet completed or dismissed.
- **FR-004**: The "Today" group MUST include tasks due on the current calendar day.
- **FR-005**: The "This Week" group MUST include tasks due within the next 7 days (excluding today).
- **FR-006**: The "Later" group MUST include tasks due beyond the next 7 days.
- **FR-007**: The "Unscheduled" group MUST include tasks that have no due date.
- **FR-008**: Date groups with no tasks MUST be hidden from the timeline.
- **FR-009**: Users MUST be able to complete, dismiss, and open any task directly from the timeline view.
- **FR-010**: All task actions taken in the timeline view MUST be reflected in the feed view immediately.
- **FR-011**: The user's selected view (feed or timeline) MUST persist across app sessions.
- **FR-012**: Users MUST be able to switch between feed and timeline view without data loss or navigation disruption.
- **FR-013**: Users MUST be able to filter the timeline by source integration.
- **FR-014**: Overdue tasks MUST be visually distinguished from on-schedule tasks (e.g., distinct color, label, or icon).
- **FR-015**: Each date group header MUST remain visible (sticky) while the user scrolls through tasks within that group.
- **FR-016**: The "Overdue" and "Today" date groups MUST be expanded by default when the timeline view is opened.
- **FR-017**: The "This Week" and "Later" date groups MUST be collapsed by default when the timeline view is opened; each shows a task count in the header while collapsed.
- **FR-018**: Users MUST be able to expand or collapse the "This Week" and "Later" groups by tapping their header; collapse state resets to default each time the timeline view is opened.
- **FR-019**: The "Unscheduled" group MUST also be collapsed by default when the timeline view is opened.

### Key Entities

- **TimelineGroup**: A logical date bucket (Overdue, Today, This Week, Later, Unscheduled) that contains an ordered list of tasks. Derives its membership rules from the current date at render time.
- **Task** (existing): The active task record. The timeline reads the same task data as the feed — no new storage model is introduced. Due date is the primary sort/group key.

### Assumptions

- The timeline view reads directly from the existing active task set (feed tasks) — no separate data fetch or model is needed. Inbox items (pending triage) are not included.
- "This Week" means the next 7 calendar days after today, not the ISO calendar week boundary.
- Tasks within each date group are sorted by due date ascending (earliest first), then by title alphabetically for tasks sharing the same due date.
- The timeline view is available on all supported platforms (iOS, Android, web) from day one.
- Source integration filter options are the same list of connected integrations shown elsewhere in the app.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify all overdue and today's tasks within 10 seconds of opening the timeline view, without scrolling or filtering.
- **SC-002**: The timeline view loads and renders all task groups within 1 second on a standard connection for a typical task load (up to 200 tasks).
- **SC-003**: Task actions (complete, dismiss) taken in the timeline are reflected across all views within 1 second of the action completing.
- **SC-004**: 90% of users who try the timeline view use it at least once per week within the first month (measured by view engagement retention).
- **SC-005**: Users report a measurable reduction in missed or forgotten due dates compared to the flat feed view alone (target: 30% reduction in self-reported overdue surprise).
