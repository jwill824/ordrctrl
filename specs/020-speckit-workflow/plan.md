# Implementation Plan: Spec-Kit Workflow Update

**Branch**: `020-speckit-workflow` | **Date**: 2026-03-22 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/020-speckit-workflow/spec.md`

## Summary

Update the speckit workflow tooling to integrate GitHub issue traceability, enforce per-phase conventional commits with a pre-commit summary guard, add stack-aware context loading in all agents, implement spec artifact drift detection, wire in the `context-map` and `github-issues` skills, fix and extend the session-logger hooks, and lay the groundwork for future portability via a clean separation of generic tooling from project-specific context. This feature touches exclusively non-application files: agent definitions, skill definitions, hook scripts, templates, and config files. No backend or frontend source code changes are required.

## Technical Context

**Language/Version**: Node.js (TypeScript) — pnpm monorepo; hook scripts in Bash  
**Primary Dependencies**: Copilot CLI agent/skill/hook system; GitHub MCP; `gh` CLI fallback; `jq` (Bash hooks); `git`  
**Storage**: Markdown files (`.specify/memory/`, `.github/agents/`, `.github/skills/`, `.specify/templates/`); `.gitignore`  
**Testing**: `pnpm lint` (ESLint); `pnpm test` (Vitest backend); no new test suite required — changes are agent/shell/markdown files  
**Target Platform**: GitHub Copilot CLI (macOS/Linux); Bash hooks  
**Project Type**: Developer tooling / workflow automation  
**Performance Goals**: N/A — no runtime performance impact on the application  
**Constraints**: All changes must be backward-compatible with existing speckit workflow; agents must gracefully degrade when GitHub MCP is unavailable  
**Scale/Scope**: ~14 files modified or created; zero application source code changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Integration Modularity | ✅ Pass | No integration adapter code touched |
| II. Minimalism-First | ✅ Pass | All changes are in speckit tooling only; no new UI surfaces |
| III. Security & Privacy | ✅ Pass | No token handling or user data involved; hook logs are local-only and gitignored |
| IV. Test Coverage Required | ✅ Pass | No new application logic; agent/skill changes are markdown/shell — no test suite change required |
| V. Simplicity & Deferred Decisions | ✅ Pass | No new dependencies; changes use existing Copilot CLI primitives |
| VI. Spec-Kit Workflow | ✅ Pass | This feature *is* the spec-kit workflow update; it advances the workflow itself |

**No violations. No Complexity Tracking required.**

## Project Structure

### Documentation (this feature)

```text
specs/020-speckit-workflow/
├── plan.md              ← this file
├── research.md          ← Phase 0 output (no unknowns; see below)
├── data-model.md        ← Phase 1 output (stack.md template schema)
└── tasks.md             ← Phase 2 output (/speckit.tasks — not created here)
```

### Files Changed / Created by This Feature

```text
# Agent definitions (modified)
.github/agents/
├── speckit.specify.agent.md    ← add: issue-triage guard, multi-issue, MCP check, session reminder, github-issues skill, stack check, conventional-commit skill
├── speckit.plan.agent.md       ← add: explicit context loading, context-map skill, conventional-commit skill
├── speckit.tasks.agent.md      ← add: explicit context loading, conventional-commit skill
├── speckit.implement.agent.md  ← add: context-map skill, regression tests, spec status update, github-issues skill (PR), conventional-commit skill
├── speckit.analyze.agent.md    ← add: drift detection, spec status update, conventional-commit skill
├── speckit.clarify.agent.md    ← add: conventional-commit skill
└── speckit.checklist.agent.md  ← add: conventional-commit skill

# Skill definitions (modified)
.github/skills/
└── conventional-commit/
    └── SKILL.md               ← update: add pre-commit summary + confirmation gate (FR-040); remove "no confirmation needed" auto-commit

# Hook scripts (modified)
.github/hooks/session-logger/
├── log-session-start.sh        ← add: .gitignore guard; speckit branch detection + context summary log
├── log-session-end.sh          ← add: .gitignore guard; uncommitted speckit artifact warning
└── log-prompt.sh               ← fix: copy-paste bug (currently clone of log-session-end.sh); add speckit phase command detection

# Templates (created)
.specify/templates/
└── stack-template.md           ← CREATE: versioned standard fields schema for stack.md

# Config (modified)
.github/copilot-instructions.md ← replace abridged constitution section with pointer; add speckit workflow reference

# Repo root
.gitignore                      ← add: logs/ entry
```

## Phase 0: Research

No NEEDS CLARIFICATION markers identified. All technical decisions are resolved from existing codebase inspection:

**Decision 1 — Pre-commit summary pattern (FR-040)**
- Decision: Conversational confirmation step added to `conventional-commit` SKILL.md before `git commit` runs
- Rationale: Copilot CLI YOLO mode bypasses tool execution prompts but not model-to-user conversational questions; placing the summary+confirm in the skill's instruction text makes it immune to YOLO
- Alternative rejected: Adding a shell `read` in the commit script — would not work in all TTY contexts and would be bypassable

**Decision 2 — Hook prerequisite guard strategy (FR-033)**
- Decision: Each hook script checks for `logs/` in `.gitignore` using `grep -q '^logs/' .gitignore` and for directory existence before writing
- Rationale: Idiomatic Bash, no new dependencies; `jq` already used in `log-session-start.sh`
- Alternative rejected: Relying on README instructions alone — too easy to miss on new machine setup

**Decision 3 — Speckit branch detection in hooks (FR-032)**
- Decision: Detect speckit branch with `git branch --show-current | grep -E '^[0-9]+-'`; extract spec name from `specs/$(git branch --show-current)/spec.md` Status line
- Rationale: Zero new dependencies; branch naming convention is already enforced

**Decision 4 — Drift detection approach (FR-019)**
- Decision: `git diff $(git log --oneline --reverse | head -1 | cut -d' ' -f1)..HEAD -- specs/NNN-*/spec.md specs/NNN-*/plan.md specs/NNN-*/tasks.md`
- Rationale: Uses git-native diff scoped to spec artifact paths; no semantic analysis of source code

**Decision 5 — stack-template.md schema**
- Decision: Versioned YAML-like markdown with a `schema_version` field + standard sections: Packaging, Version Constraints, Linting, Testing, Build, Infrastructure, Database, Project Type
- Rationale: Matches existing `stack.md` structure exactly; version field enables future field additions without full re-prompting

## Phase 1: Design

### Data Model — stack-template.md Schema

The `stack-template.md` defines the canonical field set for any project's `stack.md`. It is versioned so new fields can be appended without invalidating existing entries.

**Standard Fields (v1.0)**

| Section | Fields | Required | Auto-detectable |
|---------|--------|----------|----------------|
| Meta | `schema_version`, `last_updated`, `updated_by` | Yes | Partial |
| Packaging | `tool`, `workspace_file`, `lock_file`, `install_cmd`, `add_dep_cmd` | Yes | Yes — detect from lock file |
| Version Constraints | `node_version`, `package_manager_version`, `language_version` | No | Yes — from `package.json` engines |
| Linting | `tool`, `config_file`, `lint_cmd`, `fix_cmd` | Yes | Yes — from config files |
| Testing | `backend_framework`, `backend_run_cmd`, `frontend_unit_cmd`, `frontend_e2e_cmd` | Yes | Yes — from `package.json` scripts |
| Build | `build_cmd` | Yes | Yes |
| Infrastructure | `local_dev_cmd`, `required_services` | No | Partial |
| Database | `orm`, `schema_file`, `migrate_cmd`, `generate_cmd` | No | Yes — if Prisma detected |
| Project Type | `type` (web-service / mobile-app / library / cli / desktop-app) | Yes | Yes — from repo structure |
| Commit Convention | `format`, `phase_commit_formats` | Yes | No — copied from constitution |
| Regression Tests | `lint_cmd`, `test_cmd`, `e2e_cmd`, `e2e_requires` | Yes | Yes |

**Version upgrade path**: When `schema_version` in an existing `stack.md` is lower than the template's current version, the speckit workflow prompts only for missing fields and appends them. Existing fields are never overwritten.

### Agent Change Design

Each agent gets a standardized preamble block and a phase-end commit block:

**Context Loading Preamble** (for all resuming agents: plan, tasks, implement, analyze):
```
## Context Loading (run at startup before any output)
1. Read `.specify/memory/constitution.md`
2. Read `.specify/memory/stack.md` (if present; surface missing-stack warning if absent)
3. Read current spec's `spec.md`
4. Read any existing phase artifacts (plan.md, tasks.md) if present
5. Output a one-line context summary: "Loaded: [spec name] | Status: [status] | Stack: [tool]"
```

**Phase-End Commit Block** (for all 7 phases):
```
## Phase Commit (run at end of phase if artifacts changed)
1. Run `git status --short` scoped to spec artifact paths
2. If no changes: skip commit, report "No changes to commit"
3. If changes: invoke `conventional-commit` skill
   - Skill presents: staged files list + generated message
   - Await developer confirmation
   - On confirm: commit; On decline: abort phase, do not mark complete
```

**speckit.specify additions**:
- Session boundary reminder at top (non-blocking if prior history detected)
- MCP connectivity check → run issue-triage agent if reachable, else warn + skip
- Multi-issue selection → write all to `GitHub Issue` field as `#N, #N` list
- Stack check → if `stack.md` absent, offer auto-detect vs manual entry
- Post-spec: `github-issues` skill posts branch+spec link comment on each linked issue

**speckit.implement additions**:
- Per task-group: invoke `context-map` skill before editing files
- Post all tasks complete: run regression tests (`pnpm lint && pnpm test`)
- Update spec.md Status → Implemented
- `github-issues` skill: create PR with `Closes #N` for all linked issues; post PR URL comment

**speckit.analyze additions**:
- Drift detection: `git diff <branch-creation-commit>..HEAD -- specs/020-*/spec.md plan.md tasks.md`
- Present diff → confirm per artifact → update or skip
- Flag unresolved plan.md/tasks.md items (never implemented, not deferred)
- Update spec.md Status → Analyzed

### conventional-commit Skill Change Design

Current step 5 reads: *"Copilot will automatically run the following command… (no confirmation needed)"*

New step 5:
```
5. Present a pre-commit summary to the developer:
   - List of files staged (from `git status --short`)
   - Generated commit message (type, scope, description, body if any)
   Ask: "Proceed with this commit? (yes/no)"
   - On YES: run `git commit -m "..."`
   - On NO: do not commit; inform developer the phase is not marked complete
```

This is a conversational prompt, not a shell command — it is unaffected by YOLO/auto-approve mode.

## Complexity Tracking

No violations. All changes use existing file types (Markdown, Bash) and existing Copilot CLI extension primitives. No new infrastructure, dependencies, or patterns introduced.
