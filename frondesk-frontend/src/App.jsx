import { useState, useEffect, lazy, Suspense } from 'react';
import LoginPage from './pages/Login/Login';
import AppPageLoader from './components/AppPageLoader/AppPageLoader';
import { resolveCurrentDevice } from './pages/LocationMaster/locationMasterService';
import { resolveLocationId } from './services/locationScope';

const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));

async function enrichSessionWithDevice(session) {
  if (!session) return session;
  let next = {
    ...session,
    locationId: session.locationId ? resolveLocationId(session.locationId) : session.locationId,
    locationIds: Array.isArray(session.locationIds)
      ? session.locationIds.map((id) => resolveLocationId(id)).filter(Boolean)
      : session.locationIds,
  };
  if (next.deviceId) return next;
  try {
    const device = await resolveCurrentDevice();
    if (!device?.deviceId) return next;
    return {
      ...next,
      deviceId: device.deviceId,
      deviceName: device.displayName,
    };
  } catch {
    return next;
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
