# Implementation Plan: Clear Completed Tasks

**Branch**: `008-clear-completed` | **Date**: 2026-03-10 | **Spec**: [spec.md](./spec.md)  
**GitHub Issue**: [#20](https://github.com/jwill824/ordrctrl/issues/20)

## Summary

Users need a single-action way to sweep all completed tasks from their feed. The implementation reuses the existing dismiss mechanism (no schema changes for P1): a new bulk endpoint `POST /api/feed/completed/clear` dismisses all eligible completed items server-side in two DB operations. The `CompletedSection` header gains a "Clear" button; a count toast confirms the action. Auto-clear (P2) adds a `settings` JSON column on `User` and a post-sync hook that auto-dismisses items past their configured window.

## Technical Context

**Language/Version**: TypeScript (Node.js 18, Next.js 14)  
**Primary Dependencies**: Prisma ORM, Express-style API routes (Next.js App Router + custom backend), React 18, BullMQ (sync scheduler)  
**Storage**: PostgreSQL via Prisma  
**Testing**: Jest (backend unit), Jest + React Testing Library (frontend unit), Playwright (E2E)  
**Target Platform**: Web (Next.js full-stack + standalone Express backend)  
**Project Type**: Web application (frontend + backend monorepo)  
**Performance Goals**: Clear endpoint handles 100+ completed items reliably; responds in < 500ms  
**Constraints**: No new infrastructure; auto-clear fires within one 15-min sync cycle window  
**Scale/Scope**: Single-user personal workspace; single DB write transaction per clear  

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Integration Modularity | ✅ PASS | No integration adapters touched; bulk clear is feed-level only |
| II. Minimalism-First | ✅ PASS | Single button justified by spec; no modal; auto-clear is P2 with concrete user need |
| III. Security & Privacy | ✅ PASS | No new token handling; userId scoping on all queries; no raw content persisted |
| IV. Test Coverage | ✅ PASS | Unit tests for service function + endpoint; component test for button |
| V. Simplicity & Deferred | ✅ PASS | P1 = zero schema changes; P2 JSON column is simplest user prefs approach |

**Gate result**: All principles satisfied. Proceed to implementation.

## Project Structure

### Documentation (this feature)

```text
specs/008-clear-completed/
├── plan.md              ← this file
├── research.md          ← decisions and rationale
├── data-model.md        ← schema, state transitions, eligibility rules
├── quickstart.md        ← developer setup notes
├── contracts/
│   └── feed-api.md      ← API contracts for new + modified endpoints
└── tasks.md             ← created by /speckit.tasks
```

### Source Code (affected files)

```text
backend/
├── prisma/
│   └── schema.prisma                          [P2] add settings Json? to User
├── src/
│   ├── api/
│   │   ├── feed.routes.ts                     [P1] add POST /api/feed/completed/clear
│   │   └── user.routes.ts                     [P2] add GET/PATCH /api/user/settings
│   ├── feed/
│   │   └── feed.service.ts                    [P1] add clearCompletedItems()
│   ├── sync/
│   │   └── sync.worker.ts                     [P2] add clearExpiredCompleted() post-sync hook
│   └── user/
│       └── user.service.ts                    [P2] add getUserSettings() + updateUserSettings()
└── tests/
    ├── feed.service.test.ts                   [P1] unit tests for clearCompletedItems()
    ├── feed.routes.test.ts                    [P1] endpoint test for POST /completed/clear
    └── user.service.test.ts                   [P2] unit tests for settings functions

frontend/
├── src/
│   ├── app/
│   │   └── feed/
│   │       └── page.tsx                       [P1] pass clearCompleted + clearedToast to UI
│   ├── components/
│   │   └── feed/
│   │       ├── CompletedSection.tsx           [P1] add "Clear" button in header
│   │       └── ClearedToast.tsx               [P1] new count confirmation toast (or extend existing)
│   └── hooks/
│       └── useFeed.ts                         [P1] add clearCompleted() + clearedToast state
└── tests/
    └── components/
        ├── CompletedSection.test.tsx          [P1] test button render + click behavior
        └── useFeed.test.ts                    [P1] test clearCompleted mutation
```

**Structure Decision**: Standard web-app layout (Option 2). All changes are additive — no existing files are restructured.

## Implementation Phases

### Phase 1: Manual Clear (P1 — MVP)

All P1 stories (US1 + US2) deliver the core "Clear completed" feature:

1. **Backend service**: Add `clearCompletedItems(userId: string): Promise<{ clearedCount: number }>` to `feed.service.ts`
   - Query all eligible sync items: `completedInOrdrctrl = true`, no `DISMISSED` override, no `REOPENED` override
   - Query all eligible native tasks: `completed = true`, `dismissed = false`
   - Bulk upsert `SyncOverride(DISMISSED)` for sync items
   - Bulk update `dismissed = true` for native tasks
   - Return total count

2. **Backend route**: Add `POST /api/feed/completed/clear` to `feed.routes.ts`
   - Auth guard (same pattern as existing routes)
   - Call `clearCompletedItems(userId)`
   - Return `{ clearedCount }` with 200

3. **Frontend service**: Add `clearAllCompleted(): Promise<{ clearedCount: number }>` to `feedService.ts`

4. **Frontend hook**: Add `clearCompleted()` and `clearedToast` state to `useFeed.ts`
   - Optimistic update: empty the `completed` array immediately
   - Call service; show count toast on success
   - On error: revert optimistic update + show error toast

5. **UI**: Update `CompletedSection.tsx`
   - Add "Clear" button in the section header (right-aligned next to chevron)
   - Button only renders when `items.length > 0`
   - Call `onClear()` prop on click

6. **Toast**: Extend existing toast pattern for cleared count (e.g., "Cleared 5 completed tasks — find them in Dismissed Items")

7. **Tests**: Unit tests for `clearCompletedItems()`, endpoint test, component test for button

### Phase 2: Auto-Clear Window (P2)

1. **Schema migration**: Add `settings Json?` to `User` model → Prisma migration
2. **User service**: `getUserSettings()` and `updateUserSettings()` with validation
3. **User routes**: `GET /api/user/settings` and `PATCH /api/user/settings`
4. **Sync worker hook**: After each sync job completes, call `clearExpiredCompleted(userId, windowDays)` which filters completed items where `completedAt < now() - windowDays * 86400s`
5. **Frontend settings UI**: Dropdown for auto-clear window in feed preferences / settings page
6. **Tests**: Unit tests for service + worker hook, settings endpoint tests

## Key Implementation Notes

### Eligibility Query (P1)

```typescript
// Sync items eligible for clearing
const eligibleSync = await prisma.syncCacheItem.findMany({
  where: {
    userId,
    completedInOrdrctrl: true,
    syncOverrides: {
      none: { overrideType: { in: ['DISMISSED', 'REOPENED'] } }
    }
  },
  select: { id: true }
});

// Native tasks eligible for clearing
const eligibleNative = await prisma.nativeTask.findMany({
  where: { userId, completed: true, dismissed: false },
  select: { id: true }
});
```

### Bulk Dismiss (P1)

```typescript
// Sync items: bulk upsert DISMISSED overrides
await prisma.syncOverride.createMany({
  data: eligibleSync.map(item => ({
    userId,
    syncCacheItemId: item.id,
    overrideType: 'DISMISSED',
  })),
  skipDuplicates: true,
});

// Native tasks: bulk update dismissed flag
await prisma.nativeTask.updateMany({
  where: { id: { in: eligibleNative.map(t => t.id) } },
  data: { dismissed: true },
});
```

### REOPENED Exclusion

The Prisma `none` filter on `syncOverrides` excludes any item with either DISMISSED or REOPENED. This is safe: items with an existing DISMISSED override would have been excluded from the feed's completed section already anyway, so they're effectively no-ops; the `skipDuplicates: true` handles them cleanly.

## Complexity Tracking

No constitution violations. No new dependencies introduced.
