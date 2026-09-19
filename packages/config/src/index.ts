import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1).default('postgresql://sentinel:sentinel@localhost:5432/sentinel?schema=public'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  RABBITMQ_URL: z.string().min(1).default('amqp://guest:guest@localhost:5672'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  GATEWAY_HOST: z.string().default('0.0.0.0'),
  GATEWAY_PORT: z.coerce.number().int().positive().default(3000),
  DEMO_SERVICE_HOST: z.string().default('0.0.0.0'),
  DEMO_SERVICE_PORT: z.coerce.number().int().positive().default(3002),
  JWT_ACCESS_SECRET: z.string().min(32).default('change-me-access-secret-min-32-chars!!'),
  JWT_REFRESH_SECRET: z.string().min(32).default('change-me-refresh-secret-min-32-chars!'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  AI_PROVIDER: z.enum(['heuristic', 'openai']).default('heuristic'),
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().optional(),
  AI_MODEL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Railway/Render/Fly set PORT; map it onto API_PORT when unset.
  const normalized = { ...source };
  if (!normalized.API_PORT && normalized.PORT) {
    normalized.API_PORT = normalized.PORT;
  }
  const parsed = envSchema.safeParse(normalized);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${message}`);
  }
  return parsed.data;
}
