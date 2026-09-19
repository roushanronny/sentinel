import { describe, expect, it } from 'vitest';
import {
  createOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  slugifyOrganizationName,
  verifyPassword,
} from './crypto.js';

describe('@sentinel/auth crypto', () => {
  it('hashes and verifies passwords with argon2id', async () => {
    const hash = await hashPassword('correct-horse-battery');
    expect(hash).not.toContain('correct-horse-battery');
    await expect(verifyPassword(hash, 'correct-horse-battery')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('hashes opaque tokens stably', () => {
    const token = createOpaqueToken();
    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
    expect(hashOpaqueToken(token)).not.toBe(token);
  });

  it('creates organization slugs', () => {
    const slug = slugifyOrganizationName('Acme Security Labs');
    expect(slug.startsWith('acme-security-labs-')).toBe(true);
  });
});
