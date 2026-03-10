# Integration API Contracts: Multi-Account Support (009)

## Modified Endpoints

### GET /api/integrations

**Current response** (one object per service):
```json
[
  {
    "id": "uuid",
    "serviceId": "gmail",
    "status": "connected",
    "lastSyncAt": "2026-03-10T...",
    "lastSyncError": null,
    "gmailSyncMode": "all_unread",
    "importEverything": true,
    "selectedSubSourceIds": []
  }
]
```

**New response** (one object per account, grouped by serviceId in frontend):
```json
[
  {
    "id": "uuid-1",
    "serviceId": "gmail",
    "accountIdentifier": "personal@gmail.com",
    "label": "Personal",
    "paused": false,
    "status": "connected",
    "lastSyncAt": "2026-03-10T...",
    "lastSyncError": null,
    "gmailSyncMode": "all_unread",
    "importEverything": true,
    "selectedSubSourceIds": []
  },
  {
    "id": "uuid-2",
    "serviceId": "gmail",
    "accountIdentifier": "work@company.com",
    "label": "Work",
    "paused": false,
    "status": "connected",
    "lastSyncAt": "2026-03-10T...",
    "lastSyncError": null,
    "gmailSyncMode": "all_unread",
    "importEverything": false,
    "selectedSubSourceIds": ["INBOX", "label:work"]
  }
]
```

**Notes**: The flat array structure is preserved. Grouping by `serviceId` is done in the frontend `useIntegrations` hook.

---

### GET /api/integrations/:serviceId/connect (modified)

No change to request format. The OAuth callback now stores the `accountIdentifier` alongside tokens.

**Query params** (unchanged):
- `gmailSyncMode` (Gmail only)
- `step` (import filter step)

---

### GET /api/integrations/:serviceId/callback (modified)

No change to the redirect URL. After connecting, the new account is added (not upserted over the existing one).

**Error case — duplicate account**:
- If `(userId, serviceId, accountIdentifier)` already exists, redirect to:
  ```
  /onboarding?error=duplicate_account&serviceId=gmail
  ```

**Error case — account limit**:
- If user already has 5 accounts for this service, redirect to:
  ```
  /onboarding?error=account_limit_reached&serviceId=gmail
  ```

---

### PATCH /api/integrations/:integrationId/label (NEW)

Update the display label (nickname) for a specific account.

**Request:**
```json
{
  "label": "Work"
}
```
- `label`: string, max 50 chars. Empty string clears the label (revert to `accountIdentifier`).

**Response 200:**
```json
{
  "id": "uuid",
  "label": "Work",
  "accountIdentifier": "work@company.com"
}
```

**Response 400** (validation failure):
```json
{ "error": "Validation failed", "details": [{ "path": ["label"], "message": "Max 50 characters" }] }
```

**Response 404** (not found or not owned by user):
```json
{ "error": "Not found" }
```

---

### PATCH /api/integrations/:integrationId/pause (NEW — P3)

Toggle the paused state for a specific account.

**Request:**
```json
{ "paused": true }
```

**Response 200:**
```json
{ "id": "uuid", "paused": true, "status": "connected" }
```

**Response 400** (cannot pause error/disconnected integration):
```json
{ "error": "Cannot pause an integration that is not connected" }
```

---

### DELETE /api/integrations/:integrationId (existing — no URL change)

Already exists as the disconnect route. No URL change.

**Behavior change**: When this is the last account for a service, the service is fully disconnected. When other accounts remain for the service, only this account's data is removed (cascade via FK on SyncCacheItem).

**Response 200:**
```json
{ "message": "Integration disconnected" }
```

---

## Feed Item Changes

### FeedItem.source field (modified)

**Current**: `source` = `SERVICE_DISPLAY_NAMES[serviceId]` (e.g., `"Gmail"`)

**New**: `source` = `integration.label ?? integration.accountIdentifier` (e.g., `"Work"` or `"work@company.com"`)

No new fields added to `FeedItem`. The `source` field becomes account-level rather than service-level. The existing source badge in the UI continues to display this value.

---

## Adapter Interface Changes

### connect() — return accountIdentifier

**Current return:**
```typescript
Promise<{ integrationId: string }>
```

**New return:**
```typescript
Promise<{ integrationId: string; accountIdentifier: string }>
```

All three adapters (Gmail, Microsoft Tasks, Apple Calendar) must return `accountIdentifier`:
- **Gmail**: extract `email` from decoded `id_token` (Google includes email in all OAuth tokens).
- **Microsoft Tasks**: call `GET https://graph.microsoft.com/v1.0/me` → `mail` field.
- **Apple Calendar**: use the `email` field from the credential payload.

### connect() — upsert logic change

**Current**: upsert on `{ userId_serviceId: { userId, serviceId } }` → overwrites existing tokens.

**New**: check for existing `(userId, serviceId, accountIdentifier)` before inserting:
1. If exists → update tokens (reconnect / token refresh scenario).
2. If not exists and count < 5 → create new record.
3. If not exists and count ≥ 5 → throw `AccountLimitError`.
4. If `accountIdentifier` already present under a different row (duplicate connect) → throw `DuplicateAccountError`.
