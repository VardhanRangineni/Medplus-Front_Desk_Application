/**
 * reportsExportService.js — Excel (detailed tables) and PDF (dashboard summary + charts).
 */

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { saveBinaryFile } from '../../utils/fileDownload';
import { fetchAllEntriesForExport } from '../CheckInOut/checkInOutService';
import { getFrequentVisitors } from './reportsService';

function fmtDate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return (
    d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' '
    + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  );
}

function fmtDuration(minutes) {
  if (minutes == null || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtTrend(trend) {
  if (trend == null) return 'New';
  const sign = trend >= 0 ? '+' : '';
  return `${sign}${Math.round(trend)}%`;
}

function buildFilename(from, to, ext) {
  return from && to && from !== to
    ? `reports_${from}_to_${to}.${ext}`
    : `reports_${from || to}.${ext}`;
}

function autoCols(rows) {
  if (!rows.length) return [];
  const widths = rows[0].map((_, ci) =>
    Math.min(40, Math.max(10, ...rows.map((r) => String(r[ci] ?? '').length + 2))),
  );
  return widths.map((wch) => ({ wch }));
}

function addSheet(wb, name, headers, rows) {
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = autoCols(data);
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
}

/**
 * @param {object} snapshot Dashboard data already loaded on Reports page.
 * @param {{ locationId?: string|null, allLocations?: boolean }} scope
 */
export async function exportReportsExcel(snapshot, scope = {}) {
  const { from, to } = snapshot.range;
  const filename = buildFilename(from, to, 'xlsx');

  const [visitorRows, frequentVisitors] = await Promise.all([
    fetchAllEntriesForExport({
      from,
      to,
      department: snapshot.deptFilter || null,
      locationId: scope.locationId ?? null,
      allLocations: scope.allLocations ?? false,
    }),
    getFrequentVisitors(from, to, 2, scope.locationId ?? null, scope.allLocations ?? false),
  ]);

  const wb = XLSX.utils.book_new();

  addSheet(wb, 'Summary', ['Metric', 'Value'], [
    ['Report Period', snapshot.rangeLabel],
    ['Department Filter', snapshot.deptFilter || 'All Departments'],
    ['Total Visits', snapshot.totalVisits],
    ['Visitors', snapshot.ratioData?.visitorCount ?? 0],
    ['Employees', snapshot.ratioData?.employeeCount ?? 0],
    ['Avg Visit Duration', snapshot.durationVisitCount === 0 ? '—' : fmtDuration(snapshot.avgMin)],
    ['Peak Department', snapshot.peakDept?.department ?? '—'],
    ['Least Busy Department', snapshot.leastDept?.department ?? '—'],
    ['Active Visitors Now', snapshot.activeNow],
    [`Trend (${snapshot.compareLabel})`, fmtTrend(snapshot.visitsTrend)],
  ]);

  addSheet(wb, 'Departments', ['Department', 'Total Visits', 'Avg Duration', `Trend (${snapshot.compareLabel})`],
    snapshot.tableRows.map((r) => [
      r.department,
      r.visits,
      fmtDuration(r.avgMin),
      fmtTrend(r.trend),
    ]),
  );

  addSheet(wb, 'Visit Trend', ['Time', 'Visit Count'],
    snapshot.trendData.map((p) => [p.label, p.count]),
  );

  addSheet(wb, 'Avg Duration', ['Department', 'Avg Duration (min)', 'Visit Count'],
    snapshot.durationByDept.map((d) => [
      d.department,
      Math.round(d.avgDurationMinutes),
      d.visitCount,
    ]),
  );

  addSheet(wb, 'Frequent Visitors',
    ['Type', 'Name', 'Mobile / Emp ID', 'Visits', 'Departments', 'Last Visit'],
    frequentVisitors.map((v) => [
      v.entryType === 'EMPLOYEE' ? 'Employee' : 'Visitor',
      v.name ?? '',
      v.entryType === 'EMPLOYEE' ? (v.empId ?? '') : (v.mobile ?? ''),
      v.visitCount ?? 0,
      v.departments ?? '',
      fmtDate(v.lastVisit),
    ]),
  );

  addSheet(wb, 'Visitor Log', [
    'Entry ID', 'Type', 'Name', 'Mobile / Emp ID', 'Department', 'Status',
    'Person to Meet', 'Card(s)', 'Check-In', 'Check-Out', 'Reason for Visit',
  ], visitorRows.map((e) => [
    e.id,
    e.type === 'EMPLOYEE' ? 'Employee' : 'Visitor',
    e.name,
    e.type === 'EMPLOYEE' ? (e.empId ?? '') : (e.mobile ?? ''),
    e.department ?? '',
    e.status === 'pending-approval' ? 'Pending'
    : e.status === 'approved' ? 'Approved'
    : e.status === 'rejected' ? 'Rejected'
    : e.status === 'checked-in' ? 'Checked-in'
    : 'Checked-out',
    e.personToMeet ?? '',
    e.card != null ? String(e.card) : '',
    fmtDate(e.checkIn),
    fmtDate(e.checkOut),
    e.reasonForVisit ?? '',
  ]));

  const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return saveBinaryFile(bytes, filename, [{ name: 'Excel Workbook', extensions: ['xlsx'] }]);
}

function drawSectionTitle(doc, y, title) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text(title, 14, y);
  doc.setDrawColor(194, 24, 29);
  doc.setLineWidth(0.6);
  doc.line(14, y + 2, 196, y + 2);
  return y + 10;
}

const PDF_PAGE_BOTTOM = 275;

/** Start new page when section won't fit. */
function ensureSpace(doc, y, needed) {
  if (y + needed > PDF_PAGE_BOTTOM) {
    doc.addPage();
    return 20;
  }
  return y;
}

function chartMaxValue(trendData) {
  const raw = Math.max(...trendData.map((p) => Number(p.count) || 0), 1);
  if (raw <= 10) return Math.ceil(raw);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = raw / magnitude <= 2 ? magnitude : raw / magnitude <= 5 ? 2 * magnitude : 5 * magnitude;
  return Math.ceil(raw / step) * step;
}

function drawKpiGrid(doc, startY, snapshot) {
  const kpis = [
    ['Total Visits', String(snapshot.totalVisits)],
    ['Avg Duration', snapshot.durationVisitCount === 0 ? '—' : fmtDuration(snapshot.avgMin)],
    ['Peak Dept', snapshot.peakDept?.department ?? '—'],
    ['Active Now', String(snapshot.activeNow)],
  ];
  doc.setFontSize(9);
  let y = startY;
  kpis.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 14 + col * 92;
    const yy = y + row * 18;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(label, x, yy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(String(value).slice(0, 42), x, yy + 6);
    doc.setFontSize(9);
  });
  return startY + 40;
}

function drawHorizontalBars(doc, startY, title, items, valueSuffix = '') {
  let y = drawSectionTitle(doc, startY, title);
  if (!items.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('No data for this period.', 14, y);
    return y + 8;
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  const barMaxW = 90;
  items.slice(0, 8).forEach((item) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(String(item.label).slice(0, 28), 14, y);
    const w = (item.value / max) * barMaxW;
    doc.setFillColor(194, 24, 29);
    doc.rect(70, y - 3.5, w, 4, 'F');
    doc.setTextColor(30, 30, 30);
    doc.text(`${item.display ?? item.value}${valueSuffix}`, 70 + barMaxW + 4, y);
    y += 9;
  });
  return y + 4;
}

function drawTrendChart(doc, startY, title, trendData) {
  const CHART_H = 58;
  const CHART_W = 158;
  const CHART_X = 32;
  const Y_LABEL_X = 14;
  const BLOCK_H = 10 + 6 + CHART_H + 14;

  let y = drawSectionTitle(doc, startY, title);
  if (!trendData.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('No visit data for this period.', 14, y);
    return y + 8;
  }

  const chartY = y + 4;
  const max = chartMaxValue(trendData);
  const peak = trendData.reduce(
    (best, p) => ((Number(p.count) || 0) > best.count ? { label: p.label, count: Number(p.count) || 0 } : best),
    { label: '', count: 0 },
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Visits per hour of day · peak ${peak.count} at ${peak.label || '—'}`, 14, chartY - 1);

  const plotTop = chartY + 3;
  const plotBottom = chartY + CHART_H - 8;
  const plotH = plotBottom - plotTop;

  // Frame + grid + Y-axis labels
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.rect(CHART_X, plotTop, CHART_W, plotH);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  for (let i = 0; i <= 4; i += 1) {
    const val = Math.round((max * (4 - i)) / 4);
    const gy = plotTop + (plotH / 4) * i;
    if (i > 0 && i < 4) {
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.line(CHART_X, gy, CHART_X + CHART_W, gy);
    }
    doc.text(String(val), Y_LABEL_X, gy + 1.5);
  }

  doc.setFontSize(7);
  doc.text('Visits', Y_LABEL_X, plotTop - 2);

  const innerX = CHART_X + 2;
  const innerW = CHART_W - 4;
  const step = trendData.length > 1 ? innerW / (trendData.length - 1) : 0;

  const coords = trendData.map((p, idx) => {
    const count = Number(p.count) || 0;
    const x = innerX + idx * step;
    const yy = plotBottom - (count / max) * plotH;
    return { x, y: yy, count, label: p.label };
  });

  // Line
  doc.setDrawColor(194, 24, 29);
  doc.setLineWidth(0.9);
  for (let i = 1; i < coords.length; i += 1) {
    doc.line(coords[i - 1].x, coords[i - 1].y, coords[i].x, coords[i].y);
  }

  // Points
  doc.setFillColor(194, 24, 29);
  coords.forEach((c) => {
    doc.circle(c.x, c.y, 0.9, 'F');
  });

  // X-axis baseline
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.35);
  doc.line(CHART_X, plotBottom, CHART_X + CHART_W, plotBottom);

  // X-axis labels every 3 hours
  const labelY = plotBottom + 5;
  coords.forEach((c, idx) => {
    if (idx % 3 !== 0 && idx !== coords.length - 1) return;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(String(c.label), c.x, labelY, { align: 'center' });
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Hour of day', CHART_X + CHART_W / 2, labelY + 5, { align: 'center' });

  return startY + BLOCK_H;
}

function drawDeptTable(doc, startY, snapshot) {
  let y = drawSectionTitle(doc, startY, 'Department Summary');
  const rows = snapshot.tableRows.slice(0, 12);
  if (!rows.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('No departments to show.', 14, y);
    return y + 8;
  }

  const cols = [14, 78, 118, 158];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);
  ['Department', 'Visits', 'Avg Duration', 'Trend'].forEach((h, i) => doc.text(h, cols[i], y));
  y += 5;
  doc.setDrawColor(230, 230, 230);
  doc.line(14, y, 196, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  rows.forEach((row) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(String(row.department).slice(0, 30), cols[0], y);
    doc.text(String(row.visits), cols[1], y);
    doc.text(fmtDuration(row.avgMin), cols[2], y);
    doc.text(fmtTrend(row.trend), cols[3], y);
    y += 6;
  });
  return y + 4;
}

/**
 * @param {object} snapshot Dashboard data already loaded on Reports page.
 */
export async function exportReportsPdf(snapshot) {
  const { from, to } = snapshot.range;
  const filename = buildFilename(from, to, 'pdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(194, 24, 29);
  doc.text('MedPlus Visitor Management — Reports', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Period: ${snapshot.rangeLabel}`, 14, 26);
  doc.text(`Department: ${snapshot.deptFilter || 'All Departments'}`, 14, 32);
  doc.text(`Generated: ${fmtDate(new Date())}`, 14, 38);

  let y = drawKpiGrid(doc, 48, snapshot);

  y = ensureSpace(doc, y, 90);
  y = drawHorizontalBars(doc, y, 'Top Departments by Visits', snapshot.deptBarItems);

  y = ensureSpace(doc, y, 90);
  y = drawHorizontalBars(doc, y, 'Average Visit Duration by Department', snapshot.durationBarItems);

  y = ensureSpace(doc, y, 88);
  y = drawTrendChart(doc, y, 'Visit Trend (by hour)', snapshot.trendData);

  y = ensureSpace(doc, y, 95);
  y = drawDeptTable(doc, y, snapshot);

  y = ensureSpace(doc, y, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Visitor / Employee split: ${snapshot.ratioData?.visitorCount ?? 0} visitors, ${snapshot.ratioData?.employeeCount ?? 0} employees`,
    14,
    y + 4,
  );

  const bytes = doc.output('arraybuffer');
  return saveBinaryFile(bytes, filename, [{ name: 'PDF Document', extensions: ['pdf'] }]);
}
