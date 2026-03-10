# Feature Specification: Inbound Source Sync

**Feature Branch**: `007-source-sync`  
**Created**: 2026-03-10  
**Status**: Draft  
**Input**: Update tasks if the source task is completed or updated — when an integrated source (e.g. Gmail, Google Tasks, Microsoft Tasks, Apple Calendar) marks a task as complete or updates it, ordrctrl should reflect those changes in the feed so users always see an accurate view of their tasks.

## Overview

ordrctrl currently pulls tasks from connected sources on a recurring schedule. However, changes that happen in the source after a task is imported — such as a task being marked complete in Microsoft Tasks, an email being archived in Gmail, or a due date being changed — are not reliably reflected in the ordrctrl feed. Users end up seeing stale task state that doesn't match reality in the source system.

This feature ensures that when the source system changes a task (completion state or metadata), ordrctrl reflects that change on the next sync cycle — while continuing to respect any local user overrides made inside ordrctrl.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Source Completion Auto-Closes Task (Priority: P1)

A user completes a task directly in the source system (e.g., checks off a Microsoft Tasks item or archives a Gmail email). On the next sync, ordrctrl automatically marks the corresponding feed item as complete, so the user doesn't see a stale open task for work they've already done elsewhere.

**Why this priority**: The most disorienting experience for users is seeing tasks they've already handled still showing as open. This directly addresses the trust problem with the feed and is the core of this feature.

**Independent Test**: Connect a Microsoft Tasks integration. Import a task. Mark that task complete in Microsoft Tasks. After the next sync cycle, verify the task moves to the completed section in the ordrctrl feed.

**Acceptance Scenarios**:

1. **Given** a task from Microsoft Tasks is active in the ordrctrl feed, **When** the user marks that task complete in Microsoft Tasks and the next sync runs, **Then** the task moves to the completed section of the ordrctrl feed automatically.
2. **Given** a task from Apple Calendar appears in the feed, **When** the event passes its end date/time, **Then** the item is treated as no longer active on the next sync and no longer appears in the active feed.
3. **Given** a Gmail-sourced task is active in the ordrctrl feed, **When** the email is no longer in the Gmail inbox (archived or deleted — zero inbox), **Then** the item is no longer active in the ordrctrl feed after the next sync.
4. **Given** a user has configured their Gmail integration to treat "read" emails as complete, **When** the email is marked as read in Gmail and the next sync runs, **Then** the item is auto-completed in the ordrctrl feed.

---

### User Story 2 - User Override Preserved Against Source Completion (Priority: P1)

A user unchecked a completed task in ordrctrl (keeping it open intentionally). Later, the source system also marks it complete. ordrctrl must not auto-complete the item again because the user explicitly chose to keep it open.

**Why this priority**: This is equal priority to Story 1 because it protects the core product principle — ordrctrl is the user's workspace of record. Without this guard, the feature would actively work against user intent.

**Independent Test**: Mark a synced task complete in the source. Before the next sync, uncheck the task in ordrctrl. Trigger a sync. Verify the task remains open in ordrctrl.

**Acceptance Scenarios**:

1. **Given** a synced task has been manually reopened by the user in ordrctrl (a "Reopened Override" exists), **When** the source marks the task complete and the next sync runs, **Then** the task remains open in the ordrctrl feed and the user's override is preserved.
2. **Given** a synced task has been manually reopened by the user in ordrctrl, **When** the user completes the task themselves in ordrctrl, **Then** the Reopened Override is cleared and the task moves to completed as normal.

---

### User Story 3 - Source Metadata Updates Reflected in Feed (Priority: P2)

A user changes the title or due date of a task in the source system (e.g., renames a Microsoft Tasks task or changes its due date). On the next sync, the updated information appears in the ordrctrl feed.

**Why this priority**: Metadata freshness is important for planning and triage, but it is less disruptive than stale completion state. Changes in metadata don't cause active items to disappear or reappear — they just update in place.

**Independent Test**: Connect an integration with an active task. Change the task title in the source. After the next sync, verify the updated title appears in the ordrctrl feed.

**Acceptance Scenarios**:

1. **Given** an active task in the ordrctrl feed, **When** the source system updates the task title, **Then** the updated title is reflected in the feed after the next sync.
2. **Given** an active task with a due date in the ordrctrl feed, **When** the source system changes the due date, **Then** the updated due date is reflected in the feed after the next sync, and the task reorders appropriately by the new date.
3. **Given** a dismissed task (user has hidden it), **When** the source updates the task's metadata, **Then** the task remains dismissed — metadata updates do not restore dismissed items.

---

### Edge Cases

- What if a user enables "read = complete" for Gmail but then re-opens an email (marks it unread) — should that reopen the ordrctrl task? This is out of scope (source un-completion is explicitly excluded).
- What happens when a source task is deleted entirely (not completed, just removed)? The item should expire naturally from ordrctrl after the 24-hour cache window without re-appearing.
- What if a source sync fails mid-cycle — does a partial update leave inconsistent task state? The feed should only reflect changes from fully completed sync cycles.
- What if a user has both a Reopened Override and a Dismissed Override on the same item? Dismissed takes precedence — the item stays hidden from the active feed.
- What if source completion arrives for an item the user has already completed in ordrctrl? No change — the item was already in the completed section.
- What if source un-completes an item that ordrctrl shows as complete? ordrctrl completion state is not reversed by the source — ordrctrl is the workspace of record for completion.
- What if a title update from the source contains content that was previously the basis for deduplication? The deduplication check should re-evaluate on next feed build.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When the source system marks a task complete, the system MUST reflect that completion in the ordrctrl feed on the next successful sync cycle.
- **FR-002**: Source-driven completion MUST NOT override a user's Reopened Override — if the user manually unchecked a task in ordrctrl, it must remain open regardless of source state.
- **FR-003**: Source-driven completion MUST NOT override a user's own completion action in ordrctrl — if the user already completed the task in ordrctrl, no change occurs.
- **FR-004**: When the source system updates a task's title or due date, the system MUST reflect the updated values in the feed on the next successful sync cycle.
- **FR-005**: Metadata updates from the source MUST NOT restore items that the user has dismissed.
- **FR-006**: Source-driven changes MUST only be applied when a full sync cycle completes successfully — partial or failed syncs MUST NOT produce inconsistent task state.
- **FR-007**: If a source task is removed or no longer returned by the source (rather than explicitly completed), the item MUST expire from ordrctrl naturally without requiring explicit user action.
- **FR-008**: The feed MUST reflect source-driven completion and metadata changes within one sync cycle of the change occurring in the source.
- **FR-009**: Source completion state MUST be tracked independently from the user's local completion state so the system can correctly apply override logic.
- **FR-010**: For Gmail integrations, the default completion trigger MUST be when an email is no longer present in the inbox (archived or deleted), aligning with a zero-inbox workflow.
- **FR-011**: Gmail integrations MUST support a configurable option where marking an email as "read" is treated as a completion trigger, in addition to the default archive/delete behavior.

### Key Entities

- **Synced Task**: A task imported from an external source integration. Carries both a "source completion state" (what the source currently reports) and an "ordrctrl completion state" (what the user has set locally). These may differ.
- **Source Completion State**: Whether the source system considers a task complete. Reported by the integration on each sync. Used to auto-complete the task in ordrctrl unless a Reopened Override exists.
- **Reopened Override**: A record of the user's explicit intent to keep a task open in ordrctrl. Prevents source completion from closing the task. Cleared when the user completes the task themselves.
- **Dismissed Override**: A record of the user's choice to hide a task from the active feed. Survives metadata updates and source completion events — dismissed items stay hidden.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a task is marked complete in a connected source, the corresponding ordrctrl feed item reflects that completion within one sync cycle (15 minutes or less under normal conditions).
- **SC-002**: 100% of tasks with an active Reopened Override remain open after a source completion event — no Reopened Overrides are silently cleared by source sync.
- **SC-003**: After a task's title or due date changes in a connected source, the updated value appears in the ordrctrl feed within one sync cycle.
- **SC-004**: Dismissed tasks are never restored to the active feed as a result of source metadata changes or source completion events.
- **SC-005**: Users report that the ordrctrl feed accurately reflects the state of their tasks across all connected sources after the feature is delivered.

## Assumptions

- The 15-minute recurring sync cadence remains unchanged — source state changes will be visible after the next scheduled sync fires, not in real time.
- For Gmail integrations, "completion" defaults to the email no longer being in the inbox (archived or deleted), aligning with zero-inbox philosophy. Users may optionally configure "read" emails to also be treated as complete.
- For sources without an explicit completion boolean (e.g., Apple Calendar events), "completion" is determined by the item naturally falling outside the integration's configured window (e.g., a past event is no longer returned by the adapter).
- Gmail completion semantics are subject to clarification (see FR-001 acceptance scenario 3 and the open clarification marker above). The assumption is that a Gmail message that no longer matches the sync filter (e.g., it has been read and is no longer unread/starred) is treated as "no longer actionable" and will expire from ordrctrl naturally via the 24-hour TTL.
- Source un-completion (source marks a previously-complete task as open again) is out of scope for this feature. ordrctrl completion state is not reversed by source changes.
- This feature is a prerequisite for full two-way sync (issue #10) but does not itself write any data back to source systems.

## Dependencies

- **spec 002 (Uncheck Completed Tasks)**: The Reopened Override entity and logic defined there is the foundation for override-aware source completion. This feature extends that model.
- **spec 003 (Selective Import)**: Source sync filtering (sub-sources, import settings) must be respected when evaluating which items are eligible for state updates.
- **Issue #10 (Two-Way Sync)**: This feature delivers the inbound half of the sync loop. Two-way sync will later add the outbound half.
