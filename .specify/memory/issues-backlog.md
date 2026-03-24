# Issues Backlog: Upcoming Feature Specs

**Purpose**: Track GitHub issues that represent upcoming or in-progress feature work.
**Updated By**: `/speckit.specify` (on issue linkage), manually, or via `gh issue list`

This file maps GitHub issues to spec branches so the spec-kit workflow stays aligned
with the project's GitHub backlog. It is the single source of truth for "what's next."

---

## How to Use

1. **During `/speckit.specify`**: When a GitHub issue is provided, the agent adds a row here
   linking the issue to the created branch and updates the spec.md header.

2. **Reviewing the backlog**: Run `gh issue list --repo jwill824/ordrctrl --state open` to
   sync open issues with this file.

3. **Closing issues**: When a PR is merged for a spec, update the Status to "Merged" and
   move the row to the Archived section below.

4. **Issue format in branch names**: Branches are named `NNN-short-name` and the issue
   reference lives in `spec.md` header as `**GitHub Issue**: #N`.
   PRs MUST close the linked issue with `Closes #N` in the PR body.

---

## Active Issues → Specs

| Issue # | Title | Priority | Spec Branch | Status | GitHub URL |
|---------|-------|----------|-------------|--------|------------|
| #31 | Update our spec-kit workflow | High | `021-speckit-workflow` | In Progress | https://github.com/jwill824/ordrctrl/issues/31 |

---

## Unassigned Open Issues

> Issues that have not yet been converted to a spec branch.
> Review periodically and promote to Active when work begins.

Run to refresh:
```bash
gh issue list --repo jwill824/ordrctrl --state open --json number,title,labels,createdAt
```

---

## Speckit Refinement Ideas

> Logged design improvements for future speckit specs. Promote to a GitHub issue when ready to implement.

| ID | Area | Description | Logged |
|----|------|-------------|--------|
| R1 | Session lifecycle (US8/FR-034) | New-session boundary should apply per-spec only (at `speckit.specify`), not per phase. Subsequent phases (`plan`, `tasks`, `implement`, `analyze`) should rely on FR-035 context loading from files instead of a session boundary reminder. Consider a formal "session checkpoint" concept: capture a structured summary at phase-end so resuming agents load a clean artifact snapshot rather than raw conversation history — functionally equivalent to a fresh session without manual overhead. | 2026-03-24 |
| R2 | Token efficiency — constitution digest | `.specify/memory/constitution.md` is loaded in full at the start of every phase. Create a compact `constitution-digest.md` containing only the key MUST rules (one line each), and have agents load the digest instead. Full constitution only loaded on explicit constitution-check tasks. Estimated savings: medium. | 2026-03-24 |
| R3 | Token efficiency — context-map frequency | FR-027 mandates `context-map` skill before each task group in `speckit.implement`. For large specs (40+ tasks) this causes redundant file discovery across the session. Change to: run `context-map` once per phase (not per task group), or cache the output in a temp session file and skip re-runs if the file list hasn't changed since the last call. Estimated savings: high. | 2026-03-24 |
| R4 | Token efficiency — agent instruction lazy-loading | Each `.agent.md` file loads its full instruction set on every invocation. Split into a lean header (goal + operating constraints + quick-path steps) and an `## Extended Instructions` section loaded only when the agent explicitly needs it (e.g., drift detection, constitution alignment). Reduces cold-start token cost for simple invocations. Estimated savings: medium. | 2026-03-24 |
| R5 | Token efficiency — drift detection summary | `git diff BASE..HEAD` in `speckit.analyze` can return thousands of lines fed directly to the model. Replace with a structured diff summary: extract only changed headings/sections (using `grep "^##"` on before/after), not full content. Present a headings-only summary to the model; full diff only retrieved for sections the user confirms need updating. Estimated savings: high. | 2026-03-24 |

---

## Archived (Merged / Closed)

| Issue # | Title | Spec Branch | PR # | Closed Date |
|---------|-------|-------------|------|-------------|
| -       | -     | -           | -    | -           |
