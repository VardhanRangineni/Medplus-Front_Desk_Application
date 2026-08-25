import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import AppHeader from '../AppHeader/AppHeader';
import AppSidebar from '../AppSidebar/AppSidebar';
import {
  canFilterAllLocations,
  canFilterLocations,
  getAssignedLocationIds,
  defaultAdminLocationId,
  buildLocationScope,
} from '../../services/locationScope';
import { useState, useMemo, useCallback } from 'react';

/**
 * Map a route pathname to the nav item id that AppSidebar uses for
 * highlighting the active item.
 *   /dashboard → 'dashboard'
 *   /home      → 'home'
 *   /reports   → 'reports'
 *   /          → 'dashboard' (index route)
 */
function deriveActiveNavFromPath(pathname) {
  if (!pathname || pathname === '/' || pathname === '/dashboard') return 'dashboard';
  // Strip leading '/' and 'dashboard/' prefix for nested routes
  return pathname.replace(/^\//, '').replace(/^dashboard\//, '');
}

/**
 * AppShell — floating glass header + sidebar + <Outlet> for page content.
 * Rendered once, stays mounted for all authenticated routes.
 *
 * Provides { session, locationScope } via <Outlet context> so child routes
 * can access it with useOutletContext().
 *
 * Props:
 *   session    – login session
 *   onLogout   – () => void
 */
export default function AppShell({ session, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeNav = deriveActiveNavFromPath(location.pathname);

  // ── Location filter state (shared across all pages) ──────────────────
  const showLocationFilter = canFilterLocations(session);
  const allowAllLocations = canFilterAllLocations(session);
  const allowedLocationIds = allowAllLocations ? null : getAssignedLocationIds(session);
  const [locationId, setLocationId] = useState(() => defaultAdminLocationId(session));
  const locationScope = useMemo(
    () => buildLocationScope(locationId, session),
    [locationId, session],
  );

  const handleNavChange = useCallback((id) => {
    if (id === 'dashboard') {
      navigate('/dashboard');
    } else {
      navigate('/dashboard/' + id);
    }
  }, [navigate]);

  // Context passed to all child routes via <Outlet>
  const outletContext = useMemo(() => ({ session, locationScope }), [session, locationScope]);

  return (
    <div className="app-root">
      <AppHeader
        session={session}
        showLocationFilter={showLocationFilter}
        locationId={locationId}
        onLocationChange={setLocationId}
        allowedLocationIds={allowedLocationIds}
        allowAllLocations={allowAllLocations}
      />
      <div className="app-body">
        <AppSidebar
          session={session}
          activeNav={activeNav}
          onNavChange={handleNavChange}
          onLogout={onLogout}
        />
        <div className="app-page-shell">
          <Outlet context={outletContext} />
        </div>
      </div>
    </div>
  );
}
