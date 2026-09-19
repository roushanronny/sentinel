import type { FastifyInstance } from 'fastify';

export async function registerCors(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    const allowed = new Set(['http://localhost:3003', 'http://127.0.0.1:3003']);

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
