# API Contracts: Task Inbox (010)

## Base URL

All endpoints are relative to `/api/inbox`. Authentication is session-based (same as all existing routes).

---

## GET /api/inbox

Returns all pending inbox items grouped by source integration.

### Response `200 OK`

```json
{
  "groups": [
    {
      "integrationId": "1ed2b2a9-5dea-42f7-95f6-dc909cecec1b",
      "serviceId": "gmail",
      "accountLabel": null,
      "accountIdentifier": "personal@gmail.com",
      "items": [
        {
          "id": "inbox:abc123",
          "externalId": "msg-001",
          "title": "Project update from Alice",
          "itemType": "message",
          "dueAt": null,
          "startAt": null,
          "endAt": null,
          "syncedAt": "2026-03-11T10:00:00.000Z"
        }
      ]
    },
    {
      "integrationId": "fd5abead-1311-4d11-a475-35fca0ab8226",
      "serviceId": "apple_calendar",
      "accountLabel": "Work",
      "accountIdentifier": "work@icloud.com",
      "items": [
        {
          "id": "inbox:def456",
          "externalId": "evt-007",
          "title": "Sprint Planning",
          "itemType": "event",
          "dueAt": null,
          "startAt": "2026-03-12T09:00:00.000Z",
          "endAt": "2026-03-12T10:00:00.000Z",
          "syncedAt": "2026-03-11T10:00:00.000Z"
        }
      ]
    }
  ],
  "total": 2
}
```

**Notes**:
- Groups with no pending items are omitted.
- Items within each group are ordered by `syncedAt ASC` (oldest first — FIFO triage).
- Only non-expired, non-dismissed pending items are included.
- Returns `{ groups: [], total: 0 }` when inbox is empty.

---

## GET /api/inbox/count

Returns the count of pending inbox items for use by navigation badges.

### Response `200 OK`

```json
{ "count": 5 }
```

**Notes**:
- Lightweight query — only counts SyncCacheItem rows where `pendingInbox = true`.
- Frontend should poll or refresh this on a schedule (same interval as feed sync status).

---

## PATCH /api/inbox/items/:itemId/accept

Accepts a single inbox item, moving it to the main feed.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `itemId`  | string | Inbox item ID (format: `inbox:<uuid>`) |

### Response `200 OK`

```json
{}
```

### Error Responses

| Status | Code | When |
|--------|------|------|
| 404 | `ITEM_NOT_FOUND` | Item ID does not exist or does not belong to the authenticated user |
| 409 | `ALREADY_ACCEPTED` | Item is not in inbox state (`pendingInbox = false`) |
| 400 | `INVALID_ITEM_ID` | Item ID does not have `inbox:` prefix or is malformed |

---

## PATCH /api/inbox/items/:itemId/dismiss

Dismisses a single inbox item, moving it to the dismissed archive (same destination as feed-level dismiss).

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `itemId`  | string | Inbox item ID (format: `inbox:<uuid>`) |

### Response `200 OK`

```json
{}
```

### Error Responses

| Status | Code | When |
|--------|------|------|
| 404 | `ITEM_NOT_FOUND` | Item ID does not exist or does not belong to the authenticated user |
| 400 | `INVALID_ITEM_ID` | Item ID does not have `inbox:` prefix or is malformed |

---

## POST /api/inbox/accept-all

Accepts all pending inbox items from a specific integration (bulk accept).

### Request Body

```json
{ "integrationId": "1ed2b2a9-5dea-42f7-95f6-dc909cecec1b" }
```

### Response `200 OK`

```json
{ "accepted": 7 }
```

`accepted` is the number of items moved to the feed.

### Error Responses

| Status | Code | When |
|--------|------|------|
| 400 | `MISSING_INTEGRATION_ID` | Request body missing `integrationId` |
| 404 | `INTEGRATION_NOT_FOUND` | Integration does not exist or does not belong to user |

---

## POST /api/inbox/dismiss-all

Dismisses all pending inbox items from a specific integration (bulk dismiss).

### Request Body

```json
{ "integrationId": "1ed2b2a9-5dea-42f7-95f6-dc909cecec1b" }
```

### Response `200 OK`

```json
{ "dismissed": 3 }
```

`dismissed` is the number of items moved to the dismissed archive.

### Error Responses

| Status | Code | When |
|--------|------|------|
| 400 | `MISSING_INTEGRATION_ID` | Request body missing `integrationId` |
| 404 | `INTEGRATION_NOT_FOUND` | Integration does not exist or does not belong to user |

---

## Frontend API Service

```typescript
// frontend/src/services/inbox.service.ts

getInbox(): Promise<InboxResult>
getInboxCount(): Promise<{ count: number }>
acceptInboxItem(itemId: string): Promise<void>
dismissInboxItem(itemId: string): Promise<void>
acceptAll(integrationId: string): Promise<{ accepted: number }>
dismissAll(integrationId: string): Promise<{ dismissed: number }>
```

---

## Integration Settings UI (No Changes)

The integration settings page (`/settings/integrations`) is unchanged by this feature. Inbox is a delivery concern, not an integration configuration concern.

---

## Existing Feed API Impact

One change to `GET /api/feed`:

- `buildFeed()` now applies `pendingInbox = false` filter to the `SyncCacheItem` query.
- Response shape is **unchanged** — no new fields on FeedResult.
- Existing feed dismiss/complete/uncomplete routes are **unchanged**.
