const SENSITIVE_KEY_PATTERN =
  /(password|passwd|secret|token|authorization|api[_-]?key|refresh|cookie|jwt|credential)/i;

const SENSITIVE_VALUE_PATTERN =
  /(Bearer\s+[A-Za-z0-9\-._~+/]+=*|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|sk-[A-Za-z0-9]{10,}|sen_[A-Za-z0-9_]{8,})/g;

export function redactText(input: string): string {
  return input.replace(SENSITIVE_VALUE_PATTERN, '[REDACTED]');
}

export function redactUnknown(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || value === undefined) return value;
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map((item) => redactUnknown(item, depth + 1));
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        output[key] = '[REDACTED]';
      } else {
        output[key] = redactUnknown(nested, depth + 1);
      }
    }
    return output;
  }
  return value;
}

export function assertNoSecrets(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  if (SENSITIVE_VALUE_PATTERN.test(serialized)) {
    throw new Error('Sanitized AI context still contains secret-like values');
  }
}
