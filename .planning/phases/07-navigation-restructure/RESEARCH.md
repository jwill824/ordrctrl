# Phase 07: Navigation Restructure — Research

**Researched:** 2026-06-05
**Domain:** React Router v6 layout patterns, responsive CSS nav shell, component refactor
**Confidence:** HIGH

---

## Summary

Phase 07 replaces the 5-tab segmented control in `feed/page.tsx` with a 3-tab navigation
system: a fixed bottom tab bar on mobile (< 768px) and a fixed left sidebar on desktop (≥ 768px).
The three tabs — Planner, Inbox, Integrations — each map to an already-existing route.

The entire codebase is a **Vite + React Router v6 SPA** (no Next.js App Router, no layout.tsx).
There is no existing shared layout shell; each page currently manages its own full-screen
chrome independently. Creating a shared `AppShell` component and wiring it as a nested route
layout is the canonical React Router v6 pattern for this change.

All three tab route pages (`feed/page.tsx`, `InboxPage.tsx`, `IntegrationSettingsPage`) carry
standalone headers and full-page wrappers that must be stripped — AppShell becomes the single
source of chrome. The inner content components (`FeedPageContent`, `InboxPage` body,
`IntegrationSettingsContent`) already exist and need only their outermost wrappers removed.

**Primary recommendation:** Create `AppShell.tsx` as a React Router nested layout route that
renders the BottomTabBar/Sidebar + `<Outlet />`, then lift `useInboxCount` to AppShell so the
badge count is fetched once and passed as a prop to both nav components.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bottom tab bar / sidebar chrome | Browser/Client (AppShell) | — | Pure CSS layout, no SSR |
| Active tab detection | Browser/Client (`useLocation`) | — | URL-driven state, client only |
| Inbox badge count | Browser/Client (`useInboxCount` hook) | — | Polling hook, lifted to AppShell |
| Planner Day/Week toggle | Browser/Client (FeedPage local state) | — | UI-only toggle, persisted via user settings API |
| Responsive breakpoint switch | CSS (`md:` prefix) | — | No JS media query needed |
| OAuth callback routing (`?connected=…`) | Browser/Client (IntegrationSettingsContent) | — | Query param already handled in component |

---

## Research Answers (Phase Questions)

### Q1 — Current routing structure; where does the segmented control live?

**Router:** `frontend/src/App.tsx` uses React Router v6 `<BrowserRouter>` + `<Routes>`.
No shared layout component exists — every route renders an independent full-screen component.

**Existing protected routes (all relevant to this phase):**
```
/feed                   → FeedPage            (feed/page.tsx)
/inbox                  → InboxRoute          (inbox/page.tsx → InboxPage component)
/settings/integrations  → IntegrationSettingsPage
```

**Segmented control location:** Inline JSX inside `FeedPageContent` → the `<header>` element
in `feed/page.tsx` (lines 131–149). It is **not** a separate component. It maps 5 modes:
`['feed', 'timeline', 'planner', 'list', 'week']` as `TimelineViewMode`.

The `viewMode` state is local to `FeedPageContent`, persisted to the backend via
`updateUserSettings({ feedViewMode: mode })` on each change, and rehydrated on mount via
`getUserSettings()`.

### Q2 — What needs to change to add a shared AppShell?

React Router v6 supports nested layout routes via `<Outlet />`. The cleanest approach:

```tsx
// App.tsx — replace individual protected routes with a nested layout route
<Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
  <Route path="feed" element={<FeedPage />} />
  <Route path="inbox" element={<InboxPage />} />
  <Route path="settings/integrations" element={<IntegrationSettingsContent />} />
</Route>
```

AppShell renders:
- Top app bar with wordmark + AccountMenu (mobile only; desktop uses sidebar header)
- `<Outlet />` as the scrollable content area
- BottomTabBar (mobile: `block md:hidden`)
- Sidebar (desktop: `hidden md:flex`)

Each tab page must strip its own outer `h-[100dvh]` / `min-h-screen` wrapper and its
standalone header — AppShell owns all chrome.

### Q3 — InboxPage structure — standalone header to strip?

**File:** `frontend/src/components/inbox/InboxPage.tsx`

`InboxPage` is a full-page component with:
- Outermost `<div className="h-[100dvh] bg-white flex flex-col pt-[env(safe-area-inset-top)] overflow-hidden">`
- A `<header>` containing the ordrctrl wordmark + an `<a href="/feed">← Back to feed</a>` anchor (raw `href`, not React Router `Link`)
- A `<div className="flex-1 overflow-y-auto">` scroll container
- An inner `<main>` with the content (title row, groups, empty/error states)

**What to strip:** The outermost div, the `<header>`, and the scroll container. AppShell provides
these. InboxPage becomes a content-only fragment starting with the inner `<main>`.

**Note:** The "← Back to feed" link is a raw `<a href>` (not `<Link>`), which causes a full
page reload. This link disappears entirely in the new nav — no migration needed.

### Q4 — IntegrationSettingsContent — standalone back-navigation?

**File:** `frontend/src/app/settings/integrations/page.tsx`

The file exports two things:
1. `IntegrationSettingsContent` (internal function) — renders only the integration cards with
   error/OAuth banners. **No nav elements.** This is the content the Integrations tab needs.
2. `IntegrationSettingsPage` (default export) — wraps `IntegrationSettingsContent` in a
   `<main className="min-h-screen bg-white pb-8 pt-[calc(2rem+...)] px-5 max-w-[36rem] mx-auto">` with a standalone nav (`← Feed` link + wordmark) and a large `<h1>` heading.

**What to change:** The tab route should render `IntegrationSettingsContent` directly with a
new page-title wrapper (matching UI-SPEC §6: `text-base font-semibold text-zinc-900`), not
the full `IntegrationSettingsPage`. Two options:
- **Option A (preferred):** Export `IntegrationSettingsContent` from the file and use it
  directly in the route config.
- **Option B:** Create a new `frontend/src/app/settings/integrations/IntegrationsTab.tsx`
  that wraps `IntegrationSettingsContent` with the correct tab-layout styling.

The `IntegrationSettingsPage` (with `← Feed` nav) can be kept as-is as the standalone
deep-link entry point for `/settings/integrations` direct navigation — but in the new nav
shell, the route renders the content version.

### Q5 — Where is useInboxCount and what does it return?

**File:** `frontend/src/hooks/useInboxCount.ts`

```ts
export function useInboxCount(): { inboxCount: number; refreshCount: () => Promise<void> }
```

Polls `fetchInboxCount()` on mount and every 15 minutes via `setInterval`.
Silent failure — badge stays at last known count on error.

**Current usage:**
- `frontend/src/app/feed/page.tsx` — for the inbox icon badge in the header
- `frontend/src/components/AccountMenu.tsx` — for the Inbox menu item badge

**Concern:** Each `useInboxCount()` call creates an independent polling interval.
After this phase, AppShell's BottomTabBar/Sidebar will also call it, creating a third
poller. **Solution:** Call `useInboxCount()` once in AppShell and pass `inboxCount` as a prop
to BottomTabBar, Sidebar, and AccountMenu. Remove the call from `feed/page.tsx` header
(the inbox icon in the feed header is removed by this phase anyway).
AccountMenu can receive `inboxCount` as a prop or continue calling the hook (one extra
poller is acceptable if prop-threading is undesirable).

### Q6 — Current segmented control: file path, rendering, modes?

**File:** `frontend/src/app/feed/page.tsx`, lines 132–149.

Inline JSX in the `<header>` element — not a separate component. Renders when `!showDismissed`.

```tsx
{(['feed', 'timeline', 'planner', 'list', 'week'] as TimelineViewMode[]).map((mode) => (
  <button key={mode} onClick={() => handleModeChange(mode)} ...>
    {mode.charAt(0).toUpperCase() + mode.slice(1)}
  </button>
))}
```

**What changes:** The 5-mode control is removed entirely. A new 2-option Day/Week pill toggle
replaces it, rendered in a sub-header strip below the top app bar (per UI-SPEC §4):
only `'planner'` (Day) and `'week'` (Week) options. The `viewMode` state is narrowed to
`'planner' | 'week'`. The `TimelineViewMode` type in `frontend/src/types/timeline.ts`
can remain as-is (it's used by other hooks/services) — the feed page simply stops
using the `'feed' | 'timeline' | 'list'` variants.

**Modes removed from the Planner tab:** `feed`, `timeline`, `list`. Their associated JSX
blocks (`feedJsx`, `timelineJsx`, `listJsx`) and related hook calls (`useTimeline`,
`useFeed` parts) can be removed from `feed/page.tsx`.

### Q7 — State management concerns when switching tabs?

**React Router unmounts on route change.** Each tab component fully unmounts when you
navigate away, then remounts on return. This has two implications:

1. **Scroll position resets** — acceptable; standard mobile app tab behavior.

2. **Planner `viewMode` resets to default** — `viewMode` is local state, rehydrated from
   `getUserSettings()` on mount. The 150ms async fetch means there's a brief flash to the
   default before the persisted value loads. This is pre-existing behavior (unchanged by
   this phase).

3. **`useInboxCount` poller lifecycle** — if InboxPage also calls `useInboxCount`, the
   poller mounts/unmounts with the tab. Lifting to AppShell avoids this churn.

4. **Source filter (`sourceFilter` state)** — local to `FeedPageContent`, resets on tab
   switch. Acceptable.

5. **No swipe gesture** — confirmed locked decision in UI-SPEC. No extra state needed
   for gesture tracking.

### Q8 — Are `/inbox` and `/settings/integrations` already defined routes?

**Yes — both routes exist and are protected:**

```tsx
// App.tsx (current)
<Route path="/inbox" element={<ProtectedRoute><InboxRoute /></ProtectedRoute>} />
<Route path="/settings/integrations" element={<ProtectedRoute><IntegrationSettingsPage /></ProtectedRoute>} />
```

No new route definitions needed. The refactor moves these routes inside the nested
AppShell layout route, changing nothing about their URLs or auth requirements.

---

## Files to Create / Modify

### Create (new files)
| File | Purpose |
|------|---------|
| `frontend/src/components/AppShell.tsx` | Layout shell: top bar (mobile), BottomTabBar, Sidebar, `<Outlet />` |
| `frontend/src/components/nav/BottomTabBar.tsx` | Mobile 3-tab bottom nav per UI-SPEC §1 |
| `frontend/src/components/nav/Sidebar.tsx` | Desktop left sidebar per UI-SPEC §2 |

### Modify (existing files)
| File | What Changes |
|------|-------------|
| `frontend/src/App.tsx` | Add nested layout route wrapping the 3 tab routes with `<AppShell>` |
| `frontend/src/app/feed/page.tsx` | Remove outer `h-[100dvh]` wrapper + `<header>`; strip 5-mode segmented control; add 2-option Day/Week sub-header strip; narrow `viewMode` to `'planner' \| 'week'`; update FAB bottom offset |
| `frontend/src/components/inbox/InboxPage.tsx` | Remove outer wrapper + standalone header; keep inner content only |
| `frontend/src/app/settings/integrations/page.tsx` | Export `IntegrationSettingsContent`; the tab route uses it directly with a new title wrapper |
| `frontend/src/types/timeline.ts` | Optional: narrow `TimelineViewMode` or add `PlannerViewMode = 'planner' \| 'week'` type alias for the toggle |

### No changes needed
| File | Why |
|------|-----|
| `frontend/src/hooks/useInboxCount.ts` | No changes; AppShell lifts the call |
| `frontend/src/components/AccountMenu.tsx` | Stays as-is initially; optionally receive `inboxCount` as prop in a follow-up |
| All `useInbox`, `useFeed`, `useWeeklyPlanner`, etc. hooks | Pure data hooks; unaffected by layout refactor |

---

## Key Implementation Risks / Gotchas

### Risk 1 — FAB bottom offset doubles with bottom tab bar
**What goes wrong:** The FAB in `feed/page.tsx` uses
`bottom-[calc(1.5rem+env(safe-area-inset-bottom))]`. With a 56px bottom tab bar, on mobile
the FAB overlaps the bar.
**Fix:** On mobile the FAB offset must be
`bottom-[calc(1.5rem+3.5rem+env(safe-area-inset-bottom))]` (3.5rem = 56px tab bar).
On desktop there is no tab bar so `bottom-6` suffices (use `md:bottom-6` class).
UI-SPEC §"FAB" prescribes: mobile `fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-6`,
desktop `fixed bottom-6 right-6`. [VERIFIED: 07-UI-SPEC.md]

### Risk 2 — WeeklyPlannerView bottom padding
**What goes wrong:** `feed/page.tsx` wraps WeeklyPlannerView in
`pb-[calc(7rem+env(safe-area-inset-bottom))]`. AppShell's `<main>` already applies
`pb-[calc(3.5rem+env(safe-area-inset-bottom))]`. These will stack, over-padding the weekly view.
**Fix:** Remove the manual `pb-` from the WeeklyPlannerView wrapper in `feed/page.tsx` and
let AppShell's content area padding handle clearance.

### Risk 3 — `useInboxCount` polling multiplication
**What goes wrong:** AppShell calls `useInboxCount()`, `AccountMenu` calls it independently —
two separate 15-minute pollers hitting the same endpoint in parallel.
**Fix:** Call `useInboxCount()` only in AppShell; pass `inboxCount` as a prop to both
BottomTabBar/Sidebar and AccountMenu (or use a lightweight React context).

### Risk 4 — `IntegrationSettingsContent` is not currently exported
**What goes wrong:** `IntegrationSettingsContent` is a non-exported internal function in
`frontend/src/app/settings/integrations/page.tsx`. It cannot be imported by the route config
without being exported.
**Fix:** Add `export` keyword to `IntegrationSettingsContent` function declaration. Low risk.

### Risk 5 — InboxPage uses raw `<a href="/feed">` (not React Router Link)
**What goes wrong:** The "← Back to feed" element in InboxPage uses a plain anchor tag,
causing a full page reload. This element is removed by the refactor (InboxPage strips its
standalone header), so it resolves itself. No action needed beyond removal.

### Risk 6 — `viewMode` persists stale non-tab values in user settings
**What goes wrong:** A user who had `feedViewMode: 'timeline'` or `feedViewMode: 'feed'`
in their settings will land on the Planner tab with an invalid mode. `getUserSettings()`
rehydrates `viewMode` from the server on mount; if the stored value is `'feed'`, `'timeline'`,
or `'list'`, the view will be blank (those view JSX blocks are removed).
**Fix:** After narrowing the toggle to `'planner' | 'week'`, default to `'planner'` when
`getUserSettings()` returns any non-`planner`/non-`week` value:
```ts
if (s.feedViewMode === 'planner' || s.feedViewMode === 'week') setViewMode(s.feedViewMode);
else setViewMode('planner'); // migrate legacy values
```

### Risk 7 — AccountMenu `navTo('/settings/integrations')` still works
**What goes not wrong (verify):** AccountMenu navigates to `/settings/integrations` via React
Router's `navigate()`. After the restructure this route is inside AppShell — navigation
works identically, no change needed.

### Risk 8 — `showDismissed` view inside AppShell
**What:** `/feed?showDismissed=true` renders inside the `/feed` route, which is now wrapped
by AppShell. The bottom tab bar will be visible on the dismissed items page.
**Impact:** Low — this is acceptable UX (bottom nav visible on sub-pages of a tab is standard).
The "← Back to feed" link inside the dismissed view uses React Router `<Link>`, which works
correctly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Nested layout with `<Outlet>` | Custom context/portal for chrome injection | React Router v6 nested routes + `<Outlet />` |
| Active tab detection | `window.location` parsing, custom routing state | `useLocation()` from react-router-dom — match `/feed`, `/inbox`, `/settings/integrations` |
| Responsive breakpoint switching | JS `window.matchMedia` listener | CSS `md:` Tailwind prefix — zero JS |
| iOS safe area inset | JS to read `env(safe-area-inset-bottom)` | CSS `env(safe-area-inset-bottom)` in Tailwind arbitrary values |

---

## Architecture Patterns

### System Architecture — Before (current)

```
BrowserRouter
  └── Routes (App.tsx)
        ├── /feed    → ProtectedRoute → FeedPage [own header + segmented control]
        ├── /inbox   → ProtectedRoute → InboxPage [own header + back link]
        └── /settings/integrations → ProtectedRoute → IntegrationSettingsPage [own nav + h1]
```

### System Architecture — After (target)

```
BrowserRouter
  └── Routes (App.tsx)
        └── / → ProtectedRoute → AppShell [top bar + BottomTabBar | Sidebar + <Outlet>]
                  ├── /feed    → FeedPage [content only: Day/Week toggle + planner/week views]
                  ├── /inbox   → InboxPage [content only: title row + groups]
                  └── /settings/integrations → IntegrationSettingsContent [content only: cards]
```

### Pattern: React Router Nested Layout Route

```tsx
// App.tsx — the new nested structure
<Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
  <Route path="/feed" element={<FeedPage />} />
  <Route path="/inbox" element={<InboxPage />} />
  <Route path="/settings/integrations" element={<IntegrationSettingsContent />} />
</Route>
```

AppShell renders `<Outlet />` where content goes:

```tsx
// AppShell.tsx (sketch)
export function AppShell() {
  const { inboxCount } = useInboxCount(); // single source
  return (
    <div className="h-[100dvh] bg-white flex flex-col md:flex-row overflow-hidden
                    pt-[env(safe-area-inset-top)]">
      {/* Mobile top bar */}
      <header className="border-b border-zinc-100 px-5 h-12 flex items-center
                         justify-between flex-shrink-0 bg-white z-10 md:hidden">
        <span className="text-[0.65rem] font-bold tracking-[0.28em] uppercase text-black">
          ordrctrl
        </span>
        <AccountMenu inboxCount={inboxCount} />
      </header>

      {/* Desktop sidebar */}
      <Sidebar inboxCount={inboxCount} />

      {/* Content area */}
      <main className="flex-1 overflow-y-auto md:ml-[240px]
                       pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <BottomTabBar inboxCount={inboxCount} />
    </div>
  );
}
```

### Pattern: Active Tab from useLocation

```tsx
// BottomTabBar.tsx / Sidebar.tsx
import { useLocation, useNavigate } from 'react-router-dom';

const TABS = [
  { label: 'Planner', path: '/feed', /* icon SVG */ },
  { label: 'Inbox',   path: '/inbox', /* icon SVG */ },
  { label: 'Integrations', path: '/settings/integrations', /* icon SVG */ },
] as const;

function BottomTabBar({ inboxCount }: { inboxCount: number }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeTab = TABS.find(t => pathname.startsWith(t.path))?.path ?? '/feed';
  // ...
}
```

### Pattern: Day/Week Sub-Header Strip (replaces segmented control)

```tsx
// Inside FeedPage — new 44px sub-header below AppShell's top bar
<div className="flex items-center justify-center h-11 border-b border-zinc-100
                flex-shrink-0 bg-white">
  <div className="flex items-center rounded-full border border-zinc-200 overflow-hidden
                  text-[0.65rem] font-semibold">
    {(['planner', 'week'] as const).map((mode) => (
      <button
        key={mode}
        type="button"
        onClick={() => handleModeChange(mode)}
        className={`px-4 py-1.5 border-0 cursor-pointer transition-colors ${
          viewMode === mode
            ? 'bg-black text-white'
            : 'bg-transparent text-zinc-500 hover:text-black'
        }`}
      >
        {mode === 'planner' ? 'Day' : 'Week'}
      </button>
    ))}
  </div>
</div>
```

---

## Standard Stack

### Core (no new dependencies)

| Library | Current Version | Purpose | Why Standard |
|---------|----------------|---------|--------------|
| react-router-dom | v6 (already installed) | Nested layout routes + `useLocation` | Already in project; `<Outlet>` pattern is v6 canonical |
| tailwindcss | v3 (already installed) | Responsive layout via `md:` prefix | Already in project; zero new deps |

**This phase installs zero new packages.** All capabilities come from existing dependencies.

---

## Package Legitimacy Audit

> **No new packages installed in this phase.** All work uses existing project dependencies.

*Audit not required — no external package installs.*

---

## Common Pitfalls

### Pitfall 1: Forgetting to remove full-page overflow from tab pages
**What goes wrong:** FeedPage and InboxPage each have `h-[100dvh] overflow-hidden` on their
outermost div. Left intact inside AppShell, they create a double scroll container — AppShell's
`<main>` and the page's inner div both compete for scroll.
**Fix:** Strip the outermost `h-[100dvh] flex flex-col overflow-hidden` from FeedPage and
InboxPage. Those pages become content fragments; AppShell owns the viewport sizing.

### Pitfall 2: ProtectedRoute placement with nested routes
**What goes wrong:** Moving all 3 routes inside a single `<ProtectedRoute>` wrapper on the
parent route means the auth check happens once at the layout level. If other routes
outside the shell (e.g., `/onboarding`, `/settings/feed`) still use per-route
`<ProtectedRoute>` wrappers, the pattern is inconsistent but not broken.
**Fix:** Put `<ProtectedRoute>` on the parent AppShell route only. Remove per-route
`<ProtectedRoute>` from the 3 tab routes. Other routes (onboarding, settings/feed) keep
their own wrappers unchanged.

### Pitfall 3: `md:hidden` / `hidden md:flex` on wrong element
**What goes wrong:** Applying responsive visibility to the wrong container means both nav
components appear, or neither appears, at the breakpoint boundary.
**Fix:** BottomTabBar container: `fixed bottom-0 left-0 right-0 flex md:hidden`.
Sidebar container: `hidden md:flex fixed left-0 top-0 bottom-0 w-[240px] flex-col`.
Content area: `md:ml-[240px]` to clear sidebar on desktop only.

### Pitfall 4: `pt-[env(safe-area-inset-top)]` applied twice
**What goes wrong:** AppShell applies `pt-[env(safe-area-inset-top)]` to its outermost div.
If FeedPage or InboxPage also apply this class, safe area padding doubles.
**Fix:** Remove `pt-[env(safe-area-inset-top)]` from the outermost div of each tab page.

### Pitfall 5: IntegrationSettingsContent `useSearchParams` OAuth flow
**What goes wrong:** `IntegrationSettingsContent` reads `?connected=`, `?step=`, `?error=`,
`?serviceId=` query params from `useSearchParams()`. This logic must be preserved. Using
the component directly in the route config (no wrapping page) means these params are still
accessible from `useLocation` — React Router `useSearchParams` works in nested routes.
**Fix:** No change needed; `useSearchParams` works at any nesting level.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v1.3.1 + @testing-library/react v14 |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `cd frontend && npm test` |
| Full suite command | `cd frontend && npm test` (all unit tests) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAV-01 | Bottom tab bar renders 3 tabs on mobile | unit (render) | `cd frontend && npm test -- tests/unit/components/AppShell.test.tsx` | ❌ Wave 0 |
| NAV-02 | Planner tab shows Day/Week toggle only | unit (render) | `cd frontend && npm test -- tests/unit/components/AppShell.test.tsx` | ❌ Wave 0 |
| NAV-03 | Inbox tab renders InboxPage | unit (render) | `cd frontend && npm test -- tests/unit/components/AppShell.test.tsx` | ❌ Wave 0 |
| NAV-04 | Integrations tab renders IntegrationSettingsContent | unit (render) | `cd frontend && npm test -- tests/unit/components/AppShell.test.tsx` | ❌ Wave 0 |
| NAV-05 | BottomTabBar hidden md+, Sidebar visible md+ | unit (render + class check) | `cd frontend && npm test -- tests/unit/components/AppShell.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend && npm test`
- **Per wave merge:** `cd frontend && npm test`
- **Phase gate:** Full unit suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `frontend/tests/unit/components/AppShell.test.tsx` — covers NAV-01 through NAV-05
- [ ] `frontend/tests/unit/components/BottomTabBar.test.tsx` — tab rendering, active state, badge
- [ ] `frontend/tests/unit/components/Sidebar.test.tsx` — sidebar rendering, active state, badge

---

## Security Domain

> `security_enforcement` not explicitly set to false — section included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Nav restructure only; auth handled by existing ProtectedRoute |
| V3 Session Management | No | No session changes |
| V4 Access Control | No | Route protection unchanged; all 3 tabs remain behind ProtectedRoute |
| V5 Input Validation | No | No new user inputs introduced |
| V6 Cryptography | No | No crypto changes |

**Security impact: none.** This phase is a pure layout/chrome refactor. No new API endpoints,
no new auth paths, no new user inputs.

---

## Environment Availability

> Step 2.6: This phase has no external dependencies beyond the project's existing dev stack.
> All work is frontend code changes only.

**SKIPPED** — no new tools, services, CLIs, or runtimes required. Existing `npm run dev`
(Vite) and `npm test` (Vitest) are sufficient.

---

## Open Questions

1. **AccountMenu `inboxCount` prop threading**
   - What we know: AccountMenu currently calls `useInboxCount()` independently.
   - What's unclear: Whether to refactor AccountMenu to accept `inboxCount` as a prop
     (requires touching the AccountMenu API) or tolerate 2 pollers (AppShell + AccountMenu).
   - Recommendation: Tolerate 2 pollers for now (both poll every 15 min, low overhead).
     The inbox icon in the feed header is removed entirely, so the count goes from 2 callers
     to 2 callers (AppShell + AccountMenu) — net neutral.

2. **`/settings/feed` route not in the tab bar**
   - What we know: `/settings/feed` is a protected route but not one of the 3 tabs.
   - What's unclear: Should it render inside AppShell (with bottom nav) or standalone?
   - Recommendation: Leave `/settings/feed` outside the nested AppShell route. It renders
     standalone as today. Users access it from AccountMenu. Out of scope for this phase.

3. **`TimelineViewMode` type narrowing**
   - What we know: `TimelineViewMode = 'feed' | 'timeline' | 'planner' | 'list' | 'week'`
     is used by hooks (`usePlannerTimeline`, `useWeeklyPlanner`), services, and the type
     is stored in `UserSettings.feedViewMode`.
   - What's unclear: Whether to add a `PlannerViewMode = 'planner' | 'week'` alias or
     simply constrain the feed page's local `useState` type annotation.
   - Recommendation: Add a local type alias in `feed/page.tsx` only:
     `type PlannerViewMode = 'planner' | 'week';` and use it for the local `viewMode` state.
     Leave `TimelineViewMode` unchanged in `types/timeline.ts` to avoid touching hooks.

---

## Sources

### Primary (HIGH confidence)
- `frontend/src/App.tsx` — confirmed routing structure, all existing routes [VERIFIED: codebase]
- `frontend/src/app/feed/page.tsx` — confirmed segmented control location, modes, viewMode state [VERIFIED: codebase]
- `frontend/src/components/inbox/InboxPage.tsx` — confirmed standalone header, `<a href>` link [VERIFIED: codebase]
- `frontend/src/app/settings/integrations/page.tsx` — confirmed IntegrationSettingsContent internal, nav pattern [VERIFIED: codebase]
- `frontend/src/hooks/useInboxCount.ts` — confirmed return type, polling behavior [VERIFIED: codebase]
- `frontend/src/components/AccountMenu.tsx` — confirmed independent `useInboxCount()` call [VERIFIED: codebase]
- `.planning/phases/07-navigation-restructure/07-UI-SPEC.md` — layout contracts, Tailwind classes, responsive rules [VERIFIED: project file]
- React Router v6 nested routes pattern — `<Outlet>` layout route is the canonical v6 approach [ASSUMED: training knowledge, widely documented]

---

## Metadata

**Confidence breakdown:**
- Current architecture (routing, nav, components): HIGH — direct codebase verification
- Implementation approach (AppShell, nested routes): HIGH — established React Router v6 pattern
- Specific Tailwind classes / dimensions: HIGH — copied directly from UI-SPEC
- Risks and gotchas: HIGH — identified from direct code inspection

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (stable codebase; no fast-moving deps)
