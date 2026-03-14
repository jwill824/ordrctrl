# Feature Specification: Task Content Enhancements

**Feature Branch**: `013-task-content-enhancements`  
**Created**: 2025-07-17  
**Status**: Implemented  
**Related Issues**: #44 (Edit task description), #38 (Open task source link)

## Overview

Two complementary enhancements that deepen a user's relationship with tasks pulled in from external integrations. Together they give users the ability to (1) personalise the description of any synced task without losing the original content, and (2) jump directly back to the source item — an email, a calendar event, a To Do task — in the native app or browser.

## Assumptions

- The `url` field on a synced task already stores a usable deep link for a meaningful subset of integrations (e.g., Gmail, Microsoft To Do). Where the field is absent or empty, the "open source" action is simply unavailable for that task.
- The user-supplied description override replaces the displayed description; the original is always preserved and remains accessible within the same view.
- There is no requirement to sync the edited description back to the source integration; the override lives only inside ordrctrl.
- A single text area (no rich-text formatting) is sufficient for the description editor.
- "Open in native app" is integration-specific: Microsoft To Do uses `ms-to-do://` with a `webLink` web URL fallback (via `window.blur` detection); Gmail opens the web URL directly; Apple Calendar has no supported browser-accessible scheme and shows no link in the web app (deferred to native mobile/desktop).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Edit a Synced Task's Description (Priority: P1)

A user opens a task that was pulled in from Gmail. The original email body is long, noisy, and hard to scan. The user wants to replace it with a crisp, personally written summary so the task is immediately actionable — without losing the original text in case they need to refer back to it.

**Why this priority**: Description editing directly addresses the friction of unreadable auto-imported content. It is the higher-impact of the two stories because it changes how the user processes and acts on every synced task, not just those with a source URL.

**Independent Test**: Can be fully tested by opening the task detail modal for any integration-sourced task, editing the description, saving, and verifying the override is shown with an "edited" indicator while the original remains accessible — delivering immediate value without the source-link feature.

**Acceptance Scenarios**:

1. **Given** a synced task is open in the task detail view, **When** the user activates the description edit control, **Then** an editable text area pre-populated with the current description (original or previous override) appears.
2. **Given** the user has modified the description text and saves, **When** the task is displayed in the feed or detail view, **Then** the user-supplied text is shown as the description and a visible indicator communicates that the content was edited by the user.
3. **Given** a task whose description has been overridden, **When** the user expands the original content section, **Then** the unmodified original description from the source integration is displayed in full.
4. **Given** the user has opened the edit control and made changes, **When** the user discards without saving (cancel / close without saving), **Then** no change is persisted and the previously displayed description is unchanged.
5. **Given** a task whose description has been overridden, **When** the user re-opens the edit control and clears the text and saves, **Then** the override is removed and the original integration description is shown again (with no "edited" indicator).

---

### User Story 2 — Open a Task's Source Item in Its Native App or Browser (Priority: P2)

A user sees a task imported from Gmail. They want to reply to the email, so they need to open it directly in Gmail — not copy-paste a link manually. Similarly, a Microsoft To Do task should open in the To Do app, and a calendar event should open in Calendar.

**Why this priority**: This is a navigation convenience rather than a content-management capability. It is high-value but depends on the source integration having populated the `url` field; tasks without a URL receive no benefit. It is independently shippable and does not depend on Story 1 being complete.

**Independent Test**: Can be fully tested by opening the task detail view for a synced task that has a source URL, tapping the "Open in [source]" control, and verifying the correct URL is handed off to the platform's URL handler — delivering direct value without the description-edit feature.

**Acceptance Scenarios**:

1. **Given** a synced task has a known source URL, **When** the task detail view is displayed, **Then** a clearly labelled action is visible that identifies the source (e.g., "Open in Gmail", "Open in To Do", "Open in Calendar").
2. **Given** the "Open in [source]" action is visible, **When** the user activates it, **Then** the platform opens the linked item in the appropriate native app or browser without closing or navigating away from ordrctrl unexpectedly.
3. **Given** a synced task does not have a source URL, **When** the task detail view is displayed, **Then** no "Open in [source]" action is shown — the absence is clean (no disabled/greyed-out placeholder).
4. **Given** the source URL is present but the target app is not installed on the device, **When** the user activates the "Open" action, **Then** the platform falls back to opening the URL in the default browser, and ordrctrl surfaces a user-friendly message if the handoff fails entirely.

---

### Edge Cases

- What happens when a synced task's source URL becomes stale (the underlying item was deleted in the source app)? The link is still shown and attempted; the source app or browser is responsible for the resulting error state. ordrctrl does not validate URL liveness.
- What happens when the user's override description is extremely long (e.g., thousands of characters)? The text area must handle it gracefully without data loss; no hard character limit is imposed, but the UI may truncate display with a scroll/expand affordance.
- What if the source integration updates the task's body after the user has set a description override? The original stored body is updated to reflect the integration's latest content, but the user override is left intact and continues to display. The "edited" indicator remains.
- What if the user's device is offline when they tap "Open in [source]"? The URL handoff is attempted; the browser or native app handles the offline state. ordrctrl does not block the action.
- What happens for local (non-synced) tasks? Neither feature applies. The edit description control and the "Open in [source]" action are not shown for locally created tasks.

---

## Requirements *(mandatory)*

### Functional Requirements

**Description Override (Issue #44)**

- **FR-001**: Users MUST be able to activate an edit mode for the description of any integration-sourced task.
- **FR-002**: The system MUST persist the user-supplied description as an override associated with that task, separate from the original integration content.
- **FR-003**: When a description override exists, the system MUST display the override text as the primary description in all task views (feed and detail).
- **FR-004**: When a description override exists, the system MUST display a visible indicator that the description was edited by the user.
- **FR-005**: The system MUST preserve and display the original integration-supplied description alongside the override, accessible within the task detail view.
- **FR-006**: Users MUST be able to remove a description override, reverting the task to display its original integration description.
- **FR-007**: Discarding an in-progress edit (without saving) MUST leave the existing description state unchanged.
- **FR-008**: Description overrides MUST persist across app restarts and sessions.

**Source Link / Open in App (Issue #38)**

- **FR-009**: For any integration-sourced task that carries a source URL, the system MUST present an action to open that URL.
- **FR-010**: The action label MUST identify the source integration by name (e.g., "Open in Gmail", "Open in To Do") so the user knows where they are navigating.
- **FR-011**: Activating the "Open in [source]" action MUST hand off to the native app if installed, with a web URL fallback if the app is not present. For Microsoft To Do, the `ms-to-do://` URL scheme is tried first; if the OS does not handle it within 500ms, the `webLink` web URL opens in a new tab. For Gmail, the web URL is opened directly (no native scheme needed). Apple Calendar has no supported browser-accessible URL scheme and shows no link.
- **FR-012**: For tasks without a source URL, the system MUST NOT display any "Open in [source]" action — there must be no non-functional placeholder.
- **FR-013**: The feature MUST NOT apply to locally created tasks; neither the edit-description control nor the "Open in [source]" action is shown for them.
- **FR-014** *(future)*: Apple Calendar event links are deferred until a native iOS or desktop app is available that can use `calshow://` directly. The web app silently omits the button for Apple Calendar events.

### Key Entities

- **Synced Task (SyncCacheItem)**: A task imported from an external integration. Carries an external identifier, service identifier, title, original body/description, optional due date, and an optional source URL pointing back to the origin item in the integration.
- **Description Override (SyncOverride — new DESCRIPTION_OVERRIDE type)**: A user-created record that pairs a custom description with a specific synced task. Stores the user-supplied text and a timestamp indicating when the override was created or last modified. The original task body is never mutated.
- **Source URL**: The deep-link address stored on a synced task that points to the original item in its source service. May be absent; presence drives availability of the "Open in [source]" action.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can apply a description override to a synced task in under 30 seconds from opening the task detail view to saving.
- **SC-002**: 100% of synced tasks that carry a source URL surface the "Open in [source]" action in their detail view; 0% of tasks without a source URL surface that action.
- **SC-003**: The original integration description is accessible within at most one additional interaction (e.g., one tap/click to expand) after a user override has been applied.
- **SC-004**: Description overrides survive app restarts; zero data-loss incidents when the app is closed immediately after saving an override.
- **SC-005**: The "Open in [source]" action successfully hands off to the correct native app (where a URL scheme is available and the app is installed) or opens the web URL in a new tab as fallback — for all integrations that provide a valid source URL, with no crashes or unhandled errors in ordrctrl itself. Apple Calendar has no link (correct; deferred to native app).
- **SC-006**: Both features are present only on integration-sourced tasks; local tasks show neither control — verified across all entry points where task details are displayed.
