import {
  DEMO_ORG_ID,
  DEMO_TOKEN_PREFIX,
  demoAuditLogs,
  demoOverview,
  demoSecurityEvents,
  demoServices,
  loadDemoStore,
  resetDemoStore,
  saveDemoStore,
} from './demo-data';

function resolveApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  // Free Vercel path: Next.js /api/* routes + Neon Postgres
  return '/api';
}

export const API_URL = resolveApiUrl();
export const FORCE_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  organizationId: string;
  userName: string;
  userEmail: string;
  demo?: boolean;
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

export function isDemoSession(session?: SessionData | null): boolean {
  const s = session ?? loadSession();
  if (!s) return false;
  return Boolean(s.demo) || s.accessToken.startsWith(DEMO_TOKEN_PREFIX) || FORCE_DEMO;
}

function createDemoSession(email: string): SessionData {
  resetDemoStore();
  loadDemoStore();
  return {
    accessToken: `${DEMO_TOKEN_PREFIX}${crypto.randomUUID()}`,
    refreshToken: `${DEMO_TOKEN_PREFIX}refresh`,
    organizationId: DEMO_ORG_ID,
    userName: 'Roushan Kumar (Demo)',
    userEmail: email || 'admin@acme.demo',
    demo: true,
  };
}

function isNetworkError(err: unknown): boolean {
  return (
    err instanceof TypeError ||
    (err instanceof Error && /failed to fetch|networkerror|load failed/i.test(err.message))
  );
}

export async function apiLogin(email: string, password: string): Promise<SessionData> {
  if (FORCE_DEMO) {
    return createDemoSession(email);
  }

  try {
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
      demo: false,
    };
  } catch (err) {
    // Live Vercel dashboard cannot reach localhost API — fall back to portfolio demo.
    if (isNetworkError(err) || FORCE_DEMO) {
      if (password.length === 0) {
        throw new Error('Password required');
      }
      return createDemoSession(email);
    }
    throw err instanceof Error ? err : new Error('Login failed');
  }
}

function demoGet<T>(path: string): T {
  const store = loadDemoStore();

  if (path === '/overview') return demoOverview as T;
  if (path === '/services') return demoServices as T;
  if (path === '/security-events') return demoSecurityEvents as T;
  if (path === '/incidents') return store.incidents as T;
  if (path === '/audit-logs') return demoAuditLogs as T;

  const incidentMatch = path.match(/^\/incidents\/([^/]+)$/);
  if (incidentMatch) {
    const id = incidentMatch[1];
    const detail = store.details[id];
    if (!detail) throw new Error('Incident not found');
    return detail as T;
  }

  const analysesMatch = path.match(/^\/incidents\/([^/]+)\/analyses$/);
  if (analysesMatch) {
    const id = analysesMatch[1];
    return (store.analyses[id] ?? []) as T;
  }

  throw new Error(`Demo path not implemented: ${path}`);
}

export async function apiGet<T>(path: string, session: SessionData): Promise<T> {
  if (isDemoSession(session)) {
    return demoGet<T>(path);
  }

  try {
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
  } catch (err) {
    if (isNetworkError(err)) {
      throw new Error(
        'API unreachable. Start the local Sentinel API on :3001, or sign in again to use portfolio demo mode.',
      );
    }
    throw err instanceof Error ? err : new Error(`Request failed: ${path}`);
  }
}

export async function apiSend<T = unknown>(
  method: string,
  path: string,
  session: SessionData,
  body?: unknown,
): Promise<T> {
  if (isDemoSession(session)) {
    return demoMutate<T>(method, path, body);
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'X-Organization-Id': session.organizationId,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = (await response.json()) as { data?: T; error?: { message?: string } };
  if (!response.ok || json.data === undefined) {
    throw new Error(json.error?.message ?? 'Request failed');
  }
  return json.data;
}

function demoMutate<T>(method: string, path: string, body?: unknown): T {
  const store = loadDemoStore();
  const payload = (body ?? {}) as Record<string, unknown>;

  if (method === 'POST' && path === '/incidents') {
    const id = `inc_demo_${crypto.randomUUID().slice(0, 8)}`;
    const row = {
      id,
      title: String(payload.title ?? 'New demo incident'),
      severity: String(payload.severity ?? 'HIGH'),
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      service: null as { id: string; name: string } | null,
      _count: { events: 1 },
    };
    store.incidents = [row, ...store.incidents];
    store.details[id] = {
      id,
      title: row.title,
      description: String(payload.description ?? 'Created in portfolio demo mode'),
      severity: row.severity,
      status: row.status,
      events: [
        {
          id: `ie_${crypto.randomUUID().slice(0, 6)}`,
          eventType: 'CREATED',
          message: 'Incident created in demo mode',
          createdAt: new Date().toISOString(),
        },
      ],
    };
    store.analyses[id] = [];
    saveDemoStore(store);
    return row as T;
  }

  const noteMatch = path.match(/^\/incidents\/([^/]+)\/notes$/);
  if (method === 'POST' && noteMatch) {
    const id = noteMatch[1];
    const detail = store.details[id];
    if (!detail) throw new Error('Incident not found');
    detail.events = [
      {
        id: `ie_${crypto.randomUUID().slice(0, 6)}`,
        eventType: 'NOTE',
        message: String(payload.message ?? ''),
        createdAt: new Date().toISOString(),
      },
      ...detail.events,
    ];
    const listItem = store.incidents.find((i) => i.id === id);
    if (listItem) listItem._count.events = detail.events.length;
    saveDemoStore(store);
    return { ok: true } as T;
  }

  const patchMatch = path.match(/^\/incidents\/([^/]+)$/);
  if (method === 'PATCH' && patchMatch) {
    const id = patchMatch[1];
    const detail = store.details[id];
    if (!detail) throw new Error('Incident not found');
    if (typeof payload.status === 'string') {
      detail.status = payload.status;
      const listItem = store.incidents.find((i) => i.id === id);
      if (listItem) listItem.status = payload.status;
      detail.events = [
        {
          id: `ie_${crypto.randomUUID().slice(0, 6)}`,
          eventType: 'STATUS',
          message: `Status set to ${payload.status}`,
          createdAt: new Date().toISOString(),
        },
        ...detail.events,
      ];
    }
    saveDemoStore(store);
    return detail as T;
  }

  const analyzeMatch = path.match(/^\/incidents\/([^/]+)\/analyze$/);
  if (method === 'POST' && analyzeMatch) {
    const id = analyzeMatch[1];
    const detail = store.details[id];
    if (!detail) throw new Error('Incident not found');
    const analysis = {
      id: `ai_${crypto.randomUUID().slice(0, 8)}`,
      model: 'heuristic-v1',
      promptVersion: 'incident-analysis-1',
      confidence: 0.7,
      createdAt: new Date().toISOString(),
      analysis: {
        summary: `Demo analysis for “${detail.title}”. Rules fired first; this summary is advisory only.`,
        observedEvidence: [
          `${detail.events.length} timeline events attached to the incident`,
          `Current severity ${detail.severity} / status ${detail.status}`,
        ],
        hypotheses: [
          'Traffic anomaly consistent with abuse or noisy client retries',
          'Config drift on a single route budget',
        ],
        recommendedActions: [
          'Verify gateway rate-limit keys for the affected route',
          'Review recent audit logs for config changes',
          'Keep AI output read-only — do not auto-remediate',
        ],
        uncertainty: ['Portfolio demo has no live telemetry stream'],
      },
      readOnly: true,
      disclaimer:
        'AI recommendations are advisory only and never execute security actions automatically.',
    };
    store.analyses[id] = [analysis, ...(store.analyses[id] ?? [])];
    saveDemoStore(store);
    return { queued: true } as T;
  }

  throw new Error(`Demo mutation not implemented: ${method} ${path}`);
}
