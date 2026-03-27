// ── Check-In / Check-Out API ───────────────────────────────────────────────────
// All functions return Promises. Replace the mock implementations with real
// fetch/axios calls against your REST API when the backend is ready.
// ──────────────────────────────────────────────────────────────────────────────

// import { apiFetch } from './apiClient'; // uncomment when wiring real endpoints

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// ── Mock dataset ───────────────────────────────────────────────────────────────

const MOCK_ENTRIES = [
  {
    id: 'v-001',
    type: 'Visitor',
    name: 'Sameer Jain',
    mobileOrEmpId: '9823456789',
    status: 'Checked-in',
    personToMeet: 'Sunita Reddy',
    cards: [104],
    checkInTime: '2026-03-27T14:00:00',
    checkOutTime: null,
    department: 'HR',
    purpose: 'Meeting',
    members: [],
  },
  {
    id: 'v-002',
    type: 'Visitor',
    name: 'Ananya Singh',
    mobileOrEmpId: '9988776655',
    status: 'Checked-in',
    personToMeet: 'Sunita Reddy',
    cards: [101],
    checkInTime: '2026-03-27T09:30:00',
    checkOutTime: null,
    department: 'Finance',
    purpose: 'Vendor Meeting',
    members: [
      {
        id: 'm-001',
        name: 'Suresh Raina',
        type: 'Member',
        status: 'Checked-in',
        cards: [102],
        checkInTime: '2026-03-27T09:30:00',
        checkOutTime: null,
      },
      {
        id: 'm-002',
        name: 'MS Dhoni',
        type: 'Member',
        status: 'Checked-in',
        cards: [103],
        checkInTime: '2026-03-27T09:30:00',
        checkOutTime: null,
      },
    ],
  },
  {
    id: 'e-001',
    type: 'Employee',
    name: 'Ravi Kumar',
    mobileOrEmpId: 'EMP1001',
    status: 'Checked-in',
    personToMeet: 'Sunita Reddy',
    cards: [],
    checkInTime: '2026-03-27T09:15:00',
    checkOutTime: null,
    department: 'IT',
    purpose: null,
    members: [],
  },
  {
    id: 'v-003',
    type: 'Visitor',
    name: 'Priya Mehta',
    mobileOrEmpId: '9876543210',
    status: 'Checked-out',
    personToMeet: 'Amit Sharma',
    cards: [105],
    checkInTime: '2026-03-27T10:00:00',
    checkOutTime: '2026-03-27T11:30:00',
    department: 'Operations',
    purpose: 'Interview',
    members: [],
  },
  {
    id: 'e-002',
    type: 'Employee',
    name: 'Neha Gupta',
    mobileOrEmpId: 'EMP1002',
    status: 'Checked-out',
    personToMeet: null,
    cards: [],
    checkInTime: '2026-03-27T08:45:00',
    checkOutTime: '2026-03-27T17:30:00',
    department: 'HR',
    purpose: null,
    members: [],
  },
];

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fetch all check-in entries for a location and date range.
 * @param {{ location?: string, from?: Date, to?: Date }} params
 * @returns {Promise<Entry[]>}
 */
export const getCheckInEntries = async ({ location, from, to } = {}) => {
  await delay(750);
  // TODO: return apiClient(`/api/checkins?location=${encodeURIComponent(location)}&from=${from?.toISOString()}&to=${to?.toISOString()}`);
  return MOCK_ENTRIES;
};

/**
 * Fetch a single check-in entry by ID (for detail / edit views).
 * @param {string} id
 * @returns {Promise<Entry>}
 */
export const getEntryById = async (id) => {
  await delay(300);
  // TODO: return apiFetch(`/api/checkins/${id}`);
  const entry = MOCK_ENTRIES.find((e) => e.id === id);
  if (!entry) throw new Error(`Entry ${id} not found.`);
  return { ...entry };
};

/**
 * Update an existing check-in entry's editable fields.
 * @param {string} id
 * @param {Partial<Entry>} updates  — only editable fields
 * @returns {Promise<Entry>}        — full updated entry
 */
export const updateEntry = async (id, updates) => {
  await delay(500);
  // TODO: return apiFetch(`/api/checkins/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
  const entry = MOCK_ENTRIES.find((e) => e.id === id);
  if (!entry) throw new Error(`Entry ${id} not found.`);
  return { ...entry, ...updates };
};

/**
 * Check out a single entry (visitor / employee) or a member.
 * @param {string} id
 * @returns {Promise<{ id: string, status: 'Checked-out', checkOutTime: string }>}
 */
export const checkOutEntry = async (id) => {
  await delay(400);
  // TODO: return apiClient(`/api/checkins/${id}/checkout`, { method: 'POST' });
  return { id, status: 'Checked-out', checkOutTime: new Date().toISOString() };
};

/**
 * Get available departments for the filter dropdown.
 * @returns {Promise<string[]>}
 */
export const getDepartments = async () => {
  await delay(250);
  // TODO: return apiFetch('/api/departments');
  return ['HR', 'Finance', 'IT', 'Operations', 'Marketing'];
};

/**
 * Send an OTP to the registered contact of an employee.
 * @param {string} empId  — Employee ID (e.g. "EMP1001")
 * @returns {Promise<{ success: boolean }>}
 */
export const sendEmployeeOtp = async (empId) => {
  await delay(900);
  // TODO: return apiFetch('/api/otp/send-employee', { method: 'POST', body: JSON.stringify({ empId }) });
  return { success: true };
};

/**
 * Verify the OTP for an employee check-in.
 * Mock: any 6-digit code is accepted.
 * @param {string} empId
 * @param {string} otp
 * @returns {Promise<{ success: boolean, verified: boolean }>}
 */
export const verifyEmployeeOtp = async (empId, otp) => {
  await delay(700);
  // TODO: return apiFetch('/api/otp/verify-employee', { method: 'POST', body: JSON.stringify({ empId, otp }) });
  if (!otp || otp.length !== 6) throw new Error('Please enter the complete 6-digit OTP.');
  return { success: true, verified: true };
};

/**
 * Send an OTP to the given mobile number.
 * @param {string} mobile
 * @returns {Promise<{ success: boolean }>}
 */
export const sendOtp = async (mobile) => {
  await delay(900);
  // TODO: return apiFetch('/api/otp/send', { method: 'POST', body: JSON.stringify({ mobile }) });
  return { success: true };
};

/**
 * Verify the OTP entered by the user.
 * Mock: any 6-digit code is accepted.
 * @param {string} mobile
 * @param {string} otp
 * @returns {Promise<{ success: boolean, verified: boolean }>}
 */
export const verifyOtp = async (mobile, otp) => {
  await delay(700);
  // TODO: return apiFetch('/api/otp/verify', { method: 'POST', body: JSON.stringify({ mobile, otp }) });
  if (!otp || otp.length !== 6) throw new Error('Please enter the complete 6-digit OTP.');
  return { success: true, verified: true };
};

/**
 * Get staff members who can be selected as "Person to Meet".
 * @returns {Promise<Array<{ id: string, name: string, department: string }>>}
 */
export const getStaffMembers = async () => {
  await delay(250);
  // TODO: return apiFetch('/api/staff/hosts');
  return [
    { id: 's-001', name: 'Sunita Reddy',  department: 'HR'         },
    { id: 's-002', name: 'Amit Sharma',   department: 'Finance'    },
    { id: 's-003', name: 'Priya Verma',   department: 'IT'         },
    { id: 's-004', name: 'Rajan Mehta',   department: 'Operations' },
    { id: 's-005', name: 'Deepa Nair',    department: 'Marketing'  },
  ];
};

/**
 * Get locations available for check-in form dropdowns.
 * @returns {Promise<string[]>}
 */
export const getFormLocations = async () => {
  await delay(200);
  // TODO: return apiFetch('/api/locations');
  return ['Corporate Office', 'Branch Office – North', 'Branch Office – South', 'Warehouse'];
};
