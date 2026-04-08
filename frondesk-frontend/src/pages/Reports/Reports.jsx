import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PieChart, Pie, Cell,
  BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import './Reports.css';
import { IconCalendar, IconChevronDown, IconBarChart } from '../../components/Icons/Icons';
import LocationSelector from '../../components/LocationSelector/LocationSelector';
import {
  getDeptSummary,
  getVisitorRatio,
  getAvgDuration,
  getFrequentVisitors,
} from './reportsService';

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

const DURATION_COLORS = ['#C2181D','#d4302f','#e05a2b','#e07a2b','#e09a2b','#cfa83c','#4da96f'];

const AVATAR_COLORS = [
  '#C2181D','#1976D2','#388E3C','#7B1FA2',
  '#E64A19','#00838F','#AD1457','#283593',
];

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayISO() {
  return toISODate(new Date());
}

function defaultRange() {
  const to   = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: toISODate(from), to: toISODate(to) };
}

function formatPillDate(iso) {
  // iso = "YYYY-MM-DD" — parse as local noon to avoid any TZ shift
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '< 1 min';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatLastVisit(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function getInitials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

// ─── Single-month calendar ────────────────────────────────────────────────────

function MonthGrid({ year, month, from, to, pendingFrom, hoverDate,
                     onDayClick, onDayHover,
                     showPrev, showNext, onPrev, onNext }) {

  const today     = todayISO();
  const firstDow  = new Date(year, month, 1).getDay();
  const daysInMon = new Date(year, month + 1, 0).getDate();

  // Build cells: null = padding
  const cells = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMon; d++) {
    cells.push(
      `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    );
  }

  // Effective range for highlighting (during selection, use pendingFrom + hover)
  const selFrom  = pendingFrom ?? from;
  const selTo    = pendingFrom ? hoverDate : to;
  const rangeL   = selFrom && selTo ? (selFrom <= selTo ? selFrom : selTo) : null;
  const rangeR   = selFrom && selTo ? (selFrom <= selTo ? selTo : selFrom) : null;

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

          const isFuture  = iso > today;
          const isStart   = iso === (pendingFrom ?? from);
          const isEnd     = pendingFrom ? iso === hoverDate : iso === to;
          const inRange   = rangeL && rangeR && iso > rangeL && iso < rangeR;
          const isToday   = iso === today;
          const dayNum    = parseInt(iso.split('-')[2], 10);

          let cls = 'drp-day';
          if (isFuture)      cls += ' drp-day--disabled';
          if (isStart)       cls += ' drp-day--sel drp-day--start';
          if (isEnd && !isFuture) cls += ' drp-day--sel drp-day--end';
          if (inRange)       cls += ' drp-day--in-range';
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

function DateRangePicker({ from, to, onChange }) {
  const [open,        setOpen]        = useState(false);
  const [pendingFrom, setPendingFrom] = useState(null); // first click waiting for second
  const [hoverDate,   setHoverDate]   = useState(null);
  const [leftYear,    setLeftYear]    = useState(() => {
    const d = new Date(from);
    return d.getFullYear();
  });
  const [leftMonth, setLeftMonth] = useState(() => {
    const d = new Date(from);
    return d.getMonth();
  });

  const wrapRef = useRef(null);

  // Derive right-side month
  const rightMonth = (leftMonth + 1) % 12;
  const rightYear  = leftMonth === 11 ? leftYear + 1 : leftYear;

  // Close on outside click
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
    // Reset view to show the current 'from' month
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
      // First click — start selection
      setPendingFrom(iso);
    } else {
      // Second click — finalise
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

  const pillLabel = `${formatPillDate(from)} – ${formatPillDate(to)}`;
  const isSelecting = pendingFrom !== null;

  return (
    <div className="drp-wrap" ref={wrapRef}>
      {/* Trigger */}
      <button
        className={`drp-trigger${open ? ' drp-trigger--open' : ''}`}
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        <IconCalendar size={13} />
        <span className="drp-trigger-label">{pillLabel}</span>
        <IconChevronDown size={12} className={`drp-chevron${open ? ' drp-chevron--up' : ''}`} />
      </button>

      {/* Popup */}
      {open && (
        <div className="drp-popup">

          {/* Instruction hint */}
          <div className="drp-hint">
            {isSelecting
              ? 'Now click an end date'
              : 'Click a start date'}
          </div>

          {/* Two-month calendars */}
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

          {/* Quick presets footer */}
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

// ─── Department Bar Chart (Recharts horizontal) ───────────────────────────────

const DEPT_COLORS = ['#C2181D','#d4302f','#e05a2b','#e07a2b','#e09a2b','#cfa83c','#4da96f'];

function DeptBarChart({ data }) {
  if (!data.length) return <div className="rpt-empty">No department data for this period.</div>;

  const total = data.reduce((s, d) => s + d.visitCount, 0) || 1;
  const chartData = data.map((d, i) => ({
    dept: d.department.length > 18 ? d.department.slice(0, 17) + '…' : d.department,
    fullDept: d.department,
    visits: d.visitCount,
    pct: Math.round((d.visitCount / total) * 100),
    fill: DEPT_COLORS[i % DEPT_COLORS.length],
  }));

  const rowHeight = 44;
  const height = Math.max(chartData.length * rowHeight + 20, 140);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RBarChart data={chartData} layout="vertical" margin={{ top: 4, right: 52, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f1f3" />
        <XAxis type="number" hide />
        <YAxis
          type="category" dataKey="dept" width={110}
          tick={{ fontSize: 12, fill: '#555' }} axisLine={false} tickLine={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          formatter={(v, _, props) => [`${v} visits (${props.payload.pct}%)`, props.payload.fullDept]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #eee' }}
        />
        <Bar dataKey="visits" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={700}>
          {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
          <LabelList
            dataKey="visits"
            position="right"
            style={{ fontSize: 12, fontWeight: 700, fill: '#555' }}
          />
        </Bar>
      </RBarChart>
    </ResponsiveContainer>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────

const DONUT_COLORS = { visitor: '#C2181D', employee: '#32A94C', empty: '#f0f1f3' };

function DonutChart({ data }) {
  const total       = data.totalCount   || 0;
  const visitorPct  = total ? Math.round((data.visitorCount  / total) * 100) : 0;
  const employeePct = total ? Math.round((data.employeeCount / total) * 100) : 0;

  const chartData = total > 0
    ? [
        { name: 'Visitors',  value: data.visitorCount  },
        { name: 'Employees', value: data.employeeCount },
      ]
    : [{ name: 'No data', value: 1 }];

  const colors = total > 0
    ? [DONUT_COLORS.visitor, DONUT_COLORS.employee]
    : [DONUT_COLORS.empty];

  return (
    <div className="rpt-donut-wrap">
      <div className="rpt-donut-chart" style={{ position: 'relative', width: 180, height: 180 }}>
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%" cy="50%"
              innerRadius={64} outerRadius={90}
              startAngle={90} endAngle={-270}
              dataKey="value"
              strokeWidth={0}
              isAnimationActive={true}
              animationBegin={0}
              animationDuration={800}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={colors[i]} />
              ))}
            </Pie>
            {total > 0 && (
              <Tooltip
                formatter={(value, name) => [`${value}`, name]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #eee' }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
        {/* Centre label */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: '#111', lineHeight: 1 }}>{total}</span>
          <span style={{ fontSize: 10, color: '#aaa', letterSpacing: '0.6px', marginTop: 2 }}>TOTAL</span>
        </div>
      </div>

      <div className="rpt-donut-legend">
        {[
          { label: 'Visitors',  count: data.visitorCount,  pct: visitorPct,  cls: 'red'   },
          { label: 'Employees', count: data.employeeCount, pct: employeePct, cls: 'green' },
        ].map(({ label, count, pct, cls }) => (
          <div key={label} className="rpt-donut-stat">
            <div className="rpt-donut-stat__top">
              <span className={`rpt-donut-stat__dot rpt-donut-stat__dot--${cls}`} />
              <span className="rpt-donut-stat__label">{label}</span>
            </div>
            <div className="rpt-donut-stat__count">{count}</div>
            <div className="rpt-donut-stat__pct">{pct}% of total</div>
            <div className="rpt-donut-stat__bar">
              <div className={`rpt-donut-stat__bar-fill rpt-donut-stat__bar-fill--${cls}`}
                style={{ width: `${pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Average Duration Chart (Recharts horizontal) ─────────────────────────────

function AvgDurationList({ data }) {
  if (!data.length) return <div className="rpt-empty">No completed visits for this period.</div>;

  const chartData = data.map((d, i) => ({
    dept: d.department.length > 18 ? d.department.slice(0, 17) + '…' : d.department,
    fullDept: d.department,
    minutes: d.avgDurationMinutes,
    label: formatDuration(d.avgDurationMinutes),
    visits: d.visitCount,
    fill: DURATION_COLORS[Math.min(i, DURATION_COLORS.length - 1)],
  }));

  const rowHeight = 44;
  const height = Math.max(chartData.length * rowHeight + 20, 140);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RBarChart data={chartData} layout="vertical" margin={{ top: 4, right: 72, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f1f3" />
        <XAxis type="number" hide />
        <YAxis
          type="category" dataKey="dept" width={110}
          tick={{ fontSize: 12, fill: '#555' }} axisLine={false} tickLine={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          formatter={(_, __, props) => [
            `${props.payload.label} avg · ${props.payload.visits} visit${props.payload.visits !== 1 ? 's' : ''}`,
            props.payload.fullDept,
          ]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #eee' }}
        />
        <Bar dataKey="minutes" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={700}>
          {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
          <LabelList
            dataKey="label"
            position="right"
            style={{ fontSize: 12, fontWeight: 700, fill: '#555' }}
          />
        </Bar>
      </RBarChart>
    </ResponsiveContainer>
  );
}

// ─── Frequent Visitor Table ───────────────────────────────────────────────────

function FrequentVisitorTable({ data }) {
  if (!data.length) {
    return <div className="rpt-empty">No visitors with multiple check-ins for this period.</div>;
  }

  return (
    <div className="rpt-fv-wrap">
      <table className="rpt-fv-table">
        <thead>
          <tr>
            <th>Visitor</th>
            <th>Mobile</th>
            <th>Visits</th>
            <th>Departments</th>
            <th>Last Visit</th>
          </tr>
        </thead>
        <tbody>
          {data.map((v, i) => {
            const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
            const crown       = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;

            return (
              <tr key={i} className={i < 3 ? 'rpt-fv-row--top' : ''}>
                <td>
                  <div className="rpt-fv-visitor">
                    <span className="rpt-fv-avatar" style={{ background: avatarColor }}>
                      {getInitials(v.name)}
                      {crown && <span className="rpt-fv-crown">{crown}</span>}
                    </span>
                    <span className="rpt-fv-name">{v.name}</span>
                  </div>
                </td>
                <td className="rpt-fv-mobile">{v.mobile ?? '—'}</td>
                <td>
                  <span className="rpt-visit-badge" style={{ '--badge-color': avatarColor }}>
                    {v.visitCount}×
                  </span>
                </td>
                <td className="rpt-fv-depts" title={v.departments}>{v.departments ?? '—'}</td>
                <td className="rpt-fv-date">{formatLastVisit(v.lastVisit)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rpt-skeleton">
      {[80, 55, 70, 45, 60].map((w, i) => (
        <div key={i} className="rpt-skeleton-row">
          <div className="rpt-skeleton-circle" />
          <div className="rpt-skeleton-lines">
            <div className="rpt-skeleton-line" style={{ width: `${w}%` }} />
            <div className="rpt-skeleton-track" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Report Card ──────────────────────────────────────────────────────────────

function ReportCard({ title, subtitle, badge, loading, error, children }) {
  return (
    <div className="rpt-card">
      <div className="rpt-card__header">
        <div className="rpt-card__header-text">
          <h3 className="rpt-card__title">{title}</h3>
          {subtitle && <p className="rpt-card__sub">{subtitle}</p>}
        </div>
        {badge != null && !loading && !error && (
          <span className="rpt-card__badge">{badge}</span>
        )}
      </div>
      <div className="rpt-card__body">
        {loading ? <CardSkeleton />
          : error ? (
            <div className="rpt-error">
              <span className="rpt-error__icon">⚠</span>{error}
            </div>
          ) : children}
      </div>
    </div>
  );
}

// ─── Main Reports Page ────────────────────────────────────────────────────────

export default function Reports({ session }) {
  const [range,      setRange]      = useState(defaultRange);
  const [locationId, setLocationId] = useState(null);

  const [deptData,     setDeptData]     = useState([]);
  const [ratioData,    setRatioData]    = useState({ visitorCount: 0, employeeCount: 0, totalCount: 0 });
  const [durationData, setDurationData] = useState([]);
  const [frequentData, setFrequentData] = useState([]);

  const [loading, setLoading] = useState({ dept: true, ratio: true, duration: true, frequent: true });
  const [errors,  setErrors]  = useState({ dept: null, ratio: null, duration: null, frequent: null });

  const fetchAll = useCallback(async (from, to, locId) => {
    setLoading({ dept: true, ratio: true, duration: true, frequent: true });
    setErrors({ dept: null, ratio: null, duration: null, frequent: null });

    const safe = async (key, fn) => {
      try   { return { key, data: await fn() }; }
      catch (e) { return { key, error: e.message }; }
    };

    const results = await Promise.all([
      safe('dept',     () => getDeptSummary(from, to, locId)),
      safe('ratio',    () => getVisitorRatio(from, to, locId)),
      safe('duration', () => getAvgDuration(from, to, locId)),
      safe('frequent', () => getFrequentVisitors(from, to, 2, locId)),
    ]);

    const newLoad = { dept: false, ratio: false, duration: false, frequent: false };
    const newErr  = { dept: null,  ratio: null,  duration: null,  frequent: null  };

    results.forEach(({ key, data, error }) => {
      if (error) {
        newErr[key] = error;
      } else {
        if (key === 'dept')     setDeptData(data);
        if (key === 'ratio')    setRatioData(data);
        if (key === 'duration') setDurationData(data);
        if (key === 'frequent') setFrequentData(data);
      }
    });

    setLoading(newLoad);
    setErrors(newErr);
  }, []);

  useEffect(() => { fetchAll(range.from, range.to, locationId); }, [range, locationId, fetchAll]);

  const totalDepts  = deptData.length;
  const totalVisits = deptData.reduce((s, d) => s + d.visitCount, 0);

  return (
    <main className="rpt-content">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="rpt-header">
        <div className="rpt-header__left">
          <div className="rpt-header__icon">
            <IconBarChart size={17} />
          </div>
          <div>
            <h1 className="rpt-header__title">Analytics &amp; Reports</h1>
            <p className="rpt-header__sub">
              {locationId ? 'Filtered by selected location' : 'All locations · change with the selector'}
            </p>
          </div>
        </div>

        <div className="rpt-header__filters">
          <LocationSelector
            session={session}
            value={locationId}
            onChange={setLocationId}
          />
          <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
        </div>
      </div>

      {/* ── Row 1 ────────────────────────────────────────────────────────── */}
      <div className="rpt-row">
        <ReportCard
          title="Department-wise Visit Summary"
          subtitle="Total check-ins by department"
          badge={`${totalDepts} dept${totalDepts !== 1 ? 's' : ''} · ${totalVisits} total`}
          loading={loading.dept} error={errors.dept}
        >
          <DeptBarChart data={deptData} />
        </ReportCard>

        <ReportCard
          title="Visitor vs. Employee Ratio"
          subtitle="Breakdown of all entries by entry type"
          loading={loading.ratio} error={errors.ratio}
        >
          <DonutChart data={ratioData} />
        </ReportCard>
      </div>

      {/* ── Row 2 ────────────────────────────────────────────────────────── */}
      <div className="rpt-row">
        <ReportCard
          title="Average Visit Duration"
          subtitle="Mean dwell time per department (checked-out visits only)"
          badge={durationData.length ? `${durationData.length} dept${durationData.length !== 1 ? 's' : ''}` : null}
          loading={loading.duration} error={errors.duration}
        >
          <AvgDurationList data={durationData} />
        </ReportCard>

        <ReportCard
          title="Frequent Visitor Report"
          subtitle="External visitors with 2 or more check-ins"
          badge={frequentData.length ? `${frequentData.length} visitor${frequentData.length !== 1 ? 's' : ''}` : null}
          loading={loading.frequent} error={errors.frequent}
        >
          <FrequentVisitorTable data={frequentData} />
        </ReportCard>
      </div>

    </main>
  );
}
