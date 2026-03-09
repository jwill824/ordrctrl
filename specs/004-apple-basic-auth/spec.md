# Feature Specification: Apple iCloud Integration via App-Specific Password

**Feature Branch**: `004-apple-basic-auth`  
**Created**: 2026-03-08  
**Status**: Complete (Scope Revised — see below)  
**Input**: Rework Apple Reminders and Apple Calendar integration adapters to use App-Specific Password (Basic Auth) instead of Sign in with Apple OAuth2.

---

## ⚠️ Scope Revision (2026-03-09)

During implementation, an architectural constraint was discovered: **Apple Reminders is not accessible via CalDAV**. The CalDAV protocol on iCloud only surfaces iCloud-synced Reminder lists (the deprecated default list). Users' actual Reminder lists — stored in Gmail, Exchange, or device-local accounts — are invisible via CalDAV entirely. Apple Reminders requires **EventKit**, a native macOS/iOS framework.

### What Changed

| Item | Original Scope | Final Implemented Scope |
|------|----------------|-------------------------|
| Apple Reminders | ✅ Included — CalDAV-based sync | ❌ Removed from web app |
| Apple Calendar | ✅ Included — CalDAV-based sync | ✅ Implemented as specified |
| `apple_reminders` service | Full integration | Removed from `ServiceId`, adapters, and UI |
| Sibling credential flow | Enabled one-click connect for 2nd Apple service | Dormant — only one Apple service now |

### Why Apple Reminders Was Removed

EventKit (the only API that can access Apple Reminders data) runs as a native process on the local macOS/iOS device. It cannot be accessed remotely from a web server. For a multi-user web app where the backend runs on a server, EventKit would access the **server's** Reminders, not each user's own — making it non-viable.

### Future Path for Apple Reminders

Apple Reminders support will be delivered via **Capacitor** — a native iOS/macOS app wrapper around the existing Next.js frontend. A Swift Capacitor plugin will bridge EventKit on the user's own device to the app, with data synced back to the backend via API. This is the correct architecture for per-user, device-local Reminders access.

- `eventkit-node` (Node.js native addon) is **not** reusable for Capacitor — Capacitor uses Swift plugins (completely different bridge mechanism).
- The Capacitor integration path is tracked as a future feature issue.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Connect Apple Calendar (Priority: P1) *(originally included Apple Reminders — see Scope Revision)*

A user navigates to the integration settings page and selects Apple Calendar. Instead of being redirected to an Apple OAuth consent screen, they are presented with a credential entry form. The form explains what an App-Specific Password is and provides clear guidance on how to generate one. The user enters their iCloud email address and an App-Specific Password, then submits the form. The system validates the credentials against iCloud, stores them securely, confirms the integration is connected, and the user proceeds to select which Calendars to import.

**Why this priority**: This is the foundational fix. Apple integrations are currently non-functional because Sign in with Apple tokens are identity-only — they cannot access iCloud CalDAV data. Without this story, no Apple sync is possible.

**Independent Test**: Can be fully tested by navigating to integration settings, connecting Apple Calendar with valid iCloud credentials, and verifying the integration shows as "connected" with Calendars available for selection.

**Acceptance Scenarios**:

1. **Given** Apple Calendar is not connected, **When** the user clicks "Connect" on the Apple Calendar card, **Then** a credential entry form is displayed — no OAuth redirect occurs.
2. **Given** the credential entry form is displayed, **When** the user submits a valid iCloud email and a valid App-Specific Password, **Then** the integration status becomes "connected" and the user is taken to the sub-source selection step.
3. **Given** the credential entry form is displayed, **When** the user submits an invalid iCloud email or an incorrect App-Specific Password, **Then** a clear error message is shown and the integration is not marked as connected.
4. ~~**Given** Apple Reminders is already connected, **When** the user navigates to connect Apple Calendar, **Then** a one-click confirmation screen is displayed showing the masked iCloud email address already on file, with a single "Connect with this account" button. No credential re-entry is required.~~ *(Scenario removed — Apple Reminders was removed from the web app; see Scope Revision)*
5. **Given** the credential entry form is displayed, **When** the user views the form, **Then** guidance for generating an App-Specific Password at appleid.apple.com is clearly visible alongside the input fields.

---

### User Story 2 — Sync Apple Calendar Events (Priority: P1) *(originally included Apple Reminders — see Scope Revision)*

After connecting Apple Calendar, the system fetches the user's upcoming events from iCloud. Events created or updated in Apple Calendar on any device appear in ordrctrl after a sync cycle.

**Why this priority**: This is the core value delivery. The integration exists to surface Apple Calendar data in ordrctrl; a successful connection that never syncs real data has no value to the user.

**Independent Test**: Can be tested independently by pre-seeding valid iCloud credentials and triggering a sync, then verifying that events from iCloud appear in ordrctrl.

**Acceptance Scenarios**:

1. ~~**Given** Apple Reminders is connected, **When** a sync runs, **Then** all incomplete tasks from selected Reminder lists appear in ordrctrl.~~ *(Removed — see Scope Revision)*
2. **Given** Apple Calendar is connected, **When** a sync runs, **Then** upcoming events from selected Calendars appear in ordrctrl.
3. ~~**Given** Apple Reminders is connected with selective import enabled, **When** a sync runs, **Then** only tasks from the user's chosen Reminder lists are included.~~ *(Removed — see Scope Revision)*
4. **Given** Apple Calendar is connected with selective import enabled, **When** a sync runs, **Then** only events from the user's chosen Calendars are included.
5. ~~**Given** Apple Reminders is connected, **When** the user requests the list of Reminder lists, **Then** all available Reminder lists from their iCloud account are returned as selectable sub-sources.~~ *(Removed — see Scope Revision)*
6. **Given** Apple Calendar is connected, **When** the user requests the list of Calendars, **Then** all available Calendars from their iCloud account are returned as selectable sub-sources.

---

### User Story 3 — Reconnect After Credential Change (Priority: P2)

A user whose App-Specific Password has been revoked (for security rotation, device change, or accidental deletion) can reconnect the Apple integration by providing new credentials. The system reflects the error state promptly and allows re-entry of credentials to restore sync.

**Why this priority**: App-Specific Passwords are actively managed by users and can be revoked at any time. Without graceful handling of credential expiry, the integration breaks silently and the user has no recovery path.

**Independent Test**: Can be tested by connecting with valid credentials, revoking the App-Specific Password externally, triggering a sync, verifying the error state is set, then reconnecting with new credentials and confirming sync resumes.

**Acceptance Scenarios**:

1. **Given** an Apple integration is connected and a sync runs, **When** the stored App-Specific Password has been revoked at appleid.apple.com, **Then** the integration status is set to an error state with a message indicating credentials are no longer valid.
2. **Given** an Apple integration is in an error state due to invalid credentials, **When** the user clicks "Reconnect" and submits new valid credentials, **Then** the integration returns to "connected" status and syncing resumes.
3. **Given** an Apple Calendar integration is connected, **When** the user disconnects it, **Then** all stored iCloud credentials for that user are permanently removed from the system.
4. ~~**Given** both Apple Reminders and Apple Calendar are connected, **When** the user disconnects only Apple Reminders, **Then** the iCloud credentials are retained because Apple Calendar still requires them.~~ *(Removed — Apple Reminders no longer in web app; see Scope Revision)*

---

### Edge Cases

- What happens when an App-Specific Password is entered with separator characters (Apple displays them grouped as `xxxx-xxxx-xxxx-xxxx`)? The system should accept both the formatted and unformatted versions.
- What happens if the iCloud CalDAV service is temporarily unavailable during a sync? Credentials must not be deleted — the integration enters an error state and retries on the next scheduled sync cycle.
- ~~What happens when both Apple Reminders and Apple Calendar are connected, and credentials become invalid?~~ *(Removed — see Scope Revision)*
- What happens if the user attempts to connect with an `@me.com` or `@mac.com` Apple ID alias rather than their primary `@icloud.com` address? The system should accept any valid Apple ID login format.
- What happens when a user has no Calendars? The sub-source selection step should display an appropriate empty state rather than failing.

## Requirements *(mandatory)*

### Functional Requirements

**Authentication & Connect Flow**

- **FR-001**: Apple Calendar integrations MUST authenticate with iCloud using the user's iCloud email address and an App-Specific Password. *(Apple Reminders removed from web app — see Scope Revision)*
- **FR-002**: The connection flow for Apple Calendar MUST present the user with a credential entry form — not an OAuth redirect to a third-party authorization page.
- ~~**FR-002b**: When the user connects a second Apple service and iCloud credentials from the first are already on file, the connection flow MUST display a one-click confirmation screen showing the masked iCloud email address already stored, with a single "Connect with this account" button. No credential re-entry is required.~~ *(Removed — Apple Reminders removed; only one Apple service remains in web app)*
- **FR-003**: The credential entry form MUST include in-context guidance explaining what an App-Specific Password is and providing a direct reference to the Apple ID account portal where App-Specific Passwords are generated.
- **FR-004**: The system MUST validate the provided credentials against iCloud before confirming the integration as connected.
- **FR-005**: The integration adapter connect interface MUST distinguish between OAuth-based connections (identified by an authorization code) and credential-based connections (identified by email and password) via a typed payload that explicitly declares which pattern is in use. All existing OAuth adapters (Gmail, Microsoft) continue operating with their existing authorization code flow unchanged. Apple adapters MUST explicitly reject calls to OAuth-specific operations — specifically token refresh and authorization URL generation — with a clear "not supported" error, so any accidental invocation fails immediately and visibly rather than silently misbehaving.

**Credential Storage**

- **FR-006**: iCloud credentials (email address and App-Specific Password) MUST be stored encrypted at rest, using the same encryption standard applied to all other integration credentials in the system.
- ~~**FR-007**: Both the Apple Reminders and Apple Calendar integration records for a given user MUST each store an independent, identical encrypted copy of the iCloud credentials. The service layer MUST enforce credential consistency when the second Apple service is connected.~~ *(Removed — Apple Reminders removed; only Apple Calendar stores credentials)*
- **FR-008**: When a user disconnects Apple Calendar, the stored iCloud credentials MUST be permanently purged from that user's Integration record.

**Sync**

- ~~**FR-009**: After connecting, Apple Reminders MUST be able to retrieve the user's Reminder lists from iCloud and present them as selectable sub-sources for import filtering.~~ *(Removed — see Scope Revision)*
- **FR-010**: After connecting, Apple Calendar MUST be able to retrieve the user's Calendars from iCloud and present them as selectable sub-sources for import filtering.
- ~~**FR-011**: Apple Reminders sync MUST fetch incomplete tasks from iCloud and normalize them to the system's standard item format.~~ *(Removed — see Scope Revision)*
- **FR-012**: Apple Calendar sync MUST fetch upcoming events from iCloud within the user's configured time window and normalize them to the system's standard item format.
- **FR-016**: The system MUST provide a per-user configurable time window for Apple Calendar upcoming events, with selectable values of 7, 14, 30, or 60 days. The default for new connections is 30 days. The Apple Calendar adapter reads this preference at each sync cycle.
- **FR-013**: Apple Calendar MUST support selective sub-source filtering (specific Calendars), consistent with the behavior of all other integration adapters.

**Error Handling**

- **FR-014**: When stored iCloud credentials are rejected by iCloud (e.g., App-Specific Password revoked), the integration status MUST be updated to an error state and the user MUST be notified that their credentials need to be refreshed.
- **FR-015**: A temporary iCloud service outage MUST NOT result in credential deletion. The integration MUST retain its credentials and retry on the next scheduled sync cycle.

### Key Entities

- **Apple iCloud Credential**: A pair of values — an iCloud account email address and an App-Specific Password — that authorizes access to iCloud CalDAV services on behalf of a user. Used exclusively for Apple Calendar in the web app. Stored encrypted at rest.
- **App-Specific Password**: An application-scoped password generated by the user through the Apple ID account portal. It grants access to iCloud services without exposing the user's primary Apple ID password and can be independently revoked at any time by the user.
- **Integration**: A record representing a connected external service for a specific user, tracking connection status, encrypted credentials, sub-source filter preferences, last sync time, any sync errors, and (for Apple Calendar) the user's configured upcoming-events time window (7 / 14 / 30 / 60 days; default 30 days for new connections).

## Assumptions

- Users have an active iCloud account.
- Users have Two-Factor Authentication (2FA) enabled on their Apple ID. Apple requires 2FA to be active before App-Specific Passwords can be generated; without it the credential generation page at appleid.apple.com is unavailable.
- The iCloud credential (email + App-Specific Password) used to connect Apple Calendar is valid at the time of connection.
- Apple Calendar data is accessible via the user's iCloud account (i.e., iCloud sync is enabled for Calendar on the user's Apple devices).
- *(Apple Reminders was originally listed here — removed per Scope Revision; requires EventKit/Capacitor on user's device)*

## Clarifications

### Session 2026-03-08

- Q: How should iCloud credentials be stored when both Apple Reminders and Apple Calendar are connected for the same user — shared record, foreign-key reference, or identical copies per Integration row? → A: Both Integration rows store identical encrypted copies of iCloud credentials (email + App-Specific Password). No new schema model is introduced. The service layer enforces credential consistency when the second Apple service is connected; disconnect cleanup cross-checks both rows. *(Note: Apple Reminders was subsequently removed — this design decision applied only to Apple Calendar now)*

- Q: What UX does the user see when connecting a second Apple service when credentials are already on file? → A: A one-click confirmation screen is shown displaying the masked iCloud email already stored, with a single "Connect with this account" button. No credential re-entry is required. *(Note: Apple Reminders removed from web app; confirmation screen code retained but dormant)*

- Q: What should the connect() adapter interface contract look like to accommodate both OAuth and credential-based flows without breaking existing adapters? → A: A discriminated union payload: `connect(payload: OAuthPayload | CredentialPayload)` where `OAuthPayload = { type: 'oauth'; authCode: string }` and `CredentialPayload = { type: 'credential'; email: string; password: string }`. All existing OAuth adapters (Gmail, Microsoft) wrap their authorization code in the `oauth` variant; no breaking change to those adapters.

- Q: How should Apple adapters handle calls to OAuth-only operations (token refresh, authorization URL generation) that do not apply to credential-based adapters? → A: `refreshToken()` and `getAuthorizationUrl()` on Apple adapters throw `NotSupportedError` with the message "not supported for credential-based adapters". This makes accidental invocation fail fast and visibly.

- Q: What time window should the Apple Calendar adapter use when fetching upcoming events, and should it be fixed or configurable? → A: Configurable per user. A user setting exposes options of 7, 14, 30, or 60 days. The adapter reads the preference at each sync cycle. The default for new connections is 30 days.

### Session 2026-03-09

- Q: Why was Apple Reminders removed from the web app after initial implementation? → A: Apple Reminders is not accessible via CalDAV — it requires EventKit, a native macOS/iOS framework. The CalDAV approach only surfaces the deprecated default iCloud Reminders list; users' actual lists in Gmail/Exchange/local accounts are invisible. EventKit cannot be used remotely from a web server in a multi-user context. Apple Reminders will be supported via a future Capacitor iOS/macOS native app.

- Q: Can CalDAV still be used for Apple Calendar? → A: Yes. Apple Calendar is fully accessible via CalDAV (iCloud CalDAV server at caldav.icloud.com). This is a standard protocol supported by iCloud and works from any web server backend.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- ~~**SC-001**: A user with a valid iCloud account and App-Specific Password can fully connect Apple Reminders — from clicking "Connect" through credential entry, validation, and reaching the sub-source selection screen — in under 2 minutes.~~ *(Removed — Apple Reminders not in web app; see Scope Revision)*
- **SC-002**: A user with a valid iCloud account and App-Specific Password can fully connect Apple Calendar in under 2 minutes.
- ~~**SC-003**: After connecting, tasks created or updated in Apple Reminders appear in ordrctrl within one scheduled sync cycle.~~ *(Removed — Apple Reminders not in web app; see Scope Revision)*
- **SC-004**: After connecting, events created or updated in Apple Calendar appear in ordrctrl within one scheduled sync cycle.
- **SC-005**: 100% of Apple Calendar connection failures caused by the OAuth-based flow are eliminated — Apple Calendar transitions from non-functional to fully operational.
- **SC-006**: Users who enter incorrect iCloud credentials receive a descriptive error message and can correct and resubmit without losing settings or requiring a page reload.
- ~~**SC-007**: Connecting one Apple service (Reminders or Calendar) does not require re-entering iCloud credentials to connect the second Apple service.~~ *(Removed — only one Apple service in web app; see Scope Revision)*
- **SC-008**: No regression in non-Apple integration behavior — Gmail and Microsoft Tasks connection, sync, sub-source selection, and disconnect all operate identically before and after this change.
- **SC-009**: All existing sub-source selection behavior (selective import of Calendars) is preserved and functional for Apple Calendar after the rework.
