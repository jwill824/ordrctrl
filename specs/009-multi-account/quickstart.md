# Quickstart: Multi-Account Integration Support + User Account Menu (009)

## What's being built

Two related improvements:

1. **Multi-account integration support**: Users can connect more than one integration account per service (e.g., personal Gmail + work Gmail). Each integration account syncs independently, shows a distinct label in the feed, and can be managed (renamed, paused, disconnected) individually.

2. **User account menu**: A dropdown in the feed navigation bar lets users sign out of their ordrctrl user account and navigate to settings sections. Reuses existing `POST /api/auth/logout` and `GET /api/auth/me` — no new backend endpoints.

## Key Files

### Backend — Modified
| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Add `accountIdentifier`, `label`, `paused` to Integration; change unique constraint |
| `backend/prisma/migrations/…_add-multi-account/migration.sql` | Migration SQL + data backfill |
| `backend/src/integrations/_adapter/types.ts` | `connect()` return type adds `accountIdentifier`; new error types |
| `backend/src/integrations/gmail/index.ts` | Extract `accountIdentifier` from `id_token`; update upsert logic; sync guard changed to bail only on `disconnected` |
| `backend/src/integrations/microsoft-tasks/index.ts` | Fetch `/me` for `accountIdentifier`; update upsert logic; sync guard changed to bail only on `disconnected` |
| `backend/src/integrations/apple-calendar/index.ts` | Use credential email as `accountIdentifier`; update upsert logic; sync guard changed to bail only on `disconnected` |
| `backend/src/integrations/integration.service.ts` | Enforce 5-account limit; handle DuplicateAccount / AccountLimit errors |
| `backend/src/api/integrations.routes.ts` | Add PATCH `/label`, PATCH `/pause` (P3), PATCH `/sync-mode`, PATCH `/completion-mode`; error redirects for duplicate/limit; call `scheduleIntegrationSync` after every new connect |
| `backend/src/feed/feed.service.ts` | Update `source` field mapping to use `label ?? accountIdentifier` |
| `backend/src/sync/sync.scheduler.ts` | Skip paused integrations in scheduled sync (P3) |
| `backend/src/sync/integration.service.ts` | Skip paused integrations in manual sync trigger (P3) |

### Backend — New
| File | Purpose |
|------|---------|
| `backend/prisma/migrations/…_add-multi-account/backfill.ts` | Data migration: backfill accountIdentifier from tokens |

### Frontend — Modified
| File | Change |
|------|--------|
| `frontend/src/hooks/useIntegrations.ts` | Group integration accounts by serviceId; expose per-account label/pause/syncMode actions |
| `frontend/src/components/integrations/IntegrationCard.tsx` | Render integration account list within service card; "Add account" button; per-account Mode (Gmail) + Filter (all) buttons |
| `frontend/src/services/integrations.service.ts` | Add `updateLabel()`, `pauseIntegration()`, `updateGmailSyncMode()`, `updateGmailCompletionMode()`, `updateCalendarEventWindow()` API calls with integrationId signatures |
| `frontend/src/app/settings/integrations/page.tsx` | Handle duplicate/limit error query params from OAuth redirect |
| `frontend/src/app/feed/page.tsx` | Replace icon-button nav with AccountMenu component |

### Frontend — New
| File | Purpose |
|------|---------|
| `frontend/src/components/AccountMenu.tsx` | Dropdown showing ordrctrl email + Sign out + settings nav links |

### Tests — New/Modified
| File | Purpose |
|------|---------|
| `backend/tests/unit/integration.service.test.ts` | 5-account limit, duplicate integration account, accountIdentifier extraction |
| `backend/tests/unit/gmail.sync.test.ts` | accountIdentifier extraction from id_token |
| `backend/tests/contract/integrations.test.ts` | PATCH /label, PATCH /pause endpoints |
| `frontend/tests/unit/components/integrations/IntegrationCard.test.tsx` | Multi-account card rendering, add account button |
| `frontend/tests/unit/hooks/useIntegrations.test.ts` | Grouped integration accounts, label/pause actions |
| `frontend/tests/unit/components/AccountMenu.test.tsx` | Email display, sign-out action, nav links |

## Implementation Sequence

```
Phase 1 (P1 Foundation):
  Schema migration → Backfill script → Adapter changes (accountIdentifier)
  → integration.service.ts (limit/dedup) → routes (error redirects)
  → feed source label change

Phase 2 (P1 Frontend — Integration multi-account):
  useIntegrations grouping → IntegrationCard multi-account UI
  → integrations.service.ts (updateLabel) → label edit UI → tests

Phase 2b (P1 Frontend — Account menu):
  AccountMenu component → wire into feed page nav → tests

Phase 3 (P2):
  Label endpoint → label edit in IntegrationCard

Phase 4 (P3):
  Pause field + scheduler skip → PATCH /pause route → pause toggle UI → tests
```

## Running Locally After Migration

```bash
# Apply migration + backfill
cd backend && npx prisma migrate dev

# Verify schema
npx prisma studio   # Check Integration rows have accountIdentifier populated

# Run all tests
cd backend && pnpm test
cd frontend && pnpm test
```

## Gotchas

- **Token backfill**: The backfill script needs `TOKEN_ENCRYPTION_KEY` from env to decrypt existing tokens. Run it in the same environment where the app runs.
- **Apple Calendar**: Apple does not use OAuth; the `accountIdentifier` is the email address from the credential payload. Already available without any extra API call.
- **Microsoft `/me` call**: Requires making an authenticated request during the connect flow. The `User.Read` scope must be included in both the authorization URL and the token exchange request.
- **Duplicate connect UX**: If a user connects the same account twice (e.g., browser back + re-authorize), the redirect error message must be shown on the frontend settings page, not just as a URL param.
- **Feed `source` change**: Existing users who have only one Gmail will now see "user@gmail.com" instead of "Gmail" as the source label. This is intentional (more informative) but is a visible behavior change to document in the PR.
- **BullMQ scheduler bootstrap**: `bootstrapSyncScheduler` only runs once at server startup. New integrations added after startup are NOT automatically scheduled. You must call `scheduleIntegrationSync(integrationId, userId)` explicitly after every successful `connectIntegration` — otherwise the integration will never sync until the server is restarted.
- **Error-state integrations**: All adapters' `sync()` method bails early only when `status === 'disconnected'`, NOT when `status !== 'connected'`. This allows `error`-state integrations to retry syncing and auto-heal (e.g., after a token refresh succeeds). Only a deliberate disconnect should halt sync permanently.
