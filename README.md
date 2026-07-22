# Help Desk

An AI-assisted ticket management system for support/help desk teams. Inbound support emails become tickets automatically, get classified and (when the knowledge base confidently covers the question) answered and replied to by AI — with everything else routed to a human agent.

**Live deployment:** https://help-desk-production-e14f.up.railway.app

## Features

- **Inbound email → ticket pipeline**: a Mailgun route forwards incoming support email to a webhook, which creates a ticket and threads all further replies (via `Message-Id`/`In-Reply-To`/`References` headers) like a real email conversation.
- **AI auto-resolution**: new tickets are classified (General Question / Technical Question / Refund Request) and, when the knowledge base directly and confidently answers the question, resolved and replied to automatically — with the AI's own reply emailed back to the customer. Anything uncertain, out of scope, or matching an escalation rule (legal threats, disputed charges, refunds outside the policy window, account security) is left for a human agent instead of guessed at.
- **Agent workspace**: filterable/sortable ticket list, ticket detail view with full reply thread, manual replies (with an optional AI "polish" pass on a draft before sending), assignment, and status management (Open / Resolved / Closed).
- **Dashboard**: ticket volume and resolution stats.
- **User management**: admin-only CRUD for agent accounts (agents are provisioned by an admin — there's no public sign-up).
- **Role-gated access**: Admin vs. Agent roles, enforced both server-side (middleware) and client-side (route guards).
- **Error monitoring**: Sentry on both client and server.

## Tech stack

| Layer | Choice |
|---|---|
| Runtime / package manager | [Bun](https://bun.com) (workspaces, install, dev/build — not `npm`/`node`) |
| Frontend | React 19, TypeScript, Vite, React Router 7, TanStack Query, react-hook-form + zod, Tailwind CSS v4, shadcn/ui |
| Backend | Express 5 (run directly by Bun, no compile step) |
| Database | PostgreSQL via Prisma (7.x, config-based, `@prisma/adapter-pg` driver adapter) |
| Auth | [better-auth](https://www.better-auth.com/) (email/password, admin-provisioned agents, session cookies) |
| Background jobs | [pg-boss](https://github.com/timgit/pg-boss) (Postgres-backed queue, runs in-process with the API) |
| AI | Vercel AI SDK (`ai`) + [OpenRouter](https://openrouter.ai/) (`@openrouter/ai-sdk-provider`) |
| Email | Mailgun (inbound routing + outbound send) |
| Testing | Bun's built-in test runner + React Testing Library (component tests), Playwright (e2e) |
| Error monitoring | Sentry (`@sentry/react`, `@sentry/node`) |
| Deployment | Docker on [Railway](https://railway.app) |

## Architecture

This is a Bun workspace monorepo with four workspaces:

```
client/   React + Vite frontend
server/   Express API + AI/email/background-job logic
core/     Shared zod schemas & constants used by both client and server
e2e/      Playwright test harness (separate DB/ports, no dev-data collisions)
```

`client` and `server` are independently runnable apps that talk over plain HTTP in development (`client` on `:5173`, `server` on `:3001`). In production they're served together as a **single deployable unit**: the Docker build compiles the client into static assets, and the Express server serves them directly (with an SPA fallback for client-side routes) alongside the API — one process, one port, one URL. See [Deployment](#deployment) below.

`core` exists specifically so validation logic that must match on both sides (e.g. the "create user" form schema) is defined once and imported by both workspaces, rather than re-declared and risking drift.

AI ticket classification and auto-resolution run as pg-boss background jobs in the same process as the API (not a separate worker) — see `server/src/lib/resolveTicket.ts` and `server/src/lib/classifyTicket.ts`.

## Getting started

### Prerequisites

- [Bun](https://bun.com) v1.3+
- PostgreSQL (local instance, or a connection string to a hosted one)
- A Mailgun account (for inbound/outbound email — optional for local UI/API development)
- An [OpenRouter](https://openrouter.ai/) API key (required — the server fails to start without one)

### Install

```bash
git clone https://github.com/SiddhuKalvi/help-desk.git
cd help-desk
bun install
```

### Configure environment variables

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Fill in `server/.env` — see the file for what each variable is for. At minimum, the server **requires** `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CLIENT_URL`, `INBOUND_EMAIL_WEBHOOK_SECRET`, and `OPENROUTER_API_KEY` to boot (see `server/src/env.ts`); `MAILGUN_*` and `SENTRY_DSN` are optional (email sending / error reporting just no-op without them).

### Set up the database

```bash
cd server
bun x prisma migrate dev
bun prisma/seed.ts           # creates/updates the admin user from ADMIN_EMAIL/ADMIN_PASSWORD
bun run seed:ai-agent        # creates the permanent AI agent user tickets get assigned to
```

### Run

```bash
bun run dev
```

This runs `client` (`:5173`) and `server` (`:3001`) concurrently. Log in with the admin credentials from your seed step.

## Available scripts

Run from the repo root unless noted:

```bash
bun run dev                 # client + server, concurrently
bun run --filter client dev # client only
bun run --filter server dev # server only
bun run typecheck           # tsc across client, server, and e2e
bun run build                # client build (vite build)
cd client && bun run lint    # oxlint
cd client && bun test        # component tests (Bun test runner + RTL)
bun run test:e2e:setup       # one-time: migrate + seed the e2e test database
bun run test:e2e             # Playwright e2e suite
```

See `e2e/README.md` for the full e2e one-time setup (separate test database/ports).

## Testing strategy

Component tests (Bun test + React Testing Library, mocking `apiFetch`) are the default for anything they can verify — validation, conditional UI, loading/error states, form submission logic. Playwright e2e is reserved for what genuinely needs the full stack: real navigation/redirects, a session cookie round-tripping through better-auth, or server-only HTTP contracts with no UI (e.g. the inbound email webhook).

## Deployment

The app deploys to [Railway](https://railway.app) as a single service:

- `Dockerfile` (repo root) builds the client (`vite build`) and generates the Prisma client, then runs `bunx prisma migrate deploy && bun run start` on container start.
- `railway.json` configures the Dockerfile build and an `/api/health` healthcheck.
- The Express server serves the built client (`client/dist`) as static files, with an SPA fallback for client-side routes, alongside the `/api/*` routes — so the deployed app is one service, one port, one URL, with no separate CORS/domain configuration needed between "frontend" and "backend".

Required production environment variables mirror `server/.env.example`, with two differences from local dev:
- `DATABASE_URL` should point at a real Postgres instance (e.g. a Railway Postgres plugin's connection string).
- `BETTER_AUTH_URL` and `CLIENT_URL` should both be the deployed app's own public URL (same value, since it's one service).

`VITE_SERVER_URL` should be left unset in production — it defaults to an empty string (same-origin relative requests), which is correct for the single-service deployment and avoids needing to know the public domain at build time.

## Project docs

- `Project-scope.md` — product spec: features, ticket statuses/categories, user roles, and key product/compliance decisions.
- `tech-stack.md` — the target tech stack (check actual `package.json` dependencies for current ground truth, as this file can lag).
- `implementation-plan.md` — phased build order (checkbox state is not kept up to date; trust the code).
- `CLAUDE.md` — detailed conventions and architecture notes for AI coding assistants working in this repo (also useful as a developer onboarding doc).
