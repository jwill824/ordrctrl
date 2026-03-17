# Tasks: End-to-End Testing & Native Build CI

**Input**: Design documents from `/specs/018-e2e-testing/`  
**Branch**: `018-e2e-testing`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Exact file paths are included in every task description

---

## Phase 1: Setup

**Purpose**: Create the directory structure and verify CI-aware Playwright configuration before any tests are written.

- [x] T001 Create `.maestro/flows/` directory structure at repo root (`.maestro/flows/.gitkeep`)
- [x] T002 [P] Verify `frontend/playwright.config.ts` sets `retries: 2` and `workers: 1` when `CI=true` (FR-008); update if missing

---

## Phase 2: User Story 1 — Feed Task Management Flow (Priority: P1) 🎯 MVP

**Goal**: Five Playwright tests cover the complete feed task lifecycle — view, complete, dismiss, restore, and rename — using stable ARIA selectors from the playwright-feed-contract.

**Independent Test**: `E2E_SESSION_COOKIE=<token> pnpm --filter frontend test:e2e --grep "Feed interactions"` — all five test cases pass; suite skips gracefully when cookie is absent.

- [x] T003 [US1] Create `frontend/tests/e2e/feed.spec.ts` scaffold: `test.describe` block, `test.skip` guard on missing `E2E_SESSION_COOKIE`, and `beforeEach` cookie injection via `context.addCookies` (per playwright-feed-contract.md preconditions)
- [x] T004 [US1] Implement TC-F01 (tasks visible in feed sections) in `frontend/tests/e2e/feed.spec.ts`: navigate to `/feed`, assert `text=/upcoming/i` or `text=/no date/i` visible, assert at least one `[aria-label="Mark complete"]` present
- [x] T005 [US1] Implement TC-F02 (complete a task) in `frontend/tests/e2e/feed.spec.ts`: click first `[aria-label="Mark complete"]`, assert `button:has-text("Completed")` becomes visible
- [x] T006 [US1] Implement TC-F03 (dismiss a task) in `frontend/tests/e2e/feed.spec.ts`: hover task row, click `[aria-label="Dismiss item"]`, assert task count decreases in main feed
- [x] T007 [US1] Implement TC-F04 (restore a dismissed task) in `frontend/tests/e2e/feed.spec.ts`: navigate to `/feed?showDismissed=true`, click `[aria-label="Restore item"]`, navigate to `/feed`, assert task visible in main feed
- [x] T008 [US1] Implement TC-F05 (rename a task / title override) in `frontend/tests/e2e/feed.spec.ts`: click task content area, fill `#edit-title` with "Custom Title", click `button:has-text("Save")`, assert task displays "Custom Title" and original title visible as secondary text

**Checkpoint**: Feed test suite passes locally with a seeded session cookie (SC-001).

---

## Phase 3: User Story 2 — E2E Suite Runs in CI on Every PR (Priority: P2)

**Goal**: Every pull request targeting `main` runs the full Playwright e2e suite automatically. Failures block merge. The job completes within the 15-minute budget.

**Independent Test**: Open a PR and confirm the `e2e-web` check appears, runs, and reports pass/fail status in the checks panel.

- [x] T009 [US2] Add `e2e-web` job to `.github/workflows/ci.yml` per ci-jobs-contract.md Job 1: `ubuntu-latest`, `timeout-minutes: 15`, pnpm install, `playwright install --with-deps chromium`, `pnpm --filter frontend test:e2e` with `E2E_SESSION_COOKIE` secret, upload `playwright-report/` artifact on `always()`

**Checkpoint**: A draft PR confirms `e2e-web` job appears in CI checks and completes within 15 minutes (FR-006, FR-007, FR-009, SC-002).

---

## Phase 4: User Story 3 — Native Mobile E2E Tests with Maestro (Priority: P3)

**Goal**: Three Maestro YAML flows cover auth, feed load, and task completion on the Capacitor native app. CI jobs run these flows on iOS and Android simulators on every PR.

**Independent Test**: `maestro test .maestro/flows/` against a running iOS or Android simulator with `MAESTRO_TEST_EMAIL`/`MAESTRO_TEST_PASSWORD` set — app launches, authenticates, feed loads, task completes (SC-003).

- [x] T010 [P] [US3] Create `.maestro/flows/auth.yaml`: `clearState`, `launchApp` (`com.ordrctrl.app`), assert "Sign In" and "Email" visible, `inputText ${MAESTRO_TEST_EMAIL}`, `inputText ${MAESTRO_TEST_PASSWORD}`, tap "Sign In", assert "ordrctrl" header visible (FR-010, FR-011, per maestro-flows-contract.md Flow 1)
- [x] T011 [P] [US3] Create `.maestro/flows/feed-load.yaml`: `launchApp`, assert "ordrctrl" header, `waitForAnimationToEnd`, assert "UPCOMING" (`optional: true`) and "NO DATE" (`optional: true`) (FR-011, per maestro-flows-contract.md Flow 2)
- [x] T012 [P] [US3] Create `.maestro/flows/task-complete.yaml`: `launchApp`, `waitForAnimationToEnd`, assert "ordrctrl" header, `tapOn` accessibility id "Mark complete", `waitForAnimationToEnd`, assert "Completed" visible (FR-012, per maestro-flows-contract.md Flow 3)

**Checkpoint**: All three Maestro flows pass locally on an iOS or Android simulator with test credentials (SC-003).

---

## Phase 5: User Story 4 — Native App Build Artifacts Produced in CI (Priority: P4)

**Goal**: CI produces a signed iOS simulator `.app` and a debug Android APK as downloadable artifacts on every PR touching `frontend/`. Build failures block merge. Maestro jobs run against these artifacts.

**Independent Test**: Open a PR touching `frontend/`. Confirm `build-ios`, `build-android`, `maestro-ios`, and `maestro-android` all appear in CI checks. Both build artifacts download successfully.

- [x] T013 [US4] Create `.github/workflows/native.yml` with `on:` trigger (`push`/`pull_request` to `main`, `paths: ['frontend/**']`) and `build-ios` job: `macos-latest`, `timeout-minutes: 40`, `node-version: '22'` (Capacitor CLI requires ≥22), `pnpm --filter frontend build`, `cap sync ios`, `xcodebuild -project ios/App/App.xcodeproj -sdk iphonesimulator -configuration Debug CONFIGURATION_BUILD_DIR="$(pwd)/ios/build"` (absolute path — SPM project, not workspace; relative path resolves against SRCROOT), upload `frontend/ios/build/App.app` artifact as `ios-simulator-app` (FR-015, FR-017, FR-018, per ci-jobs-contract.md Job 2)
- [x] T014 [US4] Add `build-android` job to `.github/workflows/native.yml`: `ubuntu-latest`, `timeout-minutes: 25`, `node-version: '22'` (Capacitor CLI requires ≥22), `setup-java@v4` (temurin JDK **21** — `capacitor.build.gradle` sets `VERSION_21`), Gradle cache, `cap sync android`, `./gradlew assembleDebug`, upload `app-debug.apk` artifact as `android-debug-apk` (FR-016, FR-017, FR-018, per ci-jobs-contract.md Job 3)
- [x] T015 [US4] Add `maestro-ios` job to `.github/workflows/native.yml`: `macos-latest`, `timeout-minutes: 30`, `needs: [build-ios]`, job-level `env:` for `MAESTRO_TEST_EMAIL`/`MAESTRO_TEST_PASSWORD` (required so `if:` conditions can reference them), download `ios-simulator-app` artifact, `if: env.MAESTRO_TEST_EMAIL != ''` guard on Install Maestro + Boot iOS simulator + Run Maestro flows steps (all three gated), boot iOS simulator via `xcrun simctl`, install app, run `maestro test .maestro/flows/` (FR-014, per ci-jobs-contract.md Job 4)
- [x] T016 [US4] Add `maestro-android` job to `.github/workflows/native.yml`: `ubuntu-latest`, `timeout-minutes: 40`, `needs: [build-android]`, job-level `env:` for credentials (mirrors iOS pattern), download `android-debug-apk` artifact, `if: env.MAESTRO_TEST_EMAIL != ''` guard on Install Maestro step (consistent with iOS), `reactivecircus/android-emulator-runner@v2` (API 33, `google_apis`) with same `if:` guard, `adb install`, `maestro test .maestro/flows/` (FR-014, per ci-jobs-contract.md Job 5)

**Checkpoint**: A test PR produces both build artifacts and native CI jobs appear in checks (SC-004).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T017 [P] Validate all quickstart.md scenarios locally: unauthenticated Playwright tests skip feed tests, authenticated run passes TC-F01–TC-F05, Maestro flows pass on simulator; verify no existing CI jobs (`backend-unit`, `backend-contract`, `frontend-unit`, `frontend-lint`, `frontend-build`) are modified (SC-006)
- [x] T018 [P] Run secret-pattern scan across `frontend/tests/e2e/` and `.maestro/flows/` to confirm zero hardcoded credentials; verify `E2E_SESSION_COOKIE`, `MAESTRO_TEST_EMAIL`, `MAESTRO_TEST_PASSWORD` appear only as `process.env.*` or Maestro `${VAR}` interpolation, never as literal values (SC-005, FR-004, FR-013)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **US1 (Phase 2)**: Depends on Phase 1 completion (playwright.config.ts verified)
- **US2 (Phase 3)**: Depends on US1 completion (feed.spec.ts must exist before CI job is useful)
- **US3 (Phase 4)**: Independent of US1/US2 — Maestro YAML files can be written any time after Phase 1
- **US4 (Phase 5)**: Depends on US3 completion (maestro jobs need flow files to exist)
- **Polish (Phase 6)**: Depends on all phases complete

### User Story Dependencies

- **US1 (P1)**: Depends only on Phase 1 — no cross-story dependencies
- **US2 (P2)**: Depends on US1 — e2e-web job is only meaningful with feed.spec.ts present
- **US3 (P3)**: Can start concurrently with US1/US2 after Phase 1 — Maestro flows are independent files
- **US4 (P4)**: Depends on US3 — Maestro CI jobs reference `.maestro/flows/`

### Within Each User Story

- US1: T003 scaffold first → T004–T008 build on the scaffold (same file, sequential)
- US2: T009 single task
- US3: T010, T011, T012 are fully parallel (different files, no dependencies between flows)
- US4: T013 creates file → T014–T016 are sequential additions to the same file

---

## Parallel Opportunities

### Phase 1 (Setup)

```
T001 (create .maestro/flows/)    T002 (verify playwright.config.ts)
         ↓                                      ↓
    both complete → proceed to user stories
```

### Phase 4 (US3 — Maestro flows)

```
T010 (auth.yaml)    T011 (feed-load.yaml)    T012 (task-complete.yaml)
       ↓                     ↓                         ↓
  all three complete → proceed to US4 (native.yml)
```

### Phase 6 (Polish)

```
T017 (quickstart validation)    T018 (secret-pattern scan)
              ↓                              ↓
         both complete → spec 018 done
```

### Cross-Phase Parallel

US3 (T010–T012) can be worked in parallel with US1 (T003–T008) and US2 (T009) — all target different files.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: User Story 1 (T003–T008)
3. **STOP and VALIDATE**: Run `E2E_SESSION_COOKIE=<token> pnpm --filter frontend test:e2e` — all 5 feed tests pass
4. Proceed to US2 for CI integration

### Incremental Delivery

1. **Phase 1** → Directory + config ready
2. **Phase 2 (US1)** → Feed tests pass locally → MVP validation (SC-001)
3. **Phase 3 (US2)** → Feed tests run in CI → SC-002 verified
4. **Phase 4 (US3)** → Maestro flows pass on simulator → SC-003 verified
5. **Phase 5 (US4)** → Native builds + Maestro in CI → SC-004 verified
6. **Phase 6** → SC-005, SC-006 verified → spec complete

### Parallel Team Strategy

With two developers after Phase 1:
- **Developer A**: US1 (T003–T008) → US2 (T009)
- **Developer B**: US3 (T010–T012) → US4 (T013–T016)

Both streams converge at Phase 6 polish.

---

## Notes

- `[P]` tasks operate on different files with no incomplete-task dependencies — safe to parallelize
- `[Story]` label maps each task to its user story for traceability to spec.md acceptance scenarios
- All authenticated tests skip (never fail) when credentials absent — FR-004, FR-013
- No existing CI jobs are modified — SC-006; `e2e-web` added to `ci.yml`; native jobs go in new `native.yml`
- Native builds are unsigned/debug only — FR-018; no production signing certificates required
- Commit after each task or logical group; validate each story's checkpoint before proceeding
