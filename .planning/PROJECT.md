# ordrctrl

## What This Is

A multi-source task aggregation and visual planning app built with React 18 + Vite + Tailwind, deployed via Capacitor (mobile) and Tauri (desktop). Currently pulls tasks and events from Gmail, Microsoft To Do, and Apple Calendar alongside native task creation. The feed page shows a bucketed list (Overdue/Today/This Week/Later/Unscheduled) but lacks a time-axis visual planner.

## Core Value

An ADHD-friendly visual time planner where your day is a spatial, navigable timeline — not an overwhelming list.

## Project Shape

- **Complexity:** complex
- **Why:** Multi-platform app (Capacitor + Tauri) with existing backend (Prisma/PostgreSQL), integration infrastructure, and a new visual timeline UI that must feel polished and responsive across form factors.

## Current State

- Backend: Fastify + Prisma + PostgreSQL with auth (session-based + OAuth), task CRUD, sync scheduler, feed/inbox services
- Frontend: React 18 + Vite + Tailwind with Capacitor (iOS/Android) and Tauri (desktop) targets
- Integrations: Gmail, Microsoft Tasks, Apple Calendar adapters with sync cache
- Feed page: Grouped list view (Overdue/Today/This Week/Later/Unscheduled) with basic timeline hook
- Native tasks: Title, description, dueAt, priority, status — no startAt or duration yet
- CI: GitHub Actions for lint/build/test, native build workflow for Capacitor/Tauri

## Architecture / Key Patterns

- Monorepo: `backend/` (Fastify + Prisma), `frontend/` (React + Vite + Tailwind), `docs/`, `specs/`
- Backend: Route modules (`api/*.routes.ts`), service layer (`feed/`, `inbox/`, `sync/`, `integrations/`), Prisma ORM
- Frontend: Page components, custom hooks (`useFeed`, `useTimeline`), Tailwind utility classes, vanilla pointer-event gestures
- Auth: Session-based with Apple/Google OAuth providers
- Sync: Scheduler-driven integration sync with cache layer (`SyncCacheItem`)
- Build: pnpm workspaces, Vite, Capacitor + Tauri for cross-platform

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

## Milestone Sequence

- [ ] M001: Timeline Visual Planner — ADHD-friendly visual time planner with daily/weekly views, schedulable native tasks, quick-create, and consistent UI theme
