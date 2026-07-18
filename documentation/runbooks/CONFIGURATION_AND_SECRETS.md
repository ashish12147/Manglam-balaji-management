# Configuration and Secrets

## Environment separation

Development, staging, and production use separate databases, Redis instances, object buckets,
provider accounts, signing keys, and DNS names. Production must use verified TLS for PostgreSQL,
`rediss://` for Redis, HTTPS object storage, and HTTPS public origins. API documentation is disabled
in production.

Store secrets in the deployment platform's secret manager and inject them at process start. Restrict
read access to the API or worker identity that needs each value. Never put secrets in container
build arguments, image labels, repository variables, mobile application configuration, or Next.js
`NEXT_PUBLIC_*` variables.

## Required secret groups

| Group          | Values                                                        | Consumers              |
| -------------- | ------------------------------------------------------------- | ---------------------- |
| Database       | `DATABASE_URL`                                                | API, worker, migration |
| Redis          | `REDIS_URL`                                                   | API, worker            |
| Object storage | `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`                    | API, worker            |
| Authentication | `ADMIN_PASSWORD_PEPPER`, `GUARD_PIN_PEPPER`, `RESIDENT_APP_PIN_PEPPER`, `OTP_HMAC_SECRET`, `REFRESH_TOKEN_PEPPER` | API |
| Signing        | `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`                           | API                    |
| Encryption     | `ENCRYPTION_KEY`, `COOKIE_SECRET`, `VISITOR_CODE_HMAC_SECRET` | API                    |
| OTP delivery   | MSG91 or Twilio credentials                                   | API, worker            |
| Push delivery  | Expo or FCM credentials                                       | API, worker            |

Use RSA keys of at least 3072 bits for access tokens. Keep the private key only in the API secret
scope. Provider credentials should be limited to the approved sender/template/project and production
origins.

## Rotation order

1. Create the replacement credential without revoking the current credential.
2. Deploy dual-read or overlapping verification support when the secret participates in stored
   hashes, encryption, or signatures. The current application accepts one value, so those rotations
   require a reviewed compatibility release first.
3. Update staging and run authentication, upload, notification, and rollback checks.
4. Update production secrets and perform a rolling restart.
5. Verify health, login, refresh, upload scanning, and provider delivery.
6. Revoke the previous credential and record the rotation evidence.

Database, Redis, S3, MSG91, Twilio, Expo, and FCM credentials can use provider overlap. JWT signing
requires a verification-key overlap feature before zero-downtime rotation. Pepper and encryption-key
rotation requires explicit data migration; never replace them in place.

Rotate immediately after suspected exposure, staff access removal, provider compromise, or
accidental logging. Otherwise follow the organization's approved schedule and verify recovery access
quarterly.
