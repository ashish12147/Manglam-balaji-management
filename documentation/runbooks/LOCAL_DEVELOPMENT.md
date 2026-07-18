# Local Development

## Prerequisites

- Node.js 24 and pnpm 11
- Docker Engine with Compose v2
- At least 6 GB memory available to Docker while ClamAV is running

## Provision dependencies

From the repository root:

```powershell
node scripts/Initialize-LocalInfrastructure.mjs
node scripts/Validate-Infrastructure.mjs
docker compose --env-file infrastructure/.env.local -f infrastructure/compose.integration.yml up -d
docker compose --env-file infrastructure/.env.local -f infrastructure/compose.integration.yml ps
```

The generated file contains cryptographically random local credentials and a 3072-bit RSA signing
keypair. It is ignored by Git. The default stack exposes PostgreSQL, Redis, MinIO API, and MinIO
Console on loopback only. ClamAV can take up to two minutes to download signatures and report
healthy.

Run migrations explicitly:

```powershell
docker compose --env-file infrastructure/.env.local -f infrastructure/compose.integration.yml --profile migrate run --rm migrate
```

Run repository integration tests against the stack:

```powershell
$env:TEST_DATABASE_URL = "postgresql://manglam:<generated-password>@127.0.0.1:5432/manglam"
$env:TEST_REDIS_URL = "redis://:<generated-password>@127.0.0.1:6379/0"
pnpm test:integration
```

Use the credentials generated in `infrastructure/.env.local`; do not paste the literal examples into
a shared configuration.

## Run application containers

The `app` profile requires real MSG91 or Twilio credentials and real Expo or FCM credentials. Set
the chosen provider variables in `infrastructure/.env.local`, validate the file, then run:

```powershell
docker compose --env-file infrastructure/.env.local -f infrastructure/compose.integration.yml --profile app up --build
```

No development OTP or push transport is selected by the Compose file. The admin image compiles
`http://127.0.0.1:4000/api/v1` as its local API URL.

## Stop and reset

Stop containers without deleting state:

```powershell
docker compose --env-file infrastructure/.env.local -f infrastructure/compose.integration.yml down
```

Deleting named volumes permanently removes the local database, objects, Redis state, and ClamAV
signatures. Take a local backup if the data matters, then use `down --volumes` deliberately.

Rotate all local credentials with `node scripts/Initialize-LocalInfrastructure.mjs --force`.
Existing volumes retain their old database and storage credentials, so rotate in each service or
reset the local volumes immediately after regeneration.
