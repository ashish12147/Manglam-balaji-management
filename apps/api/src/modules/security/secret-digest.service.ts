import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppEnvironment } from '../../config/env.schema.js';
import { secretDigest } from './secrets.js';

@Injectable()
export class SecretDigestService {
  private readonly otpSecret: string;
  private readonly refreshSecret: string;
  private readonly visitorSecret: string;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.otpSecret = config.get('OTP_HMAC_SECRET', { infer: true });
    this.refreshSecret = config.get('REFRESH_TOKEN_PEPPER', { infer: true });
    this.visitorSecret = config.get('VISITOR_CODE_HMAC_SECRET', { infer: true });
  }

  deviceFingerprint(fingerprint: string, societyId: string): string {
    return secretDigest(fingerprint, ['device', societyId], this.refreshSecret);
  }

  deviceNonce(nonce: string, societyId: string): string {
    return secretDigest(nonce, ['device-nonce', societyId], this.otpSecret);
  }

  phone(phoneE164: string, societyId: string): string {
    return secretDigest(phoneE164, ['phone', societyId], this.otpSecret);
  }

  requestIp(ipAddress: string): string {
    return secretDigest(ipAddress, ['request-ip'], this.otpSecret);
  }

  refreshToken(token: string, familyId: string): string {
    return secretDigest(token, ['refresh-token', familyId], this.refreshSecret);
  }

  visitorCode(code: string, societyId: string): string {
    return secretDigest(code.toUpperCase(), ['visitor-code', societyId], this.visitorSecret);
  }
}
