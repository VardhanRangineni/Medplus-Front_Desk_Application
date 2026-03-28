// ─────────────────────────────────────────────────────────────────────────────
// employeeApi.js
//
// All exported functions return mock data right now.
// When the backend is ready:
//   1. Delete the _MOCK_* constants and _mockIdCounter
//   2. Uncomment the apiFetch blocks inside each function
//   3. Adjust the endpoint paths / response shapes to match the real API
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch } from './apiClient';

// ── Mock data (DELETE when backend APIs are available) ────────────────────────

const _MOCK_EMPLOYEES = [
  {
    id:           'EMP-001',
    employeeId:   'EMP-001',
    name:         'Arun Kumar',
    workEmail:    'arun.kumar@medplus.com',
    phone:        '+91 98765 43210',
    designation:  'Front Desk Administrator',
    workLocation: 'Corporate Office',
    department:   'Administration',
    status:       'Active',
  },
  {
    id:           'EMP-002',
    employeeId:   'EMP-002',
    name:         'Priya Nair',
    workEmail:    'priya.nair@medplus.com',
    phone:        '+91 87654 32109',
    designation:  'Receptionist',
    workLocation: 'Software Office',
    department:   'Customer Relations',
    status:       'Active',
  },
  {
    id:           'EMP-003',
    employeeId:   'EMP-003',
    name:         'Rahul Sharma',
    workEmail:    'rahul.sharma@medplus.com',
    phone:        '+91 76543 21098',
    designation:  'Senior Receptionist',
    workLocation: 'Main Warehouse',
    department:   'Customer Relations',
    status:       'Active',
  },
  {
    id:           'EMP-004',
    employeeId:   'EMP-004',
    name:         'Sneha Reddy',
    workEmail:    'sneha.reddy@medplus.com',
    phone:        '+91 65432 10987',
    designation:  'Office Manager',
    workLocation: 'Corporate Office',
    department:   'Administration',
    status:       'Inactive',
  },
  {
    id:           'EMP-005',
    employeeId:   'EMP-005',
    name:         'Vikram Patel',
    workEmail:    'vikram.patel@medplus.com',
    phone:        '+91 54321 09876',
    designation:  'IT Support Specialist',
    workLocation: 'Software Office',
    department:   'Information Technology',
    status:       'Active',
  },
  {
    id:           'EMP-006',
    employeeId:   'EMP-006',
    name:         'Divya Menon',
    workEmail:    'divya.menon@medplus.com',
    phone:        '+91 43210 98765',
    designation:  'HR Executive',
    workLocation: 'Corporate Office',
    department:   'Human Resources',
    status:       'Active',
  },
  {
    id:           'EMP-007',
    employeeId:   'EMP-007',
    name:         'Karthik Iyer',
    workEmail:    'karthik.iyer@medplus.com',
    phone:        '+91 32109 87654',
    designation:  'Security Officer',
    workLocation: 'Main Warehouse',
    department:   'Security',
    status:       'Active',
  },
  {
    id:           'EMP-008',
    employeeId:   'EMP-008',
    name:         'Meena Krishnan',
    workEmail:    'meena.krishnan@medplus.com',
    phone:        '+91 21098 76543',
    designation:  'Accounts Executive',
    workLocation: 'Corporate Office',
    department:   'Finance',
    status:       'Active',
  },
];

let _mockIdCounter = _MOCK_EMPLOYEES.length + 1;

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Fetch all employees.
 * @returns {Promise<Array<EmployeeRecord>>}
 */
export async function getEmployees() {
  return Promise.resolve(_MOCK_EMPLOYEES.map(e => ({ ...e })));

  // TODO: swap with real call
  // return apiFetch('/api/employees');
}

/**
 * Create a new employee record.
 * @param {{ employeeId: string, name: string, workEmail: string, phone?: string,
 *           designation: string, workLocation: string, department: string }} payload
 * @returns {Promise<EmployeeRecord>}
 */
export async function createEmployee(payload) {
  const padded = String(_mockIdCounter++).padStart(3, '0');
  const id     = `EMP-${padded}`;
  const record = {
    id,
    employeeId:   payload.employeeId   || id,
    name:         payload.name,
    workEmail:    payload.workEmail,
    phone:        payload.phone        || '',
    designation:  payload.designation,
    workLocation: payload.workLocation,
    department:   payload.department,
    status:       'Active',
  };
  _MOCK_EMPLOYEES.push(record);
  return Promise.resolve({ ...record });

  // TODO: swap with real call
  // return apiFetch('/api/employees', {
  //   method: 'POST',
  //   body: JSON.stringify(payload),
  // });
}

/**
 * Update an existing employee record.
 * @param {string} id  Employee ID
 * @param {Partial<EmployeeRecord>} payload
 * @returns {Promise<EmployeeRecord>}
 */
export async function updateEmployee(id, payload) {
  const idx = _MOCK_EMPLOYEES.findIndex(e => e.id === id);
  if (idx !== -1) {
    _MOCK_EMPLOYEES[idx] = { ..._MOCK_EMPLOYEES[idx], ...payload };
  }
  return Promise.resolve({ id, ...payload });

  // TODO: swap with real call
  // return apiFetch(`/api/employees/${encodeURIComponent(id)}`, {
  //   method: 'PUT',
  //   body: JSON.stringify(payload),
  // });
}

/**
 * Sync / refresh all employees from the backend source of truth.
 * Call this when the user clicks "Fetch Employees".
 * Fetches from the external HR / ERP system, saves to DB, and returns the full list.
 * @returns {Promise<Array<EmployeeRecord>>}
 */
export async function syncEmployees() {
  await new Promise(r => setTimeout(r, 1200)); // simulate network latency
  return Promise.resolve(_MOCK_EMPLOYEES.map(e => ({ ...e })));

  // TODO: swap with real call
  // const result = await apiFetch('/api/employees/sync', { method: 'POST' });
  // return result; // backend returns the updated full list
}

/**
 * Delete an employee record by ID.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteEmployee(id) {
  const idx = _MOCK_EMPLOYEES.findIndex(e => e.id === id);
  if (idx !== -1) _MOCK_EMPLOYEES.splice(idx, 1);
  return Promise.resolve();

  // TODO: swap with real call
  // return apiFetch(`/api/employees/${encodeURIComponent(id)}`, {
  //   method: 'DELETE',
  // });
}

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   id:           string,
 *   employeeId:   string,
 *   name:         string,
 *   workEmail:    string,
 *   phone:        string,
 *   designation:  string,
 *   workLocation: string,
 *   department:   string,
 *   status:       'Active' | 'Inactive'
 * }} EmployeeRecord
 */
