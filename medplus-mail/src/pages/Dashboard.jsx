import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import EmailList from '../components/EmailList'
import CalendarEvents from '../components/CalendarEvents'
import { dashboardApi } from '../services/api'

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState('inbox')
  const [summary, setSummary] = useState(null)
  /** Unread count is driven entirely by the number of "blue dots" currently
   *  showing in <EmailList/>, so the chip always matches what the user sees. */
  const [unreadCount, setUnreadCount] = useState(0)
  /** Today's event count — initially seeded from the dashboard summary, then
   *  kept in sync by <CalendarEvents/> (it reports its visible today-count
   *  on every change, e.g. after a decline). */
  const [todayEventCount, setTodayEventCount] = useState(0)

  useEffect(() => {
    dashboardApi
      .getDashboard()
      .then((res) => {
        setSummary(res.data)
        setTodayEventCount((res.data?.events || []).length)
      })
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
              <span>
                {unreadCount} unread email{unreadCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="summary-chip">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="2" width="12" height="11" rx="1.5" />
                <path d="M1 6h12M5 1v2M9 1v2" strokeLinecap="round" />
              </svg>
              <span>{todayEventCount} event{todayEventCount !== 1 ? 's' : ''} today</span>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className={`dashboard-content${activeSection === 'calendar' ? ' dashboard-content-calendar' : ''}`}>
          {activeSection === 'inbox' && (
            <EmailList onUnreadCountChange={setUnreadCount} />
          )}
          {activeSection === 'calendar' && (
            <CalendarEvents onTodayCountChange={setTodayEventCount} />
          )}
        </div>
      </main>
    </div>
  )
}
