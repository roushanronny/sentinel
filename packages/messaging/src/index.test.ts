import { describe, expect, it } from 'vitest';
import { InMemoryPublisher, type SecurityEventMessage } from './index.js';

describe('@sentinel/messaging', () => {
  it('publishes security events in memory', async () => {
    const publisher = new InMemoryPublisher();
    const received: SecurityEventMessage[] = [];
    publisher.setHandler(async (message) => {
      received.push(message);
    });

    await publisher.publishSecurityEvent({
      idempotencyKey: 'evt-1',
      organizationId: 'org-1',
      eventType: 'AUTH_FAILURE',
      severity: 'MEDIUM',
      description: 'test',
      occurredAt: new Date().toISOString(),
    });

    expect(publisher.messages).toHaveLength(1);
    expect(received[0]?.idempotencyKey).toBe('evt-1');
  });
});
