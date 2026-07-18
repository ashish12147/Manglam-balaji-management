import { Global, Module } from '@nestjs/common';

import { HealthModule } from '../../common/health/health.module.js';
import { DatabaseService } from './database.service.js';

@Global()
@Module({
  exports: [DatabaseService],
  imports: [HealthModule],
  providers: [DatabaseService],
})
export class DatabaseModule {}
