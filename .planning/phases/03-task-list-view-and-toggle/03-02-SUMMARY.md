---
phase: "03"
plan: "02"
---

# T02: Wired 'list' tab into FeedPage segmented control showing only native tasks via FeedSection

**Wired 'list' tab into FeedPage segmented control showing only native tasks via FeedSection**

## What Happened

Made three targeted edits to `frontend/src/app/feed/page.tsx`:

1. **Segmented control** (line 107): Added `'list'` to the `['feed', 'timeline', 'planner']` array, making it a four-tab control. The existing map+capitalize rendering handles the new label automatically.

2. **nativeItems memo** (near line 94): Added `const nativeItems = useMemo(() => items.filter((i) => i.id.startsWith('native:')), [items])` alongside the existing `datedItems`/`undatedItems` derivations.

3. **listJsx + early-return** (inside the `items.length > 0` IIFE, before the `viewMode === 'planner'` block): Added a `listJsx` constant rendering `<FeedSection label="Tasks" items={nativeItems} emptyMessage="No tasks yet." .../>`, then added `if (viewMode === 'list') return listJsx;` after the planner block. FeedSection's built-in empty-message handling covers the case where there are feed items but zero native tasks.

Edge case (empty feed + list view): the existing `isEmpty && <FeedEmptyState>` check is outside the `items.length > 0` guard, so when the entire feed is empty, FeedEmptyState renders regardless of view mode — this is correct behaviour.

## Verification

TypeScript: `cd frontend && node_modules/.bin/tsc --noEmit` — exit 0, no errors. Vitest: `npx vitest run` — 17 test files, 136 tests, all passed.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd frontend && node_modules/.bin/tsc --noEmit` | 0 | pass | 8200ms |
| 2 | `npx vitest run` | 0 | pass — 136 tests, 17 files | 980ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `frontend/src/app/feed/page.tsx`
