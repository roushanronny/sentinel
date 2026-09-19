import amqp, { type Channel, type ChannelModel, type ConsumeMessage } from 'amqplib';
import {
  AI_ANALYSIS_DLQ,
  AI_ANALYSIS_EXCHANGE,
  AI_ANALYSIS_QUEUE,
  AI_ANALYSIS_ROUTING_KEY,
  SECURITY_EVENTS_DLQ,
  SECURITY_EVENTS_EXCHANGE,
  SECURITY_EVENTS_QUEUE,
  SECURITY_EVENTS_ROUTING_KEY,
  type AiAnalysisMessage,
  type MessageConsumer,
  type MessagePublisher,
  type SecurityEventMessage,
} from './types.js';

export const SECURITY_EVENTS_ANALYTICS_QUEUE = 'sentinel.security.events.analytics.q';

async function assertTopology(channel: Channel): Promise<void> {
  await channel.assertExchange(SECURITY_EVENTS_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(SECURITY_EVENTS_DLQ, { durable: true });
  await channel.assertQueue(SECURITY_EVENTS_QUEUE, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': SECURITY_EVENTS_DLQ,
    },
  });
  await channel.assertQueue(SECURITY_EVENTS_ANALYTICS_QUEUE, { durable: true });
  await channel.bindQueue(
    SECURITY_EVENTS_QUEUE,
    SECURITY_EVENTS_EXCHANGE,
    SECURITY_EVENTS_ROUTING_KEY,
  );
  await channel.bindQueue(
    SECURITY_EVENTS_ANALYTICS_QUEUE,
    SECURITY_EVENTS_EXCHANGE,
    SECURITY_EVENTS_ROUTING_KEY,
  );

  await channel.assertExchange(AI_ANALYSIS_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(AI_ANALYSIS_DLQ, { durable: true });
  await channel.assertQueue(AI_ANALYSIS_QUEUE, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': AI_ANALYSIS_DLQ,
    },
  });
  await channel.bindQueue(AI_ANALYSIS_QUEUE, AI_ANALYSIS_EXCHANGE, AI_ANALYSIS_ROUTING_KEY);
}

export class RabbitMqPublisher implements MessagePublisher {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private readonly url: string) {}

  async connect(): Promise<void> {
    await this.ensureChannel();
  }

  private async ensureChannel(): Promise<Channel> {
    if (this.channel) return this.channel;
    this.connection = await amqp.connect(this.url);
    this.channel = await this.connection.createChannel();
    await assertTopology(this.channel);
    return this.channel;
  }

  async publishSecurityEvent(message: SecurityEventMessage): Promise<void> {
    const channel = await this.ensureChannel();
    const payload = Buffer.from(JSON.stringify(message));
    const ok = channel.publish(SECURITY_EVENTS_EXCHANGE, SECURITY_EVENTS_ROUTING_KEY, payload, {
      persistent: true,
      contentType: 'application/json',
      messageId: message.idempotencyKey,
      headers: {
        idempotencyKey: message.idempotencyKey,
      },
    });
    if (!ok) {
      throw new Error('RabbitMQ publish buffer full');
    }
  }

  async publishAiAnalysis(message: AiAnalysisMessage): Promise<void> {
    const channel = await this.ensureChannel();
    const payload = Buffer.from(JSON.stringify(message));
    const ok = channel.publish(AI_ANALYSIS_EXCHANGE, AI_ANALYSIS_ROUTING_KEY, payload, {
      persistent: true,
      contentType: 'application/json',
      messageId: message.idempotencyKey,
      headers: {
        idempotencyKey: message.idempotencyKey,
      },
    });
    if (!ok) {
      throw new Error('RabbitMQ publish buffer full');
    }
  }

  async close(): Promise<void> {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
    this.channel = null;
    this.connection = null;
  }
}

export class RabbitMqConsumer implements MessageConsumer {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(
    private readonly url: string,
    private readonly queueName: string = SECURITY_EVENTS_QUEUE,
  ) {}

  async start(handler: (message: SecurityEventMessage) => Promise<void>): Promise<void> {
    this.connection = await amqp.connect(this.url);
    this.channel = await this.connection.createChannel();
    await assertTopology(this.channel);
    await this.channel.prefetch(10);

    await this.channel.consume(this.queueName, (msg) => {
      void this.handleMessage(msg, handler);
    });
  }

  private async handleMessage(
    msg: ConsumeMessage | null,
    handler: (message: SecurityEventMessage) => Promise<void>,
  ): Promise<void> {
    if (!msg || !this.channel) return;

    try {
      const parsed = JSON.parse(msg.content.toString('utf8')) as SecurityEventMessage;
      await handler(parsed);
      this.channel.ack(msg);
    } catch {
      if (this.queueName !== SECURITY_EVENTS_QUEUE) {
        // Analytics/observer queues: drop poison messages after logging via nack without requeue.
        this.channel.nack(msg, false, false);
        return;
      }

      const retries = Number(msg.properties.headers?.['x-retry'] ?? 0);
      if (retries >= 3) {
        this.channel.nack(msg, false, false);
        return;
      }

      const headers = { ...(msg.properties.headers ?? {}), 'x-retry': retries + 1 };
      this.channel.publish('', this.queueName, msg.content, {
        ...msg.properties,
        headers,
        persistent: true,
      });
      this.channel.ack(msg);
    }
  }

  async close(): Promise<void> {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
    this.channel = null;
    this.connection = null;
  }
}

export class InMemoryPublisher implements MessagePublisher {
  readonly messages: SecurityEventMessage[] = [];
  readonly aiMessages: AiAnalysisMessage[] = [];
  private handler: ((message: SecurityEventMessage) => Promise<void>) | null = null;
  private aiHandler: ((message: AiAnalysisMessage) => Promise<void>) | null = null;

  setHandler(handler: (message: SecurityEventMessage) => Promise<void>): void {
    this.handler = handler;
  }

  setAiHandler(handler: (message: AiAnalysisMessage) => Promise<void>): void {
    this.aiHandler = handler;
  }

  async publishSecurityEvent(message: SecurityEventMessage): Promise<void> {
    this.messages.push(message);
    if (this.handler) {
      await this.handler(message);
    }
  }

  async publishAiAnalysis(message: AiAnalysisMessage): Promise<void> {
    this.aiMessages.push(message);
    if (this.aiHandler) {
      await this.aiHandler(message);
    }
  }

  async close(): Promise<void> {
    this.handler = null;
    this.aiHandler = null;
  }
}

export class RabbitMqAiConsumer {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private readonly url: string) {}

  async start(handler: (message: AiAnalysisMessage) => Promise<void>): Promise<void> {
    this.connection = await amqp.connect(this.url);
    this.channel = await this.connection.createChannel();
    await assertTopology(this.channel);
    await this.channel.prefetch(5);

    await this.channel.consume(AI_ANALYSIS_QUEUE, (msg) => {
      void this.handleMessage(msg, handler);
    });
  }

  private async handleMessage(
    msg: ConsumeMessage | null,
    handler: (message: AiAnalysisMessage) => Promise<void>,
  ): Promise<void> {
    if (!msg || !this.channel) return;
    try {
      const parsed = JSON.parse(msg.content.toString('utf8')) as AiAnalysisMessage;
      await handler(parsed);
      this.channel.ack(msg);
    } catch {
      const retries = Number(msg.properties.headers?.['x-retry'] ?? 0);
      if (retries >= 3) {
        this.channel.nack(msg, false, false);
        return;
      }
      const headers = { ...(msg.properties.headers ?? {}), 'x-retry': retries + 1 };
      this.channel.publish('', AI_ANALYSIS_QUEUE, msg.content, {
        ...msg.properties,
        headers,
        persistent: true,
      });
      this.channel.ack(msg);
    }
  }

  async close(): Promise<void> {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
    this.channel = null;
    this.connection = null;
  }
}

export * from './types.js';
