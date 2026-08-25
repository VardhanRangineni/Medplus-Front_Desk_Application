import { useState, useEffect, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useOutletContext } from 'react-router-dom';
import LoginPage from './pages/Login/Login';
import AppPageLoader from './components/AppPageLoader/AppPageLoader';
import AppShell from './components/AppShell/AppShell';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { resolveCurrentDevice } from './pages/LocationMaster/locationMasterService';
import { resolveLocationId } from './services/locationScope';

/* ── Eager imports (default nav + chunk-load-safe) ──────────────────────── */
import CheckInOut from './pages/CheckInOut/CheckInOut';
import DashboardHome from './pages/Dashboard/Dashboard';

/* ── Lazy route components ─────────────────────────────────────────────── */
const Reports        = lazyWithRetry(() => import('./pages/Reports/Reports'), 'reports');
const StaffActivity  = lazyWithRetry(() => import('./pages/StaffActivity/StaffActivity'), 'staff');
const UserManagement = lazyWithRetry(() => import('./pages/UserManagement/UserManagement'), 'users');
const KeyManagement  = lazyWithRetry(() => import('./pages/KeyManagement/KeyManagement'), 'keymgmt');
const LocationMaster = lazyWithRetry(() => import('./pages/LocationMaster/LocationMaster'), 'locations');
const DeviceMaster   = lazyWithRetry(() => import('./pages/DeviceMaster/DeviceMaster'), 'devices');
const VisitReasons   = lazyWithRetry(() => import('./pages/VisitReasons/VisitReasons'), 'visitreasons');

/* ── Route wrappers (get context from AppShell, pass as props) ─────────── */

/** Wrapper that renders a route component inside Suspense. */
function SuspenseRoute({ element }) {
  return (
    <Suspense fallback={<AppPageLoader />}>
      {element}
    </Suspense>
  );
}

/**
 * Thin wrapper that injects { session, locationScope } from Outlet context
 * into components that expect them as props (Reports, StaffActivity).
 */
function WithContext({ component: Comp, props = {} }) {
  const context = useOutletContext();
  return <Comp session={context.session} locationScope={context.locationScope} {...props} />;
}

function WithSession({ component: Comp }) {
  const context = useOutletContext();
  return <Comp session={context.session} />;
}

function CheckInOutRoute() {
  const context = useOutletContext();
  return <CheckInOut session={context.session} locationScope={context.locationScope} />;
}

function DashboardRoute() {
  // DashboardHome reads context internally via useOutletContext()
  return <DashboardHome />;
}

/* ── Device enrichment ──────────────────────────────────────────────────── */

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

/* ── Role definitions (matches AppSidebar ALL_NAV_ITEMS) ──────────────────── */
const ROLES = {
  ALL: ['PRIMARY_ADMIN', 'REGIONAL_ADMIN', 'RECEPTIONIST', 'DEPT_HEAD'],
  ADMIN_ONLY: ['PRIMARY_ADMIN', 'REGIONAL_ADMIN'],
  PRIMARY_ONLY: ['PRIMARY_ADMIN'],
};

/* ── App ─────────────────────────────────────────────────────────────────── */

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
    window.location.hash = '/dashboard';
    setSession(enriched);
  };

  const handleLogout = async () => {
    await window.electronAPI?.clearAuthSession().catch(() => {});
    window.location.hash = '/login';
    setSession(null);
  };

  if (!authChecked) {
    return <AppPageLoader label="Starting…" fullScreen size="xl" />;
  }

  return (
    <HashRouter>
      <Suspense fallback={<AppPageLoader label="Loading workspace…" fullScreen size="xl" />}>
        <Routes>
          {/* ── Unauthenticated ───────────────────────────────────────── */}
          <Route
            path="/login"
            element={
              session
                ? <Navigate to="/dashboard" replace />
                : <LoginPage onLoginSuccess={handleLoginSuccess} />
            }
          />

          {/* ── Authenticated shell ───────────────────────────────────── */}
          {session && (
            <Route path="/dashboard" element={<AppShell session={session} onLogout={handleLogout} />}>
              {/* Index → DashboardHome */}
              <Route index element={<SuspenseRoute element={<DashboardRoute />} />} />

              {/* Check In / Out */}
              <Route path="home" element={<SuspenseRoute element={<CheckInOutRoute />} />} />

              {/* Reports */}
              <Route
                path="reports"
                element={
                  <SuspenseRoute element={<WithContext component={Reports} />} />
                }
              />

              {/* Staff Activity (Admin + Supervisor) */}
              <Route
                path="staff-activity"
                element={
                  <ProtectedRoute session={session} roles={ROLES.ADMIN_ONLY}>
                    <SuspenseRoute element={<WithContext component={StaffActivity} />} />
                  </ProtectedRoute>
                }
              />

              {/* User Management (Admin + Supervisor) */}
              <Route
                path="user-management"
                element={
                  <ProtectedRoute session={session} roles={ROLES.ADMIN_ONLY}>
                    <SuspenseRoute element={<UserManagement />} />
                  </ProtectedRoute>
                }
              />

              {/* Key Management (Admin + Supervisor) */}
              <Route
                path="key-management"
                element={
                  <ProtectedRoute session={session} roles={ROLES.ADMIN_ONLY}>
                    <SuspenseRoute element={<KeyManagement />} />
                  </ProtectedRoute>
                }
              />

              {/* Location Master (Primary Admin only) */}
              <Route
                path="location-master"
                element={
                  <ProtectedRoute session={session} roles={ROLES.PRIMARY_ONLY}>
                    <SuspenseRoute element={<LocationMaster />} />
                  </ProtectedRoute>
                }
              />

              {/* Device Master (Admin + Supervisor) */}
              <Route
                path="device-master"
                element={
                  <ProtectedRoute session={session} roles={ROLES.ADMIN_ONLY}>
                    <SuspenseRoute element={<WithSession component={DeviceMaster} />} />
                  </ProtectedRoute>
                }
              />

              {/* Visit Reasons (Admin + Supervisor) */}
              <Route
                path="visit-reasons"
                element={
                  <ProtectedRoute session={session} roles={ROLES.ADMIN_ONLY}>
                    <SuspenseRoute element={<VisitReasons />} />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all → redirect to dashboard */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          )}

          {/* ── Global catch-all ──────────────────────────────────────── */}
          <Route
            path="*"
            element={
              session
                ? <Navigate to="/dashboard" replace />
                : <Navigate to="/login" replace />
            }
          />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
