/** Portfolio demo dataset when the control-plane API is unreachable (e.g. Vercel without backend). */

export const DEMO_ORG_ID = 'org_demo_acme';
export const DEMO_TOKEN_PREFIX = 'demo.';

export const demoOverview = {
  services: 2,
  openSecurityEvents: 3,
  openIncidents: 1,
  recentSecurityEvents: [
    {
      id: 'evt_demo_1',
      eventType: 'RATE_LIMIT_EXCEEDED',
      severity: 'HIGH',
      description: 'Burst of 429s on /payments from 203.0.113.44',
      createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      status: 'OPEN',
    },
    {
      id: 'evt_demo_2',
      eventType: 'AUTH_FAILURE_SPIKE',
      severity: 'MEDIUM',
      description: 'Elevated login failures for tenant acme.demo',
      createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
      status: 'OPEN',
    },
    {
      id: 'evt_demo_3',
      eventType: 'SSRF_BLOCKED',
      severity: 'HIGH',
      description: 'Blocked upstream URL pointing at private network range',
      createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      status: 'OPEN',
    },
  ],
};

export const demoServices = [
  {
    id: 'svc_demo_payments',
    name: 'payments-api',
    environment: 'production',
    status: 'ACTIVE',
    upstreamUrl: 'https://demo-upstream.internal/payments',
    _count: { routes: 4 },
  },
  {
    id: 'svc_demo_users',
    name: 'users-api',
    environment: 'staging',
    status: 'ACTIVE',
    upstreamUrl: 'https://demo-upstream.internal/users',
    _count: { routes: 3 },
  },
];

export const demoSecurityEvents = [
  {
    id: 'evt_demo_1',
    eventType: 'RATE_LIMIT_EXCEEDED',
    severity: 'HIGH',
    status: 'OPEN',
    description: 'Burst of 429s on /payments from 203.0.113.44',
    sourceIp: '203.0.113.44',
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: 'evt_demo_2',
    eventType: 'AUTH_FAILURE_SPIKE',
    severity: 'MEDIUM',
    status: 'OPEN',
    description: 'Elevated login failures for tenant acme.demo',
    sourceIp: '198.51.100.10',
    createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
  },
  {
    id: 'evt_demo_3',
    eventType: 'SSRF_BLOCKED',
    severity: 'HIGH',
    status: 'OPEN',
    description: 'Blocked upstream URL pointing at private network range',
    sourceIp: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: 'evt_demo_4',
    eventType: 'SCHEMA_VALIDATION_FAILED',
    severity: 'LOW',
    status: 'RESOLVED',
    description: 'Request body missing required field invoiceId',
    sourceIp: '203.0.113.91',
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
];

export type DemoIncidentRow = {
  id: string;
  title: string;
  severity: string;
  status: string;
  createdAt: string;
  service: { id: string; name: string } | null;
  _count: { events: number };
};

export const demoIncidents: DemoIncidentRow[] = [
  {
    id: 'inc_demo_1',
    title: 'Elevated authentication failures',
    severity: 'HIGH',
    status: 'INVESTIGATING',
    createdAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    service: { id: 'svc_demo_users', name: 'users-api' },
    _count: { events: 3 },
  },
  {
    id: 'inc_demo_2',
    title: 'Payment route rate-limit storm',
    severity: 'MEDIUM',
    status: 'MITIGATED',
    createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    service: { id: 'svc_demo_payments', name: 'payments-api' },
    _count: { events: 2 },
  },
];

export const demoIncidentDetails: Record<
  string,
  {
    id: string;
    title: string;
    description: string | null;
    severity: string;
    status: string;
    events: Array<{ id: string; eventType: string; message: string; createdAt: string }>;
  }
> = {
  inc_demo_1: {
    id: 'inc_demo_1',
    title: 'Elevated authentication failures',
    description:
      'Gateway observed a spike in failed logins against users-api. Deterministic rules opened this incident; AI analysis is advisory only.',
    severity: 'HIGH',
    status: 'INVESTIGATING',
    events: [
      {
        id: 'ie_1',
        eventType: 'CREATED',
        message: 'Incident opened from AUTH_FAILURE_SPIKE correlation',
        createdAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
      },
      {
        id: 'ie_2',
        eventType: 'NOTE',
        message: 'Checked Redis rate-limit counters — shared key hot for /auth/login',
        createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
      },
      {
        id: 'ie_3',
        eventType: 'STATUS',
        message: 'Status set to INVESTIGATING',
        createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      },
    ],
  },
  inc_demo_2: {
    id: 'inc_demo_2',
    title: 'Payment route rate-limit storm',
    description: 'Temporary burst against /payments; mitigated by tightening route budget.',
    severity: 'MEDIUM',
    status: 'MITIGATED',
    events: [
      {
        id: 'ie_4',
        eventType: 'CREATED',
        message: 'Incident opened from RATE_LIMIT_EXCEEDED cluster',
        createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
      },
      {
        id: 'ie_5',
        eventType: 'STATUS',
        message: 'Status set to MITIGATED after route limit update',
        createdAt: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
      },
    ],
  },
};

export const demoAnalyses: Record<
  string,
  Array<{
    id: string;
    model: string;
    promptVersion: string;
    confidence: number | null;
    createdAt: string;
    analysis: {
      summary: string;
      observedEvidence: string[];
      hypotheses: string[];
      recommendedActions: string[];
      uncertainty: string[];
    };
    readOnly: boolean;
    disclaimer: string;
  }>
> = {
  inc_demo_1: [
    {
      id: 'ai_demo_1',
      model: 'heuristic-v1',
      promptVersion: 'incident-analysis-1',
      confidence: 0.74,
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      analysis: {
        summary:
          'Auth failure spike is consistent with credential stuffing or a misconfigured client retry loop. No evidence of successful privilege escalation in sanitized telemetry.',
        observedEvidence: [
          'AUTH_FAILURE_SPIKE on users-api within a short window',
          'Source IPs concentrated in two /24 ranges',
          'No corresponding successful admin-role grants in audit logs',
        ],
        hypotheses: [
          'Automated credential stuffing against /auth/login',
          'Legitimate mobile client with broken token refresh causing retries',
        ],
        recommendedActions: [
          'Confirm rate-limit budgets on /auth/login and enable temporary tighter window',
          'Review WAF / IP reputation for the top source ranges',
          'Ask identity owners to check for password-spray alerts in IdP logs',
        ],
        uncertainty: [
          'Raw request bodies were redacted — cannot confirm payload shape',
          'Upstream IdP logs are outside Sentinel visibility',
        ],
      },
      readOnly: true,
      disclaimer:
        'AI recommendations are advisory only and never execute security actions automatically.',
    },
  ],
  inc_demo_2: [],
};

export const demoAuditLogs = [
  {
    id: 'aud_1',
    action: 'USER_LOGIN',
    resourceType: 'session',
    resourceId: 'sess_demo',
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: 'aud_2',
    action: 'INCIDENT_STATUS_UPDATE',
    resourceType: 'incident',
    resourceId: 'inc_demo_1',
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
  {
    id: 'aud_3',
    action: 'SERVICE_CREATED',
    resourceType: 'service',
    resourceId: 'svc_demo_payments',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

const DEMO_STORE_KEY = 'sentinel.demo.store';

interface DemoStore {
  incidents: typeof demoIncidents;
  details: typeof demoIncidentDetails;
  analyses: typeof demoAnalyses;
}

function defaultStore(): DemoStore {
  return {
    incidents: structuredClone(demoIncidents),
    details: structuredClone(demoIncidentDetails),
    analyses: structuredClone(demoAnalyses),
  };
}

export function loadDemoStore(): DemoStore {
  if (typeof window === 'undefined') return defaultStore();
  const raw = localStorage.getItem(DEMO_STORE_KEY);
  if (!raw) {
    const store = defaultStore();
    localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
    return store;
  }
  try {
    return JSON.parse(raw) as DemoStore;
  } catch {
    const store = defaultStore();
    localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
    return store;
  }
}

export function saveDemoStore(store: DemoStore): void {
  localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
}

export function resetDemoStore(): void {
  localStorage.removeItem(DEMO_STORE_KEY);
}
