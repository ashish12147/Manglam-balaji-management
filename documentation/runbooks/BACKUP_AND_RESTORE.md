# Backup and Restore

## Recovery objectives

The service owner must approve an RPO and RTO based on society operations. A practical starting
target is a 15-minute PostgreSQL RPO and four-hour RTO, validated by restore drills rather than
assumed from backup completion. Private object storage must be recovered consistently with database
attachment records.

## PostgreSQL

Use managed continuous backups with point-in-time recovery in production. Retain encrypted daily
snapshots in a separate account or project and protect deletion with least privilege. Before risky
schema changes, take an on-demand snapshot and confirm it is restorable.

For a portable encrypted logical backup:

```bash
umask 077
pg_dump --dbname="$DATABASE_URL" --format=custom --compress=9 \
  --file="manglam-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Restore into a new empty database, never over the only production database:

```bash
pg_restore --dbname="$RESTORE_DATABASE_URL" --clean --if-exists --no-owner \
  --exit-on-error manglam-YYYYMMDDTHHMMSSZ.dump
pnpm --filter @manglam/database migrate:status
```

Validate row counts for societies, users, memberships, visitors, payments, attachments, outbox
events, and audit logs. Verify append-only audit protections and application smoke checks before
switching traffic.

## Object storage

Enable bucket versioning, server-side encryption, retention protection, and cross-account or
cross-region replication. Keep the bucket private. Back up object metadata, versions, retention
state, and checksums. During restore, preserve object keys because database rows reference them
directly.

After restoring, sample quarantined, clean, and rejected attachments. Confirm clean objects are
readable only through authorized signed URLs and quarantined objects remain inaccessible. Re-scan
objects when signature integrity or malware-scanner history is uncertain.

## Redis

Redis accelerates sessions, throttling, locks, and queues; PostgreSQL and the transactional outbox
are the durable source of truth. Enable encrypted snapshots/AOF for faster recovery, but do not let
Redis restore overwrite authoritative PostgreSQL state. After Redis loss, restart consumers
gradually and watch duplicate suppression, queue age, and provider rate limits.

## Restore drills

Run quarterly and after material schema/storage changes. Restore to an isolated environment, measure
actual RPO/RTO, reconcile database-to-object references, run security and workflow checks, then
destroy the recovered data securely. Record failures and owners with due dates.
