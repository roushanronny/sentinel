import type { FastifyInstance } from 'fastify';

function allowedOrigins(): Set<string> {
  const defaults = [
    'http://localhost:3003',
    'http://127.0.0.1:3003',
    'https://sentinel-chi-plum.vercel.app',
    'https://sentinel-roushan-kumars-projects-97d60324.vercel.app',
  ];
  const extra = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set([...defaults, ...extra]);
}

export async function registerCors(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    const allowed = allowedOrigins();

    if (origin && allowed.has(origin)) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Credentials', 'true');
      reply.header(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type, X-Organization-Id, X-Request-Id',
      );
      reply.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    }

    if (request.method === 'OPTIONS') {
      return reply.code(204).send();
    }
  });
}
