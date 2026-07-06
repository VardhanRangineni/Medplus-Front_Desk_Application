import { useState, useEffect, lazy, Suspense } from 'react';
import LoginPage from './pages/Login/Login';
import AppPageLoader from './components/AppPageLoader/AppPageLoader';
import { resolveCurrentDevice } from './pages/LocationMaster/locationMasterService';

const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));

async function enrichSessionWithDevice(session) {
  if (!session || session.deviceId) return session;
  try {
    const device = await resolveCurrentDevice();
    if (!device?.deviceId) return session;
    return {
      ...session,
      deviceId: device.deviceId,
      deviceName: device.displayName,
    };
  } catch {
    return session;
  }
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.electronAPI?.getAuthSession()
      .then(async (s) => {
        if (cancelled || !s) return;
        const enriched = await enrichSessionWithDevice(s);
        if (enriched !== s) {
          await window.electronAPI?.storeAuthSession(enriched).catch(() => {});
        }
        if (!cancelled) setSession(enriched);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAuthChecked(true); });
    return () => { cancelled = true; };
  }, []);

  const handleLoginSuccess = async (sessionData) => {
    const enriched = await enrichSessionWithDevice(sessionData);
    await window.electronAPI?.storeAuthSession(enriched).catch(() => {});
    setSession(enriched);
  };

  const handleLogout = async () => {
    await window.electronAPI?.clearAuthSession().catch(() => {});
    setSession(null);
  };

  if (!authChecked) {
    return <AppPageLoader label="Starting…" fullScreen size="xl" />;
  }

  if (session) {
    return (
      <Suspense fallback={<AppPageLoader label="Loading workspace…" fullScreen size="xl" />}>
        <Dashboard session={session} onLogout={handleLogout} />
      </Suspense>
    );
  }

  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
}
