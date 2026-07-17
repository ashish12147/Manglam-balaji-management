import { describe, expect, it } from 'vitest';

import { hashCredential, verifyCredential } from './credential-hash.js';

const PEPPER = 'test-pepper-that-is-at-least-thirty-two-characters-long';

describe('Argon2id credential hashing', () => {
  it('hashes and verifies with the pinned parameters and purpose', async () => {
    const encoded = await hashCredential('correct horse battery staple', 'ADMIN_PASSWORD', PEPPER);

    expect(encoded).toMatch(/^argon2id\$v=1\$purpose=ADMIN_PASSWORD\$m=65536,t=3,p=1,l=32\$/);
    await expect(
      verifyCredential('correct horse battery staple', encoded, 'ADMIN_PASSWORD', PEPPER),
    ).resolves.toBe(true);
  });

  it('rejects a wrong credential', async () => {
    const encoded = await hashCredential('correct horse battery staple', 'ADMIN_PASSWORD', PEPPER);

    await expect(
      verifyCredential('incorrect horse battery staple', encoded, 'ADMIN_PASSWORD', PEPPER),
    ).resolves.toBe(false);
  });

  it.each([
    'argon2id$broken',
    'argon2id$v=1$purpose=ADMIN_PASSWORD$m=65536,t=3,p=1,l=32$not-base64!$also-not-base64!',
  ])('rejects malformed encoded credentials', async (encoded) => {
    await expect(
      verifyCredential('correct horse battery staple', encoded, 'ADMIN_PASSWORD', PEPPER),
    ).resolves.toBe(false);
  });

  it('rejects parameter downgrade attempts', async () => {
    const encoded = await hashCredential('correct horse battery staple', 'ADMIN_PASSWORD', PEPPER);
    const downgraded = encoded.replace('m=65536,t=3,p=1,l=32', 'm=32768,t=2,p=1,l=32');

    await expect(
      verifyCredential('correct horse battery staple', downgraded, 'ADMIN_PASSWORD', PEPPER),
    ).resolves.toBe(false);
  });

  it('rejects hashes transplanted across credential purposes', async () => {
    const encoded = await hashCredential('123456', 'GUARD_PIN', PEPPER);

    await expect(verifyCredential('123456', encoded, 'GUARD_PIN', PEPPER)).resolves.toBe(true);
    await expect(verifyCredential('123456', encoded, 'RESIDENT_APP_PIN', PEPPER)).resolves.toBe(
      false,
    );
  });
});
