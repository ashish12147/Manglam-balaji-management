# Threat Model

## Security Baseline

| Threat                | Required controls                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------- |
| Account takeover      | Phone OTP plus active membership; MFA and step-up auth for privileged actions                 |
| Cross-flat IDOR       | Deny by default, scoped queries, field filtering, foreign resources return 404                |
| Guard device theft    | Separate identity/device trust, encrypted cache, 24-hour lease, gate scope, revocation        |
| Visitor code guessing | Random 128-bit QR or 10-character manual code, HMAC storage, expiry, rate limit, one-time use |
| Duplicate actions     | Idempotency, unique constraints, row locks, optimistic versioning, immutable events           |
| Malicious files       | Quarantine, magic-byte checks, re-encoding/scan, strict allowlist and private storage         |
| Payment manipulation  | Server allocation, unique references, immutable reversals, reason and step-up auth            |
| Privilege escalation  | No client roles, explicit actions, mass-assignment protection, session invalidation           |
| Audit tampering       | Append-only database permissions, immutable trigger, chained or signed digest                 |
| Notification spoofing | Opaque payloads, authenticated fetch, signed callbacks, retry and in-app fallback             |

## Authentication Contract

- Resident OTP is six random digits, HMAC protected, bound to phone/purpose/device, and valid for
  five minutes.
- Only the newest challenge is valid. Five attempts are allowed, with a 60-second resend cooldown
  and layered phone, device, and IP limits.
- Access tokens last 10 minutes and carry identity/session identifiers only. Effective permissions
  and memberships are loaded server-side.
- Refresh tokens rotate, are stored only as digests, are device bound, and revoke the family on
  reuse.
- Resident sessions use seven-day idle and 30-day absolute limits; guard shifts last at most 12
  hours; privileged sessions use 30-minute idle and eight-hour absolute limits.
- Guards use an Argon2id PIN plus an active registered device. Admin/staff use Argon2id passwords
  and mandatory TOTP or WebAuthn MFA.
- Production refuses to start with the development OTP provider.

## Data Minimization

Guard views expose only the resident name, masked contact when essential, flat, visitor purpose, and
verification state. Push payloads contain opaque identifiers. The MVP does not collect Aadhaar or
PAN copies. Images have EXIF removed. CSV fields beginning with a formula character are neutralized.
Private object keys are never public URLs.

## File Policy

Allow JPEG, PNG, and WebP up to 5 MB and PDF up to 10 MB. Reject SVG, HTML, executables, archives,
macro documents, password-protected PDFs, MIME mismatches, polyglots, excessive dimensions, and
unscanned files. Clean files use authorized signed URLs with a maximum 60-second lifetime.

## Security Acceptance

Tests must cover the role/resource matrix across REST, WebSockets, files, search, and exports;
immediate membership/device/session revocation; concurrent OTP and visit decisions; token reuse;
visitor-code replay; hostile uploads; payment duplication; privileged-role escalation; audit
immutability; CSRF, SQL/XSS, mass assignment, and CSV injection; plus emergency behavior when push
and WebSocket delivery fail.
