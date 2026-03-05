# Feature Specification: ordrctrl Initial MVP

**Feature Branch**: `001-mvp-core`
**Created**: 2026-03-05
**Status**: Active — All 7 phases complete; full MVP implemented; UI migrated to idiomatic Tailwind CSS utility classes
**Input**: Full initial MVP — user authentication (email/password + Sign in with Google +
Sign in with Apple), integration onboarding for Gmail, Apple Reminders, Microsoft Tasks,
and Apple Calendar, native task creation, and a consolidated one-way-sync task feed

## Clarifications

### Session 2026-03-05

- Q: How are duplicate items handled if the same task exists in two connected services? → A: Flag potential duplicates visually but show both (one entry per source).
- Q: When a user marks an item complete, what should happen to it in the feed? → A: Move to a collapsible "Completed" section at the bottom of the feed.
- Q: What does the Gmail integration surface in the feed? → A: User-configurable per-account preference: "All unread emails" (for inbox-zero users) or "Starred/flagged emails only" (for users with high email volume). User selects this mode when connecting Gmail.
- Q: How should ordrctrl handle an expired OAuth token? → A: Attempt silent token refresh first using the refresh token; only show a re-authorization prompt to the user if the refresh fails.
- Q: How frequently should background sync run? → A: Every 15 minutes. Manual refresh also available on demand.
- Q: What visual design language should the application use? → A: Minimalist black-and-white throughout. No decorative colors. High contrast between text and background. Clean geometric sans-serif typography (Inter). Square/sharp UI elements with no rounded corners. Social sign-in options (Google, Apple) presented as the primary path on auth pages, positioned above the email/password form separated by a clear divider. All pages must be responsive on mobile browser viewports.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Account Creation & Login (Priority: P1)

A new user discovers ordrctrl, creates an account using their email address and a password,
verifies their email, and logs in for the first time. Returning users can log back in and
recover access if they forget their password.

**Why this priority**: Without an account, no other functionality is accessible. This is the
entry gate for every user and must be solid before anything else is built.

**Independent Test**: Can be fully tested by creating a new account, verifying email, logging
out, and logging back in — without any integrations connected. Delivers a working auth system.

**Acceptance Scenarios**:

1. **Given** a visitor on the sign-up page, **When** they submit a valid email and password,
   **Then** they receive a verification email and their account is created in a pending state.
2. **Given** a user with a pending account, **When** they click the verification link,
   **Then** their account becomes active and they are redirected to the onboarding screen.
3. **Given** an active user on the login page, **When** they enter correct credentials,
   **Then** they are authenticated and land on the consolidated view (or onboarding if no
   integrations are connected).
4. **Given** a user who forgot their password, **When** they request a reset and follow the
   emailed link, **Then** they can set a new password and log in successfully.
6. **Given** a user who enters incorrect credentials, **When** they submit the login form,
   **Then** they receive a clear error message and remain on the login page.

---

### User Story 2 - Integration Onboarding (Priority: P2)

A logged-in user is guided through connecting one or more of the four supported integrations:
Gmail, Apple Reminders, Microsoft Tasks, and Apple Calendar. An in-app tutorial walks them
through the authorization flow for each, explains what data will be read, and confirms a
successful connection. Users can connect any combination of the four and disconnect any at
any time.

**Why this priority**: The core value of ordrctrl is the unified view, which requires at least
one integration. Onboarding unlocks the product's primary value proposition.

**Independent Test**: Can be fully tested by connecting a single integration (e.g., Apple
Reminders), verifying it appears as "Connected," then disconnecting it — without the
consolidated view being complete.

**Acceptance Scenarios**:

1. **Given** a logged-in user with no integrations, **When** they arrive at the dashboard,
   **Then** they see an onboarding screen listing the four supported integrations with a
   tutorial prompting them to connect at least one.
2. **Given** a user on the onboarding screen, **When** they select an integration and
   complete the OAuth authorization flow, **Then** the integration appears as "Connected" and
   an initial sync begins in the background.
3. **Given** a user with one or more connected integrations, **When** they navigate to
   integration settings, **Then** they can see all four integrations, which are connected,
   and disconnect any of them individually.
4. **Given** a user who denies OAuth authorization mid-flow, **When** they are returned to
   ordrctrl, **Then** they see a clear explanation and are invited to try again or choose a
   different integration.
5. **Given** a user who has already connected an integration, **When** they attempt to connect
   the same integration again, **Then** they are informed it is already connected and offered
   to reconnect (re-authorize) instead.

---

### User Story 3 - Consolidated Task & Calendar Feed (Priority: P3)

A user with at least one connected integration sees a single unified feed of tasks, reminders,
and calendar events pulled from all connected services — Gmail, Apple Reminders, Microsoft
Tasks, and/or Apple Calendar — presented in chronological/priority order. Each item is labeled
with its source integration. Sync is one-way: reading data from connected services into
ordrctrl. Marking an item complete in ordrctrl does NOT propagate that change back to the
source service in this MVP.

**Why this priority**: This is the core product experience — the reason ordrctrl exists.
It depends on both a working account (P1) and at least one active integration (P2).

**Independent Test**: Can be fully tested with a single connected integration (e.g., Apple
Reminders) by verifying that reminders appear in the feed with correct source labels and
ordering.

**Acceptance Scenarios**:

1. **Given** a user with at least one connected integration, **When** they open the
   consolidated feed, **Then** they see all synced tasks, reminders, and calendar events
   from every connected service in a single chronological/priority-ordered list.
2. **Given** a user viewing the consolidated feed, **When** they look at any item,
   **Then** they can clearly identify which integration it came from via a visible source
   label or icon on that item.
3. **Given** a user whose sync has completed, **When** they view the feed, **Then** the
   displayed items reflect the most recent sync data from all connected integrations.
4. **Given** a user with no connected integrations, **When** the consolidated feed loads,
   **Then** they see an empty state with a direct prompt to connect an integration.
5. **Given** a user whose integration becomes unavailable (e.g., expired token), **When**
   they view the feed, **Then** they see a non-blocking notice for that integration and
   still see items from all healthy integrations.
6. **Given** a user who marks an item complete in ordrctrl, **When** the action is saved,
   **Then** the item is removed from the active feed, marked complete within ordrctrl only
   (source service is NOT updated), and moved into a collapsible "Completed" section at the
   bottom of the feed. The source service is NOT updated (one-way sync behavior).

---

### User Story 4 - Native Task Creation (Priority: P4)

A user can create tasks directly within ordrctrl — independent of any connected integration.
Native tasks live only in ordrctrl, appear in the same unified feed alongside synced items,
and are labeled as "ordrctrl" to distinguish them from integration-sourced items.

**Why this priority**: Native tasks let users manage everything in one place, even for items
that don't originate from an external service. This completes the "single source of truth"
experience but is not required for the MVP to deliver core value.

**Independent Test**: Can be fully tested without any integrations connected — create a native
task, verify it appears in the feed labeled "ordrctrl," mark it complete, and verify it updates.

**Acceptance Scenarios**:

1. **Given** a logged-in user on the consolidated feed, **When** they tap/click "Add Task,"
   **Then** they can enter a title and optional due date and save the task.
2. **Given** a user who has saved a native task, **When** they view the consolidated feed,
   **Then** the task appears in the correct chronological/priority position labeled as
   "ordrctrl."
3. **Given** a user viewing a native task, **When** they mark it complete, **Then** it is
   marked as done within ordrctrl (no external sync occurs).
4. **Given** a user viewing a native task, **When** they choose to edit or delete it,
   **Then** the task is updated or removed from the feed immediately.

---

### Edge Cases

- What happens when a user's OAuth token expires silently between syncs?
  **Resolved**: The system MUST attempt a silent token refresh using the stored refresh token.
  If refresh succeeds, sync continues uninterrupted. If refresh fails, the affected integration
  MUST display a non-blocking re-authorization prompt (inline in the feed error indicator)
  without disrupting other integrations.
- How does the system handle an integration's API being rate-limited or temporarily unavailable?
- What does a user see if they have connected integrations but all return empty data?
- What happens if an email verification link is clicked more than once or after it expires?
- How are duplicate items handled if the same task exists in two connected services?
  **Resolved**: Both items are shown (one per source). If two items share an identical title
  across different integrations, the feed MUST display a visual duplicate indicator on both
  (e.g., a subtle warning icon), allowing the user to decide how to handle them.
- What if a user tries to create an account with an email address already registered?
- What if a user connected via Sign in with Google then tries to also connect their Gmail
  integration — are those treated as separate auth flows?
- What if a native task has the same title as a synced task — how are they differentiated?

## Requirements *(mandatory)*

### Functional Requirements

**Authentication**

- **FR-001**: System MUST allow users to create a new account using an email address and password.
- **FR-002**: System MUST validate email address format and password strength at registration.
- **FR-003**: System MUST send a verification email upon account creation and require
  verification before granting full access.
- **FR-004**: System MUST allow users to log in with their email and password.
- **FR-005**: System MUST allow users to request a password reset via their registered email.
- **FR-006**: System MUST lock out or throttle repeated failed login attempts to prevent
  brute-force attacks.
- **FR-007**: System MUST allow users to log out and invalidate their active session.
- **FR-008**: Users MUST be able to create an ordrctrl account and log in via Sign in with
  Google and Sign in with Apple, in addition to email/password. Social login users bypass the
  email verification step as their identity is verified by the provider.

**Integration Onboarding**

- **FR-009**: System MUST provide an onboarding tutorial screen for users with no connected
  integrations that lists and explains all four supported integrations: Gmail, Apple Reminders,
  Microsoft Tasks, and Apple Calendar.
- **FR-010**: System MUST support connecting each of the four integrations via their respective
  OAuth 2.0 authorization flows.
- **FR-011**: System MUST display which of the four integrations are connected and show current
  sync status for each.
- **FR-012**: Users MUST be able to disconnect any connected integration at any time, which
  MUST revoke and delete stored credentials for that integration.
- **FR-013**: System MUST handle OAuth authorization denial gracefully with a user-facing
  explanation and retry option.
- **FR-024**: During Gmail integration setup, the system MUST prompt the user to choose a
  sync mode: "All unread emails" or "Starred/flagged emails only" (default). The selected
  mode MUST be displayed and editable in integration settings at any time. Changing the mode
  MUST trigger a fresh sync using the new filter.
- **FR-025**: When a background sync detects an expired OAuth token, the system MUST attempt
  a silent refresh using the stored refresh token before any user-facing action. If the silent
  refresh succeeds, sync MUST continue without user interruption. If the refresh fails, the
  integration MUST surface a non-blocking re-authorization prompt inline in the feed, without
  affecting other connected integrations.
- **FR-026**: The system MUST automatically sync all connected integrations every 15 minutes
  in the background while the user has an active session. The interval is not user-configurable
  in the MVP. A manual "Refresh" action MUST also be available on the feed at any time.

**Consolidated Feed**

- **FR-014**: System MUST display a single unified feed combining tasks, reminders, and
  calendar events from all connected integrations, ordered chronologically by due date or
  event time (soonest first), with undated items appended at the end.
- **FR-015**: Each item in the feed MUST display a source label identifying its integration
  (Gmail, Apple Reminders, Microsoft Tasks, Apple Calendar, or ordrctrl for native tasks).
- **FR-016**: System MUST display an empty state with a direct link to integration settings
  when no integrations are connected and no native tasks exist.
- **FR-017**: System MUST show a non-blocking per-integration error indicator when a sync
  fails, without hiding items from healthy integrations.
- **FR-018**: Sync MUST be one-way (read-only from integrations into ordrctrl). Marking an
  item complete or editing it in ordrctrl MUST NOT propagate changes back to the source
  service. Two-way sync is explicitly out of scope for this MVP.
- **FR-023**: When a user marks any feed item (synced or native) as complete, the item MUST
  move out of the active feed and into a collapsible "Completed" section at the bottom of
  the same screen. The Completed section MUST be collapsed by default and expandable on
  demand.

**Native Tasks**

- **FR-019**: Users MUST be able to create a task natively within ordrctrl with a title and
  an optional due date.
- **FR-020**: Native tasks MUST appear in the unified feed alongside synced items, labeled
  as "ordrctrl," and MUST be orderable by the same chronological/priority rules.
- **FR-022**: When two or more feed items share an identical title across different integrations
  (or a native task and a synced item share a title), the feed MUST display a visual duplicate
  indicator on each affected item. Both items MUST remain visible; no automatic merging or
  suppression occurs.

**Design & Presentation**

- **FR-027**: The application MUST implement a minimalist, high-contrast black-and-white visual
  design throughout all screens. No decorative or accent colors. Typography MUST use a clean
  geometric sans-serif typeface (Inter). UI controls (inputs, buttons, dividers) MUST use sharp
  edges with clear borders — no soft shadows or rounded decorative elements. Styling is
  implemented via Tailwind CSS utility classes applied directly in JSX; no custom CSS component
  classes or inline `style` props are used (except for runtime-dynamic values such as
  per-integration source badge colors).
- **FR-028**: Authentication pages (sign-in, sign-up) MUST present social sign-in options
  (Google, Apple) as the primary path, positioned above the email/password form and separated
  by a clear visual divider. The application wordmark MUST appear at the top of each auth page.
- **FR-029**: All pages MUST be fully usable on mobile browser viewports (responsive layout).
  No functionality available on desktop MUST be hidden or unavailable on mobile browser.

### Key Entities

- **User**: An ordrctrl account holder. Has an email address, authentication method
  (email/password, Google, or Apple), verification status, and session state. Owns zero or
  more Integrations and zero or more native Tasks.
- **Integration**: One of four supported connected services (Gmail, Apple Reminders,
  Microsoft Tasks, Apple Calendar) belonging to a User. Has a service type, connection status,
  encrypted OAuth credentials, and last sync timestamp.
- **SyncCache**: A time-bounded store of normalized items retrieved from an Integration.
  Has a TTL (default ≤24 hours). Sync is one-way: read from source, no writes back.
- **Task**: A normalized representation of a to-do item or reminder. Has a title, completion
  status, completion timestamp (set when marked done in ordrctrl), due date (optional),
  source (integration name or "ordrctrl" for native), and an original service ID (null for
  native tasks).
- **Event**: A normalized representation of a calendar event from Apple Calendar. Has a title,
  start/end time, source integration label, and original service ID.
- **Message**: A normalized representation of a Gmail email item surfaced in the feed. Has a
  subject (used as the display title), sender, received timestamp, source label ("Gmail"),
  sync mode at time of capture ("all unread" or "starred only"), and original Gmail message ID.
  Messages are read-only; completion in ordrctrl marks them locally only.
- **NativeTask**: A task created directly in ordrctrl by the user. Has a title, optional due
  date, completion status, and is always labeled "ordrctrl." Persists independently of any
  integration sync.

### Assumptions

- Social login (Sign in with Google, Sign in with Apple) creates an ordrctrl-managed account;
  social provider tokens are used only for identity — not pre-authorized for Gmail/Calendar
  integration access. Gmail/Calendar connections require a separate OAuth authorization step.
- Sync runs automatically on login and every 15 minutes in the background. A manual
  refresh option is available on the feed at any time.
- Data retention for sync cache defaults to 24 hours per the constitution's security policy.
- Gmail surfaces email items according to a user-selected sync mode chosen at connection time:
  **"All unread emails"** (for inbox-zero users who treat every unread as an action item) or
  **"Starred/flagged emails only"** (for users with high email volume). The default presented
  is "Starred/flagged only." The mode can be changed in integration settings after initial setup.
- The application is available on web (desktop and mobile browser) for the MVP; native mobile
  app is a follow-on release.
- Two-way sync (propagating changes from ordrctrl back to source services) is explicitly
  deferred to post-MVP.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can complete account registration and email verification in under
  2 minutes from first landing on the sign-up page.
- **SC-002**: A user can connect their first integration and see synced items appear in the
  consolidated feed within 3 minutes of starting the onboarding tutorial.
- **SC-003**: 90% of users who begin the onboarding tutorial successfully connect at least
  one integration without abandoning the flow.
- **SC-004**: The consolidated feed displays items from all connected integrations within
  30 seconds of a completed sync.
- **SC-005**: Users can identify the source integration of every item in the feed 100% of
  the time via the visible source label, without needing additional context.
- **SC-006**: The application remains fully usable (showing items from other integrations)
  when one integration experiences a sync failure.
- **SC-007**: Users can disconnect an integration and have all its cached data cleared within
  60 seconds.
- **SC-008**: Users can create a native task and see it appear correctly ordered in the
  unified feed in under 30 seconds.
- **SC-009**: Marking an item complete in ordrctrl takes effect immediately in the feed and
  does not trigger any change in the originating service.
- **SC-010**: All auth pages (sign-in, sign-up, forgot/reset password) render correctly and
  are fully interactive on a 375px-wide mobile browser viewport with no horizontal overflow.
