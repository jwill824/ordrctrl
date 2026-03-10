# Feature Specification: Multi-Account Support

**Feature Branch**: `009-multi-account`
**Created**: 2026-03-10
**Status**: Draft
**Input**: User description: "Add multi-account support so users can connect multiple accounts per integration (e.g. personal and work Google accounts) and have all tasks aggregated in one feed"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Connect a Second Account for a Service (Priority: P1)

A user who already has one Gmail connected wants to also connect their work Gmail account. They go to integration settings, find the Gmail card, and add a second account. Both accounts appear in the integrations list, and tasks from both are included in the feed.

**Why this priority**: This is the core capability of the feature — without the ability to add more than one account per service, nothing else is possible.

**Independent Test**: Can be fully tested by connecting a second Gmail account on a user who already has one Gmail connected, verifying both appear in settings, and confirming tasks from both accounts show in the feed with distinct labels.

**Acceptance Scenarios**:

1. **Given** a user has Gmail (personal) connected, **When** they click "Add account" on the Gmail integration card, **Then** they are taken through the OAuth consent flow for a new account and both accounts appear under Gmail in settings.
2. **Given** a user completes the OAuth flow for a second account, **When** they return to settings, **Then** both accounts are listed with distinguishable labels (e.g., email address or user-provided nickname).
3. **Given** both accounts are connected, **When** the feed loads, **Then** tasks from both accounts appear in the feed aggregated together.
4. **Given** a user tries to add the exact same account twice, **When** they complete the OAuth flow, **Then** the system deduplicates the connection and informs the user that account is already connected.

---

### User Story 2 — Distinguish and Manage Individual Accounts (Priority: P1)

A user with multiple accounts connected wants to see which account each task originated from, and be able to disconnect one account without affecting the other.

**Why this priority**: Without per-account visibility and management, users cannot distinguish tasks or selectively remove an account — making the feature impractical.

**Independent Test**: Can be fully tested by verifying feed items display their source account identity, and by disconnecting one of two connected accounts and confirming only that account's tasks are removed while the other account continues syncing.

**Acceptance Scenarios**:

1. **Given** two Gmail accounts are connected, **When** the feed displays tasks, **Then** each task from Gmail shows which account it came from (e.g., account nickname or email address).
2. **Given** two Gmail accounts are connected, **When** a user disconnects one account, **Then** only that account's tasks are removed from the feed and the other account remains connected and syncing.
3. **Given** a user views the integration settings card for Gmail, **When** the card is expanded, **Then** each connected account is listed separately with a disconnect option per account.
4. **Given** a user disconnects the only remaining account for a service, **When** the action completes, **Then** the service returns to its unconnected state.

---

### User Story 3 — Label / Nickname Accounts for Easy Identification (Priority: P2)

A user with personal and work Gmail accounts wants to label each account so they can quickly recognize which tasks belong to which context.

**Why this priority**: Distinguishable accounts are important for usability, but the feed can still function with just email addresses as labels. Custom nicknames improve the experience.

**Independent Test**: Can be fully tested by editing the label on a connected account and verifying the new label appears in integration settings and on feed items from that account.

**Acceptance Scenarios**:

1. **Given** a user has two Gmail accounts connected, **When** they click "Edit label" on one, **Then** they can enter a custom nickname (e.g., "Work", "Personal").
2. **Given** a user sets a custom label, **When** they view the feed, **Then** tasks from that account display the custom label instead of the raw email address.
3. **Given** a user clears a custom label, **When** they save, **Then** the label reverts to the account's email address.

---

### User Story 4 — Pause Syncing for an Individual Account (Priority: P3)

A user with multiple accounts wants to pause syncing for one account (e.g., turn off personal Gmail while on vacation) without disconnecting it.

**Why this priority**: Nice-to-have control that builds on US1–US3. Core value is delivered without it.

**Independent Test**: Can be fully tested by pausing one account, confirming no new tasks appear from it while the other account syncs normally, then resuming and confirming tasks appear again.

**Acceptance Scenarios**:

1. **Given** two Gmail accounts are connected, **When** a user pauses one account, **Then** the feed stops showing new tasks from that account but existing tasks remain visible.
2. **Given** an account is paused, **When** the user resumes it, **Then** a sync runs immediately and new tasks from that account appear in the feed.

---

### Edge Cases

- What happens when a user tries to connect a 6th account for the same service? (Must be blocked with a clear limit message)
- How does the system handle a token error on one account independently of other accounts for the same service?
- What happens if two connected accounts surface the same task (e.g., a shared calendar event)? The existing duplicate-suspect mechanism should handle this.
- What label is displayed for an account if no nickname is set and the service does not return an email address?
- What happens to sync overrides (completions, dismissals, reopens) when a source account is disconnected?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to connect more than one account per integration service (e.g., two Gmail accounts) from the integration settings page.
- **FR-002**: Each connected account MUST be stored and managed independently — connection, sync status, token lifecycle, and error state are tracked per account, not per service.
- **FR-003**: The system MUST prevent a user from connecting the same external account (same account identifier at the source service) twice.
- **FR-004**: Feed items MUST indicate which connected account they originated from, using either the account's email address or a user-set nickname.
- **FR-005**: Users MUST be able to disconnect a single account without affecting other connected accounts for the same service.
- **FR-006**: Users MUST be able to assign a custom nickname (label) to each connected account; the label defaults to the account's email address if no nickname is set.
- **FR-007**: The system MUST enforce a limit of 5 connected accounts per user per service to prevent abuse.
- **FR-008**: A token error or sync failure on one account MUST NOT prevent other accounts for the same service from syncing.
- **FR-009**: When an account is disconnected, all cached tasks and sync overrides associated with that account MUST be removed.
- **FR-010**: Users MAY pause and resume syncing for individual accounts without disconnecting them (P3).
- **FR-011**: The import filter (sub-source selector) MUST be configurable per account, not per service, so users can apply different import rules to each account.

### Key Entities

- **Account**: A specific authenticated connection between a user and one account at an integration service. Has a label (nickname or email), sync status, error state, and optional pause state. A user may have multiple Accounts for the same service.
- **Integration (service grouping)**: The display grouping for all accounts connected to a particular service for a user. Shown as a single card in settings, expanded to list individual accounts.
- **Feed Item account source**: The relationship between a feed item and the specific account it came from, enabling per-account labeling in the feed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can connect a second account for any supported service in under 2 minutes using the same OAuth flow as the first account.
- **SC-002**: 100% of feed items from services with multiple accounts connected display a distinguishable account label (nickname or email address).
- **SC-003**: Disconnecting one account removes only that account's tasks from the feed — zero cross-account data loss.
- **SC-004**: A token error on one account does not prevent other accounts for the same service from syncing — independently verified per account.
- **SC-005**: Users can connect up to 5 accounts per service; attempting to add a 6th is blocked with a clear, user-friendly message.

## Assumptions

- The OAuth consent flow is already implemented per service; multi-account reuses the same flow, storing the result as a new account record rather than overwriting the existing one.
- "Multi-account" applies to OAuth-based services (Gmail, Microsoft Tasks). Apple Calendar uses basic auth and is out of scope for this feature.
- The existing duplicate-suspect mechanism will continue to flag tasks that appear across multiple connected accounts without changes.
- Existing single-account users are unaffected; their single connection is treated as an account with no data migration needed.
- The import filter per account (FR-011) may be complex enough to defer to a follow-up spec if it significantly increases the implementation scope of P1.

## Out of Scope

- Cross-user account sharing (one source account shared between multiple ordrctrl users).
- Account switching or profile views (the feed always aggregates all connected accounts).
- Multi-account support for Apple Calendar basic auth.
- Mobile app UI considerations (addressed in a separate spec).
