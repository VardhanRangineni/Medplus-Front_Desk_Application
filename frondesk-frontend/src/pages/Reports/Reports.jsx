import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import './Reports.css';
import {
  IconCalendar,
  IconDownload,
  IconMapPin,
  IconUsers,
  IconBarChart,
  IconTrendingUp,
  IconClock,
} from '../../components/Icons/Icons';
import SearchSelect from '../../components/SearchSelect/SearchSelect';
import AppPageLoader from '../../components/AppPageLoader/AppPageLoader';
import DateRangePicker, { defaultRangeToday, formatRangeLabel } from '../../components/DateRangePicker/DateRangePicker';
import {
  getDeptSummary,
  getAvgDuration,
  getVisitorRatio,
  getVisitTrend,
  getActiveNow,
} from './reportsService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function rangeDayCount(from, to) {
  const f = parseLocalISO(from);
  const t = parseLocalISO(to);
  return Math.max(1, Math.round((t - f) / 86400000) + 1);
}

function comparisonLabel(from, to) {
  const days = rangeDayCount(from, to);
  if (days === 1) {
    return from === toISODate(new Date()) ? 'vs yesterday' : 'vs prior day';
  }
  return `vs prior ${days} days`;
}

function prevPeriodRange(from, to) {
  const days = rangeDayCount(from, to);
  const prevEnd = parseLocalISO(from);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days + 1);
  return { from: toISODate(prevStart), to: toISODate(prevEnd) };
}

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '< 1 min';
  const total = Math.round(Number(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDurationLong(minutes) {
  if (!minutes || minutes <= 0) return '0m';
  const total = Math.round(Number(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const TABLE_PREVIEW_ROWS = 5;

function pctChange(current, previous) {
  if (!previous) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function formatTrendValue(trend) {
  if (trend == null) return 'New';
  return formatPct(trend);
}

function formatPct(n) {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n}%`;
}

function weightedAvgDuration(rows) {
  if (!rows.length) return 0;
  let totalMin = 0;
  let totalVisits = 0;
  rows.forEach((r) => {
    totalMin += r.avgDurationMinutes * r.visitCount;
    totalVisits += r.visitCount;
  });
  return totalVisits ? totalMin / totalVisits : 0;
}

function durationVisitTotal(rows) {
  return rows.reduce((sum, r) => sum + (r.visitCount || 0), 0);
}

/** Contiguous busy-hour window from hourly trend (e.g. "11 AM - 2 PM"). */
function computePeakTimeRange(trendData) {
  if (!trendData?.length) return null;

  let maxIdx = 0;
  let maxCount = 0;
  trendData.forEach((p, i) => {
    if (p.count > maxCount) {
      maxCount = p.count;
      maxIdx = i;
    }
  });
  if (maxCount === 0) return null;

  const threshold = maxCount * 0.55;
  let start = maxIdx;
  let end = maxIdx;
  while (start > 0 && trendData[start - 1].count >= threshold) start -= 1;
  while (end < trendData.length - 1 && trendData[end + 1].count >= threshold) end += 1;

  const startLabel = trendData[start].label;
  const endLabel = trendData[end].label;
  return start === end ? startLabel : `${startLabel} - ${endLabel}`;
}

function formatDurationTrendSubtitle(trend, compareLabel, hasVisits) {
  if (!hasVisits) return 'No completed visits in this period.';
  if (trend == null) return 'Not enough prior data for comparison.';
  const dir = trend >= 0 ? 'longer' : 'shorter';
  const period = (compareLabel ?? 'the previous period').replace(/^vs\s+/i, '');
  return `${Math.abs(trend)}% ${dir} than ${period}`;
}

function exportDeptCsv(rows, from, to) {
  const header = 'Department,Total Visits,Avg Duration (min)\n';
  const body = rows.map((r) =>
    `"${r.department.replace(/"/g, '""')}",${r.visitCount},${Math.round(r.avgDurationMinutes)}`,
  ).join('\n');
  const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `department-summary_${from}_${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── UI pieces ────────────────────────────────────────────────────────────────

function KpiSparkline({ up }) {
  const stroke = up ? '#16a34a' : '#dc2626';
  const points = up
    ? '2,14 7,11 12,8 17,6 22,9 28,3'
    : '2,4 7,7 12,10 17,12 22,9 28,15';
  return (
    <svg className="rpt-kpi-spark" viewBox="0 0 30 16" aria-hidden>
      <polyline fill="none" stroke={stroke} strokeWidth="2" points={points} />
    </svg>
  );
}

function KpiCard({ icon, iconClass, label, value, sub, trend, trendUp, compareLabel }) {
  const showTrend = compareLabel && trend !== undefined;
  return (
    <div className="rpt-kpi">
      <div className={`rpt-kpi__icon rpt-kpi__icon--${iconClass}`}>{icon}</div>
      <div className="rpt-kpi__body">
        <span className="rpt-kpi__label">{label}</span>
        <span className="rpt-kpi__value">{value}</span>
        {sub && <span className="rpt-kpi__sub">{sub}</span>}
        {showTrend && (
          <div className="rpt-kpi__trend">
            {typeof trend === 'number' && <KpiSparkline up={trendUp} />}
            <span className={
              trend == null
                ? 'rpt-trend-new'
                : trendUp ? 'rpt-kpi__pct rpt-kpi__pct--up' : 'rpt-kpi__pct rpt-kpi__pct--down'
            }>
              {formatTrendValue(trend)} {compareLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function HorizontalBarList({ items, barClass = 'red' }) {
  if (!items.length) {
    return <div className="rpt-empty">No data for this period.</div>;
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="rpt-hbars">
      {items.map((item) => (
        <li key={item.label} className="rpt-hbars__row">
          <span className="rpt-hbars__label" title={item.label}>{item.label}</span>
          <div className="rpt-hbars__track">
            <div
              className={`rpt-hbars__fill rpt-hbars__fill--${barClass}`}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <span className="rpt-hbars__val">{item.display}</span>
        </li>
      ))}
    </ul>
  );
}

function MiniSparkline({ up }) {
  const stroke = up ? '#22c55e' : '#ef4444';
  const d = up ? 'M2 12 L6 9 L10 7 L14 5 L18 6 L22 4' : 'M2 6 L6 8 L10 10 L14 11 L18 9 L22 12';
  return (
    <svg className="rpt-table-spark" viewBox="0 0 24 14" aria-hidden>
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function VisitTrendChart({ data }) {
  if (!data.length) {
    return <div className="rpt-empty">No visit data for this period.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="rptTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C2181D" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#C2181D" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f1f3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={2} />
        <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: '#cbd5e1' }} axisLine={false} tickLine={false} width={32} />
        <Tooltip
          formatter={(v) => [v, 'Visits']}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#C2181D"
          strokeWidth={2}
          fill="url(#rptTrendFill)"
          dot={false}
          activeDot={{ r: 4, fill: '#C2181D' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function PanelCard({ title, filter, children }) {
  return (
    <div className="rpt-panel">
      <div className="rpt-panel__head">
        <h3 className="rpt-panel__title">{title}</h3>
        {filter && <div className="rpt-panel__filter">{filter}</div>}
      </div>
      <div className="rpt-panel__body">{children}</div>
    </div>
  );
}

function InsightsPanel({ subtitle, items }) {
  return (
    <div className="rpt-panel rpt-panel--insights">
      <div className="rpt-panel__head rpt-panel__head--stack">
        <div>
          <h3 className="rpt-panel__title">Insights</h3>
          <p className="rpt-panel__subtitle">{subtitle}</p>
        </div>
      </div>
      <ul className="rpt-insights">
        {items.map((item) => (
          <li key={item.id} className={`rpt-insight rpt-insight--${item.color}`}>
            <div className={`rpt-insight__icon rpt-insight__icon--${item.color}`} aria-hidden="true">
              {item.icon}
            </div>
            <div className="rpt-insight__text">
              <p className="rpt-insight__title">{item.title}</p>
              <p className="rpt-insight__desc">{item.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Reports({ session, locationScope }) {
  const [range, setRange] = useState(defaultRangeToday);
  const locationId = locationScope?.locationId ?? null;
  const allLocations = locationScope?.allLocations ?? false;
  const [deptFilter, setDeptFilter] = useState('');
  const [showAllDepts, setShowAllDepts] = useState(false);

  const [deptData, setDeptData] = useState([]);
  const [prevDeptData, setPrevDeptData] = useState([]);
  const [durationData, setDurationData] = useState([]);
  const [prevDurationData, setPrevDurationData] = useState([]);
  const [ratioData, setRatioData] = useState({ totalCount: 0 });
  const [prevRatio, setPrevRatio] = useState({ totalCount: 0 });
  const [trendData, setTrendData] = useState([]);
  const [activeNow, setActiveNow] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async (from, to) => {
    setLoading(true);
    const prev = prevPeriodRange(from, to);
    try {
      const [
        dept, prevDept, duration, prevDur, ratio, prevRat, trend, active,
      ] = await Promise.all([
        getDeptSummary(from, to, locationId, allLocations),
        getDeptSummary(prev.from, prev.to, locationId, allLocations),
        getAvgDuration(from, to, locationId, allLocations),
        getAvgDuration(prev.from, prev.to, locationId, allLocations),
        getVisitorRatio(from, to, locationId, allLocations),
        getVisitorRatio(prev.from, prev.to, locationId, allLocations),
        getVisitTrend(from, to, locationId, allLocations),
        getActiveNow(locationId, allLocations),
      ]);
      setDeptData(dept);
      setPrevDeptData(prevDept);
      setDurationData(duration);
      setPrevDurationData(prevDur);
      setRatioData(ratio);
      setPrevRatio(prevRat);
      setTrendData(trend);
      setActiveNow(active);
    } catch (err) {
      console.error('Reports load error:', err);
    } finally {
      setLoading(false);
    }
  }, [locationId, allLocations]);

  useEffect(() => {
    fetchAll(range.from, range.to);
  }, [range, locationId, allLocations, fetchAll]);

  const filteredDept = useMemo(() => {
    if (!deptFilter) return deptData;
    return deptData.filter((d) => d.department === deptFilter);
  }, [deptData, deptFilter]);

  const durationByDept = useMemo(() => {
    const map = new Map(durationData.map((d) => [d.department, d]));
    return filteredDept.map((d) => ({
      department: d.department,
      avgDurationMinutes: map.get(d.department)?.avgDurationMinutes ?? 0,
      visitCount: d.visitCount,
    }));
  }, [filteredDept, durationData]);

  const peakDept = deptData[0];
  const leastDept = deptData.length ? deptData[deptData.length - 1] : null;
  const avgMin = weightedAvgDuration(durationData);
  const prevAvgMin = weightedAvgDuration(prevDurationData);
  const durationVisitCount = durationVisitTotal(durationData);
  const totalVisits = ratioData.totalCount ?? 0;
  const visitsTrend = pctChange(totalVisits, prevRatio.totalCount);
  const durationTrend = durationVisitCount === 0
    ? undefined
    : pctChange(avgMin, prevAvgMin);

  const deptBarItems = useMemo(() =>
    [...filteredDept]
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, 10)
      .map((d) => ({
        label: d.department,
        value: d.visitCount,
        display: String(d.visitCount),
      })),
  [filteredDept]);

  const durationBarItems = useMemo(() =>
    [...durationByDept]
      .sort((a, b) => b.avgDurationMinutes - a.avgDurationMinutes)
      .slice(0, 10)
      .map((d) => ({
        label: d.department,
        value: d.avgDurationMinutes,
        display: formatDurationLong(d.avgDurationMinutes),
      })),
  [durationByDept]);

  const tableRows = useMemo(() => {
    const prevMap = new Map(prevDeptData.map((d) => [d.department, d.visitCount]));
    const durMap = new Map(durationData.map((d) => [d.department, d.avgDurationMinutes]));
    return filteredDept.map((d) => {
      const prevVisits = prevMap.get(d.department) ?? 0;
      const trend = pctChange(d.visitCount, prevVisits);
      return {
        department: d.department,
        visits: d.visitCount,
        avgMin: durMap.get(d.department) ?? 0,
        trend,
        trendUp: trend == null ? true : trend >= 0,
        isNew: trend == null,
      };
    });
  }, [filteredDept, prevDeptData, durationData]);

  const rangeLabel = formatRangeLabel(range.from, range.to);
  const compareLabel = comparisonLabel(range.from, range.to);
  const rangeDays = rangeDayCount(range.from, range.to);

  const insightsSubtitle = rangeDays === 1 && range.from === toISODate(new Date())
    ? "Key insights from today's data"
    : `Key insights for ${rangeLabel}`;

  const insights = useMemo(() => {
    const sortedDepts = [...deptData].sort((a, b) => b.visitCount - a.visitCount);
    const top = sortedDepts[0];
    const second = sortedDepts[1];
    const peakRange = computePeakTimeRange(trendData);
    const hasDuration = durationVisitCount > 0;

    const items = [];

    if (top && top.visitCount > 0) {
      let leadDesc = 'Leading department for this period.';
      if (second && second.visitCount > 0 && top.visitCount > second.visitCount) {
        const leadPct = Math.round(((top.visitCount - second.visitCount) / second.visitCount) * 1000) / 10;
        leadDesc = `${leadPct}% more than the second highest department`;
      }
      items.push({
        id: 'traffic',
        color: 'green',
        icon: <IconTrendingUp size={18} />,
        title: `${top.department} has the highest traffic with ${top.visitCount.toLocaleString('en-IN')} visit${top.visitCount !== 1 ? 's' : ''}`,
        description: leadDesc,
      });
    }

    items.push({
      id: 'duration',
      color: 'blue',
      icon: <IconClock size={18} />,
      title: hasDuration
        ? `Average visit duration is ${formatDurationLong(avgMin)}`
        : 'Average visit duration unavailable',
      description: formatDurationTrendSubtitle(durationTrend, compareLabel, hasDuration),
    });

    if (peakRange) {
      items.push({
        id: 'peak',
        color: 'purple',
        icon: <IconUsers size={18} />,
        title: `Peak time is between ${peakRange}`,
        description: 'Plan your resources accordingly',
      });
    } else if (leastDept && leastDept.department !== top?.department) {
      items.push({
        id: 'quiet',
        color: 'purple',
        icon: <IconUsers size={18} />,
        title: `${leastDept.department} is the least busy department`,
        description: `${leastDept.visitCount.toLocaleString('en-IN')} visit${leastDept.visitCount !== 1 ? 's' : ''} in this period`,
      });
    } else {
      items.push({
        id: 'peak',
        color: 'purple',
        icon: <IconUsers size={18} />,
        title: 'No clear peak time yet',
        description: 'Check-ins will show peak hours once activity is recorded',
      });
    }

    if (!items.length) {
      return [{
        id: 'empty',
        color: 'blue',
        icon: <IconBarChart size={18} />,
        title: 'No visitor activity recorded',
        description: 'Try a different date range or location filter',
      }];
    }

    return items;
  }, [
    deptData,
    trendData,
    avgMin,
    durationVisitCount,
    durationTrend,
    compareLabel,
    leastDept,
  ]);

  const deptOptions = useMemo(() => {
    const names = [...new Set(deptData.map((d) => d.department))].sort();
    return names;
  }, [deptData]);

  const deptFilterOptions = useMemo(() => [
    { value: '', label: 'All Departments' },
    ...deptOptions.map((d) => ({ value: d, label: d })),
  ], [deptOptions]);

  const visitTrendTitle = rangeDays === 1 && range.from === toISODate(new Date())
    ? 'Visit Trend (Today)'
    : `Visit Trend (${rangeLabel})`;
  const displayedTableRows = showAllDepts
    ? tableRows
    : tableRows.slice(0, TABLE_PREVIEW_ROWS);
  const hasMoreDepts = tableRows.length > TABLE_PREVIEW_ROWS;

  useEffect(() => {
    setShowAllDepts(false);
  }, [range.from, range.to, locationId, deptFilter]);

  return (
    <main className="rpt-content">

      <header className="rpt-page-head">
        <h1 className="rpt-page-head__title">Dashboard Overview</h1>
        <p className="rpt-page-head__sub">
          Real-time overview of visitor activity across departments.
        </p>
      </header>

      <section className="rpt-filters-bar" aria-label="Report filters">
        <div className="rpt-filter-field">
          <span className="rpt-filter-field__label">Period</span>
          <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
        </div>
        <div className="rpt-filter-field rpt-filter-field--dept">
          <span className="rpt-filter-field__label">Department</span>
          <SearchSelect
            value={deptFilter}
            onChange={setDeptFilter}
            options={deptFilterOptions}
            placeholder="All Departments"
            searchable
            searchPlaceholder="Search department…"
            emptyMessage="No departments found"
            ariaLabel="Filter by department"
          />
        </div>
        <button
          type="button"
          className="rpt-export-btn"
          onClick={() => exportDeptCsv(tableRows.map((r) => ({
            department: r.department,
            visitCount: r.visits,
            avgDurationMinutes: r.avgMin,
          })), range.from, range.to)}
          disabled={loading || !tableRows.length}
        >
          <IconDownload size={14} />
          Export
        </button>
      </section>

      {loading ? (
        <AppPageLoader label="Loading analytics…" />
      ) : (
        <>
          <section className="rpt-kpi-row">
            <KpiCard
              icon={<IconUsers size={18} />}
              iconClass="red"
              label="Total Visitors"
              value={totalVisits.toLocaleString('en-IN')}
              trend={visitsTrend}
              trendUp={visitsTrend == null ? true : visitsTrend >= 0}
              compareLabel={compareLabel}
            />
            <KpiCard
              icon={<IconCalendar size={18} />}
              iconClass="blue"
              label="Avg. Visit Duration"
              value={durationVisitCount === 0 ? '—' : formatDuration(avgMin)}
              trend={durationTrend}
              trendUp={durationTrend == null ? true : durationTrend <= 0}
              compareLabel={compareLabel}
            />
            <KpiCard
              icon={<IconBarChart size={18} />}
              iconClass="green"
              label="Peak Department"
              value={peakDept?.department ?? '—'}
              sub={peakDept ? `${peakDept.visitCount} visits` : undefined}
            />
            <KpiCard
              icon={<IconMapPin size={18} />}
              iconClass="orange"
              label="Least Busy Department"
              value={leastDept?.department ?? '—'}
              sub={leastDept ? `${leastDept.visitCount} visit${leastDept.visitCount !== 1 ? 's' : ''}` : undefined}
            />
            <KpiCard
              icon={<IconUsers size={18} />}
              iconClass="purple"
              label="Active Visitors Now"
              value={String(activeNow)}
              sub="Across all departments"
            />
          </section>

          <section className="rpt-charts-row">
            <PanelCard
              title="Top Departments by Visits"
              filter={<span className="rpt-chip">Top 10</span>}
            >
              <HorizontalBarList items={deptBarItems} barClass="red" />
            </PanelCard>

            <PanelCard
              title="Average Visit Duration"
              filter={<span className="rpt-chip">Top 10</span>}
            >
              <HorizontalBarList items={durationBarItems} barClass="green" />
            </PanelCard>

            <PanelCard
              title={visitTrendTitle}
              filter={<span className="rpt-chip">By Hour</span>}
            >
              <VisitTrendChart data={trendData} />
            </PanelCard>
          </section>

          <section className="rpt-bottom-row">
            <div className="rpt-panel rpt-panel--table">
              <div className="rpt-panel__head rpt-panel__head--stack">
                <div>
                  <h3 className="rpt-panel__title">Department Summary</h3>
                  <p className="rpt-panel__period">
                    <IconCalendar size={12} />
                    {rangeLabel}
                  </p>
                </div>
                {tableRows.length > 0 && (
                  <span className="rpt-panel__count">
                    {tableRows.length} department{tableRows.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className={`rpt-table-wrap${showAllDepts ? ' rpt-table-wrap--expanded' : ''}`}>
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Total Visits</th>
                      <th>Avg. Visit Duration</th>
                      <th>Trend ({compareLabel})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedTableRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="rpt-table__empty">No departments to show.</td>
                      </tr>
                    ) : displayedTableRows.map((row) => (
                      <tr key={row.department}>
                        <td className="rpt-table__dept">{row.department}</td>
                        <td>{row.visits}</td>
                        <td>{formatDuration(row.avgMin)}</td>
                        <td>
                          <div className="rpt-table__trend">
                            {!row.isNew && <MiniSparkline up={row.trendUp} />}
                            <span className={
                              row.isNew
                                ? 'rpt-trend-new'
                                : row.trendUp ? 'rpt-trend-up' : 'rpt-trend-down'
                            }>
                              {formatTrendValue(row.trend)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hasMoreDepts && (
                <button
                  type="button"
                  className="rpt-view-all"
                  onClick={() => setShowAllDepts((v) => !v)}
                >
                  {showAllDepts
                    ? 'Show fewer departments ↑'
                    : `View All Departments (${tableRows.length}) →`}
                </button>
              )}
            </div>

            <InsightsPanel subtitle={insightsSubtitle} items={insights} />
          </section>
        </>
      )}
    </main>
  );
}
