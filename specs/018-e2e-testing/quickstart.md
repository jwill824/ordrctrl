# Quickstart: End-to-End Testing & Native Build CI

**Feature**: `018-e2e-testing` | **Branch**: `018-e2e-testing`

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20 | `nvm use 20` or [nodejs.org](https://nodejs.org) |
| pnpm | 9 | `npm install -g pnpm@9` |
| Playwright (chromium) | 1.42 | `cd frontend && pnpm exec playwright install --with-deps chromium` |
| Maestro CLI | ≥ v1.38 | `curl -Ls "https://get.maestro.mobile.dev" \| bash` |
| Xcode | 15+ (macOS only) | Mac App Store |
| Android Studio / SDK | Any (for Android) | [developer.android.com](https://developer.android.com/studio) |

---

## 1. Run Playwright Web E2E Tests Locally

### Unauthenticated tests (no setup required)

Auth flow tests (auth.spec.ts) and redirect tests run without any credentials:

```bash
cd frontend
pnpm test:e2e
```

Expected: ~8 auth tests + ~2 integration tests pass. Feed interaction tests skip with
message `E2E_SESSION_COOKIE not set`.

### Authenticated tests (requires session cookie)

1. **Start the app** locally and log in to a test account via the browser
2. **Get the session cookie** from DevTools → Application → Cookies → `sessionId`
3. **Run with the cookie**:

```bash
cd frontend
E2E_SESSION_COOKIE=<paste-value-here> pnpm test:e2e
```

Or create a `.env.e2e.local` file (gitignored) and use `dotenv-cli`:

```bash
# .env.e2e.local (DO NOT commit)
E2E_SESSION_COOKIE=<your-session-token>
```

```bash
cd frontend
dotenv -e .env.e2e.local -- pnpm test:e2e
```

### Run only feed tests

```bash
cd frontend
E2E_SESSION_COOKIE=<token> pnpm exec playwright test --grep "Feed interactions"
```

### View test report

```bash
cd frontend
pnpm exec playwright show-report
```

---

## 2. Run Maestro Native E2E Tests Locally

### iOS (macOS only)

**Step 1**: Build the iOS simulator app

```bash
# From repo root
pnpm --filter frontend build
cd frontend
pnpm exec cap sync ios
xcodebuild \
  -workspace ios/App/App.xcworkspace \
  -scheme App \
  -sdk iphonesimulator \
  -configuration Debug \
  CONFIGURATION_BUILD_DIR=ios/build \
  build
```

**Step 2**: Boot a simulator and install the app

```bash
# List available simulators
xcrun simctl list devices

# Boot an iPhone 15 (use UDID from list above)
xcrun simctl boot <UDID>

# Install the app
xcrun simctl install <UDID> frontend/ios/build/App.app

# Open Simulator.app to see it
open -a Simulator
```

**Step 3**: Run Maestro flows

```bash
# From repo root
export MAESTRO_TEST_EMAIL=test@example.com
export MAESTRO_TEST_PASSWORD=YourTestPass1

maestro test .maestro/flows/
```

Run a single flow:

```bash
maestro test .maestro/flows/auth.yaml
```

### Android

**Step 1**: Build the debug APK

```bash
pnpm --filter frontend build
cd frontend
pnpm exec cap sync android
cd android
./gradlew assembleDebug
# APK at: frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

**Step 2**: Start an Android emulator (from Android Studio or CLI)

```bash
# List available AVDs
emulator -list-avds

# Start an emulator
emulator -avd <avd-name> &

# Wait for boot
adb wait-for-device

# Install the APK
adb install frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

**Step 3**: Run Maestro flows

```bash
export MAESTRO_TEST_EMAIL=test@example.com
export MAESTRO_TEST_PASSWORD=YourTestPass1

maestro test .maestro/flows/
```

---

## 3. CI Pipeline

The CI pipeline runs automatically on every PR. No manual steps needed.

### What runs on every PR

| Job | Trigger | Duration |
|-----|---------|---------|
| `e2e-web` | All PRs | ~10 min |
| `backend-unit` | All PRs | ~5 min |
| `frontend-unit` | All PRs | ~5 min |
| _(others)_ | All PRs | ~5 min each |

### What runs only when `frontend/**` changes

| Job | Duration |
|-----|---------|
| `build-ios` | ~35 min |
| `build-android` | ~20 min |
| `maestro-ios` | ~25 min |
| `maestro-android` | ~35 min |

### Downloading CI build artifacts

After a CI run completes:
1. Go to GitHub → Actions → the run
2. Scroll to "Artifacts"
3. Download `ios-simulator-app` (.app) or `android-debug-apk` (.apk)

---

## 4. Secrets Setup (first-time CI)

For authenticated tests to run in CI, provision these secrets in GitHub:
**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|--------|-------|
| `E2E_SESSION_COOKIE` | Session token from a dedicated e2e test account |
| `MAESTRO_TEST_EMAIL` | Email of the Maestro test account |
| `MAESTRO_TEST_PASSWORD` | Password of the Maestro test account |

**Important**: Use a dedicated test account — not a personal account. Tests are destructive
(they complete/dismiss/restore tasks in the feed).

If secrets are not provisioned, authenticated tests skip gracefully — they do not fail the CI
check. Unauthenticated tests (auth redirects, login form validation) always run.

---

## 5. Troubleshooting

### Playwright: "page.goto caused net::ERR_CONNECTION_REFUSED"
The dev server didn't start. Check the `webServer` output:
```bash
cd frontend
pnpm dev &  # Start server first, then run tests
pnpm test:e2e
```

### Playwright: "Cannot find module '@playwright/test'"
Run `pnpm install` from the repo root first.

### Playwright: all feed tests skip
Expected — `E2E_SESSION_COOKIE` is not set. Provide it as described in section 1.

### Maestro: "command not found: maestro"
Add Maestro to PATH:
```bash
export PATH=$PATH:$HOME/.maestro/bin
```
Or add it to your shell profile (`.zshrc`, `.bashrc`).

### Maestro: "App not installed"
The simulator/emulator app installation step was skipped or failed. Re-run the install step.

### iOS xcodebuild: "No scheme found"
Run `pnpm exec cap sync ios` first to ensure the Xcode project is up to date.

### Android Gradle: "SDK not found"
Set `ANDROID_HOME` or `ANDROID_SDK_ROOT`:
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools
```
