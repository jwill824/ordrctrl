# Feature Specification: Uncheck Completed Tasks

**Feature Branch**: `002-uncheck-completed`
**Created**: 2026-03-06
**Status**: Complete
**Input**: Allow completed issues to be unchecked

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reopen a Native Task (Priority: P1)

A user marked a natively-created ordrctrl task as complete by mistake, or circumstances have
changed and the task needs to be revisited. They open the Completed section, find the task,
and uncheck it to move it back into the active feed.

**Why this priority**: Native tasks are fully owned by ordrctrl, so this is the simplest and
most unambiguous case. It must work first before handling integration-sourced items.

**Independent Test**: Can be fully tested by creating a native task, marking it complete,
then unchecking it from the Completed section — without any integrations connected. Delivers
a working reopen flow.

**Acceptance Scenarios**:

1. **Given** a user has at least one item in the Completed section, **When** they uncheck the
   item's checkbox, **Then** the item is removed from the Completed section and reappears in
   the active feed.
2. **Given** a reopened task in the active feed, **When** the user views the task, **Then** it
   appears as an open, incomplete item with no completed styling.
3. **Given** a user who unchecked a task, **When** they navigate away and return, **Then** the
   task remains in the active feed (the state is persisted).
4. **Given** the Completed section is open, **When** a user unchecks the last completed item,
   **Then** the Completed section collapses or shows an empty state gracefully.

---

### User Story 2 - Reopen an Integration-Sourced Task (Priority: P2)

A user marked a synced task (from Gmail, Apple Reminders, Microsoft Tasks, or Apple Calendar)
as complete within ordrctrl. They later decide to reopen it in the feed. Because sync is
one-way (ordrctrl reads from integrations but does not write back), unchecking restores the
item's visible status in ordrctrl only.

**Why this priority**: Integration tasks make up the majority of a user's feed, so supporting
reopen for synced items delivers high value. The one-way sync constraint must be clearly
communicated.

**Independent Test**: Can be tested with any connected integration by marking a synced item
complete, then unchecking it. The item should reappear in the active feed without any changes
in the source system.

**Acceptance Scenarios**:

1. **Given** a completed integration-sourced task in the Completed section, **When** the user
   unchecks it, **Then** the item moves back to the active feed and displays its source
   integration badge.
2. **Given** a reopened integration-sourced task, **When** the next background sync runs,
   **Then** the task's open status in ordrctrl is preserved (the sync does not re-complete it
   unless the source still marks it complete).
3. **Given** a user unchecking a synced task, **When** the reopen action occurs, **Then** a
   brief inline notice informs the user that this change is local to ordrctrl and will not
   update the source application.
4. **Given** a source integration still shows the task as complete, **When** sync runs after
   the user has reopened it in ordrctrl, **Then** the user's local reopen is preserved —
   ordrctrl acts as the personal workspace of record and a user action always takes
   precedence over the source system's state.

---

### Edge Cases

- What happens when a user unchecks a task and then immediately rechecks it? The task should
  toggle back to complete and return to the Completed section without error.
- What happens if the Completed section is collapsed when a user reopens a task via keyboard
  or accessibility shortcut? The Completed section should open first before the item moves.
- How does the system handle unchecking a task that was completed during the current session
  vs. a previous session? Behavior should be identical in both cases.
- What if connectivity is lost when the user attempts to uncheck a task? The action should
  fail gracefully with a user-friendly error and the item should remain in the Completed
  section until the action succeeds.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to uncheck any item in the Completed section to move it back
  to the active feed.
- **FR-002**: The system MUST persist the reopened state of a task across page refreshes and
  sessions.
- **FR-003**: When unchecking an integration-sourced task, the system MUST display an inline
  notice informing the user the change is local to ordrctrl only.
- **FR-004**: Reopened integration-sourced tasks MUST retain their source integration badge
  and metadata in the active feed.
- **FR-005**: When a sync cycle runs after a user has manually reopened a synced task, the
  system MUST preserve the user's local override — the source system's completion state MUST
  NOT overwrite a user's explicit reopen action.
- **FR-006**: If the Completed section is empty after unchecking the last item, the section
  MUST collapse or display a clear empty state without layout errors.
- **FR-007**: The uncheck interaction MUST be accessible via keyboard and screen readers
  (same pattern as the check interaction).
- **FR-008**: Unchecking a task MUST be reversible — the user can re-check it at any time to
  move it back to the Completed section.

### Key Entities

- **Task**: Represents a single actionable item in the feed. Has a completion status
  (open/complete), a source (native or integration name), and associated metadata. This
  feature adds the concept of a user-overridden status distinct from the source system's
  status.
- **Sync Override**: A record indicating the user has manually changed the completion state
  of an integration-sourced task, allowing the sync engine to respect the user's intent.

### Assumptions

- The Completed section already exists as a collapsible section at the bottom of the feed
  (established in MVP).
- Sync is currently one-way: ordrctrl reads from integrations but does not write back.
  This feature does not change that constraint.
- The uncheck affordance (checkbox) is the same UI element used to mark items complete,
  simply toggled in reverse.
- Task completion state is stored per-user in ordrctrl's data layer and is not derived
  solely from the source system's state.
- **ordrctrl is the personal workspace of record**: user actions always take precedence
  over source system state. The `Sync Override` entity is designed to be extensible —
  when two-way sync is introduced in a future feature, override records can become
  pending write-back items to push user intent back to the source system.
- Selective import of tasks per integration (choosing which tasks to pull in) is
  out of scope for this feature and should be specified separately (see issue #11).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can reopen a completed task in under 5 seconds from opening the
  Completed section.
- **SC-002**: 100% of reopened native tasks appear in the active feed immediately with no
  page reload required.
- **SC-003**: 100% of reopened tasks persist their open state across sessions.
- **SC-004**: The inline notice for integration-sourced tasks is displayed on every uncheck
  action with zero false negatives.
- **SC-005**: Zero layout errors or empty-state failures occur when the last completed item
  is unchecked.
