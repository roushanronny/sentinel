import { describe, expect, it } from 'vitest';
import { safeLogFields } from './index.js';

describe('safeLogFields', () => {
  it('redacts sensitive keys', () => {
    const result = safeLogFields({
      email: 'admin@example.com',
      password: 'super-secret',
      token: 'abc.def.ghi',
      nested: { apiKey: 'sk-test', route: '/users' },
    });

    expect(result.email).toBe('admin@example.com');
    expect(result.password).toBe('[REDACTED]');
    expect(result.token).toBe('[REDACTED]');
    expect((result.nested as Record<string, unknown>).apiKey).toBe('[REDACTED]');
    expect((result.nested as Record<string, unknown>).route).toBe('/users');
  });
});
