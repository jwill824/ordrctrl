# API Contracts: Inbound Source Sync (007)

## New Endpoint

### PATCH /api/integrations/gmail/completion-mode

Update the Gmail completion mode for the authenticated user's Gmail integration.

**Request body:**
```json
{
  "completionMode": "inbox_removal" | "read"
}
```

**Response 200:**
```json
{
  "serviceId": "gmail",
  "completionMode": "inbox_removal"
}
```

**Response 400 — invalid mode:**
```json
{
  "error": "Invalid completion mode. Must be 'inbox_removal' or 'read'."
}
```

**Response 404 — no Gmail integration connected:**
```json
{
  "error": "Gmail integration not found."
}
```

---

## Modified Endpoints

### GET /api/integrations

The integration list response now includes `gmailCompletionMode` for Gmail integrations.

**Response (Gmail integration entry):**
```json
{
  "serviceId": "gmail",
  "status": "connected",
  "lastSyncAt": "2026-03-10T18:00:00Z",
  "gmailSyncMode": "starred_only",
  "gmailCompletionMode": "inbox_removal",
  "importEverything": true,
  "selectedSubSourceIds": []
}
```

---

## Unchanged Endpoints

All feed endpoints (`GET /api/feed`, `PATCH /api/feed/items/:id/complete`, etc.) are unchanged.
Source-driven completion flows through the sync layer — the feed API has no awareness of how
items became complete, only their `completedInOrdrctrl` state.
