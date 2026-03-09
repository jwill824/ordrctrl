# Research: Apple iCloud Integration via App-Specific Password

**Feature**: 004-apple-basic-auth  
**Phase**: 0 — Outline & Research  
**Status**: Complete — all NEEDS CLARIFICATION resolved  
**Scope Revision (2026-03-09)**: Apple Reminders removed from web app. Decisions 6–7 and 10 partially revised — see notes inline.

---

## 1. iCloud CalDAV Basic Auth Mechanics

### Decision
Use HTTP Basic Auth (`Authorization: Basic base64(email:asp)`) against `https://caldav.icloud.com`. Validate credentials at connect time by issuing a `PROPFIND /` request with `Depth: 1`; a `207 Multi-Status` response confirms valid credentials and returns the principal collection URLs in one round-trip.

### Rationale
- The existing Apple adapters already target `https://caldav.icloud.com` and perform `PROPFIND` queries for service discovery. Basic Auth slots directly into those HTTP calls by adding an `Authorization` header — no library change required.
- A `PROPFIND /` with `Depth: 1` at connect time serves dual purpose: credential validation _and_ principal URL discovery, eliminating a separate "check credentials" endpoint.
- iCloud CalDAV returns HTTP `401 Unauthorized` with `WWW-Authenticate: Basic realm="..."` on invalid credentials; this is unambiguous and easy to detect.

### Alternatives Considered
- **Separate validation endpoint**: Apple does not expose a lightweight "check credentials" API outside CalDAV. Using a HEAD request on the root does not return meaningful auth feedback from iCloud. Rejected.
- **Sign in with Apple OAuth (current)**: Apple ID tokens are identity-only (`sub`, `email`) and do not grant iCloud data access. This is the root cause of the current breakage. Rejected.

### Implementation Note
```
PROPFIND https://caldav.icloud.com/ HTTP/1.1
Authorization: Basic <base64(email:normalizedAsp)>
Depth: 1
Content-Type: application/xml; charset=utf-8

Body: standard PROPFIND for resourcetype, displayname, current-user-principal
```
Expected success: `207 Multi-Status` containing a `<C:calendar-home-set>` href  
Expected failure: `401 Unauthorized` → throw `InvalidCredentialsError`  
Transient failure: `5xx` / network timeout → throw `ProviderUnavailableError` (credentials retained)

---

## 2. App-Specific Password Format Normalization

### Decision
Strip all hyphen characters from the ASP before Base64-encoding and before storage. Regex: `asp.replace(/-/g, '')`. Accept both formatted (`abcd-efgh-ijkl-mnop`) and unformatted (`abcdefghijklmnop`) input.

### Rationale
- Apple displays App-Specific Passwords in the format `xxxx-xxxx-xxxx-xxxx` (16 lowercase alpha characters, 3 visual separators). Users copy-paste this exact format from the Apple ID portal.
- iCloud CalDAV accepts the raw 16-char form without separators. Normalizing on input means the stored credential and the HTTP header are always in canonical form.
- Normalizing at the service boundary (before encryption) keeps the adapter simple and avoids double-normalization.

### Alternatives Considered
- **Accept only raw form**: Requires user to manually strip dashes after copying from Apple ID portal. Poor UX; spec edge case explicitly requires accepting formatted input.
- **Store formatted, strip at use time**: More code paths; inconsistent storage. Rejected.

---

## 3. Credential Field Mapping (No Schema Change for Credentials)

### Decision
Map iCloud credentials onto the existing `Integration` fields:
- `encryptedAccessToken` → encrypted iCloud email address
- `encryptedRefreshToken` → encrypted (normalized) App-Specific Password
- `tokenExpiresAt` → `null` (credentials do not have an expiry; they are revoked, not expired)

### Rationale
- These fields already exist and are encrypted at rest via `encrypt()` / `decrypt()` (AES-256-GCM). No new model, no migration for credential storage.
- Semantically close enough: "access token" is the identifier (email), "refresh token" is the secret (ASP). Both align with the existing "credential" mental model in the codebase.
- The `@@unique([userId, serviceId])` constraint on `Integration` already enforces one record per Apple service per user — which is exactly the "independent identical copies" model required by FR-007.

### Alternatives Considered
- **Shared credential entity**: Would require a new `AppleCredential` model and foreign key on `Integration`. Over-engineered; the spec explicitly ruled this out.
- **Store as JSON in a single field**: Loses Prisma type safety; complicates encryption. Rejected.

---

## 4. Discriminated Union `connect()` Interface

### Decision
Update `IntegrationAdapter.connect()` to accept a discriminated union payload as second argument:

```typescript
export type OAuthPayload   = { type: 'oauth';      authCode: string };
export type CredentialPayload = { type: 'credential'; email: string; password: string };
export type ConnectPayload = OAuthPayload | CredentialPayload;

// Updated signature:
connect(userId: string, payload: ConnectPayload, options?: ConnectOptions): Promise<{ integrationId: string }>;
```

All existing OAuth adapters (Gmail, Microsoft Tasks) are updated at their `connect()` implementations to destructure `payload.authCode` from an `OAuthPayload`. The service layer (`connectIntegration()`) and route handler construct the correct payload variant.

### Rationale
- TypeScript discriminated unions give compile-time safety: the Apple adapters can type-narrow on `payload.type === 'credential'` and TypeScript will reject any code that tries to pass an `OAuthPayload` to them.
- Backward-compatible migration: Gmail and Microsoft adapters change only the `connect()` signature line and one destructure — no logic changes.
- The `type` field makes intent explicit in logs, errors, and route handlers — no guessing from string shape.

### Alternatives Considered
- **Overloaded `connect()` with optional `email`/`password` params**: Leads to nullable params, weaker types, and unclear which params apply to which adapter type. Rejected.
- **Separate `connectWithCredentials()` method on the interface**: Breaks the uniform interface contract (Constitution Principle I). Rejected.
- **Subtype interface `CredentialAdapter`**: Overkill for two adapters; would require service layer to type-check the adapter instance. Rejected.

---

## 5. `NotSupportedError` for Apple OAuth Methods

### Decision
Add a `NotSupportedError` class to `backend/src/integrations/_adapter/types.ts`. Apple adapters throw it from `getAuthorizationUrl()` and `refreshToken()`:

```typescript
export class NotSupportedError extends Error {
  constructor(message = 'not supported for credential-based adapters') {
    super(message);
    this.name = 'NotSupportedError';
  }
}
```

### Rationale
- Spec (FR-005) and clarification session explicitly require fail-fast behavior on accidental invocation of OAuth-only methods.
- A named error class (vs. a generic `Error`) lets callers type-narrow if they ever need to handle this case gracefully (e.g., the background token-refresh job should skip credential-based adapters).
- Centralizing the class in `types.ts` keeps it alongside the interface — consistent with `TokenRefreshError` already defined there.

### Alternatives Considered
- **Return `null` or no-op**: Silently wrong; violates fail-fast principle. Rejected.
- **Remove the methods from Apple adapter classes**: TypeScript would complain since the interface requires them. Keeping them as explicit throws is cleaner and self-documenting.

---

## 6. Second Apple Service — Credential Propagation *(Dormant — Apple Reminders removed)*

### Decision
The service layer (`connectIntegration()`) detects existing Apple credentials **before** calling the adapter. If the user is connecting `apple_calendar` and `apple_reminders` is already connected (or vice versa), the service copies the encrypted credential values from the existing Integration record and calls `adapter.connect()` with a `CredentialPayload` constructed from those decrypted values. This is transparent to the adapter.

Frontend signals intent via the `type` field: `{ type: 'use-existing' }` triggers the service-layer lookup; `{ type: 'credential', email, password }` provides fresh credentials.

```typescript
// Extended payload (frontend → API only; service layer resolves before calling adapter):
export type UseExistingPayload = { type: 'use-existing' };
// Service layer resolves UseExistingPayload → CredentialPayload before calling adapter.connect()
```

> **⚠️ Scope Revision (2026-03-09)**: Apple Reminders was removed from the web app. The `use-existing` mechanism is retained in the codebase but has no active trigger path — there is only one Apple service in the web app (`apple_calendar`). This mechanism will activate when Capacitor adds a second Apple service (e.g., an Apple Reminders integration via Swift EventKit plugin).

### Rationale
- The adapter never needs to know about credential sharing — it always receives a resolved `CredentialPayload`. This keeps adapters isolated (Constitution Principle I).
- Decryption happens in the service layer where `encrypt()`/`decrypt()` are already used; no new trust boundary.
- The one-click confirmation screen (FR-002b) is purely a frontend concern — it shows masked email from `listIntegrations()` response and submits `{ type: 'use-existing' }`.

### API surface for masked email
`IntegrationStatusItem` gains a `maskedEmail: string | null` field. Backend masks by taking the email's local part, showing first char + `***` + `@domain`: `j***@icloud.com`. Field is non-null only for `apple_calendar` with credentials on file.

---

## 7. Disconnect Cleanup — Cross-Check Logic *(Simplified — Apple Reminders removed)*

### Decision
On `disconnectIntegration(userId, serviceId)` for `apple_calendar`, the service layer:
1. Marks the Integration as `disconnected` and clears its `encryptedAccessToken` / `encryptedRefreshToken`.
2. ~~Queries for any other Apple Integration records for the same user that are still `connected`.~~ *(Removed — only one Apple service exists)*
3. Credentials are always purged on Apple Calendar disconnect.

> **⚠️ Scope Revision (2026-03-09)**: The original cross-check logic queried for a sibling Apple service before deciding whether to purge credentials. Since Apple Reminders was removed, `apple_calendar` is the only Apple service and credentials are always purged on disconnect. The cross-check logic stub is retained in the service layer but simplified.

This logic lives entirely in `integrations.service.ts` — the adapter's `disconnect()` method handles only CalDAV session cleanup (no token revocation needed for Basic Auth).

### Rationale
- FR-008 requirement. Centralizing in the service layer keeps the adapter lean.
- Basic Auth has no server-side session to revoke (unlike OAuth); `disconnect()` only needs to clear local state.

---

## 8. Per-User Apple Calendar Event Window

### Decision
Add `calendarEventWindowDays Int @default(30)` to the `Integration` Prisma model. Valid values: `7 | 14 | 30 | 60`. Exposed via:
- Set at connect time: `POST /api/integrations/apple_calendar/connect` body may include `calendarEventWindowDays`
- Updated post-connect: `PUT /api/integrations/:serviceId/event-window` with `{ days: 7 | 14 | 30 | 60 }`
- Returned in `IntegrationStatusItem.calendarEventWindowDays`

The adapter reads `integration.calendarEventWindowDays` at each sync to build the CalDAV time-range filter.

### Rationale
- FR-016 requires persistence across sessions and sync cycles — it must live in the database.
- Mirrors the `gmailSyncMode` pattern already in the codebase (field on Integration, dedicated update function in service layer, returned in status response).
- Default of 30 days matches spec requirement; `@default(30)` in Prisma means existing rows (if any) automatically get 30.

### Alternatives Considered
- **Pass via `ConnectOptions` only**: Lost after connect; not user-updatable. Rejected.
- **UserPreferences model**: Overkill for a single int per Apple Calendar integration. Rejected (see Complexity Tracking in plan.md).

---

## 9. 401 vs Transient Error Discrimination

### Decision
In both Apple adapters' `sync()` and connect validation:
- HTTP `401` from `caldav.icloud.com` → `InvalidCredentialsError` → service layer sets `integration.status = 'error'`, `integration.lastSyncError = 'iCloud credentials are no longer valid. Please reconnect.'`
- HTTP `5xx`, network timeout, DNS failure → `ProviderUnavailableError` → service layer sets `integration.status = 'error'`, `integration.lastSyncError = 'iCloud is temporarily unavailable. Will retry on next sync.'`
- `ProviderUnavailableError` explicitly does **not** clear credentials (FR-015).

```typescript
// In adapter sync():
if (response.status === 401) throw new InvalidCredentialsError(integrationId);
if (!response.ok)            throw new ProviderUnavailableError(integrationId, response.status);
```

Both error classes extend `Error` and are defined in `types.ts`.

### Rationale
- The service layer's sync job already catches `TokenRefreshError`; the same pattern applies for `InvalidCredentialsError`.
- Separating the two error types lets the service layer apply different recovery strategies: clear credentials on auth failure, retain on transient failure.

---

## 10. Frontend Credential Form Design *(Apple Reminders removed — see Scope Revision)*

### Decision
Two components exist:
- **`AppleCredentialForm`** — email input (type=`email`) + password input (type=`password`) + a callout block: "What is an App-Specific Password? [Generate one at appleid.apple.com ↗]". Submits via `POST /api/integrations/:serviceId/connect`. Active for `apple_calendar`.
- **`AppleConfirmationScreen`** — shows masked email from `integration.maskedEmail` + "Connect with this account" button. Retained in codebase but **dormant** — `siblingMaskedEmail` will always be null since there is no second Apple service in the web app.

`IntegrationCard` renders `AppleCredentialForm` for `apple_calendar`. OAuth connect button path unchanged for non-Apple services.

> **⚠️ Scope Revision (2026-03-09)**: Apple Reminders was removed. `AppleConfirmationScreen` is retained for future Capacitor use but never rendered. `IntegrationCard` now only branches on `serviceId === 'apple_calendar'`.

### Rationale
- Spec US-1 AC-5 requires visible App-Specific Password guidance. A callout block in the form (not a modal or separate page) is the minimal-surface approach.
- `type=password` for the ASP input ensures browser password managers won't auto-fill — Apple ASPs are single-use per app, not reusable passwords.
- Two separate small components rather than one large conditional component — easier to test, easier to iterate.

---

## 11. Apple Reminders — CalDAV Not Viable *(Discovered 2026-03-09)*

### Decision
Apple Reminders cannot be accessed via CalDAV from a web server. The adapter was deleted. Future support requires **Capacitor** with a Swift EventKit plugin running on the user's own iOS/macOS device.

### Rationale
- CalDAV on iCloud only surfaces the deprecated default Reminders list (iCloud-synced lists). Users' actual Reminder lists are stored in Gmail, Exchange, or device-local accounts and are completely invisible via CalDAV.
- Apple Reminders requires **EventKit**, a native macOS/iOS framework. EventKit reads the Reminders database of the OS user running the process — not a remote user's data.
- For a multi-user web app deployed on a server, EventKit would access the **server's** Reminders, not each user's own Reminders. This is a fundamental architectural mismatch.
- `eventkit-node` (the Node.js native addon) was evaluated and removed — it is not reusable for Capacitor (different bridge mechanism: Capacitor uses Swift plugins, not Node native addons).

### Impact
- `apple-reminders/` adapter directory deleted.
- `apple_reminders` removed from `ServiceId`, adapter registry, all `SERVICE_IDS` arrays, schemas, and feed service.
- `eventkit-node` uninstalled from `backend/package.json`.
- `SystemPermissionPayload` and `/api/integrations/capabilities` endpoint removed.
- Future: tracked as a GitHub issue for Capacitor iOS/macOS implementation.

---

## Summary of All Decisions

| # | Topic | Decision |
|---|-------|----------|
| 1 | CalDAV auth | HTTP Basic Auth; PROPFIND / for credential validation |
| 2 | ASP normalization | Strip hyphens before storage and use |
| 3 | Credential storage | Reuse `encryptedAccessToken` (email) + `encryptedRefreshToken` (ASP) |
| 4 | Interface | Discriminated union `OAuthPayload \| CredentialPayload`; OAuth adapters wrap `authCode` |
| 5 | NotSupportedError | Named class in `types.ts`; thrown from Apple adapter OAuth methods |
| 6 | Second Apple service | `UseExistingPayload` retained but dormant; maskedEmail in status response *(Apple Reminders removed)* |
| 7 | Disconnect cleanup | Credentials always purged on `apple_calendar` disconnect *(simplified — only one Apple service)* |
| 8 | Event window | New `calendarEventWindowDays Int @default(30)` field; `PUT /event-window` endpoint |
| 9 | Error discrimination | `InvalidCredentialsError` (401) vs `ProviderUnavailableError` (5xx/timeout) |
| 10 | Frontend | `AppleCredentialForm` active; `AppleConfirmationScreen` retained but dormant *(Apple Reminders removed)* |
| 11 | Apple Reminders | Removed — CalDAV not viable; requires EventKit/Capacitor on user's device *(2026-03-09)* |
