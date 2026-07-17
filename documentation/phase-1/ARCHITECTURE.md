# Architecture

## System Shape

Manglam Balaji Society Management is a single-society modular monolith with three user
interfaces and one backend boundary. PostgreSQL is authoritative. Redis and external
providers are replaceable delivery infrastructure and never the only copy of a critical
event.

```text
apps/
  admin-web/       Next.js App Router
  api/             NestJS REST and Socket.IO gateway
  guard-app/       Expo Router and SQLite offline queue
  resident-app/    Expo Router
  worker/          NestJS/BullMQ jobs and outbox relay
packages/
  api-client/      generated/typed client and transport contracts
  config/          TypeScript, lint, environment, and test configuration
  database/        Prisma schema, migrations, client, and seed
  domain/          state machines and framework-free business rules
  permissions/     action catalog and authorization helpers
  testing/         factories, fixtures, and acceptance helpers
  types/           shared DTO and event contracts
  ui/              shared design tokens and primitives
  validation/      Zod request and environment schemas
documentation/
infrastructure/
scripts/
```

## Runtime Decisions

| Concern | Decision |
| --- | --- |
| Package manager | pnpm workspaces with a committed lockfile |
| Build graph | Turborepo |
| API | NestJS 11, REST under `/api/v1`, OpenAPI output |
| Database | PostgreSQL with Prisma 7 and reviewed SQL for unsupported constraints |
| Admin | Stable Next.js 16 release, React, TypeScript, Tailwind CSS |
| Mobile | Expo SDK 56, Expo Router, TanStack Query, React Hook Form, Zod |
| Offline guard | Expo SQLite, client UUIDs, durable mutation queue, explicit conflicts |
| Real time | Socket.IO with Redis adapter and independent REST polling fallback |
| Jobs | Transactional PostgreSQL outbox relayed to BullMQ |
| Storage | Private S3-compatible provider with short-lived signed access |
| Notifications | Provider abstraction plus durable in-app notifications |
| Tests | Vitest, Supertest, Playwright, React Native Testing Library, Maestro contract |

## Backend Boundaries

Modules own their controllers, services, persistence adapters, policies, events, and
tests. Direct cross-module writes are prohibited; domain services coordinate through
explicit application interfaces and transactions. The worker may consume outbox rows,
but it cannot invent domain state.

External OTP, push, file, error-tracking, and payment providers sit behind interfaces.
Development implementations are allowed only when startup configuration explicitly
identifies a non-production environment. Production startup must fail on a development
OTP provider.

## Reliability Pattern

Critical mutations execute in one database transaction:

1. Lock and validate the aggregate and version.
2. Claim the idempotency key.
3. Write the current projection.
4. Append immutable domain and audit events.
5. Insert outbox work.
6. Commit before calling external providers.

Workers use bounded retries, dedupe keys, exponential backoff, and a dead-letter state.
WebSocket events accelerate the UI; polling converges it to server state.

## Environment Topology

Local development uses native app processes and, where Docker is available, PostgreSQL,
Redis, and MinIO through Compose. The recommended production target is AWS Mumbai with
ECS Fargate, RDS PostgreSQL, ElastiCache Redis, private versioned S3, ALB/ACM, Secrets
Manager, CloudWatch/OpenTelemetry, and EAS for signed mobile builds.

Staging and production require isolated data stores, buckets, secrets, IAM roles, and
domains. Migrations run as a one-off release task using expand-and-contract changes;
they do not run during every API startup.

## Health and Recovery

- `/health/live` proves the process event loop is responsive.
- `/health/ready` verifies required database and Redis dependencies.
- Authenticated dependency diagnostics report queue, storage, and provider state.
- Worker heartbeat, queue age, dead-letter count, audit-write failure, emergency delay,
  and notification failure rate are alertable.
- RDS point-in-time recovery, pre-migration snapshots, S3 versioning, quarterly restore
  drills, and a documented rollback are required before production acceptance.
