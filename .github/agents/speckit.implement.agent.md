---
description: Execute the implementation plan by processing and executing all tasks defined in tasks.md
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. **Context Loading** (run at startup before any output):
   1. Read `.specify/memory/constitution.md`
   2. Read `.specify/memory/stack.md` — if absent, warn: "⚠️  stack.md missing — regression test commands will fall back to defaults; run `/speckit.specify` to initialize stack context"
   3. If stack.md is present, extract for use throughout implementation:
      - `regression_tests.lint_cmd` → use for post-phase lint validation
      - `regression_tests.test_cmd` → use for post-phase test validation
      - `regression_tests.e2e_cmd` + `regression_tests.e2e_requires` → include only if UI changes
      - `packaging.install_cmd` → use for dependency install instructions in setup tasks
   4. Read current spec's `spec.md`, `plan.md`, `tasks.md`
   5. Update spec.md `**Status**:` line → `In Progress`
   6. Output one-line summary: `Loaded: [spec name] | Status: In Progress | Stack: [packaging tool]`

2. Run `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Check checklists status** (if FEATURE_DIR/checklists/ exists):
   - Scan all checklist files in the checklists/ directory
   - For each checklist, count:
     - Total items: All lines matching `- [ ]` or `- [X]` or `- [x]`
     - Completed items: Lines matching `- [X]` or `- [x]`
     - Incomplete items: Lines matching `- [ ]`
   - Create a status table:

     ```text
     | Checklist | Total | Completed | Incomplete | Status |
     |-----------|-------|-----------|------------|--------|
     | ux.md     | 12    | 12        | 0          | ✓ PASS |
     | test.md   | 8     | 5         | 3          | ✗ FAIL |
     | security.md | 6   | 6         | 0          | ✓ PASS |
     ```

   - Calculate overall status:
     - **PASS**: All checklists have 0 incomplete items
     - **FAIL**: One or more checklists have incomplete items

   - **If any checklist is incomplete**:
     - Display the table with incomplete item counts
     - **STOP** and ask: "Some checklists are incomplete. Do you want to proceed with implementation anyway? (yes/no)"
     - Wait for user response before continuing
     - If user says "no" or "wait" or "stop", halt execution
     - If user says "yes" or "proceed" or "continue", proceed to step 3

   - **If all checklists are complete**:
     - Display the table showing all checklists passed
     - Automatically proceed to step 3

3. Load and analyze the implementation context:
   - **REQUIRED**: Read tasks.md for the complete task list and execution plan
   - **REQUIRED**: Read plan.md for tech stack, architecture, and file structure
   - **IF EXISTS**: Read data-model.md for entities and relationships
   - **IF EXISTS**: Read contracts/ for API specifications and test requirements
   - **IF EXISTS**: Read research.md for technical decisions and constraints
   - **IF EXISTS**: Read quickstart.md for integration scenarios

4. **Project Setup Verification**:
   - **REQUIRED**: Create/verify ignore files based on actual project setup:

   **Detection & Creation Logic**:
   - Check if the following command succeeds to determine if the repository is a git repo (create/verify .gitignore if so):

     ```sh
     git rev-parse --git-dir 2>/dev/null
     ```

   - Check if Dockerfile* exists or Docker in plan.md → create/verify .dockerignore
   - Check if .eslintrc* exists → create/verify .eslintignore
   - Check if eslint.config.* exists → ensure the config's `ignores` entries cover required patterns
   - Check if .prettierrc* exists → create/verify .prettierignore
   - Check if .npmrc or package.json exists → create/verify .npmignore (if publishing)
   - Check if terraform files (*.tf) exist → create/verify .terraformignore
   - Check if .helmignore needed (helm charts present) → create/verify .helmignore

   **If ignore file already exists**: Verify it contains essential patterns, append missing critical patterns only
   **If ignore file missing**: Create with full pattern set for detected technology

   **Common Patterns by Technology** (from plan.md tech stack):
   - **Node.js/JavaScript/TypeScript**: `node_modules/`, `dist/`, `build/`, `*.log`, `.env*`
   - **Python**: `__pycache__/`, `*.pyc`, `.venv/`, `venv/`, `dist/`, `*.egg-info/`
   - **Java**: `target/`, `*.class`, `*.jar`, `.gradle/`, `build/`
   - **C#/.NET**: `bin/`, `obj/`, `*.user`, `*.suo`, `packages/`
   - **Go**: `*.exe`, `*.test`, `vendor/`, `*.out`
   - **Ruby**: `.bundle/`, `log/`, `tmp/`, `*.gem`, `vendor/bundle/`
   - **PHP**: `vendor/`, `*.log`, `*.cache`, `*.env`
   - **Rust**: `target/`, `debug/`, `release/`, `*.rs.bk`, `*.rlib`, `*.prof*`, `.idea/`, `*.log`, `.env*`
   - **Kotlin**: `build/`, `out/`, `.gradle/`, `.idea/`, `*.class`, `*.jar`, `*.iml`, `*.log`, `.env*`
   - **C++**: `build/`, `bin/`, `obj/`, `out/`, `*.o`, `*.so`, `*.a`, `*.exe`, `*.dll`, `.idea/`, `*.log`, `.env*`
   - **C**: `build/`, `bin/`, `obj/`, `out/`, `*.o`, `*.a`, `*.so`, `*.exe`, `autom4te.cache/`, `config.status`, `config.log`, `.idea/`, `*.log`, `.env*`
   - **Swift**: `.build/`, `DerivedData/`, `*.swiftpm/`, `Packages/`
   - **R**: `.Rproj.user/`, `.Rhistory`, `.RData`, `.Ruserdata`, `*.Rproj`, `packrat/`, `renv/`
   - **Universal**: `.DS_Store`, `Thumbs.db`, `*.tmp`, `*.swp`, `.vscode/`, `.idea/`

   **Tool-Specific Patterns**:
   - **Docker**: `node_modules/`, `.git/`, `Dockerfile*`, `.dockerignore`, `*.log*`, `.env*`, `coverage/`
   - **ESLint**: `node_modules/`, `dist/`, `build/`, `coverage/`, `*.min.js`
   - **Prettier**: `node_modules/`, `dist/`, `build/`, `coverage/`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
   - **Terraform**: `.terraform/`, `*.tfstate*`, `*.tfvars`, `.terraform.lock.hcl`
   - **Kubernetes/k8s**: `*.secret.yaml`, `secrets/`, `.kube/`, `kubeconfig*`, `*.key`, `*.crt`

5. Parse tasks.md structure and extract:
   - **Task phases**: Setup, Tests, Core, Integration, Polish
   - **Task dependencies**: Sequential vs parallel execution rules
   - **Task details**: ID, description, file paths, parallel markers [P]
   - **Execution flow**: Order and dependency requirements

6. Execute implementation following the task plan:
   - **Phase-by-phase execution**: Complete each phase before moving to the next
   - **Respect dependencies**: Run sequential tasks in order, parallel tasks [P] can run together  
   - **Follow TDD approach**: Execute test tasks before their corresponding implementation tasks
   - **File-based coordination**: Tasks affecting the same files must run sequentially
   - **Validation checkpoints**: Verify each phase completion before proceeding
   - **Context map before each task group**: Before editing any files in a task group, invoke the `context-map` skill to identify all files to modify, their dependencies, related tests, and risk areas for that group. Use the output to guide which files to open and in what order.

7. Implementation execution rules:
   - **Setup first**: Initialize project structure, dependencies, configuration
   - **Tests before code**: If you need to write tests for contracts, entities, and integration scenarios
   - **Core development**: Implement models, services, CLI commands, endpoints
   - **Integration work**: Database connections, middleware, logging, external services
   - **Polish and validation**: Unit tests, performance optimization, documentation

8. Progress tracking and error handling:
   - Report progress after each completed task
   - Halt execution if any non-parallel task fails
   - For parallel tasks [P], continue with successful tasks, report failed ones
   - Provide clear error messages with context for debugging
   - Suggest next steps if implementation cannot proceed
   - **IMPORTANT** For completed tasks, make sure to mark the task off as [X] in the tasks file.

9. Completion validation:
   - Verify all required tasks are completed
   - Check that implemented features match the original specification
   - Validate that tests pass and coverage meets requirements
   - Confirm the implementation follows the technical plan
   - Report final status with summary of completed work

10. **Update central documentation** after all tasks are complete:

    Identify which central docs need updating based on what changed in this spec, then update them. Reference the spec number in each affected section.

    **Trigger conditions → affected docs**:
    - New or changed env vars → `docs/development.md` (env var tables)
    - Auth flow changes, session/cookie config, CORS config, Redis usage → `docs/architecture.md` (Auth, Sync, or Key design decisions sections)
    - Data model changes (new entities, new fields, new relationships) → `docs/architecture.md` (Data model section)
    - New platform targets, native wrappers, or build changes → `docs/architecture.md` (Native platform layer + Tech stack sections)
    - Integration adapter interface changes → `docs/integrations.md`
    - New integration adapter added → `docs/integrations.md` (Existing adapters table)
    - Setup steps added or changed (new scripts, new tooling, new one-time config) → `docs/development.md`

    **For each doc that needs updating**:
    1. Read the current content of the file
    2. Make targeted edits — do not rewrite sections that are unchanged
    3. Add a spec annotation comment on the affected section heading:
       ```markdown
       <!-- spec:NNN -->
       ```
       Where `NNN` is the spec number (e.g. `<!-- spec:017 -->`). Place it on the line immediately after the `##` heading.
    4. Add a visible callout below the heading (if the change is architecturally significant):
       ```markdown
       > *Changed in [spec NNN](../specs/NNN-<name>/).*
       ```
    5. Append a row to the **Document history** table at the bottom of each updated doc:
       ```markdown
       | [NNN-<feature-name>](../specs/NNN-<feature-name>/) | Summary of what changed |
       ```

    **Rules**:
    - Only update sections that are actually affected by this spec's changes
    - Do not add spec annotations to sections that were not touched
    - If a central doc does not exist yet and is needed, create it
    - If no central docs need updating (e.g. the spec was a pure refactor with no public-facing changes), skip this step and note that in the completion summary

11. **Status Advancement & PR Creation**:

    After all tasks are complete and central docs are updated:

    a. Update spec.md `**Status**:` line → `Implemented`

    b. Invoke the `github-issues` skill to create a Pull Request:
       - PR title: `feat(NNN): implement NNN-feature-name`
       - PR body: Include `Closes #N` for every issue number in the spec.md `GitHub Issue` field
       - PR description: Brief summary of what was implemented, linking to the spec
       - Example body:
         ```
         Implements [NNN-feature-name](specs/NNN-feature-name/spec.md).

         Closes #N
         Closes #M
         ```

    c. For each linked issue, post the PR URL as a comment:
       - Comment: "🚀 PR created: [PR title](PR URL) — implementation complete"

12. **Phase-End Commit**:

    1. Run `git status --short` scoped to `specs/$BRANCH/` to check for changes
    2. If no changes to spec artifacts: report "No spec changes to commit" and skip
    3. If changes exist (status update, tasks marked complete): invoke the `conventional-commit`
       skill with:
       - type: `docs`
       - scope: `implement`
       - description: `mark NNN-feature-name implemented`
       - footer: issue numbers (e.g., `Closes: #31`)
    4. Await developer confirmation before committing (per `conventional-commit` skill workflow)
    5. Note: Task-level commits (feat/fix/chore for each implementation task group) are separate
       from this spec-level commit — each task group should already have its own commit

Note: This command assumes a complete task breakdown exists in tasks.md. If tasks are incomplete or missing, suggest running `/speckit.tasks` first to regenerate the task list.
