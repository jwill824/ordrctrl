---
feature: "004-apple-basic-auth"
branch: "004-apple-basic-auth"
---

# Tasks: Apple iCloud Integration via App-Specific Password

**Input**: Design documents from `/specs/004-apple-basic-auth/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅, quickstart.md ✅

**Tests**: Included — plan.md Constitution Principle IV marks tests as ⚠️ REQUIRED before merge.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unresolved dependencies within the current phase)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task description

---

## Phase 1: Setup

**Purpose**: Establish a clean baseline before changing any source files.

- [X] T001 Confirm branch `004-apple-basic-auth` is active and run `pnpm test` in `backend/` to record the baseline test count (expected: 71 passing, 0 failing)

**Checkpoint**: Baseline passing — proceed to foundational changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type system and schema changes that ALL user stories depend on. Must be fully complete before any US phase begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete — every adapter, service, and route file imports from these two sources.

- [X] T002 Add `calendarEventWindowDays Int @default(30)` field to the `Integration` model in `backend/prisma/schema.prisma` (after `gmailSyncMode`, before `importEverything`; see data-model.md for exact placement)
- [X] T003 Run Prisma migration and regenerate the client in `backend/`: `npx prisma migrate dev --name add-calendar-event-window && npx prisma generate` (depends on T002)
- [X] T004 Update `backend/src/integrations/_adapter/types.ts`: add `OAuthPayload`, `CredentialPayload`, `ConnectPayload` union types; add `ConnectOptions.calendarEventWindowDays?: 7 | 14 | 30 | 60`; change `IntegrationAdapter.connect()` signature to `connect(userId: string, payload: ConnectPayload, options?: ConnectOptions)`; add `NotSupportedError`, `InvalidCredentialsError`, and `ProviderUnavailableError` error classes (see data-model.md for exact TypeScript definitions; depends on T003)
- [X] T005 [P] Migrate `GmailAdapter.connect()` in `backend/src/integrations/gmail/index.ts` to the new `ConnectPayload` signature: change parameter from `(userId, authCode)` to `(userId, payload: ConnectPayload)`, narrow on `payload.type === 'oauth'`, and destructure `const { authCode } = payload` — no logic changes inside the method (depends on T004)
- [X] T006 [P] Migrate `MicrosoftTasksAdapter.connect()` in `backend/src/integrations/microsoft-tasks/index.ts` to the new `ConnectPayload` signature using the same mechanical pattern as T005 — narrow on `payload.type === 'oauth'`, destructure `authCode`, no logic changes (depends on T004)

**Checkpoint**: TypeScript compiles clean with the new interface; Prisma client reflects `calendarEventWindowDays`; Gmail and Microsoft adapters pass their existing tests unmodified — user story implementation can begin

---

## Phase 3: User Story 1 — Connect Apple Services (Priority: P1) 🎯 MVP

**Goal**: Users can connect Apple Reminders or Apple Calendar using an iCloud email + App-Specific Password credential form. When a second Apple service is connected, a one-click confirmation screen shows the masked email already on file — no re-entry required.

**Independent Test**: Navigate to integration settings, click "Connect" on Apple Reminders, enter valid iCloud credentials, verify the integration shows "connected" and Reminder lists are available for selection. Then click "Connect" on Apple Calendar and verify the masked-email confirmation screen appears with a single "Connect with this account" button.

### Tests for User Story 1 ⚠️ Write these first — they must FAIL before T011–T018

- [X] T007 [P] [US1] Add Apple Reminders adapter connect() unit tests to `backend/tests/unit/apple-reminders.sync.test.ts`: `connect()` with valid `CredentialPayload` mocks a 207 PROPFIND response and returns `integrationId`; `connect()` with `OAuthPayload` throws `NotSupportedError`; `connect()` with PROPFIND returning 401 throws `InvalidCredentialsError`; `connect()` with PROPFIND returning 503 throws `ProviderUnavailableError`; `getAuthorizationUrl()` throws `NotSupportedError`; `refreshToken()` throws `NotSupportedError`
- [X] T008 [P] [US1] Add Apple Calendar adapter connect() unit tests to `backend/tests/unit/apple-calendar.sync.test.ts` covering the same six scenarios as T007, plus: `connect()` with `calendarEventWindowDays: 14` stores `14` on the Integration record; `connect()` with no `calendarEventWindowDays` defaults to `30`
- [X] T009 [P] [US1] Create `backend/tests/unit/integration.service.test.ts`: `connectIntegration()` with `{ type: 'credential', email, password }` normalizes ASP (strips dashes) before calling adapter; `connectIntegration()` with `{ type: 'use-existing' }` and a connected sibling copies decrypted credentials to adapter call; `connectIntegration()` with `{ type: 'use-existing' }` and no connected sibling throws `NO_EXISTING_CREDENTIALS`; `listIntegrations()` returns `maskedEmail: 'j***@icloud.com'` for Apple service with credentials on file; `listIntegrations()` returns `maskedEmail: null` for Apple service with no credentials; `listIntegrations()` returns `calendarEventWindowDays: 30` for connected `apple_calendar`
- [X] T010 [P] [US1] Create `backend/tests/contract/integration-connect.routes.test.ts`: `POST /api/integrations/apple_reminders/connect` with valid credential body → 200 `{ integrationId, status: 'connected' }`; with invalid credentials (mocked 401) → 401 `INVALID_CREDENTIALS`; with `use-existing` and no sibling → 409 `NO_EXISTING_CREDENTIALS`; for `serviceId: 'gmail'` → 400 `UNSUPPORTED_SERVICE`; with provider unavailable (mocked 503) → 503 `PROVIDER_UNAVAILABLE`

### Implementation for User Story 1

- [X] T011 [P] [US1] Rewrite `AppleRemindersAdapter` in `backend/src/integrations/apple-reminders/index.ts`: update `connect()` to narrow on `payload.type === 'credential'`; define `PROPFIND_PRINCIPAL_XML` constant and private `validateCredentials(email, asp)` helper that issues `PROPFIND https://caldav.icloud.com/` with `Authorization: Basic <base64(email:asp)>` and `Depth: 1`, throws `InvalidCredentialsError` on 401 and `ProviderUnavailableError` on non-OK; upsert Integration record with `encrypt(email)` → `encryptedAccessToken` and `encrypt(asp)` → `encryptedRefreshToken`, `tokenExpiresAt: null`; throw `NotSupportedError` from `getAuthorizationUrl()` and `refreshToken()`
- [X] T012 [P] [US1] Rewrite `AppleCalendarAdapter` in `backend/src/integrations/apple-calendar/index.ts` using the identical pattern as T011, additionally storing `options?.calendarEventWindowDays ?? 30` into `calendarEventWindowDays` on upsert
- [X] T013 [US1] Update `connectIntegration()` and `listIntegrations()` in `backend/src/integrations/integration.service.ts`: in `connectIntegration()` handle `{ type: 'use-existing' }` by looking up the sibling Apple service Integration for the user (throws `AppError('NO_EXISTING_CREDENTIALS', ...)` if not found), decrypt its credentials, and forward as `CredentialPayload`; normalize ASP via `password.replace(/-/g, '')` for `{ type: 'credential' }` payloads before calling adapter; in `listIntegrations()` add `maskEmail()` helper and populate `maskedEmail` (non-null only for Apple services with non-empty `encryptedAccessToken`) and `calendarEventWindowDays` (non-null only for `apple_calendar` when status is not `disconnected`) on every `IntegrationStatusItem` (depends on T011, T012)
- [X] T014 [US1] Add `POST /api/integrations/:serviceId/connect` route to `backend/src/api/integrations.routes.ts`: Zod discriminated-union body schema (`type: 'credential'` with `email`, `password`, optional `calendarEventWindowDays`; `type: 'use-existing'`); guard rejects non-Apple `serviceId` with 400 `UNSUPPORTED_SERVICE`; map `InvalidCredentialsError` → 401, `ProviderUnavailableError` → 503, `AppError('NO_EXISTING_CREDENTIALS')` → 409 (depends on T013)
- [X] T015 [P] [US1] Create `frontend/src/components/AppleCredentialForm.tsx`: props `{ serviceId: 'apple_reminders' | 'apple_calendar'; onSuccess(): void; onError(msg: string): void }`; `<input type="email">` for iCloud email; `<input type="password">` for ASP; callout block: "An App-Specific Password lets ordrctrl access your iCloud data without sharing your Apple ID password. [Generate one at appleid.apple.com ↗]" (external link); on submit call `connectWithCredentials(serviceId, email, password)`; display inline error without page reload on error response
- [X] T016 [P] [US1] Create `frontend/src/components/AppleConfirmationScreen.tsx`: props `{ serviceId: 'apple_reminders' | 'apple_calendar'; maskedEmail: string; onSuccess(): void; onError(msg: string): void }`; render "Connect {service label} using your iCloud account **{maskedEmail}**?"; single "Connect with this account" button; on click call `confirmWithExisting(serviceId)`
- [X] T017 [US1] Add `connectWithCredentials(serviceId, email, password, calendarEventWindowDays?)` and `confirmWithExisting(serviceId)` functions to `frontend/src/services/integrations.service.ts` — both `POST` to `/api/integrations/:serviceId/connect` with the respective body shape (depends on T014)
- [X] T018 [US1] Update the "Connect" action section of `frontend/src/components/IntegrationCard.tsx`: when `serviceId` is `'apple_reminders'` or `'apple_calendar'`, check the sibling integration's `maskedEmail`; if `maskedEmail` is non-null render `<AppleConfirmationScreen maskedEmail={...} />`; otherwise render `<AppleCredentialForm />`; leave OAuth connect link path unchanged for all non-Apple services (depends on T015, T016, T017)

**Checkpoint**: US1 is independently functional — Apple credential form and one-click confirmation connect flow work end-to-end; 71 + new US1 tests pass

---

## Phase 4: User Story 2 — Sync Apple Tasks and Events (Priority: P1)

**Goal**: After connecting, Apple Reminders sync fetches real tasks from iCloud via Basic Auth CalDAV. Apple Calendar sync fetches upcoming events within the user's configurable time window (7/14/30/60 days, default 30). Both adapters use the encrypted credentials stored in Phase 3.

**Independent Test**: Pre-seed a connected Integration record with valid encrypted credentials. Trigger a sync. Verify iCloud tasks/events appear in ordrctrl. Update the event window via the selector and re-sync; verify only events within the new window are returned.

### Tests for User Story 2 ⚠️ Write these first — they must FAIL before T023–T028

- [X] T019 [P] [US2] Add Apple Reminders sync() unit tests to `backend/tests/unit/apple-reminders.sync.test.ts`: `sync()` decrypts `encryptedAccessToken` (email) and `encryptedRefreshToken` (ASP), builds `Authorization: Basic <base64(email:asp)>` header, and sends it on all CalDAV fetch calls (verify via mock header inspection); ASP with hyphens stored in DB is used as-is (already normalized at connect time)
- [X] T020 [P] [US2] Add Apple Calendar sync() unit tests to `backend/tests/unit/apple-calendar.sync.test.ts`: `sync()` reads `integration.calendarEventWindowDays` and builds CalDAV time-range filter from `now` to `now + windowDays * 86400000 ms`; test with `calendarEventWindowDays: 7` produces a 7-day window; test with `calendarEventWindowDays: 60` produces a 60-day window; verify Basic Auth header construction identical to T019
- [X] T021 [P] [US2] Add `updateCalendarEventWindow()` tests to `backend/tests/unit/integration.service.test.ts`: valid `days` values (7, 14, 30, 60) update `calendarEventWindowDays` on the Integration record and return `{ calendarEventWindowDays: days }`; calling with no connected `apple_calendar` integration throws `AppError('INTEGRATION_NOT_FOUND')`
- [X] T022 [P] [US2] Create `backend/tests/contract/integration-event-window.routes.test.ts`: `PUT /api/integrations/apple_calendar/event-window` with `{ days: 14 }` → 200 `{ serviceId, calendarEventWindowDays: 14 }`; with `{ days: 999 }` → 400 `VALIDATION_ERROR`; with no connected `apple_calendar` → 404 `INTEGRATION_NOT_FOUND`; for `serviceId: 'apple_reminders'` → 400 `UNSUPPORTED_SERVICE`

### Implementation for User Story 2

- [X] T023 [P] [US2] Rewrite `AppleRemindersAdapter.sync()` in `backend/src/integrations/apple-reminders/index.ts` to use Basic Auth: decrypt `integration.encryptedAccessToken` (email) and `integration.encryptedRefreshToken!` (ASP) via `decrypt()`; build `authHeader = 'Basic ' + Buffer.from('\${email}:\${asp}').toString('base64')`; pass `Authorization: authHeader` on all CalDAV fetch calls; remove any existing OAuth token construction or JWT usage
- [X] T024 [P] [US2] Rewrite `AppleCalendarAdapter.sync()` in `backend/src/integrations/apple-calendar/index.ts` using the same Basic Auth header pattern as T023; replace the hardcoded `30`-day event window with `const windowDays = integration.calendarEventWindowDays ?? 30` and build CalDAV time-range as `start = now`, `end = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000)`
- [X] T025 [US2] Add `updateCalendarEventWindow(userId: string, days: 7 | 14 | 30 | 60)` to `backend/src/integrations/integration.service.ts`: find Integration where `userId`, `serviceId: 'apple_calendar'`, `status != 'disconnected'`; throw `AppError('INTEGRATION_NOT_FOUND', ...)` if not found; update `calendarEventWindowDays` and return `{ calendarEventWindowDays: updated.calendarEventWindowDays }`
- [X] T026 [US2] Add `PUT /api/integrations/:serviceId/event-window` route to `backend/src/api/integrations.routes.ts`: Zod body `{ days: z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(60)]) }`; guard rejects non-`apple_calendar` serviceId with 400 `UNSUPPORTED_SERVICE`; map `AppError('INTEGRATION_NOT_FOUND')` → 404 (depends on T025)
- [X] T027 [P] [US2] Add `updateCalendarEventWindow(days: 7 | 14 | 30 | 60)` function to `frontend/src/services/integrations.service.ts` — `PUT /api/integrations/apple_calendar/event-window` with `{ days }` body; returns `{ calendarEventWindowDays: number }`
- [X] T028 [US2] Add event window selector to the Apple Calendar `IntegrationCard` section in `frontend/src/components/IntegrationCard.tsx`: render a `<select>` (or segmented control) with options 7, 14, 30, 60 days when `serviceId === 'apple_calendar'` and status is `'connected'`; on change call `updateCalendarEventWindow(days)` and refresh integration status; initialize value from `integration.calendarEventWindowDays` (depends on T027)

**Checkpoint**: US2 is independently functional — Apple Reminders and Calendar sync real iCloud data; event window is configurable and persists across sync cycles

---

## Phase 5: User Story 3 — Reconnect After Credential Change (Priority: P2)

**Goal**: When a stored App-Specific Password is revoked, the next sync detects the 401 from iCloud, sets the integration to an error state with an explanatory message, and the frontend surfaces a reconnect prompt. Disconnecting the last Apple integration permanently purges all stored iCloud credentials.

**Independent Test**: Connect with valid credentials. Revoke the ASP externally (or mock a 401 response). Trigger a sync. Verify `integration.status === 'error'` with the "credentials no longer valid" message. Click "Reconnect", enter new valid credentials, verify status returns to `'connected'` and sync resumes.

### Tests for User Story 3 ⚠️ Write these first — they must FAIL before T032–T036

- [X] T029 [P] [US3] Add sync() error-discrimination tests to `backend/tests/unit/apple-reminders.sync.test.ts`: `sync()` with mocked 401 CalDAV response throws `InvalidCredentialsError`; `sync()` with mocked 503 CalDAV response throws `ProviderUnavailableError`; `sync()` with network timeout throws `ProviderUnavailableError`
- [X] T030 [P] [US3] Add sync() error-discrimination tests to `backend/tests/unit/apple-calendar.sync.test.ts` covering the same three scenarios as T029
- [X] T031 [P] [US3] Add disconnect cleanup tests to `backend/tests/unit/integration.service.test.ts`: `disconnectIntegration()` for the sole connected Apple service sets status to `disconnected` and clears `encryptedAccessToken` and `encryptedRefreshToken` on all Apple Integration records for the user; `disconnectIntegration()` when the sibling Apple service is still `connected` retains the sibling's `encryptedAccessToken` and `encryptedRefreshToken` untouched

### Implementation for User Story 3

- [X] T032 [P] [US3] Add 401/5xx guards to all CalDAV fetch calls inside `AppleRemindersAdapter.sync()` in `backend/src/integrations/apple-reminders/index.ts`: `if (res.status === 401) throw new InvalidCredentialsError(integrationId)`; `if (!res.ok) throw new ProviderUnavailableError(integrationId, res.status)`; wrap `fetch()` calls in try/catch to convert network errors (`TypeError`) into `ProviderUnavailableError`
- [X] T033 [P] [US3] Add identical 401/5xx guards to all CalDAV fetch calls inside `AppleCalendarAdapter.sync()` in `backend/src/integrations/apple-calendar/index.ts` using the same pattern as T032
- [X] T034 [US3] Update the sync job error handler in `backend/src/integrations/integration.service.ts` to catch `InvalidCredentialsError` → `prisma.integration.update({ status: 'error', lastSyncError: 'iCloud credentials are no longer valid. Please reconnect.' })` and catch `ProviderUnavailableError` → `prisma.integration.update({ status: 'error', lastSyncError: 'iCloud is temporarily unavailable. Will retry on next sync.' })` with credentials explicitly retained (no field clear) (depends on T032, T033)
- [X] T035 [US3] Add Apple cross-check cleanup to `disconnectIntegration()` in `backend/src/integrations/integration.service.ts`: after disconnecting the target Integration, query `prisma.integration.findMany({ where: { userId, serviceId: { in: ['apple_reminders', 'apple_calendar'] }, status: 'connected' } })`; if result is empty, `prisma.integration.updateMany({ where: { userId, serviceId: { in: [...] } }, data: { encryptedAccessToken: '', encryptedRefreshToken: null } })` to purge all Apple credentials for the user; if any remain connected, skip (depends on T034)
- [X] T036 [US3] Add reconnect prompt to `frontend/src/components/IntegrationCard.tsx`: when `integration.status === 'error'` and `serviceId` is `'apple_reminders'` or `'apple_calendar'`, display `integration.lastSyncError` message and a "Reconnect" button that opens `<AppleCredentialForm />` in the card; preserve existing error display behavior for non-Apple services

**Checkpoint**: US3 is independently functional — credential expiry is detected, surfaced, and recovery via reconnect works; all three user stories are complete and independently testable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Regression safety, code hygiene, and environment cleanup touching multiple user stories.

- [X] T037 [P] Update `backend/tests/unit/gmail.sync.test.ts`: change any `adapter.connect(userId, authCode)` call to `adapter.connect(userId, { type: 'oauth', authCode })` and confirm all Gmail tests still pass
- [X] T038 [P] Update `backend/tests/unit/microsoft-tasks.sync.test.ts`: apply the same `{ type: 'oauth', authCode }` wrapper update as T037 and confirm all Microsoft Tasks tests still pass
- [X] T039 [P] Remove all `TODO(spec-004)` comments from `backend/src/integrations/apple-reminders/index.ts`
- [X] T040 [P] Remove all `TODO(spec-004)` comments from `backend/src/integrations/apple-calendar/index.ts`
- [X] T041 Update `backend/.env.example`: remove stale Apple OAuth vars (`APPLE_REMINDERS_CLIENT_ID`, `APPLE_REMINDERS_TEAM_ID`, `APPLE_REMINDERS_KEY_ID`, `APPLE_REMINDERS_PRIVATE_KEY`, `APPLE_CALENDAR_CLIENT_ID`, `APPLE_CALENDAR_TEAM_ID`, `APPLE_CALENDAR_KEY_ID`, `APPLE_CALENDAR_PRIVATE_KEY`); add commented placeholder block `# Apple iCloud (dev/test only) — APPLE_USERNAME= APPLE_APP_SPECIFIC_PASSWORD=`
- [X] T042 Run the full backend test suite (`pnpm test` in `backend/`) and confirm all 71 original tests plus all new US1/US2/US3 tests pass with zero failures; fix any unexpected regressions before marking this phase complete

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  └─► Phase 2 (Foundational) — BLOCKS all user stories
        ├─► Phase 3 (US1) ──────────────────────────────┐
        ├─► Phase 4 (US2) ──────────────────────────────┤─► Phase 6 (Polish)
        └─► Phase 5 (US3) ──────────────────────────────┘
```

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories; T005 and T006 are parallel once T004 completes
- **US1 (Phase 3)**: All depend on Phase 2 completion; T007–T010 tests are parallel with each other; T011–T012 are parallel with each other; T013 depends on T011+T012; T014 depends on T013; T015–T016 are parallel with each other and with T014; T017 depends on T014; T018 depends on T015+T016+T017
- **US2 (Phase 4)**: Depends on Phase 2; T019–T022 tests are parallel; T023–T024 are parallel; T025 is independent; T026 depends on T025; T027 is independent; T028 depends on T027
- **US3 (Phase 5)**: Depends on Phase 3 (uses same adapter files and service layer); T029–T031 tests are parallel; T032–T033 are parallel; T034 depends on T032+T033; T035 depends on T034; T036 is independent of T034+T035
- **Polish (Phase 6)**: Depends on all user stories complete; T037–T040 are parallel with each other; T041 is independent; T042 is the final gate

### User Story Dependencies

- **US1 (P1)**: No dependency on US2 or US3 — can be fully delivered and tested as MVP
- **US2 (P1)**: No dependency on US1 (sync is independent of connect flow) — independently testable via pre-seeded Integration record
- **US3 (P2)**: Depends on US1 (reuses adapter files modified in Phase 3) and US2 (error handling in sync covers both adapters); can be started after US1 is complete

---

## Parallel Execution Examples

### Phase 2 (after T004 completes)

```
Task: T005 — Migrate GmailAdapter.connect() in backend/src/integrations/gmail/index.ts
Task: T006 — Migrate MicrosoftTasksAdapter.connect() in backend/src/integrations/microsoft-tasks/index.ts
```

### Phase 3 — US1 Tests (write in parallel)

```
Task: T007 — Apple Reminders connect() tests in backend/tests/unit/apple-reminders.sync.test.ts
Task: T008 — Apple Calendar connect() tests in backend/tests/unit/apple-calendar.sync.test.ts
Task: T009 — Service layer tests in backend/tests/unit/integration.service.test.ts
Task: T010 — Route contract tests in backend/tests/contract/integration-connect.routes.test.ts
```

### Phase 3 — US1 Adapter Rewrites (after tests are written)

```
Task: T011 — Rewrite AppleRemindersAdapter in backend/src/integrations/apple-reminders/index.ts
Task: T012 — Rewrite AppleCalendarAdapter in backend/src/integrations/apple-calendar/index.ts
```

### Phase 3 — US1 Frontend Components (after T014 route is complete)

```
Task: T015 — Create AppleCredentialForm.tsx in frontend/src/components/
Task: T016 — Create AppleConfirmationScreen.tsx in frontend/src/components/
```

### Phase 6 — Polish (all independent)

```
Task: T037 — Update gmail.sync.test.ts
Task: T038 — Update microsoft-tasks.sync.test.ts
Task: T039 — Remove TODOs from apple-reminders/index.ts
Task: T040 — Remove TODOs from apple-calendar/index.ts
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 — both P1)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T006) — CRITICAL gate
3. Complete Phase 3: US1 (T007–T018) — credential connect flow
4. **STOP and VALIDATE**: Users can connect Apple services end-to-end
5. Complete Phase 4: US2 (T019–T028) — sync actually works
6. **STOP and VALIDATE**: Connected Apple services sync real iCloud data
7. Deploy MVP — both P1 stories delivered

### Full Delivery (adds US3 + polish)

8. Complete Phase 5: US3 (T029–T036) — reconnect after credential change
9. Complete Phase 6: Polish (T037–T042) — regression safety + cleanup
10. Full merge ready

### Parallel Team Strategy (2+ developers)

After Phase 2 is complete:
- **Developer A**: Phase 3 US1 (T007–T018) — connect flow
- **Developer B**: Phase 4 US2 (T019–T028) — sync rewrite (uses same adapter files; coordinate on apple-reminders/index.ts and apple-calendar/index.ts to avoid merge conflicts — suggest Developer A finishes T011/T012 before Developer B starts T023/T024)

---

## Task Count Summary

| Phase | Story | Tasks | Notes |
|-------|-------|-------|-------|
| Phase 1 | Setup | 1 | T001 |
| Phase 2 | Foundational | 5 | T002–T006 |
| Phase 3 | US1 (P1) | 12 | T007–T018 (4 test + 8 impl) |
| Phase 4 | US2 (P1) | 10 | T019–T028 (4 test + 6 impl) |
| Phase 5 | US3 (P2) | 8 | T029–T036 (3 test + 5 impl) |
| Phase 6 | Polish | 6 | T037–T042 |
| **Total** | | **42** | |

**Parallel opportunities identified**: 19 tasks marked `[P]`  
**Test tasks**: 15 (T007–T010, T019–T022, T029–T031, T037–T038)  
**Implementation tasks**: 27  

---

## Notes

- `[P]` tasks operate on different files with no unresolved dependencies — safe to run concurrently within the same phase
- `[US1]`, `[US2]`, `[US3]` labels map tasks to spec.md user stories for traceability
- `backend/src/integrations/apple-reminders/index.ts` and `backend/src/integrations/apple-calendar/index.ts` are touched in US1 (T011/T012), US2 (T023/T024), and US3 (T032/T033) — if working these stories in parallel, coordinate on these files to avoid merge conflicts
- Tests must be written and confirmed FAILING before their corresponding implementation tasks are started
- Commit after each task or logical group; validate story checkpoints before proceeding
- ASP normalization (`password.replace(/-/g, '')`) happens in the service layer (T013), not in the adapter — adapters always receive an already-normalized 16-character string
- `tokenExpiresAt` is always stored as `null` for Apple Integration records — credentials are revoked, not expired
