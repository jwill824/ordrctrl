# Feature Specification: Spec-Kit Workflow Update

**Feature Branch**: `020-speckit-workflow`  
**Created**: 2026-03-22  
**Status**: Draft  
**GitHub Issue**: [#31](https://github.com/jwill824/ordrctrl/issues/31)  
**Input**: Update our spec-kit workflow to integrate with GitHub, enforce constitution hygiene, add stack-awareness to agents/skills, and improve commit/PR automation across all speckit phases.

<!--
  Status lifecycle: Draft → Planned → Tasked → In Progress → Implemented → Analyzed
  - Draft:       spec.md written (/speckit.specify)
  - Planned:     plan.md + design artifacts complete (/speckit.plan)
  - Tasked:      tasks.md generated (/speckit.tasks)
  - In Progress: implementation started (/speckit.implement)
  - Implemented: all tasks complete, tests pass, PR open (/speckit.implement)
  - Analyzed:    cross-artifact consistency confirmed (/speckit.analyze)
-->

## User Scenarios & Testing *(mandatory)*

### User Story 1 - GitHub Issue Linkage During Specify (Priority: P1)

A developer runs `/speckit.specify` and the workflow automatically verifies GitHub MCP connectivity, retrieves relevant open issues, and links the new feature branch to the corresponding issue. The spec file records the issue number. When the feature is eventually implemented, the PR is automatically created and linked to that issue.

**Why this priority**: Issue traceability is foundational — every subsequent phase (plan, tasks, implement) benefits from knowing which issue a spec addresses. Without this, PRs and specs are disconnected from the backlog.

**Independent Test**: Run `/speckit.specify` on a new feature description while a matching open GitHub issue exists. Verify the generated spec.md contains a GitHub Issue link and that the branch name is associated with the issue in GitHub.

**Acceptance Scenarios**:

1. **Given** GitHub MCP is configured and reachable, **When** `/speckit.specify` runs, **Then** the spec file includes a `GitHub Issue` field populated with the relevant issue number and URL.
2. **Given** GitHub MCP is not reachable, **When** `/speckit.specify` runs, **Then** the workflow surfaces a clear warning and continues without blocking spec creation.
3. **Given** a spec branch is created, **When** `/speckit.implement` completes all tasks, **Then** a PR is automatically opened with the relevant GitHub issue(s) attached.

---

### User Story 2 - Per-Phase Commits (Priority: P2)

A developer progresses through speckit phases (`/speckit.specify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.implement`). At the end of each phase, the workflow automatically commits all relevant artifact changes (spec.md, plan.md, tasks.md, checklists) to the feature branch with a conventional commit message.

**Why this priority**: Without automatic commits per phase, artifact history is lost and it's unclear what state the spec was in at each decision point. It also prevents accidental loss of work.

**Independent Test**: Run `/speckit.plan` on a feature with a complete spec. Verify that a commit appears on the branch containing plan.md and any updated artifacts, with a message following Conventional Commits format.

**Acceptance Scenarios**:

1. **Given** `/speckit.specify` completes successfully, **When** the phase ends, **Then** a commit is made on the feature branch containing the spec.md and checklist files.
2. **Given** `/speckit.plan` completes, **When** the phase ends, **Then** a commit is made containing plan.md and any updated spec artifacts.
3. **Given** `/speckit.implement` completes all tasks, **When** the phase ends, **Then** a commit is made, the branch is pushed, and a PR is created referencing the GitHub issue.

---

### User Story 3 - Spec Status Lifecycle Enforcement (Priority: P2)

A developer completes the `/speckit.implement` phase. The workflow automatically updates the `Status` field in spec.md from `In Progress` to `Implemented`. After `/speckit.analyze` confirms cross-artifact consistency, the status advances to `Analyzed`.

**Why this priority**: Stale or incorrect status fields cause confusion about which specs are ready to plan, implement, or review. Automating status updates removes a manual step that is frequently forgotten.

**Independent Test**: Run `/speckit.implement` to completion on a spec with `Status: In Progress`. Verify spec.md is updated to `Status: Implemented` and committed.

**Acceptance Scenarios**:

1. **Given** all tasks in tasks.md are marked done, **When** `/speckit.implement` finishes, **Then** spec.md `Status` is updated to `Implemented`.
2. **Given** `/speckit.analyze` reports no consistency issues, **When** the analysis phase ends, **Then** spec.md `Status` is updated to `Analyzed`.
3. **Given** `/speckit.analyze` reports unresolved issues, **When** the analysis phase ends, **Then** spec.md `Status` remains `Implemented` and issues are listed.

---

### User Story 4 - Stack-Aware Agents (Priority: P3)

A developer runs any speckit command on a new project. The agents/skills detect or prompt for project stack information (packaging tool, linting tool, test library, version constraints, and key conventions) and persist this in the constitution or memory files. Subsequent speckit commands use this stack context to generate accurate tasks, commands, and recommendations without re-asking.

**Why this priority**: Stack-unaware task generation produces incorrect commands (wrong test runner, wrong package manager). Capturing this once and reusing it improves all future speckit output quality.

**Independent Test**: Run `/speckit.specify` on a fresh project where stack info is not yet captured. Verify the workflow prompts for packaging tool, test library, and linting tool, then stores the answers. Run `/speckit.tasks` and verify the generated tasks reference the correct tooling.

**Acceptance Scenarios**:

1. **Given** no stack info exists in memory, **When** a speckit command runs, **Then** the agent prompts for packaging tool, test library, linting tool, and version constraints.
2. **Given** stack info is already stored, **When** any speckit command runs, **Then** the agent uses the stored info without re-prompting.
3. **Given** stack info changes (e.g., migration from npm to pnpm), **When** the constitution is updated, **Then** subsequent speckit commands reflect the updated stack.

---

### User Story 5 - GitHub Issues Backlog Tracking in Memory (Priority: P3)

A developer wants to know which GitHub issues are candidates for the next spec. The speckit workflow maintains a memory file (`.specify/memory/`) that lists open GitHub issues not yet associated with a spec, updated automatically during the specify phase.

**Why this priority**: Without a persistent view of unspecified issues, developers must manually cross-reference GitHub and the specs directory to find the next thing to work on.

**Independent Test**: After `/speckit.specify` runs and links issue #31, verify the memory file no longer lists #31 as unspecified, and that remaining open issues are still listed.

**Acceptance Scenarios**:

1. **Given** open GitHub issues exist with no corresponding spec branch, **When** the memory file is read, **Then** those issues are listed as candidates for the next spec.
2. **Given** `/speckit.specify` completes for an issue, **When** the phase ends, **Then** that issue is removed from the unspecified list in the memory file.
3. **Given** new issues are opened in GitHub, **When** the next speckit command runs, **Then** the memory file is refreshed to include newly opened issues.

---

### User Story 6 - Constitution Auto-Update (Priority: P3)

A developer introduces a paradigm shift (e.g., new architecture pattern, new tooling decision). The speckit workflow detects that the constitution is out of date and prompts the developer to review and update it. The constitution update is committed and all dependent templates are synchronized.

**Why this priority**: A stale constitution causes speckit to generate artifacts inconsistent with current project standards.

**Independent Test**: Manually edit the constitution to mark a section as outdated. Run `/speckit.specify`. Verify the workflow detects the change and prompts for a constitution review before proceeding.

**Acceptance Scenarios**:

1. **Given** a significant project change is detected (new dependency, new pattern), **When** any speckit phase starts, **Then** the workflow prompts the developer to confirm the constitution is current.
2. **Given** the constitution is updated, **When** the update is committed, **Then** all dependent templates (spec-template.md, plan-template.md, etc.) are checked for consistency and updated if needed.

---

### Edge Cases

- What happens when GitHub MCP is unavailable during the specify phase — spec creation must not be blocked.
- What happens when the developer declines to provide stack information — workflow proceeds with defaults and marks stack fields as unset.
- What happens when a spec branch already has a commit for the current phase — duplicate commit must not be created.
- What happens when tasks.md has partially completed tasks when `/speckit.implement` is re-run — already-done tasks are skipped, status is not regressed.
- What happens when two issues could plausibly map to the same spec — the workflow picks the closest match and notes the ambiguity in spec.md.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The workflow MUST verify GitHub MCP connectivity at the start of the `/speckit.specify` phase and report status to the developer.
- **FR-002**: The workflow MUST retrieve open GitHub issues during `/speckit.specify` and populate the `GitHub Issue` field in spec.md with the best-matched issue.
- **FR-003**: The workflow MUST commit all phase artifacts to the feature branch at the end of each speckit phase using a Conventional Commits message.
- **FR-004**: The workflow MUST update the `Status` field in spec.md to `Implemented` when all tasks in tasks.md are complete.
- **FR-005**: The workflow MUST update the `Status` field in spec.md to `Analyzed` when `/speckit.analyze` confirms consistency with no unresolved issues.
- **FR-006**: The workflow MUST create a GitHub PR and attach relevant issue(s) when `/speckit.implement` completes and pushes the branch.
- **FR-007**: The workflow MUST prompt for stack information (packaging tool, test library, linting tool, version constraints) when none is stored and persist the answers in the constitution or a memory file.
- **FR-008**: The workflow MUST use stored stack information in all task and command generation without re-prompting.
- **FR-009**: The workflow MUST maintain a memory file listing open GitHub issues that do not yet have a corresponding spec branch, refreshed on each specify phase run.
- **FR-010**: The workflow MUST prompt the developer to review the constitution when a paradigm shift is detected, and synchronize dependent templates after an update.
- **FR-011**: The workflow MUST add regression test execution as a step in the `/speckit.implement` phase to verify no existing functionality is broken.
- **FR-012**: The workflow MUST update tasks.md with any additional tasks discovered during implementation and commit the update.

### Key Entities

- **Constitution**: The project's authoritative source of standards, patterns, and conventions. Updated when paradigm shifts occur; drives template consistency.
- **Memory File (GitHub Issues)**: A file in `.specify/memory/` that tracks open GitHub issues not yet associated with a spec. Refreshed during the specify phase.
- **Stack Profile**: A persisted record of the project's tooling choices (package manager, test library, linter, version constraints). Stored in the constitution or a dedicated memory file.
- **Phase Commit**: A git commit made at the end of each speckit phase capturing all artifact changes for that phase.
- **Spec Status**: The lifecycle state of a spec (Draft → Planned → Tasked → In Progress → Implemented → Analyzed), automatically advanced by the workflow.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of spec.md files produced by `/speckit.specify` include a populated `GitHub Issue` field when a matching open issue exists.
- **SC-002**: 100% of speckit phases that produce artifact changes result in a git commit on the feature branch before the phase ends.
- **SC-003**: spec.md `Status` is automatically advanced to `Implemented` within the same session that `/speckit.implement` completes — no manual update required.
- **SC-004**: Stack information is prompted for at most once per project; subsequent speckit commands across all features use the stored stack profile without re-prompting.
- **SC-005**: The GitHub issues memory file is accurate within one speckit session — issues linked to a spec are removed, and new open issues appear, after each specify phase run.
- **SC-006**: PRs created by the workflow are linked to their corresponding GitHub issue(s) 100% of the time when issue linkage data is available.
- **SC-007**: Regression tests are executed as part of every `/speckit.implement` run; a failing test prevents the phase from being marked complete.

## Assumptions

- GitHub MCP server is already configured in the developer's Copilot CLI environment; this feature adds verification and usage, not initial setup.
- The constitution file exists at `.specify/memory/constitution.md` and is the authoritative source for project standards.
- The speckit scripts (`.specify/scripts/`) are bash-based and can be extended to include git commit and push operations.
- "Paradigm shift" detection is heuristic — the workflow prompts for constitution review on significant dependency additions or pattern-level changes rather than detecting it automatically.
- Stack information is project-scoped, not per-feature; it is captured once and shared across all features in the repository.
