# Research: End-to-End Testing & Native Build CI

**Feature**: `018-e2e-testing` | **Phase**: 0 — Research  
**Branch**: `018-e2e-testing`

---

## Summary of Findings

All NEEDS CLARIFICATION items from Technical Context resolved. Five decision areas investigated:
Maestro tooling, Playwright CI integration, iOS unsigned build, Android debug build, and test
credential handling.

---

## Decision 1: Maestro CLI Version & Installation

**Decision**: Install Maestro via the official `curl` script into `~/.maestro/bin`; pin to latest
stable at implementation time (≥ v1.38 recommended).

**Rationale**: The `curl -Ls "https://get.maestro.mobile.dev" | bash` script is the canonical
cross-platform install method documented by mobile.dev. Homebrew tap (`brew tap mobile-dev/tap`)
is also valid on macOS but the curl method works uniformly in CI. No npm package exists as a
first-class install path.

**Alternatives considered**:
- `brew install maestro` — macOS only; unsuitable for Linux CI (Android).
- npm — not a supported primary install mechanism for Maestro CLI.

**Maestro flow directory**: `.maestro/flows/` at repo root — consistent with Maestro docs
convention and keeps native test flows separate from the frontend test tree.

---

## Decision 2: Maestro YAML Flow Format for Capacitor

**Decision**: Use `appId: com.ordrctrl.app` (matching `capacitor.config.ts`) as the top-level
key. Use text-based selectors (`tapOn: { text: ... }`, `assertVisible: { text: ... }`) because
the Capacitor WebView renders HTML — Maestro can locate visible text in the WebView without
native view IDs.

**Environment variable injection**: Maestro supports `${ENV_VAR}` interpolation in flow files.
CI passes `MAESTRO_TEST_EMAIL` / `MAESTRO_TEST_PASSWORD` as GitHub Actions `env:` secrets.
Graceful skip implemented at the CI job level via a bash `if [ -z "$MAESTRO_TEST_EMAIL" ]` gate
before invoking `maestro test`; if credentials are absent the job exits 0 with a skip message.

**Rationale**: Text-based selectors are stable in Capacitor WebViews and require no additional
`testId` attributes on native views. Env-var interpolation is built into Maestro; no custom
scripting needed.

**Alternatives considered**:
- Native `accessibilityId` selectors — require additional native attribute configuration in
  Capacitor bridge; not needed when text is sufficient.
- Per-flow `runFlow: condition` — Maestro does not have a native conditional skip; the CI-level
  gate is simpler and more reliable.

---

## Decision 3: Playwright CI Integration

**Decision**: Use direct `pnpm exec playwright install --with-deps chromium` + `pnpm --filter
frontend test:e2e` steps. Do NOT use `playwright/action@v1` (it does not support pnpm workspaces
or filter commands).

**Authenticated session pattern**: Keep the current per-test `context.addCookies()` pattern
(already implemented in `integrations.spec.ts`). New feed tests will use the same pattern with
`test.skip(!process.env.E2E_SESSION_COOKIE, '...')` at the describe-block level. A `storageState`
setup project is desirable for larger suites but is out of scope here; the existing pattern is
sufficient for the number of tests in this spec.

**Hover pattern for dismiss button**: Call `feedItemLocator.hover()` before asserting or clicking
the `[aria-label="Dismiss item"]` button — required because the dismiss button has Tailwind class
`opacity-0 group-hover:opacity-100`.

**Retry config**: Already set in `playwright.config.ts` (`retries: process.env.CI ? 2 : 0`).
No change needed for FR-008.

**webServer note**: `pnpm dev` as webServer with `reuseExistingServer: !process.env.CI` is
correct. In CI, Playwright starts the server fresh. Port 3000 is the configured dev port; no
conflicts with the existing CI jobs (which all exit before the e2e job, or run in separate
runners).

**Rationale**: Minimal changes to the existing proven Playwright setup. The existing auth and
integrations specs already validate the `E2E_SESSION_COOKIE` skip pattern; feed tests follow
the same convention for consistency.

**Alternatives considered**:
- `wait-on` separate server startup — more reliable for complex setups but unnecessary when
  Playwright's `webServer` already handles port polling.
- `storageState` auth project — cleaner for large suites; deferred as the suite has <20 tests.

---

## Decision 4: iOS Unsigned Build in GitHub Actions

**Decision**: Use `macos-latest` runner. Run `pnpm --filter frontend build` to produce `dist/`,
then `npx cap sync ios` to sync the web assets into the Xcode project, then `xcodebuild` with
`-sdk iphonesimulator` to build a `.app` bundle (simulator target — no signing cert required).

**xcodebuild command**:
```
xcodebuild \
  -workspace frontend/ios/App/App.xcworkspace \
  -scheme App \
  -sdk iphonesimulator \
  -configuration Debug \
  build \
  CONFIGURATION_BUILD_DIR=frontend/ios/build
```

Targeting `iphonesimulator` SDK eliminates code signing entirely — no `CODE_SIGNING_ALLOWED=NO`
override needed (though it may be added defensively). Output is a `.app` directory under
`frontend/ios/build/`, uploaded as a CI artifact.

**Timeout**: `timeout-minutes: 40` — macOS runners are ~2× slower than Linux for builds;
iOS Xcode build with a full workspace typically takes 15–25 minutes on a clean cache.

**Rationale**: Simulator builds require no developer certificate and no provisioning profile.
This exactly satisfies FR-018 ("MUST NOT require manual secrets or signing certificates").

**Alternatives considered**:
- `CODE_SIGNING_ALLOWED=NO` flag — redundant when targeting `iphonesimulator`; kept as a
  defensive option if the build environment has a stale signing config.
- Ionic capacitor build action — no maintained GitHub Action for Capacitor iOS builds exists;
  direct `xcodebuild` is the correct approach.
- `macos-14` (Apple Silicon) — `macos-latest` resolves to a recent macOS version; `macos-14`
  is pinnable but not required here.

---

## Decision 5: Android Debug APK in GitHub Actions

**Decision**: Use `ubuntu-latest` runner. Run `pnpm --filter frontend build`, `npx cap sync
android`, then `./gradlew assembleDebug` inside `frontend/android/`. Requires `actions/setup-java@v4`
with `java-version: '17'` and `distribution: 'temurin'`.

**Artifact path**: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

**Timeout**: `timeout-minutes: 25` — Gradle first-run downloads dependencies; subsequent runs
with cache are ~8 minutes. 25 minutes is safe.

**Gradle cache**: Cache `~/.gradle/caches` and `~/.gradle/wrapper` via `actions/cache@v4` to
significantly reduce build times on repeat runs.

**Rationale**: Android builds run entirely on Linux (no macOS runner needed), making them cheaper
and faster. `temurin` JDK 17 is the LTS version compatible with the Android Gradle plugin used
by Capacitor 8.

**Alternatives considered**:
- `ubuntu-20.04` — older Ubuntu; `ubuntu-latest` (22.04/24.04) has better toolchain support.
- JDK 21 — Capacitor 8 Android plugin targets JDK 17 compatibility; upgrading to 21 is safe
  but untested and not required.

---

## Decision 6: Maestro Native Tests in CI (iOS simulator)

**Decision**: Boot an iOS simulator using `xcrun simctl` on the macOS runner before running
Maestro. Use iPhone 15 / iOS 17 (or the highest available on the runner).

**Simulator boot sequence**:
```bash
UDID=$(xcrun simctl create "iPhone15Test" \
  "com.apple.CoreSimulator.SimDeviceType.iPhone-15" \
  $(xcrun simctl list runtimes -j | jq -r '.runtimes[] | select(.name | contains("iOS 17")) | .identifier' | head -1))
xcrun simctl boot "$UDID"
xcrun simctl install "$UDID" frontend/ios/build/App.app
```

**Android Maestro**: Run on `ubuntu-latest` using `reactivecircus/android-emulator-runner@v2`
with `api-level: 33`, `arch: x86_64`, `target: google_apis`. The emulator runner wraps the
Maestro test invocation as its `script:` step.

**Job dependency**: Both Maestro jobs `needs: [build-ios]` / `needs: [build-android]` —
Maestro tests consume the build artifacts produced by the native build jobs.

**Rationale**: Reusing the `.app` built by the iOS build job avoids rebuilding. The
`android-emulator-runner` action is the community standard for Android emulator CI.

**Alternatives considered**:
- Firebase Test Lab / BrowserStack — out of scope (paid services, additional setup complexity).
- Run Maestro on physical devices — not feasible in standard GitHub-hosted runners.

---

## Decision 7: CI Job Structure & Path Filters

**Decision**: Add four new jobs to `.github/workflows/ci.yml`:
1. `e2e-web` — Playwright, `ubuntu-latest`, no `needs:` (runs in parallel with existing jobs)
2. `build-ios` — Xcode simulator build, `macos-latest`, `needs: [frontend-build]`
3. `build-android` — Gradle debug, `ubuntu-latest`, `needs: [frontend-build]`
4. `maestro-ios` — Maestro on iOS simulator, `macos-latest`, `needs: [build-ios]`
5. `maestro-android` — Maestro on Android emulator, `ubuntu-latest`, `needs: [build-android]`

**Path filter**: Native build and Maestro jobs filtered with `paths: ['frontend/**']` to avoid
running expensive macOS jobs on backend-only changes. The `e2e-web` job runs on all PRs (the
web app could be affected by backend API changes).

**Rationale**: `e2e-web` has no dependency on native builds and should run fast (ubuntu-latest,
~10 minutes). Native jobs are expensive and should only trigger when the frontend changes.

**Alternatives considered**:
- Separate workflow file for native jobs — cleaner isolation but requires duplication of
  checkout/pnpm setup steps; single `ci.yml` preferred for visibility.
- Run all jobs on every PR regardless of path — too slow; macOS runners are expensive.
