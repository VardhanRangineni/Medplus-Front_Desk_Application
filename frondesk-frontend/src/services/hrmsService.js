/**
 * hrmsService.js
 *
 * HRMS lookups via MVMS backend only — never calls HRMS/Iris directly from the desktop app.
 * Backend: GET /api/hrms/employees?employeeId= | ?hrmsId= | ?phoneNo=
 */

/**
 * @typedef {Object} HrmsEmployeeLookup
 * @property {string} id           Official employee ID (OTG…)
 * @property {string} [hrmsId]
 * @property {string} name           Full name from HRMS
 * @property {string} [workEmail]
 * @property {string} [workPhoneNo]
 * @property {string} [personalPhoneNo]
 * @property {string} [phone]        Preferred contact (work, then personal)
 * @property {string} [companyName]
 * @property {string} [designation]
 * @property {string} [workLocation]
 * @property {string} [department]
 * @property {string} [role]
 */

import { formatApiFailure } from './userFacingErrors';

async function request(method, path) {
  const result = await window.electronAPI.apiRequest(method, path, null);

  if (result.error || result.status === 0 || !result.ok) {
    throw new Error(formatApiFailure(result));
  }

  return result.body?.data;
}

/**
 * @param {string} employeeId
 * @returns {Promise<HrmsEmployeeLookup>}
 */
export async function lookupHrmsByEmployeeId(employeeId) {
  return request(
    'GET',
    `/api/hrms/employees?employeeId=${encodeURIComponent(employeeId)}`,
  );
}

/**
 * @param {string} hrmsId
 * @returns {Promise<HrmsEmployeeLookup>}
 */
export async function lookupHrmsByHrmsId(hrmsId) {
  return request(
    'GET',
    `/api/hrms/employees?hrmsId=${encodeURIComponent(hrmsId)}`,
  );
}

/**
 * @param {string} phoneNo  10-digit mobile number
 * @returns {Promise<HrmsEmployeeLookup>}
 */
export async function lookupHrmsByPhoneNo(phoneNo) {
  const digits = String(phoneNo || '').replace(/\D/g, '');
  return request(
    'GET',
    `/api/hrms/employees?phoneNo=${encodeURIComponent(digits)}`,
  );
}

/**
 * Lookup by Employee ID or HRMS ID — tries the most likely type first, then the other.
 * MED-prefixed values are tried as HRMS ID first; all others as Employee ID first.
 *
 * @param {string} idOrHrmsId
 * @returns {Promise<HrmsEmployeeLookup>}
 */
export async function lookupHrmsEmployee(idOrHrmsId) {
  const key = idOrHrmsId?.trim();
  if (!key) {
    throw new Error('Employee ID or HRMS ID is required.');
  }

  async function tryLookup(fn) {
    try {
      const emp = await fn();
      if (emp?.name?.trim()) return emp;
    } catch {
      // not found — fall through to alternate lookup
    }
    return null;
  }

  const tryHrmsFirst = /^med/i.test(key);
  let emp = tryHrmsFirst
    ? await tryLookup(() => lookupHrmsByHrmsId(key))
    : await tryLookup(() => lookupHrmsByEmployeeId(key));

  if (!emp) {
    emp = tryHrmsFirst
      ? await tryLookup(() => lookupHrmsByEmployeeId(key))
      : await tryLookup(() => lookupHrmsByHrmsId(key));
  }

  if (!emp) {
    throw new Error('No employee found in HRMS for this ID.');
  }
  return emp;
}
