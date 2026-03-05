# Contract: Feed & Tasks API

**Version**: 1.0 | **Date**: 2026-03-05
**Auth required**: All endpoints require an active session cookie.

---

## Feed

### GET /api/feed

Return the consolidated feed for the authenticated user.

**Query params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `includeCompleted` | boolean | `false` | Include completed items in response |

**Response (200)**:
```json
{
  "items": [
    {
      "id": "sync:uuid-123",
      "source": "Apple Reminders",
      "itemType": "task",
      "title": "Call dentist",
      "dueAt": "2026-03-06T09:00:00Z",
      "startAt": null,
      "endAt": null,
      "completed": false,
      "completedAt": null,
      "isDuplicateSuspect": false
    },
    {
      "id": "sync:uuid-456",
      "source": "Apple Calendar",
      "itemType": "event",
      "title": "Team standup",
      "dueAt": null,
      "startAt": "2026-03-05T15:00:00Z",
      "endAt": "2026-03-05T15:30:00Z",
      "completed": false,
      "completedAt": null,
      "isDuplicateSuspect": false
    },
    {
      "id": "native:uuid-789",
      "source": "ordrctrl",
      "itemType": "task",
      "title": "Review plan doc",
      "dueAt": "2026-03-07T00:00:00Z",
      "startAt": null,
      "endAt": null,
      "completed": false,
      "completedAt": null,
      "isDuplicateSuspect": false
    }
  ],
  "completed": [],
  "syncStatus": {
    "gmail": { "status": "connected", "lastSyncAt": "2026-03-05T01:30:00Z", "error": null },
    "apple_reminders": { "status": "connected", "lastSyncAt": "2026-03-05T01:30:00Z", "error": null },
    "microsoft_tasks": { "status": "error", "lastSyncAt": null, "error": "Token refresh failed. Please reconnect." },
    "apple_calendar": { "status": "disconnected", "lastSyncAt": null, "error": null }
  }
}
```

**Ordering**:
1. Active items with `dueAt` or `startAt` — ascending chronological
2. Active items without dates — by `syncedAt` descending
3. Completed items (only if `includeCompleted=true`) — by `completedAt` descending

**Note**: `rawPayload` from SyncCacheItem is NEVER included in feed responses.

---

### PATCH /api/feed/items/:itemId/complete

Mark a feed item as complete in ordrctrl. Does not sync back to the source service.

**Path params**: `itemId` — format `sync:<uuid>` or `native:<uuid>`

**Request body**: *(empty)*

**Responses**:
| Status | Meaning |
|--------|---------|
| 200 | Item marked complete; returns updated FeedItem |
| 404 | Item not found |

**Response body (200)**:
```json
{
  "id": "sync:uuid-123",
  "completed": true,
  "completedAt": "2026-03-05T02:00:00Z"
}
```

---

## Native Tasks

### POST /api/tasks

Create a new native task in ordrctrl.

**Request body**:
```json
{
  "title": "Review plan doc",
  "dueAt": "2026-03-07T00:00:00Z"
}
```

**Validation**: `title` required (max 500 chars); `dueAt` optional ISO 8601 datetime.

**Responses**:
| Status | Meaning |
|--------|---------|
| 201 | Task created |
| 422 | Validation error |

**Response body (201)**: Full FeedItem representation with `source: "ordrctrl"`.

---

### PATCH /api/tasks/:id

Update a native task's title or due date.

**Request body** (all fields optional):
```json
{
  "title": "Updated title",
  "dueAt": "2026-03-08T00:00:00Z"
}
```

**Responses**:
| Status | Meaning |
|--------|---------|
| 200 | Task updated |
| 404 | Task not found or belongs to different user |
| 422 | Validation error |

---

### DELETE /api/tasks/:id

Delete a native task permanently.

**Responses**:
| Status | Meaning |
|--------|---------|
| 204 | Task deleted |
| 404 | Task not found |
