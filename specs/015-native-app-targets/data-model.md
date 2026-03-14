# Data Model: Native App Targets (015)

**Branch**: `015-native-app-targets` | **Date**: 2026-03-14

---

## Overview

No new backend persistence is introduced by this feature. The native app targets wrap the existing SPA; the underlying data model (Tasks, Feed, Inbox, Integrations) is unchanged. This document covers:

1. **Frontend-only state entities** managed in memory or in native lightweight storage
2. **Configuration structures** (Capacitor config, Tauri config)
3. **Notification payload schema** (what data travels from trigger to display)
4. **Deep link URL schema** (how OAuth callbacks and notification taps route into the app)

---

## 1. NotificationPayload

Represents a local notification scheduled for display. Used by `NotificationService` to construct the platform-specific notification object.

```typescript
interface NotificationPayload {
  id: number;            // Unique int (Capacitor requires numeric IDs)
  title: string;         // Short title text (max ~50 chars)
  body: string;          // Detail text (max ~100 chars)
  route: string;         // React Router path to navigate on tap (e.g. "/feed", "/inbox")
  scheduledAt?: Date;    // Optional future schedule time; if absent, show immediately
  groupId?: string;      // Optional grouping key (e.g. "feed", "inbox") for batching
}
```

**Validation**:
- `id` must be unique; collisions replace the existing notification (Capacitor behaviour)
- `route` must be a valid app route (validated at construction time, not runtime)
- `scheduledAt` in the past is treated as immediate

---

## 2. DeepLinkEvent

Represents a custom URL scheme event received by the app (`ordrctrl://...`). Produced by the platform plugin layer and consumed by `DeepLinkHandler`.

```typescript
interface DeepLinkEvent {
  url: string;           // Full URL string, e.g. "ordrctrl://auth/callback?code=..."
  source: 'capacitor' | 'tauri';
}

// Parsed form after DeepLinkHandler processes the URL
interface ParsedDeepLink {
  path: string;          // Pathname portion, e.g. "/auth/callback"
  params: Record<string, string>;  // Query params as key-value map
}
```

**Supported deep link paths**:

| Path | Purpose | Params |
|------|---------|--------|
| `/auth/callback` | OAuth flow completion | `code`, `state` (server handles exchange; client only navigates) |
| `/auth/reset-password` | Password reset | `token` |
| `/inbox` | Navigate to inbox | — |
| `/feed` | Navigate to feed | — |

---

## 3. NativePreferences

Lightweight per-device persistent flags stored in `@capacitor/preferences` (mobile) or `localStorage` (web fallback). Not synced to backend.

```typescript
interface NativePreferences {
  lastSeenFeedTimestamp: string | null;    // ISO 8601; used to detect new items for notifications
  lastSeenInboxTimestamp: string | null;   // ISO 8601; used to detect new inbox items
  notificationsPermissionAsked: boolean;   // Prevents re-prompting after user denies once
}
```

**Storage key prefix**: `ordrctrl.native.`

**Example keys**:
- `ordrctrl.native.lastSeenFeedTimestamp`
- `ordrctrl.native.lastSeenInboxTimestamp`
- `ordrctrl.native.notificationsPermissionAsked`

---

## 4. PlatformContext

Runtime-detected platform information. Computed once on app startup, stored in a React context.

```typescript
type Platform = 'web' | 'capacitor-ios' | 'capacitor-android' | 'tauri-macos' | 'tauri-windows';

interface PlatformContext {
  platform: Platform;
  isNative: boolean;       // true if Capacitor or Tauri
  isMobile: boolean;       // true if Capacitor (iOS or Android)
  isDesktop: boolean;      // true if Tauri (macOS or Windows)
  supportsNotifications: boolean;  // runtime check; false until permission granted
}
```

**Detection logic**:
1. If `window.__TAURI_INTERNALS__` is defined → Tauri
2. Else if `Capacitor.isNativePlatform()` → Capacitor
3. Else → web
4. For Tauri OS detection: `import { platform } from '@tauri-apps/plugin-os'`

---

## 5. Capacitor Config Shape

```typescript
// frontend/capacitor.config.ts
interface CapacitorConfig {
  appId: 'com.ordrctrl.app';
  appName: 'ordrctrl';
  webDir: 'dist';
  server: {
    androidScheme: 'https';    // Required: enables SameSite=Lax cookies on Android
  };
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample';
      iconColor: '#488AFF';
    };
  };
}
```

---

## 6. Tauri Config Shape

```json
// frontend/src-tauri/tauri.conf.json (relevant fields)
{
  "identifier": "com.ordrctrl.app",
  "productName": "ordrctrl",
  "version": "0.1.0",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:3000",
    "beforeBuildCommand": "pnpm --filter frontend build",
    "beforeDevCommand": "pnpm --filter frontend dev"
  },
  "app": {
    "windows": [
      {
        "title": "ordrctrl",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600
      }
    ],
    "withGlobalTauri": false
  },
  "bundle": {
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico"]
  },
  "plugins": {
    "deep-link": {
      "desktop": [{ "scheme": "ordrctrl" }]
    }
  }
}
```

---

## 7. Backend: CORS Multi-Origin Config

New environment variable driving the CORS allowlist expansion in `backend/src/app.ts`.

```
NATIVE_APP_ORIGINS=capacitor://localhost,tauri://localhost,http://tauri.localhost
```

Resolved CORS origin list at runtime:
```typescript
const allowedOrigins = [
  process.env.APP_URL || 'http://localhost:3000',
  ...(process.env.NATIVE_APP_ORIGINS?.split(',').map(o => o.trim()) ?? []),
];
```

**Cookie change in `session.plugin.ts`**:
```typescript
sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
secure: process.env.NODE_ENV === 'production',
```

> **Why `none` in production only**: `SameSite=none` requires `Secure=true`. In development, all origins are localhost and `lax` works fine. In production, native webview origins are cross-site relative to the API domain, requiring `none`.

---

## Entity Relationships

```text
PlatformContext
  └─ determines which plugin is called by ──► NotificationService
                                             DeepLinkHandler

NotificationService
  └─ consumes ──► NotificationPayload
  └─ reads/writes ──► NativePreferences (lastSeenTimestamp)

DeepLinkHandler
  └─ produces ──► ParsedDeepLink
  └─ consumed by ──► React Router (navigation)

NativePreferences
  └─ stored in ──► @capacitor/preferences (mobile) | localStorage (web)
```

No backend entity changes. No database migrations required.
