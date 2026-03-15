# Quickstart: Testing Task Rename & Documentation Polish

**Spec**: 017-task-rename-polish | **Phase**: 1 Design

## Prerequisites

- Local stack running (`docker-compose up -d`, `pnpm dev` from repo root)
- At least one active integration (Google or Microsoft) with synced tasks visible in the feed
- At least one native task created manually

---

## Scenario 1 — Rename a Synced Task (Happy Path)

1. Open the app in your browser at `http://localhost:5173`
2. Find a synced task (badge shows the integration source — Google, Microsoft, etc.)
3. Click the task to open `EditTaskModal`
4. You should now see a **Title** input field (previously absent for synced tasks)
5. Change the title to something custom (e.g., `"My Custom Title"`)
6. Click **Save**
7. **Expected**: The task now shows `"My Custom Title"` in the feed
8. **Expected**: A `"Original: <original title>"` prefix appears in the task's description
9. **Expected**: A small "edited" or override indicator is shown on the card

## Scenario 2 — Title Survives Re-sync

1. After Scenario 1, trigger a manual sync: click the sync button or wait for the background sync interval
2. **Expected**: The task still shows `"My Custom Title"` — sync did NOT overwrite the custom title
3. Open the edit modal again — the title field still shows the custom value

## Scenario 3 — Revert Title Override

1. Open the edit modal for a task with a custom title
2. Clear the **Title** field (or click a "Revert" / "×" button)
3. Click **Save**
4. **Expected**: The task title reverts to the original synced title
5. **Expected**: The `TITLE_OVERRIDE` record is deleted; the description `"Original: …"` prefix remains (by design)

## Scenario 4 — Rename a Native Task (Unchanged Behavior)

1. Open a native task (created via the "+ Add task" button, not from an integration)
2. Edit the title in the modal
3. Click **Save**
4. **Expected**: Title updates normally — no override indicators, no description modification

## Scenario 5 — Console Error Investigation (#48)

1. Open Chrome DevTools → Console
2. Reproduce the error (reload the page while the console is open)
3. Note the exact filename in the stack trace: `content.js`
4. Open an **Incognito window** with all extensions disabled
5. Reload and check the console
6. **Expected if extension**: No `content.js` error in incognito → confirm browser extension origin

## Scenario 6 — Documentation Checks (#58)

1. View `docs/README.md` — speckit workflow section should be gone; replaced with link to CONTRIBUTING
2. View `docs/CONTRIBUTING.md` — branching section should describe `NNN-short-name` format with examples
3. View `docs/development.md` — no TL;DR block at the top
4. View `docs/architecture.md` — system diagram should render as a Mermaid flowchart on GitHub

---

## Curl Quick Tests (Backend)

```bash
# Assumes local dev, authenticated session cookie in $COOKIE

# Set a title override on a synced item
curl -X PATCH http://localhost:3000/api/feed/sync/clxxxxxxxx/title-override \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{"value": "My Custom Title"}'

# Clear the title override
curl -X PATCH http://localhost:3000/api/feed/sync/clxxxxxxxx/title-override \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{"value": null}'

# Verify feed reflects updated title
curl http://localhost:3000/api/feed \
  -H "Cookie: $COOKIE" | jq '.[] | select(.id == "sync:clxxxxxxxx") | {title, originalTitle, hasTitleOverride}'
```
