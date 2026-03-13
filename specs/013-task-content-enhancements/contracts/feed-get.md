# API Contract: GET /api/feed (Updated Response Shape)

**Endpoint**: `GET /api/feed`  
**Feature**: #44 + #38 — adds description-override and source-link fields to `FeedItem`  
**Auth**: Session cookie

---

## Overview

Returns the unified feed of tasks, events, and messages for the authenticated user. This document
describes **only the fields added** by the Task Content Enhancements feature. All pre-existing
fields are unchanged.

---

## Query Parameters (unchanged)

| Parameter | Type | Default | Description |
|---|---|---|---|
| `includeCompleted` | `boolean` | `false` | When `true`, completed items are included |
| `showDismissed` | `boolean` | `false` | When `true`, returns dismissed items instead of active feed |

---

## Response — FeedItem shape additions

Each item in `items[]` and `completed[]` gains the following new fields:

```json
{
  "originalBody": "string | null",
  "description": "string | null",
  "hasDescriptionOverride": "boolean",
  "descriptionOverride": "string | null",
  "descriptionUpdatedAt": "string | null",
  "sourceUrl": "string | null"
}
```

### New Field Definitions

| Field | Type | Description |
|---|---|---|
| `originalBody` | `string \| null` | The unmodified body text from the source integration (`SyncCacheItem.body`). Always `null` for native tasks. |
| `description` | `string \| null` | The effective description to display. Equals `descriptionOverride` when set; falls back to `originalBody`. |
| `hasDescriptionOverride` | `boolean` | `true` when a `DESCRIPTION_OVERRIDE` `SyncOverride` exists for this item. Drives the "edited" badge in the UI. |
| `descriptionOverride` | `string \| null` | The user-authored description text, or `null` if no override has been set. |
| `descriptionUpdatedAt` | `string \| null` | ISO 8601 timestamp of when the description override was last saved, or `null`. |
| `sourceUrl` | `string \| null` | Deep-link URL back to the source item in its integration (`SyncCacheItem.url`). `null` for native tasks and synced items without a URL. Presence drives "Open in [source]" button visibility. |

---

## Example Response (abbreviated)

```json
{
  "items": [
    {
      "id": "sync:a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "source": "you@gmail.com",
      "serviceId": "gmail",
      "itemType": "message",
      "title": "Re: Q3 budget approval",
      "dueAt": null,
      "startAt": null,
      "endAt": null,
      "completed": false,
      "completedAt": null,
      "isDuplicateSuspect": false,
      "dismissed": false,
      "hasUserDueAt": false,
      "originalBody": "Hi, please review the attached spreadsheet before Friday...",
      "description": "Follow up on Q3 budget — check spreadsheet",
      "hasDescriptionOverride": true,
      "descriptionOverride": "Follow up on Q3 budget — check spreadsheet",
      "descriptionUpdatedAt": "2026-07-18T14:32:00.000Z",
      "sourceUrl": "https://mail.google.com/mail/u/0/#inbox/18a2b3c4d5e6f7a8"
    },
    {
      "id": "sync:b2c3d4e5-f6a7-8901-bcde-f01234567891",
      "source": "work@outlook.com",
      "serviceId": "microsoft_tasks",
      "itemType": "task",
      "title": "Prepare slide deck",
      "dueAt": "2026-07-20T17:00:00.000Z",
      "startAt": null,
      "endAt": null,
      "completed": false,
      "completedAt": null,
      "isDuplicateSuspect": false,
      "dismissed": false,
      "hasUserDueAt": false,
      "originalBody": "Slides for the all-hands",
      "description": "Slides for the all-hands",
      "hasDescriptionOverride": false,
      "descriptionOverride": null,
      "descriptionUpdatedAt": null,
      "sourceUrl": "https://to-do.microsoft.com/tasks/id/abc123"
    },
    {
      "id": "native:c3d4e5f6-a7b8-9012-cdef-012345678902",
      "source": "ordrctrl",
      "serviceId": "ordrctrl",
      "itemType": "task",
      "title": "Buy groceries",
      "dueAt": null,
      "startAt": null,
      "endAt": null,
      "completed": false,
      "completedAt": null,
      "isDuplicateSuspect": false,
      "dismissed": false,
      "hasUserDueAt": false,
      "originalBody": null,
      "description": null,
      "hasDescriptionOverride": false,
      "descriptionOverride": null,
      "descriptionUpdatedAt": null,
      "sourceUrl": null
    }
  ],
  "completed": [],
  "syncStatus": {
    "gmail": {
      "status": "connected",
      "lastSyncAt": "2026-07-18T14:00:00.000Z",
      "error": null
    }
  }
}
```

---

## Backend Mapping

In `feed.service.ts → buildFeed()`, each `SyncCacheItem` join must now include:

```ts
// Additional fields to select from SyncCacheItem:
body: true,
url: true,

// Additional join to fetch description override:
syncOverrides: {
  where: { overrideType: 'DESCRIPTION_OVERRIDE' },
  select: { value: true, updatedAt: true },
  take: 1,
}
```

Mapping logic per item:

```ts
const descOverride = item.syncOverrides[0] ?? null;
const hasDescriptionOverride = descOverride !== null;
const descriptionOverride   = descOverride?.value ?? null;
const description            = descriptionOverride ?? item.body ?? null;
const descriptionUpdatedAt   = descOverride?.updatedAt?.toISOString() ?? null;
```

This approach adds **one scoped sub-query** per feed build (or a single join filtered by
`overrideType`), not a per-item round-trip.

---

## Related Contracts

- [`description-override.md`](./description-override.md) — `PATCH .../description-override` endpoint
