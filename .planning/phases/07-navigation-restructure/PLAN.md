---
phase: 07-navigation-restructure
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/tests/unit/components/AppShell.test.tsx
  - frontend/tests/unit/components/BottomTabBar.test.tsx
  - frontend/tests/unit/components/Sidebar.test.tsx
  - frontend/src/components/BottomTabBar.tsx
  - frontend/src/components/Sidebar.tsx
  - frontend/src/components/AppShell.tsx
  - frontend/src/App.tsx
  - frontend/src/app/settings/integrations/page.tsx
  - frontend/src/app/feed/page.tsx
  - frontend/src/components/inbox/InboxPage.tsx
autonomous: false
requirements:
  - NAV-01
  - NAV-02
  - NAV-03
  - NAV-04
  - NAV-05

must_haves:
  truths:
    - "On mobile, tapping Planner / Inbox / Integrations in the bottom tab bar navigates to the correct view"
    - "On desktop (≥768px) the bottom tab bar is hidden and a 240px left sidebar appears with the same 3 destinations"
    - "Planner tab shows DailyPlannerView by default; Day/Week pill toggle switches to WeeklyPlannerView"
    - "Inbox tab shows InboxPage content without a standalone wordmark header"
    - "Integrations tab shows IntegrationSettingsContent without a standalone back-nav header"
    - "Active tab is visually distinct (black icon + label on mobile; bg-zinc-100 + black text in sidebar)"
    - "Inbox badge count appears on the tab icon/sidebar item when useInboxCount > 0; hidden when 0"
    - "FAB sits above the bottom tab bar on mobile; drops to bottom-right corner on desktop"
  artifacts:
    - path: "frontend/src/components/AppShell.tsx"
      provides: "Shared layout shell — top bar (mobile), BottomTabBar, Sidebar, <Outlet />"
      exports: ["AppShell"]
    - path: "frontend/src/components/BottomTabBar.tsx"
      provides: "Fixed 56px bottom nav with 3 tabs, inline SVG icons, inbox badge"
      exports: ["BottomTabBar"]
    - path: "frontend/src/components/Sidebar.tsx"
      provides: "Fixed 240px left sidebar with wordmark, AccountMenu, 3 nav items, inbox badge"
      exports: ["Sidebar"]
    - path: "frontend/src/App.tsx"
      provides: "Nested layout route — AppShell wraps /feed, /inbox, /settings/integrations"
      contains: "<Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>"
    - path: "frontend/tests/unit/components/AppShell.test.tsx"
      provides: "NAV-01 through NAV-05 unit coverage"
  key_links:
    - from: "App.tsx nested layout route"
      to: "AppShell.tsx <Outlet />"
      via: "React Router v6 nested route"
      pattern: "Outlet"
    - from: "AppShell.tsx"
      to: "useInboxCount"
      via: "single hook call, inboxCount prop passed to BottomTabBar + Sidebar"
      pattern: "useInboxCount"
    - from: "BottomTabBar / Sidebar active state"
      to: "useLocation().pathname"
      via: "pathname.startsWith check per tab"
      pattern: "useLocation"
---

<objective>
Replace the 5-mode segmented control with a 3-tab navigation shell — bottom tab bar on mobile,
left sidebar on desktop — so users navigate the app via Planner | Inbox | Integrations.

Purpose: NAV-01 through NAV-05. The current header-embedded segmented control has 5 modes
(feed/timeline/planner/list/week) mixed into the chrome of a single page. This refactor
promotes navigation to a proper shell-level concern, gives Inbox and Integrations first-class
tab status, and produces a layout that scales naturally from mobile to desktop.

Output:
- 3 new components: AppShell, BottomTabBar, Sidebar
- React Router v6 nested layout route wrapping all 3 tab destinations
- FeedPage and InboxPage stripped of standalone chrome; AppShell owns all viewport framing
- Day/Week pill toggle replaces the 5-mode segmented control inside the Planner tab
- FAB and toast positions updated to clear the new 56px bottom nav on mobile
</objective>

<execution_context>
@.github/gsd-core/workflows/execute-plan.md
@.github/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/07-navigation-restructure/RESEARCH.md
@.planning/phases/07-navigation-restructure/07-UI-SPEC.md
@frontend/src/App.tsx
@frontend/src/app/feed/page.tsx
@frontend/src/components/inbox/InboxPage.tsx
@frontend/src/app/settings/integrations/page.tsx
@frontend/src/hooks/useInboxCount.ts
@frontend/src/components/AccountMenu.tsx
@frontend/tests/unit/components/AccountMenu.test.tsx
</context>

<tasks>

<!-- ═══════════════════════════════════════════════════════
     WAVE 1A — Test scaffold (RED — runs before components exist)
     ═══════════════════════════════════════════════════════ -->

<task type="auto" tdd="true">
  <name>Wave 1A — Test scaffold: RED tests for NAV-01 through NAV-05</name>
  <files>
    frontend/tests/unit/components/AppShell.test.tsx
    frontend/tests/unit/components/BottomTabBar.test.tsx
    frontend/tests/unit/components/Sidebar.test.tsx
  </files>
  <behavior>
    BottomTabBar.test.tsx:
    - Renders exactly 3 tab buttons: "PLANNER", "INBOX", "INTEGRATIONS"
    - Active path "/feed" → Planner tab has text-black class; Inbox + Integrations have text-zinc-400
    - Active path "/inbox" → Inbox tab is active
    - Active path "/settings/integrations" → Integrations tab is active
    - inboxCount=3 → badge renders "3"; inboxCount=0 → badge not in DOM
    - inboxCount=10 → badge renders "9+"
    - Container has classes: "fixed", "bottom-0", "md:hidden"

    Sidebar.test.tsx:
    - Renders "ORDRCTRL" wordmark text
    - Renders "Planner", "Inbox", "Integrations" nav item labels
    - Active path "/feed" → Planner item has "bg-zinc-100" class; others do not
    - Active path "/inbox" → Inbox item has "bg-zinc-100"
    - inboxCount=2 → badge "2" appears in sidebar; inboxCount=0 → not in DOM
    - Container has classes: "hidden", "md:flex", "w-[240px]"

    AppShell.test.tsx:
    - Renders BottomTabBar (has "PLANNER" text)
    - Renders Sidebar (has "ORDRCTRL" text)
    - Renders <Outlet /> slot (route content appears)
    - useInboxCount mock called once (not twice)
  </behavior>
  <action>
    Create the three test files using the existing pattern from
    `frontend/tests/unit/components/AccountMenu.test.tsx`:
    - `import { describe, it, expect, vi, beforeEach } from 'vitest'`
    - `import { render, screen } from '@testing-library/react'`
    - `import { MemoryRouter } from 'react-router-dom'`
    - Mock `useInboxCount` via `vi.mock('@/hooks/useInboxCount', () => ({ useInboxCount: () => ({ inboxCount: 0 }) }))`
    - For AppShell.test.tsx, also mock `@/components/BottomTabBar` and `@/components/Sidebar`
      as lightweight stubs that render their display names, to isolate AppShell from child
      component internals. Mock react-router-dom `<Outlet>` as `() => <div data-testid="outlet" />`

    These tests MUST FAIL (RED) when first created — the component files don't exist yet.
    Write the tests to import from their eventual paths:
    - `@/components/BottomTabBar`
    - `@/components/Sidebar`
    - `@/components/AppShell`

    Do not create placeholder component files. The RED state is expected and required.
  </action>
  <verify>
    <automated>cd frontend && npm test -- tests/unit/components/BottomTabBar.test.tsx tests/unit/components/Sidebar.test.tsx tests/unit/components/AppShell.test.tsx 2>&1 | grep -E "FAIL|Cannot find|failed" | head -10</automated>
  </verify>
  <done>
    All three test files exist. Running them produces import/module-not-found errors (RED).
    No syntax errors in the test files themselves (TypeScript parses cleanly).
  </done>
</task>

<!-- ═══════════════════════════════════════════════════════
     WAVE 1B — New leaf components (parallel with 1A)
     ═══════════════════════════════════════════════════════ -->

<task type="auto" tdd="true">
  <name>Wave 1B — Build BottomTabBar and Sidebar components</name>
  <files>
    frontend/src/components/BottomTabBar.tsx
    frontend/src/components/Sidebar.tsx
  </files>
  <behavior>
    BottomTabBar:
    - Props: `{ inboxCount: number; activePath: string }`
    - Renders 3 tab items: Planner (/feed), Inbox (/inbox), Integrations (/settings/integrations)
    - Active detection: `activePath.startsWith(tab.path)` — not exact match
    - Active tab: `text-black`; inactive: `text-zinc-400`
    - Inbox badge visible only when inboxCount > 0; shows "9+" when > 9
    - Tab item uses `<Link to={path}>` (react-router-dom), not `<a href>`
    - Container has `md:hidden` so it's invisible on desktop

    Sidebar:
    - Props: `{ inboxCount: number; activePath: string }`
    - Renders wordmark + AccountMenu in 48px header
    - 3 nav items with 16×16 SVG icons, labels, active state styling
    - Active item: `bg-zinc-100 text-black font-semibold`; inactive: `text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50`
    - Inbox badge (ml-auto pill, 18px height) visible only when inboxCount > 0
    - Container has `hidden md:flex` so it's invisible on mobile
  </behavior>
  <action>
    Create `frontend/src/components/BottomTabBar.tsx`:

    Interface:
    ```
    interface Tab { label: string; path: string; icon: React.ReactNode; }
    interface Props { inboxCount: number; activePath: string; }
    export function BottomTabBar({ inboxCount, activePath }: Props)
    ```

    Container classes (exact from UI-SPEC §1):
    `fixed bottom-0 left-0 right-0 flex md:hidden bg-white border-t border-zinc-100 z-30 pb-[env(safe-area-inset-bottom)]`

    Per tab item:
    `flex-1 flex flex-col items-center justify-center pt-2 pb-1 gap-0.5 min-h-[56px] cursor-pointer select-none transition-colors`
    Active color: `text-black`; inactive: `text-zinc-400`

    Tab label: `text-[0.65rem] font-semibold uppercase tracking-[0.08em]`

    Icons — all 22×22 SVG, viewBox="0 0 24 24", fill="none", stroke="currentColor",
    strokeWidth="1.5", strokeLinecap="round", strokeLinejoin="round":
    - Planner (calendar): `<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>`
    - Inbox (tray): `<path d="M4 4h16v12H4z"/><path d="M4 16l4-4h8l4 4"/>`
    - Integrations (plug): `<path d="M7 7l-5 5 3 3 5-5M17 17l5-5-3-3-5 5M14 5l5 5M5 14l5 5M9 9l6 6"/>`

    Inbox badge (on Inbox tab icon container — add `relative` to that container):
    `absolute -top-1 -right-1 w-4 h-4 bg-black text-white text-[0.55rem] font-semibold rounded-full flex items-center justify-center leading-none`
    Render only when `inboxCount > 0`. Display: `inboxCount > 9 ? '9+' : String(inboxCount)`

    Use `<Link to={tab.path}>` from react-router-dom for each tab button.
    The 3 tabs array:
    ```
    const TABS = [
      { label: 'Planner', path: '/feed', icon: <CalendarIcon /> },
      { label: 'Inbox',   path: '/inbox', icon: <InboxIcon /> },
      { label: 'Integrations', path: '/settings/integrations', icon: <PlugIcon /> },
    ]
    ```

    ---

    Create `frontend/src/components/Sidebar.tsx`:

    Interface:
    ```
    interface Props { inboxCount: number; activePath: string; }
    export function Sidebar({ inboxCount, activePath }: Props)
    ```

    Container classes (exact from UI-SPEC §2):
    `hidden md:flex fixed left-0 top-0 bottom-0 w-[240px] flex-col bg-white border-r border-zinc-100 z-30 pt-[env(safe-area-inset-top)]`

    Sidebar header (48px):
    `h-12 px-5 flex items-center justify-between flex-shrink-0 border-b border-zinc-100`
    - Wordmark: `<span className="text-[0.65rem] font-semibold tracking-[0.28em] uppercase text-black">ordrctrl</span>`
    - Right: `<AccountMenu />`

    Nav item list: `flex-1 flex flex-col pt-2 px-2`

    Per nav item (use `<Link>`):
    `flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer select-none transition-colors w-full`
    Active: `bg-zinc-100 text-black font-semibold`
    Inactive: `text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 font-normal`

    Nav icon (16×16 SVG, same paths as BottomTabBar icons): `shrink-0`
    Nav label: `text-sm flex-1`

    Inbox badge (ml-auto):
    `ml-auto min-w-[18px] h-[18px] px-1 bg-black text-white text-[0.55rem] font-semibold rounded-full flex items-center justify-center leading-none`
    Render only when `inboxCount > 0`.

    Both files use `import { Link } from 'react-router-dom'` and
    `import { AccountMenu } from '@/components/AccountMenu'` (Sidebar only).
    No @apply, no inline style except for any runtime-computed values.
  </action>
  <verify>
    <automated>cd frontend && npm run typecheck 2>&1 | grep -E "BottomTabBar|Sidebar|error TS" | head -20</automated>
  </verify>
  <done>
    Both component files exist and typecheck cleanly. The Wave 1A tests for BottomTabBar and
    Sidebar now pass (GREEN). `cd frontend && npm test -- tests/unit/components/BottomTabBar.test.tsx tests/unit/components/Sidebar.test.tsx` exits 0.
  </done>
</task>

<!-- ═══════════════════════════════════════════════════════
     WAVE 2 — AppShell + Route Wiring
     ═══════════════════════════════════════════════════════ -->

<task type="auto" tdd="true">
  <name>Wave 2 — AppShell layout shell + nested route in App.tsx + export IntegrationSettingsContent</name>
  <files>
    frontend/src/components/AppShell.tsx
    frontend/src/App.tsx
    frontend/src/app/settings/integrations/page.tsx
  </files>
  <behavior>
    AppShell:
    - Calls `useInboxCount()` exactly once; passes `inboxCount` to BottomTabBar and Sidebar as props
    - Calls `useLocation()` once; passes `pathname` to BottomTabBar and Sidebar as `activePath`
    - Mobile layout: `h-[100dvh] bg-white flex flex-col pt-[env(safe-area-inset-top)] overflow-hidden`
      → 48px mobile top bar (hidden on desktop via `md:hidden`)
      → `<main className="flex-1 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">`
        containing `<Outlet />`
      → `<BottomTabBar />` (self-hides on md+ via its own `md:hidden`)
    - Desktop layout: Sidebar (self-shows on md+ via its own `hidden md:flex`); content area `md:ml-[240px]`
    - Mobile top bar (visible only `< md`): same chrome as old FeedPage header —
      `border-b border-zinc-100 px-5 h-12 flex items-center justify-between flex-shrink-0 bg-white z-10 md:hidden`
      Left: `<span className="text-[0.65rem] font-semibold tracking-[0.28em] uppercase text-black">ordrctrl</span>`
      Right: `<AccountMenu />`

    App.tsx nested route:
    - Parent route: `<Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>`
      - `<Route path="feed" element={<FeedPage />} />`
      - `<Route path="inbox" element={<InboxRoute />} />`
      - `<Route path="settings/integrations" element={<IntegrationSettingsContent />} />`
    - Remove the three individual `<ProtectedRoute>` wrappers from those routes
    - All other routes (onboarding, settings/feed, auth routes) remain UNCHANGED

    IntegrationSettingsContent:
    - Add `export` keyword to the function declaration in `page.tsx`
    - IntegrationSettingsPage (default export) stays unchanged for direct deep-link use
  </behavior>
  <action>
    Create `frontend/src/components/AppShell.tsx`:

    Imports:
    ```
    import { Outlet, useLocation } from 'react-router-dom';
    import { useInboxCount } from '@/hooks/useInboxCount';
    import { BottomTabBar } from '@/components/BottomTabBar';
    import { Sidebar } from '@/components/Sidebar';
    import { AccountMenu } from '@/components/AccountMenu';
    ```

    Export: `export function AppShell()`

    Full JSX structure:
    ```
    <div className="h-[100dvh] bg-white flex overflow-hidden">
      <Sidebar inboxCount={inboxCount} activePath={pathname} />
      <div className="flex-1 flex flex-col pt-[env(safe-area-inset-top)] md:ml-[240px] overflow-hidden">
        {/* Mobile-only top bar */}
        <header className="border-b border-zinc-100 px-5 h-12 flex items-center justify-between flex-shrink-0 bg-white z-10 md:hidden">
          <span className="text-[0.65rem] font-semibold tracking-[0.28em] uppercase text-black">ordrctrl</span>
          <AccountMenu />
        </header>
        <main className="flex-1 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          <Outlet />
        </main>
        <BottomTabBar inboxCount={inboxCount} activePath={pathname} />
      </div>
    </div>
    ```

    Notes:
    - `pt-[env(safe-area-inset-top)]` is on the inner flex column, NOT the outer div, because
      Sidebar uses its own `pt-[env(safe-area-inset-top)]`. The outer div is a pure flex row.
    - `md:ml-[240px]` clears the fixed sidebar on desktop. On mobile the sidebar is `display:none`
      so no offset is needed.
    - The mobile `<main>` carries `pb-[calc(4rem+env(safe-area-inset-bottom))]` (64px = 56px tab
      bar + 8px clear) so that scroll content isn't hidden behind the tab bar. On desktop
      (`md:pb-0`) this padding is removed.

    ---

    Update `frontend/src/App.tsx`:

    Replace the three individual protected routes:
    ```tsx
    <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
    <Route path="/inbox" element={<ProtectedRoute><InboxRoute /></ProtectedRoute>} />
    <Route path="/settings/integrations" element={<ProtectedRoute><IntegrationSettingsPage /></ProtectedRoute>} />
    ```

    With a nested layout route:
    ```tsx
    <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
      <Route path="/feed" element={<FeedPage />} />
      <Route path="/inbox" element={<InboxRoute />} />
      <Route path="/settings/integrations" element={<IntegrationSettingsContent />} />
    </Route>
    ```

    Add `import { AppShell } from '@/components/AppShell'` to the import block.
    Add `import { IntegrationSettingsContent } from '@/app/settings/integrations/page'`
    (the named export, separate from the default `IntegrationSettingsPage` import which can
    be removed or kept for future deep-link use — remove it since it's no longer routed directly).

    Keep all other routes exactly as they are. Keep the `<Navigate to="/feed" replace />` root redirect.

    ---

    Update `frontend/src/app/settings/integrations/page.tsx`:

    Change line:
    ```
    function IntegrationSettingsContent()
    ```
    to:
    ```
    export function IntegrationSettingsContent()
    ```

    No other changes. `IntegrationSettingsPage` (default export) is preserved as-is.
  </action>
  <verify>
    <automated>cd frontend && npm run typecheck 2>&1 | grep -E "error TS|AppShell|Outlet" | head -20</automated>
  </verify>
  <done>
    AppShell.tsx exists and typechecks. App.tsx uses nested layout route. IntegrationSettingsContent
    is exported. `cd frontend && npm test -- tests/unit/components/AppShell.test.tsx` passes (GREEN).
    `npm run dev` starts without errors; navigating to /feed, /inbox, /settings/integrations all
    render inside AppShell chrome.
  </done>
</task>

<!-- ═══════════════════════════════════════════════════════
     WAVE 3 — Strip old chrome from tab pages
     ═══════════════════════════════════════════════════════ -->

<task type="auto">
  <name>Wave 3A — Refactor FeedPage: strip outer wrapper + replace 5-mode control with Day/Week toggle</name>
  <files>
    frontend/src/app/feed/page.tsx
  </files>
  <action>
    FeedPage is now a content fragment rendered inside AppShell's `<main>`. Make these changes:

    1. REMOVE outer wrapper. The outermost JSX element is:
       ```
       <div className="h-[100dvh] bg-white flex flex-col pt-[env(safe-area-inset-top)] overflow-hidden">
       ```
       Replace the entire component's return value. The new top-level structure is:
       ```
       <>
         {/* Day/Week sub-header toggle strip */}
         <div className="flex items-center justify-center h-11 border-b border-zinc-100 flex-shrink-0 bg-white">
           ...toggle...
         </div>
         {/* Scrollable content area */}
         <div className={`flex-1 overflow-y-auto ${viewMode === 'week' ? 'overflow-x-auto' : 'overflow-x-hidden'} touch-pan-y`}>
           ...existing content...
         </div>
         {/* FAB, sheets, modals, toasts remain */}
       </>
       ```

    2. REMOVE the entire `<header>` block (lines ~131–198 in original). This header contained:
       - The ordrctrl wordmark span
       - The 5-mode segmented control div
       - The inbox icon link (Link to="/inbox" with badge)
       - The AccountMenu
       AppShell now provides the top bar chrome on mobile and sidebar on desktop.

    3. ADD Day/Week sub-header toggle strip immediately after the removed outer-wrapper open tag.
       Per UI-SPEC §4:
       Container: `flex items-center justify-center h-11 border-b border-zinc-100 flex-shrink-0 bg-white`
       Pill wrapper: `flex items-center rounded-full border border-zinc-200 overflow-hidden text-[0.65rem] font-semibold`
       Each button (Day / Week only):
       - Active: `bg-black text-white px-4 py-1.5 border-0 cursor-pointer transition-colors`
       - Inactive: `bg-transparent text-zinc-500 hover:text-black px-4 py-1.5 border-0 cursor-pointer transition-colors`
       Copy: "Day" maps to 'planner' mode; "Week" maps to 'week' mode.
       Toggle should be hidden when `showDismissed` is true (same guard as the old segmented control):
       `{!showDismissed && <div className="flex items-center justify-center h-11 ...">...</div>}`

    4. NARROW the viewMode type. Add a local type alias near the top of FeedPageContent:
       `type PlannerViewMode = Extract<TimelineViewMode, 'planner' | 'week'>`
       Change the useState declaration from:
       `const [viewMode, setViewMode] = useState<TimelineViewMode>('feed')`
       to:
       `const [viewMode, setViewMode] = useState<PlannerViewMode>('planner')`
       In the settings load effect, update the rehydration guard:
       ```
       const stored = s.feedViewMode;
       if (stored === 'planner' || stored === 'week') setViewMode(stored);
       // Otherwise default stays 'planner' (handles legacy 'feed'/'timeline'/'list' values)
       ```

    5. REMOVE the `useInboxCount` import and call from feed/page.tsx. The hook is now called
       once in AppShell and its result passed to BottomTabBar/Sidebar. The feed page no longer
       needs `inboxCount`.

    6. REMOVE inner bottom padding from scroll content wrappers. The two `pb-[calc(7rem+env(safe-area-inset-bottom))]`
       occurrences (WeeklyPlannerView container and main wrapper) should become `pb-4` each.
       AppShell's `<main>` already provides `pb-[calc(4rem+env(safe-area-inset-bottom))]` for
       tab-bar clearance; double-padding would cut off scroll content.

    7. Keep all existing logic intact: useFeed, useTimeline, useNativeTasks, usePlannerTimeline,
       useWeeklyPlanner, sourceFilter, plannerDate, weekStart, showAddForm, showQuickCreate,
       editingTask, FeedSection, CompletedSection, IntegrationErrorBanner, DailyPlannerView,
       WeeklyPlannerView, QuickCreateSheet, EditTaskModal, AddTaskForm — none of these change.

    The rendered modes change: only 'planner' (DailyPlannerView) and 'week' (WeeklyPlannerView)
    are valid. The feed/timeline/list rendering branches can be removed entirely (they were
    gated on viewMode === 'feed', 'timeline', 'list'). Verify no other logic paths reference
    those removed modes before deleting.
  </action>
  <verify>
    <automated>cd frontend && npm run typecheck 2>&1 | grep "feed/page" | head -10</automated>
  </verify>
  <done>
    feed/page.tsx typechecks with no errors. The 5-mode segmented control JSX is gone. A
    Day/Week toggle sub-header renders. `viewMode` state type is `PlannerViewMode`. The
    `useInboxCount` import is removed. Inner pb values are `pb-4`.
  </done>
</task>

<task type="auto">
  <name>Wave 3B — Strip InboxPage standalone header (parallel with 3A)</name>
  <files>
    frontend/src/components/inbox/InboxPage.tsx
  </files>
  <action>
    InboxPage is now rendered inside AppShell's `<main>`. Strip the following:

    1. REMOVE outermost wrapper div:
       ```
       <div className="h-[100dvh] bg-white flex flex-col pt-[env(safe-area-inset-top)] overflow-hidden">
       ```
       The component return becomes a fragment `<>...</>` (or the inner scroll container
       as the new root).

    2. REMOVE the standalone `<header>` block entirely. Per RESEARCH.md §Q3 the header contains:
       - The ordrctrl wordmark
       - An `<a href="/feed">← Back to feed</a>` raw anchor (causes full-page reload — gone)
       AppShell's mobile top bar provides the wordmark. The back link disappears; users navigate
       via the bottom tab bar instead.

    3. REMOVE the intermediate `<div className="flex-1 overflow-y-auto">` scroll container.
       AppShell's `<main>` is the scroll context now. The inner `<main>` (Inbox content) should
       be the new root element.

    4. Keep everything inside the inner `<main>`: title row, section headers, inbox item rows,
       loading/empty/error states, Schedule/Dismiss CTAs. No content logic changes.

    5. The component signature `export function InboxPage(props)` remains unchanged.
       InboxRoute in `frontend/src/app/inbox/page.tsx` passes props unchanged; no prop changes
       are needed at this step.

    Resulting structure:
    ```
    export function InboxPage(...) {
      ...
      return (
        <main className="max-w-[40rem] w-full mx-auto px-5 pt-6 pb-4">
          {/* title row, sections, items — all unchanged */}
        </main>
      );
    }
    ```
    Preserve existing `pt-6` (or `pt-4`) on the inner main — this is content padding, not
    chrome. AppShell handles safe-area and tab-bar clearance.
  </action>
  <verify>
    <automated>cd frontend && npm run typecheck 2>&1 | grep "InboxPage" | head -10</automated>
  </verify>
  <done>
    InboxPage.tsx has no `h-[100dvh]` wrapper, no standalone header, no `overflow-hidden`.
    Typechecks clean. The `← Back to feed` anchor is removed.
  </done>
</task>

<!-- ═══════════════════════════════════════════════════════
     WAVE 4 — Polish: FAB / toast offsets + human verify
     ═══════════════════════════════════════════════════════ -->

<task type="auto">
  <name>Wave 4A — Fix FAB and toast bottom offsets to clear 56px tab bar on mobile</name>
  <files>
    frontend/src/app/feed/page.tsx
  </files>
  <action>
    Three `fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))]` occurrences in feed/page.tsx
    must be updated to clear the 56px bottom tab bar that now exists on mobile:

    Current value: `bottom-[calc(1.5rem+env(safe-area-inset-bottom))]`
    — 1.5rem = 24px above the safe-area inset, which puts the FAB/toast INSIDE the 56px tab bar.

    New value: `bottom-[calc(5rem+env(safe-area-inset-bottom))]`
    — 5rem = 80px (56px tab bar + 24px gap above it), sitting comfortably above the tab bar.
    — On desktop (≥768px) no tab bar exists; add responsive override via Tailwind md: breakpoint.

    For the FAB button (`className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-6 ..."`):
    Replace the bottom value:
    `bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6`
    Keep all other classes unchanged: `right-6 w-12 h-12 bg-black border-0 cursor-pointer flex items-center justify-center shadow-lg z-20`

    For the two toast divs (cleared-completed toast and undo toast):
    Both currently use `fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2`.
    Replace only the bottom portion:
    `fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 left-1/2 -translate-x-1/2`

    No other changes in this task. FAB click handlers, QuickCreateSheet, EditTaskModal, undo
    toast logic — all untouched.
  </action>
  <verify>
    <automated>cd frontend && grep -c "bottom-\[calc(1.5rem" src/app/feed/page.tsx</automated>
  </verify>
  <done>
    `grep -c "bottom-[calc(1.5rem" src/app/feed/page.tsx` returns 0.
    All three occurrences replaced with `bottom-[calc(5rem+env(safe-area-inset-bottom))]`.
    FAB and both toasts have `md:bottom-6` desktop override.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Wave 4B — Human verify: full nav flow on mobile and desktop viewports</name>
  <what-built>
    A complete navigation shell: 3-tab bottom bar on mobile, left sidebar on desktop.
    AppShell wraps /feed, /inbox, /settings/integrations. Old segmented control is gone.
    Planner tab has Day/Week toggle. FAB clears the tab bar. Inbox badge shows count.
  </what-built>
  <how-to-verify>
    Run: `cd frontend && npm run dev`
    Open: http://localhost:5173

    MOBILE CHECK (resize browser to ≤767px, or use DevTools mobile emulation):
    1. Bottom tab bar is visible with 3 tabs: PLANNER | INBOX | INTEGRATIONS
    2. Active tab (PLANNER) has black icon + label; others are zinc-400 (muted)
    3. Tap INBOX → navigates to /inbox, Inbox tab becomes active, content shows InboxPage
    4. Tap INTEGRATIONS → navigates to /settings/integrations, shows integration cards
    5. Tap PLANNER → returns to /feed, shows DailyPlannerView by default
    6. Day/Week toggle is visible below the top bar — tapping "Week" switches to WeeklyPlannerView
    7. FAB (+) is visible ABOVE the bottom tab bar (not hidden behind it)
    8. No standalone wordmark/header inside Inbox or Integrations content (only in the app top bar)
    9. Scroll Inbox or Planner content — bottom content is not cut off behind the tab bar

    DESKTOP CHECK (resize browser to ≥768px):
    10. Bottom tab bar disappears; left sidebar appears (240px wide) with wordmark + 3 nav items
    11. Active nav item (Planner) has bg-zinc-100 + black bold text; others are zinc-400
    12. Content area has ml-[240px] offset — no overlap with sidebar
    13. AccountMenu appears in sidebar header (top right of sidebar), NOT in a top app bar

    INBOX BADGE CHECK:
    14. If inboxCount > 0, a small black badge appears on the Inbox tab icon (mobile) and
        beside "Inbox" label in the sidebar (desktop). If count is 0, badge is absent.

    TYPE OK:
    15. `cd frontend && npm test` exits 0 (all unit tests pass)
  </how-to-verify>
  <resume-signal>
    Type "approved" if all checks pass, or describe any issues found (e.g. "FAB still overlaps tab bar", "sidebar not showing on desktop").
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client router → protected routes | ProtectedRoute check now happens once at AppShell level, not per-route |
| InboxPage | No new user inputs; existing schedule/dismiss CTAs unchanged |
| IntegrationSettingsContent | OAuth query param flow (`?connected=`, `?step=`, `?error=`) unchanged — useSearchParams works in nested routes |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07-01 | Elevation of Privilege | ProtectedRoute nesting | accept | AppShell parent route carries `<ProtectedRoute>` — all 3 tab routes inherit auth guard. Unauthenticated users attempting /feed, /inbox, or /settings/integrations are redirected to /login by the existing ProtectedRoute logic. Per RESEARCH.md: ASVS V4 Access Control — no new bypass surface introduced. |
| T-07-02 | Information Disclosure | useInboxCount polling | accept | Hook polls a private authenticated endpoint; no credentials exposed to DOM or logs. Two independent pollers (AppShell + AccountMenu) is the deliberate design choice documented in RESEARCH.md §Q5. |
| T-07-03 | Spoofing | Active-tab detection via useLocation | accept | `activePath.startsWith(tab.path)` is a client-side display concern only. Route protection is enforced by ProtectedRoute at the router level, not by tab highlighting. |
| T-07-SC | Tampering | npm install (no new packages) | accept | This phase introduces zero new npm packages. No package legitimacy gate required. Existing Vite/React/React-Router-v6 deps are unchanged. |
</threat_model>

<verification>
Full phase is complete when ALL of the following pass:

```bash
# 1. Typecheck
cd frontend && npm run typecheck

# 2. Unit tests (all NAV-01 through NAV-05 cases)
cd frontend && npm test -- tests/unit/components/AppShell.test.tsx \
  tests/unit/components/BottomTabBar.test.tsx \
  tests/unit/components/Sidebar.test.tsx

# 3. No legacy pb-7rem in feed page
cd frontend && grep -c "pb-\[calc(7rem" src/app/feed/page.tsx
# Expected: 0

# 4. No legacy bottom-1.5rem in feed page
cd frontend && grep -c "bottom-\[calc(1.5rem" src/app/feed/page.tsx
# Expected: 0

# 5. No h-[100dvh] in FeedPage or InboxPage
cd frontend && grep -rn "h-\[100dvh\]" src/app/feed/page.tsx src/components/inbox/InboxPage.tsx
# Expected: no matches

# 6. No standalone ordrctrl header in FeedPage or InboxPage
cd frontend && grep -c "Back to feed" src/components/inbox/InboxPage.tsx
# Expected: 0

# 7. AppShell uses Outlet
cd frontend && grep -c "Outlet" src/components/AppShell.tsx
# Expected: >= 1

# 8. IntegrationSettingsContent is exported
cd frontend && grep -c "^export function IntegrationSettingsContent" \
  src/app/settings/integrations/page.tsx
# Expected: 1

# 9. Full test suite green
cd frontend && npm test
```
</verification>

<success_criteria>
1. **NAV-01:** Fixed bottom tab bar with Planner | Inbox | Integrations renders on viewports < 768px.
   Hidden on ≥ 768px via `md:hidden`.
2. **NAV-02:** Planner tab (`/feed`) shows DailyPlannerView by default. Day/Week pill toggle
   (44px sub-header strip) switches to WeeklyPlannerView. The 5-mode segmented control (feed /
   timeline / planner / list / week) is fully removed.
3. **NAV-03:** Inbox tab (`/inbox`) shows InboxPage content — no standalone wordmark header,
   no `← Back to feed` link, no `h-[100dvh]` wrapper.
4. **NAV-04:** Integrations tab (`/settings/integrations`) renders `IntegrationSettingsContent`
   directly — exported named function, no back-nav chrome.
5. **NAV-05:** On ≥ 768px, a fixed 240px left sidebar with wordmark, AccountMenu, and 3 nav items
   replaces the bottom tab bar. Content area offset by `ml-[240px]`.
6. **Badge:** `useInboxCount` called once in AppShell; count passed as prop. Badge appears on
   Inbox tab / sidebar item when count > 0; absent when count = 0.
7. **FAB:** Positioned `bottom-[calc(5rem+env(safe-area-inset-bottom))]` on mobile (clears 56px
   tab bar + 24px gap); `md:bottom-6` on desktop.
8. **Tests:** `cd frontend && npm test` exits 0 with all NAV-* unit tests passing.
</success_criteria>

<output>
Create `.planning/phases/07-navigation-restructure/07-01-SUMMARY.md` when done.
</output>
