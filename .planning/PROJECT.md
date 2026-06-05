# ordrctrl

## What This Is

A multi-source task aggregation and visual planning app built with React 18 + Vite + Tailwind, deployed via Capacitor (mobile) and Tauri (desktop). Pulls tasks and events from Gmail, Microsoft To Do, and Apple Calendar alongside native task creation. The feed page offers a bucketed list view (Overdue/Today/This Week/Later/Unscheduled) **and** a time-axis visual planner with daily and weekly timeline views, quick-create, and a segmented view toggle.

## Core Value

An ADHD-friendly visual time planner where your day is a spatial, navigable timeline — not an overwhelming list.

## Project Shape

- **Complexity:** complex
- **Why:** Multi-platform app (Capacitor + Tauri) with existing backend (Prisma/PostgreSQL), integration infrastructure, and a new visual timeline UI that must feel polished and responsive across form factors.

## Current State

**Shipped: v1.0 (2026-06-05)**

- Backend: Fastify + Prisma + PostgreSQL with auth, task CRUD (startAt/duration/endAt), sync scheduler, feed/inbox services — 254 passing backend tests
- Frontend: React 18 + Vite + Tailwind, 5-tab segmented control (Feed / Timeline / Planner / List / Week), DailyPlannerView, WeeklyPlannerView, QuickCreateSheet — 145 passing frontend tests
- Integrations: Gmail, Microsoft Tasks, Apple Calendar adapters with sync cache
- Capacitor (iOS/Android) + Tauri (desktop) targets — verified at mobile (430×932) and desktop (1280×800) viewports

## Architecture / Key Patterns

- Monorepo: `backend/` (Fastify + Prisma), `frontend/` (React + Vite + Tailwind), `docs/`, `specs/`
- Backend: Route modules (`api/*.routes.ts`), service layer (`feed/`, `inbox/`, `sync/`, `integrations/`), Prisma ORM
- Frontend: Page components, custom hooks (`useFeed`, `useTimeline`), Tailwind utility classes, vanilla pointer-event gestures
- Auth: Session-based with Apple/Google OAuth providers
- Sync: Scheduler-driven integration sync with cache layer (`SyncCacheItem`)
- Build: pnpm workspaces, Vite, Capacitor + Tauri for cross-platform

## Capability Contract

See `.planning/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

## Milestone Sequence

- [x] v1.0: Timeline Visual Planner — ADHD-friendly visual time planner with daily/weekly views, schedulable native tasks, quick-create, and consistent UI theme *(shipped 2026-06-05)*
