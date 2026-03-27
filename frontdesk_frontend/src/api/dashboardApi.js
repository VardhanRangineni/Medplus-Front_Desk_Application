// ─────────────────────────────────────────────────────────────────────────────
// dashboardApi.js
//
// Every exported function returns mock data right now.
// When the backend is ready:
//   1. Delete the _MOCK_* constants
//   2. Uncomment the fetch block inside each function
//   3. Adjust the endpoint paths / response shapes to match the real API
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch } from './apiClient';

// ── Mock data (DELETE when backend APIs are available) ────────────────────────

const _MOCK_LOCATIONS = [
  'All Locations',
  'Corporate Office',
  'Branch — Accra',
  'Branch — Kumasi',
  'Warehouse',
];

const _MOCK_STATS = {
  checkIn:   { All: 23, Emp: 15, 'Non Emp': 8 },
  checkOut:  { All: 8,  Emp: 3,  'Non Emp': 5 },
  active:    { All: 15, Emp: 10, 'Non Emp': 5 },
  scheduled: 3,   // upcoming scheduled visits in the next hour
};

const _MOCK_CHART = [
  { hour: '8am',  count: 5  },
  { hour: '9am',  count: 12 },
  { hour: '10am', count: 18 },
  { hour: '11am', count: 25 },
  { hour: '12pm', count: 20 },
  { hour: '1pm',  count: 15 },
  { hour: '2pm',  count: 22 },
  { hour: '3pm',  count: 28 },
  { hour: '4pm',  count: 19 },
  { hour: '5pm',  count: 10 },
  { hour: '6pm',  count: 4  },
];

const _MOCK_VISITORS = [
  { id: 1, type: 'Visitor',  name: 'Sameer Jain',  contactId: '9823456789', location: 'Corporate Office', status: 'Checked-in',  personToMeet: 'Sunita Reddy', cards: '104', checkIn: 'Mar 26, 2026, 2:00 PM' },
  { id: 2, type: 'Visitor',  name: 'Ananya Singh', contactId: '9988776655', location: 'Corporate Office', status: 'Checked-in',  personToMeet: 'Sunita Reddy', cards: '101', checkIn: 'Mar 26, 2026, 9:30 AM' },
  { id: 3, type: 'Employee', name: 'Ravi Kumar',   contactId: 'EMP1001',    location: 'Corporate Office', status: 'Checked-in',  personToMeet: 'Sunita Reddy', cards: 'N/A', checkIn: 'Mar 26, 2026, 9:15 AM' },
  { id: 4, type: 'Visitor',  name: 'Priya Sharma', contactId: '9876543210', location: 'Corporate Office', status: 'Checked-out', personToMeet: 'Arjun Mehta',  cards: '102', checkIn: 'Mar 26, 2026, 8:45 AM' },
  { id: 5, type: 'Employee', name: 'Karan Patel',  contactId: 'EMP1042',    location: 'Corporate Office', status: 'Checked-in',  personToMeet: '—',            cards: 'N/A', checkIn: 'Mar 26, 2026, 8:30 AM' },
];

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Fetch available locations for the filter dropdown.
 * @returns {Promise<string[]>}
 */
export async function getLocations() {
  return Promise.resolve(_MOCK_LOCATIONS);

  // TODO: swap with real call
  // return apiFetch('/api/locations');
}

/**
 * Fetch KPI counts (check-in, check-out, active) for the selected
 * location and date range.
 *
 * @param {{ location: string, dateFrom: Date|null, dateTo: Date|null }} params
 * @returns {Promise<{ checkIn: Record<string,number>, checkOut: Record<string,number>, active: Record<string,number> }>}
 */
export async function getDashboardStats({ location, dateFrom, dateTo } = {}) {
  return Promise.resolve(_MOCK_STATS);

  // TODO: swap with real call
  // const from = dateFrom ? dateFrom.toISOString().split('T')[0] : '';
  // const to   = dateTo   ? dateTo.toISOString().split('T')[0]   : '';
  // return apiFetch(`/api/dashboard/stats?location=${encodeURIComponent(location)}&from=${from}&to=${to}`);
}

/**
 * Fetch hourly visitor-flow data for the chart.
 *
 * @param {{ location: string, date: Date|null }} params
 * @returns {Promise<Array<{ hour: string, count: number }>>}
 */
export async function getVisitorFlowChart({ location, date } = {}) {
  return Promise.resolve(_MOCK_CHART);

  // TODO: swap with real call
  // const d = date ? date.toISOString().split('T')[0] : '';
  // return apiFetch(`/api/dashboard/visitor-flow?location=${encodeURIComponent(location)}&date=${d}`);
}

/**
 * Fetch recent visitor / employee records for the table.
 *
 * @param {{ location: string, limit?: number }} params
 * @returns {Promise<Array>}
 */
export async function getRecentVisitors({ location, limit = 10 } = {}) {
  return Promise.resolve(_MOCK_VISITORS);

  // TODO: swap with real call
  // return apiFetch(`/api/visitors/recent?location=${encodeURIComponent(location)}&limit=${limit}`);
}
