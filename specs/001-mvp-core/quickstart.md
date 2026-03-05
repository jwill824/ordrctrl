# Quickstart: ordrctrl MVP Local Development

**Branch**: `001-mvp-core` | **Date**: 2026-03-05

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| pnpm | 8+ | `npm install -g pnpm` |
| Docker + Docker Compose | Latest | https://docker.com |
| Git | Any | pre-installed on macOS |

## 1. Clone & Install

```bash
git clone <your-remote-url> ordrctrl
cd ordrctrl
pnpm install          # installs all workspace packages
```

## 2. Start Infrastructure (Postgres + Redis)

```bash
docker compose up -d
```

This starts:
- PostgreSQL 16 on `localhost:5432`
- Redis 7 on `localhost:6379`

## 3. Configure Environment

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env.local
```

**Required backend env vars** (fill in `backend/.env`):

```env
# Database
DATABASE_URL="postgresql://ordrctrl:ordrctrl@localhost:5432/ordrctrl_dev"

# Redis
REDIS_URL="redis://localhost:6379"

# Session
SESSION_SECRET="<random-32-char-string>"

# Token encryption (AES-256-GCM — 32 bytes hex)
TOKEN_ENCRYPTION_KEY="<64-char-hex-string>"

# Email (Resend)
RESEND_API_KEY="<your-resend-api-key>"
EMAIL_FROM="noreply@ordrctrl.local"

# Google OAuth (Sign in with Google + Gmail)
GOOGLE_CLIENT_ID="<from-google-console>"
GOOGLE_CLIENT_SECRET="<from-google-console>"

# Apple OAuth (Sign in with Apple)
APPLE_CLIENT_ID="<your-apple-service-id>"
APPLE_TEAM_ID="<your-apple-team-id>"
APPLE_KEY_ID="<your-apple-key-id>"
APPLE_PRIVATE_KEY="<contents-of-.p8-file>"

# Microsoft OAuth (Microsoft Tasks)
MICROSOFT_CLIENT_ID="<from-azure-portal>"
MICROSOFT_CLIENT_SECRET="<from-azure-portal>"

# App URL
APP_URL="http://localhost:3000"
API_URL="http://localhost:4000"
```

> ⚠️ Never commit `.env` files. They are git-ignored by default.

## 4. Run Database Migrations

```bash
cd backend
pnpm prisma migrate dev --name init
pnpm prisma generate
```

## 5. Start Development Servers

```bash
# From repo root — starts both frontend and backend in watch mode
pnpm dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- BullMQ dashboard (Bull Board): http://localhost:4000/admin/queues

## 6. Run Tests

```bash
# Unit + integration tests (backend)
cd backend && pnpm test

# API contract tests
cd backend && pnpm test:contract

# End-to-end tests (requires both servers running)
cd frontend && pnpm test:e2e
```

## 7. Verify Setup

1. Open http://localhost:3000
2. Click **Sign Up** → create an account with any email
3. Check the console log for the verification link (email is logged locally when `RESEND_API_KEY` is `test`)
4. Click the link → you should reach the onboarding screen
5. The integration cards for Gmail, Apple Reminders, Microsoft Tasks, and Apple Calendar should all appear

## Common Issues

| Problem | Fix |
|---------|-----|
| `DATABASE_URL` connection error | Run `docker compose up -d` and wait 10s |
| Postgres keeps restarting | Run `docker system prune -f` to free Docker disk space, then `docker compose up -d` |
| `TOKEN_ENCRYPTION_KEY` error | Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| Apple OAuth private key format | Paste the full `.p8` contents including `-----BEGIN PRIVATE KEY-----` |
| Port 3000/4000 already in use | `lsof -ti:3000 \| xargs kill` |
| "Access blocked: This app's request is invalid" (Google) | Your Google account is not in the test user list. Go to **Google Cloud Console → APIs & Services → OAuth consent screen → Test users** and add your email. |
| `redirect_uri_mismatch` (Error 400, Google) | The redirect URI in the request doesn't match any registered URI. Ensure **both** `http://localhost:4000/api/auth/google/callback` and `http://localhost:4000/api/integrations/gmail/callback` are added under **Authorized redirect URIs** on your OAuth client. |
| Gmail integration syncs 0 items | The Gmail API may not be enabled. Go to **APIs & Services → Library → Gmail API → Enable**. |

---

## Appendix: How to Obtain Each Secret

### Self-Generated (no external account needed)

**`SESSION_SECRET`** — Random 32-byte string, signs session cookies.
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Generate once. Changing it invalidates all active user sessions.

**`TOKEN_ENCRYPTION_KEY`** — Random 32-byte (64 hex char) key for AES-256-GCM encryption of stored OAuth tokens.
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
⚠️ Never regenerate after real users exist — it corrupts all stored tokens.

---

### Resend (email delivery) — optional for local dev

**`RESEND_API_KEY`** + **`EMAIL_FROM`**

1. Go to [resend.com](https://resend.com) → create a free account
2. **Dashboard → API Keys → Create API Key** → copy the `re_...` key
3. For local dev: leave `EMAIL_FROM` as `noreply@ordrctrl.local` and `RESEND_API_KEY` as `re_test_...` — the app will log verification/reset links to the backend console instead of sending email
4. For production: verify your domain at **Domains**, then set `EMAIL_FROM=noreply@yourdomain.com`

---

### Google OAuth — needed for Sign in with Google and Gmail integration

**`GOOGLE_CLIENT_ID`** + **`GOOGLE_CLIENT_SECRET`**

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a new project (e.g. `ordrctrl-dev`)

2. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - App name: `ordrctrl`; Developer contact: your email
   - Scopes: add `email`, `profile`, `openid`, and `https://www.googleapis.com/auth/gmail.readonly`
   - Publishing status: leave as **Testing** for local development

3. **Add yourself as a test user** (required while app is in Testing status):
   - On the OAuth consent screen page scroll to **Test users → Add Users**
   - Add your Google account email (e.g. `you@gmail.com`)
   - Click **Save**
   > ⚠️ Without this step you will see "Access blocked: This app's request is invalid" when trying to sign in or connect Gmail, even if all credentials are correct.

4. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - **Authorized redirect URIs** — add **both** of the following:
     ```
     http://localhost:4000/api/auth/google/callback
     http://localhost:4000/api/integrations/gmail/callback
     ```
   - The first URI handles Sign in with Google; the second handles the Gmail integration connect flow. Both are required.
   - Click **Create**

5. Copy **Client ID** → `GOOGLE_CLIENT_ID`; copy **Client Secret** → `GOOGLE_CLIENT_SECRET`

6. **APIs & Services → Library → search "Gmail API" → Enable**
   - Required for the Gmail integration sync to work. Sign in with Google does not require it.

> **Single client for both flows.** ordrctrl uses one OAuth 2.0 client for both authentication (Sign in with Google) and Gmail integration. The two flows use different redirect URIs but the same `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`. Ensure both redirect URIs are registered on the same client.

> **Production note.** To allow users outside your test list to sign in, change the publishing status from **Testing** to **Production** on the OAuth consent screen page. Google will require app verification for sensitive scopes (like Gmail read access).

---

### Apple OAuth — can be deferred; requires Apple Developer account ($99/yr)

**`APPLE_CLIENT_ID`** + **`APPLE_TEAM_ID`** + **`APPLE_KEY_ID`** + **`APPLE_PRIVATE_KEY`**

1. Go to [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles**
2. **Identifiers → App IDs → Register new**
   - Enable capability: **Sign in with Apple**
3. **Identifiers → Services IDs → Register new**
   - Identifier: `com.yourcompany.ordrctrl` → this value becomes `APPLE_CLIENT_ID`
   - Enable **Sign in with Apple → Configure**
   - Return URL: must be HTTPS — use [ngrok](https://ngrok.com) to tunnel localhost in dev:
     `ngrok http 4000` → use the `https://xxxx.ngrok.io/api/auth/apple/callback` URL
4. **Keys → Register new key**
   - Enable **Sign in with Apple → Configure** → select your App ID
   - Download the `.p8` file (one-time download — save it securely)
   - Key ID shown on the confirmation page → `APPLE_KEY_ID`
5. **Membership tab → Team ID** (top-right of developer portal) → `APPLE_TEAM_ID`
6. Open the `.p8` file in a text editor; copy the full contents including header/footer → `APPLE_PRIVATE_KEY`
   - In `.env`, escape newlines: `"-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----"`

> **Skip for early development.** Google Sign-In + email/password is sufficient to test the full auth flow. Apple Sign-In can be wired in once you have the developer account.

---

### Microsoft OAuth — Phase 4 only, not needed for Phase 1–3

**`MICROSOFT_CLIENT_ID`** + **`MICROSOFT_CLIENT_SECRET`**

1. Go to [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID → App registrations → New registration**
   - Name: `ordrctrl-dev`
   - Redirect URI: `http://localhost:4000/api/auth/microsoft/callback`
2. After creation: **Overview** → copy **Application (client) ID** → `MICROSOFT_CLIENT_ID`
3. **Certificates & secrets → New client secret** → copy the value → `MICROSOFT_CLIENT_SECRET`
4. **API permissions → Add → Microsoft Graph → Delegated**: `Tasks.ReadWrite`, `User.Read`

---

### Minimum secrets to run locally right now

| Secret | Required? | How |
|--------|-----------|-----|
| `SESSION_SECRET` | ✅ Yes | `crypto.randomBytes(32).toString('hex')` |
| `TOKEN_ENCRYPTION_KEY` | ✅ Yes | `crypto.randomBytes(32).toString('hex')` |
| `DATABASE_URL` | ✅ Yes | Provided by Docker Compose — no changes needed |
| `REDIS_URL` | ✅ Yes | Provided by Docker Compose — no changes needed |
| `RESEND_API_KEY` | ❌ Optional | Links are logged to console when not set |
| `GOOGLE_CLIENT_ID/SECRET` | ⚠️ Needed for Google button | Google Cloud Console |
| `APPLE_*` | ❌ Defer | Requires paid Apple Developer account |
| `MICROSOFT_*` | ❌ Phase 4 only | Azure Portal |
