import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { hashCredential, verifyCredential, type CredentialPurpose } from './credential-hash.js';
import {
  CREDENTIAL_PEPPER_KEYS,
  type CredentialPeppers,
  validateCredentialPeppers,
} from './credential-peppers.js';

export { CREDENTIAL_PURPOSES, type CredentialPurpose } from './credential-hash.js';

@Injectable()
export class PasswordHasher {
  private readonly peppers: CredentialPeppers;

  constructor(config: ConfigService<Record<string, string | undefined>, false>) {
    this.peppers = validateCredentialPeppers({
      ADMIN_PASSWORD_PEPPER: config.get(CREDENTIAL_PEPPER_KEYS.ADMIN_PASSWORD),
      GUARD_PIN_PEPPER: config.get(CREDENTIAL_PEPPER_KEYS.GUARD_PIN),
      RESIDENT_APP_PIN_PEPPER: config.get(CREDENTIAL_PEPPER_KEYS.RESIDENT_APP_PIN),
    });
  }

  hash(value: string, purpose: CredentialPurpose): Promise<string> {
    return hashCredential(value, purpose, this.peppers[purpose]);
  }

  verify(value: string, encoded: string, purpose: CredentialPurpose): Promise<boolean> {
    return verifyCredential(value, encoded, purpose, this.peppers[purpose]);
  }
}
