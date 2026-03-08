# ordrctrl Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-04

## Active Technologies
- TypeScript 5.4 (backend: Node.js/Fastify; frontend: React/Next.js 14) + Fastify (backend API), React + Tailwind CSS (frontend), Prisma ORM (002-uncheck-completed)
- PostgreSQL 16 (primary data), Redis 7 (session cache, BullMQ job queue) (002-uncheck-completed)
- TypeScript 5.4 (backend + frontend) + Fastify 4, Prisma 5, BullMQ (backend); Next.js 14 + React 18 + Tailwind CSS (frontend); Zod (validation); Vitest + Supertest (tests) (003-selective-import)
- PostgreSQL 16 (Prisma ORM) — two new columns on `Integration` table; Redis 7 for BullMQ sync queue (003-selective-import)

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
- 003-selective-import: Added TypeScript 5.4 (backend + frontend) + Fastify 4, Prisma 5, BullMQ (backend); Next.js 14 + React 18 + Tailwind CSS (frontend); Zod (validation); Vitest + Supertest (tests)
- 002-uncheck-completed: Added TypeScript 5.4 (backend: Node.js/Fastify; frontend: React/Next.js 14) + Fastify (backend API), React + Tailwind CSS (frontend), Prisma ORM

- 001-mvp-core: Added TypeScript 5.x (frontend + backend) + Next.js 14 (frontend), Fastify 4 (backend API), Prisma (ORM),

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
