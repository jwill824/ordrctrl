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
| Frontend | Vite 5, React 18, TypeScript, Tailwind CSS |
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
cp frontend/.env.example frontend/.env
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
| `APPLE_CLIENT_ID` | Apple Developer Portal — Service ID (e.g. `com.ordrctrl.signin`) |
| `APPLE_TEAM_ID` | Apple Developer Portal — 10-character team ID |
| `APPLE_KEY_ID` | Apple Developer Portal — key ID for your Sign In with Apple private key |
| `APPLE_PRIVATE_KEY` | Apple Developer Portal — `.p8` private key contents (paste as-is, newlines replaced with `\n`) |
| `NATIVE_APP_ORIGINS` | Pre-filled in `.env.example` — `capacitor://localhost,tauri://localhost,http://tauri.localhost` |
| `RESEND_API_KEY` | Optional in dev — verification links are logged to console instead |

See [`specs/001-mvp-core/quickstart.md`](specs/001-mvp-core/quickstart.md) for the full setup guide including Microsoft OAuth credentials.

> **Apple Sign In + physical device testing**: Apple requires HTTPS redirect URIs even in development. If you have a paid ngrok account with a static domain, see [`specs/016-native-auth-fixes/quickstart.md`](specs/016-native-auth-fixes/quickstart.md) for one-time Apple Developer Portal and Google Cloud Console registration steps.

---

## Native apps

### Mobile (Capacitor — iOS & Android)

**Prerequisites:**
- macOS required for iOS builds
- Xcode 15+
- Android Studio + Java 17 (`brew install openjdk@17`)
- CocoaPods: `sudo gem install cocoapods`

**First-time setup (run once after cloning):**
```bash
cd frontend
pnpm exec cap add ios
pnpm exec cap add android
```

**Build and sync web assets:**
```bash
cd frontend
pnpm build
pnpm exec cap sync
```

**Run on iOS Simulator:**
```bash
cd frontend
pnpm exec cap run ios
# or open Xcode for device selection:
pnpm exec cap open ios
```

**Run on Android Emulator:**
```bash
cd frontend
pnpm exec cap run android
# or open Android Studio:
pnpm exec cap open android
```

**Live reload during development:**
```bash
# Terminal 1
cd frontend && pnpm dev

# Terminal 2
cd frontend && pnpm exec cap run ios --livereload --external
```

**Test deep links (OAuth callbacks):**
```bash
# iOS Simulator
xcrun simctl openurl booted "ordrctrl://auth/callback?status=success"

# Android Emulator
adb shell am start -W -a android.intent.action.VIEW \
  -d "ordrctrl://auth/callback?status=success" com.ordrctrl.app
```

**Sign in with Apple / Google (iOS Simulator):**
1. Start the backend: `cd backend && pnpm dev`
2. Run on simulator: `cd frontend && pnpm exec cap run ios`
3. Tap **Sign in with Apple** or **Continue with Google** — SFSafariViewController opens the provider's sign-in page
4. After sign-in, the backend redirects to `ordrctrl://auth/callback?status=success`
5. iOS routes the URL back to the app, SFSafariViewController closes, app navigates to `/feed`

**Physical device testing (ngrok required):**

Apple requires HTTPS redirect URIs even in development, so `http://localhost:4000` cannot be registered with Apple Developer Portal. A paid [ngrok](https://ngrok.com/) account with a static domain solves this permanently.

**One-time setup** (copy `backend/.env.device.example` → `backend/.env.device.local` and fill in your values):

```env
# backend/.env.device.local  (gitignored — never commit)
API_URL=https://your-name.ngrok-free.app
NGROK_AUTHTOKEN=your_token_here
NGROK_DOMAIN=your-name.ngrok-free.app
```

```env
# frontend/.env.device.local  (gitignored — never commit)
VITE_API_URL=https://your-name.ngrok-free.app
```

Register the ngrok URL once in [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list/serviceId) (Service ID → Sign In with Apple → Return URL: `https://your-name.ngrok-free.app/api/auth/apple/callback`) and once in [Google Cloud Console](https://console.cloud.google.com) (OAuth Client → Authorized redirect URIs — **keep `localhost` too**). See [`specs/016-native-auth-fixes/quickstart.md`](specs/016-native-auth-fixes/quickstart.md) for the full walkthrough.

**Daily device workflow:**

```bash
# Terminal 1 — infrastructure
docker-compose up -d

# Terminal 2 — backend with ngrok overrides
cd backend && pnpm dev:device

# Terminal 3 — ngrok tunnel
cd backend && pnpm dev:ngrok

# Terminal 4 — frontend with ngrok overrides
cd frontend && pnpm dev:device
```

Then connect your iPhone via USB, select it in Xcode, and run. The app will reach your backend via the static ngrok URL.

---

### Desktop (Tauri — macOS & Windows)

**Prerequisites:**
- Rust toolchain: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- macOS DMG packaging: `brew install create-dmg`
- Windows: Microsoft C++ Build Tools

**Development (hot-reload):**
```bash
# Terminal 1 — backend must be running first
cd backend && pnpm dev

# Terminal 2 — Tauri desktop app
cd frontend
pnpm exec tauri dev --config desktop/tauri.conf.json
```

> **Tip:** If `tauri dev` exits immediately with no error, the installed `.app` from a previous build is running in the system tray. Quit it via the tray menu or `kill $(pgrep -f "ordrctrl.app")`.

**Production build:**
```bash
cd frontend
pnpm exec tauri build --config desktop/tauri.conf.json

# Output:
#   macOS app:  desktop/target/release/bundle/macos/ordrctrl.app
#   macOS DMG:  desktop/target/release/bundle/dmg/ordrctrl_0.1.0_aarch64.dmg
#   Windows MSI: desktop/target/release/bundle/msi/ordrctrl_*.msi
```

**Sign in with Google / Apple (Tauri dev mode):**
1. Start the backend (`cd backend && pnpm dev`)
2. Run `pnpm exec tauri dev --config desktop/tauri.conf.json` from `frontend/`
3. Click **Continue with Google** — your system browser opens Google's sign-in page
4. After Google redirects to the backend callback, the backend redirects to `ordrctrl://auth/callback?status=success`
5. macOS routes the `ordrctrl://` URL back to the running Tauri app, which navigates to `/feed`

> **Note:** Google must have `http://localhost:4000/api/auth/google/callback` registered as an authorised redirect URI in your Google Cloud Console.

**Test notifications:**
After launching the app, wait for the feed poll interval or trigger manually via the browser console in the webview:
```js
window.__testNotification?.()
```

---

### Backend: enabling native app origins

Add to `backend/.env`:
```env
NATIVE_APP_ORIGINS=capacitor://localhost,tauri://localhost,http://tauri.localhost
```

See [`specs/015-native-app-targets/quickstart.md`](specs/015-native-app-targets/quickstart.md) for the full native setup guide.

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
- [x] Native mobile app (Capacitor — iOS & Android) and desktop app (Tauri — macOS & Windows)
- [ ] Additional integrations (Todoist, Notion, Linear, etc.)
- [ ] Recurring task support
- [ ] Apple Reminders re-integration (deferred; iCloud credential flow needs rework)

---

## License

MIT
