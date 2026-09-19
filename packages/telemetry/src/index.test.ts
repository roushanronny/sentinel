import { describe, expect, it } from 'vitest';
import { initTelemetry, withSpan } from './index.js';

describe('@sentinel/telemetry', () => {
  it('creates tracer and records a span', async () => {
    const { tracer } = initTelemetry('sentinel-test');
    const value = await withSpan(tracer, 'test.span', { component: 'unit' }, async () => 42);
    expect(value).toBe(42);
  });
});
