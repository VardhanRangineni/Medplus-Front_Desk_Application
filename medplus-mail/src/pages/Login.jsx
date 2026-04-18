import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../services/api'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await authApi.login(email, password)
      // sessionId is in an HttpOnly cookie — JS cannot read it (intentional).
      // Store only the email for display purposes.
      sessionStorage.setItem('zimbraUser', res.data.email)
      navigate('/dashboard')
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Too many login attempts. Please try again in 15 minutes.')
      } else {
        const msg =
          err.response?.data?.message ||
          err.response?.data ||
          'Invalid credentials. Please try again.'
        setError(typeof msg === 'string' ? msg : 'Login failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#2563eb" />
              <path d="M6 10l10 8 10-8" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <rect x="6" y="10" width="20" height="14" rx="2" stroke="white" strokeWidth="2" fill="none" />
            </svg>
          </div>
          <h1 className="login-title">Medplus Mail</h1>
          <p className="login-subtitle">Sign in to your Zimbra account</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && (
            <div className="alert alert-error" role="alert">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0V5zm.75 6.5a.75.75 0 110-1.5.75.75 0 010 1.5z" />
              </svg>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? (
              <span className="btn-spinner">
                <span className="spinner spinner-sm" />
                Signing in…
              </span>
            ) : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
