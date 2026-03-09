# API Contracts: Apple iCloud Integration via App-Specific Password

**Feature**: 004-apple-basic-auth  
**Phase**: 1 — Design & Contracts  
**Base URL**: `/api/integrations`  
**Auth**: All endpoints require `requireAuth()` session middleware (existing).

---

## Overview of Changes

| Change | Scope | Description |
|--------|-------|-------------|
| **Modified** | `GET /api/integrations` | Response adds `maskedEmail` and `calendarEventWindowDays` fields |
| **New** | `POST /api/integrations/:serviceId/connect` | Credential-based connect for Apple services |
| **New** | `PUT /api/integrations/:serviceId/event-window` | Update Apple Calendar event window preference |
| **Unchanged** | `GET /api/integrations/:serviceId/connect` | OAuth redirect (Apple services no longer hit this) |
| **Unchanged** | `GET|POST /api/integrations/:serviceId/callback` | OAuth callback (Apple no longer uses this) |
| **Unchanged** | `DELETE /api/integrations/:serviceId` | Disconnect (enhanced disconnect cleanup logic) |
| **Unchanged** | `POST /api/integrations/sync` | Trigger manual sync |
| **Unchanged** | `GET /api/integrations/:serviceId/sub-sources` | List sub-sources |
| **Unchanged** | `PUT /api/integrations/:serviceId/import-filter` | Update import filter |

---

## `GET /api/integrations`

List all integration statuses for the authenticated user.

### Response `200 OK`

```json
[
  {
    "serviceId": "apple_reminders",
    "status": "connected",
    "lastSyncAt": "2026-03-08T10:30:00Z",
    "lastSyncError": null,
    "gmailSyncMode": null,
    "calendarEventWindowDays": null,
    "maskedEmail": "j***@icloud.com",
    "importEverything": false,
    "selectedSubSourceIds": ["list-abc123", "list-def456"]
  },
  {
    "serviceId": "apple_calendar",
    "status": "disconnected",
    "lastSyncAt": null,
    "lastSyncError": null,
    "gmailSyncMode": null,
    "calendarEventWindowDays": null,
    "maskedEmail": null,
    "importEverything": true,
    "selectedSubSourceIds": []
  },
  {
    "serviceId": "gmail",
    "status": "connected",
    "lastSyncAt": "2026-03-08T10:29:00Z",
    "lastSyncError": null,
    "gmailSyncMode": "all_unread",
    "calendarEventWindowDays": null,
    "maskedEmail": null,
    "importEverything": true,
    "selectedSubSourceIds": []
  },
  {
    "serviceId": "microsoft_tasks",
    "status": "disconnected",
    "lastSyncAt": null,
    "lastSyncError": null,
    "gmailSyncMode": null,
    "calendarEventWindowDays": null,
    "maskedEmail": null,
    "importEverything": true,
    "selectedSubSourceIds": []
  }
]
```

### Field Notes
- `maskedEmail`: Non-null only for Apple services (`apple_reminders`, `apple_calendar`) when credentials exist (any status other than first-time disconnected). Format: `{first_char}***@{domain}`. Example: `"j***@icloud.com"`.
- `calendarEventWindowDays`: Non-null only for `apple_calendar` integrations that are `connected` or `error`. Null when `disconnected` (no record). Value is always one of `7 | 14 | 30 | 60`.
- **Frontend use**: The frontend reads `maskedEmail` from the Apple Reminders status to display the confirmation screen when connecting Apple Calendar (and vice versa).

---

## `POST /api/integrations/:serviceId/connect` ← **NEW**

Connect an integration using credentials (Apple services) or confirm using existing credentials (second Apple service). This endpoint replaces the OAuth `GET /connect` + `GET|POST /callback` flow for `apple_reminders` and `apple_calendar`.

**Applicable serviceIds**: `apple_reminders`, `apple_calendar`  
**Returns 400** for OAuth-only services (`gmail`, `microsoft_tasks`) — use existing OAuth flow for those.

### Request Body Variants

#### Variant A — Fresh Credentials

```json
{
  "type": "credential",
  "email": "jane.doe@icloud.com",
  "password": "abcd-efgh-ijkl-mnop",
  "calendarEventWindowDays": 30
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `type` | `"credential"` | ✅ | Discriminator |
| `email` | `string` | ✅ | Valid email; accepts @icloud.com, @me.com, @mac.com |
| `password` | `string` | ✅ | App-Specific Password; hyphens accepted (stripped server-side) |
| `calendarEventWindowDays` | `7\|14\|30\|60` | ❌ | Apple Calendar only; defaults to `30` if omitted |

#### Variant B — Use Existing Credentials (One-Click Confirmation)

```json
{
  "type": "use-existing"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `type` | `"use-existing"` | ✅ | Discriminator |

Service layer resolves the existing credentials from the other connected Apple Integration for this user. Returns `409` if no existing Apple credentials are on file.

### Responses

#### `200 OK` — Connection succeeded

```json
{
  "integrationId": "e2f3a4b5-...",
  "serviceId": "apple_reminders",
  "status": "connected"
}
```

#### `400 Bad Request` — Validation failure

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid App-Specific Password format. Expected 16 characters (hyphens are accepted)."
}
```

Other `400` codes: `UNSUPPORTED_SERVICE` (when called for `gmail` or `microsoft_tasks`)

#### `401 Unauthorized` — iCloud rejected the credentials

```json
{
  "code": "INVALID_CREDENTIALS",
  "message": "The iCloud email or App-Specific Password is incorrect. Please check your credentials and try again."
}
```

> **Note**: HTTP 401 here means the provided iCloud credentials are wrong — not that the ordrctrl session is invalid. The ordrctrl session remains valid.

#### `409 Conflict` — No existing credentials to copy (`use-existing` only)

```json
{
  "code": "NO_EXISTING_CREDENTIALS",
  "message": "No iCloud credentials found. Please connect using your email and App-Specific Password."
}
```

#### `503 Service Unavailable` — iCloud temporarily unreachable

```json
{
  "code": "PROVIDER_UNAVAILABLE",
  "message": "iCloud is temporarily unavailable. Please try again in a moment."
}
```

### Implementation Notes
- Password stripped of hyphens by service layer before adapter call.
- Credential validation (PROPFIND to caldav.icloud.com) happens synchronously during this request.
- On success, an immediate sync job is queued (existing behavior, same as OAuth connect).
- If `apple_reminders` is `connected` and user connects `apple_calendar` with `type: "credential"`, the provided credentials **replace** (overwrite) the existing ones for `apple_reminders` too, and both records are kept in sync by the service layer.

---

## `PUT /api/integrations/:serviceId/event-window` ← **NEW**

Update the per-user upcoming events window for Apple Calendar.

**Applicable serviceIds**: `apple_calendar`  
**Returns 400** for other services.  
**Returns 404** if no connected Apple Calendar integration exists for the user.

### Request Body

```json
{
  "days": 14
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `days` | `7\|14\|30\|60` | ✅ | Upcoming events window in days |

### Responses

#### `200 OK`

```json
{
  "serviceId": "apple_calendar",
  "calendarEventWindowDays": 14
}
```

#### `400 Bad Request`

```json
{
  "code": "VALIDATION_ERROR",
  "message": "days must be one of: 7, 14, 30, 60"
}
```

#### `404 Not Found`

```json
{
  "code": "INTEGRATION_NOT_FOUND",
  "message": "No connected Apple Calendar integration found."
}
```

---

## `DELETE /api/integrations/:serviceId` (Enhanced)

Disconnect an Apple integration. Behavior unchanged for non-Apple services.

**Enhanced behavior for Apple services**:
1. Marks Integration as `disconnected`; clears `encryptedAccessToken`, `encryptedRefreshToken`.
2. Checks if any other Apple Integration for this user is still `connected`.
3. If none connected → also clears credentials from any remaining Apple Integration records (e.g., those in `error` state).
4. If another Apple integration is still `connected` → that record's credentials are retained.

Request, response format, and status codes are **unchanged** from the existing contract.

---

## Frontend Service Client Updates (`frontend/src/services/integrations.service.ts`)

New functions to add:

```typescript
/**
 * Connect Apple Reminders or Apple Calendar using fresh iCloud credentials.
 */
export async function connectWithCredentials(
  serviceId: 'apple_reminders' | 'apple_calendar',
  email: string,
  password: string,
  calendarEventWindowDays?: 7 | 14 | 30 | 60,
): Promise<{ integrationId: string; status: string }>;

/**
 * Connect a second Apple service using the existing iCloud credentials already
 * stored for the first connected Apple service.
 */
export async function confirmWithExisting(
  serviceId: 'apple_reminders' | 'apple_calendar',
): Promise<{ integrationId: string; status: string }>;

/**
 * Update Apple Calendar's upcoming events window preference.
 */
export async function updateCalendarEventWindow(
  days: 7 | 14 | 30 | 60,
): Promise<{ calendarEventWindowDays: number }>;
```

---

## Error Handling Matrix

| Scenario | HTTP Status | `code` | User-Facing Message |
|----------|-------------|--------|---------------------|
| Wrong iCloud email or ASP | `401` | `INVALID_CREDENTIALS` | "Incorrect email or App-Specific Password" |
| ASP format wrong (< 16 chars after strip) | `400` | `VALIDATION_ERROR` | "Invalid App-Specific Password format" |
| iCloud temporarily down | `503` | `PROVIDER_UNAVAILABLE` | "iCloud is temporarily unavailable" |
| `use-existing` but no Apple creds on file | `409` | `NO_EXISTING_CREDENTIALS` | "No credentials found — enter credentials" |
| `event-window` on non-`apple_calendar` service | `400` | `UNSUPPORTED_SERVICE` | — |
| No connected integration for `event-window` | `404` | `INTEGRATION_NOT_FOUND` | — |
| ordrctrl session expired (all endpoints) | `401` | `UNAUTHORIZED` | redirect to login |

---

## Unchanged Endpoints (reference)

These endpoints are **not modified** by this feature but are listed for completeness.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/integrations/:serviceId/connect` | Initiate OAuth (Gmail, Microsoft only after this change) |
| `GET` | `/api/integrations/:serviceId/callback` | OAuth callback (Google redirect) |
| `POST` | `/api/integrations/:serviceId/callback` | OAuth callback (Microsoft form_post) |
| `POST` | `/api/integrations/sync` | Trigger manual sync |
| `POST` | `/api/integrations/:serviceId/reconnect` | Re-initiate OAuth (Gmail, Microsoft only) |
| `GET` | `/api/integrations/:serviceId/sub-sources` | List available sub-sources |
| `PUT` | `/api/integrations/:serviceId/import-filter` | Update sub-source import filter |
