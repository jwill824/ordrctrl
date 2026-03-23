<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0 (spec-kit workflow governance + stack tracking)
Modified principles: N/A — no existing principles changed
Added sections:
  - Core Principles: VI. Spec-Kit Workflow (NON-NEGOTIABLE)
  - Development Workflow: stack.md reference + regression test mandate
  - Governance: Paradigm Shift Triggers subsection
Added files:
  - .specify/memory/stack.md         ✅ created (project tooling reference)
  - .specify/memory/issues-backlog.md ✅ created (GitHub issues → spec mapping)
Templates reviewed:
  - .specify/templates/plan-template.md  ✅ aligned (Constitution Check gate present)
  - .specify/templates/spec-template.md  ✅ updated (GitHub Issue field + Status lifecycle)
  - .specify/templates/tasks-template.md ✅ aligned (regression test tasks covered)
Agents reviewed:
  - speckit.specify.agent.md   ✅ updated (GitHub MCP check, issue linking, stack, commit)
  - speckit.plan.agent.md      ✅ updated (stack.md reference, commit)
  - speckit.tasks.agent.md     ✅ updated (stack.md reference, commit)
  - speckit.implement.agent.md ✅ updated (regression tests, spec status, PR creation, commit)
  - speckit.analyze.agent.md   ✅ updated (spec status update, commit)
  - speckit.constitution.agent.md ✅ updated (paradigm shift triggers, stack.md sync)
Deferred TODOs:
  - Tech stack selection: intentionally deferred pending proof-of-concept evaluation.
-->

# ordrctrl Constitution

## Core Principles

### I. Integration Modularity (NON-NEGOTIABLE)

Every external integration (Gmail, Apple Reminders, Todoist, Google Calendar, etc.) MUST be
implemented as a fully isolated plugin module with a defined standard interface. No integration
may directly depend on another integration's internals.

- Each integration plugin MUST implement the canonical `IntegrationAdapter` interface covering
  auth, sync, and disconnect lifecycle methods.
- Integration-specific code MUST live in its own directory/package (e.g., `integrations/gmail/`).
- A new integration MUST be addable without modifying core application logic.
- Integration contracts (input/output schemas) MUST be versioned and documented.

**Rationale**: The product's long-term value is the breadth of supported integrations. Isolation
ensures any integration can be added, updated, or removed without risking regressions in others.

### II. Minimalism-First (NON-NEGOTIABLE)

Every UI element, feature, and configuration option MUST earn its place. The default answer to
"should we add this?" is **no** until demonstrated user need justifies it.

- New UI surfaces MUST be justified by a concrete user scenario in the feature spec.
- Feature requests that duplicate existing functionality MUST be rejected.
- The consolidated task/calendar/email view MUST remain the primary interaction surface; secondary
  screens MUST not compete for visual prominence.
- YAGNI (You Aren't Gonna Need It) applies to both UI and backend features.

**Rationale**: ordrctrl's competitive advantage is clarity. Complexity accumulates silently;
minimalism must be actively enforced.

### III. Security & Privacy by Default (NON-NEGOTIABLE)

All OAuth tokens and credentials MUST be encrypted at rest. Raw email content, calendar event
details, and task body text MUST NOT be persisted beyond a short-lived sync cache necessary for
rendering the consolidated view.

- OAuth tokens MUST be stored using platform-appropriate encrypted storage (e.g., keychain,
  secrets manager) — never in plaintext files, logs, or version control.
- Sync cache retention MUST be bounded (configurable, default ≤24 hours) with explicit TTL.
- User data belonging to one integration MUST be isolated from other integrations' data stores.
- All authentication flows MUST use industry-standard OAuth 2.0 or equivalent; custom auth
  protocols are prohibited.
- Secrets and credentials MUST never appear in source code or commit history.

**Rationale**: Users are entrusting ordrctrl with access to some of the most sensitive data they
own. A single breach destroys trust irreparably.

### IV. Test Coverage Required

All new features and integration adapters MUST have accompanying tests before a pull request is
merged. Strict TDD is not mandated, but tests MUST exist and pass before code is considered done.

- Unit tests MUST cover core business logic, data transformation, and sync state management.
- Each `IntegrationAdapter` implementation MUST have integration tests covering the full auth
  and sync lifecycle (using mocks/stubs for external APIs).
- Security-sensitive code paths (token storage, decryption, session management) MUST have
  explicit test coverage.
- A pull request with no tests for new logic MUST NOT be merged.

**Rationale**: Integration surface area is large and regressions are hard to catch manually.
Tests are the only scalable safety net across many adapters.

### V. Simplicity & Deferred Decisions

The technology stack is intentionally not locked at this stage. Architecture decisions MUST be
deferred until there is sufficient evidence to make them well.

- No new dependency, framework, or infrastructure component may be added without a written
  justification in the relevant plan or spec document.
- When two approaches are equally valid, the simpler one MUST be chosen.
- The application MUST support web and mobile platforms; the mechanism for achieving this
  (e.g., React Native, Flutter, separate codebases) is deferred pending evaluation.
- Complexity introduced to satisfy hypothetical future requirements MUST be explicitly justified
  in a Complexity Tracking table in the feature plan.

**Rationale**: Premature architectural decisions create lock-in and debt. ordrctrl is early-stage;
optionality is more valuable than consistency with a decision that may prove wrong.

### VI. Spec-Kit Workflow (NON-NEGOTIABLE)

All features MUST follow the spec-kit lifecycle in order:
**Specify → Plan → Tasks → Implement → Analyze**

- `/speckit.specify`: Draft spec.md, link GitHub issue, commit `docs(spec): initialize NNN-feature-name`
- `/speckit.plan`: Generate plan.md + design artifacts, commit `docs(plan): add plan for NNN-feature-name`
- `/speckit.tasks`: Generate tasks.md, commit `docs(tasks): generate tasks for NNN-feature-name`
- `/speckit.implement`: Execute tasks, run regression tests after each phase, update spec status,
  commit per phase, push branch, open PR referencing linked GitHub issues
- `/speckit.analyze`: Cross-artifact consistency check, update spec status, commit report

The `spec.md` **Status** field MUST be updated at each phase gate:
`Draft → Planned → Tasked → In Progress → Implemented → Analyzed`

GitHub issues MUST be:
1. Linked in `spec.md` header as `**GitHub Issue**: #N`
2. Tracked in `.specify/memory/issues-backlog.md`
3. Referenced in the PR body with `Closes #N` syntax

Regression tests MUST be run after every implementation phase. A phase MUST NOT be committed if
tests fail. Stack-specific test commands are defined in `.specify/memory/stack.md`.

Every speckit phase MUST end with a `conventional-commit` skill invocation. Phase commits follow
the format `docs(<phase>): <description> (#<issue>)` where `<phase>` is the speckit phase name
(e.g., `spec`, `plan`, `tasks`, `implement`, `analyze`).

Project tooling (packaging, linting, test library, version constraints) MUST be documented in
`.specify/memory/stack.md` and kept current. All spec-kit agents MUST read `stack.md` before
generating technical plans or tasks.

**Rationale**: Spec traceability from GitHub issue to merged PR is the audit trail for every
feature. Without enforced phase commits, status tracking, and test gates, the workflow degrades
silently. Stack documentation prevents agents from hallucinating commands or tool names.

## Architecture & Platform

ordrctrl is a web and mobile application providing a consolidated view of tasks, emails, and
calendar events synced from multiple third-party integrations.

- **Target platforms**: Web (desktop + mobile browser) and native mobile (iOS and Android).
  The cross-platform strategy is TODO pending tech stack selection.
- **Core data model**: A unified canonical schema for Tasks, Events, and Messages MUST be defined
  and serve as the normalized output of all integration adapters.
- **Auth flows**: Each integration authenticates independently via OAuth 2.0. The central user
  account (ordrctrl login) is separate from integration credentials.
- **Sync architecture**: Integrations sync asynchronously into a bounded cache; the UI reads
  from the cache, never directly from external APIs at render time.
- **User flows**:
  1. Sign up / Log in
  2. Onboarding: connect at least one integration (guided tutorial)
  3. Consolidated view: unified task/calendar/email feed

TODO(TECH_STACK): Finalize language, framework, and database choices after proof-of-concept phase.

## Development Workflow

- All changes MUST be made on a feature branch and merged via pull request.
- Pull requests MUST reference a spec or task document.
- A pull request MUST NOT be merged if it introduces a Constitution violation without a documented
  justification in the Complexity Tracking table.
- All PRs MUST pass automated tests (unit + integration) before merge.
- Security-sensitive changes (token handling, auth flows, data retention) MUST receive explicit
  review attention before approval.
- Commit messages SHOULD follow Conventional Commits format
  (`feat:`, `fix:`, `docs:`, `chore:`, etc.) — see `.specify/memory/stack.md` for spec-kit
  phase-specific commit message formats.
- **Regression tests MUST run after every implementation phase** before committing. Failures
  block the commit.
- Project tooling and commands are documented in `.specify/memory/stack.md`. This file is the
  authoritative reference for packaging tool, version constraints, linting, and test commands.
- GitHub issues MUST be tracked in `.specify/memory/issues-backlog.md` and closed via PRs.

## Governance

This constitution supersedes all other development practices and informal norms. When a practice
conflicts with the constitution, the constitution wins or must be formally amended.

**Amendment procedure**:
1. Propose the change in writing, stating the principle affected, the change, and the rationale.
2. Amendment requires documented approval from the project lead.
3. After approval, update this file, increment the version, and update `LAST_AMENDED_DATE`.
4. Propagate any impacts to dependent templates and spec documents.

**Versioning policy**: Semantic versioning (MAJOR.MINOR.PATCH).
- MAJOR: Principle removal, redefinition, or backward-incompatible governance change.
- MINOR: New principle or section added; material expansion of existing guidance.
- PATCH: Clarifications, wording improvements, typo fixes.

**Compliance**: All pull request reviews MUST verify compliance with this constitution.
Complexity violations must be justified; unjustified complexity MUST block merge.

### Paradigm Shift Triggers

The constitution MUST be reviewed and potentially amended (run `/speckit.constitution`) when
any of the following occur:

- A new primary programming language, runtime, or framework is adopted
- The authentication/authorization model changes fundamentally (e.g., sessions → JWT)
- The deployment or infrastructure strategy changes significantly
- A new integration pattern is mandated (e.g., REST → GraphQL, polling → webhooks)
- The test strategy changes (e.g., new test framework, adopting strict TDD)
- The packaging tool changes (e.g., npm → pnpm, pip → uv)
- A new platform target is added (e.g., desktop app, CLI, browser extension)
- The data persistence layer changes (e.g., new ORM, new database engine)

When a paradigm shift occurs:
1. Run `/speckit.constitution` to amend the constitution **before** creating any new spec
2. Update `.specify/memory/stack.md` with new tooling information
3. Propagate changes to affected templates and agent files per the amendment procedure

**Version**: 1.1.0 | **Ratified**: 2026-03-05 | **Last Amended**: 2026-03-22
