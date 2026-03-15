# Quickstart: Native App Auth Fixes (016)

**Branch**: `016-native-auth-fixes`
**Date**: 2026-03-15

---

## Prerequisites

- Completed setup from spec 015 quickstart (Capacitor iOS simulator running)
- A free [ngrok account](https://ngrok.com/) (required for Apple Sign In testing — Apple requires HTTPS)
- Apple Developer account with Sign In with Apple configured (see Step 2 below)
- Redis running locally (already required by the main dev setup)

---

## Step 1 — Install ngrok

```bash
# From the repo root
cd backend
pnpm install   # installs @ngrok/ngrok devDependency

# Verify
pnpm exec ngrok --version
```

---

## Step 2 — Configure ngrok Auth Token

1. Log in at [https://dashboard.ngrok.com/](https://dashboard.ngrok.com/)
2. Go to **Your Authtoken** and copy the token
3. Add it to `backend/.env`:

```env
NGROK_AUTHTOKEN=your_token_here
```

---

## Step 3 — Start the ngrok Tunnel

```bash
# Terminal 1 — start the backend with ngrok tunnel
cd backend
pnpm dev:ngrok
```

The terminal will print something like:

```
[ngrok] Tunnel started: https://abc123.ngrok-free.app
[ngrok] Set API_URL=https://abc123.ngrok-free.app in your .env when testing Apple Sign In
```

Copy the `https://…ngrok-free.app` URL — you'll need it for the next steps.

---

## Step 4 — Register the ngrok URL with Apple Developer Portal

> **One-time setup per ngrok URL.** Free ngrok accounts get a new random URL each session; paid accounts with a static domain only need this once.

1. Go to [https://developer.apple.com/account/resources/identifiers/list/serviceId](https://developer.apple.com/account/resources/identifiers/list/serviceId)
2. Select your Service ID (e.g., `com.ordrctrl.signin`)
3. Under **Sign In with Apple**, click **Configure**
4. Add a **Return URL**: `https://{your-ngrok-url}/api/auth/apple/callback`
5. Click **Save** and **Continue** → **Register**

---

## Step 5 — Set Environment Variables for Native Testing

Update `backend/.env` (or create `backend/.env.local`):

```env
# Replace with your actual ngrok URL
API_URL=https://abc123.ngrok-free.app
```

Update `frontend/.env` (or create `frontend/.env.local`):

```env
# Must match the API_URL above
VITE_API_URL=https://abc123.ngrok-free.app
```

---

## Step 6 — Build and Run the iOS Simulator

```bash
# Terminal 2 — start the frontend dev server
cd frontend
pnpm dev

# Terminal 3 — sync and open the iOS simulator
cd frontend
pnpm cap sync ios
pnpm cap open ios
# In Xcode: select any iPhone simulator → Run (▶)
```

---

## Step 7 — Test Apple Sign In on Simulator

1. The app opens in the iOS simulator
2. Tap **Sign in with Apple**
3. `@capacitor/browser` opens SFSafariViewController pointing to `/api/auth/apple?platform=capacitor`
4. Complete the Apple Sign In prompt (use an Apple ID configured in the simulator's Settings)
5. After authenticating, Apple redirects (GET) to `/api/auth/apple/callback`
6. Backend exchanges the code, stores the session, redirects to `ordrctrl://auth/callback?status=success`
7. SFSafariViewController intercepts the `ordrctrl://` scheme → closes → `appUrlOpen` fires
8. App navigates to `/feed` ✅

---

## Step 8 — Test on a Physical Device (optional)

1. Connect your iPhone via USB (or use AirDrop build)
2. In Xcode, select your physical device as the build target
3. Ensure the device and your Mac are on the same network
4. The backend is reachable via the ngrok URL (not localhost)
5. Proceed with Sign In as in Step 7

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "invalid_state" error on sign in | Old session-based state still in Redis from before the fix, or `API_URL` not set to ngrok URL | Clear Redis: `redis-cli flushdb`; confirm `API_URL` matches ngrok URL |
| SFSafariViewController shows blank page after Apple auth | `response_mode: 'form_post'` not removed from `apple.ts` | Confirm the fix is applied: `grep response_mode backend/src/auth/providers/apple.ts` should return nothing |
| Deep link never fires, app stays on blank screen | `ordrctrl://` URL scheme not registered in iOS | Confirm `Info.plist` has `CFBundleURLSchemes = [ordrctrl]`; re-run `cap sync ios` |
| Apple returns "invalid_client" | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, or `APPLE_PRIVATE_KEY` incorrect in `.env` | Verify all four values in Apple Developer Portal |
| Apple returns "invalid_redirect_uri" | ngrok URL not registered in Apple Developer Portal Service ID | Repeat Step 4 with the current ngrok URL |
| ngrok tunnel disconnects | Free plan idle timeout | Restart `pnpm dev:ngrok`; update `API_URL` and `VITE_API_URL` with new URL |

---

## Resetting State for Fresh Testing

```bash
# Clear all OAuth state entries in Redis (safe to do any time)
redis-cli keys "oauth:state:*" | xargs redis-cli del

# Or clear the entire local dev Redis
redis-cli flushdb
```
