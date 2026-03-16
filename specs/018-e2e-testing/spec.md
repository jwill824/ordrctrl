# Feature Specification: End-to-End Testing & Native Build CI

**Feature Branch**: `018-e2e-testing`
**Created**: 2026-03-16
**Status**: Draft
**Closes**: [#12](https://github.com/jwill824/ordrctrl/issues/12), [#56](https://github.com/jwill824/ordrctrl/issues/56)

## Overview

This spec covers two related quality and delivery improvements:

1. **End-to-end test coverage** (#12) — The core user flows through the ordrctrl web app (feed interactions, task management, authentication) have no automated browser-level tests. Existing unit and contract tests validate isolated logic, but a regressions in the assembled UI can go undetected. This work expands the existing e2e test suite to cover the primary task management workflows that users depend on daily.

2. **Native app build CI** (#56) — The iOS and Android app builds currently require manual local execution. There is no automated pipeline that produces build artifacts on push or pull request. This work adds CI workflows so that every change to the codebase verifies the native app builds without developer intervention.

Together these give the team confidence that the web experience and mobile artifacts stay healthy across all future spec implementations.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Feed Task Management Flow (Priority: P1)

A developer pushes a change to the feed. The e2e suite automatically exercises the core task lifecycle: tasks appear in the correct sections, can be completed, dismissed, and restored — and the feed reflects those changes instantly. If any step regresses, the suite catches it before merge.

**Why this priority**: The feed is the primary user surface. Any regression here directly breaks the app's core value. This is the highest-value coverage gap today.

**Independent Test**: Run the e2e suite against a running app with a seeded authenticated session. The feed loads, tasks are visible, and each interaction produces the expected state change.

**Acceptance Scenarios**:

1. **Given** an authenticated user with tasks in their feed, **When** the e2e suite runs, **Then** it verifies that tasks appear in the Upcoming and No Date sections with correct labels
2. **Given** a task in the feed, **When** the user marks it complete via the e2e test, **Then** the task moves to the Completed section
3. **Given** a completed task, **When** the user dismisses it via the e2e test, **Then** it disappears from the main feed and appears in Dismissed Items
4. **Given** a dismissed task, **When** the user restores it via the e2e test, **Then** it returns to the main feed in its original section
5. **Given** a sync-backed task, **When** the user sets a custom title via the e2e test, **Then** the task displays the new title and shows the original title below it

---

### User Story 2 — E2E Suite Runs in CI on Every PR (Priority: P2)

When a pull request is opened or updated, the CI pipeline automatically runs the full e2e suite alongside existing unit and contract tests. Failures block merge. Developers see e2e results in the same place as all other checks.

**Why this priority**: Without CI integration, e2e tests only run when a developer remembers to run them locally. The value of e2e tests comes from running them automatically.

**Independent Test**: Open a pull request against main. Confirm the e2e CI job appears in the checks list, runs to completion, and reports pass/fail status.

**Acceptance Scenarios**:

1. **Given** a pull request is opened, **When** CI triggers, **Then** an e2e test job runs and reports its result on the PR
2. **Given** an e2e test fails, **When** the CI job completes, **Then** the PR is blocked from merging and the failure is visible in the checks panel
3. **Given** all e2e tests pass, **When** the CI job completes, **Then** the PR check is marked green and does not block merge
4. **Given** the e2e suite is running in CI, **When** a test requires an authenticated session, **Then** the suite uses a CI-configured test account credential (not hardcoded secrets)

---

### User Story 3 — Native App Builds Verified in CI on Every PR (Priority: P3)

When a pull request touches the frontend, CI automatically attempts to build the iOS and Android app packages. If the build fails (e.g., a Vite/Capacitor incompatibility), it is caught before the change merges — not discovered later during a manual release.

**Why this priority**: Native builds are currently unverified in automation. A broken build could block a mobile release silently. This is lower priority than web e2e since it affects build artifacts rather than live regressions, but it eliminates the manual verification step from the release process.

**Independent Test**: Open a pull request. Confirm a native build CI job runs for both iOS and Android. Verify the job produces a successful build artifact (or a clear failure message if the build is broken).

**Acceptance Scenarios**:

1. **Given** a pull request touches the frontend, **When** CI triggers, **Then** a native build job runs for the iOS target and reports pass/fail
2. **Given** a pull request touches the frontend, **When** CI triggers, **Then** a native build job runs for the Android target and reports pass/fail
3. **Given** the native build succeeds, **When** the CI job completes, **Then** a compiled app artifact (IPA for iOS, APK for Android) is available as a CI artifact for download
4. **Given** the native build fails, **When** the CI job completes, **Then** the PR check is marked failed and the log clearly identifies the build error

---

### Edge Cases

- What happens when the e2e test environment has no seeded data? → Tests that require tasks must either create their own test data or skip gracefully with a clear message
- What if the e2e suite takes too long in CI and causes timeout? → Suite must complete within a 15-minute CI budget; tests that require live OAuth flows are excluded from CI and documented as local-only
- What if iOS or Android build toolchain is unavailable in CI? → Native build jobs run on the appropriate CI runner type (macOS for iOS); if the runner is unavailable the job queues rather than failing silently
- What if an e2e test is flaky (passes locally, fails in CI intermittently)? → CI is configured with up to 2 automatic retries per test before marking as failed
- What if a secret (test account password) is accidentally logged? → All test credentials are injected via CI environment secrets and never appear in test output or committed files

---

## Requirements *(mandatory)*

### Functional Requirements

**E2E Test Coverage**

- **FR-001**: The e2e suite MUST include tests for the complete feed task lifecycle: view tasks, complete a task, dismiss a task, restore a dismissed task
- **FR-002**: The e2e suite MUST include a test verifying that a sync-backed task title can be overridden and the original title is preserved below it
- **FR-003**: The e2e suite MUST include tests for all authentication flows: sign up form validation, login with wrong credentials, unauthenticated redirect to login, forgot password page load
- **FR-004**: Tests requiring an authenticated session MUST use a CI-injectable credential mechanism (environment variable) and MUST skip gracefully when the credential is not present, rather than failing
- **FR-005**: All e2e tests MUST pass against the locally running app before being merged

**CI — E2E Pipeline**

- **FR-006**: The CI pipeline MUST include an e2e job that runs the full e2e suite on every pull request targeting main
- **FR-007**: A failing e2e test MUST block PR merge
- **FR-008**: The CI e2e job MUST be configured with retry logic (max 2 retries per test) to reduce false-negative failures from transient flakiness
- **FR-009**: The CI e2e job MUST complete within 15 minutes

**CI — Native Build Pipeline**

- **FR-010**: The CI pipeline MUST include a job that builds the iOS native app package on every pull request targeting main
- **FR-011**: The CI pipeline MUST include a job that builds the Android native app package on every pull request targeting main
- **FR-012**: Successful native build jobs MUST produce a downloadable build artifact (IPA for iOS, APK/AAB for Android) attached to the CI run
- **FR-013**: Native build jobs MUST NOT require manual secrets or signing certificates to produce a debug/unsigned build for CI verification purposes
- **FR-014**: A failing native build MUST block PR merge

### Assumptions

- The existing e2e test runner and configuration (already present in the codebase) is used as the foundation — no new test runner is introduced
- iOS builds run on a macOS CI runner; Android builds can run on Linux
- Native builds produce unsigned/debug artifacts for CI verification; production signing is out of scope for this spec
- A dedicated test account for e2e authenticated flows will be provisioned separately; tests are written to skip (not fail) when no test credential is configured
- The existing unit and contract CI jobs are not modified by this spec

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The e2e suite covers all 5 primary feed interactions (view, complete, dismiss, restore, rename) with at least one test each — verified by running the suite against a seeded local environment
- **SC-002**: The CI pipeline runs e2e tests on every PR and the job completes within 15 minutes (measured from job start to final pass/fail status)
- **SC-003**: Native iOS and Android build jobs complete successfully on a clean PR with no manual intervention — verified by opening a test PR and confirming both build artifacts are produced
- **SC-004**: Zero e2e test secrets appear in CI logs or committed files — verified by reviewing CI job output and running a secret-pattern scan against the test files
- **SC-005**: All existing CI jobs (backend unit, backend contract, frontend unit, frontend lint, frontend build) continue to pass after this spec is implemented — no regressions introduced

