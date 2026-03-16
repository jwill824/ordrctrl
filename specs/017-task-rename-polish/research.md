# Research: Task Rename, Console Error Fix & Documentation Polish

**Spec**: 017-task-rename-polish | **Phase**: 0 Research

## Investigation 1 — Task Rename Architecture

### Question
How should a user-set custom title survive integration re-syncs, given that `SyncCacheItem.title` gets overwritten on every sync cycle?

### Options Considered

**Option A — Custom field on `SyncCacheItem`** (`customTitle: String?`)
- Pros: Simple lookup — no JOIN to `SyncOverride`.
- Cons: Pollutes the sync cache model (which is meant to be raw external data). Would need special logic in the sync layer to avoid overwriting `customTitle` during a sync. Inconsistent with existing `DESCRIPTION_OVERRIDE` approach.
- **Rejected.**

**Option B — New `SyncOverride` row with `TITLE_OVERRIDE` type** ← Selected
- Pros: Consistent with `DESCRIPTION_OVERRIDE` pattern already in production. The sync layer writes only to `SyncCacheItem` fields — `SyncOverride` rows are never touched by sync. Prisma `@@unique([syncCacheItemId, overrideType])` constraint enforces one value per type per item. Easy upsert / clear. Backend already fetches overrides alongside feed items; small addition.
- Cons: Minor JOIN cost — negligible at single-user scale.
- **Selected.**

### Conclusions

1. Add `TITLE_OVERRIDE` to the `OverrideType` enum.
2. In `feed.service.ts` (backend), fetch `TITLE_OVERRIDE` alongside `DESCRIPTION_OVERRIDE`. Apply as `displayTitle = titleOverride?.value ?? item.title`.
3. Expose `originalTitle: string | null` on `FeedItem` (always the raw `SyncCacheItem.title`) and `hasTitleOverride: boolean`. The frontend uses these to render the "Original: …" label and the clear-override button.
4. A new `setTitleOverride(syncCacheItemId, value: string | null)` backend function:
   - `value !== null`: upsert `TITLE_OVERRIDE`, then upsert `DESCRIPTION_OVERRIDE` to prepend `"Original: {original title}"` (idempotent — skip if description already starts with that prefix).
   - `value === null`: delete `TITLE_OVERRIDE` override row (do NOT touch `DESCRIPTION_OVERRIDE` — the historical reference is harmless to keep).
5. New endpoint: `PATCH /api/feed/sync/:id/title-override` — body `{ value: string | null }`. Returns updated `FeedItem`.

### Native Tasks

For `NativeTask` items, renaming is already possible via the existing `PUT /api/tasks/:id` endpoint — the `title` field is directly editable and there is no sync to worry about. No new mechanism needed. The `EditTaskModal` already renders a title input for native tasks.

---

## Investigation 2 — Console Error (`content.js:264`)

### Reported Error

```
content.js:264 Uncaught (in promise) TypeError: Cannot read properties of null (reading 'id')
```

### Analysis

The filename `content.js` is significant. Vite output filenames follow the pattern `assets/index-[hash].js` (or `assets/[name]-[hash].js`). **The Vite build never produces a file called `content.js`.**

The name `content.js` is the conventional filename for [Chrome/Firefox extension content scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/) — scripts injected into every page the browser opens, regardless of origin. The call to `ui (content.js:264:21663)` is minified code from one of these injected scripts.

**Verification steps (for tasks.md)**:
1. Reproduce the error in an incognito window with all extensions disabled.
2. If the error disappears → confirmed browser extension; close #48 with documentation.
3. If the error persists → trace via source maps; search frontend source for the null property access pattern.

### Expected Outcome

Browser extension. Close #48 with a comment explaining the finding and document it in `docs/development.md` under a "Known browser noise" section so the team doesn't re-investigate.

---

## Investigation 3 — Documentation Polish Approach

### Items from #58

| Item | File | Change |
|------|------|--------|
| Branch conventions update | `docs/CONTRIBUTING.md` | Replace generic "feature branches" text with spec-numbered `NNN-short-name` pattern |
| Move speckit section | `docs/README.md` | Remove the "Working with Speckit" section; replace with one-liner linking to CONTRIBUTING |
| Remove TL;DR | `docs/development.md` | Delete the TL;DR block at the top of the file |
| Architecture Mermaid diagram | `docs/architecture.md` | Convert current ASCII art system diagram to Mermaid `graph TD` |

### Decisions

- **Branch conventions**: Use the format `NNN-short-name` (e.g., `017-task-rename-polish`). Include examples of good vs. bad branch names.
- **README speckit section removal**: Replace with: *"For contribution workflow and speckit, see [CONTRIBUTING.md](./CONTRIBUTING.md)."*
- **TL;DR removal**: The TL;DR was a placeholder. The quickstart section in `development.md` already covers the same content in more detail.
- **Mermaid**: Use `graph TD` (top-down). Nodes: Browser, Vite SPA, Fastify API, PostgreSQL, Redis, Integration Services, Capacitor Shell, Tauri Shell. Keep it at the same level of abstraction as the current ASCII art. GitHub renders Mermaid natively in Markdown files.
