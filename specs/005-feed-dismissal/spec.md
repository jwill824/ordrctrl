# Feature Specification: Per-Item Feed Dismissal

**Feature Branch**: `005-feed-dismissal`  
**Created**: 2026-03-10  
**Status**: Complete  
**Input**: Per-item feed dismissal: allow users to permanently hide individual feed items from their ordrctrl feed. Extends the SyncOverride model with a DISMISSED override type. Users can dismiss any feed item with a single action, the item is permanently hidden from the feed and never reappears on future syncs. Users should be able to undo a dismissal. Dismissed items should not count toward any task metrics.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Dismiss a Feed Item (Priority: P1)

A user sees a feed item they want to permanently remove — it's irrelevant, already handled elsewhere, or simply noise. They dismiss it with a single action. The item disappears from their feed immediately and does not reappear on subsequent syncs, even if the source still contains the underlying task or event.

**Why this priority**: The core value of ordrctrl is a clean, actionable feed. Without dismissal, users have no way to remove permanently irrelevant items — every sync re-surfaces noise they've already decided to ignore. This is the minimum viable feature.

**Independent Test**: Open the feed → dismiss any item → verify it disappears immediately → trigger a manual sync → verify the item does not reappear in the feed.

**Acceptance Scenarios**:

1. **Given** a user viewing their feed with one or more items, **When** they dismiss a specific item, **Then** that item disappears from the feed immediately without a page reload.
2. **Given** a user who dismissed a feed item, **When** a sync runs and the source still contains the underlying task, **Then** the dismissed item does not reappear in the feed.
3. **Given** a user who dismissed a feed item, **When** they view the feed on a different device or browser session, **Then** the dismissed item remains hidden.
4. **Given** a user who dismisses an item, **When** the dismiss action is in progress, **Then** the item is visually removed optimistically (before server confirmation) and restored if the action fails.

---

### User Story 2 — Undo a Dismissal (Priority: P2)

A user accidentally dismisses a feed item, or changes their mind. They can undo the dismissal, restoring the item to their feed. The undo option is available immediately after dismissal while still on the same view.

**Why this priority**: Dismissal is a permanent action with no obvious recovery path. An undo affordance prevents frustration from mis-taps and makes users more confident using the dismiss action at all. Without it, users will be hesitant to dismiss items.

**Independent Test**: Dismiss a feed item → immediately undo the dismissal → verify the item is restored to the feed → trigger a sync → verify the item continues to appear normally.

**Acceptance Scenarios**:

1. **Given** a user who just dismissed a feed item, **When** they activate the undo option, **Then** the item is immediately restored to the feed in its original position or near the top.
2. **Given** a user who dismissed an item and the undo window has passed (navigated away or dismissed the undo prompt), **When** they view the feed, **Then** no undo option is shown and the item remains hidden.
3. **Given** a user who restores a dismissed item via undo, **When** a sync runs, **Then** the item continues to appear normally in the feed as if it was never dismissed.

---

### User Story 3 — View and Manage Dismissed Items (Priority: P3)

A user who has dismissed items over time wants to review what they've hidden, and optionally restore specific items. They can access a list of all dismissed items from their settings or feed preferences, and restore any of them individually.

**Why this priority**: For users who dismiss many items, the ability to audit and recover dismissed content is important for long-term trust. However, the immediate dismiss and undo flows (P1/P2) cover the vast majority of use cases — this is a power-user recovery path.

**Independent Test**: Dismiss 3+ items across different integrations → navigate to dismissed items view → verify all 3 appear → restore one → verify it reappears in the feed on next sync.

**Acceptance Scenarios**:

1. **Given** a user who has dismissed one or more feed items, **When** they navigate to the dismissed items section in settings, **Then** they see a list of all dismissed items with their title, source integration, and dismissal date.
2. **Given** a user viewing their dismissed items list, **When** they restore a specific item, **Then** that item is removed from the dismissed list and reappears in the feed on the next sync.
3. **Given** a user with no dismissed items, **When** they navigate to the dismissed items section, **Then** they see an empty state message confirming no items have been dismissed.

---

### Edge Cases

- What happens when a user dismisses an item that has already been completed or snoozed? The dismiss action takes precedence — dismissed items are hidden regardless of other override states.
- What happens if the same feed item is dismissed by a user who has the app open in two tabs simultaneously? The last action wins; the item state reflects whichever request is processed last.
- What happens when the source integration is disconnected and all its items are removed from the feed? Dismissed items from that integration are retained in the dismissed list in case the integration is reconnected later.
- What happens when the underlying source task is permanently deleted from the source system? The dismissal record can be safely pruned on the next sync since there is nothing left to suppress.
- What happens if a user has hundreds of dismissed items? The dismissed items list must be paginated; performance must not degrade on the main feed regardless of dismissed item count.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to dismiss any individual feed item with a single action directly from the feed.
- **FR-002**: The system MUST hide a dismissed item from the feed immediately upon dismissal, without requiring a page reload.
- **FR-003**: The system MUST persist the dismissal so that a dismissed item does not reappear in the feed on subsequent syncs, even if the underlying source item still exists.
- **FR-004**: The system MUST offer an undo option immediately after a dismissal, allowing the user to restore the item within the same view session.
- **FR-005**: Dismissed items MUST be excluded from all task count metrics and feed statistics.
- **FR-006**: Users MUST be able to view a list of all their dismissed items, including item title, source integration, and dismissal date.
- **FR-007**: Users MUST be able to restore any previously dismissed item from the dismissed items list.
- **FR-008**: Dismissal state MUST be scoped per user — one user's dismissals do not affect other users' feeds.
- **FR-009**: The dismiss action MUST use an optimistic update pattern — the item is visually removed immediately and restored if the server request fails.
- **FR-010**: The dismissed items list MUST support pagination for users with large numbers of dismissed items.

### Key Entities

- **Feed Item Dismissal**: Represents a user's decision to permanently hide a specific feed item. Attributes: user, reference to the source sync item, dismissal timestamp. Scoped per user.
- **Feed Item**: An item displayed in the ordrctrl feed, sourced from a connected integration. Has an associated dismissal state that controls its visibility.

## Assumptions

- The existing `SyncOverride` model (introduced in `002-uncheck-completed`) will be extended with a `DISMISSED` override type to store dismissals — no new data entity is needed.
- "Immediately after dismissal" for the undo window means while the user is still on the same feed view without navigating away (no timed expiry).
- Dismissed items are hidden from the feed but not deleted from the sync cache — they remain available for restoration.
- Dismissed items do not propagate back to the source integration (no write-back in this feature — that is two-way sync scope).
- Dismissal applies to the specific feed item instance, not to the sub-source. Dismissing one task from a list does not suppress the entire list.

## Dependencies

- **`002-uncheck-completed`**: `SyncOverride` model and override infrastructure are the foundation for this feature.
- **`003-selective-import`**: Feed items are already filtered by sub-source selection; dismissal adds a second, item-level filter layer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can dismiss a feed item in under 2 seconds (single tap/click to hidden).
- **SC-002**: 100% of dismissed items remain hidden across sessions and after syncs — zero reappearance rate.
- **SC-003**: Users can undo a dismissal and restore the item within 5 seconds of the original dismiss action.
- **SC-004**: Feed load time is not measurably degraded regardless of how many items a user has dismissed (performance neutral).
- **SC-005**: Users can locate and restore any previously dismissed item from the dismissed items list without external help.

---

### User Story 4 — Triage Incoming Items on Refresh (Priority: P2)

A user triggers a manual refresh (button or background 15-min interval detects new items). Instead of new items silently flooding the feed, a triage sheet slides up showing only the incoming items. The user can accept all, dismiss all, or act on items individually before they land in the feed.

**Why this priority**: The core value of ordrctrl is an intentional, curated feed. Silently auto-adding items from every sync undermines that. The triage pattern (used by Superhuman, Linear inbox) gives users control over what enters their workspace.

**Independent Test**: Connect an integration with pending items → click refresh → triage sheet appears with incoming items → dismiss 1 item → accept all remaining → verify feed shows accepted items, dismissed item is absent.

**Acceptance Scenarios**:

1. **Given** a user clicks the refresh button, **When** new items are found, **Then** a triage sheet slides up showing the incoming items before they enter the feed.
2. **Given** the triage sheet is open with items, **When** the user clicks "Accept all", **Then** all items are added to the feed and the sheet closes.
3. **Given** the triage sheet is open with items, **When** the user dismisses a specific item, **Then** that item is dismissed (persisted) and removed from the triage list.
4. **Given** the triage sheet is open with items, **When** the user clicks "Dismiss all", **Then** all items are dismissed and the sheet closes with no items added to the feed.
5. **Given** the background poll (every 15 min) detects new items, **When** the triage sheet is not open, **Then** a badge count appears on the refresh button without opening the sheet automatically.
6. **Given** the triage sheet shows no new items (feed is current), **When** the user reviews it, **Then** an "all clear" empty state is shown with a single "Done" button.
7. **Given** the user closes the triage sheet without acting, **When** the sheet is dismissed via the backdrop or × button, **Then** remaining items are accepted into the feed (close = accept all).
