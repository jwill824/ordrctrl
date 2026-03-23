# Copilot Instructions for ordrctrl

ordrctrl is a unified productivity aggregator that consolidates tasks, reminders, calendar events, and flagged emails from Gmail, Microsoft Tasks, and Apple Calendar into a single chronological feed. It's a pnpm monorepo with a Fastify 4 REST API backend and a Vite 5 + React 18 SPA frontend.

---

## Commands

### Root (runs both workspaces)
```bash
pnpm dev          # start backend + frontend concurrently
pnpm build        # build both
pnpm lint         # lint both
pnpm lint:fix     # auto-fix both
pnpm test         # backend unit tests
pnpm test:e2e     # frontend Playwright e2e
```

### Backend (`cd backend`)
```bash
pnpm dev                              # tsx watch src/server.ts
pnpm test                             # vitest run (all)
pnpm test:contract                    # vitest run tests/contract (API contract tests only)
pnpm test:watch                       # vitest (watch mode)
pnpm lint                             # eslint src
pnpm prisma:migrate                   # prisma migrate dev
pnpm prisma:generate                  # prisma generate
```

### Frontend (`cd frontend`)
```bash
pnpm dev                              # vite
pnpm test                             # vitest run
pnpm test:watch                       # vitest
pnpm test:e2e                         # playwright test (requires both servers running)
pnpm lint                             # eslint src
pnpm dev:android                      # vite --mode android --host
pnpm dev:ios                          # vite --mode ios --host
```

### Run a single test file
```bash
# Backend
cd backend && pnpm vitest run tests/unit/feed.service.test.ts

# Frontend e2e
cd frontend && pnpm playwright test tests/e2e/feed.spec.ts
```

### Infrastructure
```bash
docker compose up -d   # start PostgreSQL 16 + Redis 7 (required for local dev)
```

---

## Architecture

```
ordrctrl/
├── backend/                  # Fastify 4 REST API (port 4000)
│   ├── src/
│   │   ├── api/              # Route handlers (one file per domain)
│   │   ├── services/         # Business logic
│   │   ├── integrations/     # Third-party adapters (Gmail, Microsoft, Apple)
│   │   │   └── _adapter/     # IntegrationAdapter interface + types
│   │   ├── lib/              # db.ts (Prisma), encryption.ts, redis.ts
│   │   ├── jobs/             # BullMQ queue workers (15-min sync)
│   │   ├── app.ts            # Fastify app setup + route registration
│   │   └── server.ts         # Entry point + env validation
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/
└── frontend/                 # Vite 5 + React 18 SPA (port 3000)
    └── src/
        ├── app/              # Route pages (app/{feature}/page.tsx)
        ├── components/       # UI components (components/{domain}/Name.tsx)
        ├── hooks/            # State + actions (useFeatureName.ts)
        ├── services/         # API client wrappers (feature.service.ts)
        ├── plugins/          # Capacitor/Tauri platform abstractions
        └── utils/
```

Frontend communicates with backend via REST + session cookies (`credentials: 'include'`). Auth is session-based (Fastify session + Redis), not JWT.

---

## Key Conventions

### Backend: Routes
Each `backend/src/api/*.routes.ts` exports a `register*Routes(app: FastifyInstance)` function. All route files are registered in `app.ts`. Validate input with Zod at the route entry point. Auth guard: check `request.session.userId`. Errors: `reply.status(code).send({ error, message })`.

### Backend: Integrations
Every integration implements the `IntegrationAdapter` interface (`backend/src/integrations/_adapter/types.ts`). New integrations must implement `connect`, `disconnect`, `sync`, `refreshToken`, and `getAuthorizationUrl`. The `sync()` method returns `NormalizedItem[]`. Core application code must not be modified to add a new integration — adapters are self-contained.

### Backend: Database
- ORM: Prisma — import client from `backend/src/lib/db.ts` (`import { prisma } from '../lib/db'`)
- Never edit existing migrations — always `pnpm prisma migrate dev --name <description>` followed by `pnpm prisma generate`
- OAuth tokens are stored encrypted (AES-256-GCM) via `backend/src/lib/encryption.ts` — never store or log plaintext tokens
- `SyncCacheItem.rawPayload` must never appear in API responses (PII)

### Frontend: State management
No Redux/Zustand/Context. State lives in custom hooks (`hooks/useFeatureName.ts`). Hooks own `useState`, call service functions, and return both data and action callbacks. Pages/components call hooks and pass data down via props.

### Frontend: Services
`services/*.service.ts` are pure API wrappers with no state. They use the helpers in `services/api-client.ts` (`apiGet`, `apiPost`, `apiPatch`, `apiDelete`) which set `credentials: 'include'` and throw `ApiError` on non-2xx responses.

### Frontend: Styling
Tailwind utility classes in `className` only. Do not use `@apply` or `@layer components` in CSS. Do not use inline `style={{}}` props except for runtime-dynamic values that Tailwind cannot express (e.g., a per-record hex color).

### Branching
Branches follow `NNN-short-name` format where `NNN` is the zero-padded spec number (e.g., `023-todoist-integration`). Each spec has design documents in `specs/NNN-*/`.

### Commit messages
Conventional Commits: `<type>(<scope>): <description>`. Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`.

### Testing expectations
| Change | Tests required |
|--------|----------------|
| New API endpoint | Contract test in `backend/tests/contract/` |
| New service method | Unit test in `backend/tests/unit/` |
| New integration adapter | Unit tests for `sync()` normalization |
| New UI flow | Playwright e2e in `frontend/tests/e2e/` |

### Environment variables
New env vars must be added to `backend/.env.example` (placeholder value, never a real secret), documented in `docs/development.md`, and validated at startup in `backend/src/server.ts`. Never commit `.env` or `.env.device.local` files.

---

## Spec-Kit Workflow

> Full constitution and workflow principles: [`.specify/memory/constitution.md`](.specify/memory/constitution.md)

All features follow the spec-kit lifecycle: `/speckit.specify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement` → `/speckit.analyze`. Agents and workflow steps are in `.github/agents/`.
