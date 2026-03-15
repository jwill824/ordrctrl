# Research: Native App Targets (015)

**Branch**: `015-native-app-targets` | **Date**: 2026-03-14

---

## 1. Capacitor for Mobile (iOS + Android)

### Decision
Use **Capacitor 6** to wrap the existing Vite SPA as a native mobile app.

### Rationale
The Vite SPA migration (spec 014) was executed specifically to enable this. The existing `vite.config.ts` already uses `base: './'` for relative asset paths, which is a prerequisite. Capacitor 6 serves the app from a virtual origin (`capacitor://localhost` on iOS, `http://localhost` on Android) — not `file://` — so `BrowserRouter` works without modification.

### Alternatives Considered
- **React Native**: Would require rewriting all UI components. Rejected — no value in parallel codebase.
- **PWA**: No native distribution channel, limited background capabilities, no system-level notification APIs. Rejected.
- **Capacitor 5**: Outdated; Capacitor 6 has improved iOS/Android support and aligns with current plugin versions.

### Key Configuration
```typescript
// frontend/capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.ordrctrl.app',
  appName: 'ordrctrl',
  webDir: 'dist',
  server: { androidScheme: 'https' },  // enables SameSite=Lax cookies on Android
};
export default config;
```

### Required Packages
- `@capacitor/core` `@capacitor/cli` `@capacitor/ios` `@capacitor/android`
- `@capacitor/local-notifications` — local notification scheduling and tap handling
- `@capacitor/app` — app lifecycle events, deep link URL interception
- `@capacitor/preferences` — lightweight persistent key-value storage (session flags, user prefs)

### BrowserRouter Compatibility
Capacitor 6 serves from a virtual HTTP origin (`capacitor://localhost`), not `file://`. The HTML5 history API works correctly — no router changes required.

---

## 2. Tauri 2 for Desktop (macOS + Windows)

### Decision
Use **Tauri 2** to wrap the existing Vite SPA as a native desktop app.

### Rationale
Tauri 2 has a stable plugin ecosystem for system tray, notifications, and deep links. The Rust-based shell is small (~2–10 MB binary vs Electron's ~150 MB). The frontend code requires zero changes — Tauri's WebView loads `../dist` directly.

### Alternatives Considered
- **Electron**: Larger bundle size, higher memory overhead, requires Chromium. Rejected in favour of Tauri's smaller footprint.
- **Tauri 1**: Older API, weaker TypeScript bindings, missing stable plugin ecosystem. Rejected.

### Key Configuration
```json
// frontend/desktop/tauri.conf.json
{
  "identifier": "com.ordrctrl.app",
  "app": { "withGlobalTauri": true },
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:3000"
  }
}
```

### Required Packages (Cargo + npm)
- `tauri` crate (with `features = ["tray-icon"]`) + `tauri-build` build dep — tray support is built into the `tauri` crate; there is no separate `tauri-plugin-tray` crate
- `tauri-plugin-notification` Rust crate — local desktop notifications
- `tauri-plugin-deep-link` Rust crate — custom URL scheme for OAuth callbacks
- `tauri-plugin-single-instance` Rust crate — prevents multiple windows on second launch
- `tauri-plugin-opener` Rust crate — opens URLs in the system browser (used for OAuth flow)
- `@tauri-apps/api` npm package
- `@tauri-apps/plugin-notification` npm package
- `@tauri-apps/plugin-deep-link` npm package
- `@tauri-apps/plugin-os` npm package — OS detection for `PlatformContext`
- `@tauri-apps/plugin-opener` npm package — companion JS bindings for `tauri-plugin-opener`

### WebView Origin
- macOS: `tauri://localhost`
- Windows: `http://tauri.localhost`

---

## 3. Cookie-Based Session — Cross-Origin Fix

### Problem
The backend uses `@fastify/session` with `sameSite: 'lax'` and CORS locked to a single `APP_URL`. Native webview origins (`capacitor://localhost`, `tauri://localhost`, `http://tauri.localhost`) are distinct origins from the API server.

**Impact**: Without changes, all API requests from native apps will fail CORS preflight and session cookies will not be sent/received.

### Decision
Update the backend to:
1. Accept a comma-separated `NATIVE_APP_ORIGINS` environment variable listing the allowed native origins
2. Merge native origins into the CORS `origin` list alongside `APP_URL`
3. Set `sameSite: 'none'` in production (already paired with `secure: true`) to allow cross-origin cookie delivery
4. For Android, set `server.androidScheme: 'https'` in `capacitor.config.ts` so Android's WebView treats cookies as secure

### Alternatives Considered
- **Token-based auth (JWT)**: Would require replacing the session architecture. Rejected — out of scope for this feature.
- **Capacitor HTTP plugin** (native HTTP, bypasses WebView): Avoids CORS entirely, but requires replacing all `fetch()` calls. Too disruptive.

### Environment Variables to Add
```env
# backend/.env
NATIVE_APP_ORIGINS=capacitor://localhost,tauri://localhost,http://tauri.localhost
```

---

## 4. OAuth Redirect Handling in Native Apps

### Problem
OAuth flows (Apple Sign In, Google) redirect to `APP_URL/api/auth/callback/...`. In a native app, the redirect must return to the native app, not open a browser tab.

### Decision
Register a custom deep link URL scheme `ordrctrl://` and configure the OAuth callback to redirect to `ordrctrl://auth/callback` after completing the OAuth handshake on the backend. The native app intercepts the `ordrctrl://` URL, extracts the session state, and navigates the user appropriately.

**Platform dispatch** is handled by `openOAuthUrl()` in `frontend/src/plugins/oauth.ts`, which detects the platform and uses the appropriate browser API:

- **Capacitor (iOS/Android)**: Opens `?platform=capacitor` URL in an in-app browser via `@capacitor/browser` (SFSafariViewController on iOS). The backend detects the `platform=capacitor` query param, completes the OAuth handshake, and redirects to `ordrctrl://auth/callback`. The system closes the in-app browser, fires an `appUrlOpen` event, and the app navigates to the callback route.
- **Tauri (macOS/Windows)**: Uses `tauri-plugin-opener` to open `?platform=tauri` URL in the system browser. The backend detects `platform=tauri` and redirects to `ordrctrl://auth/callback`. The `onOpenUrl` event fires, and the app navigates to the callback route.
- **Web**: `window.location.href` redirect as before.

The backend stores the `platform` query param in the OAuth session and redirects to `ordrctrl://` for both `'tauri'` and `'capacitor'` values.

**`@capacitor/browser` version**: `8.0.2` (installed as a direct dependency).

**For Capacitor**: Use `@capacitor/app` `addListener('appUrlOpen', ...)` to intercept the deep link after the in-app browser closes.  
**For Tauri**: Use `tauri-plugin-deep-link` with `onOpenUrl` event.

### Capacitor Config
```typescript
// capacitor.config.ts
server: { iosScheme: 'ordrctrl' }  // NOT needed — deep link is a separate scheme
```
Requires `CFBundleURLSchemes` (`ordrctrl`) in `Info.plist` and `<intent-filter>` in `AndroidManifest.xml` — both generated by Capacitor CLI from the plugin config.

### Tauri Config
```toml
# Cargo.toml
tauri-plugin-deep-link = "2"
```
```json
// tauri.conf.json
{ "plugins": { "deep-link": { "mobile": [], "desktop": [{ "schemes": ["ordrctrl"] }] } } }
```

> **Config key**: `tauri.conf.json` uses `"schemes"` (plural, array), not `"scheme"`. The `DesktopProtocol` type requires the plural form.

---

## 5. Local Notifications

### Decision
Use `@capacitor/local-notifications` on mobile and `tauri-plugin-notification` on desktop. Both are triggered from the frontend TypeScript layer via a shared `NotificationService` abstraction.

### Scheduling Logic
Notifications for feed items are triggered by the existing feed-polling cycle. New items are detected using an in-memory `Set<string>` of item IDs (`prevItemIdsRef`) maintained in `useFeed.ts`. The first poll establishes a baseline; subsequent polls compare the new ID set against the baseline and schedule a notification for any genuinely new IDs.

> **Why not timestamps**: `FeedItem` has no `updatedAt` or `createdAt` fields, so timestamp-based detection is not possible. The `prevItemIdsRef` Set approach is used instead.

A wrapper in `src/plugins/notifications.ts` calls the appropriate native API based on the platform.

### Deep-Link on Tap
Each notification includes an `actionTypeId` (Capacitor) or `data` payload (Tauri) containing the route to navigate to (`/feed`, `/inbox`, etc.). On tap:
- **Capacitor**: the `"localNotificationActionPerformed"` listener (not `"notificationActionPerformed"`) navigates React Router to the target route.
- **Tauri**: `onAction` from `@tauri-apps/plugin-notification` passes the notification `Options` object directly to the callback (not a `{notification}` wrapper). The `actionUrl` is therefore looked up using `notification.id`, not `action.notification.id`.

---

## 6. Session Persistence Across App Restarts

### Decision
No additional storage is required. Session cookies are persisted in the native WebView's cookie jar by the OS. As long as the session has not expired (7-day TTL on the backend) and the app has not been force-quit by the OS in a way that clears the cookie jar, the user remains logged in.

For explicit session validation on startup, `authService.getCurrentUser()` is already called on every app mount (in `useAuth`). This is sufficient — if the cookie has expired, the API returns 401, the auth state clears, and the user is redirected to login.

### Rationale
Avoids duplicating session state in a second storage layer (Capacitor Preferences or Tauri Store). The existing `httpOnly` session cookie mechanism is the authoritative session token.

---

## 7. Unsupported OS Version Handling

### Decision
Minimum OS targets enforce this at install time:
- iOS 14+ (Capacitor 6 requirement)
- Android 10+ (API Level 29, Capacitor 6 requirement)
- macOS 11 Big Sur+ (Tauri 2 requirement)
- Windows 10+ (Tauri 2 requirement)

App store/TestFlight submissions enforce the minimum version; users on older OS cannot install. No runtime check needed.

---

## 8. Single-Instance Desktop App

### Decision
Use `tauri-plugin-single-instance` to prevent multiple windows. When the app is already running and launched again, the existing window is focused. This satisfies the edge case in the spec ("how does the desktop app handle being launched a second time").

---

## Summary of Backend Changes Required

| Change | Why |
|--------|-----|
| Allow multiple CORS origins (env var list) | Native webview origins differ from `APP_URL` |
| `sameSite: 'none'` in production | Cross-origin cookie delivery to native contexts |
| `NATIVE_APP_ORIGINS` env var | Configurable native origin allowlist |
| OAuth callback redirect to `ordrctrl://` scheme | Returns auth result to native app |
