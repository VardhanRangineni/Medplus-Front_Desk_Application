import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './About.css';
import logo from '../../Assets/images/logo.png';
import { APP_SHORT_NAME, LOGIN_BRAND_PRIMARY, LOGIN_BRAND_SECONDARY } from '../../constants/branding';
import { IconX, IconCheckCircle, IconInfo, IconRefreshCw, IconDownload } from '../../components/Icons/Icons';

const APP_VERSION = require('../../../package.json').version ?? '1.0.0';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

function formatSpeed(bytesPerSecond) {
  return formatBytes(bytesPerSecond) + '/s';
}

/* ─── Progress Bar ────────────────────────────────────────────────────────── */

function DownloadProgress({ progress }) {
  const pct = Math.round(progress.percent);
  return (
    <div className="about-progress">
      <div className="about-progress__header">
        <IconDownload size={16} />
        <span>Downloading update…</span>
      </div>
      <div className="about-progress__bar-track">
        <div className="about-progress__bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="about-progress__meta">
        <span>{pct}%</span>
        <span>{formatBytes(progress.transferred)} / {formatBytes(progress.total)}</span>
        <span>{formatSpeed(progress.bytesPerSecond)}</span>
      </div>
    </div>
  );
}

/* ─── Status Badge ────────────────────────────────────────────────────────── */

function StatusBadge({ status, version }) {
  switch (status) {
    case 'up-to-date':
      return (
        <div className="about-status about-status--ok">
          <IconCheckCircle size={18} />
          <span>You're up to date (v{APP_VERSION})</span>
        </div>
      );
    case 'available':
      return (
        <div className="about-status about-status--available">
          <IconDownload size={18} />
          <span>Version {version} is available for download</span>
        </div>
      );
    case 'downloading':
      return null; /* rendered by DownloadProgress */
    case 'ready':
      return (
        <div className="about-status about-status--ready">
          <IconCheckCircle size={18} />
          <span>Update ready. Restart the application to install the latest version.</span>
        </div>
      );
    case 'error':
      return (
        <div className="about-status about-status--error">
          <IconInfo size={18} />
          <span>Unable to check for updates</span>
        </div>
      );
    case 'checking':
    default:
      return (
        <div className="about-status about-status--checking">
          <IconRefreshCw size={18} className="about-status__spin" />
          <span>Checking for updates…</span>
        </div>
      );
  }
}

/* ─── About Modal ─────────────────────────────────────────────────────────── */

export default function About({ onClose }) {
  const [state, setState] = useState(null);
  const [checking, setChecking] = useState(false);

  // Derive UI status from electron-updater state
  const uiStatus = state === null
    ? 'initial'
    : state.downloaded ? 'ready'
    : state.downloadProgress ? 'downloading'
    : state.error ? 'error'
    : state.available ? 'available'
    : state.checking ? 'checking'
    : 'up-to-date';

  const removeListener = useEffect(() => {
    const listener = window.electronAPI?.onUpdateStateChange((s) => {
      setState(s);
      if (!s.checking && !s.downloadProgress) {
        setChecking(false);
      }
    });
    // Also fetch initial state
    window.electronAPI?.getUpdateState().then((s) => setState(s)).catch(() => {});
    return () => {
      listener?.();
    };
  }, []);

  const handleCheckUpdates = useCallback(async () => {
    setChecking(true);
    setState(prev => prev ? { ...prev, checking: true, error: null } : { checking: true, error: null });
    try {
      const result = await window.electronAPI.checkForUpdates();
      if (!result?.ok) {
        setState(prev => ({ ...prev, checking: false, error: result?.error ?? 'Check failed' }));
        setChecking(false);
      }
    } catch (err) {
      setState(prev => ({ ...prev, checking: false, error: err?.message ?? 'Check failed' }));
      setChecking(false);
    }
  }, []);

  const handleRestart = useCallback(() => {
    window.electronAPI.restartToUpdate();
  }, []);

  return createPortal(
    <div
      className="about-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="about-dialog">
        <button className="about-close" onClick={onClose} aria-label="Close"><IconX size={16} /></button>

        {/* Branding */}
        <div className="about-brand">
          <img src={logo} alt="MedPlus" className="about-logo" />
          <h2 className="about-title" id="about-title">{LOGIN_BRAND_PRIMARY}</h2>
          <p className="about-subtitle">{LOGIN_BRAND_SECONDARY}</p>
          <p className="about-version">Version {APP_VERSION}</p>
        </div>

        <div className="about-divider" />

        {/* Update Section */}
        <div className="about-updates">
          <h3 className="about-section-title">Updates</h3>

          {uiStatus === 'downloading' && state.downloadProgress
            ? <DownloadProgress progress={state.downloadProgress} />
            : <StatusBadge status={uiStatus} version={state?.version ?? ''} />
          }

          <div className="about-actions">
            {uiStatus === 'ready' ? (
              <button className="about-btn about-btn--primary" onClick={handleRestart}>
                Restart and Install
              </button>
            ) : (
              <button
                className="about-btn about-btn--secondary"
                onClick={handleCheckUpdates}
                disabled={checking || uiStatus === 'checking' || uiStatus === 'downloading'}
              >
                {checking || uiStatus === 'checking'
                  ? <><IconRefreshCw size={14} className="about-status__spin" /> Checking…</>
                  : 'Check for Updates'
                }
              </button>
            )}
          </div>
        </div>

        <div className="about-divider" />

        {/* Footer */}
        <div className="about-footer">
          <p>© {new Date().getFullYear()} MedPlus. All rights reserved.</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
