# Quickstart: Native App Targets (015)

**Branch**: `015-native-app-targets`

---

## Prerequisites

### All Platforms
- Node.js 18+, pnpm 8+
- Repo checked out on `015-native-app-targets`

### Mobile (Capacitor)
- **macOS only** for iOS builds
- Xcode 15+ (install from Mac App Store)
- CocoaPods: `sudo gem install cocoapods`
- Android Studio (for Android builds): [developer.android.com](https://developer.android.com/studio)
- Java 17+: `brew install openjdk@17`

### Desktop (Tauri)
- Rust toolchain: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- macOS DMG packaging: `brew install create-dmg`
- Windows: Microsoft C++ Build Tools (Visual Studio installer)

---

## Install Dependencies

```bash
# From repo root
pnpm install

# Verify frontend builds
pnpm --filter frontend build
```

---

## Mobile: Capacitor

### First-time Setup

```bash
cd frontend

# Add iOS and Android platforms (generates ios/ and android/ directories)
pnpm exec cap add ios
pnpm exec cap add android
```

### Build and Sync

```bash
# Build Vite SPA
pnpm build

# Sync web assets to native projects
pnpm exec cap sync
```

### Run on iOS Simulator

```bash
cd frontend
pnpm exec cap run ios
# OR open Xcode directly:
pnpm exec cap open ios
# Then press ▶ in Xcode to pick a simulator or device
```

### Run on Android Emulator

```bash
cd frontend
pnpm exec cap run android
# OR open Android Studio:
pnpm exec cap open android
# Then press ▶ in Android Studio
```

### Live Reload During Development

```bash
# Terminal 1: start Vite dev server
cd frontend && pnpm dev

# Terminal 2: run with live reload (points native app at local Vite server)
cd frontend && VITE_API_URL=http://localhost:3001 pnpm exec cap run ios --livereload --external
```

> **Note**: For live reload on a physical device, both the device and Mac must be on the same network. Use the machine's LAN IP instead of `localhost` in `VITE_API_URL`.

---

## Desktop: Tauri

### First-time Setup

```bash
cd frontend

# Initialize Tauri project (generates desktop/)
pnpm exec tauri init \
  --app-name ordrctrl \
  --window-title ordrctrl \
  --dist-dir ../dist \
  --dev-url http://localhost:3000 \
  --before-dev-command "pnpm dev" \
  --before-build-command "pnpm build"
```

### Development (hot-reload)

> **Start the backend first**: Tauri loads the app immediately on launch, so the API must be reachable before the window opens.

```bash
# Terminal 1
cd backend && pnpm dev

# Terminal 2
cd frontend && pnpm exec tauri dev --config desktop/tauri.conf.json
# Starts Vite dev server + desktop window simultaneously
# Changes to src/ reload the window automatically
```

> **If `tauri dev` exits immediately with no output**: The installed `.app` (from a DMG) is likely still running in the system tray. Quit it via the tray menu, or run `kill $(pgrep -f "ordrctrl.app")`, then retry.

### Production Build

```bash
cd frontend
pnpm exec tauri build --config desktop/tauri.conf.json

# Output:
# macOS: desktop/target/release/bundle/macos/ordrctrl.app
# macOS DMG: desktop/target/release/bundle/dmg/ordrctrl_*.dmg
# Windows: desktop/target/release/bundle/msi/ordrctrl_*.msi
```

---

## Environment Variables

Create `frontend/.env.local` (not committed):

```env
# API base URL — adjust for your environment
VITE_API_URL=http://localhost:3001

# For physical device testing, use your machine's LAN IP:
# VITE_API_URL=http://192.168.1.x:3001
```

Backend `.env` additions for native support:

```env
# Comma-separated list of allowed native webview origins
NATIVE_APP_ORIGINS=capacitor://localhost,tauri://localhost,http://tauri.localhost
```

---

## Testing Local Notifications

### Mobile (iOS Simulator)

1. Build and run on simulator
2. Log in to the app
3. Trigger a notification by waiting for the feed poll interval OR use the test helper:
   ```javascript
   // In browser console (Capacitor WebView)
   window.__testNotification?.()
   ```
4. Press the Home button (⇧⌘H in Simulator) to background the app
5. The notification should appear in the notification center

> iOS simulators support local notifications. A physical device is not required for initial testing.

### Android Emulator

1. Build and run on emulator
2. Ensure notification permission is granted (Settings → Apps → ordrctrl → Notifications)
3. Same trigger steps as iOS above

### Desktop (Tauri)

1. Run `pnpm exec tauri dev --config desktop/tauri.conf.json`
2. Wait for feed poll or trigger manually
3. Notification appears as a system notification in the macOS Notification Center or Windows Action Center

---

## Testing Deep Links (OAuth Callback)

### iOS Simulator

```bash
# Simulate an OAuth success callback
xcrun simctl openurl booted "ordrctrl://auth/callback?provider=google&status=success"

# Simulate an error
xcrun simctl openurl booted "ordrctrl://auth/callback?provider=google&status=error&error=access_denied"
```

### Android Emulator

```bash
adb shell am start \
  -W -a android.intent.action.VIEW \
  -d "ordrctrl://auth/callback?provider=google&status=success" \
  com.ordrctrl.app
```

### macOS (Tauri)

```bash
open "ordrctrl://auth/callback?provider=google&status=success"
```

> **Note**: The Tauri app must be running for the deep link to be intercepted. If not running, it launches the app.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `cap sync` fails with "No platforms added" | Run `cap add ios` and/or `cap add android` first |
| iOS build fails with CocoaPods error | Run `cd frontend/ios/App && pod install` |
| Android build fails: SDK not found | Set `ANDROID_HOME` env var and install SDK in Android Studio |
| Tauri build fails: `cargo not found` | Install Rust: `rustup update` |
| Cookies not sent on Android | Verify `server.androidScheme: 'https'` in `capacitor.config.ts` |
| CORS error in native app | Add native origin to `NATIVE_APP_ORIGINS` backend env var |
| Notifications not appearing (iOS) | App must request permission on first launch; check Settings → Notifications |
| Deep link not intercepting | Ensure `cap sync` was run after modifying `capacitor.config.ts` |
