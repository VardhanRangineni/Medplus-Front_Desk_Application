import { useState, useEffect } from 'react';
import LoginPage from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';

export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    window.electronAPI?.getAuthSession()
      .then((s) => { if (s) setSession(s); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const handleLoginSuccess = (sessionData) => setSession(sessionData);

  const handleLogout = async () => {
    await window.electronAPI?.clearAuthSession().catch(() => {});
    setSession(null);
  };

  if (checking) return null;

  if (session) {
    return <Dashboard session={session} onLogout={handleLogout} />;
  }

  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
}
