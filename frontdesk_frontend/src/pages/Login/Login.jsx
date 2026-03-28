import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../../components/Input/Input';
import Button from '../../components/Button/Button';
import Checkbox from '../../components/Checkbox/Checkbox';
import bgImage from '../../assets/Medplus Front desk image 2.png';
import medplusLogo from '../../assets/MedPlus.png';
import { loginUser } from '../../api/authApi';
import './Login.css';

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const NetworkIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="2"/>
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ipBlocked, setIpBlocked] = useState(false);

  // IP collection state
  const [userIp, setUserIp] = useState('');
  const [ipLoading, setIpLoading] = useState(true);
  const [ipFetchFailed, setIpFetchFailed] = useState(false);
  const [showIpModal, setShowIpModal] = useState(false);
  const [ipCopied, setIpCopied] = useState(false);

  const navigate = useNavigate();

  // Fetch the network's public IP on mount.
  // Public IP is the same for ALL devices on the same network (office WiFi,
  // LAN, etc.) — this is what gets stored for IP-based access control so
  // that login can be restricted to the office network as a whole.
  useEffect(() => {
    let cancelled = false;

    const fetchIp = async () => {
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        if (!cancelled) setUserIp(data.ip);
      } catch {
        if (!cancelled) setIpFetchFailed(true);
      } finally {
        if (!cancelled) setIpLoading(false);
      }
    };

    fetchIp();
    return () => { cancelled = true; };
  }, []);

  const handleCopyIp = async () => {
    if (!userIp) return;
    try {
      await navigator.clipboard.writeText(userIp);
      setIpCopied(true);
      setTimeout(() => setIpCopied(false), 2500);
    } catch {
      // clipboard API blocked in non-secure context — silently ignore
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIpBlocked(false);
    setLoading(true);

    try {
      const data = await loginUser({ username, password });

      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('authToken', data.token);
      storage.setItem('userName', data.userName);
      if (userIp) storage.setItem('userIp', userIp);

      navigate('/dashboard');
    } catch (err) {
      if (err.errorCode === 'IP_NOT_ALLOWED') {
        setIpBlocked(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" style={{ backgroundImage: `url(${bgImage})` }}>
      <div className="login-card">

        {/* Header / Logo section */}
        <div className="login-header">
          <div className="logo">
            <img src={medplusLogo} alt="MedPlus" className="logo-img" />
            <span>MEDPLUS FRONT DESK</span>
          </div>
        </div>

        <div className="login-divider" />

        {/* Welcome Text */}
        <div className="login-welcome">
          <h2>Welcome back.</h2>
          <p>
            Securely manage visitors, staff ins &amp; outs, and daily office activity with ease and reliability.
          </p>
        </div>

        {/* Generic error banner */}
        {error && (
          <div className="login-error" role="alert">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {/* IP-blocked error banner */}
        {ipBlocked && (
          <div className="login-error login-error--ip" role="alert">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>
              <strong>Network not authorised.</strong> Your current IP
              {userIp ? ` (${userIp})` : ''} is not allowed to access this
              account. Please connect to the authorised office network.
            </span>
          </div>
        )}

        {/* Form */}
        <form className="login-form" onSubmit={handleLogin}>
          <Input
            type="text"
            label="Employee ID"
            placeholder="Enter your employee ID"
            leftIcon={<MailIcon />}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            type="password"
            label="Password"
            placeholder="Enter your password"
            leftIcon={<LockIcon />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" variant="primary" loading={loading}>
            Log In <ArrowIcon />
          </Button>
        </form>
      </div>

      {/* ── IP Info Button — bottom-left of the page ── */}
      <button
        className="ip-info-btn"
        onClick={() => setShowIpModal(true)}
        title="View your network IP address"
        aria-label="View your network IP address"
      >
        <InfoIcon />
        <span className="ip-info-btn-label">
          {ipLoading ? 'Detecting IP…' : ipFetchFailed ? 'IP unavailable' : userIp}
        </span>
      </button>

      {/* ── IP Info Modal ── */}
      {showIpModal && (
        <div
          className="ip-modal-overlay"
          onClick={() => setShowIpModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Network IP information"
        >
          <div className="ip-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="ip-modal-close"
              onClick={() => setShowIpModal(false)}
              aria-label="Close"
            >
              <CloseIcon />
            </button>

            <div className="ip-modal-icon-wrap">
              <NetworkIcon />
            </div>

            <h3 className="ip-modal-title">Your Network IP</h3>
            <p className="ip-modal-desc">
              This is your network's public IP address — shared by all devices
              connected to the same WiFi or office network. MedPlus uses this
              to restrict login to your authorised office network only.
            </p>

            <div className="ip-modal-divider" />

            <div className="ip-address-block">
              <span className="ip-address-label">Public IP Address</span>
              {ipLoading ? (
                <div className="ip-address-loading">
                  <span className="ip-spinner" />
                  Detecting your IP…
                </div>
              ) : ipFetchFailed ? (
                <div className="ip-address-error">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  Could not detect IP address
                </div>
              ) : (
                <div className="ip-address-row">
                  <span className="ip-address-value">{userIp}</span>
                  <button
                    className={`ip-copy-btn ${ipCopied ? 'copied' : ''}`}
                    onClick={handleCopyIp}
                    title={ipCopied ? 'Copied!' : 'Copy IP address'}
                  >
                    {ipCopied ? <CheckIcon /> : <CopyIcon />}
                    {ipCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>

            <div className="ip-modal-note">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              Your IP is automatically sent with your login request and
              stored securely for access control purposes.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
