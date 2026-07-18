#!/bin/sh
set -eu

mc alias set local http://minio:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}"
mc mb --ignore-existing "local/${S3_BUCKET}"
mc anonymous set none "local/${S3_BUCKET}"
if ! mc admin user info local "${MINIO_APP_ACCESS_KEY}" >/dev/null 2>&1; then
  mc admin user add local "${MINIO_APP_ACCESS_KEY}" "${MINIO_APP_SECRET_KEY}"
fi
sed "s/__BUCKET__/${S3_BUCKET}/g" /bootstrap/app-policy.json > /tmp/app-policy.json
if ! mc admin policy info local manglam-app >/dev/null 2>&1; then
  mc admin policy create local manglam-app /tmp/app-policy.json
fi
mc admin policy attach local manglam-app --user "${MINIO_APP_ACCESS_KEY}"
