import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Sidebar.css';

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconHome = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/>
    <polyline points="9 21 9 12 15 12 15 21"/>
  </svg>
);
const IconDashboard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const IconLocations = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
    <circle cx="12" cy="9" r="2.5"/>
  </svg>
);
const IconUserManagement = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
  </svg>
);
const IconUserMaster = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
    <line x1="16" y1="3" x2="22" y2="3"/>
    <line x1="16" y1="7" x2="22" y2="7"/>
    <line x1="16" y1="11" x2="22" y2="11"/>
  </svg>
);
const IconReports = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6"  y1="20" x2="6"  y2="14"/>
  </svg>
);
const IconLogout = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const IconX = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

// ── Route map: nav ID → path ──────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'dashboard',       label: 'Dashboard',        path: '/dashboard',       Icon: IconDashboard      },
  { id: 'home',            label: 'Home',             path: '/home',            Icon: IconHome           },
  { id: 'location-master', label: 'Locations Master', path: '/location-master', Icon: IconLocations      },
  { id: 'user-master',     label: 'User Master',      path: '/user-master',     Icon: IconUserMaster     },
  { id: 'user-management', label: 'User Management',  path: '/user-management', Icon: IconUserManagement },
  { id: 'reports',         label: 'Reports',          path: '/reports',         Icon: IconReports        },
];

// ── Sidebar Component ─────────────────────────────────────────────────────────

/**
 * Sidebar — reusable collapsible pill navigation driven by React Router.
 *
 * Props:
 *  isOpen   boolean  whether the mobile drawer is open
 *  onClose  fn       closes the mobile drawer
 *  onLogout fn       called when the logout button is pressed
 */
const Sidebar = ({ isOpen, onClose, onLogout }) => {
  const navigate     = useNavigate();
  const { pathname } = useLocation();

  const isActive = (path) => {
    if (path === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(path);
  };

  const handleNav = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      <aside className={`dash-sidebar${isOpen ? ' sidebar-open' : ''}`}>

        {/* Close button – mobile drawer only */}
        <div className="sidebar-mobile-header">
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
            <IconX />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ id, label, path, Icon }) => (
            <button
              key={id}
              className={`nav-item ${isActive(path) ? 'active' : ''}`}
              onClick={() => handleNav(path)}
              title={label}
              aria-current={isActive(path) ? 'page' : undefined}
            >
              <Icon />
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item nav-logout" title="Logout" onClick={onLogout}>
            <IconLogout />
            <span className="nav-label">Logout</span>
          </button>
        </div>

      </aside>

      {/* Overlay – mobile only */}
      {isOpen && (
        <div className="sidebar-overlay" onClick={onClose} aria-hidden="true" />
      )}
    </>
  );
};

export default Sidebar;
