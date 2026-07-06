# Kanban Board System

A RESTful Kanban task management API built with NestJS, TypeScript, PostgreSQL, and Prisma,
for the SammTech Ltd. backend internship take-home assignment. Features JWT authentication,
role-based access control, task position/reorder logic, soft deletes, validation, and Swagger
API documentation.

## Status

This is a work in progress, built incrementally and committed in stages rather than all at once.
Current state:

**Done**
- Project scaffold: NestJS + TypeScript, modular folder structure
- Prisma schema: User, Board, Column, Task, TaskLabel, RefreshToken, ActivityLog, with relations and indexes
- Config module with env var validation (fails fast on boot if `.env` is wrong)
- Global exception filter, global validation pipe, global rate limiting
- Swagger bootstrapped at `/api/docs`
- Auth: register, login, JWT access + rotating refresh tokens, bcrypt password hashing, tighter rate limit on `/auth/login`
- Boards: create, list own boards, get one with columns + tasks, soft delete - all behind `BoardOwnerGuard`
- Columns: create under a board, update (title/order), delete - behind `BoardOwnerGuard` / `ColumnOwnerGuard`
- Tasks: create, update (including replacing labels), soft delete, search/filter by title/priority/due date, and the position/reorder + cross-column move logic - behind `ColumnOwnerGuard` / `TaskOwnerGuard`
- Activity log: a row is written to `ActivityLog` every time a task is moved (bonus item)

**Not done yet**
- Tests, deployment, final Swagger annotations on all DTOs
- File upload for task attachments (lowest-priority bonus item)

## Tech stack

- NestJS + TypeScript
- PostgreSQL + Prisma
- JWT (access + refresh tokens) via Passport
- bcrypt for password hashing
- class-validator / class-transformer for request validation
- Swagger (`@nestjs/swagger`) for API docs
- helmet + CORS + `@nestjs/throttler` for basic hardening

## Project structure

```
src/
  main.ts                  bootstrap: helmet, CORS, validation pipe, swagger
  app.module.ts             root module
  config/                   env loading + validation
  prisma/                   PrismaService, global PrismaModule
  common/filters/           global exception filter
  auth/                     JWT auth: register, login, refresh
  users/                    user lookups used internally by auth
  boards/                   boards CRUD + ownership
  columns/                  columns CRUD
  tasks/                    tasks CRUD + position/reorder logic
  labels/                   task labels
prisma/
  schema.prisma
```

One module per resource. Controllers only handle HTTP; all business logic and Prisma calls live
in services, so nothing ends up in a single giant file.

## Setup & running locally

Prerequisites: Node.js 20+, npm 10+, and a PostgreSQL database (this project uses a free
[Neon](https://neon.tech) instance for local dev, but any Postgres connection string works).

```bash
git clone https://github.com/ifaz07/Kanban-Board-System-.git
cd Kanban-Board-System-
npm install                         # also runs `prisma generate` via postinstall
cp .env.example .env                # fill in DATABASE_URL and secrets, see below
npx prisma migrate dev --name init  # creates the database tables
npm run start:dev                   # http://localhost:3000
```

Health check: `GET /health` → `{ "status": "ok" }`
Swagger docs: `http://localhost:3000/api/docs`

## Environment variables

| Variable | Example | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `PORT` | `3000` | API port |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/dbname?sslmode=require` | Connection string from Neon (or any Postgres provider) - use the direct/non-pooled string for migrations |
| `JWT_ACCESS_SECRET` | long random string | generate with `openssl rand -base64 48` |
| `JWT_ACCESS_EXPIRY` | `15m` | access token lifetime |
| `JWT_REFRESH_SECRET` | long random string, different from access secret | generate separately |
| `JWT_REFRESH_EXPIRY` | `7d` | refresh token lifetime |
| `CORS_ORIGIN` | `http://localhost:3000` | allowed frontend origin |

## API documentation

Swagger UI: `/api/docs` (local) — live URL and Postman collection link will be added here once
deployed.

## Database

PostgreSQL via Prisma. Relations: `User → Board → Column → Task`, with `TaskLabel` attached to
`Task`, plus `RefreshToken` and `ActivityLog` for the refresh-token and activity-log bonus
features. Indexes on `Board.ownerId`, `Column.boardId`, `Task.columnId`, and `Task.deletedAt`
since every list query filters on it.

## Technical decisions

**Task position/reordering.** Gap-based integer positions instead of naive array indexing or a
linked list. New tasks get `position = lastPosition + 1000`. `PATCH /tasks/:id/position` takes
`{ columnId, beforeTaskId?, afterTaskId? }` - both optional, used together to drop a task
between two neighbors, either alone to drop it at an edge, or neither to append it to the end.
The new position is computed as the midpoint of its neighbors (or +/- the gap for an edge
drop); if that collides with an existing position or hits zero, the whole column's positions
get rebalanced back to clean multiples of 1000 in one transaction, then recomputed once. This
keeps the common case to a single row update and a plain `ORDER BY position` query, at the
cost of an occasional rebalance pass. Moving a task also requires owning the *target* column,
not just the task being moved, so a request can't be crafted to drop a task into someone
else's board.

**Labels are replaced wholesale on update, not diffed.** `PATCH /tasks/:id` with a `labels`
array deletes all existing labels for that task and recreates the ones sent. Simpler than
matching by id/name to add/remove individual labels, and the assignment doesn't call for
partial label updates.

**Activity log only records moves.** The bonus item is specifically "who moved what and
when," so `ActivityLog` rows are only written from `PATCH /tasks/:id/position`, not from
every field edit - that would be a generic audit log, which isn't what was asked for.

**Soft delete.** Boards and tasks use a `deletedAt` timestamp instead of a real `DELETE`.
Handled explicitly in each service (filter `deletedAt: null` on reads, `update` instead of
`delete`) rather than a global Prisma middleware — Prisma's older `$use` middleware API is
being phased out in favor of client extensions, and explicit per-service handling is more
transparent for a project this size anyway.

**Auth.** Short-lived access tokens (15 min) plus a refresh token (7 days) hashed with bcrypt
before it's stored, so a stolen database dump doesn't hand out valid refresh tokens.

**Pinned Prisma to v6, not v7.** The environment this was built in resolved Prisma to v7 by
default, which turned out to be a much bigger change than a version bump: it requires a separate
`prisma.config.ts` file, a manually-wired database driver adapter instead of just reading
`DATABASE_URL`, and a custom (non-`node_modules`) client output path, with ESM implications on
top. That's a lot of unrelated architecture churn for a 5-day assignment, so `prisma` and
`@prisma/client` are pinned to `^6.x`, which uses the classic `datasource { url = env(...) }` +
`new PrismaClient()` pattern - the same pattern almost every Prisma/NestJS guide assumes.

**Ownership guards return 404, not just 403, for boards/columns you don't own.** `BoardOwnerGuard`
and `ColumnOwnerGuard` throw `NotFoundException` if the resource doesn't exist *or* belongs to
someone else, and only throw `ForbiddenException` once existence is confirmed and ownership is
the sole failure. This avoids leaking whether a given board ID exists to users who don't own it.

**Columns are hard-deleted, boards are soft-deleted.** The schema hint only gives `Board` and
`Task` a `deletedAt` field - `Column` doesn't have one - so deleting a column is a real `DELETE`
that cascades to its tasks via the foreign key. Deleting a board just sets `deletedAt`; its
columns and tasks are left in place but unreachable, since every read filters `deletedAt: null`
starting from the board.

**Global `PrismaModule`.** Marked `@Global()` so every resource module can inject
`PrismaService` without re-importing it everywhere — small tradeoff of implicit availability
for a lot less repetition.

## Challenges

Real one from the setup itself: the environment I built this in already had NestJS 11 and
Prisma 7 installed — newer majors than most tutorials assume. Rather than trust older
assumptions about their APIs, I checked the installed packages' type definitions directly
(e.g. confirming `ThrottlerModule.forRoot()`'s actual accepted shape) before wiring anything
up. Worth documenting because it's exactly the kind of thing that causes silent bugs if you
copy code from an outdated guide.

(More will be added here as the harder parts — the position logic implementation and the
ownership guard — get built.)

## What I'd improve with more time

- File attachments for tasks (Multer + Cloudinary)
- WebSocket-based live board updates
- E2E test coverage on top of unit tests
- A proper activity log UI/endpoint instead of just the underlying table
