# Research: ordrctrl Initial MVP

**Branch**: `001-mvp-core` | **Date**: 2026-03-05

## Decision Log

---

### 1. Language / Runtime

**Decision**: TypeScript 5.x for both frontend and backend.

**Rationale**: A single language across the stack minimises context-switching, enables
shared type definitions for API contracts and integration adapter interfaces, and provides
compile-time safety for the complex data transformations in the feed aggregation layer.

**Alternatives considered**:
- Python (FastAPI) — rejected; sharing types between a Python backend and a JS/TS frontend
  requires an extra code-generation step, adding tooling complexity without equivalent benefit.
- Go — rejected; excellent for performance-critical services but TypeScript's ecosystem for
  OAuth libraries, ORMs, and web frameworks is more mature for this domain.

---

### 2. Frontend Framework

**Decision**: Next.js 14 (App Router) + React 18.

**Rationale**: Server-side rendering (SSR) provides fast initial page loads for the feed view
and the onboarding screen, which are the two highest-traffic surfaces. File-based routing
keeps the page structure simple and auditable. Next.js is the de facto standard for
TypeScript-first web apps and has excellent support for authentication flows.

**Alternatives considered**:
- Vite + React SPA — rejected; no SSR means slower initial feed load for users with many
  synced items; also loses SEO-friendliness for future marketing pages.
- Remix — considered; strong SSR story but smaller ecosystem and less community familiarity
  than Next.js for a new project.

---

### 3. Backend Framework

**Decision**: Fastify 4 + TypeScript.

**Rationale**: Fastify is the fastest Node.js HTTP framework, has first-class TypeScript
support, a plugin architecture that maps naturally to the integration adapter pattern, and
excellent JSON schema validation built in — useful for API contract enforcement.

**Alternatives considered**:
- Express — rejected; no built-in TypeScript support, slower, no native schema validation.
- NestJS — rejected; opinionated decorator-heavy architecture adds significant boilerplate
  for an early-stage product; violates Simplicity principle.

---

### 4. Database

**Decision**: PostgreSQL 16.

**Rationale**: The data model is clearly relational: Users own Integrations, Integrations
own SyncCache entries, Tasks have foreign keys to Users and Integrations. PostgreSQL is
ACID-compliant, battle-tested, and has excellent JSONB support for storing flexible
sync cache payloads without a schema migration per integration.

**Alternatives considered**:
- MongoDB — rejected; the relational structure (user → integrations → tasks) is a natural
  fit for SQL; document stores add query complexity for cross-collection joins.
- SQLite — rejected; not suitable for server-side deployment with concurrent writes.

---

### 5. ORM

**Decision**: Prisma 5.

**Rationale**: Prisma generates fully typed database clients from a schema file, meaning
all database queries are type-safe and autocompleted. Migration tooling is excellent.
Works seamlessly with PostgreSQL and TypeScript.

**Alternatives considered**:
- Drizzle — strong competitor; slightly less mature migration tooling at time of writing.
- Raw SQL (pg) — rejected; too low-level for rapid MVP development; loses type safety.

---

### 6. Background Sync Queue

**Decision**: BullMQ 5 + Redis 7.

**Rationale**: The 15-minute background sync requires a job queue that handles retries,
backoff on API failures, per-integration job isolation, and visibility into job state.
BullMQ is the standard Node.js queue for this pattern and runs on Redis, which is also
used for session storage — consolidating infrastructure.

**Alternatives considered**:
- node-cron — rejected; no retry logic, no job state visibility, no failure isolation.
- pg-boss (Postgres-backed queue) — valid alternative; BullMQ chosen for its richer
  dashboard tooling (Bull Board) and active ecosystem.

---

### 7. OAuth 2.0 / Authentication

**Decision**: openid-client (OIDC/OAuth 2.0) for Sign in with Google and Sign in with
Apple; custom secure session management (httpOnly cookies + Redis) for ordrctrl accounts.

**Rationale**: openid-client is the standards-compliant Node.js OAuth 2.0 / OpenID Connect
library, supporting PKCE, token refresh, and token introspection. Using it for both Google
and Apple identity providers ensures a consistent, auditable auth flow.

**Integration OAuth** (Gmail, Apple Calendar, Microsoft Graph): Each integration uses its
provider's OAuth 2.0 authorization code flow, implemented within the integration's own
adapter — not shared with the user identity auth layer, per the spec Assumption.

**Token encryption**: AES-256-GCM via Node.js `crypto` module; encryption key sourced
from environment variable, never hardcoded.

**Alternatives considered**:
- Passport.js — rejected; strategy-based abstraction layer adds indirection without
  meaningful benefit when openid-client handles the flows directly.
- NextAuth.js — rejected; tightly coupled to Next.js and designed for identity login,
  not for managing multiple independent OAuth integration credentials per user.

---

### 8. Testing Stack

**Decision**: Vitest (unit + integration), Supertest (API contract), Playwright (e2e).

**Rationale**:
- **Vitest**: Fast, native TypeScript support, Jest-compatible API — ideal for unit testing
  feed aggregation logic, token encryption utilities, and IntegrationAdapter mock tests.
- **Supertest**: HTTP assertion library for testing Fastify routes against a real server
  instance — covers API contract tests without a running browser.
- **Playwright**: Cross-browser e2e testing for the four user story flows; supports
  intercepting network requests for mocking OAuth redirects in tests.

---

### 9. Transactional Email

**Decision**: Resend (SDK) for verification emails, password reset, and re-auth prompts.

**Rationale**: Resend has a TypeScript SDK, generous free tier, excellent deliverability,
and a simple API. This is a non-critical infrastructure decision easily swapped later.

**Alternatives considered**:
- SendGrid — viable; Resend preferred for simpler SDK and developer experience.
- Nodemailer (self-hosted SMTP) — rejected for MVP; operational overhead not justified.

---

### 10. Integration Adapter Pattern

**Decision**: Each integration implements a shared `IntegrationAdapter` TypeScript
interface exported from `backend/src/integrations/_adapter/`.

**Interface summary** (see `contracts/integration-adapter.md` for full spec):
```typescript
interface IntegrationAdapter {
  readonly serviceId: ServiceId;
  connect(userId: string, authCode: string, options?: object): Promise<Integration>;
  disconnect(integrationId: string): Promise<void>;
  sync(integrationId: string): Promise<NormalizedItem[]>;
  refreshToken(integrationId: string): Promise<void>;
}
```

**Rationale**: Enforces Constitution Principle I. The feed aggregation layer calls
`adapter.sync()` on each connected integration without knowing any provider-specific
details. Adding a new integration requires only creating a new directory implementing
this interface — zero changes to core application code.

---

### 11. Post-MVP: Native Mobile

**Decision**: React Native + Expo (deferred).

**Rationale**: Expo enables web + iOS + Android from a shared React codebase. Since the
frontend is already in React (Next.js), significant component and hook logic can be shared
or adapted. This path is explicitly deferred per Constitution Principle V.
