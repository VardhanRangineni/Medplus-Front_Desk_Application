import { useNavigate } from 'react-router-dom'
import { authApi } from '../services/api'

export default function Sidebar({ activeSection, onSectionChange }) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await authApi.logout()   // clears HttpOnly cookie server-side
    } catch (_) {
      // Proceed even if server-side invalidation fails
    } finally {
      sessionStorage.removeItem('zimbraUser')
      navigate('/login')
    }
  }

  const navItems = [
    {
      id: 'inbox',
      label: 'Inbox',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="4" width="14" height="10" rx="2" />
          <path d="M2 7l7 5 7-5" />
        </svg>
      ),
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="3" width="14" height="13" rx="2" />
          <path d="M6 2v2M12 2v2M2 7h14" />
        </svg>
      ),
    },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#2563eb" />
            <path d="M6 10l10 8 10-8" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <rect x="6" y="10" width="20" height="14" rx="2" stroke="white" strokeWidth="2" fill="none" />
          </svg>
        </div>
        <span className="sidebar-brand-name">Medplus Mail</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-nav-item ${activeSection === item.id ? 'active' : ''}`}
            onClick={() => onSectionChange(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-logout" onClick={handleLogout}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 2h3a1 1 0 011 1v10a1 1 0 01-1 1h-3M7 11l3-3-3-3M10 8H2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  )
}
