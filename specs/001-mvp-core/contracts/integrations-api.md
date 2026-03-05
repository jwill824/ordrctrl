# Contract: Integrations API

**Version**: 1.0 | **Date**: 2026-03-05 | **Base path**: `/api/integrations`
**Auth required**: All endpoints require an active session cookie.

## Supported service IDs

`gmail` | `apple_reminders` | `microsoft_tasks` | `apple_calendar`

---

### GET /api/integrations

List all four integrations with their current connection status for the authenticated user.

**Response (200)**:
```json
{
  "integrations": [
    {
      "serviceId": "gmail",
      "status": "connected",
      "lastSyncAt": "2026-03-05T01:30:00Z",
      "lastSyncError": null,
      "gmailSyncMode": "starred_only"
    },
    {
      "serviceId": "apple_reminders",
      "status": "disconnected",
      "lastSyncAt": null,
      "lastSyncError": null,
      "gmailSyncMode": null
    },
    {
      "serviceId": "microsoft_tasks",
      "status": "error",
      "lastSyncAt": "2026-03-04T10:00:00Z",
      "lastSyncError": "Token refresh failed. Please reconnect.",
      "gmailSyncMode": null
    },
    {
      "serviceId": "apple_calendar",
      "status": "disconnected",
      "lastSyncAt": null,
      "lastSyncError": null,
      "gmailSyncMode": null
    }
  ]
}
```

---

### GET /api/integrations/:serviceId/connect

Initiate the OAuth authorization flow for a specific integration.
Redirects the user to the provider's authorization page.

**Path params**: `serviceId` — one of the supported service IDs

**Query params (Gmail only)**: `syncMode` — `all_unread` | `starred_only` (default: `starred_only`)

**Responses**:
| Status | Meaning |
|--------|---------|
| 302 | Redirect to provider OAuth URL |
| 400 | Unknown serviceId |
| 409 | Integration already connected — suggest reconnect |

---

### GET /api/integrations/:serviceId/callback

Handle the OAuth redirect callback from the provider. Called by the browser after user
approves the integration.

**Query params**: `code`, `state`

**Responses**:
| Status | Meaning |
|--------|---------|
| 302 | Redirect to `/onboarding?connected=<serviceId>` on success |
| 302 | Redirect to `/onboarding?error=<serviceId>&reason=denied` on user denial |
| 400 | Invalid state parameter (CSRF check) |

---

### DELETE /api/integrations/:serviceId

Disconnect an integration. Revokes OAuth tokens and deletes all cached data.

**Path params**: `serviceId`

**Responses**:
| Status | Meaning |
|--------|---------|
| 204 | Disconnected; tokens and cache cleared |
| 404 | Integration not found or already disconnected |

---

### POST /api/integrations/:serviceId/reconnect

Re-initiate the OAuth flow for an already-connected integration (re-authorization).
Equivalent to connect but replaces existing credentials.

**Responses**: Same as `GET /connect` — redirects to provider.

---

### POST /api/integrations/sync

Manually trigger an immediate sync of all connected integrations for the user.
Returns immediately; sync runs asynchronously in the background queue.

**Responses**:
| Status | Meaning |
|--------|---------|
| 202 | Sync jobs queued |
| 200 | No connected integrations (nothing to sync) |
