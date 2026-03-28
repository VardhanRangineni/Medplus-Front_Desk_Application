import React, { useState, useRef, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import 'react-day-picker/style.css';
import './PageFilters.css';

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconPin = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);

const IconChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const IconCalendar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

// ── PageFilters Component ─────────────────────────────────────────────────────

/**
 * PageFilters — inline location + date-range filter bar for page headers.
 *
 * Props:
 *  locations          string[]
 *  location           string
 *  onLocationChange   fn
 *  dateRange          { from: Date|null, to: Date|null }
 *  onDateRangeChange  fn
 */
const PageFilters = ({
  locations = [],
  location,
  onLocationChange,
  dateRange,
  onDateRangeChange,
}) => {
  const [locationOpen, setLocationOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pickStep,     setPickStep]     = useState('start');
  const locationRef = useRef(null);
  const calendarRef = useRef(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    const handler = (e) => {
      if (locationRef.current && !locationRef.current.contains(e.target))
        setLocationOpen(false);
      if (calendarRef.current && !calendarRef.current.contains(e.target))
        setCalendarOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fmtDate   = (d) => (d instanceof Date ? format(d, 'MMM d, yyyy') : '');
  const dateLabel = dateRange?.from && dateRange?.to
    ? `${fmtDate(dateRange.from)}  –  ${fmtDate(dateRange.to)}`
    : dateRange?.from
    ? `${fmtDate(dateRange.from)}  –  …`
    : 'Select range';

  return (
    <div className="pf-filters">

      {/* Location dropdown */}
      <div className="pf-location-dropdown" ref={locationRef}>
        <button
          className={`pf-location-trigger ${locationOpen ? 'open' : ''}`}
          onClick={() => setLocationOpen(o => !o)}
        >
          <IconPin />
          <span>{location}</span>
          <IconChevronDown />
        </button>

        {locationOpen && (
          <div className="pf-location-menu">
            {locations.map((loc, idx) => (
              <React.Fragment key={loc}>
                <button
                  className={`pf-location-option ${loc === location ? 'selected' : ''}`}
                  onClick={() => { onLocationChange(loc); setLocationOpen(false); }}
                >
                  <span className="pf-option-check" style={{ visibility: loc === location ? 'visible' : 'hidden' }}>✓</span>
                  {loc}
                </button>
                {loc === 'All' && locations.length > 1 && (
                  <div className="pf-location-divider" />
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Date range picker */}
      <div className="pf-date-picker-wrapper" ref={calendarRef}>
        <button
          className="pf-date-trigger"
          onClick={() => {
            setPickStep('start');
            setCalendarOpen(o => !o);
          }}
        >
          <IconCalendar />
          <span>{dateLabel}</span>
        </button>

        {calendarOpen && (
          <div className="pf-calendar-panel">
            <DayPicker
              mode="single"
              disabled={{ after: today }}
              selected={pickStep === 'end' ? dateRange.from : undefined}
              modifiers={{
                range_start: dateRange.from,
                range_end:   dateRange.to,
              }}
              modifiersClassNames={{
                range_start: 'day-range-start',
                range_end:   'day-range-end',
              }}
              onDayClick={(day, modifiers) => {
                if (modifiers.disabled) return;
                day.setHours(0, 0, 0, 0);
                if (pickStep === 'start') {
                  onDateRangeChange({ from: day, to: undefined });
                  setPickStep('end');
                } else {
                  const from = dateRange.from;
                  onDateRangeChange(day < from ? { from: day, to: from } : { from, to: day });
                  setPickStep('start');
                  setCalendarOpen(false);
                }
              }}
              footer={
                <p className="pf-cal-footer-hint">
                  {pickStep === 'start' ? '① Click a start date' : '② Click an end date'}
                </p>
              }
              numberOfMonths={2}
              className="pf-brand-calendar"
            />
          </div>
        )}
      </div>

    </div>
  );
};

export default PageFilters;
