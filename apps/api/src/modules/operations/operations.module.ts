import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AccessModule } from '../access/access.module.js';
import { PlatformModule } from '../platform/platform.module.js';
import { OperationsController } from './operations.controller.js';
import { OperationsService } from './operations.service.js';

@Module({
  controllers: [OperationsController],
  exports: [OperationsService],
  imports: [AccessModule, DatabaseModule, PlatformModule],
  providers: [OperationsService],
})
export class OperationsModule {}
