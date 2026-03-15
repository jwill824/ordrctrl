# Tasks: Native App Targets (Capacitor + Tauri)

**Input**: `/specs/015-native-app-targets/`
**Organization**: Tasks grouped by user story for independent implementation and testing

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story this task belongs to (US1, US2, US3) — only in Phase 3+

---

## Phase 1: Setup

**Purpose**: Install native platform dependencies and prepare the `src/plugins/` scaffold and environment variable documentation

- [X] T001 Install all Capacitor and Tauri npm packages in `frontend/package.json` (`@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`, `@capacitor/local-notifications`, `@capacitor/app`, `@capacitor/preferences`, `@tauri-apps/cli`, `@tauri-apps/api`)
- [X] T002 [P] Document `NATIVE_APP_ORIGINS=capacitor://localhost,tauri://localhost,http://tauri.localhost` env var with inline comment explaining native webview origin allowlist in `backend/.env.example`
- [X] T003 [P] Create `frontend/src/plugins/index.ts` with `Platform` union type (`'web' | 'capacitor-ios' | 'capacitor-android' | 'tauri-macos' | 'tauri-windows'`), `PlatformContext` interface shape, and module re-export stubs for `notifications` and `deep-link`
- [X] T004 [P] Create `frontend/src/plugins/notifications.ts` with `NotificationPayload` and `NativePreferences` interface type stubs and an empty `NotificationService` export skeleton
- [X] T005 [P] Create `frontend/src/plugins/deep-link.ts` with `DeepLinkEvent` and `ParsedDeepLink` interface type stubs and an empty `DeepLinkHandler` export skeleton

---

## Phase 2: Foundational — Backend Changes

**Purpose**: CORS multi-origin support and session cookie `sameSite` changes — MUST be complete before any native story can authenticate

**⚠️ CRITICAL**: All three user stories depend on this phase. Native app login will fail without both tasks complete.

- [X] T006 [P] Update `backend/src/app.ts` CORS configuration to build an `allowedOrigins` list by merging `process.env.APP_URL` with a split of `process.env.NATIVE_APP_ORIGINS` (comma-separated), replacing the current single-origin CORS `origin` value
- [X] T007 [P] Update `backend/src/auth/session.plugin.ts` session cookie options to set `sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'` and `secure: process.env.NODE_ENV === 'production'`

**Checkpoint**: Backend now accepts credentialed requests from `capacitor://localhost`, `tauri://localhost`, and `http://tauri.localhost` — user story implementation can begin

---

## Phase 3: User Story 1 — Install & Use on Mobile (P1) 🎯 MVP

**Goal**: Capacitor 6 wrapping the SPA with iOS and Android platform targets, platform detection context, and deep-link OAuth handling via the `ordrctrl://` scheme

**Independent Test**: Install on iOS/Android simulator. Log in (including OAuth flow), browse the feed, complete a task, open settings. Session persists across app restart. Offline state shows a friendly error and does not crash.

### Implementation

- [X] T008 [US1] Create `frontend/capacitor.config.ts` with `appId: 'com.ordrctrl.app'`, `appName: 'ordrctrl'`, `webDir: 'dist'`, `server.androidScheme: 'https'`, and `plugins.LocalNotifications` icon config (`smallIcon`, `iconColor`)
- [X] T009 [P] [US1] Run `pnpm --filter frontend exec cap add ios` to scaffold the `frontend/ios/` platform directory (CLI-generated — do not create files manually)
- [X] T010 [P] [US1] Run `pnpm --filter frontend exec cap add android` to scaffold the `frontend/android/` platform directory (CLI-generated — do not create files manually)
- [X] T011 [P] [US1] Add `ordrctrl` custom URL scheme entry (`CFBundleURLSchemes` / `CFBundleURLName: com.ordrctrl.app`) to `frontend/ios/App/App/Info.plist` for iOS deep link registration
- [X] T012 [P] [US1] Add `ordrctrl://` `<intent-filter>` block (`VIEW` action, `DEFAULT` + `BROWSABLE` categories, `android:scheme="ordrctrl"`) to `frontend/android/app/src/main/AndroidManifest.xml`
- [X] T013 [P] [US1] Implement `PlatformContext` detection logic (`window.__TAURI_INTERNALS__` check → Tauri; `Capacitor.isNativePlatform()` check → Capacitor; else web), React context, and `usePlatform()` hook in `frontend/src/plugins/index.ts`
- [X] T014 [P] [US1] Wrap the app root with `PlatformContextProvider` in `frontend/src/main.tsx`
- [X] T015 [P] [US1] Implement Capacitor deep link handler in `frontend/src/plugins/deep-link.ts`: `App.addListener('appUrlOpen', ...)` listener, `getLaunchUrl()` cold-start check, `parseDeepLink(url)` URL parser, and React Router navigation for all `ordrctrl://` routes (`/auth/callback` → `/` or `/login?error=`, `/auth/reset-password` → `/reset-password?token=`, `/feed` → `/feed`, `/inbox` → `/inbox`)

**Checkpoint**: User Story 1 fully functional and independently testable — iOS/Android simulator install, OAuth login, and deep-link routing all work end-to-end

---

## Phase 4: User Story 2 — Install & Use on Desktop (P2)

**Goal**: Tauri 2 wrapping the SPA for macOS and Windows with system tray minimize-to-tray, single-instance guard, and `ordrctrl://` deep-link OAuth handling

**Independent Test**: Install the desktop build on macOS or Windows. Log in, use the app, close the window (minimizes to system tray), click the tray icon to restore. All features work. Launching a second instance focuses the existing window.

### Implementation

- [X] T016 [US2] Run `pnpm --filter frontend exec tauri init` to scaffold `frontend/desktop/` with `Cargo.toml`, `build.rs`, `src/main.rs`, and `tauri.conf.json` (CLI-generated — do not create files manually)
- [X] T017 [P] [US2] Configure `frontend/desktop/tauri.conf.json`: set `identifier: "com.ordrctrl.app"`, `productName: "ordrctrl"`, `version`, `build.frontendDist: "../dist"`, `build.devUrl: "http://localhost:3000"`, `build.beforeBuildCommand`, `app.withGlobalTauri: false`, window dimensions (`width: 1200`, `height: 800`, `minWidth: 800`, `minHeight: 600`), and `plugins.deep-link.desktop: [{ "scheme": "ordrctrl" }]`
- [X] T018 [P] [US2] Add `tauri-plugin-tray`, `tauri-plugin-notification`, `tauri-plugin-deep-link`, `tauri-plugin-single-instance`, and `tauri-plugin-opener` crate dependencies (version `"2"`) to `[dependencies]` in `frontend/desktop/Cargo.toml`
- [X] T019 [P] [US2] Implement system tray icon setup (hide window on close, restore on tray click), `single-instance` plugin registration (focus existing window on relaunch), and all required plugin `.plugin()` calls in `frontend/desktop/src/main.rs`
- [X] T020 [P] [US2] Add Tauri deep link handler to `frontend/src/plugins/deep-link.ts`: import `onOpenUrl` from `@tauri-apps/plugin-deep-link`, register listener alongside the existing Capacitor handler using `PlatformContext.isDesktop` guard, and reuse the shared `parseDeepLink()` and router navigation logic from T015

**Checkpoint**: User Story 2 fully functional and independently testable — macOS/Windows build installs and launches, tray minimize/restore works, and deep-link OAuth routing is functional

---

## Phase 5: User Story 3 — Native Notifications (P3)

**Goal**: `NotificationService` abstraction with Capacitor and Tauri dispatch paths, permission request flow using `NativePreferences`, feed and inbox polling notification triggers, and notification-tap deep-link navigation

**Independent Test**: Grant notification permission when prompted on first launch. Trigger a feed or inbox event (new item arrives during polling). Verify a notification appears in the device notification center without the app in foreground. Tap the notification — verify the app opens and navigates to the correct route (`/feed` or `/inbox`).

### Implementation

- [X] T021 [US3] Implement `NativePreferences` read/write helpers in `frontend/src/plugins/notifications.ts` using `@capacitor/preferences` on native (`ordrctrl.native.*` key prefix) and `localStorage` as web fallback; implement `checkAndRequestPermission()` flow: read `notificationsPermissionAsked` flag → call platform permission API if not yet asked → update flag → silently return `false` if denied
- [X] T022 [US3] Implement `NotificationService.schedule(payload: NotificationPayload)` in `frontend/src/plugins/notifications.ts`: call `checkAndRequestPermission()` guard; on Capacitor dispatch to `LocalNotifications.schedule()` (with `extra.actionUrl`, `threadIdentifier`, `channelId`, and optional `schedule.at`); on Tauri dispatch to `sendNotification()` and store `actionUrl` in a module-level `Map<string, string>` keyed by `String(payload.id)`; no-op on web
- [X] T023 [US3] Add notification-tap listeners in `frontend/src/plugins/notifications.ts`: `LocalNotifications.addListener('notificationActionPerformed', ...)` for Capacitor (read `actionUrl` from `notification.extra`) and a Tauri `notification-action` event handler (look up `actionUrl` in the Map by notification identity); both call `router.navigate(actionUrl)` via a registered navigation callback
- [X] T024 [P] [US3] Add new-item detection and notification trigger to the existing feed polling hook in `frontend/src/hooks/useFeedPolling.ts`: after each successful poll, compare the newest item timestamp against `NativePreferences.lastSeenFeedTimestamp`; if newer items exist, call `NotificationService.schedule()` with a feed payload and update the stored timestamp
- [X] T025 [P] [US3] Add new-item detection and notification trigger to the existing inbox polling hook in `frontend/src/hooks/useInboxPolling.ts`: after each successful poll, compare the newest message timestamp against `NativePreferences.lastSeenInboxTimestamp`; if newer messages exist, call `NotificationService.schedule()` with an inbox payload and update the stored timestamp

**Checkpoint**: User Story 3 fully functional — notifications fire on feed and inbox updates, permission flow executes once, and tapping a notification navigates to the correct route on all platforms

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Icon asset generation, build pipeline verification, deep link contract audit, and quickstart documentation

- [X] T026 [P] Generate the full Tauri icon set from a square source image (1024×1024 PNG) using `pnpm --filter frontend exec tauri icon <source.png> --config desktop/tauri.conf.json`, placing all output icons into `frontend/desktop/icons/`
- [X] T027 [P] Run `pnpm --filter frontend exec cap sync` to push web assets into `frontend/ios/` and `frontend/android/`, verify all plugins are registered, and confirm no sync errors
- [X] T028 [P] Verify iOS build configuration is structurally valid by running `xcodebuild -list` from `frontend/ios/App/` and confirming the `App` scheme and targets are present
- [X] T029 [P] Verify Tauri Rust compilation is error-free by running `cargo check` from `frontend/desktop/`
- [X] T030 [P] Audit all `ordrctrl://` route handlers in `frontend/src/plugins/deep-link.ts` against `specs/015-native-app-targets/contracts/deep-link-scheme.md` — confirm `/auth/callback` (success + error branches), `/auth/reset-password`, `/feed`, and `/inbox` are all handled and navigation targets are correct
- [X] T031 [P] Update `specs/015-native-app-targets/quickstart.md` with final device setup commands, simulator launch steps, `cap sync` / `cargo tauri dev` invocations, and notification test steps reflecting the implemented configuration

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user stories** (native webview requests fail CORS and cookies without this)
- **Phase 3 (US1 Mobile)**: Depends on Phase 2 — no dependency on US2 or US3
- **Phase 4 (US2 Desktop)**: Depends on Phase 2 — no dependency on US1 or US3
- **Phase 5 (US3 Notifications)**: Depends on Phase 2 — integrates with `src/plugins/` files established in US1 and US2; best started after both US1 and US2 are complete so both Capacitor and Tauri dispatch paths exist in `notifications.ts`
- **Phase 6 (Polish)**: Depends on all desired user stories complete

### Execution Graph

**Phase 1:**
```
T001 → { T002 [P] ∥ T003 [P] ∥ T004 [P] ∥ T005 [P] }
```

**Phase 2:**
```
T006 [P] ∥ T007 [P]
```

**Phase 3 (US1):**
```
T008 → { T009 [P] ∥ T010 [P] ∥ T013 [P] }
          ↓           ↓
        T011 [P]   T012 [P]
        T013 [P] → { T014 [P] ∥ T015 [P] }
```

**Phase 4 (US2):**
```
T016 → { T017 [P] ∥ T018 [P] }
         ↓ (both complete) ↓
       { T019 [P] ∥ T020 [P] }
```

**Phase 5 (US3):**
```
T021 → T022 → { T023 ∥ T024 [P] ∥ T025 [P] }
```

**Phase 6:**
```
T026 [P] ∥ T027 [P] ∥ T028 [P] ∥ T029 [P] ∥ T030 [P] ∥ T031 [P]
```

### Parallel Opportunities

**Phase 1** — after T001:
```bash
# All four run simultaneously (different files):
T002  # backend/.env.example
T003  # frontend/src/plugins/index.ts
T004  # frontend/src/plugins/notifications.ts
T005  # frontend/src/plugins/deep-link.ts
```

**Phase 2** — entire phase:
```bash
# Both run simultaneously (different files):
T006  # backend/src/app.ts
T007  # backend/src/auth/session.plugin.ts
```

**Phase 3** — after T008:
```bash
# Three run simultaneously (different targets):
T009  # cap add ios  →  then T011 (Info.plist)
T010  # cap add android  →  then T012 (AndroidManifest.xml)
T013  # plugins/index.ts  →  then T014 (main.tsx) + T015 (deep-link.ts)
```

**Phase 4** — after T016, then after T017+T018:
```bash
# First wave (after tauri init):
T017  # tauri.conf.json
T018  # Cargo.toml

# Second wave (after both above):
T019  # desktop/src/main.rs
T020  # src/plugins/deep-link.ts
```

**Phase 5** — after T022:
```bash
# Three run simultaneously (different files):
T023  # src/plugins/notifications.ts (tap listener)
T024  # src/hooks/useFeedPolling.ts
T025  # src/hooks/useInboxPolling.ts
```

**Phase 6** — entire phase:
```bash
# All six run simultaneously (independent verification tasks):
T026 T027 T028 T029 T030 T031
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational — CRITICAL (T006–T007)
3. Complete Phase 3: User Story 1 — Mobile (T008–T015)
4. **STOP AND VALIDATE**: Install on iOS/Android simulator, log in via OAuth, verify session persistence and offline error state
5. Deploy to TestFlight / internal Android track

### Incremental Delivery
- US1 complete → Mobile app available on TestFlight ✅
- US2 complete → Desktop installer available for macOS/Windows ✅
- US3 complete → Native notifications live on all platforms ✅

### Parallel Team Strategy
With multiple developers, once Phase 2 is complete:
- **Developer A** → Phase 3 (US1 Mobile): T008–T015
- **Developer B** → Phase 4 (US2 Desktop): T016–T020
- Both complete → pick up Phase 5 (US3 Notifications): T021–T025
