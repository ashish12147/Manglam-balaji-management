import { Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import {
  HealthService,
  type ReadinessCheck,
  type ReadinessCheckResult,
} from '../../common/health/health.service.js';
import type { AppEnvironment } from '../../config/env.schema.js';

@Injectable()
export class RedisService implements OnApplicationShutdown, OnModuleInit, ReadinessCheck {
  readonly name = 'redis';
  readonly client: Redis;

  constructor(
    config: ConfigService<AppEnvironment, true>,
    private readonly health: HealthService,
  ) {
    this.client = new Redis(config.get('REDIS_URL', { infer: true }), {
      connectTimeout: config.get('REDIS_CONNECT_TIMEOUT_MS', { infer: true }),
      enableOfflineQueue: false,
      keyPrefix: config.get('REDIS_PREFIX', { infer: true }),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    this.client.on('error', () => {
      // Connection failures are surfaced by readiness without logging credentials.
    });
  }

  onModuleInit(): void {
    this.health.register(this);
  }

  async check(): Promise<ReadinessCheckResult> {
    try {
      if (this.client.status === 'wait') {
        await this.client.connect();
      }
      await this.client.ping();

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
    if (this.client.status !== 'end') {
      this.client.disconnect(false);
    }
  }
}
