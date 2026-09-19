import pino, { type Logger, type LoggerOptions } from 'pino';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'authorization',
  'cookie',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'api_key',
  'secret',
  'jwt',
]);

function redactKeys(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactKeys(item, depth + 1));
  }

  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(key.toLowerCase())) {
        output[key] = '[REDACTED]';
      } else {
        output[key] = redactKeys(nested, depth + 1);
      }
    }
    return output;
  }

  return value;
}

export interface CreateLoggerOptions {
  service: string;
  level?: string;
}

export function createLogger(options: CreateLoggerOptions): Logger {
  const loggerOptions: LoggerOptions = {
    name: options.service,
    level: options.level ?? 'info',
    base: {
      service: options.service,
    },
    redact: {
      paths: [
        'password',
        'req.headers.authorization',
        'req.headers.cookie',
        'headers.authorization',
        'headers.cookie',
        'accessToken',
        'refreshToken',
        'apiKey',
        'token',
        'secret',
      ],
      censor: '[REDACTED]',
    },
  };

  return pino(loggerOptions);
}

export function safeLogFields(fields: Record<string, unknown>): Record<string, unknown> {
  return redactKeys(fields) as Record<string, unknown>;
}

export type { Logger };
