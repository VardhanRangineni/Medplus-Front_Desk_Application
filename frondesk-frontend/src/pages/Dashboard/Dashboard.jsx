import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import './Dashboard.css';
import AppHeader       from '../../components/AppHeader/AppHeader';
import AppSidebar      from '../../components/AppSidebar/AppSidebar';
import UserMaster      from '../UserMaster/UserMaster';
import LocationMaster  from '../LocationMaster/LocationMaster';
import CheckInOut      from '../CheckInOut/CheckInOut';
import UserManagement  from '../UserManagement/UserManagement';
import Reports         from '../Reports/Reports';
import Settings        from '../Settings/Settings';
import { IconPlus, IconMapPin } from '../../components/Icons/Icons';
import { getDashboardStats, getRecentVisitors } from './dashboardService';

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

/* ── Visitor Flow Chart (Recharts) ───────────────────────────────────────── */

function VisitorFlowChart({ points = [] }) {
  if (!points.length) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: '#ccc', fontSize: 13,
      }}>
        No visitor data yet today
      </div>
    );
  }

  // Recharts needs an array of objects with named keys
  const chartData = points.map(p => ({ label: p.label, visitors: p.all }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -28 }}>
        <defs>
          <linearGradient id="visitFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#C2181D" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#C2181D" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f1f3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 9, fill: '#aaa' }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 9, fill: '#ccc' }}
          axisLine={false} tickLine={false}
          width={28}
        />
        <Tooltip
          formatter={(v) => [v, 'Visitors']}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #eee' }}
          itemStyle={{ color: '#C2181D' }}
        />
        <Area
          type="monotone"
          dataKey="visitors"
          stroke="#C2181D"
          strokeWidth={2}
          fill="url(#visitFill)"
          dot={{ r: 3.5, fill: '#C2181D', stroke: '#fff', strokeWidth: 1.5 }}
          activeDot={{ r: 5 }}
          isAnimationActive={true}
          animationDuration={700}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
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

const RESTRICTED_ROUTES = {
  'user-management': ['PRIMARY_ADMIN', 'REGIONAL_ADMIN'],
  'user-master':     ['PRIMARY_ADMIN', 'REGIONAL_ADMIN'],
  'location-master': ['PRIMARY_ADMIN', 'REGIONAL_ADMIN'],
};

/* ── Page content router ─────────────────────────────────────────────────── */

function PageContent({ activeNav, setActiveNav, session }) {
  const role = session?.role ?? 'RECEPTIONIST';

  // Silently redirect to dashboard if the user attempts to access a restricted page
  const allowedRoles = RESTRICTED_ROUTES[activeNav];
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <DashboardHome session={session} onNavigate={setActiveNav} />;
  }

  switch (activeNav) {
    case 'home':            return <CheckInOut session={session} />;
    case 'user-management': return <UserManagement session={session} />;
    case 'user-master':     return <UserMaster session={session} />;
    case 'location-master': return <LocationMaster session={session} />;
    case 'reports':         return <Reports session={session} />;
    case 'settings':        return <Settings session={session} />;
    default:                return <DashboardHome session={session} onNavigate={setActiveNav} />;
  }
}

/* ── Dashboard home content ─────────────────────────────────────────────── */

function DashboardHome({ session, onNavigate }) {
  const firstName = session?.fullName?.split(' ')[0] ?? session?.employeeId;

  const [stats,    setStats]    = useState(null);
  const [visitors, setVisitors] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [s, v] = await Promise.all([getDashboardStats(), getRecentVisitors()]);
        if (!cancelled) {
          setStats(s);
          setVisitors(v);
        }
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const peakPoint = stats?.visitorFlow?.reduce(
    (best, p) => (p.all > (best?.all ?? 0) ? p : best),
    null,
  );

  const pending = stats?.pendingSignouts ?? 0;

  return (
    <main className="db-content">

      {/* Stats row */}
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
          <h2 className="db-summary__greeting">{getGreeting()},<br />{firstName}.</h2>
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
            Register Visitor
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
            <VisitorFlowChart points={stats?.visitorFlow ?? []} />
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
                  <td colSpan={8} style={{ textAlign: 'center', color: '#aaa', padding: 20 }}>
                    Loading&hellip;
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

  return (
    <div className="app-root">
      <AppHeader session={session} />
      <div className="app-body">
        <AppSidebar
          session={session}
          activeNav={activeNav}
          onNavChange={setActiveNav}
          onLogout={onLogout}
        />
        <PageContent activeNav={activeNav} setActiveNav={setActiveNav} session={session} />
      </div>
    </div>
  );
}
