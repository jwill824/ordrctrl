# Implementation Plan: ordrctrl Initial MVP

**Branch**: `001-mvp-core` | **Date**: 2026-03-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-mvp-core/spec.md`

## Summary

ordrctrl MVP delivers a web-based productivity consolidation app in four sequentially
dependent user stories: account creation & login (P1), integration onboarding for Gmail,
Apple Reminders, Microsoft Tasks, and Apple Calendar (P2), a unified chronological feed
with one-way sync (P3), and native task creation (P4). The technical approach uses a
TypeScript monorepo with a Next.js frontend, Fastify backend API, PostgreSQL database,
BullMQ background sync queue, and isolated IntegrationAdapter plugins per integration —
satisfying all five constitutional principles.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend + backend)
**Primary Dependencies**: Next.js 14 (frontend), Fastify 4 (backend API), Prisma (ORM),
BullMQ + Redis (background sync queue), openid-client (OAuth 2.0 / OIDC),
Vitest (unit tests), Playwright (e2e tests)
**Storage**: PostgreSQL 16 (primary data store), Redis 7 (BullMQ job queue + session store)
**Testing**: Vitest (unit + integration), Supertest (API contract tests), Playwright (e2e)
**Target Platform**: Web — desktop browsers and mobile browsers (MVP); React Native /
Expo deferred to post-MVP for native mobile
**Project Type**: Web application (SSR frontend + REST API backend)
**Performance Goals**: Feed renders within 30s of sync completion; background sync every
15 min; account registration completable in <2 min; manual refresh available on demand
**Constraints**: OAuth tokens AES-256-GCM encrypted at rest; sync cache TTL ≤24h;
one-way sync only; no raw data in logs; secrets in env variables only
**Scale/Scope**: Personal productivity tool — MVP targets single-user to small user base;
no horizontal scaling requirements in MVP

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Integration Modularity | ✅ Pass | Each of the 4 integrations implements an isolated `IntegrationAdapter` interface in `backend/src/integrations/<name>/`. Core feed logic never imports integration internals. |
| II. Minimalism-First | ✅ Pass | All 4 user stories justified by concrete user scenarios. Gmail sync mode is the only user-configurable option — justified by divergent inbox habits. |
| III. Security & Privacy | ✅ Pass | OAuth tokens encrypted AES-256-GCM; sync cache TTL bounded at 24h; integration data isolated per user; no secrets in source. |
| IV. Test Coverage Required | ✅ Pass | Vitest (unit), Supertest (contract), Playwright (e2e) per user story; security paths have explicit test coverage. |
| V. Simplicity & Deferred Decisions | ✅ Pass | Stack selected with written justification in research.md; mobile deferred to post-MVP; no speculative features added. |

*Post-Phase 1 re-check*: ✅ All gates maintained. `IntegrationAdapter` interface defined in
`contracts/integration-adapter.md`. Complexity Tracking table is empty — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-mvp-core/
├── plan.md              # This file
├── research.md          # Phase 0 — tech stack decisions
├── data-model.md        # Phase 1 — entity definitions
├── quickstart.md        # Phase 1 — local dev setup
├── contracts/
│   ├── integration-adapter.md   # IntegrationAdapter interface contract
│   ├── auth-api.md              # Auth REST API contract
│   ├── integrations-api.md      # Integrations REST API contract
│   └── feed-api.md              # Feed + Tasks REST API contract
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── auth/              # User auth: email/password, Google, Apple (FR-001–008)
│   ├── integrations/      # IntegrationAdapter plugins (FR-009–013, FR-024–026)
│   │   ├── _adapter/      # IntegrationAdapter interface + shared types
│   │   ├── gmail/         # Gmail integration plugin
│   │   ├── apple-reminders/   # Apple Reminders integration plugin
│   │   ├── microsoft-tasks/   # Microsoft Tasks integration plugin
│   │   └── apple-calendar/    # Apple Calendar integration plugin
│   ├── feed/              # Feed aggregation, normalization, ordering (FR-014–018)
│   ├── sync/              # BullMQ scheduler — 15-min background sync (FR-026)
│   ├── tasks/             # Native task CRUD (FR-019–021)
│   ├── models/            # Prisma schema + generated client
│   ├── api/               # Fastify route handlers
│   └── lib/               # Shared utilities (encryption, token helpers, logger)
└── tests/
    ├── unit/
    ├── integration/
    └── contract/

frontend/
├── src/
│   ├── pages/             # Next.js routes: /, /login, /signup, /onboarding, /feed
│   ├── components/        # UI components (FeedItem, IntegrationCard, TaskForm, etc.)
│   ├── hooks/             # React hooks (useFeed, useIntegrations, useAuth)
│   └── services/          # API client wrappers
└── tests/
    └── e2e/               # Playwright test suites per user story
```

**Structure Decision**: Web application with an explicit `integrations/` plugin directory
required by Constitution Principle I. Backend and frontend are separate projects within a
monorepo root. Mobile (React Native / Expo) will be added post-MVP as a third top-level
directory, sharing API contracts with the backend.

## Complexity Tracking

> No constitutional violations requiring justification.
