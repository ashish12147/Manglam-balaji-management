import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AccessModule } from '../access/access.module.js';
import { PlatformModule } from '../platform/platform.module.js';
import { SecurityModule } from '../security/security.module.js';
import { AuthController, CurrentUserController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';

@Module({
  controllers: [AuthController, CurrentUserController],
  exports: [AuthService, SessionService],
  imports: [AccessModule, DatabaseModule, PlatformModule, SecurityModule],
  providers: [AuthService, SessionService],
})
export class AuthModule {}
