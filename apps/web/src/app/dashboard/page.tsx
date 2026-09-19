'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { apiGet, loadSession } from '@/lib/api';

interface Overview {
  services: number;
  openSecurityEvents: number;
  openIncidents: number;
  recentSecurityEvents: Array<{
    id: string;
    eventType: string;
    severity: string;
    description: string;
    createdAt: string;
    status: string;
  }>;
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = loadSession();
    if (!session) return;
    apiGet<Overview>('/overview', session)
      .then(setOverview)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>Overview</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Tenant security and reliability snapshot
          </p>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="grid">
        <div className="stat">
          <div className="label">Services</div>
          <div className="value">{overview?.services ?? '—'}</div>
        </div>
        <div className="stat">
          <div className="label">Open security events</div>
          <div className="value">{overview?.openSecurityEvents ?? '—'}</div>
        </div>
        <div className="stat">
          <div className="label">Open incidents</div>
          <div className="value">{overview?.openIncidents ?? '—'}</div>
        </div>
      </div>

      <section className="panel">
        <h2>Recent security events</h2>
        {!overview ? (
          <p className="muted">Loading…</p>
        ) : overview.recentSecurityEvents.length === 0 ? (
          <p className="muted">No security events yet. Generate traffic through the gateway.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {overview.recentSecurityEvents.map((event) => (
                <tr key={event.id}>
                  <td>{event.eventType}</td>
                  <td>
                    <span className={`badge ${event.severity}`}>{event.severity}</span>
                  </td>
                  <td>{event.status}</td>
                  <td>{event.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}
