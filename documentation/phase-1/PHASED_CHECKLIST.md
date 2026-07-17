# Phased Delivery Checklist

## Phase 1: Audit and Decisions

- [x] Existing-state assessment
- [x] Architecture decision
- [x] MVP and non-goal confirmation
- [x] Screen inventory and universal UI-state contract
- [x] Data model and transaction plan
- [x] API module and authorization plan
- [x] Threat model and security defaults
- [x] Acceptance strategy and environment constraints

## Phase 2: Foundation

- [ ] Scaffold pnpm/Turborepo applications and packages
- [ ] Add strict TypeScript, lint, formatting, test, and CI configuration
- [ ] Implement Prisma schema, SQL constraints, migrations, and seed
- [ ] Implement authentication, session rotation, RBAC, audit, idempotency, and outbox
- [ ] Add OTP, notification, file-storage, and error-tracking provider interfaces
- [ ] Add API errors, correlation IDs, rate limits, health, and OpenAPI
- [ ] Verify install, lint, typecheck, unit tests, database migration/seed, and builds

## Phase 3: Society, Flats, and Users

- [ ] Blocks, floors, flats, gates, and settings
- [ ] Resident onboarding and membership lifecycle
- [ ] Family/dependent management
- [ ] Guard accounts, assignments, and device registration
- [ ] Admin management screens and cross-flat isolation tests

## Phase 4: Visitor Vertical Slice

- [ ] Resident pre-approval and secure code verification
- [ ] Guard unexpected visitor request
- [ ] Concurrent resident decision handling
- [ ] Rejection, timeout, and reasoned override
- [ ] Check-in, check-out, long-visit flag, history, audit, and notifications
- [ ] Socket.IO updates plus polling fallback
- [ ] Resident, guard, admin, API, database, and E2E evidence

## Phase 5: Guard Offline

- [ ] Encrypted SQLite snapshot and 24-hour lease
- [ ] Durable client-UUID mutation queue
- [ ] Explicit local, syncing, synced, conflict, and failed states
- [ ] Idempotent batch sync and independent retry
- [ ] Restart, response-loss, stale-data, and duplicate tests

## Phase 6: Daily Help and Parcels

- [ ] Multi-flat helpers, access windows, attendance, and audit
- [ ] Leave-at-gate decision, photo, collection code, collect/return, and history
- [ ] End-to-end resident, guard, admin, and notification tests

## Phase 7: Notices and Complaints

- [ ] Notice drafts, publish, targeting, reads, acknowledgements, and attachments
- [ ] Complaint categories, create, assign, transitions, comments, private notes, reopen
- [ ] Privacy, notification, history, and E2E tests

## Phase 8: Maintenance

- [ ] Monthly charge batches, due states, balances, and manual late charges
- [ ] Offline payment records, allocations, unique receipts, and immutable reversals
- [ ] Resident history, admin reports, CSV safety, and duplicate prevention tests

## Phase 9: Emergencies

- [ ] Create, prominent fan-out, acknowledge, respond, resolve, and false alarm
- [ ] Critical queue, in-app fallback, event history, and delivery failure visibility
- [ ] Resident, guard, admin, and provider-failure tests

## Phase 10: Security and Quality Hardening

- [ ] Complete action/resource permission matrix and IDOR audit
- [ ] Session, rate limit, file, provider, offline, and payment audits
- [ ] Accessibility review across all states and target viewports
- [ ] Performance, concurrency, fault-injection, and dependency-failure review
- [ ] Fix all P0/P1 and critical/high security findings; add regressions

## Phase 11: Deployment Readiness

- [ ] Development, staging, and production configuration
- [ ] Dockerfiles, Compose, migration task, CI, immutable artifacts, and SBOM
- [ ] Backup, restore, rollback, incident, admin, guard, and resident guides
- [ ] Staging build, migration, provider sandbox, mobile build, and smoke evidence
- [ ] Record unresolved provider/account/data-retention blockers

## Acceptance Round 1

- [ ] Fresh locked install, database, seed, lint, typecheck, tests, and production builds
- [ ] Traverse every critical workflow and universal UI state
- [ ] Inspect persisted rows, audit events, notifications, and authorization boundaries
- [ ] Record commit, environment, commands, exit codes, traces, and screenshots
- [ ] Repair every release-blocking finding and add regression coverage

## Acceptance Round 2

- [ ] Rebuild immutable artifacts against a fresh database
- [ ] Rerun all release-critical workflows and round-one regressions
- [ ] Inject network, database, Redis, worker, push, WebSocket, and storage failures
- [ ] Verify accessibility, load, migration, backup/restore, rollback, alerts, and runbooks
- [ ] Accept only with zero P0/P1 and zero unresolved critical/high security findings
