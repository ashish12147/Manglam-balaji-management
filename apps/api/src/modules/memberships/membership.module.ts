import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AccessModule } from '../access/access.module.js';
import { PlatformModule } from '../platform/platform.module.js';
import { MembershipController } from './membership.controller.js';
import { MembershipService } from './membership.service.js';

@Module({
  controllers: [MembershipController],
  exports: [MembershipService],
  imports: [AccessModule, DatabaseModule, PlatformModule],
  providers: [MembershipService],
})
export class MembershipModule {}
