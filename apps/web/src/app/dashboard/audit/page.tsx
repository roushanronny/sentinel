'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { apiGet, loadSession } from '@/lib/api';

interface AuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  createdAt: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = loadSession();
    if (!session) return;
    apiGet<AuditLog[]>('/audit-logs', session)
      .then(setLogs)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>Audit Logs</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Who changed what inside the control plane
          </p>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <section className="panel">
        {logs.length === 0 ? (
          <p className="muted">No audit entries yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Resource</th>
                <th>Resource ID</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.action}</td>
                  <td>{log.resourceType}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                    {log.resourceId ?? '—'}
                  </td>
                  <td>{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}
