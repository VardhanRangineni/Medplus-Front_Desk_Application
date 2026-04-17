import { useState } from 'react';
import { useBooking } from '../../context/BookingContext';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  return `${d} ${MONTHS[m-1]} ${y}`;
}

export default function ConfirmationStep() {
  const { confirmation, reset } = useBooking();
  const [copied, setCopied] = useState(false);
  if (!confirmation) return null;

  function handleCopy() {
    navigator.clipboard?.writeText(confirmation.bookingReference ?? '').then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

  const rows = [
    { label: 'Booking Reference', value: confirmation.bookingReference, highlight: true },
    { label: 'Name',              value: confirmation.name },
    confirmation.locationName
      ? { label: 'Office Location',  value: confirmation.locationName }
      : null,
    { label: 'Date',              value: formatDate(confirmation.appointmentDate) },
    { label: 'Time',              value: confirmation.appointmentTime },
    { label: 'Meeting With',      value: confirmation.personToMeet },
    { label: 'Department',        value: confirmation.department },
    confirmation.reasonForVisit
      ? { label: 'Reason',        value: confirmation.reasonForVisit } : null,
    confirmation.mobile
      ? { label: 'Mobile',        value: `+91 ${confirmation.mobile}` } : null,
    confirmation.empId
      ? { label: 'Employee ID',   value: confirmation.empId } : null,
  ].filter(Boolean);

  return (
    <div className="card shadow-sm border rounded-3 p-4 p-sm-5 text-center">

      {/* Success icon */}
      <div className="d-flex justify-content-center mb-3">
        <div className="position-relative">
          <div className="d-flex align-items-center justify-content-center rounded-circle bg-success bg-opacity-10"
            style={{ width: '5rem', height: '5rem' }}>
            <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#198754" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Title */}
      <h2 className="fw-bold fs-3 mb-1">Appointment Confirmed!</h2>
      <p className="text-muted small mb-4">
        Your appointment has been booked. Please show this confirmation at the front desk.
      </p>

      {/* Reference badge */}
      <div className="d-flex justify-content-center mb-1">
        <div role="button" onClick={handleCopy} title="Click to copy"
          className="d-inline-flex align-items-center gap-2 px-4 py-2 bg-primary bg-opacity-10 border border-primary border-opacity-25 rounded-3 cursor-pointer"
          style={{ cursor: 'pointer' }}>
          <span className="fw-bold fs-5 font-monospace text-primary" style={{ letterSpacing: '0.15em' }}>
            {confirmation.bookingReference}
          </span>
          {copied
            ? <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#198754" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            : <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#6c757d" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.337c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
          }
        </div>
      </div>
      <p className="text-muted mb-4" style={{ fontSize: '0.72rem' }}>Click reference to copy</p>

      {/* Summary */}
      <div className="text-start border rounded-3 overflow-hidden mb-4">
        {rows.map((row, idx) => (
          <div key={row.label}
            className={`d-flex align-items-start gap-3 px-3 py-2 ${idx < rows.length - 1 ? 'border-bottom' : ''} ${row.highlight ? 'bg-primary bg-opacity-10' : ''}`}>
            <span className="text-muted fw-semibold text-uppercase flex-shrink-0"
              style={{ fontSize: '0.68rem', letterSpacing: '.05em', width: '8rem', paddingTop: '1px' }}>
              {row.label}
            </span>
            <span className={`small ${row.highlight ? 'fw-bold text-primary' : 'fw-medium text-dark'}`}>
              {row.value}
            </span>
          </div>
        ))}

        {/* Status */}
        <div className="d-flex align-items-center gap-3 px-3 py-2">
          <span className="text-muted fw-semibold text-uppercase flex-shrink-0"
            style={{ fontSize: '0.68rem', letterSpacing: '.05em', width: '8rem' }}>Status</span>
          <span className="badge bg-warning text-dark d-inline-flex align-items-center gap-1 py-1 px-2">
            <span className="rounded-circle bg-warning-emphasis" style={{ width: '6px', height: '6px', display: 'inline-block' }} />
            {confirmation.status ?? 'PENDING'} — Awaiting front-desk confirmation
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="d-flex flex-column flex-sm-row gap-2">
        <button onClick={() => window.print()}
          className="btn btn-outline-primary flex-fill d-inline-flex align-items-center justify-content-center gap-2">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
          </svg>
          Print / Save
        </button>
        <button onClick={reset}
          className="btn btn-primary flex-fill">
          Book Another Appointment
        </button>
      </div>
    </div>
  );
}
