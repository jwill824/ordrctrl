# Feature Specification: GitHub Actions CI Pipeline

**Feature Branch**: `006-ci-testing`  
**Created**: 2026-03-10  
**Status**: Draft  
**Input**: Add GitHub Actions CI pipeline for automated testing on every pull request and push to main. Run backend unit and contract tests, frontend lint, and build verification. Surface test failures as PR checks. Fix the 15 pre-existing test failures currently in integration.service and apple-calendar tests.

## Overview

Every code change to ordrctrl must pass a set of automated quality gates before it can be merged. Currently, tests run only manually on a developer's machine — meaning failures can be merged undetected, and contributors have no shared signal about code health. This feature establishes a continuous integration (CI) pipeline that runs on every pull request and every push to the main branch, surfacing failures as required PR status checks. It also resolves the 15 pre-existing test failures that currently pollute the test output on every run.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Automated checks on every pull request (Priority: P1)

A developer opens a pull request. Without any manual action, the CI pipeline automatically runs all backend tests, frontend lint, and a frontend build check. If any check fails, the PR is blocked from merging and the failure is shown inline on the PR page with enough detail to diagnose the problem.

**Why this priority**: This is the entire purpose of the feature. Without automated PR checks, all other work in this spec has no effect on the development workflow.

**Independent Test**: Open a PR with a deliberate test failure → verify the PR shows a failing status check and cannot be merged → fix the failure → verify all checks go green and the PR is mergeable.

**Acceptance Scenarios**:

1. **Given** a developer opens a pull request, **When** the PR is created or updated with new commits, **Then** the CI pipeline starts automatically within 60 seconds.
2. **Given** the CI pipeline is running, **When** all backend tests pass, frontend lint passes, and frontend build succeeds, **Then** all PR status checks show green and the PR is eligible to merge.
3. **Given** a pull request with a failing backend test, **When** the CI pipeline runs, **Then** the PR status check shows red and the failure message identifies the specific failing test.
4. **Given** a pull request with a lint error, **When** the CI pipeline runs, **Then** the PR status check shows red and the failure message identifies the file and line with the lint error.
5. **Given** a developer pushes a fix to the PR branch, **When** CI re-runs, **Then** previously failing checks update to green upon success.

---

### User Story 2 — CI runs on push to main (Priority: P2)

After merging to main, the CI pipeline runs again on the merged commit. This catches any integration issues that may arise from the merge itself and keeps main always in a known-good state.

**Why this priority**: PR checks alone don't catch merge conflicts or issues introduced by merging multiple PRs. Running on main ensures the branch is always deployable.

**Independent Test**: Merge a PR to main → verify the CI pipeline triggers on the main branch commit → verify all checks pass.

**Acceptance Scenarios**:

1. **Given** a pull request is merged to main, **When** the merge commit is pushed, **Then** the CI pipeline runs automatically on the main branch.
2. **Given** the main branch CI run completes, **When** all checks pass, **Then** the main branch is confirmed healthy and ready for deployment.
3. **Given** the main branch CI run fails (e.g., from a bad merge), **When** the failure is detected, **Then** the failure is visible in the repository's Actions tab with enough detail to diagnose.

---

### User Story 3 — Pre-existing test failures resolved (Priority: P2)

The 15 currently failing tests in `integration.service.test.ts` and `apple-calendar.sync.test.ts` are fixed so the test suite reports a clean baseline. CI enforces a zero-failure policy from this point forward.

**Why this priority**: CI is only useful if a green baseline exists. Without fixing the pre-existing failures, the CI pipeline would always show red — making it useless as a signal and training developers to ignore it.

**Independent Test**: Run the full backend test suite locally → verify 0 failures → push to a PR → verify CI reports all tests passing.

**Acceptance Scenarios**:

1. **Given** the full backend test suite runs (unit + contract), **When** all tests complete, **Then** 0 tests fail and the suite exits with a success code.
2. **Given** a new PR is opened, **When** CI runs the fixed test suite, **Then** all backend test checks show green with no pre-existing failures masking real regressions.

---

### User Story 4 — Developer can view test results without reading logs (Priority: P3)

Test results are surfaced in a way that lets developers understand what passed and failed without scrolling through raw log output.

**Why this priority**: Good DX accelerates feedback loops. While not blocking, clear result summaries reduce the time it takes to diagnose a CI failure.

**Independent Test**: Trigger a failing CI run → view the PR checks tab → identify the failing test name, file, and error message without opening the full log.

**Acceptance Scenarios**:

1. **Given** a CI run with test failures, **When** a developer views the PR checks tab, **Then** the failing check summary includes the test file name and error message.
2. **Given** a CI run with all passing checks, **When** a developer views the PR checks tab, **Then** each check shows a concise "passed" summary with test counts.

---

### Edge Cases

- What happens when CI times out (e.g., a test hangs)? The pipeline must enforce a maximum run time and fail the check with a timeout error rather than running indefinitely.
- What happens when a developer force-pushes to a PR branch? CI should re-run on the latest commit and previous results should be superseded.
- What happens when the database is unavailable for contract tests? Contract tests that require a live database should either use a test database provisioned by CI or be skipped with a clear skip message rather than failing with a cryptic connection error.
- What happens when a PR is opened from a fork? CI should run on fork PRs with appropriate secret access restrictions (no production secrets exposed).
- What happens if CI configuration itself is broken? A malformed workflow file should fail clearly at the workflow parse stage, not silently skip all checks.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The CI pipeline MUST run automatically on every pull request opened against the main branch.
- **FR-002**: The CI pipeline MUST run automatically on every direct push to the main branch.
- **FR-003**: The pipeline MUST run backend unit tests and backend contract tests as separate jobs or steps.
- **FR-004**: The pipeline MUST run the frontend linter as a separate job or step.
- **FR-005**: The pipeline MUST run a frontend production build verification as a separate job or step.
- **FR-006**: Each pipeline job MUST report its result as a named PR status check (pass/fail) visible on the pull request page.
- **FR-007**: A pull request MUST be blocked from merging if any required CI check fails.
- **FR-008**: All 15 pre-existing test failures MUST be resolved so the backend test suite exits with zero failures.
- **FR-009**: The CI pipeline MUST complete within 10 minutes under normal conditions.
- **FR-010**: The pipeline MUST fail clearly with a descriptive error message when any step fails — never silently pass a failing state.
- **FR-011**: CI MUST NOT expose production secrets or credentials to fork pull requests.

### Non-Functional Requirements

- **NFR-001**: CI run times should be minimized through caching of dependencies where possible.
- **NFR-002**: The CI configuration should be maintainable by any contributor without specialized CI expertise.
- **NFR-003**: Failures must be diagnosable from the CI output without requiring local reproduction.

## Success Criteria *(mandatory)*

- All pull requests to main are automatically validated — zero merged PRs reach main without passing CI checks.
- The full backend test suite reports 0 failures on a clean run (up from 15 pre-existing failures).
- CI pipeline completes in under 10 minutes for a typical change.
- Developers can identify a failing test by name and file from the CI summary without reading raw logs.
- No production credentials are accessible from fork pull request CI runs.

## Scope

### In Scope
- GitHub Actions workflow for PR and push-to-main triggers
- Backend unit test job (`pnpm test` in `backend/`)
- Backend contract test job (`pnpm test:contract` in `backend/`)
- Frontend lint job (`pnpm lint` in `frontend/`)
- Frontend build verification job (`pnpm build` in `frontend/`)
- Fix for all 15 pre-existing backend test failures in `integration.service.test.ts` and `apple-calendar.sync.test.ts`
- Branch protection rule requiring CI checks to pass before merge

### Out of Scope
- End-to-end (Playwright/Maestro) tests — tracked separately in issue #12
- Deployment pipelines or CD (continuous delivery)
- Code coverage reporting or coverage thresholds
- Performance benchmarking in CI
- Slack/email notifications for CI failures

## Dependencies

- The backend test suite must be runnable in a CI environment (no local-only database assumptions)
- Existing `pnpm test`, `pnpm lint`, and `pnpm build` scripts must work from the repo root or their respective directories
- GitHub repository branch protection settings must be configurable (repo admin access required)

## Assumptions

- CI runs on GitHub-hosted runners (Ubuntu latest) — no self-hosted runners needed at this stage
- The test database for contract tests can be provisioned within the CI environment using the existing Docker Compose setup or a test-only SQLite fallback
- The 15 pre-existing failures are in `integration.service.test.ts` (Apple integration credential tests) and `apple-calendar.sync.test.ts` (CalDAV adapter tests) — fixable without changing feature behavior
- Secrets (database URLs, API keys) needed for contract tests will be stored as GitHub Actions repository secrets
- pnpm is used as the package manager throughout the monorepo

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently - e.g., "Can be fully tested by [specific action] and delivers [specific value]"]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST [specific capability, e.g., "allow users to create accounts"]
- **FR-002**: System MUST [specific capability, e.g., "validate email addresses"]  
- **FR-003**: Users MUST be able to [key interaction, e.g., "reset their password"]
- **FR-004**: System MUST [data requirement, e.g., "persist user preferences"]
- **FR-005**: System MUST [behavior, e.g., "log all security events"]

*Example of marking unclear requirements:*

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Key Entities *(include if feature involves data)*

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: [Measurable metric, e.g., "Users can complete account creation in under 2 minutes"]
- **SC-002**: [Measurable metric, e.g., "System handles 1000 concurrent users without degradation"]
- **SC-003**: [User satisfaction metric, e.g., "90% of users successfully complete primary task on first attempt"]
- **SC-004**: [Business metric, e.g., "Reduce support tickets related to [X] by 50%"]
