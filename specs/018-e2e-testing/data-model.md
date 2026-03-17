# Data Model: End-to-End Testing & Native Build CI

**Feature**: `018-e2e-testing` | **Phase**: 1 — Design  
**Branch**: `018-e2e-testing`

---

## Overview

This feature adds test infrastructure, not domain models. The "data model" here describes:

1. **Test session model** — the authenticated state shape e2e tests depend on
2. **Feed item test expectations** — the UI state machine tests drive and assert
3. **Maestro flow state machine** — native app states and transitions under test
4. **CI job dependency graph** — the execution model for new CI jobs

---

## 1. Test Session Model

### E2E Session Cookie

Playwright tests that require an authenticated user inject a session cookie into the browser
context. The cookie shape expected by the running app:

```
name:     sessionId
value:    <opaque session token from backend>
domain:   localhost
path:     /
httpOnly: true
secure:   false   (localhost; true in production)
sameSite: Lax
```

**Source**: `E2E_SESSION_COOKIE` environment variable — injected from GitHub Actions secret in
CI, set manually in developer `.env.local` for local runs.

**Skip guard**: Every authenticated test block checks `process.env.E2E_SESSION_COOKIE` at
describe-block level and calls `test.skip()` when absent. Tests never fail on missing
credentials — they skip with a descriptive message.

### Maestro Test Credentials

Maestro native flows use environment variable interpolation (`${MAESTRO_TEST_EMAIL}`,
`${MAESTRO_TEST_PASSWORD}`) for the test account. The CI job-level guard:

```bash
if [ -z "$MAESTRO_TEST_EMAIL" ]; then
  echo "⚠️  MAESTRO_TEST_EMAIL not configured — skipping Maestro tests"
  exit 0
fi
maestro test .maestro/flows/
```

---

## 2. Feed Item UI State Machine

The Playwright feed tests drive the `FeedItem` component through the following state transitions.
Each arrow represents an e2e test action + assertion.

```
                 ┌──────────────────────────────────────────────────────────┐
                 │                    Feed Page States                       │
                 └──────────────────────────────────────────────────────────┘

  [Task visible in "Upcoming" or "No Date" section]
        │
        ├─── click checkbox (aria-label="Mark complete")
        │         └──> task moves to "Completed" section (line-through + opacity-50)
        │                   │
        │                   └─── click checkbox again (aria-label="Reopen task")
        │                             └──> task returns to original section
        │
        ├─── hover item → click "Dismiss item" (aria-label="Dismiss item", opacity-0→opacity-100)
        │         └──> task disappears from feed
        │              navigate to /feed?showDismissed=true
        │                   └──> task appears in "Dismissed" section
        │                             │
        │                             └─── click "Restore" (aria-label="Restore item")
        │                                       └──> task returns to main feed
        │
        └─── click task row (onClick handler on content div)
                  └──> EditTaskModal opens (id="edit-title" input present)
                            │
                            ├─── type new title → save
                            │         └──> task displays new title
                            │              original title shown below as secondary text
                            │
                            └─── clear title (empty) → save
                                      └──> task reverts to original synced title (null override)
```

### Key Selectors (stable DOM anchors for tests)

| Interaction | Selector Strategy | Selector |
|-------------|------------------|----------|
| Complete task | `aria-label` | `[aria-label="Mark complete"]` |
| Reopen task | `aria-label` | `[aria-label="Reopen task"]` |
| Dismiss task | `aria-label` + hover | `[aria-label="Dismiss item"]` (requires `.hover()` first) |
| Restore task | `aria-label` | `[aria-label="Restore item"]` |
| Open edit modal | click content div | task content area (`.cursor-pointer` div) |
| Title input in modal | `id` | `#edit-title` |
| Save in modal | button text | `button:has-text("Save")` |
| Close modal | `aria-label` | `[aria-label="Close"]` |
| Clear completed | `aria-label` | `[aria-label="Clear all completed tasks"]` |
| Upcoming section | section label text | `text=UPCOMING` (uppercase, small-caps label) |
| No Date section | section label text | `text=NO DATE` |
| Completed section | button text | `button:has-text("Completed")` (collapsible toggle) |
| Dismissed view | URL param | `/feed?showDismissed=true` |

### Section Visibility Rules

| Section | Shown when | URL |
|---------|-----------|-----|
| Upcoming | `datedItems.length > 0` and `!showDismissed` | `/feed` |
| No Date | `undatedItems.length > 0` and `!showDismissed` | `/feed` |
| Completed | `completed.length > 0` and `!showDismissed` | `/feed` |
| Dismissed | `showDismissed === true` | `/feed?showDismissed=true` |

---

## 3. Maestro Flow State Machine

Three Maestro flows cover the native app. Each flow is a separate YAML file in `.maestro/flows/`.

```
Flow 1: auth.yaml
─────────────────
[App not running]
  → launchApp (com.ordrctrl.app)
  → assertVisible: "Sign In" (or "Log in") button
  → tapOn email field → inputText ${MAESTRO_TEST_EMAIL}
  → tapOn password field → inputText ${MAESTRO_TEST_PASSWORD}
  → tapOn "Sign In"
  → assertVisible: "ordrctrl" header (confirms feed loaded)

Flow 2: feed-load.yaml
──────────────────────
[Authenticated session from auth.yaml state]
  → assertVisible: "ordrctrl" header
  → assertVisible: at least one feed item (text-based scan or section label)
  → waitForAnimationToEnd

Flow 3: task-complete.yaml
──────────────────────────
[Authenticated session, at least one task visible]
  → tapOn: first task's checkbox (coordinate or text-adjacent icon)
  → assertVisible: "Completed" section label
  → (Optional) tapOn "Completed" to expand
  → assertVisible: completed task title in expanded section
```

### Maestro File: `appId` and Runtime Environment

| Property | Value |
|----------|-------|
| `appId` (iOS) | `com.ordrctrl.app` |
| `appId` (Android) | `com.ordrctrl.app` |
| iOS simulator | iPhone 15, iOS 17 (highest available on `macos-latest`) |
| Android emulator | API 33, x86_64, `google_apis` target |
| Credential env vars | `MAESTRO_TEST_EMAIL`, `MAESTRO_TEST_PASSWORD` |

---

## 4. CI Job Dependency Graph

```
  [push / pull_request → main]
         │
         ├── backend-unit          (ubuntu-latest) ──────────────────────── no deps
         ├── backend-contract      (ubuntu-latest) ──────────────────────── no deps
         ├── frontend-unit         (ubuntu-latest) ──────────────────────── no deps
         ├── frontend-lint         (ubuntu-latest) ──────────────────────── no deps
         ├── frontend-build        (ubuntu-latest) ──────────────────────── no deps
         │
         ├── e2e-web               (ubuntu-latest) ──────────────────────── no deps
         │   runs: Playwright chromium, pnpm --filter frontend test:e2e
         │   timeout: 15 min | path filter: none (all PRs)
         │
         ├── build-ios             (macos-latest)  ← needs: frontend-build
         │   runs: cap sync ios + xcodebuild -sdk iphonesimulator
         │   timeout: 40 min | path filter: frontend/**
         │   artifact: App.app (simulator build)
         │
         ├── build-android         (ubuntu-latest) ← needs: frontend-build
         │   runs: cap sync android + ./gradlew assembleDebug
         │   timeout: 25 min | path filter: frontend/**
         │   artifact: app-debug.apk
         │
         ├── maestro-ios           (macos-latest)  ← needs: build-ios
         │   runs: boot simulator + install .app + maestro test flows/
         │   timeout: 30 min | path filter: frontend/**
         │
         └── maestro-android       (ubuntu-latest) ← needs: build-android
             runs: android-emulator-runner + install APK + maestro test flows/
             timeout: 40 min | path filter: frontend/**
```

### Job Properties Summary

| Job | Runner | Timeout | Needs | Path Filter | Artifact |
|-----|--------|---------|-------|-------------|---------|
| `e2e-web` | ubuntu-latest | 15 min | — | none | playwright-report/ (on failure) |
| `build-ios` | macos-latest | 40 min | frontend-build | `frontend/**` | `App.app` |
| `build-android` | ubuntu-latest | 25 min | frontend-build | `frontend/**` | `app-debug.apk` |
| `maestro-ios` | macos-latest | 30 min | build-ios | `frontend/**` | — |
| `maestro-android` | ubuntu-latest | 40 min | build-android | `frontend/**` | — |
