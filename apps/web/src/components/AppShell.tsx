'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearSession, loadSession } from '@/lib/api';
import { useEffect, useState } from 'react';

const links = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/services', label: 'Services' },
  { href: '/dashboard/security-events', label: 'Security Events' },
  { href: '/dashboard/incidents', label: 'Incidents' },
  { href: '/dashboard/audit', label: 'Audit Logs' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userLabel, setUserLabel] = useState('…');

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      router.replace('/');
      return;
    }
    setUserLabel(session.userEmail);
  }, [router]);

  function logout() {
    clearSession();
    router.replace('/');
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          Sentinel <span>API</span>
        </div>
        <nav className="nav">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? 'active' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: 'auto' }}>
          <div className="muted" style={{ fontSize: '0.85rem', marginBottom: 8 }}>
            {userLabel}
          </div>
          <button className="btn secondary" type="button" onClick={logout}>
            Sign out
          </button>
          <div className="muted" style={{ fontSize: '0.75rem', marginTop: 12 }}>
            Built by Roushan Kumar
          </div>
        </div>
      </aside>
      <div className="main">{children}</div>
    </div>
  );
}
