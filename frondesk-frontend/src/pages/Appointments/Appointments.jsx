import { useState, useEffect, useCallback, useRef } from 'react';
import './Appointments.css';
import {
  IconSearch,
  IconX,
  IconCheckCircle,
  IconEye,
  IconCalendar,
} from '../../components/Icons/Icons';
import Pagination       from '../../components/Pagination/Pagination';
import DateRangePicker  from '../../components/DateRangePicker/DateRangePicker';
import LocationSelector from '../../components/LocationSelector/LocationSelector';
import {
  getAppointments,
  getCheckInPreview,
  checkInAppointment,
} from './appointmentsService';

// ─── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE       = 20;
const SEARCH_DEBOUNCE = 350;
const COL_COUNT       = 8; // id · name · type · mobile · doctor · dept · date · actions

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatDateTime(date) {
  if (!date) return '—';
  return (
    date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' +
    date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  );
}

/** Maps API `entryType` (VISITOR | EMPLOYEE) to a short table label. */
function formatVisitorTypeLabel(entryType) {
  const t = String(entryType || '').trim().toUpperCase();
  if (t === 'EMPLOYEE') return 'Employee';
  if (t === 'VISITOR') return 'Visitor';
  if (!t) return '—';
  return t.charAt(0) + t.slice(1).toLowerCase();
}

function visitorTypeBadgeClass(entryType) {
  const t = String(entryType || '').trim().toUpperCase();
  if (t === 'EMPLOYEE') return 'apt-type-badge apt-type-badge--employee';
  if (t === 'VISITOR') return 'apt-type-badge apt-type-badge--visitor';
  return 'apt-type-badge apt-type-badge--unknown';
}

// ─── View Appointment Modal ────────────────────────────────────────────────────
function ViewAppointmentModal({ appt, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="apt-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apt-view-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="apt-modal-dialog">
        <div className="apt-modal-header">
          <div>
            <h2 className="apt-modal-title" id="apt-view-title">Appointment Details</h2>
            <p className="apt-modal-sub">{appt.id}</p>
          </div>
          <button className="apt-modal-close" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>

        <div className="apt-modal-body">
          <div className="apt-detail-grid">
            <div className="apt-detail-item">
              <span className="apt-detail-label">Visitor Name</span>
              <span className="apt-detail-value">{appt.patientName ?? '—'}</span>
            </div>
            <div className="apt-detail-item">
              <span className="apt-detail-label">Visitor type</span>
              <span className="apt-detail-value">
                {String(appt.entryType || '').trim()
                  ? <span className={visitorTypeBadgeClass(appt.entryType)}>{formatVisitorTypeLabel(appt.entryType)}</span>
                  : <span className="apt-muted">—</span>}
              </span>
            </div>
            <div className="apt-detail-item">
              <span className="apt-detail-label">Mobile</span>
              <span className="apt-detail-value">{appt.mobile ?? '—'}</span>
            </div>
            <div className="apt-detail-item">
              <span className="apt-detail-label">Email</span>
              <span className="apt-detail-value">{appt.email ?? '—'}</span>
            </div>
            <div className="apt-detail-item">
              <span className="apt-detail-label">Person to Meet</span>
              <span className="apt-detail-value">{appt.personToMeet ?? '—'}</span>
            </div>
            <div className="apt-detail-item">
              <span className="apt-detail-label">Department</span>
              <span className="apt-detail-value">{appt.department ?? '—'}</span>
            </div>
            <div className="apt-detail-item">
              <span className="apt-detail-label">Appointment Date &amp; Time</span>
              <span className="apt-detail-value">{formatDateTime(appt.appointmentDate)}</span>
            </div>
            {appt.reason && (
              <div className="apt-detail-item apt-detail-item--full">
                <span className="apt-detail-label">Reason / Notes</span>
                <span className="apt-detail-value">{appt.reason}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Check-In Preview Modal ────────────────────────────────────────────────────
/**
 * Two-phase modal:
 *   Phase 1 (loadingPreview=true)  — spinner while fetching card preview
 *   Phase 2 (loadingPreview=false) — shows appointment details + assigned card
 *                                    with a "Proceed" button
 *   Phase 3 (loadingCheckIn=true)  — spinner while calling POST /checkin
 */
function CheckInPreviewModal({ appt, cardCode, loadingPreview, loadingCheckIn, onProceed, onClose }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && !loadingPreview && !loadingCheckIn) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, loadingPreview, loadingCheckIn]);

  const busy = loadingPreview || loadingCheckIn;

  return (
    <div
      className="apt-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apt-ci-title"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div className="apt-modal-dialog apt-modal-dialog--sm">
        <div className="apt-modal-header">
          <div>
            <h2 className="apt-modal-title" id="apt-ci-title">Check-In Patient</h2>
            <p className="apt-modal-sub">Review details and confirm to proceed</p>
          </div>
          {!busy && (
            <button className="apt-modal-close" onClick={onClose} aria-label="Close">
              <IconX size={16} />
            </button>
          )}
        </div>

        <div className="apt-modal-body">
          {loadingPreview ? (
            <div className="apt-ci-loading">
              <span className="apt-spinner" aria-hidden="true" />
              <span>Preparing check-in…</span>
            </div>
          ) : (
            <>
              <div className="apt-ci-info">
                <div className="apt-ci-row">
                  <span className="apt-ci-label">Appointment ID</span>
                  <span className="apt-ci-val apt-ci-val--id">{appt.id}</span>
                </div>
                <div className="apt-ci-row">
                  <span className="apt-ci-label">Patient</span>
                  <span className="apt-ci-val">{appt.patientName}</span>
                </div>
                <div className="apt-ci-row">
                  <span className="apt-ci-label">Person to Meet</span>
                  <span className="apt-ci-val">{appt.personToMeet ?? '—'}</span>
                </div>
                <div className="apt-ci-row">
                  <span className="apt-ci-label">Scheduled Time</span>
                  <span className="apt-ci-val">{formatDateTime(appt.appointmentDate)}</span>
                </div>
                {appt.entryType !== 'EMPLOYEE' && (
                  <div className="apt-ci-row apt-ci-row--card">
                    <span className="apt-ci-label">Card to be Assigned</span>
                    <span className="apt-ci-val apt-ci-val--card">
                      {cardCode
                        ? <span className="apt-ci-card-badge">{cardCode}</span>
                        : <span className="apt-muted">Auto-assigned on check-in</span>
                      }
                    </span>
                  </div>
                )}
              </div>

              <p className="apt-ci-note">
                Clicking <strong>Proceed</strong> will
                {appt.entryType !== 'EMPLOYEE' ? ' assign a visitor card and ' : ' '}
                move this appointment to the Check-In&nbsp;/&nbsp;Check-Out log, and remove it from this list.
              </p>

              <div className="apt-ci-actions">
                <button
                  className="apt-ci-btn apt-ci-btn--confirm"
                  onClick={onProceed}
                  disabled={loadingCheckIn}
                  autoFocus
                >
                  {loadingCheckIn ? (
                    <><span className="apt-spinner apt-spinner--sm" aria-hidden="true" />Checking in…</>
                  ) : 'Proceed'}
                </button>
                <button
                  className="apt-ci-btn apt-ci-btn--ghost"
                  onClick={onClose}
                  disabled={loadingCheckIn}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Card Assigned Success Modal ───────────────────────────────────────────────
function CardAssignedModal({ patientName, cardCode, isEmployee, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' || e.key === 'Enter') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="apt-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apt-card-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="apt-modal-dialog apt-modal-dialog--sm apt-modal-dialog--success">
        <div className="apt-modal-header">
          <div className="apt-card-success-header">
            <IconCheckCircle size={28} />
            <h2 className="apt-modal-title" id="apt-card-title">Check-In Successful</h2>
          </div>
          <button className="apt-modal-close" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>

        <div className="apt-modal-body apt-card-success-body">
          <p className="apt-card-patient">{patientName}</p>

          {isEmployee ? (
            <p className="apt-card-no-card">
              Employee check-in recorded — no visitor card assigned.
            </p>
          ) : (
            <>
              <p className="apt-card-label">Assigned Visitor Card</p>
              <div className="apt-card-number">
                {cardCode ?? <span className="apt-muted">Auto-assigned</span>}
              </div>
            </>
          )}

          <p className="apt-card-hint">
            The {isEmployee ? 'employee' : 'patient'} has been added to the
            Check-In&nbsp;/&nbsp;Check-Out log.
          </p>

          <div className="apt-success-actions">
            <button className="apt-done-btn" onClick={onClose} autoFocus>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Appointment Row ───────────────────────────────────────────────────────────
function AppointmentRow({ appt, onCheckIn, onView }) {
  return (
    <tr className="apt-row">
      <td className="apt-col--id">{appt.id}</td>
      <td className="apt-col--name">{appt.patientName}</td>
      <td className="apt-col--type">
        {String(appt.entryType || '').trim()
          ? <span className={visitorTypeBadgeClass(appt.entryType)}>{formatVisitorTypeLabel(appt.entryType)}</span>
          : <span className="apt-muted">—</span>}
      </td>
      <td className="apt-col--mobile">{appt.mobile ?? '—'}</td>
      <td className="apt-col--doctor">{appt.personToMeet ?? '—'}</td>
      <td className="apt-col--dept">
        {appt.department
          ? <span className="apt-dept-badge">{appt.department}</span>
          : <span className="apt-muted">—</span>}
      </td>
      <td className="apt-col--date">{formatDateTime(appt.appointmentDate)}</td>
      <td>
        <div className="apt-actions">
          <button
            className="apt-action-btn apt-action-btn--view"
            onClick={() => onView(appt)}
            title="View Details"
            aria-label={`View appointment ${appt.id}`}
          >
            <IconEye size={14} />
          </button>
          <button
            className="apt-action-btn apt-action-btn--checkin"
            onClick={() => onCheckIn(appt)}
            title="Check In"
            aria-label={`Check in ${appt.patientName}`}
          >
            <IconCheckCircle size={14} />
            <span>Check In</span>
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function Appointments({ session }) {
  // ── Server-side data ──────────────────────────────────────────────────────
  const [appointments,  setAppointments]  = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages,    setTotalPages]    = useState(1);

  // ── Loading states ────────────────────────────────────────────────────────
  const [initLoading,     setInitLoading]     = useState(true);
  const [pageLoading,     setPageLoading]     = useState(false);
  const [previewLoading,  setPreviewLoading]  = useState(false);
  const [checkInLoading,  setCheckInLoading]  = useState(false);

  // ── Filter / UI state ─────────────────────────────────────────────────────
  const [search,       setSearch]      = useState('');
  const [currentPage,  setCurrentPage] = useState(1);
  const [customRange,  setCustomRange] = useState(null);   // null = default view (today from now)
  const [locationId,   setLocationId]  = useState(null);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [viewAppt,        setViewAppt]        = useState(null);
  const [previewAppt,     setPreviewAppt]      = useState(null);  // appointment in preview modal
  const [previewCardCode, setPreviewCardCode]  = useState(null);  // card shown in preview
  const [successInfo,     setSuccessInfo]      = useState(null);  // { patientName, cardCode }
  const [toast,           setToast]            = useState(null);  // { message, variant }

  const searchTimerRef = useRef(null);
  const toastTimerRef  = useRef(null);

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = useCallback((message, variant = 'success') => {
    clearTimeout(toastTimerRef.current);
    setToast({ message, variant });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Core fetch ────────────────────────────────────────────────────────────
  const fetchPage = useCallback(async (page, q, range, locId, isInitial = false) => {
    if (isInitial) setInitLoading(true);
    else           setPageLoading(true);

    const useDefaultView = range === null;
    try {
      const result = await getAppointments({
        defaultView: useDefaultView,
        page:        page - 1,
        size:        PAGE_SIZE,
        search:      q,
        from:        range?.from ?? null,
        to:          range?.to   ?? null,
        locationId:  locId,
      });
      setAppointments(result.appointments);
      setTotalElements(result.totalElements);
      setTotalPages(result.totalPages || 1);
      setCurrentPage(page);
    } catch {
      // retain stale data so the UI remains usable
    } finally {
      if (isInitial) setInitLoading(false);
      else           setPageLoading(false);
    }
  }, []);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchPage(1, '', null, null, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when filters change (after initial mount)
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return; }
    fetchPage(1, search, customRange, locationId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customRange, locationId]);

  // ── Search (debounced) ────────────────────────────────────────────────────
  const handleSearchChange = useCallback((value) => {
    setSearch(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchPage(1, value, customRange, locationId);
    }, SEARCH_DEBOUNCE);
  }, [customRange, locationId, fetchPage]);

  // ── Page change ───────────────────────────────────────────────────────────
  const handlePageChange = useCallback((page) => {
    fetchPage(page, search, customRange, locationId);
  }, [search, customRange, locationId, fetchPage]);

  // ── Date range change ─────────────────────────────────────────────────────
  const handleRangeChange = useCallback((r) => {
    setCustomRange(r);
    setCurrentPage(1);
  }, []);

  // ── Reset to default view ─────────────────────────────────────────────────
  const handleResetToToday = useCallback(() => {
    setCustomRange(null);
    setSearch('');
    setCurrentPage(1);
    fetchPage(1, '', null, locationId);
  }, [locationId, fetchPage]);

  // ── Check-In: Step 1 — fetch preview ─────────────────────────────────────
  const handleCheckInClick = useCallback(async (appt) => {
    setPreviewAppt(appt);
    setPreviewCardCode(null);
    setPreviewLoading(true);
    try {
      const preview = await getCheckInPreview(appt.id);
      setPreviewCardCode(preview.nextCardCode);
    } catch {
      setPreviewCardCode(null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  // ── Check-In: Step 2 — proceed ────────────────────────────────────────────
  const handleCheckInProceed = useCallback(async () => {
    if (!previewAppt) return;
    setCheckInLoading(true);
    const apptId      = previewAppt.id;
    const patientName = previewAppt.patientName;

    try {
      const visitor      = await checkInAppointment(apptId);
      const isEmployee   = previewAppt.entryType === 'EMPLOYEE';
      const assignedCard = isEmployee ? null : (visitor.cardCode ?? visitor.card ?? previewCardCode ?? null);

      // Remove checked-in appointment from the list
      setAppointments((prev) => prev.filter((a) => a.id !== apptId));
      setTotalElements((n) => Math.max(0, n - 1));

      // Close preview modal and show success modal
      setPreviewAppt(null);
      setPreviewCardCode(null);
      setSuccessInfo({ patientName, cardCode: assignedCard, isEmployee });
    } catch (err) {
      setPreviewAppt(null);
      showToast(err.message || 'Check-in failed. Please try again.', 'error');
    } finally {
      setCheckInLoading(false);
    }
  }, [previewAppt, previewCardCode, showToast]);

  const handleClosePreview = useCallback(() => {
    if (checkInLoading) return;
    setPreviewAppt(null);
    setPreviewCardCode(null);
  }, [checkInLoading]);

  // ── Pagination helpers ────────────────────────────────────────────────────
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEnd   = Math.min(pageStart + appointments.length, pageStart + PAGE_SIZE);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="apt-page">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <header className="apt-page__header">
        <h1 className="apt-page__title">Appointments</h1>
        <p className="apt-page__sub">
          {customRange
            ? `Showing appointments from ${customRange.from ?? '…'} to ${customRange.to ?? '…'}`
            : "Showing today's upcoming appointments"}
        </p>
      </header>

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="apt-toolbar">
        <div className="apt-toolbar__row1">
          {/* Left: today badge + reset */}
          <div className="apt-view-indicator">
            {customRange ? (
              <button className="apt-reset-btn" onClick={handleResetToToday}>
                ← Back to Today
              </button>
            ) : (
              <span className="apt-today-badge">Today · From Now</span>
            )}
          </div>

          {/* Right: location + date range */}
          <div className="apt-toolbar__loc-date">
            <LocationSelector
              session={session}
              value={locationId}
              onChange={(locId) => {
                setLocationId(locId);
                setCurrentPage(1);
              }}
            />
            <DateRangePicker
              from={customRange?.from ?? new Date().toISOString().slice(0, 10)}
              to={customRange?.to   ?? new Date().toISOString().slice(0, 10)}
              onChange={handleRangeChange}
              allowFuture
            />
          </div>
        </div>

        {/* Row 2: search */}
        <div className="apt-toolbar__row2">
          <label className="apt-search" aria-label="Search appointments">
            <IconSearch size={14} />
            <input
              className="apt-search__input"
              type="search"
              placeholder="Search name, mobile, doctor, appointment ID…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </label>
        </div>
      </div>

      {/* ── Table card ─────────────────────────────────────────────────── */}
      <div className={`apt-card${pageLoading ? ' apt-card--loading' : ''}`}>
        <div className="apt-table-wrap">
          <table className="apt-table" aria-label="Appointments">
            <thead>
              <tr>
                <th scope="col">Appointment ID</th>
                <th scope="col">Visitor Name</th>
                <th scope="col">Visitor type</th>
                <th scope="col">Mobile</th>
                <th scope="col">Person to Meet</th>
                <th scope="col">Department</th>
                <th scope="col">Date &amp; Time</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {initLoading ? (
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="apt-row--skeleton">
                    {Array.from({ length: COL_COUNT }, (_, j) => (
                      <td key={j}><span className="apt-skeleton" /></td>
                    ))}
                  </tr>
                ))
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className="apt-empty">
                    <IconCalendar size={32} />
                    <p>
                      {search
                        ? `No appointments match "${search}".`
                        : customRange
                          ? 'No appointments found for the selected date range.'
                          : 'No upcoming appointments for today.'}
                    </p>
                  </td>
                </tr>
              ) : (
                appointments.map((appt) => (
                  <AppointmentRow
                    key={appt.id}
                    appt={appt}
                    onCheckIn={handleCheckInClick}
                    onView={setViewAppt}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!initLoading && totalElements > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}

        {/* Footer */}
        {!initLoading && (
          <div className="apt-footer">
            {totalElements > 0 ? (
              <>
                Showing&nbsp;
                <strong>{pageStart + 1}–{pageEnd}</strong>
                &nbsp;of&nbsp;<strong>{totalElements}</strong>&nbsp;
                {totalElements === 1 ? 'appointment' : 'appointments'}
              </>
            ) : (
              'No appointments to display'
            )}
          </div>
        )}
      </div>

      {/* ── View Modal ─────────────────────────────────────────────────── */}
      {viewAppt && (
        <ViewAppointmentModal
          appt={viewAppt}
          onClose={() => setViewAppt(null)}
        />
      )}

      {/* ── Check-In Preview Modal ─────────────────────────────────────── */}
      {previewAppt && (
        <CheckInPreviewModal
          appt={previewAppt}
          cardCode={previewCardCode}
          loadingPreview={previewLoading}
          loadingCheckIn={checkInLoading}
          onProceed={handleCheckInProceed}
          onClose={handleClosePreview}
        />
      )}

      {/* ── Card Assigned Success Modal ────────────────────────────────── */}
      {successInfo && (
        <CardAssignedModal
          patientName={successInfo.patientName}
          cardCode={successInfo.cardCode}
          isEmployee={successInfo.isEmployee}
          onClose={() => setSuccessInfo(null)}
        />
      )}

      {/* ── Toast notification ─────────────────────────────────────────── */}
      {toast && (
        <div className={`apt-toast apt-toast--${toast.variant}`} role="alert">
          {toast.variant === 'success'
            ? <IconCheckCircle size={15} />
            : <IconX size={15} />}
          <span>{toast.message}</span>
          <button
            className="apt-toast__close"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
          >
            <IconX size={12} />
          </button>
        </div>
      )}

    </div>
  );
}
