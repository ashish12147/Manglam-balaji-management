import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { HealthModule } from './common/health/health.module.js';
import { parseEnvironment } from './config/env.schema.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { OtpModule } from './infrastructure/otp/otp.module.js';
import { PushModule } from './infrastructure/push/push.module.js';
import { RedisModule } from './infrastructure/redis/redis.module.js';
import { StorageModule } from './infrastructure/storage/storage.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      expandVariables: false,
      isGlobal: true,
      validate: parseEnvironment,
    }),
    ThrottlerModule.forRoot([
      {
        limit: 120,
        name: 'default',
        ttl: 60_000,
      },
    ]),
    HealthModule,
    DatabaseModule,
    OtpModule,
    PushModule,
    RedisModule,
    StorageModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
