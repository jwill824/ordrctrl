# API Contract: Description Override

**Endpoint**: `PATCH /api/feed/items/:itemId/description-override`  
**Feature**: #44 — Edit synced task description  
**Auth**: Session cookie (same as all feed endpoints)

---

## Overview

Sets or clears a user-authored description override for a synced task. The override is stored as
a `SyncOverride` record with `overrideType = DESCRIPTION_OVERRIDE`. Only applicable to synced
items (`sync:` prefix); native tasks manage their own title field and do not support overrides.

**Upsert semantics**: If a `DESCRIPTION_OVERRIDE` record already exists for this item, it is
updated in place. If none exists, one is created. Passing `value: null` deletes the override row.

---

## Request

### URL Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `itemId` | string | ✅ | Feed item ID in `sync:<uuid>` format |

### Headers

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `Cookie` | Session cookie (auto-sent by browser) |

### Body

```json
{
  "value": "string | null"
}
```

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| `value` | `string \| null` | ✅ | String: non-empty after trim, ≤ 50 000 chars. Null: clears the override. | The user-authored description text, or `null` to remove the override. |

### Example — Set Override

```http
PATCH /api/feed/items/sync:a1b2c3d4-e5f6-7890-abcd-ef1234567890/description-override
Content-Type: application/json

{
  "value": "Follow up on Q3 budget approval — see attached spreadsheet"
}
```

### Example — Clear Override

```http
PATCH /api/feed/items/sync:a1b2c3d4-e5f6-7890-abcd-ef1234567890/description-override
Content-Type: application/json

{
  "value": null
}
```

---

## Responses

### 200 OK — Success

Returned after a successful upsert (set) or deletion (clear). The response body confirms the
resulting state.

**Set override**:

```json
{
  "hasDescriptionOverride": true,
  "descriptionOverride": "Follow up on Q3 budget approval — see attached spreadsheet",
  "descriptionUpdatedAt": "2026-07-18T14:32:00.000Z"
}
```

**Clear override**:

```json
{
  "hasDescriptionOverride": false,
  "descriptionOverride": null,
  "descriptionUpdatedAt": null
}
```

| Field | Type | Description |
|---|---|---|
| `hasDescriptionOverride` | boolean | Whether a `DESCRIPTION_OVERRIDE` record now exists |
| `descriptionOverride` | `string \| null` | The saved override text, or `null` if cleared |
| `descriptionUpdatedAt` | `string \| null` | ISO 8601 timestamp of the override's `updatedAt`, or `null` if cleared |

---

### 400 Bad Request

| `code` | Condition | Message |
|---|---|---|
| `INVALID_ITEM_ID` | `itemId` is not in `sync:<uuid>` format, or is a `native:` item | `"Description override is only supported for synced items (sync: prefix)"` |
| `INVALID_VALUE` | `value` is an empty string (or whitespace-only) | `"value must be a non-empty string or null"` |
| `VALUE_TOO_LONG` | `value` exceeds 50 000 characters | `"value must not exceed 50000 characters"` |

```json
{
  "error": "Bad Request",
  "code": "INVALID_VALUE",
  "message": "value must be a non-empty string or null"
}
```

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "message": "Not authenticated"
}
```

### 404 Not Found

```json
{
  "error": "Not Found",
  "code": "ITEM_NOT_FOUND",
  "message": "Item not found"
}
```

Returned when the `sync:<uuid>` refers to a `SyncCacheItem` that does not exist or does not
belong to the authenticated user.

### 500 Internal Server Error

Unexpected error. Logged server-side. Client receives:

```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

---

## Service Layer Signature

```ts
// backend/src/feed/feed.service.ts

export interface SetDescriptionOverrideResult {
  hasDescriptionOverride: boolean;
  descriptionOverride: string | null;
  descriptionUpdatedAt: string | null;
}

export async function setDescriptionOverride(
  userId: string,
  syncCacheItemId: string,
  value: string | null
): Promise<SetDescriptionOverrideResult>
```

**Implementation notes**:
- Verify `SyncCacheItem` exists and belongs to `userId` before upserting.
- If `value` is a non-null string: upsert `SyncOverride` with
  `overrideType = DESCRIPTION_OVERRIDE`, `value = trimmedValue`.
- If `value` is `null`: `deleteMany` where `syncCacheItemId = X AND overrideType = DESCRIPTION_OVERRIDE`.
- Return the resulting state derived from the upserted/deleted row.

---

## Frontend Service Signature

```ts
// frontend/src/services/feed.service.ts

export async function setDescriptionOverride(
  itemId: string,          // full feed ID, e.g. "sync:<uuid>"
  value: string | null
): Promise<SetDescriptionOverrideResult>
```

Called by `useFeed.setDescriptionOverride(itemId, value)` which optimistically updates the
relevant `FeedItem` in client state before awaiting the response.

---

## Related Endpoints

- `GET /api/feed` — returns `FeedItem[]` including `hasDescriptionOverride`, `descriptionOverride`,
  `descriptionUpdatedAt`, `originalBody`, `description`, `sourceUrl` (see `feed-get.md`)
