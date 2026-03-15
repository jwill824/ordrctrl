# Contract: Deep Link URL Scheme

**Feature**: 015-native-app-targets  
**Scheme**: `ordrctrl://`  
**Version**: 1.0

---

## Overview

The `ordrctrl://` custom URL scheme is registered by both the Capacitor iOS/Android app and the Tauri macOS/Windows app. It is used for:

1. **OAuth callback** — the backend redirects to `ordrctrl://auth/callback` after completing an OAuth handshake, returning control to the native app
2. **Notification tap navigation** — local notifications use `ordrctrl://` URLs as action data so the app opens on the correct route

## URL Format

```
ordrctrl://<path>[?<query>]
```

| Component | Description | Example |
|-----------|-------------|---------|
| `scheme` | Always `ordrctrl` | `ordrctrl://` |
| `path` | Route within the app | `auth/callback` |
| `query` | Optional parameters | `code=abc&state=xyz` |

## Supported Paths

### `/auth/callback`

Invoked by the backend after a successful OAuth provider flow.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `provider` | string | Yes | OAuth provider name (`google`, `apple`) |
| `status` | `success` \| `error` | Yes | Outcome of the OAuth flow |
| `error` | string | No | Machine-readable error code if `status=error` |

**Example — success**:
```
ordrctrl://auth/callback?provider=google&status=success
```

**Example — error**:
```
ordrctrl://auth/callback?provider=apple&status=error&error=access_denied
```

**App behaviour**: On `status=success`, navigate to `/` (home). On `status=error`, navigate to `/login?error=<error>`.

> **Note**: The OAuth code exchange happens entirely on the backend before the redirect. The frontend receives only the final `success` or `error` status. The session cookie is set by the backend before the redirect is issued — no token is passed through the URL.

---

### `/auth/reset-password`

Invoked via a password-reset email link. The backend issues a short-lived token URL.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | Yes | Short-lived reset token (opaque, server-validated) |

**Example**:
```
ordrctrl://auth/reset-password?token=abc123xyz
```

**App behaviour**: Navigate to `/reset-password?token=<token>`, which is the existing web reset-password page.

---

### `/feed`

Notification tap shortcut to the feed view.

No parameters.

**Example**:
```
ordrctrl://feed
```

**App behaviour**: Navigate to `/feed`.

---

### `/inbox`

Notification tap shortcut to the inbox view.

No parameters.

**Example**:
```
ordrctrl://inbox
```

**App behaviour**: Navigate to `/inbox`.

---

## Platform Registration

### iOS (Capacitor)

Registered in `ios/App/App/Info.plist`:
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>ordrctrl</string>
    </array>
    <key>CFBundleURLName</key>
    <string>com.ordrctrl.app</string>
  </dict>
</array>
```

Handled in `frontend/src/plugins/deep-link.ts` via `@capacitor/app` `appUrlOpen` event.

### Android (Capacitor)

Registered in `android/app/src/main/AndroidManifest.xml`:
```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="ordrctrl" />
</intent-filter>
```

### macOS / Windows (Tauri)

Registered via `tauri-plugin-deep-link` in `tauri.conf.json`:
```json
{
  "plugins": {
    "deep-link": {
      "desktop": [{ "schemes": ["ordrctrl"] }]
    }
  }
}
```

> **Key name**: use `"schemes"` (plural, array value), not `"scheme"`. The `DesktopProtocol` type requires the plural form.

Handled in `frontend/src/plugins/deep-link.ts` via `@tauri-apps/plugin-deep-link` `onOpenUrl` event.

---

## Security Considerations

- The `ordrctrl://auth/callback` path must only be reachable from the app's registered bundle identifier. iOS enforces this via `CFBundleURLSchemes` ownership; Android verifies via Digital Asset Links (or restricts to same-app `autoVerify`).
- The `token` parameter in `/auth/reset-password` is short-lived (server TTL: 1 hour). The app must pass it through to the existing web reset-password page immediately.
- No sensitive credentials (passwords, OAuth tokens, API keys) are ever passed through a deep link URL.
- Deep link URLs received while the app is closed are processed on next launch via the `getLaunchUrl()` API — the same handler applies.
