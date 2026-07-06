import { formatApiFailure } from '../../services/userFacingErrors';

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
  page = 0,
  size = 20,
  filters = {},
} = {}) {
  const p = new URLSearchParams({ from, to, page: String(page), size: String(size) });
  if (locationId) p.set('locationId', locationId);

  const { staffQuery, visitorName, entryType, department, personToMeet, status, workstationMac } = filters;
  if (staffQuery?.trim()) p.set('q', staffQuery.trim());
  if (visitorName?.trim()) p.set('visitorName', visitorName.trim());
  if (entryType?.trim()) p.set('entryType', entryType.trim());
  if (department?.trim()) p.set('department', department.trim());
  if (personToMeet?.trim()) p.set('personToMeet', personToMeet.trim());
  if (status?.trim()) p.set('status', status.trim());
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
