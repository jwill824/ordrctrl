# API Contracts: Per-Item Feed Dismissal

**Feature**: `005-feed-dismissal`
**Base path**: `/api/feed`
**Auth**: All endpoints require a valid session token (existing auth middleware)

---

## New Endpoints

### `PATCH /api/feed/items/:itemId/dismiss`

Dismisses a feed item for the authenticated user.

**Path parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `itemId` | `string` | Feed item ID — format `sync:<uuid>` or `native:<uuid>` |

**Request body**: None

**Success response**: `200 OK`
```json
{
  "id": "sync:b3f4a2c1-...",
  "dismissed": true
}
```

**Error responses**:
| Status | Code | Condition |
|--------|------|-----------|
| `400` | `INVALID_ITEM_ID` | `itemId` does not match `sync:<uuid>` or `native:<uuid>` format |
| `404` | `ITEM_NOT_FOUND` | Item does not exist or does not belong to the authenticated user |
| `409` | `ALREADY_DISMISSED` | Item is already dismissed (idempotent callers should treat this as success) |

**Behavior**:
- For `sync:` prefix: creates a `SyncOverride` record with `overrideType = DISMISSED`. Uses upsert to handle concurrent double-clicks.
- For `native:` prefix: sets `dismissed = true` on the `NativeTask` record.
- Item is immediately excluded from subsequent `GET /api/feed` responses.
- Does NOT write back to the external source.

---

### `DELETE /api/feed/items/:itemId/dismiss`

Restores a dismissed feed item (undo dismissal).

**Path parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `itemId` | `string` | Feed item ID — format `sync:<uuid>` or `native:<uuid>` |

**Request body**: None

**Success response**: `200 OK`
```json
{
  "id": "sync:b3f4a2c1-...",
  "dismissed": false
}
```

**Error responses**:
| Status | Code | Condition |
|--------|------|-----------|
| `400` | `INVALID_ITEM_ID` | `itemId` format is invalid |
| `404` | `ITEM_NOT_FOUND` | Item does not exist or does not belong to the authenticated user |
| `404` | `NOT_DISMISSED` | Item is not currently dismissed (calling undo on an active item) |

**Behavior**:
- For `sync:` prefix: deletes the `SyncOverride` record where `overrideType = DISMISSED`.
- For `native:` prefix: sets `dismissed = false` on the `NativeTask` record.
- Item immediately reappears in subsequent `GET /api/feed` responses.
- Idempotent: a second call when already restored returns `404 NOT_DISMISSED`.

---

### `GET /api/feed/dismissed`

Returns a paginated list of the authenticated user's dismissed feed items.

**Query parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | `number` | `20` | Items per page (max: `100`) |
| `cursor` | `string` | — | Pagination cursor (opaque, from previous response `nextCursor`) |

**Success response**: `200 OK`
```json
{
  "items": [
    {
      "id": "sync:b3f4a2c1-...",
      "title": "Write quarterly report",
      "source": "google_tasks",
      "itemType": "sync",
      "dismissedAt": "2025-06-01T14:32:00Z"
    },
    {
      "id": "native:d9a1e2f0-...",
      "title": "Review PR #42",
      "source": "ordrctrl",
      "itemType": "native",
      "dismissedAt": "2025-06-02T09:10:00Z"
    }
  ],
  "nextCursor": "eyJpZCI6InN5bmM6...",
  "hasMore": true
}
```

**Response fields**:
| Field | Type | Description |
|-------|------|-------------|
| `items[].id` | `string` | Feed item ID (`sync:<uuid>` or `native:<uuid>`) |
| `items[].title` | `string` | Task title at time of last sync |
| `items[].source` | `string` | Source service ID (e.g., `google_tasks`, `ms_todo`, `ordrctrl`) |
| `items[].itemType` | `"sync" \| "native"` | Discriminator for item origin |
| `items[].dismissedAt` | `ISO 8601 string` | When the item was dismissed |
| `nextCursor` | `string \| null` | Cursor for the next page; `null` when no more results |
| `hasMore` | `boolean` | Convenience field; `true` when `nextCursor` is present |

**Error responses**:
| Status | Code | Condition |
|--------|------|-----------|
| `400` | `INVALID_LIMIT` | `limit` is outside the range `1–100` |
| `400` | `INVALID_CURSOR` | `cursor` cannot be decoded |

**Behavior**:
- Sorted by `dismissedAt` descending (most recently dismissed first).
- Dismissal timestamp for sync items = `SyncOverride.createdAt`; for native tasks = `NativeTask.updatedAt` at time of dismissal (or a dedicated `dismissedAt` field if added in implementation).
- Empty list returns `{ items: [], nextCursor: null, hasMore: false }`.

---

## Modified Behavior — Existing Endpoints

### `GET /api/feed` (existing)

**Change**: Feed results exclude items with an active dismissal.

- Dismissed sync items (`DISMISSED` override exists) are excluded.
- Dismissed native tasks (`dismissed = true`) are excluded.
- No change to response shape — existing clients are unaffected.

### `PATCH /api/feed/items/:itemId/complete` (existing)

**Change**: Completing a dismissed item does NOT auto-restore it to the feed. The `DISMISSED` override and `completed` state are independent.

*Rationale*: Edge case — user completes an item via keyboard shortcut while it's still being dismissed. The dismiss action takes precedence; the item remains out of the feed.

---

## Zod Schema Sketches

```typescript
// PATCH/DELETE /:itemId/dismiss — path param
const DismissParamsSchema = z.object({
  itemId: z.string().regex(/^(sync|native):[0-9a-f-]{36}$/, 'Invalid item ID format'),
});

// GET /dismissed — query params
const DismissedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
```
