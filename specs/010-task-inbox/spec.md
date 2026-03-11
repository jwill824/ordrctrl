# Feature Specification: Task Inbox

**Feature Branch**: `010-task-inbox`
**Created**: 2026-03-11
**Status**: Implemented
**GitHub Issue**: [#32](https://github.com/jwill824/ordrctrl/issues/32)

## Overview

When ordrctrl syncs tasks from external integrations (Gmail, Apple Calendar, Microsoft To Do, Apple Reminders), those tasks currently appear directly in the main feed. This creates a noisy, uncontrolled experience — the user has no chance to decide what belongs in their active workspace before it appears.

This feature introduces a **Task Inbox**: a staging area where all integration-sourced tasks land first. The user triages the inbox by accepting tasks into the feed or dismissing them. Native tasks created directly in ordrctrl bypass the inbox and go straight to the feed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Staged Tasks in Inbox (Priority: P1)

A user opens ordrctrl after their integrations have synced. Instead of new tasks appearing directly in the feed, they see an Inbox section showing all new items waiting for review, grouped by source integration.

**Why this priority**: This is the core of the feature. Without an inbox view, nothing else in this spec can function. It also immediately reduces feed noise — even if the user takes no action, at least unreviewed items are separated from the active feed.

**Independent Test**: Trigger a sync for any integration. Verify that new tasks appear in an Inbox area and NOT in the main feed. Delivers the "staging" promise of the feature on its own.

**Acceptance Scenarios**:

1. **Given** an integration sync completes with new tasks, **When** the user opens ordrctrl, **Then** new tasks appear in the Inbox, not the main feed.
2. **Given** the inbox has items, **When** the user views the inbox, **Then** items are grouped by source integration (e.g., "Gmail — work@example.com", "Apple Calendar").
3. **Given** the user creates a native task directly in ordrctrl, **When** the task is saved, **Then** it appears directly in the main feed, bypassing the inbox.
4. **Given** an integration item was previously accepted or dismissed, **When** that integration re-syncs, **Then** the same item does NOT re-appear in the inbox.

---

### User Story 2 - Triage Individual Tasks (Priority: P2)

A user reviews each item in their inbox and individually accepts or dismisses tasks. Accepted tasks move to the main feed. Dismissed tasks go to the dismissed archive (same as feed dismiss behavior today).

**Why this priority**: Individual triage is the primary interaction model. Bulk actions are useful but secondary — a user with a small inbox will always do item-by-item review first.

**Independent Test**: Accept one task from the inbox and verify it appears in the feed. Dismiss one task and verify it appears in the dismissed archive and not the feed.

**Acceptance Scenarios**:

1. **Given** an item is in the inbox, **When** the user accepts it, **Then** it moves to the main feed and is removed from the inbox.
2. **Given** an item is in the inbox, **When** the user dismisses it, **Then** it moves to the dismissed archive and is removed from the inbox.
3. **Given** an item has been accepted into the feed, **When** the user later dismisses it from the feed, **Then** it moves to the dismissed archive (same behavior as today).
4. **Given** an item is in the inbox, **When** the user dismisses it, **Then** it does NOT appear in the feed at any point.

---

### User Story 3 - Bulk Triage by Source (Priority: P3)

A user has many inbox items from one source and wants to accept or dismiss all of them at once, rather than reviewing one by one.

**Why this priority**: Power users with high-volume integrations (e.g., Gmail with many unread emails) need bulk actions to keep the inbox manageable. This is a quality-of-life improvement on top of P2.

**Independent Test**: With 5+ inbox items from a single source, use "Accept All" for that source. Verify all items move to the feed and the source group disappears from the inbox.

**Acceptance Scenarios**:

1. **Given** the inbox has multiple items from the same source, **When** the user selects "Accept All" for that source, **Then** all items from that source move to the feed.
2. **Given** the inbox has multiple items from the same source, **When** the user selects "Dismiss All" for that source, **Then** all items from that source move to the dismissed archive.
3. **Given** the inbox has items from multiple sources, **When** the user bulk-accepts one source, **Then** items from other sources remain in the inbox unaffected.

---

### User Story 4 - Inbox Count Badge in Navigation (Priority: P4)

A user sees at a glance how many items are waiting in their inbox via a badge or count in the navigation, without having to open the inbox page.

**Why this priority**: Visual cue drives engagement with the inbox. Without it, users may forget to check the inbox, defeating its purpose. Relatively low implementation cost for high awareness value.

**Independent Test**: Sync an integration that produces 3 new items. Verify the navigation shows a count of 3 on the Inbox entry. Accept one item. Verify the count drops to 2.

**Acceptance Scenarios**:

1. **Given** the inbox has unreviewed items, **When** the user views any page, **Then** the navigation shows a count of pending inbox items.
2. **Given** a user accepts or dismisses an item, **When** the action completes, **Then** the navigation count updates immediately.
3. **Given** the inbox is empty, **When** the user views any page, **Then** no badge or count is shown on the Inbox navigation item.

---

### Edge Cases

- What happens when an inbox item's source integration is disconnected before the user triages it? The item remains in the inbox and can still be accepted or dismissed.
- What happens when a task in the inbox matches a task the user already has in the feed (e.g., duplicate sync)? The duplicate should not appear in the inbox; de-duplication logic from prior sync specs applies.
- What happens when the inbox has hundreds of items from one integration? Items should be paginated or scrollable within the source group; no performance degradation.
- What if the user dismisses an item from the inbox, but the same email/event becomes unread/updated again in the source? It re-appears in the inbox as a new staging item (same behavior as today's re-sync logic for dismissed items).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST route all newly synced tasks from integrations to the inbox instead of directly to the main feed.
- **FR-002**: Native tasks created directly in ordrctrl MUST bypass the inbox and appear in the feed immediately.
- **FR-003**: The inbox MUST display items grouped by source integration, with the integration name and account identifier shown for each group.
- **FR-004**: Users MUST be able to accept an individual inbox item, moving it to the main feed.
- **FR-005**: Users MUST be able to dismiss an individual inbox item, moving it to the dismissed archive.
- **FR-006**: Users MUST be able to bulk-accept all items from a single source group.
- **FR-007**: Users MUST be able to bulk-dismiss all items from a single source group.
- **FR-008**: The navigation MUST display a count of pending (unreviewed) inbox items when the inbox is non-empty.
- **FR-009**: The navigation count MUST update immediately after any triage action (accept or dismiss).
- **FR-010**: Items that were previously accepted or dismissed MUST NOT re-appear in the inbox on subsequent syncs, unless the source item has changed (e.g., became unread again).
- **FR-011**: Tasks already in the feed prior to this feature being deployed MUST remain in the feed and are not retroactively moved to the inbox.

### Key Entities

- **InboxItem**: A staged task waiting for user review. References a sync cache item. Tracks status (pending, accepted, dismissed) and the timestamp it was staged. Belongs to a user.
- **SyncCacheItem** (existing): The underlying cached task from a sync operation. An inbox item is a view/wrapper over this.

### Assumptions

- Integration-sourced tasks that are currently in the feed at deploy time are grandfathered in and do not move to the inbox.
- The dismissed archive (`/settings/dismissed`) is the same destination as feed-level dismiss today — no new storage model is needed for dismissed inbox items.
- Inbox items inherit all display fields from their underlying sync cache item (title, due date, source label, integration icon).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero integration-sourced tasks appear in the main feed without explicit user acceptance from the inbox.
- **SC-002**: Users can triage a full inbox (accept or dismiss all items) in under 3 minutes for a typical daily batch of 20 or fewer items.
- **SC-003**: The inbox count in navigation is accurate within 1 second of any triage action completing.
- **SC-004**: Bulk accept/dismiss for a single source group completes in under 2 seconds regardless of item count.
- **SC-005**: No previously accepted or dismissed item re-appears in the inbox on subsequent syncs unless the source item genuinely changes state.
