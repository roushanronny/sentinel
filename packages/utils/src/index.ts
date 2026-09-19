import { randomUUID } from 'node:crypto';

const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export function createRequestId(): string {
  return randomUUID();
}

export function resolveRequestId(incoming?: string | string[]): string {
  const value = Array.isArray(incoming) ? incoming[0] : incoming;
  if (value && REQUEST_ID_PATTERN.test(value)) {
    return value;
  }
  return createRequestId();
}

export function getRequestIdHeaderName(): string {
  return REQUEST_ID_HEADER;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
