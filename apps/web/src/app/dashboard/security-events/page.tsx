'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { apiGet, loadSession } from '@/lib/api';

interface SecurityEvent {
  id: string;
  eventType: string;
  severity: string;
  status: string;
  description: string;
  sourceIp: string | null;
  createdAt: string;
}

export default function SecurityEventsPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = loadSession();
    if (!session) return;
    apiGet<SecurityEvent[]>('/security-events', session)
      .then(setEvents)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>Security Events</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Deterministic detections from the API gateway
          </p>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <section className="panel">
        {events.length === 0 ? (
          <p className="muted">No events yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Source IP</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{event.eventType}</td>
                  <td>
                    <span className={`badge ${event.severity}`}>{event.severity}</span>
                  </td>
                  <td>{event.status}</td>
                  <td>{event.sourceIp ?? '—'}</td>
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
