# Feature Specification: App Polish & Bug Fix Bundle

**Feature Branch**: `012-app-polish-bugfix`  
**Created**: 2025-07-24  
**Status**: Draft  
**GitHub Issues**: #45, #41, #40

## Overview

This feature bundle groups three closely related improvements that collectively stabilize and simplify the ordrctrl workspace after recent feature additions (task inbox, feed UX enhancements). It resolves a broken manual refresh that prevents newly arrived tasks from appearing without a full browser reload, reorganizes a cluttered navigation menu whose structure no longer reflects the current app, and removes dead code and unused components that accumulated during prior feature work.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manual Refresh Surfaces New Tasks (Priority: P1)

A user is working in the feed and expects that clicking the refresh button brings in any tasks that have arrived from their integrations since the last sync — without reloading the entire browser tab.

**Why this priority**: This is a functional regression. The refresh button exists but does not work as advertised, which undermines trust in the feed and forces users into a disruptive full reload to get current data. Fixing it restores a core workflow.

**Independent Test**: Can be fully tested by triggering a new task in a connected integration (e.g., a new email in Gmail or a new reminder in Apple Reminders), clicking the refresh button in the feed, and verifying the new task appears without a browser reload.

**Acceptance Scenarios**:

1. **Given** the feed is open and a new task has arrived from a connected integration since the last sync, **When** the user clicks the refresh button, **Then** the new task appears in the appropriate feed section without a full browser reload.
2. **Given** the user clicks refresh, **When** the fetch is in progress, **Then** a visible loading indicator is shown so the user knows the refresh is running.
3. **Given** the user clicks refresh, **When** the fetch completes with no new tasks, **Then** the feed remains unchanged and the loading indicator clears — no error is shown.
4. **Given** the user clicks refresh, **When** the integration source is temporarily unavailable, **Then** an appropriate non-blocking error message is displayed and existing feed content is preserved.
5. **Given** a task that was updated (not newly created) at the source since the last sync, **When** the user clicks refresh, **Then** the task's updated fields (e.g., due date, title) are reflected in the feed.
6. **Given** a task that was completed or deleted at the source since the last sync, **When** the user clicks refresh, **Then** the task is removed from the active feed sections accordingly.

---

### User Story 2 - Simplified Navigation Menu (Priority: P2)

A user opens the side navigation and can immediately find the sections they need. The menu contains only items that reflect current app functionality and does not include leftover entries from superseded workflows (e.g., a triage route that was replaced by the inbox, or a standalone dismissed page that was replaced by the inline dismissed feed view).

**Why this priority**: A cluttered or misleading menu increases cognitive load on every session. With the inbox replacing triage and dismissed items now accessible inline via the feed, the menu must be updated to match the app as it actually works today.

**Independent Test**: Can be fully tested by opening the navigation and verifying that each visible menu item navigates to a functional destination, no orphaned or duplicate entries are present, and the overall item count is reduced compared to the current state.

**Acceptance Scenarios**:

1. **Given** the user opens the navigation menu, **When** they view the list of items, **Then** all displayed items navigate to functional, current destinations.
2. **Given** the triage workflow was replaced by the task inbox, **When** a user views the menu, **Then** no "Triage" menu entry exists; the inbox entry is present and leads to the task inbox.
3. **Given** the dismissed items view is now accessible inline via the feed, **When** a user views the menu, **Then** there is no standalone "Dismissed" route entry that duplicates the inline feed dismissed view; access to dismissed items is available through the feed or a clearly labeled feed control.
4. **Given** a user who was previously using an old menu entry that has been removed, **When** they navigate to the old URL directly, **Then** they are redirected to the most appropriate current destination rather than seeing a 404 or blank page.
5. **Given** the updated menu, **When** a first-time or returning user scans it, **Then** all items are grouped or ordered logically and use clear, consistent labels.

---

### User Story 3 - Dead Code Removed (Priority: P3)

A developer working on the codebase encounters no unused components, unreachable routes, or redundant logic that was left behind after the task inbox and feed UX enhancement features were completed.

**Why this priority**: Dead code increases maintenance burden and creates confusion about what is in use. While not user-visible, cleaning it up now — while the recent changes are fresh — prevents compounding complexity in future development cycles.

**Independent Test**: Can be fully tested by verifying that no import warnings for unused components are generated at build time, no routes exist that have no active entry point, and no duplicate logic for the same concern exists in the codebase.

**Acceptance Scenarios**:

1. **Given** components or utilities that were rendered obsolete by the task inbox feature, **When** the cleanup is applied, **Then** those files no longer exist in the codebase and all their former import sites have been updated.
2. **Given** components or utilities that were rendered obsolete by the feed UX enhancement feature (FeedSection, FeedItem, EditTaskModal superseding older equivalents), **When** the cleanup is applied, **Then** only the current canonical implementations remain.
3. **Given** any route handlers, pages, or navigation entries that no longer correspond to existing features, **When** the cleanup is applied, **Then** they are removed and any inbound links are redirected appropriately.
4. **Given** duplicated logic that performs the same operation in two different places (e.g., task filtering, date formatting), **When** the cleanup is applied, **Then** only one canonical version remains and all callers reference it.
5. **Given** the application after cleanup, **When** the build is run, **Then** it completes successfully with no errors attributable to the removed code.

---

### Edge Cases

- What happens when a user clicks refresh multiple times in rapid succession? The system should debounce or queue the requests and not produce duplicate tasks in the feed.
- What happens when the feed refresh succeeds for some integrations but fails for others? The successfully fetched tasks should surface and a non-blocking notice should indicate which sources could not be reached.
- What happens if a removed navigation menu entry is bookmarked by a user? They should be redirected gracefully to the appropriate current destination.
- What happens if dead code removal accidentally removes a component that is still referenced from an unexpected location? The build should fail with a clear error, making the issue immediately detectable.
- What happens when a refresh is triggered while the user is in the middle of editing a task in the feed? The edit modal or inline edit state should be preserved and the refresh should update background data without disrupting the active edit.

## Requirements *(mandatory)*

### Functional Requirements

**Manual Refresh Fix (#45)**

- **FR-001**: The feed refresh action MUST re-fetch tasks from all connected integrations and surface any newly arrived items in the appropriate feed sections without requiring a full browser reload.
- **FR-002**: The feed refresh action MUST update existing task records in the feed to reflect any field changes (title, due date, status) that occurred at the source since the last sync.
- **FR-003**: The feed refresh action MUST remove tasks from active feed sections when those tasks have been completed or deleted at the source since the last sync.
- **FR-004**: The feed MUST display a visible loading indicator while a refresh is in progress.
- **FR-005**: The feed MUST display a non-blocking, dismissible error notice if a refresh attempt fails for one or more integration sources, while preserving all currently displayed content.
- **FR-006**: Rapid successive refresh triggers MUST be handled gracefully — the system must not produce duplicate task entries as a result of concurrent refresh calls.

**Menu Cleanup (#41)**

- **FR-007**: The navigation menu MUST contain only items that correspond to functional, current destinations in the application.
- **FR-008**: Any menu entry for the legacy triage workflow MUST be removed; the task inbox entry MUST be present and correctly linked.
- **FR-009**: The navigation menu MUST NOT contain a standalone route entry for the dismissed items page that duplicates the inline dismissed feed view introduced in feature 011.
- **FR-010**: URLs previously associated with removed menu entries MUST redirect users to the most appropriate current destination rather than returning a not-found page.
- **FR-011**: Menu items MUST be grouped and labeled in a way that clearly communicates the purpose of each section to the user.

**Dead Code Removal (#40)**

- **FR-012**: All components, utilities, hooks, and route handlers that are no longer referenced by any active part of the application MUST be removed from the codebase.
- **FR-013**: All call sites that previously referenced removed code MUST be updated to use the canonical current equivalent or removed entirely if the call site itself is no longer needed.
- **FR-014**: After cleanup, the application build MUST complete without errors or import warnings caused by the removed code.
- **FR-015**: Duplicate implementations of the same concern (task filtering, date formatting, feed data retrieval) MUST be consolidated into a single canonical version, with all callers updated accordingly.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After clicking the feed refresh button, newly arrived tasks from connected integrations appear in the feed within the same browser session — a full page reload is never required to see new items.
- **SC-002**: After clicking the feed refresh button, updated task fields (title, due date, status) from integration sources are reflected in the feed within the same browser session.
- **SC-003**: The navigation menu contains no entries that lead to non-functional, removed, or duplicated destinations; every visible item navigates to a working, relevant page.
- **SC-004**: The total number of navigation menu items is reduced compared to the state prior to this feature, reflecting the removal of superseded workflow entries.
- **SC-005**: The application build completes cleanly after dead code removal — zero errors or warnings directly attributable to unused or removed files.
- **SC-006**: No duplicate implementations of the same core concern (task retrieval, feed filtering, date display) remain in the codebase after cleanup.
- **SC-007**: A user clicking refresh while an integration source is temporarily unavailable sees a clear, non-blocking notice and their existing feed content is fully preserved.

## Assumptions

- The `refresh()` action in the `useFeed` hook exists and is wired to the refresh button, but the underlying data-fetching pipeline (re-querying integrations and merging results into the feed state) is not completing correctly. The fix is scoped to making this pipeline work end-to-end, not redesigning the refresh architecture.
- The dismissed items workflow introduced in feature 011 (inline via `/feed?showDismissed=true`) is considered the authoritative and final design. No new dismissed workflow design is required here — only the removal of the superseded standalone route.
- "Triage" as a standalone workflow has been fully replaced by the task inbox (feature 010). Any remaining triage routes, components, or menu entries are candidates for removal.
- The dead code cleanup scope is limited to code made obsolete by features 010 (task inbox) and 011 (feed UX enhancements). Code that may be unused for other historical reasons is out of scope for this bundle.
- Menu reorganization does not require a redesign of the navigation structure — only the removal of obsolete items and the correction of labels that no longer match current functionality.
- A successful build with no errors is the acceptance bar for dead code removal; runtime regression testing is handled by the existing test suite.

## Dependencies

- Feature 010 (task inbox) — establishes the inbox as the replacement for triage; menu cleanup and dead code removal are downstream of this being complete and stable.
- Feature 011 (feed UX enhancements) — establishes the inline dismissed view, FeedSection, FeedItem, and EditTaskModal as the canonical feed components; cleanup removes anything these supersede.
- The manual refresh fix depends on the feed data-fetching pipeline (useFeed hook, integration sync) being structurally sound; if deeper architectural issues are found, they may require a separate feature track.
