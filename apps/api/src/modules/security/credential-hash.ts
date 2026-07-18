export {
  hashCredential,
  verifyCredential,
  type CredentialPurpose,
} from '@manglam/database';

export const CREDENTIAL_PURPOSES = [
  'ADMIN_PASSWORD',
  'GUARD_PIN',
  'RESIDENT_APP_PIN',
] as const;
