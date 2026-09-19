'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { apiGet, apiSend, loadSession, type SessionData } from '@/lib/api';

interface IncidentRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  createdAt: string;
  service: { id: string; name: string } | null;
  _count: { events: number };
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('Elevated authentication failures');
  const [creating, setCreating] = useState(false);

  async function refresh(session: SessionData) {
    const data = await apiGet<IncidentRow[]>('/incidents', session);
    setIncidents(data);
  }

  useEffect(() => {
    const session = loadSession();
    if (!session) return;
    refresh(session).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : 'Failed to load'),
    );
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const session = loadSession();
    if (!session) return;
    setCreating(true);
    setError(null);
    try {
      await apiSend('POST', '/incidents', session, {
        title,
        severity: 'HIGH',
        description: 'Created from Sentinel dashboard',
      });
      setTitle('');
      await refresh(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>Incidents</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Investigate and track remediation with a timeline
          </p>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Create incident</h2>
        <form onSubmit={onCreate} style={{ display: 'flex', gap: 10 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Incident title"
            required
            style={{
              flex: 1,
              background: '#0d161a',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '12px 14px',
              color: 'var(--text)',
            }}
          />
          <button className="btn" style={{ width: 'auto' }} type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>
      </section>

      <section className="panel">
        {incidents.length === 0 ? (
          <p className="muted">No incidents yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Service</th>
                <th>Timeline</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.id}>
                  <td>
                    <Link href={`/dashboard/incidents/${incident.id}`}>{incident.title}</Link>
                  </td>
                  <td>
                    <span className={`badge ${incident.severity}`}>{incident.severity}</span>
                  </td>
                  <td>{incident.status}</td>
                  <td>{incident.service?.name ?? '—'}</td>
                  <td>{incident._count.events} events</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}
