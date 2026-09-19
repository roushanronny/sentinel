export const SECURITY_EVENTS_EXCHANGE = 'sentinel.security.events';
export const SECURITY_EVENTS_QUEUE = 'sentinel.security.events.q';
export const SECURITY_EVENTS_DLQ = 'sentinel.security.events.dlq';
export const SECURITY_EVENTS_ROUTING_KEY = 'security.event';

export const AI_ANALYSIS_EXCHANGE = 'sentinel.ai.analysis';
export const AI_ANALYSIS_QUEUE = 'sentinel.ai.analysis.q';
export const AI_ANALYSIS_DLQ = 'sentinel.ai.analysis.dlq';
export const AI_ANALYSIS_ROUTING_KEY = 'ai.analyze';

export interface SecurityEventMessage {
  idempotencyKey: string;
  organizationId: string;
  serviceId?: string;
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  sourceIp?: string;
  requestId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  occurredAt: string;
}

export interface AiAnalysisMessage {
  idempotencyKey: string;
  organizationId: string;
  incidentId: string;
  requestedByUserId: string;
  requestedAt: string;
}

export interface MessagePublisher {
  publishSecurityEvent(message: SecurityEventMessage): Promise<void>;
  publishAiAnalysis?(message: AiAnalysisMessage): Promise<void>;
  close(): Promise<void>;
}

export interface MessageConsumer {
  start(handler: (message: SecurityEventMessage) => Promise<void>): Promise<void>;
  close(): Promise<void>;
}
