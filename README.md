# Kanban Board System

This is my backend submission for the SammTech Ltd. backend internship take-home assignment —
a REST API for a Kanban-style task management system. I built it with NestJS, TypeScript,
PostgreSQL, and Prisma, with JWT authentication, role-based access control, task
position/reorder logic, soft deletes, and Swagger documentation.

## Links

- **GitHub repo:** https://github.com/ifaz07/Kanban-Board-System-
- **Live API base URL:** https://kanban-board-system.onrender.com
- **Swagger docs:** https://kanban-board-system.onrender.com/api/docs (local: `http://localhost:3000/api/docs`)

## What it does

- Register and log in with JWT access tokens (15 min) and rotating refresh tokens (7 days),
  passwords hashed with bcrypt
- Create boards, each with columns, each with tasks - the usual Kanban hierarchy
- Only a board's owner can view, modify, or delete that board and anything under it
- Move tasks between columns and reorder them within a column, without the API ever assigning
  two tasks the same position
- Search and filter tasks by title, priority, and due date
- Soft delete on boards and tasks (a `deletedAt` timestamp, not a real row deletion)
- A basic activity log recording who moved which task and when
- Rate limiting on login, input validation on every endpoint, and Swagger docs generated from
  the actual DTOs

## Tech stack

- NestJS + TypeScript
- PostgreSQL + Prisma (pinned to v6 - see Technical Decisions for why)
- JWT via Passport, bcrypt for password hashing
- class-validator / class-transformer for request validation
- `@nestjs/swagger` for API docs
- helmet + CORS + `@nestjs/throttler` for basic hardening

## Project structure

```
src/
  main.ts                    bootstrap: helmet, CORS, validation pipe, swagger
  app.module.ts               root module
  config/                     env loading + fail-fast validation
  prisma/                     PrismaService + global PrismaModule
  common/
    filters/                  global exception filter
    guards/                   JwtAuthGuard, BoardOwnerGuard, ColumnOwnerGuard, TaskOwnerGuard
    decorators/                @CurrentUser()
    utils/                     small shared helpers
  auth/                       register, login, refresh
  users/                      user lookups used internally by auth
  boards/                     boards CRUD + ownership
  columns/                    columns CRUD
  tasks/                      tasks CRUD + position/reorder logic + search/filter
prisma/
  schema.prisma
  migrations/
```

One module per resource. Controllers only handle HTTP - request in, response out. All business
logic and every Prisma call live in services, so nothing ends up as one giant file mixing
routing, logic, and database queries together.

## Setup & running locally

Prerequisites: Node.js 20+, npm 10+, and a PostgreSQL database. I used a free
[Neon](https://neon.tech) instance for my own local dev, but any Postgres connection string
works.

```bash
git clone https://github.com/ifaz07/Kanban-Board-System-.git
cd Kanban-Board-System-

npm install                         # also runs `prisma generate` via postinstall

cp .env.example .env                # then fill in real values, see Environment Variables below

npx prisma migrate dev --name init  # creates all the tables from prisma/schema.prisma

npm run start:dev                   # starts the API on http://localhost:3000
```

Once it's running:
- Health check: `GET /health` → `{ "status": "ok" }`
- Swagger UI: `http://localhost:3000/api/docs`

If you ever change `prisma/schema.prisma`, run `npx prisma migrate dev --name <what_changed>`
again to generate and apply a new migration.

## Environment variables

| Variable | Example | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `PORT` | `3000` | Port the API listens on |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/dbname?sslmode=require` | Postgres connection string. Use the direct/non-pooled string - `prisma migrate` doesn't work reliably through a connection pooler |
| `JWT_ACCESS_SECRET` | long random string | I generated mine with `openssl rand -base64 48` |
| `JWT_ACCESS_EXPIRY` | `15m` | Access token lifetime |
| `JWT_REFRESH_SECRET` | long random string, **different** from the access secret | So a leaked access secret can't be used to forge refresh tokens |
| `JWT_REFRESH_EXPIRY` | `7d` | Refresh token lifetime |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed frontend origin |

All of these are validated on startup - if one is missing or the wrong type, the app fails
immediately with a clear error instead of failing confusingly later on the first request that
needs it.

## API documentation

Swagger UI is generated live from the DTOs and available at `/api/docs` on whichever base URL
is running. I didn't put together a separate Postman collection since Swagger already gives a
fully interactive way to try every endpoint (including auth) without leaving the browser.

## Database

PostgreSQL via Prisma. Relations: `User → Board → Column → Task`, with `TaskLabel` attached to
`Task`. I added two models beyond the schema hint in the brief - `RefreshToken` and
`ActivityLog` - to support the refresh token and activity log bonus items; that's a deliberate
adjustment, documented here as the brief asks for.

Indexes: `Board.ownerId`, `Column.boardId`, `Task.columnId`, and `Task.deletedAt`, since every
list query filters on these.

## Technical decisions

**Task position/reordering.** This was the part the brief specifically flagged as tricky, so
I want to explain my reasoning rather than just show the code. I used gap-based integer
positions instead of re-indexing an array or maintaining a linked list. New tasks get
`position = lastPosition + 1000`. To move a task, `PATCH /tasks/:id/position` takes
`{ columnId, beforeTaskId?, afterTaskId? }` - I give both when dropping a task between two
specific neighbors, either one alone for an edge drop, or neither to just append it to the end
of a column. The new position is the midpoint of its neighbors (or the gap added/subtracted for
an edge drop). The real edge case is what happens when two positions are already adjacent
integers with no room between them - if the computed position would collide with an existing
one, I rebalance the entire column back to clean multiples of 1000 inside the same transaction,
then recompute once. That keeps the common case down to a single row update and a plain
`ORDER BY position` query, at the cost of an occasional rebalance pass. I'd rather have that
documented tradeoff than a silent hack that quietly breaks after enough moves.

**Moving a task checks ownership of the destination column, not just the task.** The request
body for a move names a target `columnId`, which could belong to a completely different board.
Both the update and move logic explicitly verify the caller owns that destination column before
touching anything - otherwise someone could move their own task into a column they don't own
just by knowing its id.

**Ownership guards return 404, not 403, when you don't own something.** `BoardOwnerGuard`,
`ColumnOwnerGuard`, and `TaskOwnerGuard` throw a 404 if the resource doesn't exist *or* belongs
to someone else, and only return 403 once existence is confirmed and ownership is the sole
issue. This avoids leaking whether a given id even exists to someone who doesn't own it.

**Soft delete for boards and tasks, hard delete for columns.** The schema hint in the brief
gives `Board` and `Task` a `deletedAt` field but not `Column` - so I treated that as intentional:
deleting a column is a real `DELETE` that cascades to its tasks via the foreign key, while
deleting a board just sets `deletedAt` and leaves its columns/tasks in place but unreachable,
since every read filters `deletedAt: null` starting from the board.

**Labels are replaced wholesale on update, not diffed.** Sending a `labels` array in
`PATCH /tasks/:id` deletes the task's existing labels and recreates the ones sent. Simpler than
matching individual labels by id to add/remove them one at a time, and the brief doesn't call
for partial label updates.

**Activity log only records moves.** The bonus item is specifically "who moved what and when,"
so I only write to `ActivityLog` from the position/move endpoint, not from every field edit -
logging every update would be a generic audit log, which isn't what was asked for.

**Auth: short-lived access token, longer rotating refresh token.** 15-minute access tokens plus
7-day refresh tokens, and the refresh token is hashed with bcrypt before it's stored - so a
stolen database dump doesn't hand out usable refresh tokens, only useless hashes. Each refresh
token is single-use: redeeming one deletes it and issues a new pair.

**Pinned Prisma to v6, not v7.** The environment I built this in resolved Prisma to v7 by
default when I ran `npm install`, which turned out to be a much bigger change than a version
bump - v7 requires a separate `prisma.config.ts` file, a manually-wired database driver adapter
instead of just reading `DATABASE_URL`, and a custom client output path, with ESM implications
on top. That's a lot of unrelated architecture churn to take on for a 5-day assignment, so I
pinned `prisma` and `@prisma/client` to `^6.x`, which uses the classic
`datasource { url = env(...) }` + `new PrismaClient()` pattern that almost every Prisma/NestJS
guide assumes.

**Global `PrismaModule`.** I marked it `@Global()` so every resource module can inject
`PrismaService` without re-importing it everywhere - a small tradeoff of implicit availability
in exchange for a lot less repetition across modules.

**Built-in exceptions over hand-rolled custom exception classes.** I used NestJS's own
`NotFoundException`, `ForbiddenException`, `ConflictException`, etc. rather than writing custom
subclasses for each case. They give the same meaningful HTTP status codes and clear messages the
brief asks for, with less code to maintain - though custom classes would be a reasonable next
step if this grew past a 5-day assignment.

## Assumptions I made

- Boards are private to their owner for *reading* as well as writing - the brief only explicitly
  requires ownership checks for modify/delete, but I extended the same guard to `GET /boards/:id`
  since there's no mention of boards ever being shared or public.
- `Column.order` uses plain sequential integers rather than the gap-based scheme I used for
  tasks, since the brief only calls out task position/reordering as the hard part - columns are
  far fewer in number and reordered far less often.
- Priority values (`LOW`, `MEDIUM`, `HIGH`, `URGENT`) aren't specified in the brief, so I picked
  a reasonable fixed set.
- `GET /tasks` with `search`/`priority`/`dueDate` query params isn't in the literal endpoint list
  in the brief, but section 4 explicitly requires search/filter on tasks, so I added it as its
  own endpoint rather than bolting query params onto an existing route.

## Challenges I faced

**The environment had newer major versions installed than I expected.** NestJS 11 and Prisma 7
resolved by default - both newer than what most guides and my own assumptions were based on.
Rather than trust outdated API shapes, I checked the actual installed packages' type
definitions before wiring anything up (for example, confirming exactly what shape
`ThrottlerModule.forRoot()` and `@Throttle()` expect). Prisma 7 turned out to be enough of a
departure that I made the documented decision above to pin back to v6 instead of adopting its
new driver-adapter model mid-assignment.

**TypeScript strictness vs. class-validator DTOs.** With `strict: true` on, TypeScript's
`strictPropertyInitialization` check flagged every DTO field (`email: string;` etc.) as
"not definitely assigned," since DTOs are populated by class-transformer at runtime, not through
a constructor. I disabled that one specific sub-check rather than the whole of `strict` mode,
since none of the other strict checks had the same false-positive problem.

**The position/reorder logic itself**, covered in detail above - the interesting problem wasn't
computing a position, it was deciding what happens when positions run out of room, and making
sure that resolution happens atomically so concurrent moves can't corrupt the ordering.

## What I'd improve with more time

- Unit tests for the position/reorder logic specifically, since it's the part most likely to
  hide an edge case (empty column, single task, rapid consecutive moves)
- Custom exception subclasses (e.g. `BoardNotFoundException`) instead of relying on NestJS's
  built-in `HttpException` subtypes
- End-to-end tests through Supertest covering the full auth → board → column → task flow
- File attachments for tasks (Multer + Cloudinary)
- A proper activity log endpoint/UI instead of just the underlying table
- WebSocket-based live board updates so multiple people can see moves in real time
