# Infrastructure

This directory contains the deployable container build and the isolated local integration stack.

## Container targets

`infrastructure/docker/Dockerfile` exposes four independently releasable targets:

- `api`: NestJS API, port 4000, non-root UID/GID 10001
- `worker`: background worker, health port 4010, non-root UID/GID 10001
- `admin-web`: Next.js standalone server, port 3000, non-root UID/GID 10001
- `migration`: one-shot Prisma migration runner, non-root UID/GID 10001

All runtime images have a read-only compatible filesystem and contain no source environment files.
The admin API URL is a build-time public value supplied through `NEXT_PUBLIC_API_URL`; it is not a
secret.

## Local stack

The Compose stack supplies authenticated PostgreSQL and Redis, private MinIO object storage with a
bucket-scoped application identity, and ClamAV. Host ports bind to loopback only. Backend traffic
uses an internal Docker network, persistent state uses named volumes, and all services have health
checks.

Start with [LOCAL_DEVELOPMENT.md](../documentation/runbooks/LOCAL_DEVELOPMENT.md). Production
operations are described in the runbooks directory. Compose is for local integration, not a
production orchestrator.
