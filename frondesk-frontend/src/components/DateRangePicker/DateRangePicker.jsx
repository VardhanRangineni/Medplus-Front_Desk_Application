import { useState, useEffect, useRef } from 'react';
import './DateRangePicker.css';
import { IconCalendar, IconChevronDown } from '../Icons/Icons';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DOW_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const QUICK_PRESETS = [
  { label: 'Today',   days: 0  },
  { label: '7 days',  days: 6  },
  { label: '30 days', days: 29 },
  { label: '90 days', days: 89 },
];

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function toISODate(d) {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayISO() {
  return toISODate(new Date());
}

export function defaultRange() {
  const to   = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: toISODate(from), to: toISODate(to) };
}

export function defaultRangeToday() {
  const today = toISODate(new Date());
  return { from: today, to: today };
}

function formatPillDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ─── Single-month calendar ────────────────────────────────────────────────────

function MonthGrid({ year, month, from, to, pendingFrom, hoverDate,
                     onDayClick, onDayHover,
                     showPrev, showNext, onPrev, onNext }) {

  const today     = todayISO();
  const firstDow  = new Date(year, month, 1).getDay();
  const daysInMon = new Date(year, month + 1, 0).getDate();

  const cells = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMon; d++) {
    cells.push(
      `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    );
  }

  const selFrom = pendingFrom ?? from;
  const selTo   = pendingFrom ? hoverDate : to;
  const rangeL  = selFrom && selTo ? (selFrom <= selTo ? selFrom : selTo) : null;
  const rangeR  = selFrom && selTo ? (selFrom <= selTo ? selTo : selFrom) : null;

  return (
    <div className="drp-month">
      <div className="drp-month-head">
        {showPrev
          ? <button className="drp-nav-btn" onClick={onPrev}>&#8249;</button>
          : <span className="drp-nav-placeholder" />}

        <span className="drp-month-label">
          {MONTH_NAMES[month]} {year}
        </span>

        {showNext
          ? <button className="drp-nav-btn" onClick={onNext}>&#8250;</button>
          : <span className="drp-nav-placeholder" />}
      </div>

      <div className="drp-grid">
        {DOW_LABELS.map((d) => (
          <span key={d} className="drp-dow">{d}</span>
        ))}

        {cells.map((iso, i) => {
          if (!iso) return <span key={`pad-${i}`} className="drp-pad" />;

          const isFuture = iso > today;
          const isStart  = iso === (pendingFrom ?? from);
          const isEnd    = pendingFrom ? iso === hoverDate : iso === to;
          const inRange  = rangeL && rangeR && iso > rangeL && iso < rangeR;
          const isToday  = iso === today;
          const dayNum   = parseInt(iso.split('-')[2], 10);

          let cls = 'drp-day';
          if (isFuture)               cls += ' drp-day--disabled';
          if (isStart)                cls += ' drp-day--sel drp-day--start';
          if (isEnd && !isFuture)     cls += ' drp-day--sel drp-day--end';
          if (inRange)                cls += ' drp-day--in-range';
          if (isToday && !isStart && !isEnd) cls += ' drp-day--today';

          return (
            <button
              key={iso}
              className={cls}
              disabled={isFuture}
              onClick={() => onDayClick(iso)}
              onMouseEnter={() => onDayHover(iso)}
              onMouseLeave={() => onDayHover(null)}
            >
              {dayNum}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Date Range Picker ────────────────────────────────────────────────────────

export default function DateRangePicker({ from, to, onChange }) {
  const [open,        setOpen]        = useState(false);
  const [pendingFrom, setPendingFrom] = useState(null);
  const [hoverDate,   setHoverDate]   = useState(null);
  const [leftYear,    setLeftYear]    = useState(() => new Date(from).getFullYear());
  const [leftMonth,   setLeftMonth]   = useState(() => new Date(from).getMonth());

  const wrapRef = useRef(null);

  const rightMonth = (leftMonth + 1) % 12;
  const rightYear  = leftMonth === 11 ? leftYear + 1 : leftYear;

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setPendingFrom(null);
        setHoverDate(null);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  function openPicker() {
    const d = new Date(from);
    setLeftYear(d.getFullYear());
    setLeftMonth(d.getMonth());
    setPendingFrom(null);
    setHoverDate(null);
    setOpen(true);
  }

  function prevMonth() {
    if (leftMonth === 0) { setLeftMonth(11); setLeftYear((y) => y - 1); }
    else setLeftMonth((m) => m - 1);
  }

  function nextMonth() {
    if (leftMonth === 11) { setLeftMonth(0); setLeftYear((y) => y + 1); }
    else setLeftMonth((m) => m + 1);
  }

  function handleDayClick(iso) {
    if (pendingFrom === null) {
      setPendingFrom(iso);
    } else {
      const f = pendingFrom <= iso ? pendingFrom : iso;
      const t = pendingFrom <= iso ? iso : pendingFrom;
      onChange({ from: f, to: t });
      setPendingFrom(null);
      setHoverDate(null);
      setOpen(false);
    }
  }

  function applyPreset(preset) {
    const toD   = new Date();
    const fromD = new Date();
    fromD.setDate(fromD.getDate() - preset.days);
    onChange({ from: toISODate(fromD), to: toISODate(toD) });
    setPendingFrom(null);
    setOpen(false);
  }

  const pillLabel    = `${formatPillDate(from)} – ${formatPillDate(to)}`;
  const isSelecting  = pendingFrom !== null;

  return (
    <div className="drp-wrap" ref={wrapRef}>
      <button
        className={`drp-trigger${open ? ' drp-trigger--open' : ''}`}
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        <IconCalendar size={13} />
        <span className="drp-trigger-label">{pillLabel}</span>
        <IconChevronDown size={12} className={`drp-chevron${open ? ' drp-chevron--up' : ''}`} />
      </button>

      {open && (
        <div className="drp-popup">
          <div className="drp-hint">
            {isSelecting ? 'Now click an end date' : 'Click a start date'}
          </div>

          <div className="drp-calendars">
            <MonthGrid
              year={leftYear} month={leftMonth}
              from={from} to={to}
              pendingFrom={pendingFrom} hoverDate={hoverDate}
              onDayClick={handleDayClick} onDayHover={setHoverDate}
              showPrev onPrev={prevMonth}
              showNext={false} onNext={nextMonth}
            />
            <div className="drp-divider" />
            <MonthGrid
              year={rightYear} month={rightMonth}
              from={from} to={to}
              pendingFrom={pendingFrom} hoverDate={hoverDate}
              onDayClick={handleDayClick} onDayHover={setHoverDate}
              showPrev={false} onPrev={prevMonth}
              showNext onNext={nextMonth}
            />
          </div>

          <div className="drp-footer">
            <span className="drp-footer-label">Quick select:</span>
            {QUICK_PRESETS.map((p) => (
              <button key={p.label} className="drp-preset-btn" onClick={() => applyPreset(p)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
