import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppEnvironment } from '../../config/env.schema.js';
import { hashCredential, verifyCredential, type CredentialPurpose } from './credential-hash.js';

export { CREDENTIAL_PURPOSES, type CredentialPurpose } from './credential-hash.js';

@Injectable()
export class PasswordHasher {
  private readonly pepper: string;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.pepper = config.get('APP_PIN_PEPPER', { infer: true });
  }

  hash(value: string, purpose: CredentialPurpose): Promise<string> {
    return hashCredential(value, purpose, this.pepper);
  }

  verify(value: string, encoded: string, purpose: CredentialPurpose): Promise<boolean> {
    return verifyCredential(value, encoded, purpose, this.pepper);
  }
}
