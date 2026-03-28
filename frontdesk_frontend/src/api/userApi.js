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
    email: 'admin@medplus.com',
    role: 'Admin',
    location: 'Corporate Office',
    status: 'Active',
  },
  {
    id: 'USR-0002',
    email: 'reception.hyd@medplus.com',
    role: 'Receptionist',
    location: 'Software Office',
    status: 'Active',
  },
  {
    id: 'USR-0003',
    email: 'reception.wh@medplus.com',
    role: 'Receptionist',
    location: 'Main Warehouse',
    status: 'Active',
  },
  {
    id: 'USR-0004',
    email: 'manager@medplus.com',
    role: 'Admin',
    location: 'Corporate Office',
    status: 'Inactive',
  },
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
 * @param {{ email: string, role: string, location?: string, password: string }} payload
 * @returns {Promise<UserRecord>}
 */
export async function createUser(payload) {
  const id = `USR-${String(_mockIdCounter++).padStart(4, '0')}`;
  const newUser = {
    id,
    email: payload.email,
    role: payload.role,
    location: payload.location || '—',
    status: 'Active',
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
 * @typedef {{ id: string, email: string, role: 'Admin' | 'Receptionist',
 *             location: string, status: 'Active' | 'Inactive' }} UserRecord
 */
