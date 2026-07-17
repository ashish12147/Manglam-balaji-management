import { Module } from '@nestjs/common';

import { AccessTokenService } from './access-token.service.js';
import { PasswordHasher } from './password-hasher.js';
import { SecretDigestService } from './secret-digest.service.js';

@Module({
  exports: [AccessTokenService, PasswordHasher, SecretDigestService],
  providers: [AccessTokenService, PasswordHasher, SecretDigestService],
})
export class SecurityModule {}
