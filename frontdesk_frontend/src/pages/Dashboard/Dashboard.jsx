import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import './Dashboard.css';
import Topbar  from '../../components/Topbar/Topbar';
import Sidebar from '../../components/Sidebar/Sidebar';
import { getLocations } from '../../api/dashboardApi';

// ── Page name map (pathname → human-readable title for the topbar) ────────────
const PAGE_NAMES = {
  '/location-master':  'Location Master',
  '/user-management':  'User Management',
  '/reports':          'Reports',
};

// ── Dashboard layout shell ────────────────────────────────────────────────────
const Dashboard = () => {
  const navigate     = useNavigate();
  const { pathname } = useLocation();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [location,      setLocation]      = useState('Corporate Office');
  const [locations,     setLocations]     = useState(['Corporate Office']);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [dateRange, setDateRange] = useState({ from: today, to: today });

  // Fetch available locations once on mount (shared by Topbar dropdown)
  useEffect(() => {
    getLocations().then(setLocations).catch(console.error);
  }, []);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const rawName     = localStorage.getItem('userName') || sessionStorage.getItem('userName') || 'Admin';
  const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const initials    = displayName.charAt(0).toUpperCase();

  const todayLabel = today.toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // Derived page name for topbar breadcrumb (null on the dashboard home)
  const pageName = PAGE_NAMES[pathname] ?? null;

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userName');
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('userName');
    navigate('/login');
  };

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
        pageName={pageName}
        onMenuOpen={() => setMobileNavOpen(true)}
      />

      {/* ── Body: sidebar + scrollable content ── */}
      <div className="dash-body">

        {/* ── Sidebar ── */}
        <Sidebar
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          onLogout={handleLogout}
        />

        {/* ── Routed content via React Router Outlet ── */}
        <div className="dash-content">
          <Outlet context={{ location, dateRange }} />
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
