import type { CredentialPurpose } from './credential-hash.js';

export const CREDENTIAL_PEPPER_KEYS = {
  ADMIN_PASSWORD: 'ADMIN_PASSWORD_PEPPER',
  GUARD_PIN: 'GUARD_PIN_PEPPER',
  RESIDENT_APP_PIN: 'RESIDENT_APP_PIN_PEPPER',
} as const satisfies Readonly<Record<CredentialPurpose, string>>;

export type CredentialPeppers = Readonly<Record<CredentialPurpose, string>>;

export function validateCredentialPeppers(
  input: Partial<Record<(typeof CREDENTIAL_PEPPER_KEYS)[CredentialPurpose], string>>,
): CredentialPeppers {
  const peppers = Object.fromEntries(
    Object.entries(CREDENTIAL_PEPPER_KEYS).map(([purpose, key]) => {
      const value = input[key];
      if (!value || value.length < 32 || value.length > 512) {
        throw new Error(`${key} must contain between 32 and 512 characters.`);
      }
      return [purpose, value];
    }),
  ) as Record<CredentialPurpose, string>;

  if (new Set(Object.values(peppers)).size !== Object.keys(peppers).length) {
    throw new Error('Credential peppers must be distinct for every credential purpose.');
  }
  return Object.freeze(peppers);
}
