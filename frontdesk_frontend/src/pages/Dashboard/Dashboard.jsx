import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import medplusLogo from '../../assets/MedPlus.png';
import 'react-day-picker/style.css';
import './Dashboard.css';

// ── Mock data (replace with API calls when backend is ready) ─────────────────

const CHART_DATA = [
  { hour: '8am', count: 5  },
  { hour: '9am', count: 12 },
  { hour: '10am', count: 18 },
  { hour: '11am', count: 25 },
  { hour: '12pm', count: 20 },
  { hour: '1pm',  count: 15 },
  { hour: '2pm',  count: 22 },
  { hour: '3pm',  count: 28 },
  { hour: '4pm',  count: 19 },
  { hour: '5pm',  count: 10 },
  { hour: '6pm',  count: 4  },
];

// Mock check-in / check-out counts by filter (TODO: replace with API)
const CHECKIN_DATA  = { All: 23, Emp: 15, 'Non Emp': 8  };
const CHECKOUT_DATA = { All: 8,  Emp: 3,  'Non Emp': 5  };

const RECENT_VISITORS = [
  { type: 'Visitor',  name: 'Sameer Jain',    contactId: '9823456789', location: 'Corporate Office', status: 'Checked-in',     personToMeet: 'Sunita Reddy', cards: '104',  checkIn: 'Mar 26, 2026, 2:00 PM'  },
  { type: 'Visitor',  name: 'Ananya Singh',   contactId: '9988776655', location: 'Corporate Office', status: 'Checked-in',     personToMeet: 'Sunita Reddy', cards: '101',  checkIn: 'Mar 26, 2026, 9:30 AM'  },
  { type: 'Employee', name: 'Ravi Kumar',     contactId: 'EMP1001',    location: 'Corporate Office', status: 'Checked-in',     personToMeet: 'Sunita Reddy', cards: 'N/A',  checkIn: 'Mar 26, 2026, 9:15 AM'  },
  { type: 'Visitor',  name: 'Priya Sharma',   contactId: '9876543210', location: 'Corporate Office', status: 'Checked-out',    personToMeet: 'Arjun Mehta',  cards: '102',  checkIn: 'Mar 26, 2026, 8:45 AM'  },
  { type: 'Employee', name: 'Karan Patel',    contactId: 'EMP1042',    location: 'Corporate Office', status: 'Checked-in',     personToMeet: '—',            cards: 'N/A',  checkIn: 'Mar 26, 2026, 8:30 AM'  },
];

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

// ── Sidebar / Nav icons ───────────────────────────────────────────────────────

const IconDashboard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const IconVisitors = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconStaff = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconReports = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6"  y1="20" x2="6"  y2="14"/>
  </svg>
);
const IconSettings = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const IconLogout = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconBell = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const IconCalendar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const IconChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const IconPin = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);

const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', Icon: IconDashboard },
  { id: 'visitors',  label: 'Visitors',  Icon: IconVisitors  },
  { id: 'staff',     label: 'Staff',     Icon: IconStaff     },
  { id: 'reports',   label: 'Reports',   Icon: IconReports   },
];

// ── Main Component ────────────────────────────────────────────────────────────

const Dashboard = () => {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('dashboard');
  const [location,       setLocation]       = useState('Corporate Office');
  const [locationOpen,   setLocationOpen]   = useState(false);
  const [checkinFilter,  setCheckinFilter]  = useState('All');
  const [checkoutFilter, setCheckoutFilter] = useState('All');
  const [activeFilter,   setActiveFilter]   = useState('All');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [dateRange,    setDateRange]    = useState({ from: today, to: today });
  const [calendarOpen, setCalendarOpen] = useState(false);
  // 0 = waiting for start click, 1 = waiting for end click
  const selStepRef = useRef(0);

  const locationRef = useRef(null);
  const calendarRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (locationRef.current && !locationRef.current.contains(e.target)) {
        setLocationOpen(false);
      }
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const LOCATIONS = [
    'All Locations',
    'Corporate Office',
    'Branch — Accra',
    'Branch — Kumasi',
    'Warehouse',
  ];

  const rawName =
    localStorage.getItem('userName') ||
    sessionStorage.getItem('userName') ||
    'Admin';
  const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const initials    = displayName.charAt(0).toUpperCase();

  const todayLabel = today.toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const fmtDate = (d) => d ? format(d, 'MMM d, yyyy') : '';
  const dateLabel = dateRange?.from && dateRange?.to
    ? `${fmtDate(dateRange.from)}  –  ${fmtDate(dateRange.to)}`
    : dateRange?.from
    ? `${fmtDate(dateRange.from)}  –  …`
    : 'Select range';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userName');
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('userName');
    navigate('/login');
  };

  return (
    <div className="dashboard">

      {/* ── Sidebar ── */}
      <aside className="dash-sidebar">
        <div className="sidebar-logo">
          <img src={medplusLogo} alt="MedPlus" />
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`nav-item ${activeNav === id ? 'active' : ''}`}
              onClick={() => setActiveNav(id)}
              title={label}
            >
              <Icon />
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item" title="Settings" onClick={() => setActiveNav('settings')}>
            <IconSettings />
          </button>
          <button className="nav-item nav-logout" title="Logout" onClick={handleLogout}>
            <IconLogout />
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="dash-main">

        {/* Topbar */}
        <header className="dash-topbar">
          <div className="topbar-left">
            <h1>Front Desk Overview</h1>
            <p>{todayLabel}</p>
          </div>
          <div className="topbar-right">
            {/* Location filter */}
            <div className="location-dropdown" ref={locationRef}>
              <button
                className={`location-trigger ${locationOpen ? 'open' : ''}`}
                onClick={() => setLocationOpen(o => !o)}
              >
                <IconPin />
                <span>{location}</span>
                <IconChevronDown />
              </button>

              {locationOpen && (
                <div className="location-menu">
                  {LOCATIONS.map(loc => (
                    <button
                      key={loc}
                      className={`location-option ${loc === location ? 'selected' : ''}`}
                      onClick={() => { setLocation(loc); setLocationOpen(false); }}
                    >
                      {loc === location && <span className="option-check">✓</span>}
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date range picker */}
            <div className="date-picker-wrapper" ref={calendarRef}>
              <button
                className="date-trigger"
                onClick={() => {
                  selStepRef.current = 0;
                  setCalendarOpen(o => !o);
                }}
              >
                <IconCalendar />
                <span>{dateLabel}</span>
              </button>

              {calendarOpen && (
                <div className="calendar-panel">
                  <DayPicker
                    mode="single"
                    disabled={{ after: today }}
                    selected={selStepRef.current === 1 ? dateRange.from : undefined}
                    modifiers={{
                      range_start: dateRange.from,
                      range_end:   dateRange.to,
                    }}
                    modifiersClassNames={{
                      range_start: 'day-range-start',
                      range_end:   'day-range-end',
                    }}
                    onDayClick={(day, modifiers) => {
                      if (modifiers.disabled) return;
                      day.setHours(0, 0, 0, 0);
                      if (selStepRef.current === 0) {
                        setDateRange({ from: day, to: undefined });
                        selStepRef.current = 1;
                      } else {
                        const from = dateRange.from;
                        if (day < from) {
                          setDateRange({ from: day, to: from });
                        } else {
                          setDateRange({ from, to: day });
                        }
                        selStepRef.current = 0;
                        setCalendarOpen(false);
                      }
                    }}
                    footer={
                      <p className="cal-footer-hint">
                        {selStepRef.current === 0 ? '① Click a start date' : '② Click an end date'}
                      </p>
                    }
                    numberOfMonths={2}
                    className="brand-calendar"
                  />
                </div>
              )}
            </div>

            <div className="user-pill">
              <div className="user-avatar">{initials}</div>
              <span>{displayName}</span>
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="dash-content">

          {/* ── Row 1: KPI cards ── */}
          <div className="stats-grid">

            {/* Today Check-in's */}
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
                {CHECKIN_DATA[checkinFilter]}
              </span>
            </div>

            {/* Today Check-out's */}
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
                {CHECKOUT_DATA[checkoutFilter]}
              </span>
            </div>

            {/* Active in Building */}
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
              <span className="stat-value" style={{ color: '#32A94C' }}>15</span>
              <div className="stat-footer">
                <span className="live-badge">
                  <span className="live-dot" />
                  Live
                </span>
              </div>
            </div>

          </div>

          {/* ── Row 2: Hero + Chart ── */}
          <div className="dash-row-top">

            {/* Hero card */}
            <div className="hero-card">
              <span className="hero-tag">Today's Summary</span>
              <h2>{greeting},<br />{displayName}.</h2>
              <p>
                You have <strong>8</strong> pending sign-outs and{' '}
                <strong>3</strong> scheduled visits in the next hour.
              </p>
              <button className="hero-cta">
                <IconPlus /> Register Visitor
              </button>
            </div>

            {/* Chart card */}
            <div className="chart-card">
              <div className="chart-header">
                <div>
                  <p className="chart-label">Visitor Flow</p>
                  <p className="chart-sub">Today · Peak at 3pm (28 visitors)</p>
                </div>
                <span className="chart-live-dot" />
              </div>
              <div className="chart-area">
                <VisitorChart data={CHART_DATA} />
              </div>
              <div className="chart-xaxis">
                {CHART_DATA.filter((_, i) => i % 2 === 0).map(d => (
                  <span key={d.hour}>{d.hour}</span>
                ))}
              </div>
            </div>
          </div>

          {/* ── Row 3: Recent visitors table ── */}
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
                  {RECENT_VISITORS.map((v, i) => (
                    <tr key={i}>
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
      </div>{/* end dash-main */}
    </div>
  );
};

export default Dashboard;
