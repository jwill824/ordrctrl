# Feature Specification: Feed UX Enhancements & Cleanup

**Feature Branch**: `011-feed-ux-enhancements`  
**Created**: 2025-07-23  
**Status**: Complete  
**GitHub Issues**: #29, #33, #34, #35, #36

## Overview

This feature consolidates five related UX improvements to the feed experience: removing a non-functional onboarding page, redesigning the dismissed items workflow, organizing feed tasks into date-based sections, fixing stale date/time display on refresh, and enabling users to add or edit due dates on tasks.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Remove Onboarding Page (Priority: P1)

A user who navigates to the onboarding route should be automatically redirected to an appropriate destination rather than seeing a page that offers no value.

**Why this priority**: Dead-end or confusing routes erode trust immediately. Removing the page eliminates a known pain point with no risk of regressions.

**Independent Test**: Can be fully tested by navigating to the onboarding URL and confirming the redirect destination is correct.

**Acceptance Scenarios**:

1. **Given** a user navigates directly to the onboarding route, **When** the page loads, **Then** the user is automatically redirected to the feed page (or sign-in page if unauthenticated).
2. **Given** any internal link previously pointing to the onboarding route, **When** the user clicks it, **Then** the user lands on the correct redirect destination and does not see a 404 or empty page.
3. **Given** an unauthenticated user who reaches the onboarding route, **When** the redirect fires, **Then** the user is sent to the sign-in page, not the feed.

---

### User Story 2 - Fix Task Date/Time Staleness on Refresh (Priority: P2)

A user views the feed and expects that any displayed due dates or event times reflect the most current values from the source, not the values captured at the time of the original sync.

**Why this priority**: Stale dates are silently wrong and directly mislead users about when tasks are due. This degrades the reliability of the entire feed.

**Independent Test**: Can be fully tested by observing a task whose due date has changed since it was last synced, triggering a refresh, and confirming the displayed date updates.

**Acceptance Scenarios**:

1. **Given** a task was synced with a due date of Monday, **When** the source system updates the due date to Wednesday, **Then** after the next automatic refresh the feed displays Wednesday.
2. **Given** a task with a due date visible on the feed, **When** the user manually triggers a refresh, **Then** all date/time fields on tasks reflect the latest values from the source.
3. **Given** a task that originally had no due date but the source system added one, **When** the feed refreshes, **Then** the task now shows the new due date.
4. **Given** a task whose source due date was removed, **When** the feed refreshes, **Then** the due date is no longer displayed on that task.

---

### User Story 3 - Feed Sections by Date (Priority: P3)

A user views the main feed and can immediately distinguish tasks that have a specific due date or time from tasks that have no date. Tasks are organized into clear sections to aid prioritization.

**Why this priority**: Without date-based grouping, all tasks appear undifferentiated, making it hard to focus on what is time-sensitive.

**Independent Test**: Can be fully tested by loading the feed with a mix of dated and undated tasks and verifying that two distinct sections appear with tasks sorted appropriately within each.

**Acceptance Scenarios**:

1. **Given** the feed contains tasks with and without due dates, **When** a user opens the feed, **Then** tasks are displayed in at least two sections: one for tasks with a due date/time and one for tasks with no date.
2. **Given** the dated tasks section, **When** a user views it, **Then** tasks within that section are ordered chronologically by due date (soonest first).
3. **Given** a task with no due date, **When** the user views the feed, **Then** it appears in the undated section and not in the dated section.
4. **Given** the optional side navigation by integration source, **When** a user selects a specific integration (e.g., GitHub, Google Calendar), **Then** the feed filters to show only tasks from that integration, while preserving the date-based grouping within the filtered view.
5. **Given** a section has no tasks (e.g., no undated tasks), **When** the feed loads, **Then** the empty section is not shown, or it shows an appropriate empty state message.

---

### User Story 4 - Update Dismissed Workflow (Priority: P4)

A user who has dismissed tasks can view those dismissed items directly within the feed via a URL toggle, and can permanently delete any dismissed item they no longer want to keep.

**Why this priority**: Moving dismissed items inline reduces context-switching and the permanent delete action gives users full control over their task list.

**Independent Test**: Can be fully tested by dismissing a task, navigating to `/feed?showDismissed=true` via the dismissed items menu entry, confirming the item appears, and then permanently deleting it.

**Acceptance Scenarios**:

1. **Given** a user has previously dismissed one or more tasks, **When** the user clicks the dismissed items menu entry, **Then** they are taken to `/feed?showDismissed=true` and dismissed tasks appear inline on the feed.
2. **Given** the user is on `/feed?showDismissed=true`, **When** they remove the query param or navigate away, **Then** the dismissed items are hidden and the normal feed is shown.
3. **Given** a dismissed task is visible in the dismissed view, **When** the user chooses to permanently delete it, **Then** the task is immediately removed from the dismissed list and cannot be recovered.
4. **Given** the old route `/settings/dismissed`, **When** a user navigates to it, **Then** they are redirected to `/feed?showDismissed=true`.
5. **Given** the feed is in normal view (no `showDismissed` param), **When** a user dismisses a task, **Then** the task disappears from the normal feed and would appear under the dismissed view.
6. **Given** a dismissed task is visible, **When** the user chooses to un-dismiss (restore) it, **Then** it returns to the normal feed. *(Assumption: restore action is preserved as a complement to permanent delete.)*

---

### User Story 5 - Edit and Assign Due Dates on Tasks (Priority: P5)

A user can directly edit a task in the feed to add a new due date or change an existing one, and the change is immediately reflected in the feed without requiring a full sync.

**Why this priority**: Without the ability to assign due dates, tasks without source-provided dates remain permanently undated even if the user knows when they need to act. This closes a significant gap for tasks from integrations that do not carry date metadata.

**Independent Test**: Can be fully tested by opening a task that has no due date, adding a due date via the edit action, and confirming the task moves to the dated section of the feed immediately.

**Acceptance Scenarios**:

1. **Given** a task in the feed (synced or native), **When** the user opens the edit action for that task, **Then** they can set or change a due date using a date/time picker.
2. **Given** a user has set a due date on a task, **When** the edit is saved, **Then** the feed immediately reflects the updated date without requiring a manual refresh.
3. **Given** a task with a user-assigned due date, **When** the source system also provides a due date on the next sync, **Then** the system uses the source due date (source is authoritative) unless the source has no date, in which case the user-assigned date is preserved.
4. **Given** a task with a user-assigned due date, **When** the user edits the task and removes the due date, **Then** the task moves to the undated section of the feed.
5. **Given** a user assigns a due date in the past, **When** the edit is saved, **Then** the task is accepted and displayed normally (no blocking error), though the system may display a visual indicator that the date has passed.

---

### Edge Cases

- What happens when a task's source system is temporarily unavailable during refresh? The feed should display the last-known values and not clear existing dates.
- What happens when a user navigates to the onboarding route while mid-session? They should be redirected without losing their session state.
- What happens when a user assigns a due date to a task and the source later removes the date? Source removal overrides the user-assigned date on the next sync.
- What happens when all tasks in the feed have been dismissed? The normal feed shows an appropriate empty state message.
- What happens when the `showDismissed` query param is present but the user has no dismissed items? An empty state message is shown within the feed.
- What happens if a user attempts to edit the due date of a read-only synced task that the source does not support date changes for? The user-assigned date is stored locally and the source is not modified.

## Requirements *(mandatory)*

### Functional Requirements

**Onboarding Removal**

- **FR-001**: The system MUST redirect users who navigate to the onboarding route to the main feed page (if authenticated) or the sign-in page (if unauthenticated).
- **FR-002**: The onboarding route MUST no longer render any page content.

**Date/Time Staleness Fix**

- **FR-003**: On every automatic feed refresh, the system MUST update all date/time fields (due dates, event times) on each task to reflect the latest values returned from the source.
- **FR-004**: On every manual feed refresh, the system MUST update all date/time fields with the latest values from the source.
- **FR-005**: If the source removes a date/time from a task, the system MUST remove that date/time from the task's display on the next refresh.
- **FR-006**: If the source adds a date/time to a previously undated task, the system MUST display that date/time on the next refresh.

**Feed Sections by Date**

- **FR-007**: The main feed MUST display tasks in at least two visually distinct sections: one for tasks with a due date/time and one for tasks without any date.
- **FR-008**: Tasks in the dated section MUST be ordered chronologically by due date, with the soonest due date appearing first.
- **FR-009**: Empty sections (no tasks to display) MUST either be hidden or display a clear empty state message.
- **FR-010**: The feed MAY provide an optional side navigation that allows users to filter tasks by integration source, while preserving date-based grouping.

**Dismissed Workflow**

- **FR-011**: The dismissed items menu entry MUST navigate the user to `/feed?showDismissed=true`.
- **FR-012**: When the `showDismissed=true` query param is present, the feed MUST display dismissed tasks inline.
- **FR-013**: When the `showDismissed=true` query param is absent or removed, dismissed tasks MUST NOT appear in the feed.
- **FR-014**: Users MUST be able to permanently delete a dismissed task, which removes it from the system entirely.
- **FR-015**: The route `/settings/dismissed` MUST redirect to `/feed?showDismissed=true`.
- **FR-016**: The existing dismiss action (soft dismiss) MUST continue to work; permanent delete is an additional action.

**Edit and Assign Due Dates**

- **FR-017**: Users MUST be able to open an edit action on any task in the feed (both synced tasks and native tasks) to add or change a due date.
- **FR-018**: When a due date edit is saved, the feed MUST immediately reflect the updated due date without requiring a full refresh.
- **FR-019**: A user-assigned due date on a task MUST be overridden by the source-provided due date on the next sync, if the source provides one.
- **FR-020**: If the source does not provide a due date, a user-assigned due date MUST be preserved across syncs.
- **FR-021**: Users MUST be able to remove a user-assigned due date from a task, moving it back to the undated section of the feed.

### Key Entities

- **Task**: A unit of work displayed in the feed. Attributes relevant here: due date/time (source-provided or user-assigned), dismissed status, integration source, date last synced.
- **Dismissed Task**: A task that has been soft-dismissed by the user. Retains all task data. Can be restored or permanently deleted.
- **User-Assigned Due Date**: A due date set by the user on a task, distinct from the source-provided date. Stored separately to allow correct merge logic during sync.
- **Feed View State**: The current display configuration of the feed, including the `showDismissed` query param and any active integration filter from side navigation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users navigating to the onboarding route reach a valid destination within one second and never encounter a blank or error page.
- **SC-002**: After any feed refresh (automatic or manual), all task date/time values displayed match the values currently held by the source system.
- **SC-003**: The main feed presents tasks in clearly labeled date-based sections that a new user can immediately understand without instructions.
- **SC-004**: Users can reach their dismissed items in two interactions or fewer from any point in the application.
- **SC-005**: Users can permanently delete a dismissed task in one interaction from the dismissed items view.
- **SC-006**: Users can add or change a due date on any feed task in under 30 seconds, with the change visible in the feed immediately after saving.
- **SC-007**: The feed date sections correctly categorize 100% of tasks (no task appears in the wrong section after a refresh or edit).

## Assumptions

- The application already has a concept of "dismissed" tasks and a "dismissed items" menu entry; this feature moves and extends that concept rather than creating it from scratch.
- "Native tasks" are tasks created directly within the application, as opposed to tasks synced from external integrations.
- Source systems are considered authoritative for date/time data; user-assigned dates are a local override used only when the source provides no date.
- The optional side navigation by integration source is a lower-priority enhancement within this feature and may be deferred if scope requires it.
- Restoring a dismissed task (un-dismissing) is an existing or implied capability; permanent delete is an additive action alongside it.
- The date/time picker for editing due dates will support at minimum a date selection; time-of-day selection is assumed to be included but is not strictly required for the first iteration.
