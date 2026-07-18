import { Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDatabaseClient, Prisma, type DatabaseClient } from '@manglam/database';

import {
  HealthService,
  type ReadinessCheck,
  type ReadinessCheckResult,
} from '../../common/health/health.service.js';
import type { AppEnvironment } from '../../config/env.schema.js';

@Injectable()
export class DatabaseService implements OnApplicationShutdown, OnModuleInit, ReadinessCheck {
  readonly name = 'database';
  readonly client: DatabaseClient;

  constructor(
    config: ConfigService<AppEnvironment, true>,
    private readonly health: HealthService,
  ) {
    this.client = createDatabaseClient({
      applicationName: 'manglam-api',
      connectionString: config.get('DATABASE_URL', { infer: true }),
      connectionTimeoutMs: config.get('DB_CONNECTION_TIMEOUT_MS', { infer: true }),
      poolMax: config.get('DB_POOL_MAX', { infer: true }),
      statementTimeoutMs: config.get('DB_STATEMENT_TIMEOUT_MS', { infer: true }),
    });
  }

  onModuleInit(): void {
    this.health.register(this);
  }

  async check(): Promise<ReadinessCheckResult> {
    try {
      await this.client.$queryRaw(Prisma.sql`SELECT 1`);

      return {
        healthy: true,
        name: this.name,
      };
    } catch {
      return {
        details: { reason: 'connection_unavailable' },
        healthy: false,
        name: this.name,
      };
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.$disconnect();
  }
}
