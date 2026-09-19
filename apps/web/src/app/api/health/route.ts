import { jsonOk } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function GET() {
  return jsonOk({
    status: 'ok',
    service: 'sentinel-web-api',
    mode: 'vercel-neon-free',
  });
}
