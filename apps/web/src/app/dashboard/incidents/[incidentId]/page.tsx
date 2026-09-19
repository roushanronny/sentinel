'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { API_URL, apiGet, loadSession, type SessionData } from '@/lib/api';

interface IncidentDetail {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  events: Array<{
    id: string;
    eventType: string;
    message: string;
    createdAt: string;
  }>;
}

interface AiAnalysisRow {
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
  readOnly?: boolean;
  disclaimer?: string;
}

async function apiSend(
  method: string,
  path: string,
  session: SessionData,
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'X-Organization-Id': session.organizationId,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await response.json()) as { data?: unknown; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(json.error?.message ?? 'Request failed');
  }
  return json.data;
}

export default function IncidentDetailPage() {
  const params = useParams<{ incidentId: string }>();
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [analyses, setAnalyses] = useState<AiAnalysisRow[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  async function refresh(session: SessionData) {
    const data = await apiGet<IncidentDetail>(`/incidents/${params.incidentId}`, session);
    setIncident(data);
    const ai = await apiGet<AiAnalysisRow[]>(
      `/incidents/${params.incidentId}/analyses`,
      session,
    );
    setAnalyses(ai);
  }

  useEffect(() => {
    const session = loadSession();
    if (!session || !params.incidentId) return;
    refresh(session).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : 'Failed to load'),
    );
  }, [params.incidentId]);

  async function addNote(event: FormEvent) {
    event.preventDefault();
    const session = loadSession();
    if (!session || !params.incidentId) return;
    try {
      await apiSend('POST', `/incidents/${params.incidentId}/notes`, session, { message: note });
      setNote('');
      await refresh(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note');
    }
  }

  async function setStatus(status: string) {
    const session = loadSession();
    if (!session || !params.incidentId) return;
    try {
      await apiSend('PATCH', `/incidents/${params.incidentId}`, session, { status });
      await refresh(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  }

  async function runAiAnalysis() {
    const session = loadSession();
    if (!session || !params.incidentId) return;
    setAnalyzing(true);
    setError(null);
    try {
      await apiSend('POST', `/incidents/${params.incidentId}/analyze`, session);
      // Worker path may be async; poll briefly for results.
      for (let i = 0; i < 8; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await refresh(session);
        const latest = await apiGet<AiAnalysisRow[]>(
          `/incidents/${params.incidentId}/analyses`,
          session,
        );
        if (latest.length > 0) break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>{incident?.title ?? 'Incident'}</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {incident ? `${incident.status} · ${incident.severity}` : 'Loading…'}
          </p>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {incident ? (
        <>
          <section className="panel" style={{ marginBottom: 16 }}>
            <h2>Actions</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['INVESTIGATING', 'MITIGATED', 'RESOLVED', 'CLOSED'].map((status) => (
                <button
                  key={status}
                  className="btn secondary"
                  style={{ width: 'auto' }}
                  type="button"
                  onClick={() => void setStatus(status)}
                >
                  Mark {status}
                </button>
              ))}
              <button
                className="btn"
                style={{ width: 'auto' }}
                type="button"
                disabled={analyzing}
                onClick={() => void runAiAnalysis()}
              >
                {analyzing ? 'Analyzing…' : 'Run AI analysis'}
              </button>
            </div>
            <p style={{ marginTop: 12 }}>{incident.description ?? 'No description'}</p>
          </section>

          <section className="panel" style={{ marginBottom: 16 }}>
            <h2>AI analysis (read-only)</h2>
            {analyses.length === 0 ? (
              <p className="muted">No AI analyses yet. Recommendations never auto-execute.</p>
            ) : (
              analyses.map((row) => (
                <div key={row.id} style={{ marginBottom: 18 }}>
                  <p className="muted" style={{ marginTop: 0 }}>
                    Model {row.model} · prompt {row.promptVersion} · confidence{' '}
                    {row.confidence?.toFixed(2) ?? 'n/a'}
                  </p>
                  <p>
                    <strong>Summary:</strong> {row.analysis.summary}
                  </p>
                  <p>
                    <strong>Observed evidence</strong>
                  </p>
                  <ul>
                    {row.analysis.observedEvidence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p>
                    <strong>Hypotheses</strong>
                  </p>
                  <ul>
                    {row.analysis.hypotheses.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p>
                    <strong>Recommended actions (advisory)</strong>
                  </p>
                  <ul>
                    {row.analysis.recommendedActions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  {row.analysis.uncertainty?.length ? (
                    <>
                      <p>
                        <strong>Uncertainty</strong>
                      </p>
                      <ul>
                        {row.analysis.uncertainty.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  <p className="muted" style={{ fontSize: '0.85rem' }}>
                    {row.disclaimer ??
                      'AI recommendations are advisory only and never execute security actions automatically.'}
                  </p>
                </div>
              ))
            )}
          </section>

          <section className="panel" style={{ marginBottom: 16 }}>
            <h2>Add note</h2>
            <form onSubmit={addNote} style={{ display: 'flex', gap: 10 }}>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
                placeholder="Investigation note"
                style={{
                  flex: 1,
                  background: '#0d161a',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  color: 'var(--text)',
                }}
              />
              <button className="btn" style={{ width: 'auto' }} type="submit">
                Add
              </button>
            </form>
          </section>

          <section className="panel">
            <h2>Timeline</h2>
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Type</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {incident.events.map((event) => (
                  <tr key={event.id}>
                    <td>{new Date(event.createdAt).toLocaleString()}</td>
                    <td>{event.eventType}</td>
                    <td>{event.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
