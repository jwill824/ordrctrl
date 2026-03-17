# Contract: CI Jobs

**File**: `.github/workflows/ci.yml` (modified: `e2e-web` job + `backend-contract` services)  
**File**: `.github/workflows/native.yml` (new: `build-ios`, `build-android`, `maestro-ios`, `maestro-android`)

---

## Overview

This contract defines the new and modified GitHub Actions jobs. The `e2e-web` job was added to
the existing `ci.yml` (alongside postgres+redis services for `backend-contract`). The four native
jobs live in a new `native.yml` workflow with a `paths: ['frontend/**']` trigger filter.

The existing jobs (`backend-unit`, `backend-contract`, `frontend-unit`, `frontend-lint`,
`frontend-build`) are NOT otherwise modified.

---

## Shared Secrets (GitHub Repository Secrets)

| Secret name | Used by |
|------------|--------|
| `E2E_SESSION_COOKIE` | `e2e-web` job |
| `MAESTRO_TEST_EMAIL` | `maestro-ios`, `maestro-android` jobs |
| `MAESTRO_TEST_PASSWORD` | `maestro-ios`, `maestro-android` jobs |

Secrets are injected via `env:` on the relevant step. They are never hardcoded and never
printed to logs (GitHub Actions masks secret values automatically).

---

## Job 1: `e2e-web`

```yaml
e2e-web:
  name: Playwright E2E (Web)
  runs-on: ubuntu-latest
  timeout-minutes: 15
  steps:
    - uses: actions/checkout@v4

    - uses: pnpm/action-setup@v4
      with:
        version: 9

    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'pnpm'

    - run: pnpm install --frozen-lockfile

    - name: Install Playwright browsers
      run: pnpm exec playwright install --with-deps chromium
      working-directory: frontend

    - name: Run Playwright e2e tests
      run: pnpm --filter frontend test:e2e
      env:
        CI: true
        E2E_SESSION_COOKIE: ${{ secrets.E2E_SESSION_COOKIE }}

    - name: Upload Playwright report
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: playwright-report
        path: frontend/playwright-report/
        retention-days: 7
```

**Notes**:
- `CI: true` activates `retries: 2` and `workers: 1` in `playwright.config.ts` (FR-008)
- `--with-deps` installs system libraries needed on Ubuntu for Chromium headless
- Report uploaded on `always()` so failures are diagnosable
- No `needs:` — runs in parallel with all existing jobs (faster feedback)

---

## Job 2: `build-ios`

```yaml
build-ios:
  name: iOS Build (Simulator)
  runs-on: macos-latest
  timeout-minutes: 40
  steps:
    - uses: actions/checkout@v4

    - uses: pnpm/action-setup@v4
      with:
        version: 9

    - uses: actions/setup-node@v4
      with:
        node-version: '22'      # Capacitor CLI requires Node >=22
        cache: 'pnpm'

    - run: pnpm install --frozen-lockfile

    - name: Build frontend (web assets)
      run: pnpm --filter frontend build

    - name: Capacitor sync iOS
      run: pnpm exec cap sync ios
      working-directory: frontend

    - name: Build iOS simulator app
      run: |
        xcodebuild \
          -project ios/App/App.xcodeproj \
          -scheme App \
          -sdk iphonesimulator \
          -configuration Debug \
          CONFIGURATION_BUILD_DIR="$(pwd)/ios/build" \
          build
      working-directory: frontend

    - name: Upload iOS build artifact
      uses: actions/upload-artifact@v4
      with:
        name: ios-simulator-app
        path: frontend/ios/build/App.app
        retention-days: 7
```

**Notes**:
- `-sdk iphonesimulator` eliminates code signing requirement (FR-018)
- This project uses Swift Package Manager (SPM), not CocoaPods — target is `-project ios/App/App.xcodeproj`, not a workspace
- `CONFIGURATION_BUILD_DIR` must be an absolute path (`$(pwd)/ios/build`); relative paths resolve against `SRCROOT` (the Xcode project root), not the shell working directory
- No `needs:` — native jobs self-contain `pnpm --filter frontend build`

---

## Job 3: `build-android`

```yaml
build-android:
  name: Android Build (Debug APK)
  runs-on: ubuntu-latest
  timeout-minutes: 25
  steps:
    - uses: actions/checkout@v4

    - uses: pnpm/action-setup@v4
      with:
        version: 9

    - uses: actions/setup-node@v4
      with:
        node-version: '22'      # Capacitor CLI requires Node >=22
        cache: 'pnpm'

    - uses: actions/setup-java@v4
      with:
        java-version: '21'      # capacitor.build.gradle sets VERSION_21
        distribution: 'temurin'

    - name: Cache Gradle
      uses: actions/cache@v4
      with:
        path: |
          ~/.gradle/caches
          ~/.gradle/wrapper
        key: gradle-${{ hashFiles('frontend/android/**/*.gradle*', 'frontend/android/gradle/wrapper/gradle-wrapper.properties') }}
        restore-keys: gradle-

    - run: pnpm install --frozen-lockfile

    - name: Build frontend (web assets)
      run: pnpm --filter frontend build

    - name: Capacitor sync Android
      run: pnpm exec cap sync android
      working-directory: frontend

    - name: Build debug APK
      run: ./gradlew assembleDebug
      working-directory: frontend/android

    - name: Upload Android APK artifact
      uses: actions/upload-artifact@v4
      with:
        name: android-debug-apk
        path: frontend/android/app/build/outputs/apk/debug/app-debug.apk
        retention-days: 7
```

**Notes**:
- Debug APK requires no signing (FR-018)
- JDK **21** required — `capacitor.build.gradle` (auto-generated by Capacitor) sets `sourceCompatibility JavaVersion.VERSION_21`; JDK 17 causes `invalid source release: 21` error
- Gradle cache key based on `.gradle*` and `gradle-wrapper.properties` for cache invalidation

---

## Job 4: `maestro-ios`

```yaml
maestro-ios:
  name: Maestro E2E (iOS)
  runs-on: macos-latest
  timeout-minutes: 30
  needs: [build-ios]
  env:
    MAESTRO_TEST_EMAIL: ${{ secrets.MAESTRO_TEST_EMAIL }}
    MAESTRO_TEST_PASSWORD: ${{ secrets.MAESTRO_TEST_PASSWORD }}
  steps:
    - uses: actions/checkout@v4

    - name: Download iOS build artifact
      uses: actions/download-artifact@v4
      with:
        name: ios-simulator-app
        path: frontend/ios/build

    - name: Install Maestro
      if: env.MAESTRO_TEST_EMAIL != ''
      run: |
        curl -Ls "https://get.maestro.mobile.dev" | bash
        echo "$HOME/.maestro/bin" >> $GITHUB_PATH

    - name: Boot iOS simulator
      if: env.MAESTRO_TEST_EMAIL != ''
      run: |
        RUNTIME=$(xcrun simctl list runtimes -j | \
          python3 -c "import sys,json; rts=[r for r in json.load(sys.stdin)['runtimes'] if 'iOS' in r['name']]; print(sorted(rts, key=lambda r: r['version'])[-1]['identifier'])")
        UDID=$(xcrun simctl create "MaestroTest" \
          "com.apple.CoreSimulator.SimDeviceType.iPhone-15" "$RUNTIME")
        xcrun simctl boot "$UDID"
        echo "SIMULATOR_UDID=$UDID" >> $GITHUB_ENV
        xcrun simctl install "$UDID" frontend/ios/build/App.app

    - name: Run Maestro flows
      if: env.MAESTRO_TEST_EMAIL != ''
      run: maestro test .maestro/flows/
```

**Notes**:
- Credentials are declared at job-level `env:` (not step-level) so that `if:` conditions can reference them via `env.MAESTRO_TEST_EMAIL`; step-level `env:` is not accessible in `if:` expressions
- All three credential-dependent steps (Install Maestro, Boot simulator, Run flows) carry the same `if:` guard — consistent skip behaviour when no test account is configured
- Dynamic runtime selection (`xcrun simctl list runtimes`) picks the latest available iOS version on the runner rather than hardcoding a version that may be absent

---

## Job 5: `maestro-android`

```yaml
maestro-android:
  name: Maestro E2E (Android)
  runs-on: ubuntu-latest
  timeout-minutes: 40
  needs: [build-android]
  env:
    MAESTRO_TEST_EMAIL: ${{ secrets.MAESTRO_TEST_EMAIL }}
    MAESTRO_TEST_PASSWORD: ${{ secrets.MAESTRO_TEST_PASSWORD }}
  steps:
    - uses: actions/checkout@v4

    - name: Download Android APK artifact
      uses: actions/download-artifact@v4
      with:
        name: android-debug-apk
        path: apk

    - name: Install Maestro
      if: env.MAESTRO_TEST_EMAIL != ''
      run: |
        curl -Ls "https://get.maestro.mobile.dev" | bash
        echo "$HOME/.maestro/bin" >> $GITHUB_PATH

    - name: Run Maestro flows on Android emulator
      if: env.MAESTRO_TEST_EMAIL != ''
      uses: reactivecircus/android-emulator-runner@v2
      with:
        api-level: 33
        arch: x86_64
        target: google_apis
        disable-animations: true
        script: |
          adb install apk/app-debug.apk
          maestro test .maestro/flows/
```

**Notes**:
- Credentials at job-level `env:` (same pattern as `maestro-ios`) — required for `if:` visibility
- Both credential-dependent steps (Install Maestro and Run flows) carry the same `if:` guard — consistent with `maestro-ios`
- `reactivecircus/android-emulator-runner@v2` uses a `uses:` step (not `run:`), so the bash-level skip-guard pattern is not applicable; step-level `if:` is the correct mechanism

---

## Path Filter Strategy

Native build and Maestro jobs should only run when `frontend/**` changes. The recommended
approach for the existing single `ci.yml` file is to use `paths` at the workflow level
in a separate native workflow file (to avoid filtering the existing jobs). Alternatively,
a `paths-filter` action can be used per-job.

**Recommended**: Add a separate `native.yml` workflow for the four native jobs (`build-ios`,
`build-android`, `maestro-ios`, `maestro-android`) with:

```yaml
on:
  push:
    branches: [main]
    paths: ['frontend/**']
  pull_request:
    branches: [main]
    paths: ['frontend/**']
```

The `e2e-web` job stays in `ci.yml` and runs on all PRs (no path filter).

---

## Secrets Setup Checklist

Before the CI jobs can run authenticated tests, provision in GitHub → Settings → Secrets:

- [ ] `E2E_SESSION_COOKIE` — session token for a dedicated e2e test account
- [ ] `MAESTRO_TEST_EMAIL` — email for the Maestro test account
- [ ] `MAESTRO_TEST_PASSWORD` — password for the Maestro test account

All three secrets are optional — jobs skip gracefully when absent (never fail on missing creds).
