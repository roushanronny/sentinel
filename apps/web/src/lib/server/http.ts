import { NextResponse } from 'next/server';

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function jsonError(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function mapAuthError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'Request failed';
  if (message === 'INVALID_CREDENTIALS') {
    return jsonError(message, 'Invalid email or password', 401);
  }
  if (message === 'UNAUTHORIZED' || message === 'SESSION_REVOKED') {
    return jsonError('UNAUTHORIZED', 'Unauthorized', 401);
  }
  if (message === 'ORG_REQUIRED') {
    return jsonError(message, 'Organization context is required', 400);
  }
  if (message === 'FORBIDDEN') {
    return jsonError(message, 'Forbidden', 403);
  }
  if (message === 'NOT_FOUND') {
    return jsonError(message, 'Not found', 404);
  }
  console.error(error);
  return jsonError('INTERNAL', 'Internal server error', 500);
}
