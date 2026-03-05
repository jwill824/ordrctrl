# ordrctrl

A minimalist productivity app that consolidates tasks, reminders, calendar events, and emails from multiple services into a single unified feed.

**Supported integrations (MVP)**: Gmail · Apple Reminders · Microsoft Tasks · Apple Calendar

---

## What it does

ordrctrl connects your existing productivity accounts and presents everything in one chronological view — no more switching between apps to see what needs your attention. Each item is labeled with its source so you always know where it came from.

- **Unified feed** — tasks, reminders, events, and flagged emails in one place
- **Native tasks** — create tasks directly in ordrctrl, no integration required
- **One-way sync** — ordrctrl reads from your services; completing an item in ordrctrl won't affect the source (two-way sync is planned post-MVP)
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
| `GOOGLE_CLIENT_ID/SECRET` | [Google Cloud Console](https://console.cloud.google.com) — needed for Google sign-in |
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
│   │   │   ├── apple-reminders/
│   │   │   ├── microsoft-tasks/
│   │   │   └── apple-calendar/
│   │   ├── feed/             # Feed aggregation and ordering
│   │   ├── sync/             # BullMQ background sync scheduler
│   │   ├── tasks/            # Native task CRUD
│   │   ├── api/              # Fastify route handlers
│   │   └── lib/              # Shared utilities (encryption, logger, redis, email)
│   └── prisma/               # Database schema and migrations
├── frontend/                 # Next.js App Router
│   └── src/
│       ├── app/              # Pages (login, signup, feed, onboarding, settings)
│       ├── components/       # UI components
│       ├── hooks/            # React hooks (useAuth, useFeed, etc.)
│       └── services/         # API client wrappers
├── specs/001-mvp-core/       # Design documents (spec, plan, data model, contracts)
└── docker-compose.yml        # Local dev infrastructure
```

---

## Running tests

```bash
# Backend unit + integration tests
cd backend && pnpm test

# Backend contract tests
cd backend && pnpm test:contract

# Frontend e2e tests (requires both servers running)
cd frontend && pnpm test:e2e
```

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

---

## License

MIT
