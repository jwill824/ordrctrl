# API Contracts: Clear Completed Tasks

**Branch**: `008-clear-completed` | **Date**: 2026-03-10

## New Endpoints

### POST /api/feed/completed/clear

Clears all completed tasks from the feed by dismissing them. Completed items with an active REOPENED override are excluded.

**Auth**: Required (JWT/session — same as all feed endpoints)

**Request**: No body required.

**Response 200 OK**:
```json
{
  "clearedCount": 12
}
```

**Response 200 OK (nothing to clear)**:
```json
{
  "clearedCount": 0
}
```

**Response 401 Unauthorized**: No authenticated user.

**Response 500 Internal Server Error**: Unexpected failure; feed state unchanged.

---

## Modified Endpoints

### GET /api/feed (existing)

No changes to the contract. The `completed` array in the response will be empty after a clear operation (until new items are completed).

---

## P2 Endpoints (Auto-Clear)

### GET /api/user/settings

Returns current user-level preferences.

**Response 200 OK**:
```json
{
  "autoClearWindowDays": null
}
```

### PATCH /api/user/settings

Updates user-level preferences.

**Request Body**:
```json
{
  "autoClearWindowDays": 7
}
```

**Validation**:
- `autoClearWindowDays`: `1 | 3 | 7 | 30 | null` — any other value returns 400.

**Response 200 OK**:
```json
{
  "autoClearWindowDays": 7
}
```

**Response 400 Bad Request** (invalid window value):
```json
{
  "error": "autoClearWindowDays must be one of: 1, 3, 7, 30, or null"
}
```
