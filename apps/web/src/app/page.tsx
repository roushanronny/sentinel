'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiLogin, saveSession } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@acme.demo');
  const [password, setPassword] = useState('ChangeMe-Demo-Pass1');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await apiLogin(email, password);
      saveSession(result);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>
          Sentinel <span style={{ color: 'var(--accent)' }}>by Roushan Kumar</span>
        </h1>
        <p>Sign in to the API security control plane.</p>
        <p className="muted" style={{ marginTop: 0, fontSize: '0.85rem' }}>
          Live free stack: Vercel UI + Neon Postgres. Local Fastify API optional via NEXT_PUBLIC_API_URL.
        </p>
        {error ? <div className="error">{error}</div> : null}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted" style={{ marginTop: 14, marginBottom: 0, fontSize: '0.85rem' }}>
          Demo: admin@acme.demo / ChangeMe-Demo-Pass1
        </p>
      </form>
    </main>
  );
}
