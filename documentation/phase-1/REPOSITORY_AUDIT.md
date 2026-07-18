# Repository Audit

Date: 2026-07-17

## Existing State

The repository starts from an empty application baseline. The only project input is
`implementation-plan.md`; the Git history contains a single initial commit with an MIT license.
There are no manifests, applications, packages, tests, database files, deployment files, or runtime
configuration.

The working tree already contained two user-owned changes before implementation began:

- `LICENSE` is staged for deletion.
- `implementation-plan.md` is untracked.

Implementation commits must use explicit path lists so neither change is accidentally included or
reverted.

## Local Tooling

| Tool    | Observed state                          |
| ------- | --------------------------------------- |
| Node.js | `v24.14.0`                              |
| npm     | `11.9.0`                                |
| pnpm    | `11.9.0`                                |
| Git     | Repository on `main`, remote configured |
| Docker  | Not installed                           |

Docker configuration will be delivered, but container runtime validation cannot be claimed on this
machine until Docker is available. Native builds and tests remain the primary local evidence path.

## Architecture Decision

Use a TypeScript Turborepo with pnpm workspaces:

- Expo resident application
- Expo guard application with SQLite-backed offline operations
- Next.js admin dashboard
- NestJS modular-monolith API
- NestJS/BullMQ worker
- Shared domain, validation, permissions, API client, UI, and testing packages
- PostgreSQL and Prisma as the durable system of record
- Redis for queues, rate limits, locks, and real-time fan-out only
- Private S3-compatible object storage behind a provider abstraction

This matches the requested stack, keeps one deployable backend boundary, and avoids premature
microservices.

## Existing Functionality Assessment

Nothing is currently executable. Every Definition of Done item begins in a failing or not-applicable
state: installation, database migration, authentication, authorization, API workflows, all three
interfaces, offline synchronization, tests, observability, builds, deployment, backup, and restore.

## Highest Risks

1. Cross-flat or cross-role data exposure.
2. Duplicate or conflicting visitor decisions and gate mutations.
3. OTP abuse, token replay, or guard-device theft.
4. Offline records being duplicated, lost, or represented as resident-approved.
5. Payment mutation or destructive correction.
6. Private files becoming publicly accessible.
7. Push or WebSocket delivery being treated as the source of truth.
8. Scope breadth diluting the release-critical visitor workflow.
9. Missing production provider credentials and mobile signing identities.
10. Docker absence preventing local container and restore drills.

## Release Priority

Identity, flat isolation, visitor state transitions, guard-device trust, and offline idempotency are
release blocking. Secondary modules can proceed only after the visitor vertical slice is passing end
to end.
