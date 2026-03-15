# Development Guide

## TL;DR

```bash
git clone <repo> ordrctrl && cd ordrctrl && pnpm install
docker compose up -d
cp backend/.env.example backend/.env && cp frontend/.env.example frontend/.env
# Edit backend/.env — generate secrets and fill in OAuth credentials (see below)
cd backend && pnpm prisma migrate dev --name init && pnpm prisma generate && cd ..
pnpm dev
# Frontend → http://localhost:3000   Backend → http://localhost:4000
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| pnpm | 8+ | `npm install -g pnpm` |
| Docker + Docker Compose | any recent | [docker.com](https://docker.com) |
| Xcode | 15+ | Mac App Store (iOS/simulator only) |
| Rust toolchain | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` (Tauri only) |

---

## Clone & install

```bash
git clone <your-repo-url> ordrctrl
cd ordrctrl
pnpm install          # installs all workspaces (root, backend, frontend)
```

---

## Infrastructure

PostgreSQL 16 and Redis 7 run in Docker. One command starts both:

```bash
docker compose up -d
```

Stop them:

```bash
docker compose down           # stop but keep data
docker compose down -v        # stop and delete all data
```

---

## Environment setup

### 1. Copy the example files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 2. Generate secrets

These two vars must be unique random values — never use the placeholders:

```bash
# SESSION_SECRET (32 random bytes → hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# TOKEN_ENCRYPTION_KEY (same command — run twice, use different values)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the output into `backend/.env`:

```env
SESSION_SECRET="<output of first command>"
TOKEN_ENCRYPTION_KEY="<output of second command>"
```

### 3. All environment variables

#### `backend/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://ordrctrl:ordrctrl@localhost:5432/ordrctrl_dev` | Pre-filled — works with Docker Compose |
| `REDIS_URL` | `redis://localhost:6379` | Pre-filled — works with Docker Compose |
| `SESSION_SECRET` | *(generate)* | 64-char hex string — see above |
| `TOKEN_ENCRYPTION_KEY` | *(generate)* | 64-char hex string — see above |
| `RESEND_API_KEY` | `re_test_...` | Resend API key — see integration setup below |
| `EMAIL_FROM` | `noreply@ordrctrl.local` | Sender address for transactional email |
| `GOOGLE_CLIENT_ID` | *(required)* | Google OAuth client ID — see integration setup below |
| `GOOGLE_CLIENT_SECRET` | *(required)* | Google OAuth client secret |
| `APPLE_CLIENT_ID` | *(required for Apple auth)* | Apple Service ID (e.g. `com.ordrctrl.signin`) |
| `APPLE_TEAM_ID` | *(required for Apple auth)* | 10-character Apple Developer team ID |
| `APPLE_KEY_ID` | *(required for Apple auth)* | Key ID for your Sign In with Apple private key |
| `APPLE_PRIVATE_KEY` | *(required for Apple auth)* | Contents of the `.p8` file — newlines as `\n` |
| `MICROSOFT_CLIENT_ID` | *(optional)* | Azure AD app client ID — for Microsoft Tasks |
| `MICROSOFT_CLIENT_SECRET` | *(optional)* | Azure AD app client secret |
| `MICROSOFT_TENANT_ID` | `common` | Azure AD tenant ID — defaults to multi-tenant |
| `APP_URL` | `http://localhost:3000` | Frontend URL |
| `API_URL` | `http://localhost:4000` | Backend URL |
| `NATIVE_APP_ORIGINS` | `capacitor://localhost,tauri://localhost,http://tauri.localhost` | Allowed CORS origins for native webviews |
| `NODE_ENV` | `development` | |
| `PORT` | `4000` | Backend port |
| `LOG_LEVEL` | `info` | Log verbosity — `trace` \| `debug` \| `info` \| `warn` \| `error` \| `fatal` |
| `NGROK_AUTHTOKEN` | *(optional)* | ngrok auth token — physical device testing only |
| `NGROK_DOMAIN` | *(optional)* | Your static ngrok domain — physical device testing only |

#### `frontend/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:4000` | Backend URL |
| `NODE_ENV` | `development` | |
| `VITE_DEV_APPLE_USERNAME` | *(optional)* | Pre-fills Apple CalDAV credential form locally |
| `VITE_DEV_APPLE_APP_SPECIFIC_PASSWORD` | *(optional)* | Pre-fills Apple CalDAV credential form locally |

---

## One-time integration setup

You only need to do this once per developer machine. These credentials don't change unless you rotate them.

### Google (Sign in with Google + Gmail)

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Credentials**
2. Create an **OAuth 2.0 Client ID** (type: Web application)
3. Under **Authorized redirect URIs**, add **both**:
   - `http://localhost:4000/api/auth/google/callback`
   - `http://localhost:4000/api/integrations/gmail/callback`
4. On the **OAuth consent screen**, add yourself as a test user (while the app is in Testing mode)
5. Copy **Client ID** and **Client Secret** into `backend/.env`:
   ```env
   GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="GOCSPX-your-secret"
   ```

### Apple Sign In

1. Log into [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list/serviceId)
2. Create a **Services ID** (e.g. `com.ordrctrl.signin`)
3. Enable **Sign In with Apple** on that Service ID and configure:
   - **Return URL**: `http://localhost:4000/api/auth/apple/callback`
4. Go to **Keys**, create a key with **Sign In with Apple** enabled, download the `.p8` file
5. Note your **Team ID** (top-right of the portal), **Key ID**, and **Service ID**
6. Inline the private key into `backend/.env` (replace literal newlines with `\n`):
   ```bash
   awk 'NF {printf "%s\\n", $0}' ~/Downloads/AuthKey_XXXXXXXXXX.p8
   ```
7. Set in `backend/.env`:
   ```env
   APPLE_CLIENT_ID="com.ordrctrl.signin"
   APPLE_TEAM_ID="XXXXXXXXXX"
   APPLE_KEY_ID="XXXXXXXXXX"
   APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----\n"
   ```

### Microsoft (Microsoft Tasks)

1. Go to [Azure portal](https://portal.azure.com) → **Azure Active Directory → App registrations → New registration**
2. Set redirect URI to `http://localhost:4000/api/integrations/microsoft/callback`
3. Under **Certificates & secrets**, create a new client secret
4. Set in `backend/.env`:
   ```env
   MICROSOFT_CLIENT_ID="your-client-id"
   MICROSOFT_CLIENT_SECRET="your-client-secret"
   ```

### Resend (transactional email)

1. Sign up at [resend.com](https://resend.com) and create an API key
2. Set in `backend/.env`:
   ```env
   RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxx"
   EMAIL_FROM="noreply@yourdomain.com"
   ```

> **Skip for now**: Without a Resend key the app still runs — email sends are no-ops in development when `RESEND_API_KEY` is unset or set to `test`.

---

## Run the app

### Database migration (first time only)

```bash
cd backend
pnpm prisma migrate dev --name init
pnpm prisma generate
cd ..
```

### Start dev servers

```bash
pnpm dev
```

This starts both backend (`:4000`) and frontend (`:3000`) concurrently.

Or start them individually:

```bash
cd backend && pnpm dev      # backend only
cd frontend && pnpm dev     # frontend only
```

---

## Testing scenarios

### Web (browser)

With `pnpm dev` running, open `http://localhost:3000`. Sign in with email/password, Google, or Apple (if credentials are configured).

---

### iOS Simulator

**Prerequisites:** Xcode 15+, Capacitor iOS project initialized (run once: `cd frontend && pnpm cap add ios`)

```bash
# 1. Sync Capacitor
cd frontend && pnpm cap sync ios

# 2. Open in Xcode
pnpm cap open ios

# 3. In Xcode: select an iPhone simulator → Run (▶)
```

The app will connect to `http://localhost:4000` directly — no ngrok needed for the simulator.

**Sign in with Apple on simulator:** Ensure you have an Apple ID configured in the simulator's **Settings → Sign in to your iPhone** before testing.

---

### Physical device (iOS/Android via ngrok)

Physical devices cannot reach `localhost`. A public HTTPS tunnel is required. Apple also requires HTTPS redirect URIs.

**One-time setup (do once, never again):**

1. Sign up for a [paid ngrok account](https://ngrok.com/) to get a static domain
2. Get your authtoken and static domain from [dashboard.ngrok.com](https://dashboard.ngrok.com)
3. Copy the device env templates:
   ```bash
   cp backend/.env.device.example backend/.env.device.local
   cp frontend/.env.device.example frontend/.env.device.local
   ```
4. Fill in `backend/.env.device.local`:
   ```env
   API_URL=https://your-domain.ngrok-free.app
   NGROK_AUTHTOKEN=your_authtoken
   NGROK_DOMAIN=your-domain.ngrok-free.app
   ```
5. Fill in `frontend/.env.device.local`:
   ```env
   VITE_API_URL=https://your-domain.ngrok-free.app
   ```
6. Register your static domain in **Apple Developer Portal** → Service ID → Sign In with Apple → Return URL:
   `https://your-domain.ngrok-free.app/api/auth/apple/callback`
7. Register it in **Google Cloud Console** → OAuth Client → Authorized redirect URIs:
   `https://your-domain.ngrok-free.app/api/auth/google/callback`
   *(keep `localhost` too — don't remove it)*

**Daily device workflow:**

```bash
# Terminal 1 — infrastructure
docker compose up -d

# Terminal 2 — backend with device overrides
cd backend && pnpm dev:device

# Terminal 3 — ngrok tunnel
cd backend && pnpm dev:ngrok

# Terminal 4 — frontend with device overrides
cd frontend && pnpm dev:device
```

Then in Xcode, select your physical device and hit **Run**.

---

### Tauri (macOS/Windows desktop)

**Additional prerequisites:**

```bash
# macOS
xcode-select --install
brew install create-dmg          # for DMG packaging only

# Rust (both platforms)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**Development (hot-reload):**

```bash
# Terminal 1 — backend
cd backend && pnpm dev

# Terminal 2 — Tauri desktop app
cd frontend && pnpm exec tauri dev --config desktop/tauri.conf.json
```

> **Tip:** If `tauri dev` exits immediately with no error, a previous `.app` build is running in the system tray. Quit it from the tray menu first.

**Sign in with Google / Apple (Tauri):**

1. Click **Continue with Google** — your system browser opens
2. After sign-in, Google redirects to the backend callback
3. Backend redirects to `ordrctrl://auth/callback?status=success`
4. macOS routes the `ordrctrl://` URL back to the Tauri app → navigates to `/feed`

**Production build:**

```bash
cd frontend
pnpm exec tauri build --config desktop/tauri.conf.json
# macOS app:  desktop/target/release/bundle/macos/ordrctrl.app
# macOS DMG:  desktop/target/release/bundle/dmg/ordrctrl_*.dmg
# Windows MSI: desktop/target/release/bundle/msi/ordrctrl_*.msi
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `ECONNREFUSED` on backend start | PostgreSQL or Redis not running | `docker compose up -d` |
| `invalid_state` on Apple sign-in | Redis state expired or `API_URL` mismatch | Confirm `API_URL` matches your actual backend URL; clear stale state: `redis-cli keys "oauth:state:*" \| xargs redis-cli del` |
| Blank page after Apple auth | Deep link not firing | Confirm `Info.plist` has `CFBundleURLSchemes = [ordrctrl]`; re-run `pnpm cap sync ios` |
| `invalid_client` from Apple | Wrong Apple credentials | Check `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` in `.env` |
| `invalid_redirect_uri` from Apple | ngrok URL not registered in Apple Portal | Complete one-time ngrok setup step 6 above |
| Tauri exits immediately | Previous `.app` build running in system tray | Quit from tray menu; or `kill $(pgrep -f "ordrctrl.app")` |
| Physical device can't reach backend | Using `localhost` URL on a physical device | Use `pnpm dev:device` + `pnpm dev:ngrok` workflow |
