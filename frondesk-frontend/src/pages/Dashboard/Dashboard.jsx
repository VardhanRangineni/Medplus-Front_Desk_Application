import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import './Dashboard.css';
import { IconPlus, IconMapPin } from '../../components/Icons/Icons';
import LottieLoader   from '../../components/LottieLoader/LottieLoader';
import { getDashboardStats, getRecentVisitors } from './dashboardService';
import { canCheckIn } from '../../services/locationScope';

const VisitorFlowChart = lazy(() => import('./DashboardChart'));

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatCheckIn(date) {
  if (!date) return '—';
  return date.toLocaleDateString('en-IN', {
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

/* ── Dashboard home content ─────────────────────────────────────────────── */

/**
 * DashboardHome — the default route at /dashboard.
 * Stats, visitor flow chart, recent visitors table.
 *
 * Receives { session, locationScope } from <Outlet context> in AppShell.
 */
export default function DashboardHome() {
  const { session, locationScope } = useOutletContext();
  const navigate = useNavigate();

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
              ? 'Loading summary…'
              : pending > 0
                ? <>You have <strong>{pending}</strong> pending sign-out{pending !== 1 ? 's' : ''} today.</>
                : 'All visitors have signed out today.'
            }
          </p>
          <button className="db-summary__btn" onClick={() => navigate('/dashboard/home')}>
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
                  ? 'Loading…'
                  : peakPoint
                    ? `Today · Peak at ${peakPoint.label} (${peakPoint.all} visitor${peakPoint.all !== 1 ? 's' : ''})`
                    : 'Today · No visitors yet'
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
          <button className="db-table-card__viewall" onClick={() => navigate('/dashboard/home')}>View all</button>
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
