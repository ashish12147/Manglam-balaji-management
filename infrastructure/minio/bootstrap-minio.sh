#!/bin/sh
set -eu

: "${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}"
: "${MINIO_APP_ACCESS_KEY:?MINIO_APP_ACCESS_KEY is required}"
: "${MINIO_APP_SECRET_KEY:?MINIO_APP_SECRET_KEY is required}"
: "${S3_BUCKET:?S3_BUCKET is required}"

if [ "${#S3_BUCKET}" -lt 3 ] || [ "${#S3_BUCKET}" -gt 63 ]; then
  echo "S3_BUCKET must contain 3-63 characters" >&2
  exit 1
fi
case "${S3_BUCKET}" in
  *[!a-z0-9.-]* | .* | *. | -* | *- | *..* | *.-* | *-.*)
    echo "S3_BUCKET must be a DNS-compatible bucket name" >&2
    exit 1
    ;;
esac

trap 'rm -f /tmp/app-policy.json' EXIT
mc alias set local http://minio:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" >/dev/null
mc mb --ignore-existing "local/${S3_BUCKET}"
mc version enable "local/${S3_BUCKET}"
mc anonymous set none "local/${S3_BUCKET}"
if ! mc admin user info local "${MINIO_APP_ACCESS_KEY}" >/dev/null 2>&1; then
  mc admin user add local "${MINIO_APP_ACCESS_KEY}" "${MINIO_APP_SECRET_KEY}" >/dev/null
fi
sed "s/__BUCKET__/${S3_BUCKET}/g" /bootstrap/app-policy.json > /tmp/app-policy.json
if ! mc admin policy info local manglam-app >/dev/null 2>&1; then
  mc admin policy create local manglam-app /tmp/app-policy.json
fi
mc admin policy attach local manglam-app --user "${MINIO_APP_ACCESS_KEY}"