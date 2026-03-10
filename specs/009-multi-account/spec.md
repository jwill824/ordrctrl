# Feature Specification: Multi-Account Integration Support + User Account Menu

**Feature Branch**: `009-multi-account`
**Created**: 2026-03-10
**Status**: Draft
**Input**: User description: "Add multi-account support so users can connect multiple accounts per integration (e.g. personal and work Google accounts) and have all tasks aggregated in one feed"

> **Terminology note**: This spec uses two distinct account concepts throughout:
> - **ordrctrl user account** — the user's identity in ordrctrl itself (email + password, session, logout). One per person.
> - **Integration account** — an external service account (e.g., a Gmail inbox) connected to ordrctrl. A user may connect multiple integration accounts per service.
>
> "Multi-account support" in this spec refers exclusively to connecting **multiple integration accounts** per service. The ordrctrl user identity remains singular.

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

### User Story 4 — User Account Menu: Logout and App Navigation (Priority: P1)

Currently there is no way for a user to sign out of their ordrctrl user account or navigate between settings sections from the feed. An account menu in the persistent navigation bar provides sign-out and a central navigation point. This is about the ordrctrl user session — entirely separate from the integration accounts being connected.

**Why this priority**: Sign-out is a fundamental requirement of any authenticated application. Without it, users on shared devices cannot end their session. Shipping multi-account integration support without a visible sign-out path would be a significant UX gap.

**Independent Test**: Can be fully tested independently of any integration account changes by opening the account menu from the feed header, confirming the signed-in ordrctrl email is displayed, clicking "Sign out", and verifying the user lands on the login page with their session destroyed.

**Acceptance Scenarios**:

1. **Given** a user is on the feed page, **When** they look at the top navigation bar, **Then** they see an account icon that opens the account menu.
2. **Given** a user opens the account menu, **When** the menu is visible, **Then** it shows their ordrctrl email address and a "Sign out" option.
3. **Given** a user clicks "Sign out", **When** the action completes, **Then** their ordrctrl session is destroyed and they are redirected to the login page.
4. **Given** a user opens the account menu, **When** the menu is visible, **Then** it also includes links to all settings sections (Integrations, Feed preferences, Dismissed items) — consolidating what is currently scattered across icon buttons.
5. **Given** a user's ordrctrl session has expired, **When** they attempt any authenticated action, **Then** they are redirected to the login page automatically.

---

### User Story 5 — Pause Syncing for an Individual Account (Priority: P3)

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

- **FR-001**: Users MUST be able to connect more than one integration account per service (e.g., two Gmail inboxes) from the integration settings page.
- **FR-002**: Each connected integration account MUST be stored and managed independently — connection, sync status, token lifecycle, and error state are tracked per integration account, not per service.
- **FR-003**: The system MUST prevent a user from connecting the same external integration account (same account identifier at the source service) twice.
- **FR-004**: Feed items MUST indicate which connected integration account they originated from, using either the account's email address or a user-set nickname.
- **FR-005**: Users MUST be able to disconnect a single integration account without affecting other connected accounts for the same service.
- **FR-006**: Users MUST be able to assign a custom nickname (label) to each connected integration account; the label defaults to the account's email address if no nickname is set.
- **FR-007**: The system MUST enforce a limit of 5 connected integration accounts per user per service to prevent abuse.
- **FR-008**: A token error or sync failure on one integration account MUST NOT prevent other accounts for the same service from syncing.
- **FR-009**: When an integration account is disconnected, all cached tasks and sync overrides associated with that account MUST be removed.
- **FR-010**: Users MAY pause and resume syncing for individual integration accounts without disconnecting them (P3).
- **FR-011**: The import filter (sub-source selector) MUST be configurable per integration account, not per service, so users can apply different import rules to each account.
- **FR-012**: Users MUST be able to sign out of their ordrctrl user account from any authenticated page via an account menu in the navigation bar.
- **FR-013**: The account menu MUST display the signed-in user's ordrctrl email address to confirm their active identity.

### Key Entities

- **ordrctrl User Account**: The user's singular identity in ordrctrl — email, password, and session. Created at registration, managed separately from any integration connections. This is what the user signs out of.
- **Integration Account**: A specific authenticated connection between a user and one external service account (e.g., a Gmail inbox). Has a label, sync status, error state, and optional pause state. A user may have multiple integration accounts per service.
- **Integration Service (grouping)**: The display grouping for all integration accounts connected to a particular service. Shown as a single card in settings, expanded to list individual integration accounts.
- **Feed Item account source**: The relationship between a feed item and the specific integration account it came from, enabling per-account labeling in the feed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can connect a second account for any supported service in under 2 minutes using the same OAuth flow as the first account.
- **SC-002**: 100% of feed items from services with multiple accounts connected display a distinguishable account label (nickname or email address).
- **SC-003**: Disconnecting one account removes only that account's tasks from the feed — zero cross-account data loss.
- **SC-004**: A token error on one account does not prevent other accounts for the same service from syncing — independently verified per account.
- **SC-005**: Users can connect up to 5 integration accounts per service; attempting to add a 6th is blocked with a clear, user-friendly message.
- **SC-006**: Users can sign out of their ordrctrl user account from the feed page in one click; session is fully destroyed on sign-out.

## Assumptions

- The OAuth consent flow is already implemented per service; multi-account reuses the same flow, storing the result as a new integration account record rather than overwriting the existing one.
- "Multi-account" applies to OAuth-based services (Gmail, Microsoft Tasks). Apple Calendar uses basic auth and is out of scope for this feature.
- The existing duplicate-suspect mechanism will continue to flag tasks that appear across multiple connected integration accounts without changes.
- Existing single-account users are unaffected; their single connection is treated as an integration account with no data migration needed.
- The import filter per integration account (FR-011) may be complex enough to defer to a follow-up spec if it significantly increases the implementation scope of P1.

## Out of Scope

- Cross-user account sharing (one integration source account shared between multiple ordrctrl users).
- Changing the ordrctrl user account password or email from within the app (future profile management feature).
- Multi-account support for Apple Calendar basic auth.
- Mobile app UI considerations (addressed in a separate spec).
