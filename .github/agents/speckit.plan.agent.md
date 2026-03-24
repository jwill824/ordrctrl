---
description: Execute the implementation planning workflow using the plan template to generate design artifacts.
handoffs: 
  - label: Create Tasks
    agent: speckit.tasks
    prompt: Break the plan into tasks
    send: true
  - label: Create Checklist
    agent: speckit.checklist
    prompt: Create a checklist for the following domain...
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. **Context Loading** (run at startup before any output):
   1. Read `.specify/memory/constitution.md`
   2. Read `.specify/memory/stack.md` — if absent, warn: "⚠️  stack.md missing — run `/speckit.specify` first to initialize stack context"
   3. If stack.md is present, surface tech-specific notes:
      - If `testing.backend_framework = vitest`: reference Vitest patterns in the plan (e.g., `vi.mock()`, `describe/it` blocks)
      - If `database.orm = prisma`: note migration steps (`prisma migrate dev`) and client import conventions
      - If `packaging.tool = pnpm`: use pnpm workspace commands for dependency install
      - Apply similar tech-specific guidance for other detected stack values
   4. Read current spec's `spec.md`
   5. Read existing `plan.md` if present (for incremental updates)
   6. Output one-line summary: `Loaded: [spec name] | Status: [status] | Stack: [packaging tool]`
   7. Invoke the `context-map` skill to produce a map of all files relevant to this feature before generating any design artifacts — use the resulting file list to ensure plan.md references accurate paths and dependencies.

2. **Setup**: Run `.specify/scripts/bash/setup-plan.sh --json` from repo root and parse JSON for FEATURE_SPEC, IMPL_PLAN, SPECS_DIR, BRANCH. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Load context**: Read FEATURE_SPEC and `.specify/memory/constitution.md`. Load IMPL_PLAN template (already copied).

3. **Execute plan workflow**: Follow the structure in IMPL_PLAN template to:
   - Fill Technical Context (mark unknowns as "NEEDS CLARIFICATION")
   - Fill Constitution Check section from constitution
   - Evaluate gates (ERROR if violations unjustified)
   - Phase 0: Generate research.md (resolve all NEEDS CLARIFICATION)
   - Phase 1: Generate data-model.md, contracts/, quickstart.md
   - Phase 1: Update agent context by running the agent script
   - Re-evaluate Constitution Check post-design

4. **Stop and report**: Command ends after Phase 2 planning. Report branch, IMPL_PLAN path, and generated artifacts.

## Phases

### Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```text
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

### Phase 1: Design & Contracts

**Prerequisites:** `research.md` complete

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Define interface contracts** (if project has external interfaces) → `/contracts/`:
   - Identify what interfaces the project exposes to users or other systems
   - Document the contract format appropriate for the project type
   - Examples: public APIs for libraries, command schemas for CLI tools, endpoints for web services, grammars for parsers, UI contracts for applications
   - Skip if project is purely internal (build scripts, one-off tools, etc.)

3. **Agent context update**:
   - Run `.specify/scripts/bash/update-agent-context.sh copilot`
   - These scripts detect which AI agent is in use
   - Update the appropriate agent-specific context file
   - Add only new technology from current plan
   - Preserve manual additions between markers

**Output**: data-model.md, /contracts/*, quickstart.md, agent-specific file

## Key rules

- Use absolute paths
- ERROR on gate failures or unresolved clarifications

## Phase-End Commit

1. Run `git status --short` scoped to `specs/$BRANCH/` to check for changes
2. If no changes: report "No changes to commit" and skip
3. If changes exist: invoke the `conventional-commit` skill with:
   - type: `docs`
   - scope: `plan`
   - description: `add implementation plan for NNN-feature-name`
   - footer: issue numbers from spec.md `GitHub Issue` field (e.g., `Refs: #31`)
4. Await developer confirmation before committing (per `conventional-commit` skill workflow)
