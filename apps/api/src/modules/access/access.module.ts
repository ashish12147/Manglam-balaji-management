import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { SecurityModule } from '../security/security.module.js';
import { AccessSessionGuard } from './access-session.guard.js';
import { AuthorizationService } from './authorization.service.js';
import { CurrentIdentityService } from './current-identity.service.js';
import { PermissionGuard } from './permission.guard.js';

@Module({
  exports: [
    AccessSessionGuard,
    AuthorizationService,
    CurrentIdentityService,
    PermissionGuard,
  ],
  imports: [DatabaseModule, SecurityModule],
  providers: [
    AccessSessionGuard,
    AuthorizationService,
    CurrentIdentityService,
    PermissionGuard,
  ],
})
export class AccessModule {}
