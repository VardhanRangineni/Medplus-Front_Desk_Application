import React from 'react';
import medplusLogo from '../../assets/MedPlus.png';
import './Topbar.css';

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconMenu = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="3" y1="6"  x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

// ── Topbar Component ──────────────────────────────────────────────────────────

/**
 * Topbar — fixed header pill with brand logo, title, and user display.
 *
 * Props:
 *  displayName  string   full display name for the user pill
 *  initials     string   single-char initials for the avatar
 *  todayLabel   string   formatted date string shown under the brand title
 *  onMenuOpen   fn       called when the mobile hamburger is tapped
 */
const Topbar = ({
  displayName,
  initials,
  todayLabel,
  onMenuOpen,
}) => {

  return (
    <header className="dash-topbar">

      {/* Left: hamburger (mobile) + logo + title */}
      <div className="topbar-left">
        <button className="mobile-menu-btn" onClick={onMenuOpen} aria-label="Open menu">
          <IconMenu />
        </button>
        <img src={medplusLogo} alt="MedPlus" className="topbar-brand-logo" />
        <div className="topbar-title">
          <h1>Front Desk</h1>
          <p>{todayLabel}</p>
        </div>
      </div>

      {/* Right: user pill */}
      <div className="topbar-right">
        <div className="user-pill">
          <div className="user-avatar">{initials}</div>
          <span>{displayName}</span>
        </div>
      </div>

    </header>
  );
};

export default Topbar;
