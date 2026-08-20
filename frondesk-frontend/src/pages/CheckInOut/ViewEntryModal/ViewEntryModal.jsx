/**
 * ViewEntryModal — read-only detail view for a single check-in entry.
 *
 * Loads extended entry data (including photo, email, govtId, etc.) from
 * getEntryDetail() on mount, then renders the full details layout.
 */

import { useState, useEffect, useRef } from 'react';
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
} from '../../../components/Icons/Icons';
import { getEntryDetail, getMovementTrail } from '../checkInOutService';

// ─── Constants ────────────────────────────────────────────────────────────────

const GOVT_ID_LABELS = {
  AADHAAR: 'Aadhaar Card',
};

const EVENT_LABELS = {
  CHECK_IN: 'Check-in',
  ZONE_SCAN: 'Zone scan',
  CHECK_OUT: 'Check-out',
};

const EVENT_VARIANTS = {
  CHECK_IN: 'in',
  ZONE_SCAN: 'zone',
  CHECK_OUT: 'out',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDevicePlace(event) {
  const parts = [event.deviceName, event.floor, event.area].filter(Boolean);
  return parts.length ? parts.join(' · ') : (event.deviceId ?? '—');
}

function MovementTimeline({ events, loading }) {
  if (loading) {
    return <p className="vem-movement-empty">Loading movement trail…</p>;
  }
  if (!events?.length) {
    return (
      <p className="vem-movement-empty">
        No movement scans recorded yet. Use Zone Scan when the visitor passes a kiosk.
      </p>
    );
  }

  return (
    <ol className="vem-movement-list">
      {events.map((event) => (
        <li key={event.id} className="vem-movement-item">
          <div className={`vem-movement-dot vem-movement-dot--${EVENT_VARIANTS[event.eventType] ?? 'zone'}`} />
          <div className="vem-movement-body">
            <div className="vem-movement-head">
              <span className={`vem-movement-type vem-movement-type--${EVENT_VARIANTS[event.eventType] ?? 'zone'}`}>
                {EVENT_LABELS[event.eventType] ?? event.eventType}
              </span>
              <span className="vem-movement-time">{fmt(event.scannedAt)}</span>
            </div>
            <p className="vem-movement-place">{formatDevicePlace(event)}</p>
            {event.locationName && (
              <p className="vem-movement-meta">{event.locationName}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function fmt(date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  }) + ', ' + d.toLocaleTimeString('en-IN', {
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

function VisitPassQrPanel({ visitPassToken, detailLoading }) {
  const qrRef = useRef(null);
  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    setQrError(false);
    if (!visitPassToken || !qrRef.current) return;

    const payload = `PREREG:${visitPassToken}`;
    let cancelled = false;

    const draw = () => {
      if (cancelled || !qrRef.current) return;
      import('qrcode').then((mod) => {
        if (cancelled || !qrRef.current) return;
        const QRCode = mod.default || mod;
        return QRCode.toCanvas(qrRef.current, payload, {
          width: 176,
          margin: 1,
          color: { dark: '#111111', light: '#ffffff' },
        });
      }).catch(() => {
        if (!cancelled) setQrError(true);
      });
    };

    requestAnimationFrame(draw);
    return () => { cancelled = true; };
  }, [visitPassToken]);

  return (
    <div className="vem-right">
      <div className="vem-qr-section">
        <p className="vem-section__title">Visit Pass QR</p>
        <div className="vem-qr-frame">
          {detailLoading && (
            <p className="vem-qr-placeholder">Loading QR…</p>
          )}
          {!detailLoading && !visitPassToken && (
            <p className="vem-qr-placeholder vem-qr-placeholder--muted">
              QR not available for this entry.
            </p>
          )}
          {!detailLoading && visitPassToken && qrError && (
            <p className="vem-qr-placeholder vem-qr-placeholder--muted">
              Could not render QR. Ask reception to resend the visit pass SMS.
            </p>
          )}
          {!detailLoading && visitPassToken && !qrError && (
            <canvas ref={qrRef} className="vem-qr-canvas" aria-label="Visitor visit pass QR code" />
          )}
        </div>
        <p className="vem-qr-hint">
          Same QR sent by SMS. Visitor can scan this at any kiosk for zone tracking if the message was not received.
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ViewEntryModal({ entry, onClose, onEdit, canEdit }) {
  const [detail, setDetail] = useState(entry);
  const [detailLoading, setDetailLoading] = useState(true);
  const [movement, setMovement] = useState([]);
  const [movementLoading, setMovementLoading] = useState(true);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setDetailLoading(true);
    getEntryDetail(entry.id)
      .then((d) => { if (!cancelled && d) setDetail(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [entry.id]);

  useEffect(() => {
    let cancelled = false;
    setMovementLoading(true);
    getMovementTrail(entry.id)
      .then((events) => {
        if (!cancelled) setMovement(events);
      })
      .catch(() => {
        if (!cancelled) setMovement([]);
      })
      .finally(() => {
        if (!cancelled) setMovementLoading(false);
      });
    return () => { cancelled = true; };
  }, [entry.id]);

  const lastScanLabel = detail.lastScanDeviceName
    ?? entry.lastScanDeviceName
    ?? null;
  const lastScanTime = detail.lastScan ?? entry.lastScan ?? null;

  const isVisitor  = entry.type === 'VISITOR';
  const isIn       = entry.status === 'checked-in' || entry.status === 'approved';
  const statusLabel = entry.status === 'pending-approval' ? 'Pending'
    : entry.status === 'approved' ? 'Approved'
    : entry.status === 'rejected' ? 'Rejected'
    : entry.status === 'checked-in' ? 'Checked-in'
    : 'Checked-out';
  const statusVariant = entry.status === 'pending-approval' ? 'pending'
    : entry.status === 'approved' ? 'approved'
    : entry.status === 'rejected' ? 'rejected'
    : entry.status === 'checked-in' ? 'in' : 'out';
  const visitPassToken = detail.visitPassToken ?? entry.visitPassToken ?? null;
  const showQrPanel = isVisitor && (entry.status === 'checked-in' || entry.status === 'approved');

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
      <div className={`vem-dialog${showQrPanel ? ' vem-dialog--with-qr' : ''}`}>

        <div className="vem-header">
          <div className="vem-header__left">
            <span className={`vem-type-badge vem-type-badge--${entry.type.toLowerCase()}`}>
              {isVisitor ? 'Visitor' : 'Employee'}
            </span>
          </div>
          <div className="vem-header__right">
            <span className={`vem-status-badge vem-status-badge--${statusVariant}`}>
              {statusLabel}
            </span>
            <button className="vem-close" onClick={onClose} aria-label="Close">
              <IconX size={16} />
            </button>
          </div>
        </div>

        <div className="vem-name-row">
          <h2 className="vem-name" id="vem-title">{entry.name}</h2>
          <span className="vem-entry-id">{entry.id}</span>
        </div>
        {(detail.groupId || entry.groupId) && (
          <p className="vem-group-id">Group {detail.groupId || entry.groupId}</p>
        )}

        <div className="vem-body">
            <div className={`vem-details${showQrPanel ? '' : ' vem-details--full'}`}>

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
                  <>
                    <DetailRow
                      icon={<IconUser size={13} />}
                      label="Employee ID"
                      value={detail.empId ?? entry.empId}
                    />
                    <DetailRow
                      icon={<IconPhone size={13} />}
                      label="Mobile"
                      value={detail.mobile ?? entry.mobile}
                    />
                  </>
                )}
              </div>

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
                {isVisitor && (
                  <DetailRow
                    icon={<IconBuilding size={13} />}
                    label="Representing Company"
                    value={detail.companyName ?? entry.companyName}
                  />
                )}
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

              {(entry.status === 'rejected' || detail.status === 'rejected'
                || entry.status === 'approved' || detail.status === 'approved'
                || detail.approvedAt || detail.rejectedAt
                || entry.status === 'pending-approval' || detail.status === 'pending-approval') && (
                <div className="vem-section">
                  <p className="vem-section__title">Host Approval</p>
                  <DetailRow
                    icon={<IconPhone size={13} />}
                    label="Registered at"
                    value={fmt(detail.checkIn ?? entry.checkIn)}
                  />
                  {(detail.approvedAt || entry.approvedAt) && (
                    <DetailRow
                      icon={<IconUser size={13} />}
                      label="Approved at"
                      value={fmt(detail.approvedAt ?? entry.approvedAt)}
                    />
                  )}
                  {(detail.rejectedAt || entry.rejectedAt) && (
                    <DetailRow
                      icon={<IconUser size={13} />}
                      label="Rejected at"
                      value={fmt(detail.rejectedAt ?? entry.rejectedAt)}
                    />
                  )}
                  {(entry.status === 'pending-approval' || detail.status === 'pending-approval') && (
                    <DetailRow
                      icon={<IconUser size={13} />}
                      label="Approval"
                      value="Waiting for host"
                    />
                  )}
                  {(entry.status === 'rejected' || detail.status === 'rejected') && (
                    <div className="vem-reject-banner" role="status">
                      <p className="vem-reject-banner__label">Rejection reason</p>
                      <p className="vem-reject-banner__text">
                        {detail.rejectionRemarks || entry.rejectionRemarks || 'No reason provided'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="vem-section">
                <p className="vem-section__title">Entry Log</p>
                <DetailRow
                  icon={<IconCreditCard size={13} />}
                  label="Card Number"
                  value={entry.card ?? detail.card}
                />
                <DetailRow
                  icon={<IconMapPin size={13} />}
                  label="Check-In Kiosk"
                  value={detail.checkInDeviceName ?? entry.checkInDeviceName}
                />
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
                {(lastScanLabel || lastScanTime) && (
                  <DetailRow
                    icon={<IconMapPin size={13} />}
                    label="Last Scan"
                    value={lastScanLabel
                      ? `${lastScanLabel}${lastScanTime ? ` · ${fmt(lastScanTime)}` : ''}`
                      : fmt(lastScanTime)}
                  />
                )}
              </div>

              <div className="vem-section">
                <p className="vem-section__title">Movement Trail</p>
                <MovementTimeline events={movement} loading={movementLoading} />
              </div>
            </div>

            {showQrPanel && (
              <VisitPassQrPanel
                visitPassToken={visitPassToken}
                detailLoading={detailLoading}
              />
            )}
          </div>

        <div className="vem-footer">
          <button className="vem-btn vem-btn--close" onClick={onClose}>
            Close
          </button>
          <div className="vem-footer__spacer" />
          {isIn && canEdit && (
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
