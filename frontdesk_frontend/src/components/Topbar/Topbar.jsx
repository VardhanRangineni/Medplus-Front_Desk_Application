import React, { useState, useRef, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import medplusLogo from '../../assets/MedPlus.png';
import 'react-day-picker/style.css';
import './Topbar.css';

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconMenu = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="3" y1="6"  x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

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

// ── Topbar Component ──────────────────────────────────────────────────────────

/**
 * Topbar — reusable fixed header pill with location filter, date range picker
 * and user display.
 *
 * Props:
 *  locations        string[]       list of location options
 *  location         string         currently selected location
 *  onLocationChange fn             called with the new location string
 *  dateRange        { from: Date|null, to: Date|null }
 *  onDateRangeChange fn            called with the new dateRange object
 *  displayName      string         full display name for the user pill
 *  initials         string         single-char initials for the avatar
 *  todayLabel       string         formatted date string shown under the brand title
 *  pageName         string|null    when set, shows a "/" breadcrumb after "Front Desk"
 *  onMenuOpen       fn             called when the mobile hamburger is tapped
 */
const Topbar = ({
  locations = [],
  location,
  onLocationChange,
  dateRange,
  onDateRangeChange,
  displayName,
  initials,
  todayLabel,
  pageName = null,
  onMenuOpen,
}) => {
  const [locationOpen, setLocationOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  // 'start' = waiting for start-date click, 'end' = waiting for end-date click
  const [pickStep, setPickStep]         = useState('start');
  const locationRef = useRef(null);
  const calendarRef = useRef(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Close dropdowns on outside click
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
    <header className="dash-topbar">

      {/* Left: hamburger (mobile) + logo + title */}
      <div className="topbar-left">
        <button className="mobile-menu-btn" onClick={onMenuOpen} aria-label="Open menu">
          <IconMenu />
        </button>
        <img src={medplusLogo} alt="MedPlus" className="topbar-brand-logo" />
        <div className="topbar-title">
          <div className="topbar-breadcrumb-row">
            <h1>Front Desk</h1>
            {pageName && (
              <>
                <span className="topbar-breadcrumb-sep">/</span>
                <span className="topbar-breadcrumb-page">{pageName}</span>
              </>
            )}
          </div>
          {!pageName && <p>{todayLabel}</p>}
        </div>
      </div>

      {/* Right: location dropdown + date picker + user pill */}
      <div className="topbar-right">

        {/* Location filter */}
        <div className="location-dropdown" ref={locationRef}>
          <button
            className={`location-trigger ${locationOpen ? 'open' : ''}`}
            onClick={() => setLocationOpen(o => !o)}
          >
            <IconPin />
            <span>{location}</span>
            <IconChevronDown />
          </button>

          {locationOpen && (
            <div className="location-menu">
              {locations.map(loc => (
                <button
                  key={loc}
                  className={`location-option ${loc === location ? 'selected' : ''}`}
                  onClick={() => { onLocationChange(loc); setLocationOpen(false); }}
                >
                  {loc === location && <span className="option-check">✓</span>}
                  {loc}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date range picker */}
        <div className="date-picker-wrapper" ref={calendarRef}>
          <button
            className="date-trigger"
            onClick={() => {
              setPickStep('start');
              setCalendarOpen(o => !o);
            }}
          >
            <IconCalendar />
            <span>{dateLabel}</span>
          </button>

          {calendarOpen && (
            <div className="calendar-panel">
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
                  <p className="cal-footer-hint">
                    {pickStep === 'start' ? '① Click a start date' : '② Click an end date'}
                  </p>
                }
                numberOfMonths={2}
                className="brand-calendar"
              />
            </div>
          )}
        </div>

        {/* User pill */}
        <div className="user-pill">
          <div className="user-avatar">{initials}</div>
          <span>{displayName}</span>
        </div>

      </div>
    </header>
  );
};

export default Topbar;
