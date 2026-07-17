# Manglam Balaji Society Management

A single-society management system with resident and guard mobile applications, an administration
dashboard, and a modular TypeScript backend.

## Repository Status

The project is under active phased implementation. Architecture, product scope, data, API, security,
and delivery decisions are recorded in `documentation/phase-1`.

## Planned Workspace

- `apps/admin-web`: responsive Next.js administration dashboard
- `apps/api`: NestJS REST and Socket.IO backend
- `apps/guard-app`: Expo guard application with SQLite offline synchronization
- `apps/resident-app`: Expo resident application
- `apps/worker`: outbox, notification, and background-job worker
- `packages/*`: database, domain, permissions, validation, clients, UI, and test support

## Prerequisites

- Node.js 24
- pnpm 11
- PostgreSQL 16 or newer
- Redis 7 or newer
- S3-compatible private object storage

Docker Compose configuration will be provided for local dependencies. Docker is not currently
installed on the development machine, so native verification is used until it becomes available.

## Commands

```bash
pnpm install
pnpm db:generate
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Copy `.env.example` to a local, ignored environment file and replace every development secret before
running services. Production must never use the development OTP provider.

## Safety

Do not commit production secrets, identity documents, real resident data, visitor photos, or payment
credentials. Online payments remain disabled until a verified gateway is configured.
