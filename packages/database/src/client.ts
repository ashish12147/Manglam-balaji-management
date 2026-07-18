import { PrismaPg } from '@prisma/adapter-pg';
import type { PoolConfig } from 'pg';

import { Prisma, PrismaClient } from './generated/prisma/client.js';

export interface DatabaseClientOptions {
  connectionString?: string;
  applicationName?: string;
  connectionTimeoutMs?: number;
  idleTimeoutMs?: number;
  poolMax?: number;
  statementTimeoutMs?: number;
  log?: Array<Prisma.LogLevel | Prisma.LogDefinition>;
}

const globalDatabase = globalThis as typeof globalThis & {
  __manglamDatabaseClient?: PrismaClient;
};

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.length === 0) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

export function resolveDatabaseUrl(explicitUrl?: string): string {
  const value = explicitUrl ?? process.env.DATABASE_URL;
  if (!value) {
    throw new Error('DATABASE_URL is required to create a database client.');
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must use the postgres or postgresql protocol.');
  }
  if (!parsed.hostname || parsed.pathname === '/' || parsed.pathname.length < 2) {
    throw new Error('DATABASE_URL must include a host and database name.');
  }

  return value;
}

export function createDatabaseClient(options: DatabaseClientOptions = {}): PrismaClient {
  const poolConfig: PoolConfig = {
    connectionString: resolveDatabaseUrl(options.connectionString),
    application_name: options.applicationName ?? process.env.APP_NAME ?? 'manglam-balaji',
    connectionTimeoutMillis:
      options.connectionTimeoutMs ??
      positiveInteger(process.env.DB_CONNECTION_TIMEOUT_MS, 5_000, 'DB_CONNECTION_TIMEOUT_MS'),
    idleTimeoutMillis:
      options.idleTimeoutMs ??
      positiveInteger(process.env.DB_IDLE_TIMEOUT_MS, 30_000, 'DB_IDLE_TIMEOUT_MS'),
    max: options.poolMax ?? positiveInteger(process.env.DB_POOL_MAX, 20, 'DB_POOL_MAX'),
    statement_timeout:
      options.statementTimeoutMs ??
      positiveInteger(process.env.DB_STATEMENT_TIMEOUT_MS, 5_000, 'DB_STATEMENT_TIMEOUT_MS'),
  };

  const adapter = new PrismaPg(poolConfig);
  return options.log === undefined
    ? new PrismaClient({ adapter })
    : new PrismaClient({ adapter, log: options.log });
}

export function getDatabaseClient(options: DatabaseClientOptions = {}): PrismaClient {
  if (globalDatabase.__manglamDatabaseClient) {
    return globalDatabase.__manglamDatabaseClient;
  }

  const client = createDatabaseClient(options);
  if (process.env.NODE_ENV !== 'production') {
    globalDatabase.__manglamDatabaseClient = client;
  }
  return client;
}

export async function disconnectDatabaseClient(): Promise<void> {
  const client = globalDatabase.__manglamDatabaseClient;
  if (!client) {
    return;
  }

  await client.$disconnect();
  delete globalDatabase.__manglamDatabaseClient;
}

export type DatabaseClient = PrismaClient;
