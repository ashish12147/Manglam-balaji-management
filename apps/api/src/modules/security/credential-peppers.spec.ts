import { describe, expect, it } from 'vitest';

import { validateCredentialPeppers } from './credential-peppers.js';

const valid = {
  ADMIN_PASSWORD_PEPPER: 'a'.repeat(32),
  GUARD_PIN_PEPPER: 'g'.repeat(32),
  RESIDENT_APP_PIN_PEPPER: 'r'.repeat(32),
};

describe('credential pepper configuration', () => {
  it('maps each purpose to its dedicated pepper', () => {
    expect(validateCredentialPeppers(valid)).toEqual({
      ADMIN_PASSWORD: valid.ADMIN_PASSWORD_PEPPER,
      GUARD_PIN: valid.GUARD_PIN_PEPPER,
      RESIDENT_APP_PIN: valid.RESIDENT_APP_PIN_PEPPER,
    });
  });

  it('fails closed when any pepper is missing', () => {
    expect(() =>
      validateCredentialPeppers({
        ADMIN_PASSWORD_PEPPER: valid.ADMIN_PASSWORD_PEPPER,
        GUARD_PIN_PEPPER: valid.GUARD_PIN_PEPPER,
      }),
    ).toThrow(/RESIDENT_APP_PIN_PEPPER/);
  });

  it('rejects reused pepper material across credential classes', () => {
    expect(() =>
      validateCredentialPeppers({
        ...valid,
        GUARD_PIN_PEPPER: valid.ADMIN_PASSWORD_PEPPER,
      }),
    ).toThrow(/distinct/);
  });
});
