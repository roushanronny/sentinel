'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { apiGet, loadSession } from '@/lib/api';

interface ServiceRow {
  id: string;
  name: string;
  environment: string;
  status: string;
  upstreamUrl: string;
  _count: { routes: number };
}

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = loadSession();
    if (!session) return;
    apiGet<ServiceRow[]>('/services', session)
      .then(setServices)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>Services</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Registered upstream APIs for this organization
          </p>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <section className="panel">
        {services.length === 0 ? (
          <p className="muted">No services found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Environment</th>
                <th>Status</th>
                <th>Routes</th>
                <th>Upstream</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id}>
                  <td>{service.name}</td>
                  <td>{service.environment}</td>
                  <td>{service.status}</td>
                  <td>{service._count.routes}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                    {service.upstreamUrl}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}
