import { formatApiFailure } from '../../services/userFacingErrors';
import { buildLocationScopeParams } from '../../services/locationScope';
import * as XLSX from 'xlsx';
import { saveBinaryFile } from '../../utils/fileDownload';

async function api(path) {
  const result = await window.electronAPI.apiRequest('GET', path, null);
  if (!result.ok) {
    throw new Error(formatApiFailure(result));
  }
  return result.body?.data ?? result.body;
}

/**
 * @typedef {Object} StaffActivityFilters
 * @property {string} [staffQuery]
 * @property {string} [visitorName]
 * @property {string} [entryType]   VISITOR | EMPLOYEE
 * @property {string} [department]
 * @property {string} [personToMeet]
 * @property {string} [status]      checked-in | checked-out
 * @property {string} [contactQuery]
 * @property {string} [cardNumber]
 * @property {string} [workstationMac]
 */

/**
 * Paginated staff check-in activity.
 * @returns {Promise<{ content: Array, totalElements: number, totalPages: number, page: number }>}
 */
export async function getStaffActivityPage({
  from,
  to,
  locationId = null,
  allLocations = false,
  page = 0,
  size = 20,
  filters = {},
} = {}) {
  const p = new URLSearchParams({ from, to, page: String(page), size: String(size) });
  buildLocationScopeParams(locationId, allLocations).forEach((v, k) => p.set(k, v));

  const { staffQuery, visitorName, contactQuery, entryType, department, personToMeet, status, cardNumber, workstationMac } = filters;
  if (staffQuery?.trim()) p.set('q', staffQuery.trim());
  if (visitorName?.trim()) p.set('visitorName', visitorName.trim());
  if (contactQuery?.trim()) p.set('contactQuery', contactQuery.trim());
  if (entryType?.trim()) p.set('entryType', entryType.trim());
  if (department?.trim()) p.set('department', department.trim());
  if (personToMeet?.trim()) p.set('personToMeet', personToMeet.trim());
  if (status?.trim()) p.set('status', status.trim());
  if (cardNumber?.trim()) p.set('cardNumber', cardNumber.trim());
  if (workstationMac?.trim()) p.set('workstationMac', workstationMac.trim());

  const data = await api(`/api/reports/receptionist-activity?${p}`);
  return {
    content: Array.isArray(data?.content) ? data.content : [],
    totalElements: data?.totalElements ?? 0,
    totalPages: data?.totalPages ?? 1,
    page: data?.page ?? page,
  };
}

export function hasAnyStaffFilter(filters) {
  return Object.values(filters).some((v) => String(v ?? '').trim());
}

const EXPORT_FETCH_SIZE = 500;
const EXPORT_MAX_ROWS = 100_000;

function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export async function fetchAllStaffActivityForExport(opts) {
  const accumulated = [];
  let page = 0;

  while (accumulated.length < EXPORT_MAX_ROWS) {
    const data = await getStaffActivityPage({
      ...opts,
      page,
      size: EXPORT_FETCH_SIZE,
    });
    if (!data.content.length) break;
    accumulated.push(...data.content);
    if (accumulated.length >= data.totalElements) break;
    page += 1;
    if (page >= data.totalPages) break;
  }
  return accumulated;
}

export async function exportStaffActivityExcel(rows, from, to) {
  const filename = from && to && from !== to
    ? `staff-activity_${from}_to_${to}.xlsx`
    : `staff-activity_${from || to}.xlsx`;

  const HEADERS = [
    'Entry ID', 'Recorded By', 'Staff ID', 'Visitor Name', 'Mobile / Emp ID',
    'Type', 'Department', 'Person to Meet', 'Location', 'Card', 'Workstation MAC',
    'Check-In', 'Check-Out', 'Status',
  ];

  const data = [
    HEADERS,
    ...rows.map((r) => [
      r.visitorId ?? '',
      r.receptionistName ?? r.createdBy ?? '',
      r.createdBy ?? '',
      r.visitorName ?? '',
      r.entryType === 'EMPLOYEE' ? (r.empId ?? '') : (r.mobile ?? ''),
      r.entryType === 'EMPLOYEE' ? 'Employee' : 'Visitor',
      r.department ?? '',
      r.personToMeet ?? '',
      r.locationId ?? '',
      r.cardNumber != null ? String(r.cardNumber) : '',
      r.workstationMac ?? '',
      fmtDateTime(r.checkInTime),
      fmtDateTime(r.checkOutTime),
      (r.status || '').replace('_', '-').toLowerCase(),
    ]),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 22 }, { wch: 16 },
    { wch: 10 }, { wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 8 },
    { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 14 },
  ];
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, ws, 'Staff Activity');
  const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return saveBinaryFile(bytes, filename, [{ name: 'Excel Workbook', extensions: ['xlsx'] }]);
}
