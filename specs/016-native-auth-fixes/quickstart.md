# Quickstart: Native App Auth Fixes (016)

**Branch**: `016-native-auth-fixes`
**Date**: 2026-03-15

---

## Prerequisites

- Completed setup from spec 015 quickstart (Capacitor iOS project initialized)
- A paid [ngrok account](https://ngrok.com/) with a **static domain** (required — Apple Sign In needs a permanent HTTPS redirect URI)
- Apple Developer account with Sign In with Apple configured
- Redis running locally (`docker-compose up -d redis`)

---

## One-Time Setup (do this once, never again)

### Step 1 — Configure ngrok credentials

Add to `backend/.env`:

```env
NGROK_AUTHTOKEN=your_token_here   # from https://dashboard.ngrok.com/
NGROK_DOMAIN=your-name.ngrok-free.app  # from https://dashboard.ngrok.com/domains
```

### Step 2 — Register your static domain with Apple Developer Portal

> **One-time only** — because your domain never changes, you never need to redo this.

1. Go to [https://developer.apple.com/account/resources/identifiers/list/serviceId](https://developer.apple.com/account/resources/identifiers/list/serviceId)
2. Select your Service ID (e.g., `com.ordrctrl.signin`)
3. Under **Sign In with Apple** → **Configure**
4. Add **Return URL**: `https://{your-ngrok-domain}/api/auth/apple/callback`
5. Save → Continue → Register

### Step 3 — Set API URL permanently

Since your ngrok domain is static, set it once in `backend/.env` and `frontend/.env` and never touch it again:

```env
# backend/.env
API_URL=https://your-name.ngrok-free.app

# frontend/.env
VITE_API_URL=https://your-name.ngrok-free.app
```

---

## Daily Dev Workflow

Open 3 terminals:

```bash
# Terminal 1 — infrastructure
docker-compose up -d

# Terminal 2 — backend + ngrok tunnel
cd backend
pnpm dev         # start backend on :4000
# In a new tab:
pnpm dev:ngrok   # exposes :4000 at your static ngrok domain

# Terminal 3 — frontend
cd frontend
pnpm dev
```

---

## Testing on iOS Simulator (US1 — #53, #54)

```bash
cd frontend
pnpm cap sync ios
pnpm cap open ios
# In Xcode: select an iPhone simulator → Run (▶)
```

1. Tap **Sign in with Apple**
2. Complete the Apple ID prompt (use an Apple ID configured in the simulator's Settings)
3. Apple redirects (GET) to `/api/auth/apple/callback` on your ngrok URL
4. Backend exchanges code → stores session → redirects to `ordrctrl://auth/callback?status=success`
5. SFSafariViewController closes → `appUrlOpen` fires → app navigates to `/feed` ✅

---

## Testing on a Physical Device (US2 — #55)

1. Connect iPhone via USB
2. In Xcode, select your physical device as the build target
3. Ensure your device is registered in your Apple Developer account
4. Hit **Run** — Xcode installs directly to the phone
5. Sign In with Apple → same flow as simulator above
6. Backend is reachable via your static ngrok URL (not localhost) ✅

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "invalid_state" error | Stale Redis state or `API_URL` mismatch | Run `redis-cli keys "oauth:state:*" \| xargs redis-cli del`; confirm `API_URL` matches your ngrok domain |
| Blank page after Apple auth | `response_mode: 'form_post'` not removed | `grep response_mode backend/src/auth/providers/apple.ts` — should return nothing |
| Deep link never fires | `ordrctrl://` scheme not registered | Confirm `Info.plist` has `CFBundleURLSchemes = [ordrctrl]`; re-run `cap sync ios` |
| "invalid_client" from Apple | Wrong Apple credentials in `.env` | Check `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` |
| "invalid_redirect_uri" from Apple | ngrok URL not registered in Apple Portal | Confirm Step 2 was completed with your exact static domain |
| `$NGROK_DOMAIN: unbound variable` | `NGROK_DOMAIN` not set in `.env` | Add `NGROK_DOMAIN=your-name.ngrok-free.app` to `backend/.env` |

---

## Resetting State

```bash
# Clear OAuth state entries only
redis-cli keys "oauth:state:*" | xargs redis-cli del

# Or wipe all local dev Redis data
redis-cli flushdb
```

