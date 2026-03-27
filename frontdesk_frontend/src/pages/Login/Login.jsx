import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../../components/Input/Input';
import Button from '../../components/Button/Button';
import Checkbox from '../../components/Checkbox/Checkbox';
import bgImage from '../../assets/Medplus Front desk image 3.png';
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

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await loginUser({ username, password });

      // Persist token based on "Remember me" preference
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('authToken', data.token);
      storage.setItem('userName', data.userName);

      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
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

        {/* Error banner */}
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
    </div>
  );
};

export default Login;
