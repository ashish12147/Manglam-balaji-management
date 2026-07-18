import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AccessModule } from '../access/access.module.js';
import { PlatformModule } from '../platform/platform.module.js';
import { SecurityModule } from '../security/security.module.js';
import { AdminAuthService } from './admin-auth.service.js';
import {
  AuthController,
  CurrentUserController,
  SessionAliasController,
} from './auth.controller.js';
import { AuthReplayService } from './auth-replay.service.js';
import { AuthSocietyService } from './auth-society.service.js';
import { AuthService } from './auth.service.js';
import { CredentialAttemptService } from './credential-attempt.service.js';
import { CurrentUserService } from './current-user.service.js';
import { GuardAuthService } from './guard-auth.service.js';
import { DatabaseTotpMfaVerifier } from './mfa-verifier.js';
import { RefreshCookieService } from './refresh-cookie.service.js';
import { ResidentPinService } from './resident-pin.service.js';
import { SessionService } from './session.service.js';

@Module({
  controllers: [AuthController, CurrentUserController, SessionAliasController],
  exports: [AuthService, CurrentUserService, SessionService],
  imports: [AccessModule, DatabaseModule, PlatformModule, SecurityModule],
  providers: [
    AdminAuthService,
    AuthReplayService,
    AuthSocietyService,
    AuthService,
    CredentialAttemptService,
    CurrentUserService,
    DatabaseTotpMfaVerifier,
    GuardAuthService,
    RefreshCookieService,
    ResidentPinService,
    SessionService,
  ],
})
export class AuthModule {}
