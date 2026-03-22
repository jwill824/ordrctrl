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

Before a developer runs `/speckit.specify`, the workflow first executes the issue-triage agent to surface open issue candidates, giving the developer a prioritized view of what to specify next. The developer may then confirm one or more issues (e.g., when related issues are consolidated into a single spec) to associate with the new feature. The spec file records all linked issue numbers. When the feature is eventually implemented, the PR is automatically created and linked to every associated issue.

**Why this priority**: Issue traceability is foundational — every subsequent phase (plan, tasks, implement) benefits from knowing which issue(s) a spec addresses. Consolidating related issues into one spec prevents duplicated work, and the triage guard ensures the developer is always working from a prioritized backlog view rather than guessing.

**Independent Test**: Run `/speckit.specify`. Verify the triage report appears first, confirm two related issues as consolidated, and verify spec.md contains a `GitHub Issue` field listing both issue numbers and URLs. Run `/speckit.implement` to completion and verify the PR references both issues.

**Acceptance Scenarios**:

1. **Given** GitHub MCP is configured and reachable, **When** `/speckit.specify` is invoked, **Then** the issue-triage agent runs first and presents a prioritized list of open issues before spec creation begins.
2. **Given** the triage report is shown, **When** the developer selects multiple issues to consolidate into one spec, **Then** spec.md `GitHub Issue` field lists all selected issue numbers and URLs.
3. **Given** GitHub MCP is not reachable, **When** `/speckit.specify` runs, **Then** the workflow surfaces a clear warning, skips the triage guard, and continues without blocking spec creation.
4. **Given** a spec branch is created with one or more linked issues, **When** `/speckit.implement` completes all tasks, **Then** a PR is automatically opened referencing all linked GitHub issues.

---

### User Story 2 - Per-Phase Commits with Conventional Commit Skill (Priority: P2)

A developer progresses through any speckit phase (`/speckit.specify`, `/speckit.clarify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.checklist`, `/speckit.implement`, `/speckit.analyze`). At the end of each phase, the workflow invokes the `conventional-commit` skill to generate a properly structured commit message, then commits all relevant artifact changes (spec.md, plan.md, tasks.md, checklists, memory files) to the feature branch. The constitution is also updated to document that the `conventional-commit` skill is required for all speckit-phase commits.

**Why this priority**: Without automatic commits per phase, artifact history is lost and it's unclear what state the spec was in at each decision point. Using the conventional-commit skill ensures commit messages are consistently formatted and carry correct type/scope metadata, which enables changelog generation and traceability.

**Independent Test**: Run `/speckit.plan` on a feature with a complete spec. Verify that a commit appears on the branch containing plan.md and any updated artifacts, with a message conforming to Conventional Commits format (type, scope, description) as produced by the conventional-commit skill.

**Acceptance Scenarios**:

1. **Given** `/speckit.specify` completes successfully, **When** the phase ends, **Then** the conventional-commit skill generates a commit message and a commit is made containing spec.md and checklist files.
2. **Given** `/speckit.clarify` updates the spec with resolved answers, **When** the phase ends, **Then** a conventional-commit-formatted commit is made with the updated spec.md.
3. **Given** `/speckit.plan` completes, **When** the phase ends, **Then** a conventional-commit-formatted commit is made containing plan.md and any updated spec artifacts.
4. **Given** `/speckit.tasks` generates tasks.md, **When** the phase ends, **Then** a conventional-commit-formatted commit is made containing tasks.md.
5. **Given** `/speckit.checklist` generates a checklist file, **When** the phase ends, **Then** a conventional-commit-formatted commit is made containing the checklist.
6. **Given** `/speckit.analyze` completes, **When** the phase ends, **Then** a conventional-commit-formatted commit is made with any updated artifacts and the advanced spec status.
7. **Given** `/speckit.implement` completes all tasks, **When** the phase ends, **Then** a conventional-commit-formatted commit is made, the branch is pushed, and a PR is created referencing all linked GitHub issues.
8. **Given** a phase produces no artifact changes, **When** the phase ends, **Then** no commit is created (duplicate empty commits are prevented).

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

### User Story 4 - Stack-Aware Agents with stack.md Template (Priority: P3)

A developer runs any speckit command on a new project. The workflow checks for a `stack.md` file in `.specify/memory/`. If absent, it offers two modes: **auto-detect** (the model inspects the repository and infers stack fields from project files) or **manual entry** (the developer fills in a prompted form based on a standard template). Either mode produces a fully populated `stack.md` that is committed to the repo. Subsequent speckit commands read `stack.md` to generate accurate tasks, commands, and recommendations without re-prompting. The `stack.md` template is designed to be extensible — new fields can be added to the template without breaking existing entries.

**Why this priority**: Stack-unaware task generation produces incorrect commands (wrong test runner, wrong package manager). A template-driven `stack.md` makes the stack profile visible, version-controllable, and easily extendable as the project evolves or new speckit capabilities are added.

**Independent Test**: Delete `stack.md` from `.specify/memory/`. Run `/speckit.specify`. Verify the workflow offers both auto-detect and manual entry modes. Select auto-detect; verify `stack.md` is created with all standard template fields populated. Run `/speckit.tasks` and verify the generated tasks reference the tooling recorded in `stack.md`.

**Acceptance Scenarios**:

1. **Given** `stack.md` does not exist, **When** any speckit command runs, **Then** the workflow presents the developer with a choice: auto-detect stack or manually enter stack details.
2. **Given** the developer selects auto-detect, **When** the model inspects the repository, **Then** `stack.md` is created with all standard template fields inferred from project files (e.g., package manager detected from lock file, test library detected from config or dependencies).
3. **Given** the developer selects manual entry, **When** they complete the prompted form, **Then** `stack.md` is created with the developer-provided values filling all standard template fields.
4. **Given** `stack.md` already exists, **When** any speckit command runs, **Then** the workflow reads the file and uses its values without prompting.
5. **Given** new fields are added to the `stack.md` template (e.g., for a future speckit extension), **When** an existing `stack.md` is loaded, **Then** the workflow detects missing fields, prompts only for the new fields, and appends them without overwriting existing values.
6. **Given** a stack field changes (e.g., migration from npm to pnpm), **When** `stack.md` is updated and committed, **Then** all subsequent speckit commands use the new values.

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

### User Story 7 - Spec Artifact Drift Detection and Auto-Update (Priority: P3)

During or after implementation, a developer steers the feature in a direction that diverges from what was originally specified. The speckit workflow — at the end of the implement or analyze phase — diffs the feature branch artifacts (spec.md, plan.md, tasks.md) against what they contained at the point of branch creation. Where it detects a meaningful mismatch between the written spec and the actual code changes, it prompts the developer to confirm whether the spec should be updated to reflect reality. If confirmed, the affected artifact(s) are updated and committed.

**Why this priority**: Specs and implementation routinely drift during development. Without a drift-detection pass, the spec becomes a historical artifact rather than a living document. Keeping spec.md, plan.md, and tasks.md synchronized with what was actually built ensures the analyze phase is meaningful and future maintainers understand the true intent of each feature.

**Independent Test**: Create a feature branch with a spec. Implement a change that differs from the spec (e.g., add a capability not listed in functional requirements). Run `/speckit.analyze`. Verify the workflow reports the drift, presents the diff, and offers to update spec.md to include the new capability. Confirm the update and verify a commit is made containing the revised spec.md.

**Acceptance Scenarios**:

1. **Given** implementation code changes exist on the branch since branch creation, **When** `/speckit.analyze` runs, **Then** the workflow diffs spec.md, plan.md, and tasks.md against their state at branch-creation commit and reports any detected mismatches.
2. **Given** a mismatch is detected (e.g., a requirement in spec.md was not implemented, or code was added beyond the spec scope), **When** the drift report is shown, **Then** the developer is prompted to confirm whether each artifact should be updated.
3. **Given** the developer confirms an artifact update, **When** the update is applied, **Then** the artifact is revised to reflect the actual implementation direction and a conventional-commit-formatted commit is made.
4. **Given** the developer declines an artifact update, **When** the decision is recorded, **Then** the mismatch is noted in the analysis output but the artifact is left unchanged.
5. **Given** no drift is detected (implementation matches spec), **When** `/speckit.analyze` completes, **Then** no drift report is generated and the phase proceeds normally.
6. **Given** plan.md or tasks.md contain items that were never addressed (skipped or descoped), **When** drift detection runs, **Then** those items are flagged as unresolved and the developer is prompted to either remove them or mark them as deferred.

---

### User Story 8 - Session Lifecycle Management (Priority: P2)

When a developer starts a new spec, the workflow enforces that it begins in a fresh Copilot CLI session to prevent context bleed from a prior spec's conversation history. When a session starts on an existing speckit feature branch, the workflow automatically surfaces a context summary (spec name, current status, last committed phase) so the developer knows where they left off. Each speckit agent that can resume a workflow (plan, tasks, implement, analyze) explicitly loads all relevant context files at startup — constitution, stack.md, spec.md, and any existing phase artifacts — since only `copilot-instructions.md` is loaded automatically by the CLI. The session-logger hooks are guarded: they check prerequisites (logs directory, `.gitignore` entry) before writing, and emit a one-time setup reminder rather than silently failing or writing untracked files.

**Why this priority**: Without session boundaries, context from a prior spec's plan or implementation bleeds into a new feature, leading to hallucinated file paths or incorrect assumptions. Without explicit context loading in resuming agents, the model may lack the constitution, stack constraints, or prior decisions needed to produce consistent artifacts.

**Independent Test**: Start a fresh session, run `/speckit.specify` — verify a session boundary reminder appears. Close the session, reopen in the same branch, run `/speckit.plan` — verify the agent outputs a context summary showing the spec name and status before proceeding. Verify `logs/copilot/session.log` is not committed (present in `.gitignore`) and hook scripts emit a reminder if setup is incomplete.

**Acceptance Scenarios**:

1. **Given** a developer invokes `/speckit.specify` in a session that already has prior conversation history, **When** the phase begins, **Then** the agent surfaces a session boundary reminder recommending a fresh session for a new spec.
2. **Given** a developer starts a new session on a speckit feature branch, **When** `sessionStart` fires, **Then** the hook logs and surfaces a context summary: active spec name, current status, and last committed phase.
3. **Given** a developer resumes `/speckit.plan`, `/speckit.tasks`, `/speckit.implement`, or `/speckit.analyze` in a new session, **When** the agent starts, **Then** it explicitly reads constitution, stack.md, spec.md, and any existing phase artifacts before generating output.
4. **Given** the session-logger hook fires and `logs/` is not in `.gitignore`, **When** the hook runs, **Then** it emits a one-time setup reminder and skips writing logs rather than creating untracked files.
5. **Given** session-logger setup is complete (`logs/` in `.gitignore`, directory present), **When** any session lifecycle event fires, **Then** the hook writes structured JSON to `logs/copilot/session.log` without any warnings.

---

### Edge Cases

- What happens when GitHub MCP is unavailable during the specify phase — spec creation must not be blocked; triage guard is skipped with a warning.
- What happens when the developer selects multiple issues to consolidate and then deselects one mid-way — only confirmed issues are written to spec.md.
- What happens when the developer declines to provide stack information or skips auto-detect — workflow proceeds with defaults and marks stack fields as unset in stack.md.
- What happens when auto-detect cannot determine a stack field — that field is left blank in stack.md and flagged for manual entry on the next speckit run.
- What happens when a spec branch already has a commit for the current phase — no duplicate commit is created; the workflow checks for unstaged changes before committing.
- What happens when tasks.md has partially completed tasks when `/speckit.implement` is re-run — already-done tasks are skipped, status is not regressed.
- What happens when two issues could plausibly map to the same spec — the triage guard presents both candidates and the developer explicitly confirms which to link.
- What happens when drift detection finds changes in a binary or non-text asset — drift detection is scoped to tracked spec artifacts (spec.md, plan.md, tasks.md) only.
- What happens when the developer confirms a spec update but the artifact has conflicting changes — the workflow presents the diff and requires explicit resolution before committing.
- What happens when a developer runs `/speckit.specify` in a resumed session — the agent warns about session contamination risk but does not hard-block if the developer confirms they want to proceed.
- What happens when session-logger setup is partial (directory exists but logs/ not in .gitignore) — the hook emits a specific warning identifying the missing step and skips writing.
- What happens when the bootstrap script is run on a repo that already has some speckit artifacts — the script is idempotent and skips existing files without overwriting.
- What happens when a user-level agent and a project-level agent share the same name — the project-level definition always wins (local-over-global override).

---

### User Story 9 - Portability and Cross-Repo Bootstrap (Priority: P3)

A developer who has refined their speckit workflow in one project wants to use the same agents, skills, templates, and scripts globally — available in every repository without manual copying. They publish all generic, project-agnostic tooling (agents, skills, templates, scripts) to a standalone speckit repository and install it once into the Copilot CLI's user-level extensions directory. For each new project, a bootstrap script from the speckit repository scaffolds the project-specific layer: constitution stub, `stack.md` prompt, hooks setup, `logs/` added to `.gitignore`, and a `copilot-instructions.md` reference block. Project-specific context (constitution, stack.md, specs) always lives in the target repo and is never stored globally. Local project overrides always take precedence over user-level defaults.

**Why this priority**: Once the workflow is trusted, copying agents and skills into every new repo manually is error-prone and prevents consistent updates. A single global install point with a per-project bootstrap separates versioned generic tooling from always-local project context. P3 because it depends on all prior stories being stable and validated.

**Independent Test**: Create a blank repository with no `.github/` directory. Run the bootstrap script from the speckit repo. Verify that `/speckit.specify` and all skills are available without any files copied into `.github/`, that the constitution stub and `copilot-instructions.md` reference block were created, and that running the bootstrap script a second time changes nothing.

**Acceptance Scenarios**:

1. **Given** the speckit repo's agents and skills are installed in the user-level extensions directory, **When** a developer opens any repository in Copilot CLI, **Then** all `/speckit.*` commands and skills (`conventional-commit`, `context-map`, `github-issues`) are available without project-level `.github/` files.
2. **Given** a new blank repository, **When** the developer runs the speckit bootstrap script, **Then** the project-specific scaffold is created: constitution stub, empty `stack.md`, hooks wired up, `logs/` in `.gitignore`, and a `copilot-instructions.md` pointer to the constitution.
3. **Given** a speckit repo update ships a new agent version, **When** the developer updates the user-level extensions install, **Then** all repos immediately benefit with no per-project changes required.
4. **Given** a project defines its own `.github/agents/speckit.specify.agent.md`, **When** `/speckit.specify` runs in that project, **Then** the project-level definition takes precedence over the user-level global one.
5. **Given** the bootstrap script has already been run on a project, **When** it is run again, **Then** it skips all existing files without overwriting them and reports which artifacts were already present.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The workflow MUST run the issue-triage agent before `/speckit.specify` begins when GitHub MCP is reachable, presenting a prioritized list of open issues for the developer to select from.
- **FR-002**: The workflow MUST support selecting one or more GitHub issues to associate with a single spec, recording all linked issue numbers and URLs in spec.md's `GitHub Issue` field.
- **FR-003**: The workflow MUST verify GitHub MCP connectivity at the start of the `/speckit.specify` phase and skip the triage guard with a warning when unavailable.
- **FR-004**: The workflow MUST invoke the `conventional-commit` skill to generate commit messages at the end of every speckit phase that produces artifact changes (`/speckit.specify`, `/speckit.clarify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.checklist`, `/speckit.implement`, `/speckit.analyze`).
- **FR-005**: The workflow MUST NOT create a commit at the end of a phase if no artifact changes were made.
- **FR-006**: The workflow MUST update the `Status` field in spec.md to `Implemented` when all tasks in tasks.md are complete.
- **FR-007**: The workflow MUST update the `Status` field in spec.md to `Analyzed` when `/speckit.analyze` confirms consistency with no unresolved issues.
- **FR-008**: The workflow MUST create a GitHub PR and attach all linked issue(s) from spec.md when `/speckit.implement` completes and pushes the branch.
- **FR-009**: The workflow MUST check for a `stack.md` file in `.specify/memory/` at the start of any speckit command; if absent, present the developer with a choice between auto-detect and manual entry modes.
- **FR-010**: In auto-detect mode, the workflow MUST inspect the repository and populate all standard `stack.md` template fields from project files, leaving blank only fields that cannot be inferred.
- **FR-011**: In manual entry mode, the workflow MUST prompt the developer for each standard `stack.md` template field and write the provided values to `stack.md`.
- **FR-012**: The `stack.md` template MUST define a versioned set of standard fields (package manager, test library, linting tool, language version constraints, build tool, project type) that can be extended by adding new fields without invalidating existing entries.
- **FR-013**: The workflow MUST use values from `stack.md` in all task and command generation without re-prompting when the file is present and all required fields are populated.
- **FR-014**: The workflow MUST maintain a memory file listing open GitHub issues not yet associated with a spec branch, refreshed on each `/speckit.specify` run.
- **FR-015**: The workflow MUST prompt the developer to review the constitution when a paradigm shift is detected, and synchronize dependent templates after an update.
- **FR-016**: The constitution MUST be updated to document that the `conventional-commit` skill is required for all speckit-phase commits.
- **FR-017**: The workflow MUST add regression test execution as a step in the `/speckit.implement` phase; a failing test prevents the phase from being marked complete.
- **FR-018**: The workflow MUST update tasks.md with any additional tasks discovered during implementation and commit the update.
- **FR-019**: At the end of `/speckit.analyze` (or `/speckit.implement`), the workflow MUST diff spec.md, plan.md, and tasks.md against their state at branch-creation commit and report any detected mismatches between the written spec and actual changes.
- **FR-020**: When drift is detected, the workflow MUST present the diff to the developer and prompt for confirmation before updating any artifact.
- **FR-021**: When the developer confirms an artifact update due to drift, the workflow MUST revise the artifact to reflect the actual implementation direction and commit it using the `conventional-commit` skill.
- **FR-022**: When plan.md or tasks.md contain unresolved items (never implemented, not deferred), the workflow MUST flag them during drift detection and prompt the developer to remove or defer them.
- **FR-023**: The issue-triage invocation in `/speckit.specify` MUST be embedded directly in the `speckit.specify` agent definition (agent-to-agent call), not routed via an instructions file.
- **FR-024**: The `.github/instructions/issue-triage.instructions.md` file MUST be removed; its routing trigger ("when user says triage, invoke issue-triage agent") MUST be consolidated into `copilot-instructions.md` as a single reference line.
- **FR-025**: The "Constitution Principles (abridged)" section in `copilot-instructions.md` MUST be replaced with a single pointer to `.specify/memory/constitution.md`, eliminating the drift risk between the two files. A brief "Spec-Kit Workflow" reference MUST also be added to `copilot-instructions.md` pointing to the agent definitions.
- **FR-026**: The `context-map` skill MUST be invoked at the start of `/speckit.plan` to produce a map of files relevant to the feature before design artifacts are generated, ensuring plan.md references accurate file paths and dependencies.
- **FR-027**: The `context-map` skill MUST be invoked at the start of each task group in `/speckit.implement` before any code changes are made, identifying files to modify, dependent files, related tests, and risk areas for that task group.
- **FR-028**: The `github-issues` skill MUST be used during `/speckit.specify` to post a comment on each linked GitHub issue confirming the spec branch name and linking to the spec file, creating a visible trail from issue to spec.
- **FR-029**: The `github-issues` skill MUST be used during `/speckit.implement` to create the PR with `Closes #N` references for all linked issues, and to post a comment on each issue with the PR URL when opened.
- **FR-030**: The `sessionEnd` hook MUST be updated to detect uncommitted speckit artifacts (spec.md, plan.md, tasks.md with unstaged or staged-but-uncommitted changes on a speckit branch) and emit a warning before the session closes.
- **FR-031**: The `userPromptSubmitted` hook MUST be fixed to log the submitted prompt content (currently a copy-paste of `log-session-end.sh` — logs nothing useful) and extended to detect and log speckit phase command invocations for session-level audit trail.
- **FR-032**: The `sessionStart` hook MUST be updated to detect if the current branch is a speckit feature branch, and if so, log the active spec name, current status from spec.md, and the last committed speckit phase.
- **FR-033**: Each session-logger hook script MUST guard against prerequisites before writing: verify `logs/` is present in `.gitignore` and the `logs/copilot/` directory exists; emit a one-time actionable setup reminder and exit cleanly if either check fails.
- **FR-034**: The `/speckit.specify` agent MUST include a session boundary reminder at startup — informing the developer that new specs should begin in a fresh session — and surface the reminder as a non-blocking prompt if the session appears to have prior speckit conversation history.
- **FR-035**: Every speckit agent that resumes a workflow (`/speckit.plan`, `/speckit.tasks`, `/speckit.implement`, `/speckit.analyze`) MUST explicitly load the following context files at startup before generating any output: `.specify/memory/constitution.md`, `.specify/memory/stack.md` (if present), the current spec's `spec.md`, and any existing phase artifacts (`plan.md`, `tasks.md`). Only `copilot-instructions.md` is loaded automatically by the CLI; all other speckit context must be loaded explicitly.
- **FR-036**: The speckit repository MUST separate generic tooling (agents, skills, templates, scripts) from project-specific context (constitution, stack.md, specs) so that generic artifacts can be installed globally and project context always lives in the target repo.
- **FR-037**: A bootstrap script MUST be provided that, when run in a new repository, scaffolds the project-specific layer: creates a constitution stub at `.specify/memory/constitution.md`, creates an empty `.specify/memory/stack.md`, wires up session-logger hooks, adds `logs/` to `.gitignore`, and appends a speckit reference block to `copilot-instructions.md`.
- **FR-038**: The bootstrap script MUST be idempotent — running it multiple times on the same repository MUST skip all already-present artifacts without overwriting them and MUST report which items were skipped.
- **FR-039**: When a project defines a local agent or skill with the same name as a user-level global definition, the project-level definition MUST take precedence, enabling per-project overrides of the global speckit workflow.

### Key Entities

- **Constitution**: The project's authoritative source of standards, patterns, and conventions. Updated when paradigm shifts occur; drives template consistency. Documents the requirement to use the conventional-commit skill for all speckit-phase commits.
- **stack.md**: A versioned memory file in `.specify/memory/` containing a standardized, extensible set of project stack fields (package manager, test library, linter, language version constraints, build tool, project type). Populated via auto-detect or manual entry; read by all speckit agents for task and command generation.
- **Stack Template**: The canonical definition of all standard `stack.md` fields, versioned so new fields can be appended without invalidating existing entries. Lives alongside the other speckit templates.
- **Memory File (GitHub Issues)**: A file in `.specify/memory/` that tracks open GitHub issues not yet associated with a spec. Refreshed during the specify phase.
- **Phase Commit**: A git commit made at the end of each speckit phase capturing all artifact changes for that phase, with message generated by the conventional-commit skill.
- **Spec Status**: The lifecycle state of a spec (Draft → Planned → Tasked → In Progress → Implemented → Analyzed), automatically advanced by the workflow.
- **Drift Report**: The output of comparing spec artifacts (spec.md, plan.md, tasks.md) against their branch-creation state, identifying mismatches between what was specified and what was implemented.
- **Context Map**: The output of the `context-map` skill — a structured table of files to modify, dependencies, related tests, and risk areas. Produced before planning and before each implementation task group.
- **Session Audit Log**: The log written by the session-logger hooks to `logs/copilot/session.log`, capturing session start/end events, active speckit branch/phase, and prompt-level speckit command invocations.
- **Speckit Repo**: A standalone repository containing all generic, project-agnostic speckit tooling (agents, skills, templates, scripts, bootstrap script). Installed once at the user-level extensions directory; updated independently of any project repo.
- **Bootstrap Script**: A one-time idempotent setup script shipped in the speckit repo that scaffolds the project-specific speckit layer into a target repository (constitution stub, stack.md, hooks, .gitignore entry, copilot-instructions.md reference).
- **User-Level Extensions**: The Copilot CLI's personal extensions directory where agents and skills installed globally are available across all repositories, with project-level definitions taking precedence when names conflict.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of `/speckit.specify` runs where GitHub MCP is reachable present the issue-triage report before spec creation begins.
- **SC-002**: 100% of spec.md files include a `GitHub Issue` field with at least one linked issue when the developer confirms issue selection during specify.
- **SC-003**: 100% of speckit phases that produce artifact changes result in a git commit on the feature branch generated by the conventional-commit skill before the phase ends.
- **SC-004**: spec.md `Status` is automatically advanced to `Implemented` within the same session that `/speckit.implement` completes — no manual update required.
- **SC-005**: `stack.md` is created on first speckit use of a project; subsequent speckit commands across all features require zero re-prompting for stack fields already present in the file.
- **SC-006**: The GitHub issues memory file is accurate within one speckit session — issues linked to a spec are removed, and new open issues appear, after each specify phase run.
- **SC-007**: PRs created by the workflow reference all linked GitHub issues from spec.md 100% of the time when issue linkage data is available.
- **SC-008**: Regression tests are executed as part of every `/speckit.implement` run; a failing test prevents the phase from being marked complete.
- **SC-009**: 100% of `/speckit.analyze` runs on a feature branch with code changes produce a drift report comparing spec artifacts against their branch-creation state.
- **SC-010**: When the developer confirms a drift-based artifact update, the updated artifact is committed in the same session with no manual git steps required.

## Assumptions

- GitHub MCP server is already configured in the developer's Copilot CLI environment; this feature adds verification, triage integration, and usage, not initial setup.
- The `conventional-commit` skill is available in the project's `.github/extensions/` or the user extensions directory and can be invoked by speckit agents.
- The constitution file exists at `.specify/memory/constitution.md` and is the authoritative source for project standards.
- The speckit scripts (`.specify/scripts/`) are bash-based and can be extended to include git commit and push operations.
- "Paradigm shift" detection is heuristic — the workflow prompts for constitution review on significant dependency additions or pattern-level changes rather than detecting it automatically.
- `stack.md` is project-scoped, not per-feature; it is created once and shared across all features in the repository.
- The `stack.md` template is versioned with a schema version field so future extensions (new standard fields) can be detected and incrementally prompted without full re-entry.
- Drift detection uses `git diff <branch-creation-commit>..HEAD` scoped to spec artifact paths (spec.md, plan.md, tasks.md); it does not analyze source code semantics.
- `copilot-instructions.md` and `constitution.md` serve different purposes and MUST coexist: `copilot-instructions.md` is the model's operational quick reference (commands, import paths, code patterns); the constitution is the governance document (principles, rationale, amendment procedure). The "abridged" principles section in `copilot-instructions.md` creates a drift risk and will be replaced with a pointer to the constitution as part of this feature.
- `.github/instructions/issue-triage.instructions.md` with `applyTo: "**"` is a global context file that duplicates routing logic better placed in `copilot-instructions.md`. It has no role in agent-to-agent invocation and will be removed.
- The `context-map` and `github-issues` skills are already present in `.github/skills/`; this feature wires them into speckit agent definitions rather than creating new skills.
- The `github-issues` skill handles both MCP-based operations (preferred) and `gh api` fallback; internet/MCP connectivity is required for issue commenting and PR creation.
- Session-logger hooks are shell scripts fired by the Copilot CLI runtime and cannot influence model behavior; they serve only as observability and safety-net tooling. Hook improvements in FR-030–FR-032 are low-risk shell changes.
- The `userPromptSubmitted` hook (`log-prompt.sh`) is currently a copy-paste of `log-session-end.sh` and logs nothing meaningful. FR-031 treats this as a bug fix as well as an enhancement.
- Hooks operate at session boundaries; they cannot detect speckit phase transitions mid-session except via prompt text pattern matching in `userPromptSubmitted`.
- `copilot-instructions.md` is the only file loaded automatically by the Copilot CLI into every session context. Constitution, stack.md, and spec artifacts are NOT automatically injected — speckit agents must read them explicitly (FR-035).
- Session boundary enforcement (FR-034) is advisory, not hard-blocking: the CLI has no API to terminate a session mid-conversation; the agent can warn but not force a new session.
- The session-logger hook setup (chmod +x, logs/ in .gitignore) is a one-time project-level task. Because the hooks.json uses a `bash` prefix for invocation, the execute bit may not be strictly required at runtime, but the `.gitignore` guard (FR-033) is critical to prevent session log data from being committed.
- The Copilot CLI's local-over-global override behavior (FR-039) is a platform convention, not something this feature implements; the FR documents the expected behavior to rely on, not something to build.
- The speckit repo is out of scope for implementation in this feature; FR-036–FR-039 define the portability contract so that the current implementation is structured to support extraction. The actual standalone repo creation is a future activity.
- The exact location of the user-level Copilot CLI extensions directory is platform-dependent; the bootstrap script must handle this gracefully (document the path, fail with a clear error if not found).
