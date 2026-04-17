import { useState, useEffect } from 'react';
import ProgressSteps from '../common/ProgressSteps';
import { useBooking } from '../../context/BookingContext';
import { getAvailableSlots, bookAppointment } from '../../api/appointmentApi';

const STEPS = ['Verify', 'Details', 'Schedule', 'Confirm'];
const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y, m)    { return new Date(y, m, 1).getDay(); }
function toDateStr(y, m, d)   { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function formatDayHeader(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  return `${DAY_NAMES[dt.getDay()]}, ${MONTHS[m-1]} ${d}`;
}

export default function ScheduleStep() {
  const { bookingDetails, bookingConfirmed, goBack } = useBooking();
  const today = new Date();

  const [viewYear,      setViewYear]     = useState(today.getFullYear());
  const [viewMonth,     setViewMonth]    = useState(today.getMonth());
  const [selectedDate,  setSelectedDate] = useState(null);
  const [selectedSlot,  setSelectedSlot] = useState(null);
  const [slots,         setSlots]        = useState([]);
  const [slotsLoading,  setSlotsLoading] = useState(false);
  const [confirming,    setConfirming]   = useState(false);
  const [error,         setError]        = useState('');

  const personId = bookingDetails?.personToMeetId;

  useEffect(() => {
    if (!selectedDate || !personId) return;
    setSlotsLoading(true); setSlots([]); setSelectedSlot(null); setError('');
    getAvailableSlots(selectedDate, personId)
      .then((data) => setSlots(data))
      .catch((err) => setError(err.message))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, personId]);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y-1); setViewMonth(11); } else setViewMonth(m => m-1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y+1); setViewMonth(0); } else setViewMonth(m => m+1);
  }

  async function handleConfirm() {
    if (!selectedDate || !selectedSlot) return;
    setConfirming(true); setError('');
    try {
      const conf = await bookAppointment({ ...bookingDetails, appointmentDate: selectedDate, appointmentTime: selectedSlot.time });
      bookingConfirmed(conf);
    } catch (err) { setError(err.message); }
    finally       { setConfirming(false); }
  }

  const daysInMonth   = getDaysInMonth(viewYear, viewMonth);
  const firstDay      = getFirstDay(viewYear, viewMonth);
  const prevMonthDays = getDaysInMonth(viewYear, viewMonth === 0 ? 11 : viewMonth - 1);
  const todayStr      = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--)        cells.push({ day: prevMonthDays - i, type: 'prev' });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateStr(viewYear, viewMonth, d);
    cells.push({ day: d, type: 'current', dateStr, isPast: dateStr < todayStr });
  }
  let next = 1;
  while (cells.length < 42) cells.push({ day: next++, type: 'next' });

  return (
    <div className="card shadow-sm border rounded-3 overflow-hidden">
      <div className="p-4 p-sm-4 pb-3">
        <ProgressSteps steps={STEPS} current={3} />
      </div>

      {/* Header */}
      <div className="px-4 pb-3 border-bottom">
        <h2 className="fw-bold fs-4 mb-0">Select a Date &amp; Time</h2>
        {bookingDetails?.personToMeetName && (
          <p className="text-muted small mb-0 mt-1">
            Scheduling with <strong className="text-dark">{bookingDetails.personToMeetName}</strong>
            {bookingDetails.department ? ` · ${bookingDetails.department}` : ''}
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 alert alert-danger d-flex align-items-center gap-2 py-2 small mb-0">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {error}
        </div>
      )}

      {/* Calendar + Slots */}
      <div className="row g-0">
        {/* Calendar */}
        <div className="col-12 col-md-auto border-end p-4" style={{ minWidth: '280px' }}>
          {/* Month nav */}
          <div className="d-flex align-items-center justify-content-between mb-3">
            <button onClick={prevMonth} className="btn btn-sm btn-light rounded-circle p-1" aria-label="Previous month"
              style={{ width: '2rem', height: '2rem' }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="fw-semibold small">{MONTHS[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth} className="btn btn-sm btn-light rounded-circle p-1" aria-label="Next month"
              style={{ width: '2rem', height: '2rem' }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="cal-grid mb-1">
            {DAYS_OF_WEEK.map((d) => (
              <div key={d} className="text-center text-muted fw-semibold" style={{ fontSize: '0.7rem', padding: '0.25rem 0' }}>{d}</div>
            ))}
          </div>

          {/* Date cells */}
          <div className="cal-grid">
            {cells.map((cell, idx) => {
              if (cell.type !== 'current') return (
                <div key={idx} className="cal-day-other">{cell.day}</div>
              );
              const isSelected = cell.dateStr === selectedDate;
              const isToday    = cell.dateStr === todayStr;
              return (
                <button key={idx} type="button" disabled={cell.isPast}
                  onClick={() => !cell.isPast && setSelectedDate(cell.dateStr)}
                  aria-label={cell.dateStr} aria-pressed={isSelected}
                  className={`cal-day-btn mx-auto ${isSelected ? 'selected' : ''} ${isToday && !isSelected ? 'today' : ''}`}>
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div className="d-flex align-items-center gap-1 text-muted mt-3" style={{ fontSize: '0.72rem' }}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
            Indian Standard Time (IST, UTC+5:30)
          </div>
        </div>

        {/* Slots */}
        <div className="col p-4">
          {!selectedDate ? (
            <div className="d-flex flex-column align-items-center justify-content-center text-muted text-center py-5 gap-2">
              <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} style={{ opacity: 0.35 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="small fw-medium mb-0">Select a date to see available times</p>
            </div>
          ) : (
            <>
              <p className="fw-semibold small mb-3">{formatDayHeader(selectedDate)}</p>
              {slotsLoading ? (
                <div className="d-flex align-items-center justify-content-center gap-2 text-muted small py-5">
                  <span className="spinner-border spinner-border-sm" /> Loading slots…
                </div>
              ) : slots.length === 0 ? (
                <p className="text-muted small text-center py-5">No slots available for this date.</p>
              ) : (
                <div className="overflow-auto" style={{ maxHeight: '340px' }}>
                  {slots.map((slot) => {
                    const isChosen = selectedSlot?.value === slot.value;
                    return (
                      <div key={slot.value} className="d-flex gap-2 align-items-center mb-2">
                        <button type="button" disabled={!slot.available}
                          onClick={() => slot.available && setSelectedSlot(isChosen ? null : slot)}
                          className={`slot-btn ${!slot.available ? '' : isChosen ? 'slot-selected' : ''}`}>
                          {slot.time}
                        </button>
                        {isChosen && (
                          <button type="button" onClick={handleConfirm} disabled={confirming}
                            className="btn btn-primary btn-sm px-3 flex-shrink-0">
                            {confirming
                              ? <span className="spinner-border spinner-border-sm" />
                              : 'Confirm'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Back */}
      <div className="px-4 py-3 border-top bg-light">
        <button type="button" onClick={goBack}
          className="btn btn-outline-primary d-inline-flex align-items-center gap-2">
          ← Back
        </button>
      </div>
    </div>
  );
}
