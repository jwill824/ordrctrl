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

## Archived (Merged / Closed)

| Issue # | Title | Spec Branch | PR # | Closed Date |
|---------|-------|-------------|------|-------------|
| -       | -     | -           | -    | -           |
