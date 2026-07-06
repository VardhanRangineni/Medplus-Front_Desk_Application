import { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import './Dashboard.css';
import AppHeader      from '../../components/AppHeader/AppHeader';
import AppSidebar     from '../../components/AppSidebar/AppSidebar';
import AppPageLoader  from '../../components/AppPageLoader/AppPageLoader';
import LottieLoader   from '../../components/LottieLoader/LottieLoader';
import { IconPlus, IconMapPin } from '../../components/Icons/Icons';
import { getDashboardStats, getRecentVisitors } from './dashboardService';
import {
  defaultAdminLocationId,
  hasAnyRole,
  canCheckIn,
  canFilterAllLocations,
  canFilterLocations,
  getAssignedLocationIds,
  buildLocationScope,
} from '../../services/locationScope';
// Eager import — default nav is Check In/Out; lazy chunk caused ChunkLoadError in dev.
import CheckInOut from '../CheckInOut/CheckInOut';

/** Retry once on stale webpack chunks after `rs` or dev-server hiccups. */
function lazyWithRetry(importFn, chunkLabel) {
  return lazy(() => importFn().catch((err) => {
    const isChunk = err?.name === 'ChunkLoadError' || /loading chunk/i.test(String(err?.message));
    if (isChunk && typeof sessionStorage !== 'undefined') {
      const key = `mvms_chunk_retry_${chunkLabel}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        return new Promise(() => {});
      }
      sessionStorage.removeItem(key);
    }
    throw err;
  }));
}

const VisitorFlowChart = lazyWithRetry(() => import('./DashboardChart'), 'chart');
const UserManagement   = lazyWithRetry(() => import('../UserManagement/UserManagement'), 'users');
const Reports          = lazyWithRetry(() => import('../Reports/Reports'), 'reports');
const StaffActivity    = lazyWithRetry(() => import('../StaffActivity/StaffActivity'), 'staff');
const LocationMaster   = lazyWithRetry(() => import('../LocationMaster/LocationMaster'), 'locations');
const DeviceMaster     = lazyWithRetry(() => import('../DeviceMaster/DeviceMaster'), 'devices');

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatCheckIn(date) {
  if (!date) return '—';
  return date.toLocaleString('en-IN', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

/* ── Stat Card ───────────────────────────────────────────────────────────── */

function StatCard({ title, values = {}, live = false }) {
  const [active, setActive] = useState('All');

  const current = active === 'All'    ? (values.all    ?? 0)
                : active === 'Emp'    ? (values.emp    ?? 0)
                :                       (values.nonEmp ?? 0);

  return (
    <div className="db-stat-card">
      <div className="db-stat-card__top">
        <span className="db-stat-card__title">{title}</span>
        <div className="db-stat-card__tabs">
          {['All', 'Emp', 'Non Emp'].map(t => (
            <button
              key={t}
              className={`db-stat-tab${active === t ? ' db-stat-tab--active' : ''}`}
              onClick={() => setActive(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="db-stat-card__bottom">
        <span className="db-stat-card__value">{current}</span>
        {live && (
          <span className="db-stat-live">
            <span className="db-stat-live__dot" />
            Live
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Role-based route guard ──────────────────────────────────────────────── */

/**
 * Maps a nav-item id to the roles that are allowed to access it.
 * Matches the roles array defined in AppSidebar's ALL_NAV_ITEMS.
 * A RECEPTIONIST that tries to navigate to a restricted page is silently
 * redirected back to the dashboard home.
 */
const RESTRICTED_ROUTES = {
  'user-management': ['PRIMARY_ADMIN', 'REGIONAL_ADMIN'],
  'staff-activity':  ['PRIMARY_ADMIN', 'REGIONAL_ADMIN'],
  'location-master': ['PRIMARY_ADMIN'],
  'device-master':   ['PRIMARY_ADMIN', 'REGIONAL_ADMIN'],
};

/* ── Page content router ─────────────────────────────────────────────────── */

function PageContent({ activeNav, setActiveNav, session, locationScope }) {
  const allowedRoles = RESTRICTED_ROUTES[activeNav];
  if (allowedRoles && !hasAnyRole(session, allowedRoles)) {
    return (
      <div className="app-page-shell" key="dashboard">
        <DashboardHome session={session} onNavigate={setActiveNav} locationScope={locationScope} />
      </div>
    );
  }

  let page;
  switch (activeNav) {
    case 'home':
      return (
        <div className="app-page-shell" key="home">
          <CheckInOut session={session} locationScope={locationScope} />
        </div>
      );
    case 'user-management':
      page = <UserManagement session={session} />;
      break;
    case 'reports':
      page = <Reports session={session} locationScope={locationScope} />;
      break;
    case 'staff-activity':
      page = <StaffActivity session={session} locationScope={locationScope} />;
      break;
    case 'location-master':
      page = <LocationMaster session={session} />;
      break;
    case 'device-master':
      page = <DeviceMaster session={session} />;
      break;
    default:
      return (
        <div className="app-page-shell" key="dashboard">
          <DashboardHome session={session} onNavigate={setActiveNav} locationScope={locationScope} />
        </div>
      );
  }

  return (
    <div className="app-page-shell" key={activeNav}>
      <Suspense fallback={<AppPageLoader />}>
        {page}
      </Suspense>
    </div>
  );
}

/* ── Dashboard home content ─────────────────────────────────────────────── */

function DashboardHome({ session, onNavigate, locationScope }) {
  const displayName = (session?.fullName || session?.employeeId || 'User').trim();

  const [stats,    setStats]    = useState(null);
  const [visitors, setVisitors] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);

      const statsPromise = getDashboardStats(locationScope)
        .then((s) => { if (!cancelled) setStats(s); })
        .catch((err) => {
          console.error('Dashboard stats error:', err);
          if (!cancelled) setLoadError('Could not load dashboard statistics.');
        });

      const visitorsPromise = getRecentVisitors(locationScope)
        .then((v) => { if (!cancelled) setVisitors(v); })
        .catch((err) => {
          console.error('Recent visitors error:', err);
          if (!cancelled) setVisitors([]);
        });

      await Promise.allSettled([statsPromise, visitorsPromise]);
      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [locationScope.locationId, locationScope.allLocations]);

  const peakPoint = stats?.visitorFlow?.reduce(
    (best, p) => (p.all > (best?.all ?? 0) ? p : best),
    null,
  );

  const pending = stats?.pendingSignouts ?? 0;

  return (
    <main className="db-content">

      {loadError && (
        <p className="db-load-error" role="alert">{loadError}</p>
      )}

      <div className="db-stats-row">
        <StatCard
          title="Today Check-in's"
          values={{
            all:    stats?.todayCheckinsAll    ?? 0,
            emp:    stats?.todayCheckinsEmp    ?? 0,
            nonEmp: stats?.todayCheckinsNonEmp ?? 0,
          }}
        />
        <StatCard
          title="Today Check-out's"
          values={{
            all:    stats?.todayCheckoutsAll    ?? 0,
            emp:    stats?.todayCheckoutsEmp    ?? 0,
            nonEmp: stats?.todayCheckoutsNonEmp ?? 0,
          }}
        />
        <StatCard
          title="Active in Building"
          values={{
            all:    stats?.activeInBuildingAll    ?? 0,
            emp:    stats?.activeInBuildingEmp    ?? 0,
            nonEmp: stats?.activeInBuildingNonEmp ?? 0,
          }}
          live
        />
      </div>

      {/* Middle row: summary + chart */}
      <div className="db-mid-row">

        {/* Summary banner */}
        <div className="db-summary">
          <div className="db-summary__progress" />
          <span className="db-summary__badge">TODAY&apos;S SUMMARY</span>
          <h2 className="db-summary__greeting">{getGreeting()},<br />{displayName}</h2>
          <p className="db-summary__sub">
            {loading
              ? 'Loading summary\u2026'
              : pending > 0
                ? <>You have <strong>{pending}</strong> pending sign-out{pending !== 1 ? 's' : ''} today.</>
                : 'All visitors have signed out today.'
            }
          </p>
          <button className="db-summary__btn" onClick={() => onNavigate('home')}>
            <IconPlus size={14} />
            {canCheckIn(session) ? 'Register Visitor' : 'View Check In / Out'}
          </button>
        </div>

        {/* Visitor flow chart */}
        <div className="db-chart-card">
          <div className="db-chart-card__header">
            <div>
              <p className="db-chart-card__title">Visitor Flow</p>
              <p className="db-chart-card__sub">
                {loading
                  ? 'Loading\u2026'
                  : peakPoint
                    ? `Today \u00b7 Peak at ${peakPoint.label} (${peakPoint.all} visitor${peakPoint.all !== 1 ? 's' : ''})`
                    : 'Today \u00b7 No visitors yet'
                }
              </p>
            </div>
            <span className="db-chart-live">
              <span className="db-chart-live__dot" />
            </span>
          </div>
          <div className="db-chart-area">
            <Suspense fallback={
              <div className="db-chart-loading">
                <LottieLoader size="md" ariaLabel="Loading chart" />
              </div>
            }>
              <VisitorFlowChart points={stats?.visitorFlow ?? []} />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Recent Visitors table */}
      <div className="db-table-card">
        <div className="db-table-card__header">
          <span className="db-table-card__title">Recent Visitors</span>
          <button className="db-table-card__viewall" onClick={() => onNavigate('home')}>View all</button>
        </div>

        <div className="db-table-wrap">
          <table className="db-table">
            <thead>
              <tr>
                {['TYPE', 'NAME', 'MOBILE / EMP ID', 'LOCATION', 'STATUS', 'PERSON TO MEET', 'CARD(S)', 'CHECK-IN'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="db-table-loading">
                    <LottieLoader size="md" ariaLabel="Loading visitors" />
                  </td>
                </tr>
              ) : visitors.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: '#aaa', padding: 20 }}>
                    No recent visitors
                  </td>
                </tr>
              ) : visitors.slice(0, 10).map((v, i) => (
                <tr key={i}>
                  <td>
                    <span className="db-type-badge">
                      {v.type === 'EMPLOYEE' ? 'Employee' : 'Visitor'}
                    </span>
                  </td>
                  <td className="db-table__name">{v.name}</td>
                  <td>{v.type === 'EMPLOYEE' ? (v.empId ?? '—') : (v.mobile ?? '—')}</td>
                  <td>
                    <span className="db-loc">
                      <IconMapPin size={12} />
                      {v.locationName ?? v.locationId ?? '—'}
                    </span>
                  </td>
                  <td>
                    <span className={`db-status db-status--${v.status === 'checked-in' ? 'in' : 'out'}`}>
                      {v.status === 'checked-in' ? 'Checked-in' : 'Checked-out'}
                    </span>
                  </td>
                  <td>{v.personToMeet ?? '—'}</td>
                  <td>{v.card ?? '—'}</td>
                  <td className="db-table__checkin">{formatCheckIn(v.checkIn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </main>
  );
}

/* ── App shell — shared header + sidebar, routes content ─────────────────── */

export default function Dashboard({ session, onLogout }) {
  const [activeNav, setActiveNav] = useState('dashboard');
  const showLocationFilter = canFilterLocations(session);
  const allowAllLocations = canFilterAllLocations(session);
  const allowedLocationIds = allowAllLocations ? null : getAssignedLocationIds(session);
  const [locationId, setLocationId] = useState(() => defaultAdminLocationId(session));
  const locationScope = useMemo(
    () => buildLocationScope(locationId, session),
    [locationId, session],
  );

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
          onNavChange={setActiveNav}
          onLogout={onLogout}
        />
        <PageContent
          activeNav={activeNav}
          setActiveNav={setActiveNav}
          session={session}
          locationScope={locationScope}
        />
      </div>
    </div>
  );
}
