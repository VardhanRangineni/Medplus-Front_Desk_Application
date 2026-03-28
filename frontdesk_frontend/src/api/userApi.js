// ─────────────────────────────────────────────────────────────────────────────
// userApi.js
//
// All exported functions return mock data right now.
// When the backend is ready:
//   1. Delete the _MOCK_* constants
//   2. Uncomment the fetch blocks inside each function
//   3. Adjust the endpoint paths / response shapes to match the real API
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch } from './apiClient';

// ── Mock data (DELETE when backend APIs are available) ────────────────────────

const _MOCK_USERS = [
  {
    id: 'USR-0001',
    employeeId: 'EMP-001',
    employeeName: 'Arun Kumar',
    email: 'admin@medplus.com',
    role: 'Admin',
    location: 'Corporate Office',
    ipAddress: '192.168.1.10',
    status: 'Active',
  },
  {
    id: 'USR-0002',
    employeeId: 'EMP-002',
    employeeName: 'Priya Nair',
    email: 'reception.hyd@medplus.com',
    role: 'Receptionist',
    location: 'Software Office',
    ipAddress: '192.168.1.21',
    status: 'Active',
  },
  {
    id: 'USR-0003',
    employeeId: 'EMP-003',
    employeeName: 'Rahul Sharma',
    email: 'reception.wh@medplus.com',
    role: 'Receptionist',
    location: 'Main Warehouse',
    ipAddress: '192.168.1.35',
    status: 'Active',
  },
  {
    id: 'USR-0004',
    employeeId: 'EMP-004',
    employeeName: 'Sneha Reddy',
    email: 'manager@medplus.com',
    role: 'Admin',
    location: 'Corporate Office',
    ipAddress: '192.168.1.44',
    status: 'Inactive',
  },
];

const _MOCK_EMPLOYEES = [
  { employeeId: 'EMP-001', employeeName: 'Arun Kumar',    email: 'admin@medplus.com',         role: 'Admin',        location: 'Corporate Office' },
  { employeeId: 'EMP-002', employeeName: 'Priya Nair',    email: 'reception.hyd@medplus.com', role: 'Receptionist', location: 'Software Office'  },
  { employeeId: 'EMP-003', employeeName: 'Rahul Sharma',  email: 'reception.wh@medplus.com',  role: 'Receptionist', location: 'Main Warehouse'   },
  { employeeId: 'EMP-004', employeeName: 'Sneha Reddy',   email: 'manager@medplus.com',       role: 'Admin',        location: 'Corporate Office' },
  { employeeId: 'EMP-005', employeeName: 'Vikram Patel',  email: 'vikram.p@medplus.com',      role: 'Receptionist', location: 'Software Office'  },
  { employeeId: 'EMP-006', employeeName: 'Divya Menon',   email: 'divya.m@medplus.com',       role: 'Receptionist', location: 'Main Warehouse'   },
];

let _mockIdCounter = _MOCK_USERS.length + 1;

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Fetch all users.
 * @returns {Promise<Array<UserRecord>>}
 */
export async function getUsers() {
  return Promise.resolve(_MOCK_USERS.map(u => ({ ...u })));

  // TODO: swap with real call
  // return apiFetch('/api/users');
}

/**
 * Create a new user.
 * @param {{ ipAddress: string, employeeId: string, employeeName: string, email: string, password: string, role?: string, location?: string }} payload
 * @returns {Promise<UserRecord>}
 */
export async function createUser(payload) {
  const id = `USR-${String(_mockIdCounter++).padStart(4, '0')}`;
  const newUser = {
    id,
    employeeId:   payload.employeeId   || '',
    employeeName: payload.employeeName || '',
    email:        payload.email,
    role:         payload.role         || 'Receptionist',
    location:     payload.location     || '—',
    ipAddress:    payload.ipAddress    || '',
    status:       'Active',
  };
  _MOCK_USERS.push(newUser);
  return Promise.resolve({ ...newUser });

  // TODO: swap with real call
  // return apiFetch('/api/users', {
  //   method: 'POST',
  //   body: JSON.stringify(payload),
  // });
}

/**
 * Look up an employee by their Employee ID and return name + email for auto-fill.
 * @param {string} employeeId
 * @returns {Promise<{ employeeId: string, employeeName: string, email: string, role: string, location: string }>}
 */
export async function lookupEmployee(employeeId) {
  await new Promise(r => setTimeout(r, 400)); // simulate network latency
  const emp = _MOCK_EMPLOYEES.find(
    e => e.employeeId.toLowerCase() === employeeId.trim().toLowerCase(),
  );
  if (!emp) {
    const err = new Error('No employee found with that ID.');
    err.isNotFound = true;
    throw err;
  }
  return { ...emp };

  // TODO: swap with real call
  // return apiFetch(`/api/employees/${encodeURIComponent(employeeId)}`);
}

/**
 * Update an existing user.
 * Omit `password` from the payload to leave it unchanged.
 * @param {string} id  User ID
 * @param {Partial<UserRecord> & { password?: string }} payload
 * @returns {Promise<UserRecord>}
 */
export async function updateUser(id, payload) {
  return Promise.resolve({ id, ...payload });

  // TODO: swap with real call
  // return apiFetch(`/api/users/${encodeURIComponent(id)}`, {
  //   method: 'PUT',
  //   body: JSON.stringify(payload),
  // });
}

/**
 * Delete a user by ID.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteUser(id) {
  return Promise.resolve();

  // TODO: swap with real call
  // return apiFetch(`/api/users/${encodeURIComponent(id)}`, {
  //   method: 'DELETE',
  // });
}

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * @typedef {{ id: string, employeeId: string, employeeName: string,
 *             email: string, role: 'Admin' | 'Receptionist',
 *             location: string, ipAddress: string,
 *             status: 'Active' | 'Inactive' }} UserRecord
 */
