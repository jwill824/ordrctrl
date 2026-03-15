# Research: Native App Auth Fixes (016)

**Branch**: `016-native-auth-fixes`
**Date**: 2026-03-15

---

## Finding 1 — Root Cause of #53 + #54: SameSite=Lax Breaks Apple form_post Callback

### Decision
Replace session-based OAuth state storage with Redis-based stateless state storage.

### Rationale
Apple's Sign In with Apple web flow uses `response_mode: 'form_post'`: Apple's servers POST the `code` + `state` values directly to our callback endpoint (`POST /api/auth/apple/callback`). This is a **cross-origin POST** from `appleid.apple.com` to our backend.

`SameSite=Lax` cookies are only sent on:
- Same-origin requests (any method)
- Cross-origin **GET** top-level navigations

`SameSite=Lax` cookies are **NOT** sent on:
- Cross-origin **POST** requests — which is exactly what Apple's form_post callback is

**Consequence in the current code:**
1. `GET /api/auth/apple?platform=capacitor` — backend saves `oauthState` + `oauthPlatform` in session, sets session cookie (SameSite=Lax)
2. User authenticates on Apple's page (inside SFSafariViewController)
3. Apple POSTs to `POST /api/auth/apple/callback` — session cookie is **not sent** (cross-origin POST, SameSite=Lax blocks it)
4. Backend reads `request.session.oauthState` → `undefined` (empty session, new session ID)
5. `state !== expectedState` → redirect to `ordrctrl://auth/callback?status=error&error=invalid_state`
6. App receives the deep link with error → user sees sign-in failure → issue #54
7. In some OS/Capacitor version combinations, the error deep link may not reliably close SFSafariViewController → issue #53 (callback appears "stuck")

**The Google OAuth callback (`GET`) works fine because Apple's use of form_post is the exception — Google uses a GET redirect.**

### Fix: Redis-based OAuth state store
Store the state value as a Redis key with a 10-minute TTL. The state itself is the lookup key — no session is needed for the callback.

```
Key:   oauth:state:{state_value}
Value: JSON { platform: 'capacitor' | 'tauri' | 'web' }
TTL:   600 seconds (10 minutes)
```

On initiation: `redis.setex('oauth:state:{state}', 600, JSON.stringify({ platform }))`
On callback: `redis.get('oauth:state:{state}')` → parse → delete key

The Google callback (GET) is also affected in theory, but the GET redirect preserves the session cookie. Migrating both to Redis is the correct approach for consistency and defense-in-depth.

### Alternatives Considered
- **Change `sameSite` to `'none'`**: Requires `secure: true`, which means HTTPS. `http://localhost` is not HTTPS so this breaks dev; also weakens CSRF protection.
- **Change `response_mode` to `query`**: Apple allows this for some flows, but `form_post` is the Apple requirement for web-based Sign In — not configurable on our side.
- **Use native Apple Sign In SDK** (`@capacitor-community/apple-sign-in`): Bypasses the web OAuth entirely; valid long-term option but requires entitlement configuration changes and a larger refactor. Out of scope for this bug fix.
- **Store state in the redirect_uri as a query param**: Anti-pattern; defeats the CSRF protection purpose of state.

---

## Finding 2 — Issue #53: SFSafariViewController "Stuck" After Error Redirect

### Decision
Fixing the state mismatch (Finding 1) resolves #53. No separate fix needed.

### Rationale
Once the backend redirects to `ordrctrl://auth/callback?status=error&error=invalid_state`, iOS should fire `appUrlOpen` in the Capacitor app. The handler in `deep-link.ts` calls `Browser.close()` and then navigates to `/login?error=invalid_state`. If the user never sees this navigation, it is because:
1. The `ordrctrl://` redirect itself fails (e.g., scheme not registered) — but the scheme IS registered in `Info.plist`, so this is unlikely.
2. The state mismatch error fires on every attempt, and users report it as the flow "not returning" (because they land on `/login` with an error state rather than being authenticated).

Fixing the root cause (state mismatch) means the callback will redirect to `ordrctrl://auth/callback?status=success` instead, which navigates to `/` — fully resolving both issues.

---

## Finding 3 — ngrok for Physical Device Testing (#55)

### Decision
Use `@ngrok/ngrok` npm package as a backend devDependency, launched via a dedicated `dev:ngrok` script. The ngrok tunnel URL overrides `API_URL` in `.env.local` for physical device testing sessions.

### Rationale
Physical iOS/Android devices cannot reach `http://localhost:4000` because localhost refers to the device itself. A public HTTPS tunnel is required.

**Apple OAuth requirement**: Apple's `redirect_uri` in the Apple Developer Portal must be registered. For the web OAuth flow, `http://localhost` IS allowed by Apple for development (Apple's OIDC discovery endpoint accepts localhost redirect URIs in the development client). However, a physical device's browser making the OAuth request will call our backend via whatever URL is in `VITE_API_URL` — if that's still `http://localhost:4000`, the request fails.

**ngrok provides two things:**
1. A public HTTPS URL that routes to `localhost:4000` — physical devices can reach it
2. An HTTPS URL that Apple will accept as a valid redirect_uri (Apple does accept localhost without HTTPS in dev, but ngrok's HTTPS URL is more robust)

**ngrok URL in `VITE_API_URL`**: When switching to physical device testing, the developer sets `VITE_API_URL` to the ngrok URL. The `@ngrok/ngrok` package can be configured with a static domain (paid plan) or used with the auto-assigned URL.

**Apple Developer Portal**: The ngrok URL must be added to the Service ID's callback URLs in Apple Developer Portal when testing on physical devices. This is a one-time configuration step that must be documented.

### Integration Approach
- Add `@ngrok/ngrok` as a devDependency in `backend/package.json`
- Add a `dev:ngrok` script in `backend/package.json`: starts a tunnel to port 4000 and outputs the URL
- Add `NGROK_AUTHTOKEN` to `backend/.env.example` (value from ngrok account)
- Developer workflow: run `dev:ngrok`, copy the URL, set in `backend/.env.local` as `API_URL` and in `frontend/.env.local` as `VITE_API_URL`
- Document the full physical device testing workflow in `quickstart.md`

### Alternatives Considered
- **Standalone ngrok CLI**: Works but requires manual install outside the repo; `@ngrok/ngrok` npm package keeps the tool in `node_modules` and is scriptable
- **Cloudflare Tunnel (cloudflared)**: Good free option but adds a non-npm dependency
- **mkcert + network binding**: Makes the dev server available on the local network IP via HTTPS; avoids third-party tunnels but requires iOS to trust the certificate, which is complex

---

## Finding 4 — Second Root Cause: response_mode=form_post Breaks SFSafariViewController Redirect Chain

### Decision
Remove `response_mode: 'form_post'` from the Apple authorization URL — fall back to the default `response_mode: 'query'` (standard OAuth 2.0 code in query string).

### Rationale
Even after fixing the state storage (Finding 1), there is a second independent failure mode:

Apple's `form_post` callback is an HTTP POST from Apple's servers to our backend. Our backend responds with `HTTP 302 → ordrctrl://auth/callback`. The problem:

> **SFSafariViewController does not follow 302 redirects from POST responses.** This is a browser security constraint — cross-origin POST→redirect chains are not followed in in-app browsers. The user is left on a blank callback page; the deep link never fires.

With `response_mode: 'query'` (the default for OAuth 2.0):
- Apple issues a `302 GET` redirect to our callback URL with `?code=...&state=...` as query parameters
- SFSafariViewController follows the GET redirect normally
- Backend handles `GET /api/auth/apple/callback`, performs the token exchange, then redirects to `ordrctrl://auth/callback?status=success`
- SFSafariViewController intercepts the `ordrctrl://` scheme and fires `appUrlOpen` in the Capacitor app

**Note**: `response_mode: 'query'` is the standard OAuth 2.0 behavior and is what Google uses. Apple supports it — `form_post` is an optional mode that improves security for server-side web apps (the code never appears in browser history), but it is unsuitable for the native app flow we are using.

### Alternatives Considered
- **Keep form_post + handle POST→redirect differently**: Not feasible. SFSafariViewController's behavior is controlled by iOS, not our code.
- **Use native Sign In with Apple SDK** (`@capacitor-community/apple-sign-in`): Bypasses the web flow entirely; avoids both issues. But requires additional entitlement configuration and native plugin setup — a larger refactor, deferred to a future spec.

---

## Finding 5 — Apple Requires HTTPS for Redirect URIs (ngrok satisfies this)

### Decision
Use ngrok URL as `API_URL` for all Apple Sign In testing (both simulator and physical device).

### Rationale
Apple's OAuth service requires registered redirect URIs to use HTTPS, even in development. `http://localhost:4000/api/auth/apple/callback` is NOT accepted as a valid redirect URI in the Apple Developer Portal. This means:
- Apple Sign In cannot be tested with a plain `http://localhost` backend
- The ngrok tunnel (`https://…ngrok-free.app`) satisfies Apple's HTTPS requirement
- Both simulator and physical device testing should use the ngrok URL as `API_URL`
- The ngrok URL must also be registered in the Apple Developer Portal as an allowed callback

---

## Finding 6 — No Backend or iOS Native Changes Needed Beyond State Storage

### Decision
The `ordrctrl://` URL scheme, CORS configuration, `@capacitor/browser` usage, and `appUrlOpen` listener are all correctly implemented. No changes to these are needed.

### Rationale
- `Info.plist` has `CFBundleURLSchemes = [ordrctrl]` registered correctly
- `DeepLinkHandler.init()` subscribes to `appUrlOpen` and calls `Browser.close()` + routes
- CORS already allows `capacitor://localhost` via `NATIVE_APP_ORIGINS`
- Session cookie `sameSite: 'none'` in production is correct for native webview origins
- The only defect is the state storage mechanism — everything else in the auth pipeline is correct

---

## Summary Table

| Issue | Root Cause | Fix | Files Changed |
|-------|-----------|-----|---------------|
| #54 Apple Sign In error (state mismatch) | `SameSite=Lax` blocks session cookie on Apple's `form_post` POST → state mismatch | Redis-based OAuth state store | `backend/src/auth/oauth-state.ts` (new), `backend/src/api/auth.routes.ts` |
| #54 Apple Sign In error (POST→redirect stuck) | `response_mode: 'form_post'` + SFSafariViewController doesn't follow POST 302 redirects | Remove `response_mode: 'form_post'` from Apple authorization URL | `backend/src/auth/providers/apple.ts` |
| #53 iOS callback not returning | Both #54 root causes above; deep link never fires | Fixed by #54 fixes | No additional change |
| #55 Physical device testing | `localhost:4000` unreachable from physical devices; Apple requires HTTPS redirect URI | ngrok tunnel + dev script + docs | `backend/package.json`, `backend/.env.example`, `quickstart.md` |
