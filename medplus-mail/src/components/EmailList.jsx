import { useEffect, useState } from 'react'
import { mailApi } from '../services/api'
import EmailDetail from './EmailDetail'
import LoadingSpinner from './LoadingSpinner'

export default function EmailList({ onUnreadCountChange } = {}) {
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  const openMail = (id) => {
    setSelectedId(id)
    // Optimistic: remove the blue dot immediately. The dashboard chip
    // re-counts dots via the useEffect below, so it decrements instantly.
    setEmails(prev => prev.map(m => m.id === id ? { ...m, unread: false } : m))
    // Tell Zimbra the message has been read (fire-and-forget)
    mailApi.markRead(id).catch(() => {/* non-critical — dot already cleared */})
  }

  useEffect(() => {
    loadEmails()
  }, [])

  // Whenever the inbox list changes, report the current unread ("blue dot")
  // count up to the Dashboard so the summary chip stays perfectly in sync
  // with what the user sees.
  useEffect(() => {
    if (typeof onUnreadCountChange === 'function') {
      onUnreadCountChange(emails.filter(m => m.unread).length)
    }
  }, [emails, onUnreadCountChange])

  const loadEmails = () => {
    setLoading(true)
    setError('')
    mailApi
      .getInbox(20)
      .then((res) => setEmails(res.data))
      .catch(() => setError('Failed to load inbox. Check your session.'))
      .finally(() => setLoading(false))
  }

  return (
    <div className="section-container">
      {selectedId ? (
        <EmailDetail mailId={selectedId} onBack={() => setSelectedId(null)} />
      ) : (
        <>
          <div className="section-header">
            <div>
              <h2 className="section-title">Inbox</h2>
              <p className="section-subtitle">Your recent messages</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={loadEmails} disabled={loading}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 7a6 6 0 1 0 .75-2.9" strokeLinecap="round" />
                <path d="M1 2v3h3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Refresh
            </button>
          </div>

          {loading && <LoadingSpinner text="Loading inbox…" />}
          {error && <div className="alert alert-error">{error}</div>}

          {!loading && !error && emails.length === 0 && (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="4" y="10" width="40" height="28" rx="4" />
                <path d="M4 18l20 14 20-14" />
              </svg>
              <p>No emails in your inbox</p>
            </div>
          )}

          {!loading && !error && emails.length > 0 && (
            <div className="email-list">
              {emails.map((mail) => (
                <button
                  key={mail.id}
                  className={`email-item ${mail.unread ? 'email-unread' : ''}`}
                  onClick={() => openMail(mail.id)}
                >
                  <div className="email-avatar">
                    {(mail.fromName || mail.from || '?')[0].toUpperCase()}
                  </div>
                  <div className="email-content">
                    <div className="email-header-row">
                      <span className="email-from">
                        {mail.fromName || mail.from}
                      </span>
                      <span className="email-date">{mail.date}</span>
                    </div>
                    <div className="email-subject">{mail.subject || '(No subject)'}</div>
                    {mail.preview && (
                      <div className="email-preview">{mail.preview}</div>
                    )}
                  </div>
                  {mail.unread && <span className="email-badge" />}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
