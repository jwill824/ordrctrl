# ordrctrl

A minimalist productivity app that consolidates tasks, reminders, calendar events, and emails from multiple services into a single unified feed.

**Supported integrations**: Gmail · Microsoft Tasks · Apple Calendar

---

## What it does

ordrctrl connects your existing productivity accounts and presents everything in one chronological view — no more switching between apps to see what needs your attention.

- **Unified feed** — tasks, reminders, events, and flagged emails in one place
- **Native tasks** — create tasks directly in ordrctrl, no integration required
- **Triage & dismiss** — review incoming items before they hit your feed
- **One-way sync** — ordrctrl reads from your services; completing an item marks it complete locally
- **Minimalist UI** — designed to get out of your way

---

## Quick start

```bash
git clone <your-repo-url> ordrctrl && cd ordrctrl
pnpm install
docker compose up -d
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit backend/.env — generate SESSION_SECRET and TOKEN_ENCRYPTION_KEY
cd backend && pnpm prisma migrate dev --name init && pnpm prisma generate && cd ..
pnpm dev
# → Frontend: http://localhost:3000
# → Backend:  http://localhost:4000
```

Full setup guide: [docs/development.md](development.md)

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite 5, React 18, TypeScript, Tailwind CSS |
| Backend | Fastify 4, TypeScript |
| Database | PostgreSQL 16 + Prisma ORM |
| Queue | BullMQ + Redis 7 |
| Auth | Email/password · Google OAuth · Apple Sign In |
| Mobile | Capacitor 6 (iOS + Android) |
| Desktop | Tauri 2 (macOS + Windows) |

---

## Documentation

| Document | What it covers |
|----------|---------------|
| [development.md](development.md) | Full local setup — environment variables, OAuth provider config, native app dev, troubleshooting |
| [architecture.md](architecture.md) | System architecture — data model, auth flows, sync, native platform layer |
| [integrations.md](integrations.md) | `IntegrationAdapter` interface contract + how to add a new integration |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow, speckit pipeline, coding conventions, PR process |

Specs (historical, per-feature design documents): [`specs/`](../specs/)

---

## Project structure

```
ordrctrl/
├── backend/                  # Fastify API server
│   ├── src/
│   │   ├── auth/             # Email/password + Google + Apple auth
│   │   ├── integrations/     # Integration adapter plugins
│   │   │   ├── _adapter/     # IntegrationAdapter interface + types
│   │   │   ├── gmail/
│   │   │   ├── microsoft-tasks/
│   │   │   └── apple-calendar/
│   │   ├── feed/             # Feed aggregation, ordering, dismissal
│   │   ├── sync/             # BullMQ background sync scheduler
│   │   ├── tasks/            # Native task CRUD
│   │   ├── api/              # Fastify route handlers
│   │   └── lib/              # Shared utilities (encryption, logger, redis, email)
│   ├── prisma/               # Database schema and migrations
│   └── tests/                # Unit + contract tests (Vitest)
├── frontend/                 # Vite SPA
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── hooks/            # React hooks (useAuth, useFeed, etc.)
│   │   ├── pages/            # Route pages
│   │   ├── plugins/          # Native plugin abstraction (notifications, deep links)
│   │   └── services/         # API client wrappers
│   ├── ios/                  # Capacitor iOS project
│   ├── android/              # Capacitor Android project
│   ├── desktop/              # Tauri desktop project
│   └── tests/                # Unit (Vitest) + e2e (Playwright)
├── docs/                     # Central documentation
├── specs/                    # Feature specs and design documents (historical)
└── docker-compose.yml        # Local dev infrastructure
```

---

## Development workflow (speckit)

For the full speckit pipeline, command reference, and contribution workflow, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Roadmap

- [ ] Two-way sync (mark complete propagates back to source)
- [x] Native mobile app (Capacitor — iOS & Android)
- [x] Desktop app (Tauri — macOS & Windows)
- [ ] Additional integrations (Todoist, Notion, Linear)
- [ ] Recurring task support

---

## License

MIT
