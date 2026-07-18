# syntax=docker/dockerfile:1.8

ARG NODE_IMAGE=node:24.13.0-bookworm-slim

FROM ${NODE_IMAGE} AS dependencies
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY apps/resident-app/package.json apps/resident-app/package.json
COPY apps/guard-app/package.json apps/guard-app/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/permissions/package.json packages/permissions/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/validation/package.json packages/validation/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM dependencies AS source
COPY . .

FROM source AS database-build
RUN pnpm --filter @manglam/database build

FROM database-build AS api-build
RUN pnpm --filter @manglam/api... build
RUN pnpm --filter @manglam/api deploy --prod --legacy /release

FROM database-build AS worker-build
RUN pnpm --filter @manglam/worker... build
RUN pnpm --filter @manglam/worker deploy --prod --legacy /release

FROM source AS admin-build
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm --filter @manglam/admin-web... build

FROM ${NODE_IMAGE} AS api
ENV NODE_ENV=production
WORKDIR /app
RUN groupmod --gid 10001 node && usermod --uid 10001 --gid 10001 node
COPY --from=api-build --chown=node:node /release ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+(process.env.API_PREFIX||'/api/v1')+'/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "dist/main.js"]

FROM ${NODE_IMAGE} AS worker
ENV NODE_ENV=production
WORKDIR /app
RUN groupmod --gid 10001 node && usermod --uid 10001 --gid 10001 node
COPY --from=worker-build --chown=node:node /release ./
USER node
EXPOSE 4010
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.WORKER_HEALTH_PORT||4010)+'/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "dist/main.js"]

FROM ${NODE_IMAGE} AS admin-web
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app
RUN groupmod --gid 10001 node && usermod --uid 10001 --gid 10001 node
COPY --from=admin-build --chown=node:node /workspace/apps/admin-web/.next/standalone ./
COPY --from=admin-build --chown=node:node /workspace/apps/admin-web/.next/static ./apps/admin-web/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/login').then(r=>{if(r.status>=500)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "apps/admin-web/server.js"]

FROM dependencies AS migration
ENV NODE_ENV=production
WORKDIR /workspace
COPY packages/database packages/database
COPY tsconfig.base.json ./tsconfig.base.json
RUN pnpm --filter @manglam/database generate
RUN chown -R node:node /workspace
USER node
CMD ["pnpm", "--filter", "@manglam/database", "migrate:deploy"]
