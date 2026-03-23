---
description: Analyze all open GitHub issues for a repository, group related issues by theme, and produce a prioritized triage report with actionable recommendations.
tools: ['github/github-mcp-server/list_issues', 'github/github-mcp-server/issue_read', 'github/github-mcp-server/search_issues']
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding. The user may specify:
- A specific repository (`owner/repo`) — if not provided, detect from `git config --get remote.origin.url`
- A focus area or label filter to narrow scope
- A maximum number of issues to analyze (default: all open issues, up to 200)

## Goal

Fetch all open issues for the target repository, semantically cluster them into related groups, score each issue for priority, and produce a compact triage report the team can act on immediately.

## Operating Constraints

**READ-ONLY**: Do **not** create, edit, close, or label any issues. Output a structured report only.

**Repository Safety**: Confirm the target repository before fetching. If the user did not specify a repo, derive it from the Git remote and display it before proceeding.

## Execution Steps

### 1. Resolve Target Repository

If the user provided `owner/repo`, use it directly. Otherwise, run:

```bash
git config --get remote.origin.url
```

Parse the output to extract `owner` and `repo`. Display: `Analyzing issues for: owner/repo` before proceeding.

> [!CAUTION]
> Never fetch or create issues in a repository that does not match the user's intent. Confirm with the user if ambiguous.

### 2. Fetch Open Issues

Use the GitHub MCP `list_issues` tool with `state: OPEN`. Page through results until all open issues are collected (respect the 200-issue cap unless the user overrides). For each issue capture:

- Issue number, title, body (first 300 chars), labels, assignees, created_at, updated_at, comment count, reactions count

If the user specified a label filter, apply it during the fetch.

### 3. Build Semantic Clusters

Group issues by **theme** using the following signals (in priority order):

1. **Explicit labels** — issues sharing the same label are strong candidates for the same cluster
2. **Title keyword overlap** — extract noun phrases; issues sharing 2+ key terms belong together
3. **Body reference overlap** — issues mentioning the same file paths, component names, API endpoints, or error messages
4. **Cross-references** — issues that link to each other (`#NNN` mentions) are in the same cluster

Produce clusters with:
- A short **cluster name** (3–5 words, title case)
- A one-sentence **theme description**
- The list of issue numbers belonging to the cluster
- A `SINGLETON` marker for issues that don't cluster with anything

Limit clusters to a maximum of 15 (merge the smallest clusters into an `Other` bucket if needed).

### 4. Score Each Issue for Priority

Assign a **priority score** (1–10, higher = more urgent) using this weighted rubric:

| Signal | Weight | Notes |
|--------|--------|-------|
| Age (days open) | 20% | >90 days = max signal |
| Reaction count (👍, ❤️, 🚀) | 25% | Proxy for user demand |
| Comment count | 15% | High engagement = high interest |
| Recency of last update | 15% | Recently touched = in-flight work |
| Label severity | 25% | `bug` > `enhancement` > `question`; `critical`/`P0` labels = max |

Round score to one decimal. Break ties by reaction count.

Within each cluster, rank issues by score descending.

### 5. Identify Cross-Cutting Concerns

After clustering, scan for these patterns and call them out explicitly:

- **Blocking relationships**: Issues where one references another as a dependency or blocker
- **Duplicates**: Issues with near-identical titles or bodies (>80% semantic overlap) — flag as `POSSIBLE DUPLICATE of #NNN`
- **Stale issues**: Open >180 days with 0 comments and 0 reactions — flag as `STALE`
- **Needs triage**: Issues with no labels assigned

### 6. Produce the Triage Report

Output a Markdown report with the following structure:

---

## Issue Triage Report — `owner/repo`

**Generated**: [timestamp]  
**Open Issues Analyzed**: N  
**Clusters Identified**: N  

---

### Priority Queue (Top 10 Issues Across All Clusters)

| Rank | # | Title | Cluster | Score | Age | 👍 | Labels |
|------|---|-------|---------|-------|-----|----|--------|

---

### Clusters

For each cluster (sorted by highest issue score descending):

#### [Cluster Name]
> [Theme description]

| # | Title | Score | Age | 👍 | Labels | Assignee |
|---|-------|-------|-----|----|--------|----------|

---

### Cross-Cutting Concerns

**Blocking Chains** (if any):
- #NNN → #NNN → #NNN

**Possible Duplicates** (if any):
- #NNN may duplicate #NNN — [reason]

**Stale Issues** (if any):
- #NNN — [title] (open NNN days, 0 activity)

**Needs Triage** (no labels):
- #NNN — [title]

---

### Metrics Summary

| Metric | Value |
|--------|-------|
| Total open issues | N |
| Clusters | N |
| Singletons | N |
| Possible duplicates | N |
| Stale (>180d, no activity) | N |
| Needs triage (no labels) | N |
| Avg issue age (days) | N |

---

### Recommended Next Actions

Based on the analysis, suggest 3–5 concrete, prioritized actions such as:
- "Close or merge duplicates #NNN and #NNN"
- "Add labels to N unlabeled issues before next sprint planning"
- "Cluster `[name]` has N high-priority bugs — consider a dedicated bug bash"
- "Issues #NNN and #NNN should be linked as a blocking dependency"

---

## Operating Principles

- **Never modify issues** — this is a read-only analysis
- **Cite evidence** for every grouping decision (e.g., "shares label `auth`, mentions `session.ts`")
- **Prefer signal over volume** — a short, accurate report beats an exhaustive one
- **Graceful degradation** — if the repo has <5 open issues, skip clustering and just produce a prioritized list
- **Transparency** — if pagination was cut off at the 200-issue cap, note how many were not analyzed
