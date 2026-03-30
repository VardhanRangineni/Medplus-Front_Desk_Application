import { useState } from 'react';
import './Dashboard.css';
import AppHeader       from '../../components/AppHeader/AppHeader';
import AppSidebar      from '../../components/AppSidebar/AppSidebar';
import UserMaster      from '../UserMaster/UserMaster';
import LocationMaster  from '../LocationMaster/LocationMaster';
import { IconPlus, IconMapPin } from '../../components/Icons/Icons';

/* ── Mock data ───────────────────────────────────────────────────────────── */
const VISITOR_FLOW_POINTS = [
  { label: '8am',  y: 8  },
  { label: '10am', y: 22 },
  { label: '12pm', y: 26 },
  { label: '2pm',  y: 16 },
  { label: '4pm',  y: 24 },
  { label: '6pm',  y: 10 },
];

const RECENT_VISITORS = [
  { type: 'Visitor',  name: 'Sameer Jain',   contact: '9823456789', location: 'Corporate Office', status: 'Checked-in',  meet: 'Sunita Reddy', card: '104', checkIn: 'Mar 26, 2026, 2:00 PM'  },
  { type: 'Employee', name: 'Priya Sharma',  contact: 'EMP-0045',   location: 'Corporate Office', status: 'Checked-in',  meet: '—',            card: '—',   checkIn: 'Mar 27, 2026, 9:30 AM'  },
  { type: 'Visitor',  name: 'Rahul Mehta',   contact: '9912345678', location: 'Corporate Office', status: 'Checked-out', meet: 'Arjun Das',    card: '87',  checkIn: 'Mar 27, 2026, 11:00 AM' },
  { type: 'Visitor',  name: 'Ananya Singh',  contact: '8845678901', location: 'Corporate Office', status: 'Checked-in',  meet: 'Kavita Rao',   card: '112', checkIn: 'Mar 27, 2026, 12:45 PM' },
];

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ── Visitor Flow SVG chart ──────────────────────────────────────────────── */
function VisitorFlowChart() {
  const W = 420; const H = 120; const PAD = { t: 12, b: 28, l: 8, r: 8 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const maxY   = 30;
  const n      = VISITOR_FLOW_POINTS.length;
  const xs     = VISITOR_FLOW_POINTS.map((_, i) => PAD.l + (i / (n - 1)) * chartW);
  const ys     = VISITOR_FLOW_POINTS.map(p  => PAD.t + chartH - (p.y / maxY) * chartH);

  const linePath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ');
  const areaPath = `${linePath} L${xs[n-1]},${H - PAD.b} L${xs[0]},${H - PAD.b} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#C2181D" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#C2181D" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#chartFill)" />
      <path d={linePath} fill="none" stroke="#C2181D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r="3.5" fill="#C2181D" stroke="#fff" strokeWidth="1.5" />
      ))}
      {VISITOR_FLOW_POINTS.map((p, i) => (
        <text key={i} x={xs[i]} y={H - 6} textAnchor="middle" fontSize="9" fill="#aaa">{p.label}</text>
      ))}
    </svg>
  );
}

/* ── Stat Card ───────────────────────────────────────────────────────────── */
function StatCard({ title, value, live = false }) {
  const [active, setActive] = useState('All');
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
        <span className="db-stat-card__value">{value}</span>
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

/* ── Page content router ─────────────────────────────────────────────────── */
function PageContent({ activeNav, session }) {
  switch (activeNav) {
    case 'user-master':     return <UserMaster />;
    case 'location-master': return <LocationMaster />;
    default:                return <DashboardHome session={session} />;
  }
}

/* ── Dashboard home content (extracted so the shell stays clean) ─────────── */
function DashboardHome({ session }) {
  const firstName = session?.fullName?.split(' ')[0] ?? session?.employeeId;

  return (
    <main className="db-content">

          {/* Stats row */}
          <div className="db-stats-row">
            <StatCard title="Today Check-in's"   value="23" />
            <StatCard title="Today Check-out's"  value="8"  />
            <StatCard title="Active in Building" value="15" live />
          </div>

          {/* Middle row: summary + chart */}
          <div className="db-mid-row">

            {/* Summary banner */}
            <div className="db-summary">
              <div className="db-summary__progress" />
              <span className="db-summary__badge">TODAY&apos;S SUMMARY</span>
              <h2 className="db-summary__greeting">{getGreeting()},<br />{firstName}.</h2>
              <p className="db-summary__sub">
                You have <strong>8</strong> pending sign-outs and{' '}
                <strong>3</strong> scheduled visits in the next hour.
              </p>
              <button className="db-summary__btn">
                <IconPlus size={14} />
                Register Visitor
              </button>
            </div>

            {/* Visitor flow chart */}
            <div className="db-chart-card">
              <div className="db-chart-card__header">
                <div>
                  <p className="db-chart-card__title">Visitor Flow</p>
                  <p className="db-chart-card__sub">Today · Peak at 3pm (26 visitors)</p>
                </div>
                <span className="db-chart-live">
                  <span className="db-chart-live__dot" />
                </span>
              </div>
              <div className="db-chart-area">
                <VisitorFlowChart />
              </div>
            </div>
          </div>

          {/* Recent Visitors table */}
          <div className="db-table-card">
            <div className="db-table-card__header">
              <span className="db-table-card__title">Recent Visitors</span>
              <button className="db-table-card__viewall">View all</button>
            </div>

            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    {['TYPE','NAME','MOBILE / EMP ID','LOCATION','STATUS','PERSON TO MEET','CARD(S)','CHECK-IN'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RECENT_VISITORS.map((v, i) => (
                    <tr key={i}>
                      <td><span className="db-type-badge">{v.type}</span></td>
                      <td className="db-table__name">{v.name}</td>
                      <td>{v.contact}</td>
                      <td>
                        <span className="db-loc">
                          <IconMapPin size={12} />
                          {v.location}
                        </span>
                      </td>
                      <td>
                        <span className={`db-status db-status--${v.status === 'Checked-in' ? 'in' : 'out'}`}>
                          {v.status}
                        </span>
                      </td>
                      <td>{v.meet}</td>
                      <td>{v.card}</td>
                      <td className="db-table__checkin">{v.checkIn}</td>
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
          activeNav={activeNav}
          onNavChange={setActiveNav}
          onLogout={onLogout}
        />
        <PageContent activeNav={activeNav} session={session} />
      </div>
    </div>
  );
}
