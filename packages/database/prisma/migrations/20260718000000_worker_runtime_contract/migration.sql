-- Worker runtime contract and society-scoped retention policy support.

-- Remove the non-delivery provider without silently converting fake endpoints.
DO $migration$
DECLARE
  existing_labels TEXT[];
BEGIN
  SELECT array_agg(enum_value.enumlabel ORDER BY enum_value.enumsortorder)
    INTO existing_labels
  FROM pg_enum AS enum_value
  JOIN pg_type AS enum_type ON enum_type.oid = enum_value.enumtypid
  JOIN pg_namespace AS enum_namespace ON enum_namespace.oid = enum_type.typnamespace
  WHERE enum_type.typname = 'PushProvider'
    AND enum_namespace.nspname = current_schema();

  IF existing_labels IS NULL THEN
    RAISE EXCEPTION 'PushProvider enum is missing; apply the initial migration first'
      USING ERRCODE = '42704';
  ELSIF existing_labels = ARRAY['FCM', 'EXPO', 'WEB_PUSH'] THEN
    NULL;
  ELSIF existing_labels <> ARRAY['FCM', 'EXPO', 'WEB_PUSH', 'DEVELOPMENT'] THEN
    RAISE EXCEPTION 'Unexpected PushProvider labels: %', existing_labels
      USING ERRCODE = '23514';
  ELSIF EXISTS (
    SELECT 1
    FROM "push_endpoints"
    WHERE "provider"::TEXT = 'DEVELOPMENT'
  ) THEN
    RAISE EXCEPTION 'Cannot remove PushProvider.DEVELOPMENT while push endpoints use it'
      USING
        ERRCODE = '23514',
        HINT = 'Delete or replace DEVELOPMENT push endpoints after verifying they are non-production data.';
  ELSE
    CREATE TYPE "PushProvider_without_development" AS ENUM ('FCM', 'EXPO', 'WEB_PUSH');

    ALTER TABLE "push_endpoints"
      ALTER COLUMN "provider" TYPE "PushProvider_without_development"
      USING ("provider"::TEXT::"PushProvider_without_development");

    DROP TYPE "PushProvider";
    ALTER TYPE "PushProvider_without_development" RENAME TO "PushProvider";
  END IF;
END
$migration$;

CREATE TYPE "RetentionEntityType" AS ENUM ('file_upload');
CREATE TYPE "WorkerHeartbeatState" AS ENUM ('READY', 'DRAINING', 'FAILED');

CREATE TABLE "retention_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "entity_type" "RetentionEntityType" NOT NULL DEFAULT 'file_upload',
    "file_purpose" "FilePurpose",
    "retention_days" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "retention_policies_retention_days_check"
      CHECK ("retention_days" BETWEEN 1 AND 3650),
    CONSTRAINT "retention_policies_version_check"
      CHECK ("version" >= 1)
);

CREATE TABLE "worker_heartbeats" (
    "worker_id" VARCHAR(128) NOT NULL,
    "state" "WorkerHeartbeatState" NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_heartbeats_pkey" PRIMARY KEY ("worker_id"),
    CONSTRAINT "worker_heartbeats_worker_id_check"
      CHECK (length(btrim("worker_id")) > 0),
    CONSTRAINT "worker_heartbeats_timestamp_order_check"
      CHECK ("last_seen_at" >= "started_at")
);

CREATE UNIQUE INDEX "retention_policies_society_id_id_key"
  ON "retention_policies"("society_id", "id");

CREATE UNIQUE INDEX "retention_policies_one_active_default_key"
  ON "retention_policies"("society_id", "entity_type")
  WHERE "active" = true AND "file_purpose" IS NULL;

CREATE UNIQUE INDEX "retention_policies_one_active_file_purpose_key"
  ON "retention_policies"("society_id", "entity_type", "file_purpose")
  WHERE "active" = true AND "file_purpose" IS NOT NULL;

CREATE INDEX "retention_policies_society_active_entity_idx"
  ON "retention_policies"("society_id", "active", "entity_type");

CREATE INDEX "worker_heartbeats_state_last_seen_idx"
  ON "worker_heartbeats"("state", "last_seen_at");

ALTER TABLE "retention_policies"
  ADD CONSTRAINT "retention_policies_society_id_fkey"
  FOREIGN KEY ("society_id") REFERENCES "societies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Authentication hardening: normalized TOTP credentials and digest-only attempt telemetry.

CREATE TYPE "MfaCredentialType" AS ENUM ('TOTP');
CREATE TYPE "MfaCredentialStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');
CREATE TYPE "AuthenticationMethod" AS ENUM (
    'OTP',
    'ADMIN_PASSWORD',
    'GUARD_PIN',
    'RESIDENT_APP_PIN',
    'TOTP',
    'REFRESH_TOKEN'
);
CREATE TYPE "AuthenticationAttemptOutcome" AS ENUM ('SUCCESS', 'FAILURE', 'BLOCKED');

CREATE TABLE "mfa_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "MfaCredentialType" NOT NULL DEFAULT 'TOTP',
    "status" "MfaCredentialStatus" NOT NULL DEFAULT 'PENDING',
    "secret_ciphertext" BYTEA NOT NULL,
    "secret_nonce" BYTEA NOT NULL,
    "secret_auth_tag" BYTEA NOT NULL,
    "key_version" INTEGER NOT NULL DEFAULT 1,
    "encryption_algorithm" VARCHAR(32) NOT NULL DEFAULT 'AES-256-GCM',
    "label" VARCHAR(80),
    "confirmed_at" TIMESTAMPTZ(6),
    "last_used_time_step" BIGINT,
    "revoked_at" TIMESTAMPTZ(6),
    "revocation_reason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_credentials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mfa_credentials_secret_shape_check"
      CHECK (
        octet_length("secret_ciphertext") > 0
        AND octet_length("secret_nonce") = 12
        AND octet_length("secret_auth_tag") = 16
        AND "key_version" >= 1
        AND "encryption_algorithm" = 'AES-256-GCM'
      ),
    CONSTRAINT "mfa_credentials_last_step_check"
      CHECK ("last_used_time_step" IS NULL OR "last_used_time_step" >= 0),
    CONSTRAINT "mfa_credentials_status_check"
      CHECK (
        ("status" = 'PENDING' AND "confirmed_at" IS NULL AND "last_used_time_step" IS NULL AND "revoked_at" IS NULL)
        OR ("status" = 'ACTIVE' AND "confirmed_at" IS NOT NULL AND "revoked_at" IS NULL)
        OR ("status" = 'REVOKED' AND "revoked_at" IS NOT NULL)
      ),
    CONSTRAINT "mfa_credentials_version_check"
      CHECK ("version" >= 1)
);

CREATE TABLE "authentication_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "subject_digest" CHAR(64) NOT NULL,
    "origin_digest" CHAR(64),
    "method" "AuthenticationMethod" NOT NULL,
    "outcome" "AuthenticationAttemptOutcome" NOT NULL,
    "failure_code" VARCHAR(80),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retention_until" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "authentication_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "authentication_attempts_subject_digest_check"
      CHECK ("subject_digest" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "authentication_attempts_origin_digest_check"
      CHECK ("origin_digest" IS NULL OR "origin_digest" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "authentication_attempts_retention_check"
      CHECK ("retention_until" > "occurred_at")
);

CREATE UNIQUE INDEX "mfa_credentials_society_id_id_key"
  ON "mfa_credentials"("society_id", "id");

CREATE UNIQUE INDEX "mfa_credentials_one_current_totp_key"
  ON "mfa_credentials"("society_id", "user_id", "type")
  WHERE "status" IN ('PENDING', 'ACTIVE');

CREATE INDEX "mfa_credentials_society_user_status_idx"
  ON "mfa_credentials"("society_id", "user_id", "status");

CREATE UNIQUE INDEX "authentication_attempts_society_id_id_key"
  ON "authentication_attempts"("society_id", "id");

CREATE INDEX "auth_attempts_subject_recent_idx"
  ON "authentication_attempts"("society_id", "method", "subject_digest", "occurred_at" DESC);

CREATE INDEX "auth_attempts_origin_recent_idx"
  ON "authentication_attempts"("society_id", "method", "origin_digest", "occurred_at" DESC);

CREATE INDEX "auth_attempts_retention_until_idx"
  ON "authentication_attempts"("retention_until");

ALTER TABLE "mfa_credentials"
  ADD CONSTRAINT "mfa_credentials_society_id_fkey"
  FOREIGN KEY ("society_id") REFERENCES "societies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mfa_credentials"
  ADD CONSTRAINT "mfa_credentials_user_id_society_fkey"
  FOREIGN KEY ("society_id", "user_id") REFERENCES "users"("society_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "authentication_attempts"
  ADD CONSTRAINT "authentication_attempts_society_id_fkey"
  FOREIGN KEY ("society_id") REFERENCES "societies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "users_society_email_ci_key"
  ON "users"("society_id", lower("email"))
  WHERE "email" IS NOT NULL;

CREATE UNIQUE INDEX "guard_devices_enrollment_token_digest_key"
  ON "guard_devices"("enrollment_token_digest")
  WHERE "enrollment_token_digest" IS NOT NULL;

CREATE INDEX "guard_devices_enrollment_activation_idx"
  ON "guard_devices"("enrollment_token_digest", "status", "enrollment_expires_at");

ALTER TABLE "guard_devices"
  ADD CONSTRAINT "guard_devices_enrollment_state_check"
  CHECK (
    (
      "enrollment_token_digest" IS NULL
      OR btrim("enrollment_token_digest") ~ '^[0-9a-f]{64}$'
    )
    AND (
      (
        "status" = 'PENDING'
        AND "enrollment_token_digest" IS NOT NULL
        AND "enrollment_expires_at" IS NOT NULL
        AND "enrollment_expires_at" > "created_at"
        AND "key_id" IS NULL
      )
      OR (
        "status" = 'ACTIVE'
        AND "enrollment_token_digest" IS NULL
        AND "enrollment_expires_at" IS NULL
        AND "key_id" IS NOT NULL
      )
      OR (
        "status" IN ('REVOKED', 'LOST')
        AND "enrollment_token_digest" IS NULL
        AND "enrollment_expires_at" IS NULL
      )
    )
  );

DROP INDEX "guard_devices_device_id_key";

CREATE UNIQUE INDEX "guard_devices_society_device_key"
  ON "guard_devices"("society_id", "device_id");

ALTER TABLE "guard_devices"
  DROP CONSTRAINT "guard_devices_device_id_fkey";

ALTER TABLE "guard_devices"
  ADD CONSTRAINT "guard_devices_device_society_fkey"
  FOREIGN KEY ("society_id", "device_id")
  REFERENCES "devices"("society_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "guard_devices"
  ADD CONSTRAINT "guard_devices_registered_by_user_society_fkey"
  FOREIGN KEY ("society_id", "registered_by_user_id")
  REFERENCES "users"("society_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE OR REPLACE FUNCTION "prevent_mfa_totp_step_regression"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."last_used_time_step" IS NOT NULL
     AND (
       NEW."last_used_time_step" IS NULL
       OR NEW."last_used_time_step" <= OLD."last_used_time_step"
     ) THEN
    RAISE EXCEPTION 'TOTP time-step must advance monotonically'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "mfa_credentials_totp_step_monotonic"
BEFORE UPDATE OF "last_used_time_step" ON "mfa_credentials"
FOR EACH ROW EXECUTE FUNCTION "prevent_mfa_totp_step_regression"();
