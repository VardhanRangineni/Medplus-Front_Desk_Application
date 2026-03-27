import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';
import Topbar  from '../../components/Topbar/Topbar';
import Sidebar from '../../components/Sidebar/Sidebar';
import {
  getLocations,
  getDashboardStats,
  getVisitorFlowChart,
  getRecentVisitors,
} from '../../api/dashboardApi';

// ── SVG Area Chart ────────────────────────────────────────────────────────────

const VisitorChart = ({ data }) => {
  const W = 400, H = 110, PAD = 8;
  const maxVal = Math.max(...data.map(d => d.count));
  const pts = data.map((d, i) => ({
    x: PAD + (i / (data.length - 1)) * (W - PAD * 2),
    y: PAD + (1 - d.count / maxVal) * (H - PAD * 2),
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${pts[pts.length - 1].x},${H} L ${pts[0].x},${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="chart-svg">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#C2181D" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#C2181D" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#chartGrad)" />
      <path d={line}  fill="none" stroke="#C2181D" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#C2181D"
                stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      ))}
    </svg>
  );
};

// ── Inline icons kept only for content area use ───────────────────────────────

const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const IconPin = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);

// ── Main Component ────────────────────────────────────────────────────────────

const Dashboard = () => {
  const navigate = useNavigate();

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [activeNav,      setActiveNav]      = useState('dashboard');
  const [mobileNavOpen,  setMobileNavOpen]  = useState(false);
  const [location,       setLocation]       = useState('Corporate Office');
  const [checkinFilter,  setCheckinFilter]  = useState('All');
  const [checkoutFilter, setCheckoutFilter] = useState('All');
  const [activeFilter,   setActiveFilter]   = useState('All');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [dateRange, setDateRange] = useState({ from: today, to: today });

  // ── Server data state ─────────────────────────────────────────────────────────
  const [locations,      setLocations]      = useState(['Corporate Office']);
  const [stats,          setStats]          = useState(null);
  const [chartData,      setChartData]      = useState([]);
  const [recentVisitors, setRecentVisitors] = useState([]);

  // ── Fetch locations once on mount ─────────────────────────────────────────────
  useEffect(() => {
    getLocations().then(setLocations).catch(console.error);
  }, []);

  // ── Re-fetch dashboard data whenever location or date range changes ───────────
  useEffect(() => {
    Promise.all([
      getDashboardStats({ location, dateFrom: dateRange.from, dateTo: dateRange.to }),
      getVisitorFlowChart({ location, date: dateRange.from }),
      getRecentVisitors({ location }),
    ])
      .then(([s, chart, visitors]) => {
        setStats(s);
        setChartData(chart);
        setRecentVisitors(visitors);
      })
      .catch(console.error);
  }, [location, dateRange]);

  // ── Derived values ────────────────────────────────────────────────────────────
  const rawName     = localStorage.getItem('userName') || sessionStorage.getItem('userName') || 'Admin';
  const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const initials    = displayName.charAt(0).toUpperCase();

  const todayLabel = today.toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userName');
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('userName');
    navigate('/login');
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="dashboard">

      {/* ── Topbar ── */}
      <Topbar
        locations={locations}
        location={location}
        onLocationChange={setLocation}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        displayName={displayName}
        initials={initials}
        todayLabel={todayLabel}
        onMenuOpen={() => setMobileNavOpen(true)}
      />

      {/* ── Body: sidebar + scrollable content ── */}
      <div className="dash-body">

        {/* ── Sidebar ── */}
        <Sidebar
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          activeNav={activeNav}
          onNavChange={setActiveNav}
          onLogout={handleLogout}
        />

        {/* ── Scrollable content ── */}
        <div className="dash-content">

          {/* Row 1: KPI cards */}
          <div className="stats-grid">

            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-label">Today Check-in's</span>
                <div className="stat-toggle">
                  {['All', 'Emp', 'Non Emp'].map(f => (
                    <button
                      key={f}
                      className={`toggle-btn ${checkinFilter === f ? 'active' : ''}`}
                      onClick={() => setCheckinFilter(f)}
                    >{f}</button>
                  ))}
                </div>
              </div>
              <span className="stat-value" style={{ color: '#32A94C' }}>
                {stats?.checkIn[checkinFilter] ?? '—'}
              </span>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-label">Today Check-out's</span>
                <div className="stat-toggle">
                  {['All', 'Emp', 'Non Emp'].map(f => (
                    <button
                      key={f}
                      className={`toggle-btn ${checkoutFilter === f ? 'active' : ''}`}
                      onClick={() => setCheckoutFilter(f)}
                    >{f}</button>
                  ))}
                </div>
              </div>
              <span className="stat-value" style={{ color: '#C2181D' }}>
                {stats?.checkOut[checkoutFilter] ?? '—'}
              </span>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-label">Active in Building</span>
                <div className="stat-toggle">
                  {['All', 'Emp', 'Non Emp'].map(f => (
                    <button
                      key={f}
                      className={`toggle-btn ${activeFilter === f ? 'active' : ''}`}
                      onClick={() => setActiveFilter(f)}
                    >{f}</button>
                  ))}
                </div>
              </div>
              <span className="stat-value" style={{ color: '#32A94C' }}>
                {stats?.active[activeFilter] ?? '—'}
              </span>
              <div className="stat-footer">
                <span className="live-badge">
                  <span className="live-dot" />
                  Live
                </span>
              </div>
            </div>

          </div>

          {/* Row 2: Hero + Chart */}
          <div className="dash-row-top">

            <div className="hero-card">
              <span className="hero-badge">Greeting's</span>
              <h2>{greeting},<br />{displayName}.</h2>
              <br></br>
              <button className="hero-cta">
                <IconPlus /> Register Visitor
              </button>
            </div>

            {chartData.length > 0 && (() => {
              const peak = chartData.reduce((a, b) => b.count > a.count ? b : a, chartData[0]);
              return (
                <div className="chart-card">
                  <div className="chart-header">
                    <div>
                      <p className="chart-label">Visitor Flow</p>
                      <p className="chart-sub">Today · Peak at {peak.hour} ({peak.count} visitors)</p>
                    </div>
                    <span className="chart-live-dot" />
                  </div>
                  <div className="chart-area">
                    <VisitorChart data={chartData} />
                  </div>
                  <div className="chart-xaxis">
                    {chartData.filter((_, i) => i % 2 === 0).map(d => (
                      <span key={d.hour}>{d.hour}</span>
                    ))}
                  </div>
                </div>
              );
            })()}

          </div>

          {/* Row 3: Recent visitors table */}
          <div className="visitors-card">
            <div className="visitors-header">
              <span>Recent Visitors</span>
              <button className="view-all-btn">View all</button>
            </div>
            <div className="table-scroll">
              <table className="visitors-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Name</th>
                    <th>Mobile / Emp ID</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Person to Meet</th>
                    <th>Card(s)</th>
                    <th>Check-in</th>
                  </tr>
                </thead>
                <tbody>
                  {recentVisitors.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <span className={`type-badge ${v.type === 'Employee' ? 'type-employee' : 'type-visitor'}`}>
                          {v.type}
                        </span>
                      </td>
                      <td className="td-name">{v.name}</td>
                      <td className="td-contact">{v.contactId}</td>
                      <td className="td-location">
                        <IconPin />
                        {v.location}
                      </td>
                      <td>
                        <span className={`status-pill ${v.status === 'Checked-in' ? 'pill-checkedin' : 'pill-checkedout'}`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="td-muted">{v.personToMeet}</td>
                      <td className="td-cards">{v.cards}</td>
                      <td className="td-muted">{v.checkIn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>{/* end dash-content */}

      </div>{/* end dash-body */}
    </div>
  );
};

export default Dashboard;
