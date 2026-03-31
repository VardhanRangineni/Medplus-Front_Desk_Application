/**
 * ViewEntryModal — read-only detail view for a single check-in entry.
 *
 * Loads extended entry data (including photo, email, govtId, etc.) from
 * getEntryDetail() on mount, then renders a two-column layout:
 *   Left  — all textual details
 *   Right — photo + members list (if group)
 */

import { useState, useEffect } from 'react';
import './ViewEntryModal.css';
import {
  IconX,
  IconUser,
  IconPhone,
  IconMail,
  IconCreditCard,
  IconBuilding,
  IconMapPin,
  IconEdit,
  IconUsers,
  IconCamera,
} from '../../../components/Icons/Icons';
import { getEntryDetail } from '../checkInOutService';

// ─── Constants ────────────────────────────────────────────────────────────────

const GOVT_ID_LABELS = {
  AADHAAR:  'Aadhaar Card',
  PAN:      'PAN Card',
  PASSPORT: 'Passport',
  VOTER:    'Voter ID',
  DL:       "Driver's License",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(date) {
  if (!date) return '—';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  }) + ', ' + date.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ─── Detail row ───────────────────────────────────────────────────────────────

function DetailRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div className="vem-detail-row">
      <span className="vem-detail-icon">{icon}</span>
      <div className="vem-detail-body">
        <span className="vem-detail-label">{label}</span>
        <span className="vem-detail-value">{value}</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ViewEntryModal({ entry, onClose, onEdit }) {
  // Pre-fill with entry data immediately; detail enriches it silently when API is ready
  const [detail,  setDetail]  = useState(entry);
  const [loading, setLoading] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Silently try to load full entry detail — no error shown if API not ready
  useEffect(() => {
    setLoading(true);
    getEntryDetail(entry.id)
      .then(setDetail)
      .catch(() => { /* API not ready yet — display from entry prop */ })
      .finally(() => setLoading(false));
  }, [entry.id]);

  const isVisitor  = entry.type === 'VISITOR';
  const isIn       = entry.status === 'checked-in';
  const isGroup    = detail
    ? (detail.visitType ?? '').toUpperCase() === 'GROUP'
    : entry.members.length > 0;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="vem-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vem-title"
      onClick={handleOverlayClick}
    >
      <div className="vem-dialog">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="vem-header">
          <div className="vem-header__left">
            <span className={`vem-type-badge vem-type-badge--${entry.type.toLowerCase()}`}>
              {isVisitor ? 'Visitor' : 'Employee'}
            </span>
            {isGroup && (
              <span className="vem-group-badge">
                <IconUsers size={12} />
                Group Visit
              </span>
            )}
          </div>
          <div className="vem-header__right">
            <span className={`vem-status-badge vem-status-badge--${isIn ? 'in' : 'out'}`}>
              {isIn ? 'Checked-in' : 'Checked-out'}
            </span>
            <button className="vem-close" onClick={onClose} aria-label="Close">
              <IconX size={16} />
            </button>
          </div>
        </div>

        {/* Entry name + ID */}
        <div className="vem-name-row">
          <h2 className="vem-name" id="vem-title">{entry.name}</h2>
          <span className="vem-entry-id">{entry.id}</span>
        </div>

        {/* ── Body — always shown; detail enriches when API is ready ── */}
        <div className="vem-body">

            {/* ── Left: details ─────────────────────────────────────── */}
            <div className="vem-details">

              {/* Contact */}
              <div className="vem-section">
                <p className="vem-section__title">Contact</p>
                {isVisitor ? (
                  <>
                    <DetailRow
                      icon={<IconPhone size={13} />}
                      label="Mobile"
                      value={detail.mobile ?? entry.mobile}
                    />
                    <DetailRow
                      icon={<IconMail size={13} />}
                      label="Email"
                      value={detail.email}
                    />
                  </>
                ) : (
                  <DetailRow
                    icon={<IconUser size={13} />}
                    label="Employee ID"
                    value={detail.empId ?? entry.empId}
                  />
                )}
                {!isVisitor && detail.department && (
                  <DetailRow
                    icon={<IconBuilding size={13} />}
                    label="Department"
                    value={detail.department}
                  />
                )}
              </div>

              {/* Govt ID (visitor only) */}
              {isVisitor && (detail.govtIdType || detail.govtIdNumber) && (
                <div className="vem-section">
                  <p className="vem-section__title">Identity Proof</p>
                  <DetailRow
                    icon={<IconCreditCard size={13} />}
                    label="ID Type"
                    value={GOVT_ID_LABELS[detail.govtIdType] ?? detail.govtIdType}
                  />
                  <DetailRow
                    icon={<IconCreditCard size={13} />}
                    label="ID Number"
                    value={detail.govtIdNumber}
                  />
                </div>
              )}

              {/* Visit info */}
              <div className="vem-section">
                <p className="vem-section__title">Visit Details</p>
                {detail.location && (
                  <DetailRow
                    icon={<IconMapPin size={13} />}
                    label="Location"
                    value={detail.location}
                  />
                )}
                <DetailRow
                  icon={<IconUser size={13} />}
                  label="Person to Meet"
                  value={detail.personToMeet ?? entry.personToMeet}
                />
                <DetailRow
                  icon={<IconBuilding size={13} />}
                  label="Host Department"
                  value={detail.hostDepartment}
                />
                {detail.reasonForVisit && (
                  <div className="vem-detail-row vem-detail-row--full">
                    <span className="vem-detail-icon"><IconUser size={13} /></span>
                    <div className="vem-detail-body">
                      <span className="vem-detail-label">Reason</span>
                      <span className="vem-detail-value">{detail.reasonForVisit}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Card + timing */}
              <div className="vem-section">
                <p className="vem-section__title">Entry Log</p>
                {isGroup ? (
                  <>
                    <DetailRow
                      icon={<IconCreditCard size={13} />}
                      label="Lead Card"
                      value={detail.leadCardNumber ?? detail.card}
                    />
                  </>
                ) : (
                  <DetailRow
                    icon={<IconCreditCard size={13} />}
                    label="Card Number"
                    value={entry.card ?? detail.card}
                  />
                )}
                <DetailRow
                  icon={<IconPhone size={13} />}
                  label="Check-In"
                  value={fmt(entry.checkIn)}
                />
                {entry.checkOut && (
                  <DetailRow
                    icon={<IconPhone size={13} />}
                    label="Check-Out"
                    value={fmt(entry.checkOut)}
                  />
                )}
              </div>
            </div>

            {/* ── Right: photo + members ─────────────────────────────── */}
            <div className="vem-right">

              {/* Photo */}
              <div className="vem-photo-section">
                <p className="vem-section__title">Photo Proof</p>
                <div className={`vem-photo-frame${detail.photo ? '' : ' vem-photo-frame--empty'}`}>
                  {detail.photo ? (
                    <img
                      className="vem-photo-img"
                      src={detail.photo}
                      alt={`${entry.name} photo`}
                    />
                  ) : (
                    <div className="vem-photo-placeholder">
                      <IconCamera size={32} />
                      <span>No photo captured</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Members (group only) */}
              {isGroup && entry.members.length > 0 && (
                <div className="vem-members-section">
                  <p className="vem-section__title">
                    <IconUsers size={12} />
                    &nbsp;Group Members ({entry.members.length})
                  </p>
                  <div className="vem-members-list">
                    {entry.members.map((m, i) => (
                      <div key={m.id} className="vem-member-row">
                        <span className="vem-member-num">{i + 1}</span>
                        <span className="vem-member-name">{m.name || '—'}</span>
                        <span className="vem-member-card">
                          <IconCreditCard size={11} />
                          {m.card ?? '—'}
                        </span>
                        <span className={`vem-member-status vem-member-status--${m.status === 'checked-in' ? 'in' : 'out'}`}>
                          {m.status === 'checked-in' ? 'In' : 'Out'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="vem-footer">
          <button className="vem-btn vem-btn--close" onClick={onClose}>
            Close
          </button>
          <div className="vem-footer__spacer" />
          {isIn && (
            <button
              className="vem-btn vem-btn--edit"
              onClick={() => { onClose(); onEdit(entry); }}
            >
              <IconEdit size={14} />
              Edit Entry
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
