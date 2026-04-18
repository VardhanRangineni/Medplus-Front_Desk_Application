import { useEffect, useState } from 'react'
import { mailApi } from '../services/api'
import LoadingSpinner from './LoadingSpinner'

export default function EmailDetail({ mailId, onClose }) {
  const [mail, setMail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!mailId) return
    setLoading(true)
    setError('')
    mailApi
      .getMail(mailId)
      .then((res) => setMail(res.data))
      .catch(() => setError('Failed to load email.'))
      .finally(() => setLoading(false))
  }, [mailId])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {loading ? 'Loading…' : (mail?.subject || '(No subject)')}
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l12 12M16 4L4 16" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {loading && <LoadingSpinner text="Loading email…" />}
          {error && <div className="alert alert-error">{error}</div>}
          {!loading && !error && mail && (
            <>
              <div className="mail-meta">
                <div className="mail-meta-row">
                  <span className="mail-meta-label">From</span>
                  <span>{mail.fromName ? `${mail.fromName} <${mail.from}>` : mail.from}</span>
                </div>
                {mail.to && (
                  <div className="mail-meta-row">
                    <span className="mail-meta-label">To</span>
                    <span>{mail.to}</span>
                  </div>
                )}
                <div className="mail-meta-row">
                  <span className="mail-meta-label">Date</span>
                  <span>{mail.date}</span>
                </div>
              </div>

              <div className="mail-body">
                {mail.bodyHtml ? (
                  <div
                    className="mail-html"
                    dangerouslySetInnerHTML={{ __html: mail.bodyHtml }}
                  />
                ) : (
                  <pre className="mail-text">{mail.bodyText || '(No content)'}</pre>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
