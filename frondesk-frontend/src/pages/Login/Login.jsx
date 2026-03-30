import { useState, useEffect, useRef } from 'react';
import './Login.css';
import {
  IconUser, IconLock, IconEye, IconEyeOff,
  IconAlertCircle, IconShield, IconInfo, IconMonitor,
} from '../../components/Icons/Icons';
import logo  from '../../assets/images/logo.png';
import bgImg from '../../assets/images/background 2.png';


export default function LoginPage({ onLoginSuccess }) {
  const [employeeId, setEmployeeId]   = useState('');
  const [password,   setPassword]     = useState('');
  const [showPass,   setShowPass]     = useState(false);
  const [loading,    setLoading]      = useState(false);
  const [error,      setError]        = useState('');
  const [networkInfo, setNetworkInfo] = useState([]);
  const [showInfo,    setShowInfo]    = useState(false);

  const infoPanelRef = useRef(null);

  /* Fetch network info and keep it current via events — no polling */
  useEffect(() => {
    const refresh = () =>
      window.electronAPI?.getNetworkInfo()
        .then(setNetworkInfo)
        .catch(() => setNetworkInfo([]));

    refresh();

    /* Re-fetch when the network comes back online or goes offline */
    window.addEventListener('online',  refresh);
    window.addEventListener('offline', refresh);
    /* Re-fetch when the user switches back to this window
       (covers VPN connect/disconnect, Wi-Fi switch, etc.) */
    window.addEventListener('focus', refresh);

    return () => {
      window.removeEventListener('online',  refresh);
      window.removeEventListener('offline', refresh);
      window.removeEventListener('focus',   refresh);
    };
  }, []);

  /* Close info panel when clicking outside */
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

  const ipv4Networks   = networkInfo.filter((n) => n.family === 'IPv4');
  const primaryNetwork = ipv4Networks[0] ?? null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!employeeId.trim()) { setError('Employee ID is required.');  return; }
    if (!password.trim())   { setError('Password is required.');     return; }

    setError('');
    setLoading(true);

    try {
      /* Always fetch fresh network info at submit time — never use cached state */
      const freshNetwork = await window.electronAPI?.getNetworkInfo()
        .then((list) => list.filter((n) => n.family === 'IPv4')[0] ?? null)
        .catch(() => null);

      /* Also update the info panel to reflect the current network */
      window.electronAPI?.getNetworkInfo()
        .then(setNetworkInfo)
        .catch(() => {});

      const result = await window.electronAPI.apiPost('/api/auth/login', {
        employeeId: employeeId.trim(),
        password,
        ipAddress:  freshNetwork?.ip  ?? '',
        macAddress: freshNetwork?.mac ?? '',
      });

      if (result.ok && result.body?.success) {
        const session = result.body.data;
        await window.electronAPI.storeAuthSession(session);
        onLoginSuccess(session);
      } else if (result.error) {
        setError('Cannot reach the server. Check your network connection.');
      } else {
        const msg = result.body?.message ?? '';
        if (msg.toLowerCase().includes('device') || msg.toLowerCase().includes('mac')) {
          setError('This device is not authorised for your account. Contact your administrator.');
        } else if (msg.toLowerCase().includes('inactive')) {
          setError('Your account is inactive. Please contact your administrator.');
        } else if (msg.toLowerCase().includes('invalid') || result.status === 401) {
          setError('Invalid Employee ID or password. Please try again.');
        } else {
          setError(msg || 'Login failed. Please try again.');
        }
      }
    } catch {
      setError('Cannot reach the server. Check your network connection.');
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
                <span className="login-card__brand-name">MEDPLUS FRONT DESK</span>
              </div>
              <h1 className="login-card__title">Welcome back.</h1>
              <p className="login-card__subtitle">Securely manage visitors, staff ins &amp; outs, and daily office activity with ease and reliability.</p>
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
                  ? <span className="login-spinner" aria-label="Signing in…" />
                  : 'LOG IN →'}
              </button>

            </form>

            <footer className="login-card__footer">
              <IconShield size={12} />
              <span>Locked to this workstation</span>
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
