import { loginSchema, loginUser } from '@/lib/server/auth';
import { jsonError, jsonOk, mapAuthError } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid login payload', 400);
    }
    const data = await loginUser(parsed.data.email, parsed.data.password, {
      ua: request.headers.get('user-agent') ?? undefined,
    });
    return jsonOk(data);
  } catch (error) {
    return mapAuthError(error);
  }
}
