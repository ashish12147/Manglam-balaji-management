import { Module } from '@nestjs/common';

import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  controllers: [HealthController],
  exports: [HealthService],
  providers: [HealthService],
})
export class HealthModule {}
