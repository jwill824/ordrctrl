# Feature Specification: Clear Completed Tasks

**Feature Branch**: `008-clear-completed`  
**Created**: 2026-03-10  
**Status**: Complete  
**GitHub Issue**: [#20](https://github.com/jwill824/ordrctrl/issues/20)

## Overview

Users accumulate completed tasks in their feed over time — both from manually checking off items and from automatic source-sync completion (spec 007). Without a way to clear them in bulk, the completed section becomes a growing backlog that clutters the workspace. This feature adds a "Clear completed" action that sweeps all completed items out of the active feed in a single gesture, sending them to the dismissed items archive where they remain individually restorable.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Clear All Completed Tasks at Once (Priority: P1)

A user has several completed tasks accumulating in the "Completed" section of their feed. They want to clean up their workspace by clearing all completed items at once rather than dismissing each one individually.

**Why this priority**: This is the core value of the feature. Once completed items can auto-accumulate via source sync (spec 007), users need a single-action way to sweep them away.

**Independent Test**: Can be fully tested by completing 3+ tasks, pressing "Clear completed," and verifying the completed section is empty and items appear in dismissed items. Delivers a clean workspace independently.

**Acceptance Scenarios**:

1. **Given** the feed has one or more completed tasks, **When** the user presses "Clear completed," **Then** all completed tasks are immediately removed from the feed and the completed section disappears.
2. **Given** the user clears completed tasks, **When** they visit the dismissed items page, **Then** all previously completed tasks appear there and can be individually restored.
3. **Given** the feed has zero completed tasks, **When** the user views the feed, **Then** the "Clear completed" action is not shown (or is disabled).
4. **Given** the user has both native (manually created) and integration-backed completed tasks, **When** they clear completed, **Then** both types are cleared together.

---

### User Story 2 — Confirmation and Feedback (Priority: P1)

After pressing "Clear completed," the user receives immediate visual feedback confirming the action occurred and knows how to recover items if the action was accidental.

**Why this priority**: Without feedback, users won't trust the action and may fear permanent data loss. Equally critical to US1 — a clear action with no feedback is an incomplete experience.

**Independent Test**: Can be fully tested by verifying a confirmation message appears after clearing, showing the correct count and a path to dismissed items.

**Acceptance Scenarios**:

1. **Given** the user clears completed tasks, **When** the action completes, **Then** a confirmation message appears indicating how many items were cleared and that they can be found in dismissed items.
2. **Given** the user sees the confirmation message, **When** they navigate to dismissed items, **Then** all cleared tasks are present and restorable individually.
3. **Given** the clearing action fails (e.g., network error), **When** the error occurs, **Then** the user sees an error message and the feed state is unchanged.

---

### User Story 3 — Auto-Clear Completed Tasks After a Set Period (Priority: P2)

A user who uses inbox-zero style workflows wants completed tasks to automatically clear themselves after a defined time period, so the feed stays clean without any manual action.

**Why this priority**: Natural progression for power users; reduces ongoing manual maintenance. Lower priority than manual clear since the manual action covers the immediate user need.

**Independent Test**: Can be tested by enabling auto-clear with a 1-day window, marking a task complete, simulating 24 hours elapsing, and verifying the task moves to dismissed items on the next feed refresh.

**Acceptance Scenarios**:

1. **Given** auto-clear is enabled with a 1-day window, **When** a task has been in the completed state for 24 hours, **Then** it is automatically moved to dismissed items on the next feed refresh.
2. **Given** auto-clear is enabled, **When** the user manually clears completed items before the auto-clear fires, **Then** the auto-clear does not attempt to clear already-dismissed items again.
3. **Given** auto-clear is disabled (default), **When** a task is completed, **Then** it remains in the completed section indefinitely until manually cleared.
4. **Given** the user has auto-clear enabled, **When** they view feed settings, **Then** the configured window (e.g., "1 day," "7 days") is visible and editable.

---

### Edge Cases

- What happens when the user clears completed tasks while a sync is in progress? Items completed by an in-flight sync after the clear completes are not affected — they appear in the completed section normally.
- What if a completed item has a REOPENED override (user previously reopened it)? It is treated as an active task and must not be cleared.
- What if there are hundreds of completed items? The clear action must complete reliably regardless of count.
- What if the user dismisses a completed item individually and then presses "Clear completed"? Already-dismissed items are unaffected; only remaining completed items in the feed are cleared.
- What if auto-clear is enabled and the user re-opens a completed task before the window expires? The item is no longer eligible for auto-clear until it is completed again.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to clear all completed tasks from the feed in a single action.
- **FR-002**: The "Clear completed" action MUST be accessible from the completed section header in the feed view.
- **FR-003**: The "Clear completed" action MUST NOT appear (or MUST be disabled) when there are no completed tasks in the feed.
- **FR-004**: Cleared tasks MUST be sent to dismissed items, where they remain individually restorable.
- **FR-005**: The system MUST display a confirmation message after clearing, indicating how many items were cleared and where to find them.
- **FR-006**: The clear action MUST include all completed items: both manually completed and source-sync completed tasks.
- **FR-007**: Completed items with an active REOPENED override MUST NOT be cleared — they are treated as active tasks.
- **FR-008**: Users MUST be able to enable an optional auto-clear window that automatically clears completed tasks after a configurable period.
- **FR-009**: Auto-clear MUST be disabled by default — users explicitly opt in.
- **FR-010**: When auto-clear fires, affected items MUST be sent to dismissed items (same behavior as manual clear — not permanent deletion).
- **FR-011**: The auto-clear setting MUST be configurable from within the app (feed settings or preferences).

### Key Entities

- **Completed Task**: Any feed item (native or integration-backed) where the task is marked complete and no active REOPENED override exists.
- **Clear Event**: A user-initiated or time-triggered action that bulk-dismisses all current completed tasks.
- **Auto-Clear Window**: A user-configurable time duration after which completed tasks are automatically cleared. Stored per user. Default: disabled.

## Assumptions

- "Clearing" maps to the existing dismiss behavior — items go to dismissed items, not permanent deletion. This is consistent with the current dismiss/restore pattern and preserves safety.
- Auto-clear window options: disabled (default), 1 day, 3 days, 7 days, 30 days.
- Auto-clear fires during the normal sync cycle (≤ 15 min cadence), not via a separate scheduled job.
- The auto-clear window is measured from the `completedAt` timestamp on each item individually — items age out on their own schedule.
- Items re-opened by a REOPENED override before auto-clear fires are not cleared until they are completed again.

## Out of Scope

- Permanently deleting completed tasks (no hard delete, no recycle bypass).
- Selectively clearing a subset of completed tasks by source, date range, or type.
- Bulk-restoring cleared items from dismissed items — individual restore remains the supported flow.
- Push notification or email when auto-clear fires.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can clear all completed tasks in a single action with zero additional steps beyond pressing "Clear completed."
- **SC-002**: Cleared tasks appear in dismissed items within 2 seconds of the action completing.
- **SC-003**: The confirmation message displays the correct count of cleared items 100% of the time.
- **SC-004**: Zero completed tasks with an active REOPENED override are inadvertently cleared.
- **SC-005**: Auto-clear fires within one sync cycle (≤ 15 minutes) of a configured window expiring.
- **SC-006**: The "Clear completed" action reliably handles feeds with 100+ completed items without failure or partial state.
