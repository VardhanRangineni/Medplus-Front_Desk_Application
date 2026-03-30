import { useState, useEffect } from 'react';
import LoginPage from './pages/Login/Login';

/**
 * App root.
 * Manages the auth session state — shows LoginPage when logged out,
 * Dashboard when logged in. Replace <DashboardPlaceholder> with your
 * real Dashboard component once it is built.
 */
export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  /* On cold start, check if a session is already stored in main process */
  useEffect(() => {
    window.electronAPI?.getAuthSession()
      .then((s) => { if (s) setSession(s); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const handleLoginSuccess = (sessionData) => {
    setSession(sessionData);
  };

  const handleLogout = async () => {
    await window.electronAPI?.clearAuthSession().catch(() => {});
    setSession(null);
  };

  if (checking) return null;

  if (session) {
    return <DashboardPlaceholder session={session} onLogout={handleLogout} />;
  }

  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
}

/* ── Temporary Dashboard placeholder ─────────────────────────────────────────
   Replace this entire component with your real Dashboard page once built.
──────────────────────────────────────────────────────────────────────────── */
function DashboardPlaceholder({ session, onLogout }) {
  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <p style={styles.greeting}>Welcome, <strong>{session.fullName}</strong></p>
        <p style={styles.meta}>{session.role} · {session.locationName}</p>
        <p style={styles.meta}>Employee ID: {session.employeeId}</p>
        <button style={styles.btn} onClick={onLogout}>Log Out</button>
      </div>
    </div>
  );
}

const styles = {
  root: {
    width: '100vw', height: '100vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#f1f5f9', fontFamily: 'Segoe UI, sans-serif',
  },
  card: {
    background: '#fff', borderRadius: 16, padding: '40px 48px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
    display: 'flex', flexDirection: 'column', gap: 10, minWidth: 320,
  },
  greeting: { fontSize: 22, color: '#0d0d0d', margin: 0 },
  meta:     { fontSize: 14, color: '#4a4a4a', margin: 0 },
  btn: {
    marginTop: 24, padding: '10px 24px', background: '#C2181D',
    color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
    fontWeight: 700, fontSize: 14, letterSpacing: '0.05em',
  },
};
