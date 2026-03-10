# ordrctrl

A minimalist productivity app that consolidates tasks, reminders, calendar events, and emails from multiple services into a single unified feed.

**Supported integrations**: Gmail · Microsoft Tasks · Apple Calendar

---

## What it does

ordrctrl connects your existing productivity accounts and presents everything in one chronological view — no more switching between apps to see what needs your attention. Each item is labeled with its source so you always know where it came from.

- **Unified feed** — tasks, reminders, events, and flagged emails in one place
- **Native tasks** — create tasks directly in ordrctrl, no integration required
- **Triage & dismiss** — review incoming items in a bottom sheet before they hit your feed; dismiss items you don't need (with restore from settings)
- **One-way sync** — ordrctrl reads from your services; completing an item in ordrctrl marks it complete locally without modifying the source (two-way sync is planned)
- **Minimalist UI** — no feature creep; designed to get out of your way

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| Backend | Fastify 4, TypeScript |
| Database | PostgreSQL 16 + Prisma ORM |
| Queue | BullMQ + Redis 7 (background sync every 15 min) |
| Auth | Email/password · Sign in with Google · Sign in with Apple |
| Email | Resend |

---

## Getting started

### Prerequisites

- Node.js 20+
- pnpm 8+ (`npm install -g pnpm`)
- Docker + Docker Compose

### Run locally

```bash
# 1. Clone and install
git clone <your-repo-url> ordrctrl
cd ordrctrl
pnpm install

# 2. Start infrastructure (PostgreSQL + Redis)
docker compose up -d

# 3. Configure environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# Edit backend/.env — see "Environment variables" below

# 4. Run database migrations
cd backend && pnpm prisma migrate dev --name init && pnpm prisma generate && cd ..

# 5. Start dev servers
pnpm dev
# → Frontend: http://localhost:3000
# → Backend:  http://localhost:4000
```

### Environment variables

The minimum set to run locally:

| Variable | How to get it |
|----------|--------------|
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `TOKEN_ENCRYPTION_KEY` | Same command as above |
| `DATABASE_URL` | Pre-filled in `.env.example` — works with Docker Compose |
| `REDIS_URL` | Pre-filled in `.env.example` — works with Docker Compose |
| `GOOGLE_CLIENT_ID/SECRET` | [Google Cloud Console](https://console.cloud.google.com) — used for both Sign in with Google **and** Gmail integration. Register two redirect URIs on the same client: `http://localhost:4000/api/auth/google/callback` and `http://localhost:4000/api/integrations/gmail/callback`. Add yourself as a test user on the OAuth consent screen while the app is in Testing mode. |
| `RESEND_API_KEY` | Optional in dev — verification links are logged to console instead |

See [`specs/001-mvp-core/quickstart.md`](specs/001-mvp-core/quickstart.md) for the full setup guide including Apple and Microsoft OAuth credentials.

---

## Project structure

```
ordrctrl/
├── backend/                  # Fastify API server
│   ├── src/
│   │   ├── auth/             # Authentication (email/password, Google, Apple)
│   │   ├── integrations/     # Integration adapter plugins
│   │   │   ├── _adapter/     # IntegrationAdapter interface + shared types
│   │   │   ├── gmail/
│   │   │   ├── microsoft-tasks/
│   │   │   └── apple-calendar/
│   │   ├── feed/             # Feed aggregation, ordering, and dismissal
│   │   ├── sync/             # BullMQ background sync scheduler
│   │   ├── tasks/            # Native task CRUD
│   │   ├── api/              # Fastify route handlers
│   │   └── lib/              # Shared utilities (encryption, logger, redis, email)
│   ├── prisma/               # Database schema and migrations
│   └── tests/
│       ├── unit/             # Unit tests (Vitest)
│       └── contract/         # Contract/route tests (Vitest)
├── frontend/                 # Next.js App Router
│   ├── src/
│   │   ├── app/              # Pages (login, signup, feed, onboarding, settings)
│   │   ├── components/       # UI components
│   │   ├── hooks/            # React hooks (useAuth, useFeed, etc.)
│   │   └── services/         # API client wrappers
│   └── tests/
│       ├── unit/             # Unit tests (Vitest + Testing Library)
│       └── e2e/              # End-to-end tests (Playwright)
├── .github/workflows/        # CI pipeline (GitHub Actions)
├── specs/                    # Feature specs and design documents
└── docker-compose.yml        # Local dev infrastructure
```

---

## Running tests

```bash
# Backend unit tests
pnpm --filter backend test

# Backend contract tests
pnpm --filter backend test:contract

# Frontend unit tests
pnpm --filter frontend test

# Frontend e2e tests (requires both servers running)
pnpm --filter frontend test:e2e
```

CI runs all of the above automatically on every pull request and push to `main` via GitHub Actions.

---

## Development workflow (speckit)

This project uses [speckit](https://github.com/speckit) — a spec-driven development workflow built on top of GitHub Copilot. All features go through a structured pipeline before any code is written.

### Slash commands (in Copilot Chat)

| Command | What it does |
|---------|-------------|
| `/speckit.specify` | Create or update the feature spec from a natural-language description |
| `/speckit.clarify` | Ask targeted clarifying questions to resolve ambiguity in the spec |
| `/speckit.plan` | Generate the technical design (architecture, data model, API contracts) |
| `/speckit.tasks` | Break the plan into a dependency-ordered task list |
| `/speckit.implement` | Execute the task list — writes all code, phase by phase |
| `/speckit.analyze` | Cross-artifact consistency check across spec, plan, and tasks |
| `/speckit.checklist` | Generate a custom quality checklist for the feature |

### Typical feature flow

```
specify → clarify → plan → tasks → implement → analyze
```

1. **Specify**: Describe the feature in plain English — speckit creates `specs/<feature>/spec.md`
2. **Clarify**: Resolve any underspecified areas before design begins
3. **Plan**: Generates `plan.md`, `data-model.md`, and API `contracts/`
4. **Tasks**: Generates `tasks.md` — an ordered, dependency-aware implementation checklist
5. **Implement**: Executes the tasks; marks each `[X]` as it completes
6. **Analyze**: Validates consistency across all artifacts

Design documents live in `specs/001-mvp-core/`. Do not edit `tasks.md` manually while `implement` is running.

---

## Adding a new integration

Each integration is an isolated plugin implementing the `IntegrationAdapter` interface:

1. Create `backend/src/integrations/<service-name>/index.ts`
2. Implement `connect()`, `disconnect()`, `sync()`, `refreshToken()`
3. Register in `backend/src/integrations/index.ts`

No changes to core feed, sync, or API code required. See [`specs/001-mvp-core/contracts/integration-adapter.md`](specs/001-mvp-core/contracts/integration-adapter.md) for the full interface contract.

---

## Roadmap

- [ ] Two-way sync (mark complete propagates back to source)
- [ ] Native mobile app (React Native + Expo)
- [ ] Additional integrations (Todoist, Notion, Linear, etc.)
- [ ] Recurring task support
- [ ] Apple Reminders re-integration (deferred; iCloud credential flow needs rework)

---

## License

MIT
