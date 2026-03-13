# ordrctrl Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-04

## Active Technologies
- TypeScript 5.4 (backend: Node.js/Fastify; frontend: React/Next.js 14) + Fastify (backend API), React + Tailwind CSS (frontend), Prisma ORM (002-uncheck-completed)
- PostgreSQL 16 (primary data), Redis 7 (session cache, BullMQ job queue) (002-uncheck-completed)
- TypeScript 5.4 (backend + frontend) + Fastify 4, Prisma 5, BullMQ (backend); Next.js 14 + React 18 + Tailwind CSS (frontend); Zod (validation); Vitest + Supertest (tests) (003-selective-import)
- PostgreSQL 16 (Prisma ORM) — two new columns on `Integration` table; Redis 7 for BullMQ sync queue (003-selective-import)
- TypeScript 5.x / Node.js 20 LTS (backend); React 18 + TypeScript (frontend) + Fastify (HTTP server), Prisma (ORM + migrations), BullMQ (sync queue), node-fetch (CalDAV HTTP), zod (input validation), AES-256-GCM via `backend/src/lib/encryption.ts` (004-apple-basic-auth)
- PostgreSQL via Prisma — one new field (`calendarEventWindowDays Int @default(30)`) on existing `Integration` model; one migration required (004-apple-basic-auth)
- TypeScript (Node.js backend, React frontend) + Fastify (API), Prisma (ORM), Zod (validation), React Query (frontend state) (005-feed-dismissal)
- TypeScript — backend Node.js, frontend Next.js 14 / React 18 + Prisma ORM, BullMQ, existing IntegrationAdapter interface (007-source-sync)
- PostgreSQL via Prisma — one schema migration required (new field + enum) (007-source-sync)
- TypeScript (Node.js 18, Next.js 14) + Prisma ORM, Express-style API routes (Next.js App Router + custom backend), React 18, BullMQ (sync scheduler) (008-clear-completed)
- TypeScript (Node.js 20, Next.js 14) + Fastify (backend), Next.js + React 18 (frontend), Prisma ORM, BullMQ (sync queue), Vitest (tests) (009-multi-account)
- PostgreSQL (via Prisma) (009-multi-account)
- TypeScript 5 (backend Node.js 20, frontend Next.js 14) + Fastify 4, Prisma 5, React 18, Tailwind CSS, BullMQ, Redis (010-task-inbox)
- PostgreSQL (via Prisma ORM) (010-task-inbox)
- TypeScript 5 (backend Node.js 20, frontend Next.js 14.1.3) + Fastify 4, Prisma 5, React 18, Tailwind CSS, BullMQ, Redis (011-feed-ux-enhancements)
- TypeScript 5.x (frontend + backend) + Next.js 14 App Router, React, Express, Prisma, BullMQ, Redis (012-app-polish-bugfix)
- PostgreSQL (via Prisma), Redis (sync-status cache) (012-app-polish-bugfix)
- TypeScript 5.x (backend Node 20 LTS + frontend Next.js 15 App Router) + Fastify (backend API), React 19, Prisma 5 ORM, PostgreSQL 16, Redis (013-task-content-enhancements)
- PostgreSQL via Prisma (primary), Redis (short-lived sync cache metadata) (013-task-content-enhancements)

- TypeScript 5.x (frontend + backend) + Next.js 14 (frontend), Fastify 4 (backend API), Prisma (ORM), (001-mvp-core)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x (frontend + backend): Follow standard conventions

## Recent Changes
- 013-task-content-enhancements: Added TypeScript 5.x (backend Node 20 LTS + frontend Next.js 15 App Router) + Fastify (backend API), React 19, Prisma 5 ORM, PostgreSQL 16, Redis
- 012-app-polish-bugfix: Added TypeScript 5.x (frontend + backend) + Next.js 14 App Router, React, Express, Prisma, BullMQ, Redis
- 011-feed-ux-enhancements: Added TypeScript 5 (backend Node.js 20, frontend Next.js 14.1.3) + Fastify 4, Prisma 5, React 18, Tailwind CSS, BullMQ, Redis


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
