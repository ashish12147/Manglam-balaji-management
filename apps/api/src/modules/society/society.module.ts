import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AccessModule } from '../access/access.module.js';
import { PlatformModule } from '../platform/platform.module.js';
import { SocietyController } from './society.controller.js';
import { SocietyService } from './society.service.js';

@Module({
  controllers: [SocietyController],
  exports: [SocietyService],
  imports: [AccessModule, DatabaseModule, PlatformModule],
  providers: [SocietyService],
})
export class SocietyModule {}
