# Feature Specification: Migrate Frontend to Vite SPA

**Feature Branch**: `014-vite-migration`
**Created**: 2026-03-14
**Status**: Draft
**Closes**: [GitHub Issue #4 (partial — enables mobile/desktop platform targets)](https://github.com/jwill824/ordrctrl/issues/4)

## Overview

ordrctrl is a task management application intended to run on web, mobile (iOS/Android), and desktop (macOS/Windows). The current web frontend is built on a server-rendering framework that was never used for server-side rendering — the app is fully authentication-gated, behaves as a single-page application, and has no public SEO surface. This creates unnecessary friction when packaging the app for mobile and desktop distribution.

This feature migrates the frontend to a pure single-page application build system that produces a single static asset bundle. This bundle becomes the shared foundation that all future platform targets (web deployment, mobile app wrapping, desktop app wrapping) consume from one unified build output — with no per-platform build configuration required.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Uninterrupted Web Experience (Priority: P1)

An existing user visits ordrctrl in their browser after the migration. Every page, route, and feature they rely on — login, feed, inbox, settings, integrations — works exactly as before. No behavior changes, no UI changes, no broken flows.

**Why this priority**: This is a pure infrastructure migration. Zero user-visible regression is the definition of success. If any existing functionality breaks, the migration has failed.

**Independent Test**: Open the web app in a browser, log in, navigate all routes, and confirm every feature functions identically to pre-migration behavior.

**Acceptance Scenarios**:

1. **Given** a user is logged out, **When** they navigate to `/`, **Then** they are redirected to `/login`
2. **Given** a user is logged in, **When** they navigate to `/`, **Then** they are redirected to `/feed`
3. **Given** a user is on `/feed`, **When** the page loads, **Then** their task feed appears and auto-syncs as expected
4. **Given** a user navigates directly to a protected route while logged out, **When** the page loads, **Then** they are redirected to `/login` with a return path preserved
5. **Given** a user is logged in and navigates to `/login`, **When** the page loads, **Then** they are redirected to `/feed`
6. **Given** a user is on any page, **When** they use browser back/forward navigation, **Then** routing behaves correctly without full page reloads

---

### User Story 2 - All Existing Tests Pass (Priority: P1)

The existing unit test suite and end-to-end test suite pass without modification after the migration. Test infrastructure continues to run on the same commands.

**Why this priority**: The test suite is the regression safety net for this migration. If tests pass, the migration is verifiably correct.

**Independent Test**: Run the full test suite (`test` and `test:e2e` commands) and confirm zero failures.

**Acceptance Scenarios**:

1. **Given** the migration is complete, **When** the unit test suite runs, **Then** all tests pass
2. **Given** the migration is complete, **When** the end-to-end test suite runs, **Then** all tests pass

---

### User Story 3 - Mobile Build Target Enabled (Priority: P2)

A developer can package the migrated frontend as an iOS or Android app without additional configuration. The build output produced by the standard build command is directly consumable by the mobile app wrapper with no extra transformation steps.

**Why this priority**: Enabling the mobile build target is the primary strategic reason for this migration. Without it, the Capacitor mobile spec (spec 015) cannot proceed.

**Independent Test**: Run the production build, confirm the output directory exists with static assets, and verify a mobile wrapper can load it successfully on a simulator.

**Acceptance Scenarios**:

1. **Given** the production build runs, **When** it completes, **Then** a static asset directory is produced containing only HTML, JS, CSS, and media files
2. **Given** the static build output, **When** it is loaded inside a mobile app wrapper, **Then** the full app renders and all routes function correctly on a device simulator

---

### User Story 4 - Desktop Build Target Enabled (Priority: P3)

A developer can package the migrated frontend as a macOS or Windows desktop app without additional configuration. The same static build output consumed by the mobile wrapper is also directly consumable by the desktop app wrapper.

**Why this priority**: Desktop support is the secondary strategic goal. It depends on the same build output as mobile — no additional migration work is required beyond what Story 3 already delivers.

**Independent Test**: Load the static build output inside a desktop app wrapper and confirm the full app renders correctly on macOS.

**Acceptance Scenarios**:

1. **Given** the static build output from Story 3, **When** it is loaded inside a desktop app wrapper, **Then** the full app renders and all routes function correctly on macOS

---

### Edge Cases

- What happens when a user navigates directly to a deep URL (e.g., `/settings/integrations`) and refreshes? The app must handle client-side routing correctly without a 404.
- What happens if environment variable names change during migration? All API calls must continue to reach the correct backend endpoints.
- What happens to the `/settings/dismissed` → `/feed?showDismissed=true` redirect that currently exists in the server config? It must be preserved as a client-side redirect.
- What happens when the user's session expires mid-session? The auth guard must redirect to login with the return path preserved.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST serve all existing routes: `/login`, `/signup`, `/feed`, `/inbox`, `/onboarding`, `/settings/integrations`, `/settings/feed`, `/forgot-password`, `/reset-password`
- **FR-002**: The app MUST enforce authentication guards client-side: unauthenticated users accessing protected routes are redirected to `/login` with the intended path preserved as a query parameter
- **FR-003**: The app MUST redirect authenticated users away from auth routes (`/login`, `/signup`, `/forgot-password`) to `/feed`
- **FR-004**: The app MUST redirect `/` to `/feed` for authenticated users and `/login` for unauthenticated users
- **FR-005**: The app MUST preserve the redirect from `/settings/dismissed` to `/feed?showDismissed=true`
- **FR-006**: The app MUST connect to the backend API using the same environment-configured base URL as before
- **FR-007**: The production build MUST output a self-contained static asset bundle (HTML, JS, CSS, media) with no server-side runtime dependency
- **FR-008**: The build output MUST be loadable inside a mobile app wrapper and a desktop app wrapper without modification
- **FR-009**: All existing unit tests MUST continue to run and pass using the same test commands
- **FR-010**: All existing end-to-end tests MUST continue to run and pass using the same test commands
- **FR-011**: The development server MUST support hot module replacement for a fast local development experience
- **FR-012**: The app MUST handle direct URL navigation and browser refresh on any route without returning a 404 or blank screen

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing unit tests pass after migration with no test modifications required
- **SC-002**: 100% of existing end-to-end tests pass after migration with no test modifications required
- **SC-003**: All 10 application routes are accessible and fully functional in a browser after migration
- **SC-004**: The production build completes successfully and produces a static asset bundle consumable by a mobile app wrapper
- **SC-005**: Local development server starts and supports live reload within the same startup time as before migration (under 10 seconds)
- **SC-006**: Zero user-visible behavioral or visual regressions compared to pre-migration baseline

## Assumptions

- The backend API remains unchanged; only the frontend build system is affected
- Session/cookie-based authentication continues to function in a standard browser context after the migration
- Environment variables for API URL and any development-only credentials will be renamed to match the new build system's convention (equivalent values, different prefix)
- The existing test suite (unit + e2e) provides sufficient coverage to validate correctness of the migration
- Mobile and desktop app wrapper configuration (Capacitor, Tauri) are out of scope for this spec and addressed in subsequent specs (015, 016)

## Dependencies

- **Prerequisite**: None — this spec is the foundation for all platform targets
- **Unlocks**: spec `015-mobile-capacitor` (iOS/Android via Capacitor)
- **Unlocks**: spec `016-desktop-tauri` (macOS/Windows via Tauri)
