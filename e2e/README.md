# e2e

Playwright test harness for the Help-desk app. Runs against a separate
`helpdesk_test` PostgreSQL database on dedicated ports (server `:3002`,
client `:5174`) so it never touches real dev data and can run alongside a
`bun run dev` session. There are no spec files yet — this is just the
harness.

## One-time setup

1. Create the test database (Prisma's `migrate deploy` applies migrations
   but won't create the database itself):

   ```
   psql -U postgres -c "CREATE DATABASE helpdesk_test;"
   ```

2. Copy `server/.env.test.example` to `server/.env.test` and fill in real
   values (same Postgres user/password as your `server/.env`, just pointed
   at `helpdesk_test`; generate a fresh `BETTER_AUTH_SECRET` with
   `openssl rand -base64 32`).

3. From the repo root:

   ```
   bun install
   bun run test:e2e:setup   # applies migrations + seeds a test admin user
   ```

## Running

```
bun run test:e2e
```

This boots the server (`:3002`, pointed at `helpdesk_test`) and the client
(`:5174`) automatically via `playwright.config.ts`'s `webServer` config,
then runs any specs in `e2e/tests/`.
