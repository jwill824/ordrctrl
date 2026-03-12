# API Contracts: Feed UX Enhancements (011)

## Modified Endpoints

### GET /api/feed

Existing endpoint extended with an optional `showDismissed` query parameter.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `showDismissed` | `"true"` | No | When present, returns dismissed items instead of the normal active feed |

#### Normal response (no param) — unchanged shape, two new fields

```json
{
  "items": [
    {
      "id": "sync:abc123",
      "source": "personal@gmail.com",
      "serviceId": "gmail",
      "itemType": "message",
      "title": "Project update from Alice",
      "dueAt": null,
      "startAt": null,
      "endAt": null,
      "completed": false,
      "completedAt": null,
      "isDuplicateSuspect": false,
      "dismissed": false,
      "hasUserDueAt": false
    }
  ],
  "completed": [],
  "syncStatus": {}
}
```

**New fields on each FeedItem**:
- `dismissed: boolean` — always `false` in the normal view (active items are never dismissed)
- `hasUserDueAt: boolean` — `true` when `dueAt` is resolved from the user-assigned value rather than the source

#### Dismissed response (`?showDismissed=true`)

Same `FeedItem` shape. `dismissed` is always `true` for all items in this response.

```json
{
  "items": [
    {
      "id": "sync:def456",
      "source": "personal@gmail.com",
      "serviceId": "gmail",
      "itemType": "message",
      "title": "Old invoice from Acme",
      "dueAt": null,
      "startAt": null,
      "endAt": null,
      "completed": false,
      "completedAt": null,
      "isDuplicateSuspect": false,
      "dismissed": true,
      "hasUserDueAt": false
    }
  ],
  "completed": [],
  "syncStatus": {}
}
```

**Notes**:
- `syncStatus` is omitted (returns empty object) in the dismissed view — no need to show integration health for dismissed items.
- Dismissed items are sorted by `dismissedAt` descending (most recently dismissed first).

---

## New Endpoints

### PATCH /api/feed/items/:itemId/user-due-date

Sets or clears a user-assigned due date on a synced task.

**Only applies to sync items** (`sync:` prefix). Native tasks use the existing `PATCH /api/tasks/:id` endpoint.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `itemId` | string | Feed item ID with `sync:` prefix |

#### Request Body

```json
{ "dueAt": "2026-03-20T17:00:00.000Z" }
```

To **clear** the user-assigned date, send `null`:

```json
{ "dueAt": null }
```

#### Response `200 OK`

```json
{}
```

#### Error Responses

| Status | Code | When |
|--------|------|------|
| 404 | `ITEM_NOT_FOUND` | Item does not exist or does not belong to authenticated user |
| 400 | `INVALID_ITEM_ID` | Item ID does not have `sync:` prefix (use `/api/tasks/:id` for native tasks) |
| 400 | `INVALID_DATE` | `dueAt` is not a valid ISO 8601 date string |

**Merge behavior**: Setting `userDueAt` does NOT modify the source `dueAt` field. The feed will display the user-assigned date only if the source provides no date (`dueAt = null` in the DB). If the source provides a date, it overrides `userDueAt` in the `FeedItem` response.

---

### DELETE /api/feed/items/:itemId/permanent

Permanently deletes a dismissed item. The item must already be in dismissed state.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `itemId` | string | Feed item ID (`sync:` or `native:` prefix) |

#### Response `200 OK`

```json
{}
```

#### Error Responses

| Status | Code | When |
|--------|------|------|
| 404 | `ITEM_NOT_FOUND` | Item does not exist or does not belong to authenticated user |
| 409 | `NOT_DISMISSED` | Item is active (not dismissed); must be dismissed before permanent delete |
| 400 | `INVALID_ITEM_ID` | Item ID is malformed |

**Behavior**:
- For `sync:` items: Hard-deletes the `SyncCacheItem` row. `SyncOverride` records are cascade-deleted.
- For `native:` items: Hard-deletes the `NativeTask` row (only if `dismissed = true`).
- This operation is **irreversible**.

---

## Unchanged Endpoints (context)

These existing endpoints are **not modified** by this feature:

| Endpoint | Purpose |
|----------|---------|
| `PATCH /api/feed/items/:id/dismiss` | Soft-dismiss (still exists; permanent delete is additive) |
| `DELETE /api/feed/items/:id/dismiss` | Restore a dismissed item |
| `PATCH /api/tasks/:id` | Edit native task (including its `dueAt`) |
| `DELETE /api/tasks/:id` | Delete a native task |

---

## Redirect Routes (no new API)

| Old Route | New Destination |
|-----------|----------------|
| `/onboarding` | `/feed` (authenticated) or `/sign-in` (unauthenticated) |
| `/settings/dismissed` | `/feed?showDismissed=true` |

Both are implemented as Next.js server-side `redirect()` calls — no new API endpoints.

---

## Frontend Service Changes

```typescript
// frontend/src/services/feed.service.ts

// Modified:
fetchFeed(options?: { showDismissed?: boolean }): Promise<FeedResult>

// New:
setUserDueAt(itemId: string, dueAt: string | null): Promise<void>
permanentDeleteItem(itemId: string): Promise<void>
```
