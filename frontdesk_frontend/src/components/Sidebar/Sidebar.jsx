import React from 'react';
import './Sidebar.css';

// ── Icons ─────────────────────────────────────────────────────────────────────

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
const IconX = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

// ── Nav items config (extend this array to add new pages) ─────────────────────

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', Icon: IconDashboard },
  { id: 'visitors',  label: 'Visitors',  Icon: IconVisitors  },
  { id: 'staff',     label: 'Staff',     Icon: IconStaff     },
  { id: 'reports',   label: 'Reports',   Icon: IconReports   },
];

// ── Sidebar Component ─────────────────────────────────────────────────────────

/**
 * Sidebar — reusable collapsible pill navigation.
 * Expands on desktop hover; slides in as a drawer on mobile.
 *
 * Props:
 *  isOpen      boolean   whether the mobile drawer is open
 *  onClose     fn        closes the mobile drawer
 *  activeNav   string    id of the currently active nav item
 *  onNavChange fn        called with the new nav id
 *  onLogout    fn        called when the logout button is pressed
 */
const Sidebar = ({ isOpen, onClose, activeNav, onNavChange, onLogout }) => {
  const handleNav = (id) => {
    onNavChange(id);
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
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`nav-item ${activeNav === id ? 'active' : ''}`}
              onClick={() => handleNav(id)}
              title={label}
            >
              <Icon />
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            className="nav-item"
            title="Settings"
            onClick={() => handleNav('settings')}
          >
            <IconSettings />
            <span className="nav-label">Settings</span>
          </button>
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
