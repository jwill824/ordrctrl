# Tasks: Spec-Kit Workflow Update

**Input**: Design documents from `/specs/020-speckit-workflow/`  
**Branch**: `020-speckit-workflow` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)  
**Prerequisites**: ✅ spec.md, ✅ plan.md, ✅ research.md, ✅ data-model.md

> **Scope**: Pure tooling — zero application source code changes. All changes target `.github/`, `.specify/`, and `.gitignore`.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (independent files, no blocking deps)
- **[USN]**: User story this task belongs to
- All file paths are repo-root-relative

---

## Phase 1 — Setup

> Initialize shared infrastructure required by all phases.

**Goal**: `.gitignore` guards session logs; `stack-template.md` schema exists for stack-aware agents.

- [x] T001 Add `logs/` entry to `.gitignore` (repo root) so session-logger output is never committed
- [x] T002 [P] Create `.specify/templates/stack-template.md` with schema v1.0 per `data-model.md` — include all 11 sections (Meta, Packaging, Version Constraints, Linting, Testing, Build, Infrastructure, Database, Project Type, Commit Convention, Regression Tests), `schema_version: "1.0"` header, auto-detectable flags, and version upgrade procedure note

---

## Phase 2 — Foundational

> Changes that all user-story phases depend on. Must complete before Phases 3+.

**Goal**: Pre-commit summary guard active; `copilot-instructions.md` no longer contains stale abridged constitution.

- [x] T003 Update `.github/skills/conventional-commit/SKILL.md` — replace step 5 "no confirmation needed / auto-runs git commit" with a conversational pre-commit summary step: show staged files + generated message, ask "Proceed with this commit? (yes/no)"; on YES run `git commit`; on NO abort and inform developer phase is not marked complete
- [x] T004 [P] Update `.github/copilot-instructions.md` — remove the "Constitution Principles (abridged)" section (I–V only, stale); replace with a pointer: `> Full constitution and workflow principles: [`.specify/memory/constitution.md`](.specify/memory/constitution.md)`; add one-line speckit workflow reference below it

---

## Phase 3 — US1 · GitHub Issue Traceability (P1)

> **Story**: As a developer, when I run `/speckit.specify`, the agent automatically runs issue triage, links one or more GitHub issues to the spec, and posts traceability comments back to those issues.

**Independent test criteria**:
- Running `/speckit.specify` on a fresh branch triggers issue-triage guard before writing spec.md
- Multiple issue numbers are written to spec.md `GitHub Issue` field as `#N, #N` comma list
- After spec.md is saved, a comment appears on each linked GitHub issue

**Tasks**:

- [x] T005 [US1] Update `.github/agents/speckit.specify.agent.md` — add session boundary check at top: if prior session history detected, surface a non-blocking reminder ("New session recommended per US8 — continue or start fresh?")
- [x] T006 [US1] Update `.github/agents/speckit.specify.agent.md` — add issue-triage guard block: (1) attempt GitHub MCP connectivity check; (2) if reachable, invoke `issue-triage` agent and await selection; (3) if unreachable, warn and allow manual issue number entry; (4) write all selected issue numbers to spec.md `GitHub Issue` front-matter field as comma-separated `#N, #N` list
- [x] T007 [P] [US1] Update `.github/agents/speckit.specify.agent.md` — after spec.md is written and committed, invoke `github-issues` skill to post a traceability comment on **each** linked issue: include branch name, spec title, and link to spec.md in the repo
- [x] T008 [P] [US1] Update `.github/agents/speckit.implement.agent.md` — after all tasks complete, invoke `github-issues` skill to: (1) create PR with `Closes #N` for every issue in spec.md `GitHub Issue` field; (2) post PR URL as comment on each linked issue

---

## Phase 4 — US2 · Per-Phase Conventional Commits (P2)

> **Story**: As a developer, every speckit phase agent commits its output artifact(s) using the `conventional-commit` skill with a pre-commit summary, so the git history is always in sync with spec progress.

**Independent test criteria**:
- After each speckit agent completes its phase, `git log --oneline` shows a new commit scoped to that phase
- Running any agent with no artifact changes produces "No changes to commit" (no empty commits)
- The conventional-commit skill presents staged files + message before committing

**Tasks**:

- [x] T009 [US2] Update `.specify/memory/constitution.md` — add to Principle VI (Spec-Kit Workflow): "Every speckit phase MUST end with a `conventional-commit` skill invocation. Phase commits follow the format `docs(<phase>): <description> (#<issue>)`."
- [x] T010 [US2] Update `.github/agents/speckit.specify.agent.md` — add Phase-End Commit Block: (1) run `git status --short` scoped to `specs/$BRANCH/`; (2) if no changes skip with "No changes to commit"; (3) if changes, invoke `conventional-commit` skill; type=`docs`, scope=`spec`, include issue numbers in footer
- [x] T011 [P] [US2] Update `.github/agents/speckit.clarify.agent.md` — add Phase-End Commit Block (same pattern as T010; scope=`clarify`)
- [x] T012 [P] [US2] Update `.github/agents/speckit.plan.agent.md` — add Phase-End Commit Block (scope=`plan`)
- [x] T013 [P] [US2] Update `.github/agents/speckit.tasks.agent.md` — add Phase-End Commit Block (scope=`tasks`)
- [x] T014 [P] [US2] Update `.github/agents/speckit.checklist.agent.md` — add Phase-End Commit Block (scope=`checklist`)
- [x] T015 [P] [US2] Update `.github/agents/speckit.analyze.agent.md` — add Phase-End Commit Block (scope=`analyze`)
- [x] T016 [P] [US2] Update `.github/agents/speckit.implement.agent.md` — add Phase-End Commit Block (scope=`implement`); note: implement may produce multiple commits per task group — each group gets its own commit via `conventional-commit` skill

---

## Phase 5 — US3 · Automatic Spec Status Advancement (P2)

> **Story**: As a developer, spec.md `Status` is automatically advanced at the end of each phase so it always reflects the true workflow state without manual edits.

**Independent test criteria**:
- After `/speckit.implement` completes, spec.md `Status` reads `Implemented`
- After `/speckit.analyze` completes, spec.md `Status` reads `Analyzed`
- Status advancement is included in the phase-end commit (not a separate commit)

**Tasks**:

- [x] T017 [US3] Update `.github/agents/speckit.implement.agent.md` — before Phase-End Commit Block (T016), add status advancement step: update spec.md `**Status**:` line from `Tasked` → `Implementing` at start, then → `Implemented` on completion; include status change in the phase-end commit
- [x] T018 [P] [US3] Update `.github/agents/speckit.analyze.agent.md` — before Phase-End Commit Block (T015), add status advancement step: update spec.md `**Status**:` line → `Analyzed` on completion; include in phase-end commit

---

## Phase 6 — US8 · Session Lifecycle Management (P2)

> **Story**: As a developer, the session-logger hooks are reliable and self-guarding, each speckit phase explicitly loads prior context at startup, and the workflow enforces fresh sessions for new specs.

**Independent test criteria**:
- Running any hook script when `logs/` is absent from `.gitignore` prints a setup warning and exits cleanly (exit 0)
- `log-prompt.sh` writes prompt content to `logs/copilot/` (not a "sessionEnd" event)
- On a speckit branch, `log-session-start.sh` logs spec name + status in the session JSON
- Each resuming agent (plan, tasks, implement, analyze) prints a one-line context summary at startup

**Tasks**:

- [x] T019 [US8] Fix `.github/hooks/session-logger/log-prompt.sh` — rewrite to actually capture prompt content: log a JSON object with `event: "userPromptSubmitted"`, `prompt` text, `timestamp`, and `branch`; remove copy-pasted "sessionEnd" event code
- [x] T020 [US8] Update `.github/hooks/session-logger/log-session-start.sh` — add `.gitignore` guard at top (check `grep -q '^logs/' .gitignore`); if missing, print `⚠️  speckit-setup: add 'logs/' to .gitignore` and `exit 0`; add `mkdir -p logs/copilot` guard
- [x] T021 [P] [US8] Update `.github/hooks/session-logger/log-session-end.sh` — add same `.gitignore` guard (T020 pattern); add speckit branch detection: if on a `NNN-*` branch with uncommitted changes to `specs/$BRANCH/`, append `⚠️  uncommitted spec artifacts detected` warning to session log
- [x] T022 [P] [US8] Update `.github/hooks/session-logger/log-session-start.sh` — add speckit branch detection block: extract `BRANCH`, check for `specs/$BRANCH/spec.md`, read `**Status**:` line, log `speckit_context: { spec, status, last_phase }` into session-start JSON
- [x] T023 [US8] Update `.github/agents/speckit.specify.agent.md` — add fresh-session enforcement reminder at very top (above issue-triage guard): "This agent should run in a new Copilot CLI session. If you have prior conversation history, start a new session before proceeding."
- [x] T024 [P] [US8] Update `.github/agents/speckit.plan.agent.md` — add Context Loading Preamble as first numbered section: (1) Read `.specify/memory/constitution.md`; (2) Read `.specify/memory/stack.md` — warn if absent; (3) Read `spec.md`; (4) Output one-line summary: `Loaded: [spec name] | Status: [status] | Stack: [tool]`
- [x] T025 [P] [US8] Update `.github/agents/speckit.tasks.agent.md` — add same Context Loading Preamble (T024 pattern): read constitution.md, stack.md, spec.md, plan.md; output context summary line
- [x] T026 [P] [US8] Update `.github/agents/speckit.implement.agent.md` — add Context Loading Preamble (T024 pattern): read constitution.md, stack.md, spec.md, plan.md, tasks.md; output context summary line

---

## Phase 7 — US4 · Stack-Aware Agents (P3)

> **Story**: As a developer, speckit agents read a versioned `stack-template.md` schema to auto-detect or prompt for the project stack, storing results in `.specify/memory/stack.md` so all subsequent agents have consistent stack context.

**Independent test criteria**:
- `/speckit.specify` run on a project without `stack.md` offers auto-detect or manual-entry flow
- `.specify/memory/stack.md` written by specify contains all required v1.0 fields
- plan, tasks, implement, analyze agents each print the stack context line at startup

**Tasks**:

- [x] T027 [US4] Update `.github/agents/speckit.specify.agent.md` — add stack check block after issue-triage guard: (1) check if `.specify/memory/stack.md` exists; (2) if absent, read `.specify/templates/stack-template.md` schema; (3) offer two options — "Auto-detect from repo" (inspect lock files, package.json, config files) or "Manual entry"; (4) write populated `stack.md` using template field order and `schema_version: "1.0"`; (5) if present but `schema_version` < template version, prompt only for missing fields
- [x] T028 [P] [US4] Update `.github/agents/speckit.plan.agent.md` — in Context Loading Preamble (T024), after reading stack.md, surface tech-specific notes: e.g. if `testing.backend_framework = vitest`, reference vitest patterns in plan; if `database.orm = prisma`, note migration steps
- [x] T029 [P] [US4] Update `.github/agents/speckit.tasks.agent.md` — in Context Loading Preamble (T025), after reading stack.md, use `regression_tests` section to populate task descriptions with correct lint/test commands from stack.md rather than hardcoded values
- [x] T030 [P] [US4] Update `.github/agents/speckit.implement.agent.md` — in Context Loading Preamble (T026), after reading stack.md, use `regression_tests.lint_cmd` and `regression_tests.test_cmd` for post-implementation validation steps; use `packaging.install_cmd` for dependency install instructions
- [x] T031 [P] [US4] Update `.github/agents/speckit.analyze.agent.md` — add Context Loading Preamble (T024 pattern): read constitution.md, stack.md, spec.md, plan.md, tasks.md; output context summary; use stack.md `regression_tests` section to validate that implementation tasks referenced correct commands

---

## Phase 8 — US5 · Issues Backlog Refresh (P3)

> **Story**: As a developer, running `/speckit.specify` on an existing branch refreshes the `issues-backlog.md` snapshot so issue selection is always up-to-date.

**Independent test criteria**:
- Running `/speckit.specify` on a branch that already has a spec.md updates `issues-backlog.md` timestamp
- If GitHub MCP is unreachable, the existing `issues-backlog.md` is preserved and a warning is shown

**Tasks**:

- [x] T032 [US5] Update `.github/agents/speckit.specify.agent.md` — after MCP connectivity check (T006), add backlog refresh step: if MCP reachable, invoke `issue-triage` agent in refresh mode and overwrite `.specify/memory/issues-backlog.md` with current open issues snapshot + `last_refreshed` timestamp; if MCP unreachable, read existing `issues-backlog.md` and note its age

---

## Phase 9 — US6 · Paradigm Shift Detection (P3)

> **Story**: As a developer, speckit agents detect when a proposed change would require updating foundational templates (constitution, stack template, agent templates) and prompt explicitly before proceeding.

**Independent test criteria**:
- Specifying a feature that adds a new required stack field triggers a template-sync prompt
- speckit.clarify detects constitution-level changes and surfaces them before writing

**Tasks**:

- [x] T033 [US6] Update `.github/agents/speckit.specify.agent.md` — add paradigm shift detection block before writing spec.md: scan spec content for signals of stack changes (new language/framework, new ORM, new test runner) or workflow changes (new phase, new commit format); if detected, present: "This spec may require updating `.specify/templates/stack-template.md` or `.specify/memory/constitution.md` — review before proceeding (yes/no)"
- [x] T034 [P] [US6] Update `.github/agents/speckit.clarify.agent.md` — add Context Loading Preamble (T024 pattern) and paradigm shift check: if clarification answers change core architecture (project type, ORM, packaging tool), flag that `stack.md` and `stack-template.md` may need updating; surface this as a clarification output item before phase-end commit

---

## Phase 10 — US7 · Spec Artifact Drift Detection (P3)

> **Story**: As a developer, `/speckit.analyze` compares spec.md, plan.md, and tasks.md against the branch-creation baseline and surfaces any mismatches so docs stay in sync with what was actually built.

**Independent test criteria**:
- `/speckit.analyze` run after implementation changes shows a diff of spec artifacts vs branch-creation commit
- Unresolved tasks (in tasks.md, never referenced in a commit) are flagged
- Developer is prompted per artifact to accept or skip each update

**Tasks**:

- [x] T035 [US7] Update `.github/agents/speckit.analyze.agent.md` — add drift detection block before status advancement (T018): (1) find branch-creation commit with `git log --oneline --reverse HEAD | head -1 | cut -d' ' -f1`; (2) run `git diff $BASE_COMMIT..HEAD -- specs/$BRANCH/spec.md specs/$BRANCH/plan.md specs/$BRANCH/tasks.md`; (3) if diff is empty, report "No spec artifact drift detected"
- [x] T036 [US7] Update `.github/agents/speckit.analyze.agent.md` — add drift report presentation: for each artifact with changes, show a structured diff summary (sections added/removed/changed) and prompt: "Update [artifact] to reflect implementation changes? (yes/skip)"; on yes, assist developer in editing that artifact; on skip, continue
- [x] T037 [P] [US7] Update `.github/agents/speckit.analyze.agent.md` — add unresolved-item check: scan tasks.md for unchecked items (`- [ ]`); cross-reference with `git log --oneline` for task-related commits; flag any tasks with no corresponding commit as "possibly unimplemented or not deferred — confirm status"

---

## Phase 11 — US9 · Portability Contract (P3)

> **Story**: As a developer, speckit tooling is cleanly separated from project-specific context so it can be bootstrapped into any new repository with a single script.

**Independent test criteria**:
- `bootstrap.sh` runs on a fresh repo and creates the full `.github/` and `.specify/` directory structure
- `PORTABILITY.md` clearly lists which files are generic tooling vs project-specific

**Tasks**:

- [x] T038 [US9] Create `docs/speckit-portability.md` — document the portability contract: list all generic speckit files (agents, skills, hooks, templates) vs project-specific files (constitution.md, stack.md, copilot-instructions.md); include instructions for applying speckit to a new repo; note that user-level Copilot CLI extensions directory enables global installation without per-repo file copies
- [x] T039 [P] [US9] Create `.specify/scripts/bash/bootstrap.sh` — script that initializes the full speckit structure in a target repo: creates `.github/agents/`, `.github/skills/`, `.github/hooks/`, `.specify/memory/`, `.specify/templates/`, `.specify/scripts/`; copies generic agent/skill/hook files; adds `logs/` to `.gitignore`; prints next-steps instructions for creating constitution.md and stack.md

---

## Phase 12 — Polish & Verification

> Verify all changed files are consistent, no broken references, and the workflow is end-to-end coherent.

- [x] T040 Run `pnpm lint` from repo root and confirm zero new errors introduced by any markdown/shell changes
- [x] T041 [P] Verify all 7 speckit agent files contain: (1) Context Loading Preamble, (2) Phase-End Commit Block referencing `conventional-commit` skill — open each `.github/agents/speckit.*.agent.md` and confirm presence
- [x] T042 [P] Verify all 3 hook scripts contain `.gitignore` guard — open each `.github/hooks/session-logger/*.sh` and confirm `grep -q '^logs/' .gitignore` guard is present at top of each; verify `log-prompt.sh` logs `userPromptSubmitted` event (not `sessionEnd`)

---

## Dependency Graph

```
Phase 1 (T001, T002)
  └─► Phase 2 (T003, T004)  ← blocks all user-story phases
        ├─► Phase 3 US1 (T005–T008)   P1 — start here
        ├─► Phase 4 US2 (T009–T016)   P2
        │     └─ T009 (constitution) must precede T010–T016 (agents)
        ├─► Phase 5 US3 (T017–T018)   P2 — depends on Phase 4 (commit blocks must exist)
        ├─► Phase 6 US8 (T019–T026)   P2
        │     └─ T019–T022 (hooks) parallelizable; T023–T026 (agents) parallelizable
        ├─► Phase 7 US4 (T027–T031)   P3 — T027 (specify) must precede T028–T031
        ├─► Phase 8 US5 (T032)        P3 — depends on Phase 3 (MCP guard in specify)
        ├─► Phase 9 US6 (T033–T034)   P3
        ├─► Phase 10 US7 (T035–T037)  P3 — T035 must precede T036, T037
        ├─► Phase 11 US9 (T038–T039)  P3 — independent
        └─► Phase 12 Polish (T040–T042) — after all phases complete
```

**US priority execution order**: US1 → US2 → US3 → US8 → US4 → US5 → US6 → US7 → US9

---

## Parallel Execution Opportunities

| Phase | Parallelizable tasks |
|-------|----------------------|
| Phase 1 | T001 ‖ T002 |
| Phase 4 | T011 ‖ T012 ‖ T013 ‖ T014 ‖ T015 ‖ T016 (after T009–T010) |
| Phase 6 | T020 ‖ T021 ‖ T022 (hooks); T024 ‖ T025 ‖ T026 (agents) |
| Phase 7 | T028 ‖ T029 ‖ T030 ‖ T031 (after T027) |
| Phase 11 | T038 ‖ T039 |
| Phase 12 | T041 ‖ T042 |

---

## Implementation Strategy

**MVP scope (Phase 1–3 only)**: Deliver US1 (issue triage guard + multi-issue + traceability comments). This is the highest-value P1 story and validates the GitHub MCP integration path for all downstream stories.

**Incremental delivery order**:
1. Phases 1–2 (Setup + Foundational) — unblock everything; fix the conventional-commit auto-commit bug
2. Phase 3 (US1) — P1, highest priority
3. Phases 4–6 (US2, US3, US8) — P2 stories; all agent-level changes
4. Phases 7–11 (US4–US9) — P3 stories; can be deferred without blocking P1/P2 value
5. Phase 12 (Polish) — final gate before marking spec Implemented

**Total tasks**: 42  
**By user story**: US1=4, US2=8, US3=2, US4=5, US5=1, US6=2, US7=3, US8=8, US9=2 | Setup=2, Foundational=2, Polish=3
