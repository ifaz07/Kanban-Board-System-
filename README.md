# Kanban Board System

Backend API for a Kanban-style task management system, built for the SammTech Ltd. backend
internship take-home assignment.

## Status

This is a work in progress, built incrementally and committed in stages rather than all at once.
Current state:

**Done**
- Project scaffold: NestJS + TypeScript, modular folder structure
- Prisma schema: User, Board, Column, Task, TaskLabel, RefreshToken, ActivityLog, with relations and indexes
- Config module with env var validation (fails fast on boot if `.env` is wrong)
- Global exception filter, global validation pipe, global rate limiting
- Swagger bootstrapped at `/api/docs`
- Docker Compose for local Postgres

**Not done yet**
- Auth endpoints (register, login, refresh)
- Boards / Columns / Tasks CRUD + ownership guard
- Task position/reorder logic
- Soft delete enforcement, search & filter
- Tests, deployment, final Swagger annotations on DTOs

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
  auth/                     JWT auth (register, login, refresh) - in progress
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

Prerequisites: Node.js 20+, npm 10+, Docker (optional, for local Postgres).

```bash
git clone https://github.com/ifaz07/Kanban-Board-System-.git
cd Kanban-Board-System-
npm install                         # also runs `prisma generate` via postinstall
cp .env.example .env                # then fill in real secrets, see below
docker compose up -d                # starts local Postgres (skip if using your own DB)
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
| `DATABASE_URL` | `postgresql://kanban:kanban@localhost:5432/kanban_db?schema=public` | Matches `docker-compose.yml` by default |
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

**Task position/reordering.** Using gap-based integer positions instead of naive array
indexing or a linked list. New tasks get `position = lastPosition + 1000`. Moving a task
between two others sets `position = floor((prevPos + nextPos) / 2)`; if that gap closes to
zero, the column's positions get rebalanced back to steps of 1000 in one transaction. This
keeps moves to a single row update and a simple `ORDER BY position` query, at the cost of an
occasional rebalance pass.

**Soft delete.** Boards and tasks use a `deletedAt` timestamp instead of a real `DELETE`.
Handled explicitly in each service (filter `deletedAt: null` on reads, `update` instead of
`delete`) rather than a global Prisma middleware — Prisma's older `$use` middleware API is
being phased out in favor of client extensions, and explicit per-service handling is more
transparent for a project this size anyway.

**Auth.** Short-lived access tokens (15 min) plus a refresh token (7 days) hashed with bcrypt
before it's stored, so a stolen database dump doesn't hand out valid refresh tokens.

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
