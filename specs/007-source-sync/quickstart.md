# Quickstart: Inbound Source Sync (007)

## Testing Source Completion Manually

### Microsoft Tasks

1. Connect your Microsoft Tasks integration via the app settings
2. Create a task in Microsoft Tasks and wait for a sync cycle (or trigger manual sync)
3. Confirm the task appears in your ordrctrl feed
4. Mark the task complete in Microsoft Tasks
5. Wait for the next sync (or trigger manual sync via `POST /api/integrations/sync`)
6. Confirm the task moves to the completed section in your ordrctrl feed

### Gmail (Inbox Removal mode — default)

1. Connect your Gmail integration
2. Have an unread or starred email that appears in your ordrctrl feed
3. Archive the email in Gmail (move it out of the inbox)
4. Trigger a sync
5. Confirm the item no longer appears in the active ordrctrl feed

### Gmail (Read mode — optional)

1. Update your Gmail completion mode to "read":
   `PATCH /api/integrations/gmail/completion-mode` with `{ "completionMode": "read" }`
2. Have an unread email in your feed
3. Read (but don't archive) the email in Gmail
4. Trigger a sync
5. Confirm the item auto-completes in the ordrctrl feed

### Verifying Override Protection

1. Mark a synced task complete in the source system
2. Before the next sync, uncheck the task in ordrctrl (creates a Reopened Override)
3. Trigger a sync
4. Confirm the task remains open in ordrctrl despite being complete in the source

---

## Running Tests

```bash
# Backend unit tests (covers cache service + adapter changes)
pnpm --filter backend test

# Frontend unit tests (covers GmailCompletionModeSelector)
pnpm --filter frontend test

# All tests
pnpm test
```

---

## Key Files for This Feature

| File | Purpose |
|------|---------|
| `backend/prisma/schema.prisma` | Schema migration: completedAtSource, gmailCompletionMode |
| `backend/src/integrations/_adapter/types.ts` | NormalizedItem.completed field |
| `backend/src/sync/cache.service.ts` | Set-difference + source completion apply logic |
| `backend/src/integrations/gmail/index.ts` | Inbox removal / read completion detection |
| `backend/src/integrations/microsoft-tasks/index.ts` | All-task fetch + completed boolean |
| `backend/src/api/integrations.routes.ts` | PATCH completion-mode endpoint |
| `frontend/src/components/integrations/GmailCompletionModeSelector.tsx` | Settings toggle UI |
