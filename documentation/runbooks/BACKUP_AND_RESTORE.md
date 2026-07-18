# Backup and Restore

## Recovery objectives

The service owner must approve an RPO and RTO based on society operations. A practical starting
target is a 15-minute PostgreSQL RPO and four-hour RTO, validated by restore drills rather than
assumed from backup completion. Private object storage must be recovered consistently with database
attachment records. Record the database recovery point, object-replication checkpoint, backup IDs,
and encryption-key versions as one recovery set.

Backups are not complete unless the team can access the separately protected keys needed to decrypt
the backup, MFA records, and sensitive payloads. Backup operators must not have routine production
write access, and production workloads must not be able to delete the protected backup copies.

## PostgreSQL

Use managed continuous backups with point-in-time recovery in production. Retain encrypted daily
snapshots in a separate account or project and protect deletion with least privilege. Before risky
schema changes, take an on-demand snapshot and confirm the backup and transaction-log stream are
healthy. A logical dump supplements point-in-time recovery; it does not replace it.

For a portable client-encrypted logical backup, use an approved `age` recipient whose private key is
held outside the database account:

```bash
set -euo pipefail
umask 077
backup="manglam-$(date -u +%Y%m%dT%H%M%SZ).dump.age"
pg_dump --dbname="$DATABASE_URL" --format=custom --compress=9 |
  age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" --output "$backup"
sha256sum "$backup" > "${backup}.sha256"
```

Upload both files to protected backup storage, record the PostgreSQL server version and recovery
set, and remove the local files according to the approved handling procedure. Never write the
unencrypted dump to shared disk.

Restore into a newly created empty database with credentials that cannot reach production. Confirm
the target host and database name before decrypting:

```bash
set -euo pipefail
sha256sum --check "${BACKUP_FILE}.sha256"
age --decrypt --identity "$BACKUP_AGE_IDENTITY_FILE" "$BACKUP_FILE" |
  pg_restore --dbname="$RESTORE_DATABASE_URL" --no-owner --no-privileges \
    --exit-on-error --single-transaction
DATABASE_URL="$RESTORE_DATABASE_URL" pnpm --filter @manglam/database migrate:status
```

Do not run `migrate:deploy` merely to make an old backup current. First verify that the restored
migration history matches the application digest selected for the recovery. Apply later migrations
only as an explicit, reviewed recovery step.

Validate row counts for societies, users, memberships, visitors, payments, attachments, outbox
events, and audit logs. Verify append-only audit protections and reconcile database invariants
before starting application processes.

## Object storage

Enable bucket versioning, server-side encryption, retention protection, and cross-account or
cross-region replication. Keep the bucket private. Replicate object data, every retained version,
checksums, tags, retention state, and required bucket configuration. A plain filesystem copy or
`mc mirror` is not a version-complete backup and must not be the only recovery source.

Restore into a new private bucket with a new bucket-scoped application identity. Recover the object
versions and metadata to the database recovery point before switching any application to the bucket.
Preserve object keys because database rows reference them directly. Do not grant anonymous access
while testing.

After restoration, reconcile every attachment row to an object key and expected size/checksum;
missing or mismatched objects block recovery. Sample quarantined, clean, rejected, and deleted
attachments. Confirm clean objects are readable only through authorized signed URLs and quarantined
objects remain inaccessible. Re-scan objects when checksum evidence, scanner history, or signature
integrity is uncertain.

## Redis

Redis accelerates sessions, throttling, locks, and queues; PostgreSQL and the transactional outbox
are the durable source of truth. Enable encrypted snapshots or AOF for faster recovery, but do not
let a Redis restore overwrite authoritative PostgreSQL state. Prefer an empty Redis when the
snapshot cannot be tied to the same recovery set. Restart consumers gradually and watch duplicate
suppression, queue age, and provider rate limits.

## Recovery sequence

1. Declare the recovery point and isolate new database, bucket, Redis, and application targets from
   production networks and provider credentials.
2. Restore PostgreSQL and object versions from the same recovery set. Restore the exact secret-key
   versions required to decrypt retained data under audited access.
3. Verify migration history, row counts, audit integrity, database-to-object references, object
   checksums, and bucket privacy before starting the API.
4. Keep workers stopped and outbound providers pointed at approved test sinks until the restored
   outbox has been inspected. Replaying an old outbox can duplicate OTP, push, or other external
   side effects.
5. Start the API and then workers from recorded immutable image digests. Run authorization, login,
   MFA, visitor, payment, upload, malware-scan, notification, and audit checks.
6. Measure data loss and elapsed recovery time. A production traffic switch requires incident or
   change approval, a rollback target, and recorded evidence.

## Restore drills

Run quarterly and after material schema, storage, encryption, or replication changes. Restore to an
isolated environment, measure actual RPO/RTO, exercise decryption-key access, reconcile database and
object state, run security and workflow checks, and then destroy recovered resident data securely.
Record backup IDs, recovery points, image digests, results, failures, owners, and due dates.
