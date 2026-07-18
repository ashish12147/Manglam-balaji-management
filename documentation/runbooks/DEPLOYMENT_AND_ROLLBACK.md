# Deployment and Rollback

## Release artifacts

Pushing a `v*` tag builds API, worker, admin, and migration images in GitHub Actions and publishes
them to GHCR with semantic-version and commit tags, provenance, and SBOM attestations. Set the
repository variable `ADMIN_PUBLIC_API_URL` to the production HTTPS API base before releasing. Deploy
immutable digests, never mutable tags.

## Preflight

1. Require green CI, security scans, migration validation, and reviewed release notes.
2. Confirm current database and object-storage backups and the latest restore-drill result.
3. Inspect the Prisma migration for locks, table rewrites, destructive changes, and expected
   duration.
4. Confirm on-call ownership, dashboards, provider status, and rollback image digests.
5. Freeze unrelated schema changes until verification completes.

## Deployment sequence

1. Deploy the migration image as a one-shot job using the same release digest family and production
   `DATABASE_URL`. Require a successful exit before application rollout.
2. Roll out the API gradually. Readiness must remain healthy and error/latency/auth metrics must
   remain within baseline.
3. Roll out workers. Confirm outbox age and queue depth decline normally with no duplicate
   deliveries.
4. Roll out admin web with the reviewed build-time API URL.
5. Release mobile builds through the signed store channels only after API compatibility checks.
6. Run smoke checks: resident OTP login, session refresh, guard authorization, visitor lifecycle,
   payment verification visibility, private upload and malware scan, notification delivery, and
   audit event creation.
7. Observe for at least one normal traffic cycle and record image digests, migration ID, metrics,
   and approver.

The API readiness endpoint is `/api/v1/health/ready`; liveness is `/api/v1/health/live`. A liveness
failure restarts the process. A readiness failure removes the instance from traffic and must not
cause an automatic restart loop while a dependency is recovering.

## Rollback

Application rollback means redeploying the previous known-good image digest. Roll back API and
workers together when their contracts changed; restore the previous admin digest when its API
contract changed.

Prisma migrations are forward-only in production. Do not run ad hoc down SQL. For an additive
migration, roll back application images and leave the compatible schema in place. For a breaking
migration, stop writes, assess a corrective forward migration, and use point-in-time database
recovery only when data integrity cannot be restored safely. A restore is an incident operation, not
a routine deploy step.

Abort rollout when readiness is unstable, error rate or latency breaches the release threshold, auth
or authorization checks regress, queue age rises continuously, audit writes fail, or storage
scanning cannot complete. Preserve logs and correlation IDs before replacing affected instances.
