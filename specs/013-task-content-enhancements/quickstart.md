# Quickstart: Task Content Enhancements

**Branch**: `013-task-content-enhancements`  
**Features**: #44 Description Override · #38 Source Links

---

## Prerequisites

- Node 20 LTS + pnpm installed
- Docker or a local PostgreSQL 16 instance running
- `.env` files populated (copy from `.env.example` if first time)

---

## 1. Install Dependencies

```bash
# From repo root
pnpm install
```

---

## 2. Apply Database Migration

This feature adds two new columns (`body`, `url`) to `SyncCacheItem`, adds `value` and
`updatedAt` to `SyncOverride`, and adds `DESCRIPTION_OVERRIDE` to the `OverrideType` enum.

```bash
cd backend

# Generate and apply the migration (dev mode — creates migration files)
pnpm prisma migrate dev --name task_content_enhancements

# Verify the migration was applied
pnpm prisma migrate status
```

> **If the migration file already exists** (e.g., after pulling this branch):
> ```bash
> pnpm prisma migrate deploy   # apply without prompting
> pnpm prisma generate          # regenerate Prisma client
> ```

---

## 3. Start the Dev Servers

```bash
# Terminal 1 — backend (Fastify, port 3001)
cd backend && pnpm dev

# Terminal 2 — frontend (Next.js, port 3000)
cd frontend && pnpm dev
```

---

## 4. Testing Description Override End-to-End

### 4a. Using the UI

1. Sign in and ensure at least one integration is connected and has synced tasks.
2. Click a synced task to open `EditTaskModal`.
3. **Set override**:
   - The description text area is pre-filled with the original body (or empty if none).
   - Edit the text and click **Save**.
   - Confirm:
     - The task's description in the feed/modal shows your text.
     - An **"edited"** badge is visible on the task.
     - Clicking "View original" (or equivalent expand affordance) shows the original body unchanged.
4. **Edit existing override**:
   - Re-open the modal, change the text, save.
   - Confirm the new text is shown.
5. **Clear override**:
   - Re-open the modal, clear the text area completely, save.
   - Confirm: no "edited" badge; original body is displayed again.
6. **Discard in-progress edit**:
   - Open the modal, change the text, then close without saving (click Cancel or press Escape).
   - Confirm: description is unchanged from before you opened the modal.

### 4b. Using the API Directly (curl)

```bash
# Replace <SESSION_COOKIE> with your session value (DevTools → Application → Cookies → session)
# Replace <SYNC_ITEM_ID> with a valid sync item UUID from GET /api/feed

# Set an override
curl -X PATCH http://localhost:3001/api/feed/items/sync:<SYNC_ITEM_ID>/description-override \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<SESSION_COOKIE>" \
  -d '{"value": "My custom description"}'

# Expected: 200 {"hasDescriptionOverride": true, "descriptionOverride": "My custom description", ...}

# Verify it appears in the feed
curl http://localhost:3001/api/feed \
  -H "Cookie: session=<SESSION_COOKIE>" \
  | jq '.items[] | select(.id == "sync:<SYNC_ITEM_ID>") | {description, hasDescriptionOverride, originalBody}'

# Clear the override
curl -X PATCH http://localhost:3001/api/feed/items/sync:<SYNC_ITEM_ID>/description-override \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<SESSION_COOKIE>" \
  -d '{"value": null}'

# Expected: 200 {"hasDescriptionOverride": false, "descriptionOverride": null, ...}
```

---

## 5. Testing Source Links for Each Integration

### 5a. UI Verification

| Integration | Expected button label | Test approach |
|---|---|---|
| Gmail | **Open in Gmail** | Sync a Gmail message; open task detail; verify button appears and opens `mail.google.com/...` |
| Microsoft To Do | **Open in To Do** | Sync a To Do task; verify button opens `to-do.microsoft.com/...` |
| Apple Calendar | **Open in Calendar** | Sync an Apple Calendar event that has a `URL:` property; verify button opens Calendar |
| Apple Reminders | _(not shown)_ | Apple Reminders does not populate `url`; confirm no button is visible |
| Native task | _(not shown)_ | Create a native task; confirm no "Open in" button in modal |

> **Tip**: Use browser DevTools Network tab to confirm the fetch to `GET /api/feed` returns
> `sourceUrl` for the expected items before clicking the button.

### 5b. API Verification

```bash
# Check which synced items have sourceUrl populated
curl http://localhost:3001/api/feed \
  -H "Cookie: session=<SESSION_COOKIE>" \
  | jq '.items[] | select(.sourceUrl != null) | {id, serviceId, sourceUrl}'
```

### 5c. Seeding Test Data with a URL

If your test integration does not produce tasks with URLs, temporarily insert one directly:

```bash
cd backend

# Open Prisma Studio to manually set url on a SyncCacheItem
pnpm prisma studio
# Navigate to SyncCacheItem → find a row → set url = "https://mail.google.com/mail/u/0/#inbox/test"
```

---

## 6. Run Tests

```bash
# Backend unit + integration tests
cd backend && pnpm test

# Frontend unit tests
cd frontend && pnpm test

# Run a specific test file (e.g., feed service)
cd backend && pnpm test feed.service

# Run with coverage
cd backend && pnpm test --coverage
cd frontend && pnpm test --coverage
```

### Key test files for this feature

| File | What it covers |
|---|---|
| `backend/tests/unit/feed.service.test.ts` | `setDescriptionOverride` CRUD, `buildFeed` description field mapping |
| `backend/tests/unit/feed.routes.description.test.ts` | `PATCH .../description-override` endpoint — success, validation errors, 404 |
| `frontend/tests/unit/components/tasks/EditTaskModal.test.tsx` | Description textarea, save/clear/cancel behaviour, "edited" badge |
| `frontend/tests/unit/components/feed/FeedItem.test.tsx` | "Open in [source]" button visibility, correct label per integration |
| `frontend/tests/unit/services/feed.service.test.ts` | `setDescriptionOverride()` API call, FeedItem type shape |

---

## 7. Useful Prisma Commands

```bash
cd backend

# Open Prisma Studio (GUI database browser)
pnpm prisma studio

# Inspect SyncOverride records for a user
pnpm prisma studio
# → SyncOverride → filter by overrideType = DESCRIPTION_OVERRIDE

# Reset dev database (destructive — dev only)
pnpm prisma migrate reset

# View migration history
pnpm prisma migrate status

# Regenerate Prisma client after schema change
pnpm prisma generate
```

---

## 8. Environment Variables (feature-specific)

No new environment variables are required for this feature. All changes use existing database and
session configuration.

---

## 9. Troubleshooting

**`DESCRIPTION_OVERRIDE` is not a valid enum value**  
→ The migration has not been applied. Run `pnpm prisma migrate dev` from `backend/`.

**`sourceUrl` is `null` for all items even after sync**  
→ The adapter for your integration may not yet populate `url`. Check the adapter's
`normalizeItem()` output and verify `SyncCacheItem.url` is being written in `cache.service.ts`.

**"edited" badge does not appear after saving**  
→ Check the network response for `PATCH .../description-override` — confirm `hasDescriptionOverride: true`
is returned. If the feed still shows the old value, the frontend state update in `useFeed` may
not be applying the patch correctly.

**Prisma Studio shows no `body` or `url` column on `SyncCacheItem`**  
→ Run `pnpm prisma generate` after the migration to rebuild the Prisma client.
