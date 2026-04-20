import { useEffect, useState } from 'react'
import { mailApi } from '../services/api'
import LoadingSpinner from './LoadingSpinner'

// Human-readable file size (e.g. 1536 → "1.5 KB")
function formatSize(bytes) {
  if (!bytes || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let val = bytes
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024
    i++
  }
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`
}

export default function EmailDetail({ mailId, onBack }) {
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
    <div className="mail-reader">
      <div className="mail-reader-toolbar">
        <button
          className="mail-reader-back"
          onClick={onBack}
          aria-label="Back to inbox"
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 4L6 10l6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Back to Inbox</span>
        </button>
      </div>

      {loading && <LoadingSpinner text="Loading email…" />}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && mail && (
        <div className="mail-reader-content">
          <h1 className="mail-reader-subject">
            {mail.subject || '(No subject)'}
          </h1>

          <div className="mail-reader-header">
            <div className="mail-reader-avatar">
              {(mail.fromName || mail.from || '?')[0].toUpperCase()}
            </div>
            <div className="mail-reader-sender">
              <div className="mail-reader-from">
                <span className="mail-reader-name">
                  {mail.fromName || mail.from}
                </span>
                {mail.fromName && (
                  <span className="mail-reader-email">&lt;{mail.from}&gt;</span>
                )}
              </div>
              {mail.to && (
                <div className="mail-reader-to">to {mail.to}</div>
              )}
            </div>
            <div className="mail-reader-date">{mail.date}</div>
          </div>

          <div className="mail-reader-body">
            {mail.bodyHtml ? (
              <div
                className="mail-html"
                dangerouslySetInnerHTML={{ __html: mail.bodyHtml }}
              />
            ) : (
              <pre className="mail-text">{mail.bodyText || '(No content)'}</pre>
            )}
          </div>

          {/* Attachments — only rendered when the mail has any */}
          {mail.attachments && mail.attachments.length > 0 && (
            <div className="mail-attachments">
              <div className="mail-attachments-title">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M9.5 3.5L4.3 8.7a2 2 0 0 0 2.8 2.8l5.4-5.4a3.5 3.5 0 0 0-5-5L2.3 6.4a5 5 0 0 0 7 7L13 10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  {mail.attachments.length} attachment
                  {mail.attachments.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="mail-attachments-list">
                {mail.attachments.map((att) => (
                  <a
                    key={`${att.partId}`}
                    className="mail-attachment"
                    href={mailApi.attachmentUrl(att.messageId, att.partId, att.filename)}
                    download={att.filename || 'attachment'}
                    title={`Download ${att.filename || 'attachment'}`}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M12 5.5L6.5 11a2.5 2.5 0 1 0 3.5 3.5L15 9.5a4.5 4.5 0 1 0-6.4-6.4L3.5 8.2a6 6 0 0 0 8.5 8.5L16.5 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="mail-attachment-meta">
                      <div className="mail-attachment-name">
                        {att.filename || '(unnamed)'}
                      </div>
                      <div className="mail-attachment-size">
                        {att.contentType}{att.size ? ` · ${formatSize(att.size)}` : ''}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
