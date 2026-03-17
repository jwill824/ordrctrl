# Implementation Plan: End-to-End Testing & Native Build CI

**Branch**: `018-e2e-testing` | **Date**: 2026-03-16 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/018-e2e-testing/spec.md`

## Summary

Add full e2e test coverage for the five core feed interactions (view, complete, dismiss, restore,
rename) using the existing Playwright runner; introduce a new Maestro native mobile e2e suite for
the Capacitor iOS/Android app covering auth + feed load + task completion; and extend the GitHub
Actions CI pipeline with five new jobs — Playwright web e2e, iOS build, Android build, Maestro
iOS, and Maestro Android — so that every PR gets automated verification of both web and native
surfaces.

## Technical Context

**Language/Version**: TypeScript 5.4 (frontend), Node 20 (existing `ci.yml` jobs), Node 22 (native build jobs — Capacitor CLI requires ≥22)  
**Primary Dependencies**:
- Playwright 1.42 (web e2e, already installed)
- Maestro CLI ≥ v1.38 (native mobile e2e, new)
- Capacitor 8.2 (iOS + Android app packaging)
- Vite 5 / React 18 (web app under test)
- pnpm 9 (package manager, workspace)
- Temurin JDK 21 (Android build — `capacitor.build.gradle` sets `VERSION_21`)

**Storage**: N/A (tests are read-only; no test data written to persistent storage)  
**Testing**:
- Web e2e: Playwright, `pnpm --filter frontend test:e2e`, chromium only
- Native e2e: Maestro YAML flows, `.maestro/flows/`
- Existing unit/contract tests: Vitest (frontend), Jest (backend) — unchanged

**Target Platform**: Web (Chromium desktop via Playwright) + iOS 17 simulator + Android 13
emulator (API 33)

**Project Type**: Web application with Capacitor-wrapped native mobile app  
**Performance Goals**: e2e-web CI job ≤ 15 min; iOS build ≤ 40 min; Android build ≤ 25 min  
**Constraints**:
- No production signing certificates in CI (unsigned/debug builds only — FR-018)
- All test credentials injected via CI secrets, never committed (Constitution III)
- `E2E_SESSION_COOKIE` / Maestro credentials: graceful skip when absent (FR-004, FR-013)
- No modification to existing CI jobs (SC-006)

**Scale/Scope**: ~5 new Playwright tests (feed interactions) + 3 Maestro flow files + 5 new
GitHub Actions jobs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Integration Modularity** | ✅ PASS | Tests validate integration behavior but do not add integration code; no IntegrationAdapter changes |
| **II. Minimalism-First** | ✅ PASS | Each new test directly corresponds to an acceptance scenario in the spec; no speculative coverage added |
| **III. Security & Privacy** | ✅ PASS | All credentials injected via GitHub Secrets; no secrets in test files or commit history; skip-not-fail when absent |
| **IV. Test Coverage Required** | ✅ PASS | This spec _is_ the test coverage work; all FRs map to verifiable tests |
| **V. Simplicity & Deferred Decisions** | ✅ PASS | Uses existing Playwright runner (no new web test framework); Maestro added only for native surface not covered by Playwright; unsigned builds only |

**Post-design re-check**: No violations introduced by Phase 1 design. The addition of two new
test runners (Maestro) and five CI jobs is justified by distinct platform surfaces not covered
by existing tools. No complexity table entries required.

## Project Structure

### Documentation (this feature)

```text
specs/018-e2e-testing/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── playwright-feed-contract.md
│   ├── maestro-flows-contract.md
│   └── ci-jobs-contract.md
└── tasks.md             # Phase 2 output (speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
# Playwright web e2e tests (new test file added to existing runner)
frontend/
├── playwright.config.ts          # Existing — no changes needed
└── tests/
    └── e2e/
        ├── auth.spec.ts          # Existing — SSO button selectors fixed (getByRole('button'))
        ├── integrations.spec.ts  # Existing (6 tests — no changes)
        └── feed.spec.ts          # NEW — 5 feed interaction tests

# Maestro native e2e flows (new directory at repo root)
.maestro/
└── flows/
    ├── auth.yaml           # NEW — launch app, verify login screen, authenticate
    ├── feed-load.yaml      # NEW — verify feed loads with at least one task
    └── task-complete.yaml  # NEW — complete a task, verify Completed section

# CI pipeline
.github/
└── workflows/
    ├── ci.yml              # MODIFIED — 1 new job (e2e-web) + postgres/redis services for backend-contract
    └── native.yml          # NEW — 4 native jobs: build-ios, build-android, maestro-ios, maestro-android
```

**Platform notes**:
- This project uses Swift Package Manager (SPM), not CocoaPods. `xcodebuild` must target `-project ios/App/App.xcodeproj`, not a workspace. No `pod install` step is needed.
- `CONFIGURATION_BUILD_DIR` in xcodebuild must be an absolute path (`"$(pwd)/ios/build"`) because relative paths are resolved against `SRCROOT` (the Xcode project directory), not the shell working directory.

**Structure Decision**: Option 2 (web app) extended with a native flow tree at repo root.
The Playwright e2e tests live inside `frontend/tests/e2e/` (existing convention). Maestro flows
live at `.maestro/flows/` (Maestro docs convention; repo-root location keeps them separate from
the frontend tree and accessible to both iOS and Android CI jobs without path gymnastics).

## Complexity Tracking

> No constitution violations. Table not required.
