import { useState, useEffect, useRef } from 'react';
import './Login.css';
import {
  IconUser, IconLock, IconEye, IconEyeOff,
  IconAlertCircle, IconShield, IconInfo, IconMonitor,
} from '../../components/Icons/Icons';
import logo  from '../../Assets/images/logo.png';
import bgImg from '../../Assets/images/background 2.png';
import { LOGIN_BRAND_PRIMARY, LOGIN_BRAND_SECONDARY } from '../../constants/branding';
import { getLoginErrorMessage } from '../../services/userFacingErrors';
import LottieLoader from '../../components/LottieLoader/LottieLoader';
const APP_VERSION = require('../../../package.json').version ?? '1.0.0';


export default function LoginPage({ onLoginSuccess }) {
  const [employeeId, setEmployeeId]   = useState('');
  const [password,   setPassword]     = useState('');
  const [showPass,   setShowPass]     = useState(false);
  const [loading,    setLoading]      = useState(false);
  const [error,      setError]        = useState('');
  const [networkInfo, setNetworkInfo] = useState([]);
  const [showInfo,    setShowInfo]    = useState(false);

  const infoPanelRef = useRef(null);

  const isIPv4 = (n) => n.family === 'IPv4' || n.family === 4;

  /* Fetch network info and keep it current via events */
  useEffect(() => {
    const refresh = async () => {
      if (!window.electronAPI?.getNetworkInfo) {
        setNetworkInfo([]);
        return;
      }
      try {
        const list = await window.electronAPI.getNetworkInfo();
        setNetworkInfo(Array.isArray(list) ? list : []);
      } catch {
        setNetworkInfo([]);
      }
    };

    refresh();
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    window.addEventListener('focus', refresh);

    return () => {
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  useEffect(() => {
    if (!showInfo) return;
    const handleOutsideClick = (e) => {
      if (infoPanelRef.current && !infoPanelRef.current.contains(e.target)) {
        setShowInfo(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showInfo]);

  const ipv4Networks = networkInfo.filter(isIPv4);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!employeeId.trim()) {
      setError(getLoginErrorMessage('validation', 'Please enter your Employee ID.'));
      return;
    }
    if (!password.trim()) {
      setError(getLoginErrorMessage('validation', 'Please enter your password.'));
      return;
    }

    if (!window.electronAPI?.apiPost) {
      setError(getLoginErrorMessage('desktop'));
      return;
    }

    setError('');
    setLoading(true);

    try {
      let freshNetwork = null;
      try {
        const list = await window.electronAPI.getNetworkInfo();
        const normalized = Array.isArray(list) ? list : [];
        setNetworkInfo(normalized);
        freshNetwork = normalized.filter(isIPv4)[0] ?? null;
      } catch {
        freshNetwork = null;
      }

      const result = await window.electronAPI.apiPost('/api/auth/login', {
        employeeId: employeeId.trim(),
        password,
        ipAddress:  freshNetwork?.ip ?? '',
        macAddress: freshNetwork?.mac ?? '',
      });

      if (result.ok && result.body?.success) {
        const session = result.body.data;
        await window.electronAPI.storeAuthSession(session);
        onLoginSuccess(session);
      } else if (result.error || result.status === 0) {
        setError(getLoginErrorMessage('connection'));
      } else {
        const msg = result.body?.message ?? '';
        const lower = msg.toLowerCase();
        if (lower.includes('device') || lower.includes('mac') || lower.includes('workstation')) {
          setError(getLoginErrorMessage('device'));
        } else if (lower.includes('inactive') || lower.includes('disabled')) {
          setError(getLoginErrorMessage('inactive'));
        } else if (lower.includes('invalid') || lower.includes('credential') || result.status === 401) {
          setError(getLoginErrorMessage('credentials'));
        } else {
          setError(getLoginErrorMessage('generic', msg));
        }
      }
    } catch {
      setError(getLoginErrorMessage('connection'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root" style={{ backgroundImage: `url(${bgImg})` }}>

      <div className="login-scrim" aria-hidden="true" />

      <div className="login-layout">

        <div className="login-left" aria-hidden="true" />

        <aside className="login-right">
          <div className="login-card">

            <header className="login-card__header">
              <div className="login-card__brand">
                <img src={logo} alt="MedPlus logo" className="login-card__logo" />
                <div className="login-card__brand-text">
                  <span className="login-card__brand-name">{LOGIN_BRAND_PRIMARY}</span>
                  <span className="login-card__brand-tagline">{LOGIN_BRAND_SECONDARY}</span>
                </div>
              </div>
              <h1 className="login-card__title">Welcome back.</h1>
              <p className="login-card__subtitle">Securely manage visitors, staff ins &amp; outs, and daily office activity with ease and reliability.</p>
              <p className="login-card__subtitle login-card__subtitle--ota">Now with OTA updates — stays up to date automatically.</p>
            </header>

            <form className="login-form" onSubmit={handleSubmit} noValidate>

              <div className="login-field">
                <label className="login-label" htmlFor="employeeId">Employee ID</label>
                <div className="login-input-wrap">
                  <IconUser className="login-input-icon" />
                  <input
                    id="employeeId"
                    type="text"
                    className="login-input"
                    placeholder="Enter your employee ID"
                    value={employeeId}
                    onChange={(e) => { setEmployeeId(e.target.value); setError(''); }}
                    autoComplete="username"
                    autoFocus
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="login-field">
                <label className="login-label" htmlFor="password">Password</label>
                <div className="login-input-wrap">
                  <IconLock className="login-input-icon" />
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    className="login-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="login-eye-btn"
                    onClick={() => setShowPass((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    {showPass ? <IconEyeOff size={15} /> : <IconEye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="login-error" role="alert" aria-live="polite">
                  <IconAlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" className="login-submit" disabled={loading}>
                {loading
                  ? <LottieLoader size="sm" tone="light" className="login-submit__spinner" ariaLabel="Signing in…" />
                  : 'LOG IN →'}
              </button>

            </form>

            <footer className="login-card__footer">
              <IconShield size={12} />
              <span>Locked to this workstation</span>
              <span className="login-card__version">v{APP_VERSION}</span>
            </footer>

          </div>
        </aside>
      </div>

      <div className="login-info-wrap" ref={infoPanelRef}>
        {showInfo && (
          <div className="login-info-panel" role="dialog" aria-label="Workstation details">
            <div className="login-info-panel__header">
              <IconMonitor size={13} />
              <span>Workstation · IPv4</span>
            </div>
            {ipv4Networks.length === 0
              ? <p className="login-info-panel__empty">No IPv4 interface found.</p>
              : ipv4Networks.map((iface, i) => (
                <div key={i} className="login-iface">
                  <p className="login-iface__name">{iface.interface}</p>
                  <div className="login-iface__row">
                    <span>IP</span><span>{iface.ip}</span>
                  </div>
                  <div className="login-iface__row">
                    <span>MAC</span><span className="mono">{iface.mac}</span>
                  </div>
                </div>
              ))
            }
          </div>
        )}
        <button
          className="login-info-btn"
          onClick={() => setShowInfo((v) => !v)}
          aria-label="Show workstation info"
          aria-expanded={showInfo}
        >
          <IconInfo size={16} />
        </button>
      </div>
    </div>
  );
}
