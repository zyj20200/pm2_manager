# PM2 Manager

[English](README.md) | [简体中文](README.zh-CN.md)

Web UI + API for managing PM2 processes, built with a Vite/React client and an
Express + tRPC backend.

## Stack
- Client: Vite, React, Tailwind
- Server: Express, tRPC, Socket.IO
- DB: Drizzle ORM + MySQL

## Project Structure
- `client/` — frontend source (`client/src/main.tsx`)
- `server/` — backend services and API routes
- `shared/` — shared types/constants
- `drizzle/` — schema and SQL migrations

## Getting Started
Prereqs: Node.js and pnpm.

```bash
pnpm install
pnpm dev
```

The dev server starts the backend and serves the frontend via Vite. If port 3000
is busy, it will pick the next available port.

## Common Commands
```bash
pnpm dev     # start local dev (watch mode)
pnpm build   # build client + bundle server to dist/
pnpm start   # run production build
pnpm check   # TypeScript typecheck
pnpm test    # run Vitest tests
pnpm format  # format with Prettier
pnpm db:push # generate + apply Drizzle migrations
```

## Configuration
Environment variables are loaded via `dotenv`. Keep local secrets in `.env`
and avoid committing environment-specific values.

## Testing
Tests use Vitest and live under `server/**/*.test.ts` and
`server/**/*.spec.ts`.
