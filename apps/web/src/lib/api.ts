export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  organizationId: string;
  userName: string;
  userEmail: string;
}

const SESSION_KEY = 'sentinel.session';

export function saveSession(data: SessionData): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function loadSession(): SessionData | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export async function apiLogin(email: string, password: string): Promise<SessionData> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const body = (await response.json()) as {
    data?: {
      tokens: { accessToken: string; refreshToken: string };
      user: { name: string; email: string };
      organization: { id: string; name: string } | null;
    };
    error?: { message?: string };
  };

  if (!response.ok || !body.data?.organization) {
    throw new Error(body.error?.message ?? 'Login failed');
  }

  return {
    accessToken: body.data.tokens.accessToken,
    refreshToken: body.data.tokens.refreshToken,
    organizationId: body.data.organization.id,
    userName: body.data.user.name,
    userEmail: body.data.user.email,
  };
}

export async function apiGet<T>(path: string, session: SessionData): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'X-Organization-Id': session.organizationId,
    },
  });

  const body = (await response.json()) as { data?: T; error?: { message?: string } };
  if (!response.ok || body.data === undefined) {
    throw new Error(body.error?.message ?? `Request failed: ${path}`);
  }
  return body.data;
}
