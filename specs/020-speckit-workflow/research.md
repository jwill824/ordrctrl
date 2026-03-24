# Research: Spec-Kit Workflow Update

**Feature**: 020-speckit-workflow  
**Status**: Complete — no NEEDS CLARIFICATION markers in spec; all decisions resolved via codebase inspection

---

## Summary

No external research required. All decisions were resolved through direct inspection of existing files in the repository. The five key decisions and their rationale are documented below.

---

## Decision 1 — Pre-commit Summary Guard (FR-040)

**Decision**: Add a conversational confirmation step to `conventional-commit` SKILL.md that presents staged files + generated message and awaits explicit "yes/no" before running `git commit`.

**Rationale**: The Copilot CLI's YOLO/auto-approve mode bypasses **tool execution** prompts (bash commands, file edits) but does NOT bypass **conversational** questions the model directs to the developer. By placing the summary+confirm step as a model-to-user message (not a shell script), the guard is immune to YOLO mode.

**Finding from codebase**: `.github/skills/conventional-commit/SKILL.md` step 5 currently reads: *"Copilot will automatically run the following command… (no confirmation needed)"* — this directly contradicts FR-040 and must be updated.

**Alternatives considered**:
- Shell `read` prompt in commit script — rejected: unreliable across TTY contexts; bypassable
- Separate confirmation hook — rejected: adds complexity; conversational prompt is sufficient

---

## Decision 2 — Hook Prerequisite Guard (FR-033)

**Decision**: Each hook script guards with:
```bash
if ! grep -q '^logs/' .gitignore 2>/dev/null; then
  echo "⚠️  speckit-setup: add 'logs/' to .gitignore before session logging is active"
  exit 0
fi
if [ ! -d "logs/copilot" ]; then
  mkdir -p logs/copilot
fi
```

**Rationale**: `jq` is already used in `log-session-start.sh`; no new tool dependencies. The guard emits a one-time actionable message and exits cleanly (exit 0) so the hook doesn't block CLI startup.

**Finding from codebase**: `.gitignore` has no `logs/` entry today. Running hooks without this guard would create `logs/copilot/` as an untracked directory visible in `git status`, risking accidental commits of session log data.

---

## Decision 3 — Speckit Branch Detection in Hooks (FR-032)

**Decision**:
```bash
BRANCH=$(git branch --show-current 2>/dev/null)
if echo "$BRANCH" | grep -qE '^[0-9]+-'; then
  SPEC_FILE="specs/$BRANCH/spec.md"
  SPEC_STATUS=$(grep '^\\*\\*Status\\*\\*:' "$SPEC_FILE" 2>/dev/null | sed 's/.*: //')
  LAST_PHASE=$(git log --oneline --grep='docs(spec\|plan\|tasks\|analyze):' -1 --format='%s' 2>/dev/null)
fi
```

**Rationale**: Uses only `git` and `grep` — no new dependencies. Branch naming convention (`NNN-short-name`) is already enforced by `create-new-feature.sh`. Status line in spec.md follows the established `**Status**: Draft` format.

---

## Decision 4 — Drift Detection (FR-019)

**Decision**:
```bash
# Find branch creation commit
BASE_COMMIT=$(git log --oneline --reverse HEAD | head -1 | cut -d' ' -f1)
# Diff spec artifacts
git diff $BASE_COMMIT..HEAD -- specs/$BRANCH/spec.md specs/$BRANCH/plan.md specs/$BRANCH/tasks.md
```

**Rationale**: Git-native; scoped to spec artifact paths only; no semantic source code analysis. The "branch creation commit" is reliably the first commit on the branch (first in reverse log).

**Edge case handled**: If no spec artifacts exist at branch creation (blank template only), the diff is empty — no false drift detected.

---

## Decision 5 — stack-template.md Schema Design

**Decision**: Single Markdown file with YAML-like field blocks, a `schema_version` semver header, and standard sections matching the structure of the existing `stack.md`. Fields tagged as auto-detectable use heuristics (lock file presence, package.json scripts, config file names) with manual fallback.

**Rationale**: The existing `.specify/memory/stack.md` (created in constitution v1.1.0) already has the right structure — the template codifies it with version tracking and detection metadata. YAML-in-Markdown is consistent with the rest of the `.specify/` templates.

**Schema version 1.0** covers all fields currently in `stack.md`. Future extensions increment to 1.1, 1.2, etc. with non-breaking field additions.

---

## Codebase Inventory (relevant files)

| File | Exists | Change required |
|------|--------|----------------|
| `.github/agents/speckit.specify.agent.md` | ✅ | Add: issue-triage guard, multi-issue, session reminder, github-issues skill, stack check, conventional-commit skill |
| `.github/agents/speckit.plan.agent.md` | ✅ | Add: context loading preamble, context-map skill, conventional-commit skill |
| `.github/agents/speckit.tasks.agent.md` | ✅ | Add: context loading preamble, conventional-commit skill |
| `.github/agents/speckit.implement.agent.md` | ✅ | Add: context-map skill, regression tests, status update, github-issues PR skill, conventional-commit skill |
| `.github/agents/speckit.analyze.agent.md` | ✅ | Add: drift detection, status update, conventional-commit skill |
| `.github/agents/speckit.clarify.agent.md` | ✅ | Add: conventional-commit skill |
| `.github/agents/speckit.checklist.agent.md` | ✅ | Add: conventional-commit skill |
| `.github/agents/issue-triage.agent.md` | ✅ | No change — invoked as-is from speckit.specify |
| `.github/skills/conventional-commit/SKILL.md` | ✅ | Update: add pre-commit summary + confirmation; remove auto-commit |
| `.github/skills/context-map/SKILL.md` | ✅ | No change — invoked as-is from speckit.plan + speckit.implement |
| `.github/skills/github-issues/SKILL.md` | ✅ | No change — invoked as-is from speckit.specify + speckit.implement |
| `.github/hooks/session-logger/log-session-start.sh` | ✅ | Add: gitignore guard, speckit branch detection + summary log |
| `.github/hooks/session-logger/log-session-end.sh` | ✅ | Add: gitignore guard, uncommitted artifact warning |
| `.github/hooks/session-logger/log-prompt.sh` | ✅ | Fix: copy-paste bug; add speckit phase command detection |
| `.github/copilot-instructions.md` | ✅ | Replace abridged constitution with pointer; add speckit workflow reference |
| `.github/instructions/issue-triage.instructions.md` | ❌ Already deleted | No action needed |
| `.specify/templates/stack-template.md` | ❌ Missing | CREATE: versioned standard fields template |
| `.specify/memory/stack.md` | ✅ | No change — already populated for this project |
| `.gitignore` | ✅ | Add: `logs/` entry |
