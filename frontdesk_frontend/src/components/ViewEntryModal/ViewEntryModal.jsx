import React, { useEffect, useRef } from 'react';
import './ViewEntryModal.css';

// ── Focus trap ─────────────────────────────────────────────────────────────────

function useFocusTrap(ref, isActive) {
  useEffect(() => {
    if (!isActive || !ref.current) return;
    const el        = ref.current;
    const focusable = el.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    first?.focus();
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
      }
    };
    el.addEventListener('keydown', trap);
    return () => el.removeEventListener('keydown', trap);
  }, [ref, isActive]);
}

// ── Icons ──────────────────────────────────────────────────────────────────────

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconUserPlaceholder = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit',
    hour12: true,
  });
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
    hour12: true,
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const InfoRow = ({ label, value, fullWidth = false }) => {
  if (!value && value !== 0) return null;
  return (
    <div className={`vem-info-row${fullWidth ? ' vem-info-full' : ''}`}>
      <span className="vem-info-label">{label}</span>
      <span className="vem-info-value">{value}</span>
    </div>
  );
};

const TypeBadge = ({ type }) => {
  const cls =
    type === 'Visitor'  ? 'vem-badge-visitor'  :
    type === 'Employee' ? 'vem-badge-employee' :
    type === 'Member'   ? 'vem-badge-member'   : '';
  return <span className={`vem-badge ${cls}`}>{type}</span>;
};

const StatusBadge = ({ status }) => {
  const cls = status === 'Checked-in' ? 'vem-badge-in' : 'vem-badge-out';
  return <span className={`vem-badge ${cls}`}>{status}</span>;
};

// ── ViewEntryModal ─────────────────────────────────────────────────────────────

const ViewEntryModal = ({ entry, onClose }) => {
  const modalRef = useRef(null);
  useFocusTrap(modalRef, true);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!entry) return null;

  const isEmployee = entry.type === 'Employee';
  const hasPhoto   = Boolean(entry.photo);
  const hasMembers = entry.members?.length > 0;

  const govtIdDisplay = entry.govtIdType
    ? `${entry.govtIdType}${entry.govtIdNumber ? ` — ${entry.govtIdNumber}` : ''}`
    : null;

  const cardsDisplay = entry.cards?.length
    ? entry.cards.join(', ')
    : null;

  return (
    <div
      className="vem-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="vem-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vem-title"
        ref={modalRef}
      >
        {/* ── Header ── */}
        <div className="vem-header">
          <div>
            <h2 id="vem-title">
              {isEmployee ? 'Employee Details' : 'Visitor Details'}
            </h2>
            <p>Full details for {entry.name}.</p>
          </div>
          <button className="vem-close-btn" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="vem-body">

          {/* Avatar */}
          <div className="vem-avatar-wrap">
            <div className={`vem-avatar${hasPhoto ? ' vem-avatar-photo' : ''}`}>
              {hasPhoto
                ? <img src={entry.photo} alt={`${entry.name} photo`} />
                : <IconUserPlaceholder />}
            </div>
          </div>

          {/* Info grid */}
          <div className="vem-info-grid">
            <div className="vem-info-row">
              <span className="vem-info-label">Type:</span>
              <span className="vem-info-value"><TypeBadge type={entry.type} /></span>
            </div>

            <InfoRow label="Name:"        value={entry.name} />
            <InfoRow
              label={isEmployee ? 'Emp ID:' : 'Mobile:'}
              value={entry.mobileOrEmpId}
            />
            <InfoRow label="Email:"          value={entry.email} />
            <InfoRow label="Govt ID:"        value={govtIdDisplay} />
            <InfoRow
              label={entry.visitType === 'Group' ? 'Lead Card No:' : 'Card No:'}
              value={cardsDisplay}
            />
            <InfoRow label="Person to Meet:"  value={entry.personToMeet} />
            <InfoRow label="Host Department:" value={entry.department} />
            <InfoRow label="Location:"        value={entry.location} />

            {entry.purpose && (
              <div className="vem-info-row vem-info-full vem-info-purpose">
                <span className="vem-info-label">Reason for Visit:</span>
                <span className="vem-info-value vem-purpose-text">{entry.purpose}</span>
              </div>
            )}
          </div>

          {/* Group members */}
          {hasMembers && (
            <>
              <div className="vem-divider" />
              <div className="vem-section-title">Group Members</div>
              <div className="vem-members-list">
                {entry.members.map((m, idx) => (
                  <div key={m.id ?? idx} className="vem-member-row">
                    <div className="vem-member-avatar">
                      <IconUserPlaceholder />
                    </div>
                    <div className="vem-member-info">
                      <span className="vem-member-name">{m.name}</span>
                      {m.cards?.length > 0 && (
                        <span className="vem-member-card">Card: {m.cards.join(', ')}</span>
                      )}
                      {m.cardNumber && (
                        <span className="vem-member-card">Card: {m.cardNumber}</span>
                      )}
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Status & Timeline */}
          <div className="vem-divider" />
          <div className="vem-section-title">Status &amp; Timeline</div>
          <div className="vem-info-grid">
            <div className="vem-info-row">
              <span className="vem-info-label">Status:</span>
              <span className="vem-info-value"><StatusBadge status={entry.status} /></span>
            </div>
            <InfoRow label="Check-in:"  value={formatDateTime(entry.checkInTime)} />
            {entry.checkOutTime && (
              <InfoRow label="Check-out:" value={formatDate(entry.checkOutTime)} />
            )}
          </div>

        </div>

        {/* ── Footer ── */}
        <div className="vem-footer">
          <button className="vem-close-footer-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default ViewEntryModal;
