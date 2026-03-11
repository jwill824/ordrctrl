# Tasks: Multi-Account Integration Support + User Account Menu (009)

**Input**: Design documents from `/specs/009-multi-account/`
**Branch**: `009-multi-account`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on sibling tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- File paths are exact

---

## Phase 1: Setup (Schema & Migration)

**Purpose**: Apply the database changes required by every user story. No user story work can begin until the migration is applied and backfill is verified.

- [X] T001 Update `backend/prisma/schema.prisma` — add `accountIdentifier String`, `label String?`, `paused Boolean @default(false)` to Integration; change `@@unique([userId, serviceId])` → `@@unique([userId, serviceId, accountIdentifier])`
- [X] T002 Create Prisma migration `add-multi-account` in `backend/prisma/migrations/` — 3-step SQL: (1) add nullable columns, (2) set NOT NULL + new unique constraint, (3) drop old unique index
- [X] T003 Write backfill script `backend/prisma/migrations/add-multi-account/backfill.ts` — decrypt each Integration's `encryptedAccessToken`, extract account email (Google `id_token` sub, Microsoft stored `mail`, Apple `email` credential), write to `accountIdentifier`; fall back to `"unknown@<serviceId>"` on failure

**Checkpoint**: Run `cd backend && npx prisma migrate dev` — confirm Integration rows have `accountIdentifier` populated and the old unique constraint is gone.

---

## Phase 2: Foundational (Adapter Interface + Service Guards)

**Purpose**: Core backend changes shared by all user stories — adapter interface, per-adapter accountIdentifier extraction, service-layer limit/dedup guards, and feed source label update.

**⚠️ CRITICAL**: Complete before any user story frontend work begins.

- [X] T004 Update `backend/src/integrations/_adapter/types.ts` — change `connect()` return type from `Promise<{ integrationId: string }>` to `Promise<{ integrationId: string; accountIdentifier: string }>`, add `AccountLimitError` and `DuplicateAccountError` typed error classes
- [X] T005 [P] Update `backend/src/integrations/gmail/gmail.adapter.ts` — decode `id_token` JWT after token exchange, extract `email` claim as `accountIdentifier`; change `upsert on {userId_serviceId}` → create/update on `(userId, serviceId, accountIdentifier)`
- [X] T006 [P] Update `backend/src/integrations/microsoft-tasks/microsoft-tasks.adapter.ts` — call `GET https://graph.microsoft.com/v1.0/me` immediately after token exchange, use `mail` field as `accountIdentifier`; change upsert logic to create/update on `(userId, serviceId, accountIdentifier)`
- [X] T007 [P] Update `backend/src/integrations/apple-calendar/apple-calendar.adapter.ts` — use `email` from the credential payload as `accountIdentifier`; change upsert logic to create/update on `(userId, serviceId, accountIdentifier)`
- [X] T008 Update `backend/src/integrations/integration.service.ts` — enforce 5-account limit before insert (count where `{userId, serviceId}`, throw `AccountLimitError` if ≥ 5); detect duplicate connect (check existing row with same `accountIdentifier`, throw `DuplicateAccountError` if found); update tokens if reconnecting the same account
- [X] T009 Update `backend/src/feed/feed.service.ts` — change `source` field from `SERVICE_DISPLAY_NAMES[serviceId]` to `integration.label ?? integration.accountIdentifier`; update all queries that build FeedItems to join/include `label` and `accountIdentifier` from Integration

**Checkpoint**: Backend unit tests for adapters and integration.service pass with the new logic in place.

---

## Phase 3: User Story 1 — Connect a Second Integration Account (Priority: P1) 🎯 MVP Start

**Goal**: Users can connect a second (or third…fifth) integration account per service. Duplicate and limit errors redirect correctly.

**Independent Test**: Connect a second Gmail account on a user who already has one; verify both appear in `GET /api/integrations`; connect the same account again and confirm the `duplicate_account` error redirect fires.

### Backend — US1

- [X] T010 [US1] Update `backend/src/api/integrations.routes.ts` — catch `DuplicateAccountError` from adapter and redirect to `/onboarding?error=duplicate_account&serviceId=<id>`; catch `AccountLimitError` and redirect to `/onboarding?error=account_limit_reached&serviceId=<id>`; include `accountIdentifier`, `label`, `paused` in the `GET /api/integrations` response shape
- [ ] T011 [US1] Add unit tests to `backend/tests/unit/integration.service.test.ts` — (1) throws `AccountLimitError` when 5 accounts already exist for `(userId, serviceId)`; (2) throws `DuplicateAccountError` when same `accountIdentifier` already connected; (3) creates new row when under limit and identifier is unique; (4) updates tokens when reconnecting same account
- [ ] T012 [P] [US1] Add unit tests to `backend/tests/unit/gmail.adapter.test.ts` — verify `accountIdentifier` is extracted from `id_token` email claim; verify error is thrown if `id_token` missing or malformed
- [ ] T013 [US1] Add contract tests to `backend/tests/contract/integrations.test.ts` — (1) `GET /api/integrations` response includes `accountIdentifier`, `label`, `paused` per account; (2) callback redirect on duplicate account; (3) callback redirect on account limit

### Frontend — US1

- [ ] T014 [US1] Update `frontend/src/hooks/useIntegrations.ts` — group flat Integration array by `serviceId`; expose grouped structure `{ [serviceId]: Integration[] }` plus existing connect/disconnect actions; add `addAccount(serviceId)` action that triggers the same OAuth connect flow as the first account
- [ ] T015 [US1] Update `frontend/src/components/integrations/IntegrationCard.tsx` — render each account as a row within the service card (show `label ?? accountIdentifier` per account); add "Add account" button (disabled + tooltip when at 5-account limit); handle `duplicate_account` and `account_limit_reached` error query params passed from the OAuth redirect
- [ ] T016 [P] [US1] Update `frontend/src/app/settings/integrations/page.tsx` — read `error` and `serviceId` query params from OAuth redirect; display user-friendly toast/banner for `duplicate_account` and `account_limit_reached` errors
- [ ] T017 [US1] Add tests to `frontend/tests/unit/hooks/useIntegrations.test.ts` — grouped accounts by serviceId, `addAccount` action, accounts array per service
- [ ] T018 [P] [US1] Add tests to `frontend/tests/unit/components/integrations/IntegrationCard.test.tsx` — multi-account list render, "Add account" button present, button disabled at limit, error banner on duplicate_account param

**Checkpoint**: Two Gmail accounts connected, both visible in settings card, both syncing independently. Error redirects verified.

---

## Phase 4: User Story 2 — Distinguish and Manage Individual Accounts (Priority: P1)

**Goal**: Each account is distinctly labelled in the feed. Users can disconnect one account without affecting others.

**Independent Test**: With two Gmail accounts connected, confirm feed items show the source account email; disconnect one account; confirm only that account's items disappear from the feed while the other account continues syncing.

### Backend — US2

- [ ] T019 [US2] Verify `backend/src/api/integrations.routes.ts` `DELETE /:integrationId` route — confirm it deletes only the targeted Integration row (by `id` + `userId` ownership check) and that cascade on `SyncCacheItem.integrationId` removes only that account's cached items; add ownership guard if missing

### Frontend — US2

- [ ] T020 [US2] Update `frontend/src/components/integrations/IntegrationCard.tsx` — add per-account "Disconnect" button within each account row (separate from any service-level disconnect); confirm modal copy clearly says "Disconnect [accountIdentifier]" not just "Disconnect Gmail"
- [ ] T021 [US2] Add contract test to `backend/tests/contract/integrations.test.ts` — `DELETE /api/integrations/:integrationId` removes only the targeted account; second account for same service remains connected

**Checkpoint**: Feed displays `personal@gmail.com` / `work@company.com` as source labels. Per-account disconnect removes only that account's tasks.

---

## Phase 5: User Story 4 — User Account Menu: Logout and App Navigation (Priority: P1)

**Goal**: Users can sign out of their ordrctrl user account from the feed page and navigate to all settings sections from a single menu. Uses existing `POST /api/auth/logout` and `GET /api/auth/me` — no new backend endpoints.

**Independent Test**: Open feed, open account menu, confirm ordrctrl email shown, click "Sign out", confirm redirect to login page and session destroyed. Can be tested completely independently of multi-account integration work.

> **Note**: This phase touches only frontend files that are not modified by Phases 3–4 (feed page nav + new component), so it can be worked on in parallel with those phases.

- [ ] T022 [US4] Create `frontend/src/components/AccountMenu.tsx` — dropdown menu component; calls `GET /api/auth/me` on mount to display signed-in ordrctrl email; "Sign out" button calls `POST /api/auth/logout` then redirects to `/`; links to settings sections (Integrations `/settings/integrations`, Feed `/settings/feed`, Dismissed `/feed?showDismissed=true`)
- [ ] T023 [US4] Update `frontend/src/app/feed/page.tsx` — replace the settings gear icon and dismissed items icon buttons in the sticky nav with the `AccountMenu` component; preserve refresh button; ensure `useAuth` redirect still fires for unauthenticated users
- [ ] T024 [US4] Add tests to `frontend/tests/unit/components/AccountMenu.test.tsx` — renders ordrctrl email from `/api/auth/me`, "Sign out" triggers logout + redirect, nav links render correctly, loading/error state when `/me` request is in flight

**Checkpoint**: Sign out works from the feed page. All settings sections accessible from account menu.

---

## Phase 6: User Story 3 — Label / Nickname Integration Accounts (Priority: P2)

**Goal**: Users can assign a custom nickname to each connected integration account; the label is shown in settings and as the feed item source.

**Independent Test**: Edit label on one of two connected Gmail accounts to "Work"; verify the feed shows "Work" as the source label for that account's items; clear the label and verify it reverts to the email address.

### Backend — US3

- [ ] T025 [US3] Add `PATCH /api/integrations/:integrationId/label` route to `backend/src/api/integrations.routes.ts` — validate `label` is string ≤ 50 chars (empty string = clear); ownership check by `userId`; return `{ id, label, accountIdentifier }`
- [ ] T026 [US3] Add `updateLabel(integrationId, userId, label)` to `backend/src/integrations/integration.service.ts` — enforce 50-char max; treat empty string as `null`; return updated Integration
- [ ] T027 [US3] Add contract tests to `backend/tests/contract/integrations.test.ts` — `PATCH /label` 200 with valid label; 400 on label > 50 chars; 404 on unknown integrationId; 200 with empty string clears label

### Frontend — US3

- [ ] T028 [P] [US3] Add `updateLabel(integrationId, label)` to `frontend/src/services/integrations.service.ts` — `PATCH /api/integrations/:integrationId/label`
- [ ] T029 [US3] Update `frontend/src/components/integrations/IntegrationCard.tsx` — add inline label edit per account row: click account identifier / label text to enter edit mode, input field (max 50 chars), save/cancel; call `updateLabel` on save; update local state optimistically
- [ ] T030 [US3] Update `frontend/tests/unit/components/integrations/IntegrationCard.test.tsx` — label edit enter/exit, save calls updateLabel, optimistic label update displayed, cancel restores original label

**Checkpoint**: Custom label "Work" appears in settings card and feed source badge for the labelled account.

---

## Phase 7: User Story 5 — Pause Syncing for an Individual Account (Priority: P3)

**Goal**: Users can pause a connected integration account so no new tasks are fetched, without disconnecting it. Resuming triggers an immediate sync.

**Independent Test**: Pause one of two Gmail accounts; run a manual sync; confirm no new tasks from the paused account; resume; confirm tasks from that account reappear.

### Backend — US5

- [ ] T031 [US5] Add `PATCH /api/integrations/:integrationId/pause` route to `backend/src/api/integrations.routes.ts` — accept `{ "paused": boolean }`; ownership check; return `{ id, paused, status }`; return 400 if integration is not `connected` status when trying to pause
- [ ] T032 [US5] Add `pauseIntegration(integrationId, userId, paused)` to `backend/src/integrations/integration.service.ts` — validate integration is `connected` before pausing; update `paused` flag; if resuming (`paused: false`), trigger an immediate sync job via BullMQ
- [X] T033 [P] [US5] Update `backend/src/sync/sync.scheduler.ts` — add `WHERE paused = false` filter to the scheduled sync query so paused integrations are skipped
- [X] T034 [P] [US5] Update `backend/src/sync/sync.worker.ts` (manual sync trigger path) — skip integrations where `paused = true` when processing a user's manual refresh
- [ ] T035 [US5] Add contract tests to `backend/tests/contract/integrations.test.ts` — `PATCH /pause` toggles state; 400 when integration not connected; paused account skipped in next sync

### Frontend — US5

- [ ] T036 [P] [US5] Add `pauseIntegration(integrationId, paused)` to `frontend/src/services/integrations.service.ts` — `PATCH /api/integrations/:integrationId/pause`
- [ ] T037 [US5] Update `frontend/src/components/integrations/IntegrationCard.tsx` — add pause toggle (e.g., play/pause icon button) per account row; show "Paused" badge on account when `paused = true`; disabled when integration status is `error`
- [ ] T038 [US5] Update `frontend/tests/unit/components/integrations/IntegrationCard.test.tsx` — pause toggle calls pauseIntegration, "Paused" badge renders, toggle disabled on error status

**Checkpoint**: Paused account badge visible, no new sync activity until resumed.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T039 Run full backend test suite `cd backend && pnpm test` and confirm all tests pass
- [ ] T040 [P] Run full frontend test suite `cd frontend && pnpm test` and confirm all tests pass
- [ ] T041 [P] Run frontend build `cd frontend && pnpm build` to confirm no TypeScript or build errors
- [ ] T042 Update `specs/009-multi-account/spec.md` — change `Status: Draft` → `Status: Implemented`
- [ ] T043 Push `009-multi-account` branch and open PR against `main`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Schema)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (migration applied) — **BLOCKS all user story phases**
- **Phase 3 (US1)** and **Phase 5 (US4)**: Can start in parallel after Phase 2 — touch different files
- **Phase 4 (US2)**: Depends on Phase 3 (multi-account card/grouping must exist first)
- **Phase 6 (US3)**: Can start after Phase 2 (backend) / after Phase 3 (frontend IntegrationCard)
- **Phase 7 (US5)**: Can start after Phase 2 (backend) / after Phase 3 (frontend IntegrationCard)
- **Phase 8 (Polish)**: Depends on all desired stories complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — core multi-account connect
- **US2 (P1)**: After US1 — per-account disconnect builds on the grouped card UI
- **US4 (P1)**: After Phase 2 — fully independent of US1/US2 (different files entirely)
- **US3 (P2)**: After Phase 2 backend; after US1 frontend (IntegrationCard must render account rows first)
- **US5 (P3)**: After Phase 2 backend; after US1 frontend

### Parallel Opportunities

- T005, T006, T007 (adapter updates) — all parallel, different files
- Phase 5 (US4 / AccountMenu) — fully parallel with Phase 3 (US1)
- T028, T036 (frontend service additions) — parallel with card UI work
- T033, T034 (sync scheduler + worker) — parallel

---

## Parallel Example: Phase 2 (Foundational)

```bash
# These three adapter tasks can run simultaneously:
Task T005: "Update gmail.adapter.ts — accountIdentifier from id_token"
Task T006: "Update microsoft-tasks.adapter.ts — accountIdentifier from /me"
Task T007: "Update apple-calendar.adapter.ts — accountIdentifier from credential"

# Then unblock:
Task T008: "Update integration.service.ts — limit/dedup guards"
Task T009: "Update feed.service.ts — source = label ?? accountIdentifier"
```

## Parallel Example: Phase 3 + Phase 5 (US1 + US4 in parallel)

```bash
# Can run completely in parallel after Phase 2:
# Developer A: US1 (T010–T018) — integration multi-account connect
# Developer B: US4 (T022–T024) — AccountMenu component + feed nav
```

---

## Implementation Strategy

### MVP First (P1 Stories Only)

1. Phase 1: Schema migration
2. Phase 2: Foundational backend (adapter + service guards)
3. Phase 3: US1 — connect second account
4. Phase 4: US2 — per-account disconnect + feed labels
5. Phase 5: US4 — account menu sign-out
6. **STOP and VALIDATE**: All three P1 stories independently testable
7. Open PR

### Incremental Delivery After MVP

1. Add US3 (Phase 6) → label nicknames
2. Add US5 (Phase 7) → pause toggle
3. Each addition is independently deployable without breaking P1 behaviour
