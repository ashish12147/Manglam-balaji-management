# Configuration and Secrets

## Environment separation

Development, staging, and production use separate databases, Redis instances, object buckets,
provider accounts, signing keys, encryption keys, peppers, and DNS names. Production must use
verified TLS for PostgreSQL, `rediss://` for Redis, HTTPS object storage, and HTTPS public origins.
API documentation is disabled in production.

Store secrets in the deployment platform's secret manager and inject them at process start. Restrict
read access to the API, worker, migration, or provisioning identity that needs each value. Never put
secrets in container build arguments, image labels, repository variables, mobile application
configuration, or Next.js `NEXT_PUBLIC_*` variables. Validate rendered configuration without
printing values before every deployment.

## Required configuration groups

| Purpose                      | Values                                                                              | Consumers              |
| ---------------------------- | ----------------------------------------------------------------------------------- | ---------------------- |
| Database                     | `DATABASE_URL`                                                                      | API, worker, migration |
| Redis                        | `REDIS_URL`                                                                         | API, worker            |
| Object storage               | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | API, worker            |
| Credential hashing           | `ADMIN_PASSWORD_PEPPER`, `GUARD_PIN_PEPPER`, `RESIDENT_APP_PIN_PEPPER`              | API, provisioning      |
| Token and code digests       | `OTP_HMAC_SECRET`, `REFRESH_TOKEN_PEPPER`, `VISITOR_CODE_HMAC_SECRET`               | API                    |
| Session signing              | `COOKIE_SECRET`                                                                     | API                    |
| MFA encryption               | `MFA_ENCRYPTION_KEY_BASE64`, `MFA_ENCRYPTION_KEY_VERSION`                           | API, provisioning      |
| Access-token signing         | `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`                                                 | API                    |
| Sensitive payload encryption | `ENCRYPTION_KEY`                                                                    | API, worker            |
| OTP delivery                 | MSG91 or Twilio credentials                                                         | API, worker            |
| Push delivery                | Expo or FCM credentials                                                             | API, worker            |

Generate every symmetric secret independently with a cryptographically secure generator. Never reuse
a database, Redis, storage, cookie, encryption, HMAC, token, or credential-pepper value for a
different purpose. The three credential peppers must always be distinct.

`MFA_ENCRYPTION_KEY_BASE64` is canonical base64 for exactly 32 random bytes, and
`MFA_ENCRYPTION_KEY_VERSION` is a positive integer matching the encrypted MFA rows. Use RSA keys of
at least 3072 bits for access tokens. Keep the JWT private key only in the API secret scope; the
public key is configuration, not secret material. Provider credentials should be limited to the
approved sender, template, project, bucket, and production origins.

For MinIO or another S3-compatible service, keep the root or administrative identity out of
application workloads. Give the application a separate bucket-scoped identity with only the object
actions it uses. Keep old access keys enabled only for the bounded overlap needed to rotate clients.

## Rotation order

1. Create the replacement credential without revoking the current credential.
2. Deploy dual-read or overlapping verification support when the value protects stored hashes,
   ciphertext, signatures, or sessions. The current application accepts one value for these cases,
   so they require a reviewed compatibility release before rotation.
3. Update staging and run authentication, MFA, upload, notification, backup-decryption, and rollback
   checks.
4. Update production secrets and perform a rolling restart while both provider credentials remain
   valid where overlap is supported.
5. Verify health, login, refresh, MFA, upload scanning, provider delivery, and audit writes.
6. Revoke the previous credential, remove its access grants, and record the rotation evidence.

Database, Redis, S3, MSG91, Twilio, Expo, and FCM credentials can use provider overlap. JWT signing
requires verification-key overlap before zero-downtime rotation. Credential peppers,
`OTP_HMAC_SECRET`, `REFRESH_TOKEN_PEPPER`, `VISITOR_CODE_HMAC_SECRET`, `ENCRYPTION_KEY`, and the MFA
encryption key require explicit compatibility and data-migration plans; never replace them in place.
Rotating `COOKIE_SECRET` invalidates existing signed refresh cookies and must be treated as a
planned session reset unless overlapping verification is implemented.

Keep recovery copies of encryption and signing material under separate, audited custody for at least
as long as any retained backup needs them. Test access quarterly without placing recovered values in
logs or tickets. Rotate immediately after suspected exposure, staff access removal, provider
compromise, or accidental logging; otherwise follow the approved rotation schedule.
