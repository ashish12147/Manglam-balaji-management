import { Global, Module } from '@nestjs/common';

import { HealthModule } from '../../common/health/health.module.js';
import { RedisService } from './redis.service.js';

@Global()
@Module({
  exports: [RedisService],
  imports: [HealthModule],
  providers: [RedisService],
})
export class RedisModule {}
