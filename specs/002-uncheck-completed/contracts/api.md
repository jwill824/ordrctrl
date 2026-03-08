# API Contracts: Uncheck Completed Tasks

## New Endpoints

---

### PATCH /api/feed/items/:itemId/uncomplete

Reopens a completed feed item (native task or sync cache item) for the authenticated user.
For sync-sourced items, creates a `SyncOverride(REOPENED)` record to preserve user intent
across future sync cycles.

**Authentication**: Required (session cookie)

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `itemId` | string (UUID) | ID of the feed item to reopen |

**Request Body**: None

**Success Response** — `200 OK`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "completed": false,
  "completedAt": null,
  "source": "ordrctrl" | "gmail" | "apple_reminders" | "microsoft_tasks" | "apple_calendar",
  "isLocalOverride": false | true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Item ID |
| `completed` | `false` | Always false on success |
| `completedAt` | `null` | Always null on success |
| `source` | string | Origin of the item |
| `isLocalOverride` | boolean | `true` if a SyncOverride was created (sync-sourced items only) |

**Error Responses**

| Status | Code | Description |
|--------|------|-------------|
| `400 Bad Request` | `ITEM_NOT_COMPLETED` | Item is already open (not completed) |
| `403 Forbidden` | `FORBIDDEN` | Item does not belong to authenticated user |
| `404 Not Found` | `ITEM_NOT_FOUND` | No item found with given ID |
| `503 Service Unavailable` | `DB_ERROR` | Database write failed |

---

### PATCH /api/tasks/:id/uncomplete

Reopens a completed native task for the authenticated user.
(Alternative entry point for native tasks; preferred path is the feed endpoint above.)

**Authentication**: Required (session cookie)

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | ID of the native task |

**Request Body**: None

**Success Response** — `200 OK`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Buy groceries",
  "completed": false,
  "completedAt": null,
  "dueAt": null,
  "source": "ordrctrl"
}
```

**Error Responses**: Same as feed endpoint above.

---

## Modified Behavior: Re-checking a Reopened Sync Item

When `PATCH /api/feed/items/:itemId/complete` is called on an item that has a `SyncOverride(REOPENED)`:

1. Sets `completedInOrdrctrl = true`, `completedAt = now()`
2. **Deletes** the `SyncOverride(REOPENED)` record for this item
3. Returns the standard complete response (no change to existing contract)

This ensures the override lifecycle is clean: open → complete → reopen → re-complete removes the override.
