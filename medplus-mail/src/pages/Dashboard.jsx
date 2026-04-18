import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import EmailList from '../components/EmailList'
import CalendarEvents from '../components/CalendarEvents'
import { dashboardApi } from '../services/api'

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState('inbox')
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    dashboardApi
      .getDashboard()
      .then((res) => setSummary(res.data))
      .catch(() => {})
  }, [])

  return (
    <div className="dashboard">
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />

      <main className="dashboard-main">
        {/* Summary bar */}
        {summary && (
          <div className="summary-bar">
            <div className="summary-chip">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="3" width="12" height="8" rx="1.5" />
                <path d="M1 5l6 4 6-4" />
              </svg>
              <span>{summary.emails.length} recent email{summary.emails.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="summary-chip">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="2" width="12" height="11" rx="1.5" />
                <path d="M1 6h12M5 1v2M9 1v2" strokeLinecap="round" />
              </svg>
              <span>{summary.events.length} event{summary.events.length !== 1 ? 's' : ''} today</span>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className={`dashboard-content${activeSection === 'calendar' ? ' dashboard-content-calendar' : ''}`}>
          {activeSection === 'inbox' && <EmailList />}
          {activeSection === 'calendar' && <CalendarEvents />}
        </div>
      </main>
    </div>
  )
}
