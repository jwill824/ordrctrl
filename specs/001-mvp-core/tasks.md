# Tasks: ordrctrl Initial MVP

**Branch**: `001-mvp-core` | **Date**: 2026-03-05
**Input**: `specs/001-mvp-core/` — plan.md, spec.md, data-model.md, contracts/, research.md

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo scaffolding, tooling, and dev environment bootstrap.

- [x] T001 Initialize pnpm monorepo with workspace config (`package.json`, `pnpm-workspace.yaml`)
- [x] T002 [P] Initialize Fastify 4 + TypeScript backend project (`backend/package.json`, `backend/tsconfig.json`)
- [x] T003 [P] Initialize Next.js 14 App Router + TypeScript frontend project (`frontend/package.json`, `frontend/tsconfig.json`)
- [x] T004 Configure shared ESLint + Prettier for monorepo (`.eslintrc.js`, `.prettierrc`, root `package.json` lint scripts)
- [x] T005 Add Docker Compose with PostgreSQL 16 + Redis 7 services (`docker-compose.yml`)
- [x] T006 Create environment variable templates (`backend/.env.example`, `frontend/.env.example`) per `quickstart.md`
- [x] T007 [P] Configure Vitest for backend unit and contract tests (`backend/vitest.config.ts`, `backend/tests/` directory structure)
- [x] T008 [P] Configure Playwright for frontend e2e tests (`frontend/playwright.config.ts`, `frontend/tests/e2e/` directory structure)

**Checkpoint**: `docker compose up -d` starts Postgres + Redis; `pnpm install` installs all workspace packages

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story starts.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T009 Write Prisma schema with all 5 entities — User, Integration, SyncCacheItem, NativeTask, indexes (`backend/prisma/schema.prisma`)
- [x] T010 Create and run initial Prisma migration (`backend/prisma/migrations/0001_init/`)
- [x] T011 Export configured Prisma client singleton (`backend/src/lib/db.ts`)
- [x] T012 [P] Implement AES-256-GCM encryption/decryption utility for OAuth tokens (`backend/src/lib/encryption.ts`)
- [x] T013 [P] Implement structured JSON logger (no secrets/tokens in output) (`backend/src/lib/logger.ts`)
- [x] T014 [P] Configure Redis client + BullMQ queue and worker base (`backend/src/lib/redis.ts`, `backend/src/lib/queue.ts`)
- [x] T015 Create Fastify app factory with CORS, cookie, and sensible plugins registered (`backend/src/app.ts`)
- [x] T016 [P] Implement global error handler and 404 handler for Fastify (`backend/src/api/error-handler.ts`)
- [x] T017 Create backend server entry point with graceful shutdown (`backend/src/server.ts`)
- [x] T018 [P] Create Next.js base API client with session cookie forwarding and typed error handling (`frontend/src/services/api-client.ts`)

**Checkpoint**: `pnpm dev` starts both servers; `GET /healthz` on backend returns `{ "status": "ok" }`

---

## Phase 3: User Story 1 — Account Creation & Login (Priority: P1) 🎯 MVP

**Goal**: New users can register, verify email, and log in. Google and Apple social login supported. Password reset flow complete.

**Independent Test**: Register with email → receive verification link → verify → log out → log back in → reset password. No integrations required.

### Implementation

- [x] T019 [P] [US1] Implement Fastify session plugin using Redis as session store (`backend/src/auth/session.plugin.ts`)
- [x] T020 [P] [US1] Configure openid-client for Sign in with Google (authorization URL, callback, user info) (`backend/src/auth/providers/google.ts`)
- [x] T021 [P] [US1] Configure openid-client for Sign in with Apple (authorization URL, POST callback, user info) (`backend/src/auth/providers/apple.ts`)
- [x] T022 [P] [US1] Configure Resend email client with verification and password-reset email templates (`backend/src/lib/email.ts`)
- [x] T023 [US1] Implement AuthService — register, verifyEmail, login, logout, hashPassword, validatePassword (FR-001–007) (`backend/src/auth/auth.service.ts`)
- [x] T024 [US1] Implement email verification token service — issue, validate, expire (FR-003) (`backend/src/auth/verification.service.ts`)
- [x] T025 [US1] Implement password reset service — request, validate token, update password (FR-005) (`backend/src/auth/password-reset.service.ts`)
- [x] T026 [US1] Register auth API routes: `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/verify-email`, `/auth/forgot-password`, `/auth/reset-password` per `contracts/auth-api.md` (`backend/src/api/auth.routes.ts`)
- [x] T027 [US1] Register Google + Apple OAuth identity routes: `GET /auth/google`, `/auth/google/callback`, `/auth/apple`, `POST /auth/apple/callback` per `contracts/auth-api.md` (`backend/src/api/auth.routes.ts`)
- [x] T028 [P] [US1] Create signup page and `SignupForm` component (email, password, Google/Apple buttons) (`frontend/src/app/signup/page.tsx`, `frontend/src/components/auth/SignupForm.tsx`)
- [x] T029 [P] [US1] Create login page and `LoginForm` component (email, password, Google/Apple buttons) (`frontend/src/app/login/page.tsx`, `frontend/src/components/auth/LoginForm.tsx`)
- [x] T030 [P] [US1] Create forgot-password and reset-password pages (`frontend/src/app/forgot-password/page.tsx`, `frontend/src/app/reset-password/page.tsx`)
- [x] T031 [US1] Create `useAuth` hook and auth API service for frontend state management (`frontend/src/hooks/useAuth.ts`, `frontend/src/services/auth.service.ts`)
- [x] T032 [US1] Implement Next.js route guard middleware — redirect unauthenticated users to `/login` (`frontend/src/middleware.ts`)

**Checkpoint**: Full auth flow works end-to-end. Social login redirects correctly. Password reset delivers email. Rate limiting on login (FR-006) tested.

---

## Phase 4: User Story 2 — Integration Onboarding (Priority: P2)

**Goal**: Logged-in users can connect, view status of, and disconnect any of the four integrations via OAuth. Gmail sync mode selectable at connect time.

**Independent Test**: Connect Apple Reminders → verify "Connected" status appears → disconnect → verify status reverts. No feed required.

### Implementation

- [x] T033 [P] [US2] Define `IntegrationAdapter` interface, `ServiceId` enum, `NormalizedItem` and `ConnectOptions` types per `contracts/integration-adapter.md` (`backend/src/integrations/_adapter/types.ts`)
- [x] T034 [P] [US2] Implement Gmail adapter — `connect` (with syncMode), `sync` (all-unread vs starred), `refreshToken`, `disconnect` (FR-024) (`backend/src/integrations/gmail/index.ts`)
- [x] T035 [P] [US2] Implement Apple Reminders adapter — `connect`, `sync`, `refreshToken`, `disconnect` (`backend/src/integrations/apple-reminders/index.ts`)
- [x] T036 [P] [US2] Implement Microsoft Tasks adapter — `connect`, `sync`, `refreshToken`, `disconnect` (`backend/src/integrations/microsoft-tasks/index.ts`)
- [x] T037 [P] [US2] Implement Apple Calendar adapter — `connect`, `sync`, `refreshToken`, `disconnect` (`backend/src/integrations/apple-calendar/index.ts`)
- [x] T038 [US2] Create adapter registry mapping `ServiceId` to adapter instances (`backend/src/integrations/index.ts`)
- [x] T039 [US2] Implement `IntegrationService` — connect (initiate OAuth), disconnect (revoke + delete cache), status, updateGmailSyncMode (FR-009–013, FR-024) (`backend/src/integrations/integration.service.ts`)
- [x] T040 [US2] Register integrations API routes per `contracts/integrations-api.md`: `GET /integrations`, `GET /integrations/:serviceId/connect`, `GET /integrations/:serviceId/callback`, `DELETE /integrations/:serviceId`, `POST /integrations/:serviceId/reconnect`, `POST /integrations/sync` (`backend/src/api/integrations.routes.ts`)
- [x] T041 [P] [US2] Create `IntegrationCard` component — shows service name, icon, status badge, connect/disconnect/reconnect actions (`frontend/src/components/integrations/IntegrationCard.tsx`)
- [x] T042 [P] [US2] Create `GmailSyncModeSelector` component — radio group for "All unread" vs "Starred only" shown during Gmail connect (FR-024) (`frontend/src/components/integrations/GmailSyncModeSelector.tsx`)
- [x] T043 [US2] Create onboarding page — tutorial copy, 4 integration cards in initial connect state, shown when user has no integrations (FR-009) (`frontend/src/app/onboarding/page.tsx`)
- [x] T044 [US2] Create integration settings page — all 4 cards with live status, disconnect and reconnect actions, Gmail sync mode toggle (FR-011, FR-012) (`frontend/src/app/settings/integrations/page.tsx`)
- [x] T045 [US2] Create `useIntegrations` hook and integrations API service (`frontend/src/hooks/useIntegrations.ts`, `frontend/src/services/integrations.service.ts`)

**Checkpoint**: OAuth flows for all 4 integrations complete. Connect/disconnect cycle works. Gmail sync mode persists. Error on OAuth denial shows retry prompt (FR-013).

---

## Phase 5: User Story 3 — Consolidated Task & Calendar Feed (Priority: P3)

**Goal**: Users with ≥1 connected integration see a single chronological feed of tasks, reminders, events, and messages. Source-labeled. Duplicate flag shown. One-way sync. Completed section at bottom.

**Independent Test**: With Apple Reminders connected, items appear in feed with "Apple Reminders" label and correct ordering. Mark one complete → moves to Completed section.

### Implementation

- [x] T046 [P] [US3] Implement `CacheService` — persist `NormalizedItem[]` to `SyncCacheItem`, TTL enforcement (`expiresAt = syncedAt + 24h`), stale cleanup (`backend/src/sync/cache.service.ts`)
- [x] T047 [P] [US3] Implement sync worker — BullMQ job processor: calls `adapter.sync()`, attempts `adapter.refreshToken()` on token error (FR-025), updates integration status, persists via CacheService (`backend/src/sync/sync.worker.ts`)
- [x] T048 [US3] Implement sync scheduler — registers repeating BullMQ job every 15 minutes per connected integration, exposes `triggerManualSync(userId)` for on-demand refresh (FR-026) (`backend/src/sync/sync.scheduler.ts`)
- [x] T049 [US3] Implement `FeedService` — merge `SyncCacheItem[]` + `NativeTask[]` into `FeedItem[]`, apply ordering rules (dated asc, undated by syncedAt desc), apply duplicate detection (case-insensitive title match across sources, set `isDuplicateSuspect`) (FR-014, FR-022) (`backend/src/feed/feed.service.ts`)
- [x] T050 [US3] Register feed API routes per `contracts/feed-api.md`: `GET /feed`, `PATCH /feed/items/:itemId/complete`, `POST /integrations/sync` manual trigger (FR-014–018, FR-023) (`backend/src/api/feed.routes.ts`)
- [x] T051 [P] [US3] Create `FeedItem` component — title, due date, source label/icon, duplicate warning icon when `isDuplicateSuspect`, complete checkbox (FR-015, FR-022) (`frontend/src/components/feed/FeedItem.tsx`)
- [x] T052 [P] [US3] Create `CompletedSection` component — collapsible section collapsed by default, renders completed `FeedItem` list (FR-023) (`frontend/src/components/feed/CompletedSection.tsx`)
- [x] T053 [P] [US3] Create `IntegrationErrorBanner` component — non-blocking per-integration inline error with re-auth CTA when token refresh failed (FR-017, FR-025) (`frontend/src/components/feed/IntegrationErrorBanner.tsx`)
- [x] T054 [P] [US3] Create `FeedEmptyState` component — shown when no integrations + no native tasks; link to `/onboarding` (FR-016) (`frontend/src/components/feed/FeedEmptyState.tsx`)
- [x] T055 [US3] Create feed page — renders active `FeedItem[]`, `CompletedSection`, `IntegrationErrorBanner[]`, `FeedEmptyState`, manual Refresh button, sync status row (`frontend/src/app/feed/page.tsx`)
- [x] T056 [US3] Create `useFeed` hook — fetches `GET /feed`, calls `POST /integrations/sync` on manual refresh, polls every 60s for sync status updates (`frontend/src/hooks/useFeed.ts`, `frontend/src/services/feed.service.ts`)

**Checkpoint**: Feed renders items from connected integrations with source labels. Duplicate indicator appears. Completed section collapses/expands. Integration error shown without hiding other items. Background sync fires every 15 minutes.

---

## Phase 6: User Story 4 — Native Task Creation (Priority: P4)

**Goal**: Users can create, edit, delete, and complete tasks natively in ordrctrl. Native tasks appear in the unified feed labeled "ordrctrl."

**Independent Test**: With no integrations connected, create a task → appears in feed labeled "ordrctrl" → edit title → complete → appears in Completed section → delete.

### Implementation

- [x] T057 [P] [US4] Implement `TaskService` — create, update, delete, complete `NativeTask` (FR-019–021) (`backend/src/tasks/task.service.ts`)
- [x] T058 [US4] Register native task API routes per `contracts/feed-api.md`: `POST /tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id` (`backend/src/api/tasks.routes.ts`)
- [x] T059 [P] [US4] Create `AddTaskForm` component — title (required), due date (optional date picker), submit action (FR-019) (`frontend/src/components/tasks/AddTaskForm.tsx`)
- [x] T060 [P] [US4] Create `EditTaskModal` component — pre-filled title and due date, save and delete actions (FR-021) (`frontend/src/components/tasks/EditTaskModal.tsx`)
- [x] T061 [US4] Wire native task creation and editing into feed page — floating action button opens `AddTaskForm`; tapping a native `FeedItem` opens `EditTaskModal` (`frontend/src/app/feed/page.tsx`)
- [x] T062 [US4] Create `useNativeTasks` hook and tasks API service (`frontend/src/hooks/useNativeTasks.ts`, `frontend/src/services/tasks.service.ts`)

**Checkpoint**: All four acceptance scenarios for US4 pass. Native tasks appear alongside synced items with correct ordering and "ordrctrl" source label.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Security hardening, request validation, responsive styling, and smoke-test validation.

- [x] T063 [P] Add Zod request validation schemas for all API route inputs (`backend/src/api/schemas/auth.schemas.ts`, `integrations.schemas.ts`, `feed.schemas.ts`, `tasks.schemas.ts`)
- [x] T064 [P] Add Fastify rate-limit plugin — stricter limits on `/auth/login` and `/auth/register` (FR-006) (`backend/src/api/rate-limit.plugin.ts`)
- [x] T065 [P] Add CSRF `state` parameter validation utility used by all OAuth callback routes (`backend/src/lib/csrf.ts`)
- [x] T066 [P] Configure Tailwind CSS with minimalist design tokens (no unnecessary color/animation) for all pages (`frontend/tailwind.config.ts`, `frontend/src/styles/globals.css`)
- [x] T067 [P] Ensure all pages are responsive for mobile browser viewport (feed, onboarding, auth pages) (`frontend/src/components/`)
- [x] T068 [P] Write unit tests for `FeedService` — ordering rules, duplicate detection, completed separation (`backend/tests/unit/feed.service.test.ts`)
- [x] T069 [P] Write unit tests for `encryption.ts` — encrypt/decrypt round-trip, tamper detection (`backend/tests/unit/encryption.test.ts`)
- [x] T070 [P] Write contract tests for auth API routes using Supertest — register, verify, login, logout (`backend/tests/contract/auth.test.ts`)
- [x] T071 [P] Write contract tests for feed API routes using Supertest — GET /feed shape, complete item, refresh (`backend/tests/contract/feed.test.ts`)
- [x] T072 [P] Write Playwright e2e test for US1 — register → verify email → log in → log out → reset password (`frontend/tests/e2e/auth.spec.ts`)
- [x] T073 [P] Write Playwright e2e test for US2 — connect integration → verify Connected state → disconnect (`frontend/tests/e2e/integrations.spec.ts`)
- [x] T074 Run full `quickstart.md` validation — fresh clone, `docker compose up`, `pnpm install`, migrate, `pnpm dev`, smoke-test all 4 user stories

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **blocks all user story phases**
- **Phase 3 (US1)**: Depends on Phase 2 only
- **Phase 4 (US2)**: Depends on Phase 2 only — can run in parallel with Phase 3
- **Phase 5 (US3)**: Depends on Phase 2 only — requires US1 auth session for API auth; best after US1 complete
- **Phase 6 (US4)**: Depends on Phase 5 (feed page must exist to wire into)
- **Phase 7 (Polish)**: Depends on all user story phases complete

### User Story Dependencies (Backend)

```
Phase 2 (Foundational)
       │
       ├── US1 Auth (T019–T032) ─────────────────────────────┐
       │                                                       │
       ├── US2 Integrations (T033–T045)  ←── US1 session     │
       │                                                       │
       ├── US3 Feed (T046–T056)          ←── US1 + US2        │
       │                                                       │
       └── US4 Native Tasks (T057–T062) ←── US3 feed page ───┘
```

### Parallel Opportunities Per Phase

**Phase 1**: T002, T003, T007, T008 can all run in parallel after T001

**Phase 2**: T012, T013, T014, T016, T018 run in parallel after T009–T011 complete

**Phase 3 (US1)**: T019, T020, T021, T022 in parallel → T023–T027 sequential → T028, T029, T030 in parallel → T031, T032 sequential

**Phase 4 (US2)**: T034, T035, T036, T037 run in parallel after T033 → T038, T039 sequential → T041, T042 in parallel → T043–T045 sequential

**Phase 5 (US3)**: T046, T047 in parallel → T048, T049 sequential → T050 → T051, T052, T053, T054 in parallel → T055, T056 sequential

**Phase 6 (US4)**: T057 → T058 → T059, T060 in parallel → T061, T062 sequential

**Phase 7 (Polish)**: T063–T073 all [P] — run in any order

---

## Implementation Strategy

### MVP Delivery (US1 + US2 + US3)

1. Complete Phase 1 + Phase 2 → dev environment running
2. Complete Phase 3 (US1) → working auth, deployable login screen
3. Complete Phase 4 (US2) → OAuth integrations connected, onboarding works
4. Complete Phase 5 (US3) → unified feed with real data from integrations
5. **STOP and validate**: All 3 stories testable end-to-end → deploy MVP

### Full Release (add US4 + Polish)

6. Complete Phase 6 (US4) → native task creation live in feed
7. Complete Phase 7 (Polish) → security hardened, mobile-responsive, tested

### Summary

| Phase | Tasks | Key Milestone |
|-------|-------|---------------|
| Phase 1: Setup | T001–T008 | Monorepo running locally |
| Phase 2: Foundational | T009–T018 | DB migrated, Fastify + Next.js healthy |
| Phase 3: US1 Auth | T019–T032 | Login/signup/social auth working |
| Phase 4: US2 Onboarding | T033–T045 | All 4 integrations connectable |
| Phase 5: US3 Feed | T046–T056 | Unified feed rendering synced items |
| Phase 6: US4 Tasks | T057–T062 | Native task creation in feed |
| Phase 7: Polish | T063–T074 | Tests, validation, security hardened |
| **Total** | **74 tasks** | |
