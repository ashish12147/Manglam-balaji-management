# Incident Response

## Severity

- `SEV-1`: confirmed sensitive-data exposure, account takeover at scale, destructive integrity loss,
  or broad service outage affecting critical gate operations
- `SEV-2`: significant partial outage, provider failure without a viable fallback, delayed emergency
  workflows, or suspected security compromise
- `SEV-3`: limited degradation with a workaround and no evidence of data exposure

## Response

1. Assign incident commander, operations lead, communications lead, and scribe. Open a restricted
   timeline using UTC.
2. Stabilize human safety first. Gate staff must switch to the approved manual visitor and emergency
   procedure when the application is unavailable.
3. Determine affected services, societies/users, time window, data classes, and latest known-good
   state.
4. Contain: remove unhealthy instances, revoke exposed sessions or credentials, disable compromised
   provider routes, quarantine suspicious uploads, and preserve database/audit evidence.
5. Eradicate the cause with a reviewed change. Do not destroy logs, rotate encryption keys blindly,
   or mutate append-only audit records.
6. Recover gradually from immutable images and verified backups. Run authorization, visitor,
   payment, upload, notification, and audit smoke checks.
7. Communicate facts, user impact, workarounds, and next update time. Do not speculate or include
   resident personal data in broad channels.
8. Follow applicable contractual and legal notification requirements with the authorized
   privacy/legal owner. Engineering does not make that determination alone.

## Scenario actions

**Credential exposure:** revoke the credential, invalidate affected sessions, inspect audit/provider
logs, issue a scoped replacement, and review access paths. Pepper or encryption-key exposure
requires a planned data migration and specialist review.

**Database integrity:** stop writes, capture database state and logs, identify the last consistent
point, and choose corrective migration or point-in-time recovery. Reconcile object references and
audit-chain integrity before reopening traffic.

**Malware scanning outage:** keep uploads quarantined and unavailable. Do not bypass scanning.
Restore ClamAV/signatures, drain the quarantine backlog with rate limits, and alert on objects that
cannot be verified.

**OTP/push provider outage:** preserve idempotency and outbox state, reduce retry pressure, respect
provider limits, and communicate delayed delivery. Switch providers only when credentials,
templates, sender identity, and user-facing behavior have been pre-approved and tested.

## Closure

Close only after metrics are stable, queues are reconciled, temporary access is removed, secrets are
rotated where required, and affected records are accounted for. Publish a blameless review within
five business days with timeline, root cause, contributing controls, detection gap, corrective
owners, and due dates. Verify corrective actions in a later exercise.
