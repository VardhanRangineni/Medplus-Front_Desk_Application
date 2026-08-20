import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './AppHeader.css';
import logo from '../../Assets/images/logo.png';
import { APP_SHORT_NAME } from '../../constants/branding';
import { IconMapPin, IconLock, IconEye, IconEyeOff, IconX, IconMonitor, IconInfo } from '../Icons/Icons';
import { changeOwnPassword } from '../../services/accountService';
import LocationSelector from '../LocationSelector/LocationSelector';
import About from '../../pages/Settings/About';

function formatDate(date) {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ─── Change Password Modal ────────────────────────────────────────────────────
function ChangePasswordModal({ onClose }) {
  const [currentPw,  setCurrentPw]  = useState('');
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [showCur,    setShowCur]    = useState(false);
  const [showNew,    setShowNew]    = useState(false);
  const [showConf,   setShowConf]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState(false);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!currentPw)              { setError('Please enter your current password.'); return; }
    if (newPw.length < 4)        { setError('New password must be at least 4 characters.'); return; }
    if (newPw !== confirmPw)     { setError('New passwords do not match.'); return; }
    if (newPw === currentPw)     { setError('New password must be different from the current one.'); return; }

    setSaving(true);
    try {
      await changeOwnPassword(currentPw, newPw);
      setSuccess(true);
      setTimeout(onClose, 1600);
    } catch (err) {
      setError(err?.message || 'Failed to change password. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div
      className="cpm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cpm-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="cpm-dialog">

        <div className="cpm-header">
          <div>
            <h2 className="cpm-title" id="cpm-title">Change Password</h2>
            <p className="cpm-sub">Enter your current password then choose a new one.</p>
          </div>
          <button className="cpm-close" onClick={onClose} aria-label="Close"><IconX size={16} /></button>
        </div>

        <form className="cpm-body" onSubmit={handleSubmit} autoComplete="off">

          {success ? (
            <div className="cpm-success">
              <span className="cpm-success__icon">✅</span>
              <p className="cpm-success__text">Password changed successfully!</p>
            </div>
          ) : (
            <>
              {error && <p className="cpm-error">{error}</p>}

              {/* Current Password */}
              <div className="cpm-field">
                <label className="cpm-label">Current Password <span className="cpm-req">*</span></label>
                <div className="cpm-input-wrap">
                  <IconLock size={14} className="cpm-input-icon" />
                  <input
                    className="cpm-input"
                    type={showCur ? 'text' : 'password'}
                    placeholder="Enter current password"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    autoFocus
                  />
                  <button type="button" className="cpm-eye" onClick={() => setShowCur(v => !v)} tabIndex={-1}>
                    {showCur ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="cpm-field">
                <label className="cpm-label">New Password <span className="cpm-req">*</span></label>
                <div className="cpm-input-wrap">
                  <IconLock size={14} className="cpm-input-icon" />
                  <input
                    className="cpm-input"
                    type={showNew ? 'text' : 'password'}
                    placeholder="Enter new password (min 4 chars)"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                  />
                  <button type="button" className="cpm-eye" onClick={() => setShowNew(v => !v)} tabIndex={-1}>
                    {showNew ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="cpm-field">
                <label className="cpm-label">Confirm New Password <span className="cpm-req">*</span></label>
                <div className="cpm-input-wrap">
                  <IconLock size={14} className="cpm-input-icon" />
                  <input
                    className="cpm-input"
                    type={showConf ? 'text' : 'password'}
                    placeholder="Re-enter new password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                  />
                  <button type="button" className="cpm-eye" onClick={() => setShowConf(v => !v)} tabIndex={-1}>
                    {showConf ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                  </button>
                </div>
              </div>

              <div className="cpm-footer">
                <button type="button" className="cpm-btn cpm-btn--cancel" onClick={onClose} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="cpm-btn cpm-btn--submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Change Password'}
                </button>
              </div>
            </>
          )}
        </form>

      </div>
    </div>,
    document.body,
  );
}

// ─── AppHeader ────────────────────────────────────────────────────────────────

/**
 * AppHeader — floating glass header used across all app screens.
 *
 * Props:
 *   session              – login session
 *   showLocationFilter     – interactive location picker
 *   locationId             – selected location (null = all, admin only)
 *   onLocationChange       – (locationId) => void
 *   allowedLocationIds     – restrict picker options (supervisor multi-site)
 *   allowAllLocations      – show "All Locations" (primary admin)
 */
export default function AppHeader({
  session,
  showLocationFilter = false,
  locationId = null,
  onLocationChange,
  allowedLocationIds = null,
  allowAllLocations = true,
}) {
  const dateStr  = formatDate(new Date());
  const initial  = (session?.fullName?.[0] ?? session?.employeeId?.[0] ?? 'A').toUpperCase();
  const device   = session?.deviceName ?? null;
  const location = session?.locationName || session?.locationId || null;

  const [menuOpen,  setMenuOpen]  = useState(false);
  const [showCpModal, setShowCpModal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const userRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function onOutside(e) {
      if (userRef.current && !userRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [menuOpen]);

  return (
    <>
      <header className="app-header">
        <div className="app-header__left">
          <img src={logo} alt="MedPlus" className="app-header__logo" />
          <div>
            <h1 className="app-header__title">{APP_SHORT_NAME}</h1>
            <p className="app-header__date">{dateStr}</p>
          </div>
        </div>

        <div className="app-header__right">
          {device && (
            <div className="app-header__location app-header__device">
              <IconMonitor size={13} />
              <span className="app-header__location-name">{device}</span>
            </div>
          )}
          {showLocationFilter ? (
            <div className="app-header__location-filter">
              <LocationSelector
                session={session}
                value={locationId}
                onChange={onLocationChange}
                menuAlign="right"
                compact
                allowedLocationIds={allowedLocationIds}
                allowAll={allowAllLocations}
              />
            </div>
          ) : location ? (
            <div className="app-header__location" title={location}>
              <IconMapPin size={13} />
              <span className="app-header__location-name">{location}</span>
            </div>
          ) : null}

          {/* Clickable user block */}
          <div
            ref={userRef}
            className={`app-header__user${menuOpen ? ' app-header__user--open' : ''}`}
            onClick={() => setMenuOpen(v => !v)}
            role="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setMenuOpen(v => !v); }}
          >
            <div className="app-header__avatar">{initial}</div>
            <span className="app-header__username">
              {session?.fullName ?? session?.employeeId}
            </span>
            <span className="app-header__user-caret">▾</span>

            {menuOpen && (
              <div className="app-header__menu" role="menu">
                <button
                  className="app-header__menu-item"
                  role="menuitem"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setShowCpModal(true); }}
                >
                  <IconLock size={13} />
                  Change Password
                </button>
                <button
                  className="app-header__menu-item"
                  role="menuitem"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setShowAbout(true); }}
                >
                  <IconInfo size={13} />
                  About
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showCpModal && <ChangePasswordModal onClose={() => setShowCpModal(false)} />}
      {showAbout && <About onClose={() => setShowAbout(false)} />}
    </>
  );
}
