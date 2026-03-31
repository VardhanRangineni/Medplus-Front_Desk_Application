/**
 * addVisitorService.js
 *
 * All functions are stubbed with mock delays.
 * Search for "TODO: ATTACH API" to find every place that needs a real
 * HTTP call wired in once the backend endpoints are ready.
 *
 * OTP functions are further marked "TODO: OTP API" because the SMS
 * gateway / OTP backend may arrive on a different timeline.
 */

// ─── Internal helper ─────────────────────────────────────────────────────────
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── OTP ─────────────────────────────────────────────────────────────────────

/**
 * Request a one-time password for the given mobile number.
 *
 * TODO: OTP API — replace mock body with:
 *   const res = await fetch('/api/otp/send', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ mobile }),
 *   });
 *   return res.json();  // expects { success: boolean, message: string }
 *
 * @param {string} mobile  10-digit mobile number
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function sendOtp(mobile) {
  // ── MOCK START ──
  await delay(900);
  console.log('[OTP] Sent to', mobile);
  return { success: true, message: 'OTP sent successfully.' };
  // ── MOCK END ──
}

/**
 * Verify the OTP entered by the visitor.
 *
 * TODO: OTP API — replace mock body with:
 *   const res = await fetch('/api/otp/verify', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ mobile, otp }),
 *   });
 *   return res.json();  // expects { verified: boolean, message: string }
 *
 * @param {string} mobile
 * @param {string} otp     6-digit code entered by user
 * @returns {Promise<{ verified: boolean, message: string }>}
 */
export async function verifyOtp(mobile, otp) {
  // ── MOCK START ── (accepts any 6-digit code)
  await delay(900);
  if (otp.trim().length === 6) {
    return { verified: true, message: 'Mobile number verified.' };
  }
  return { verified: false, message: 'Invalid OTP. Please enter the 6-digit code.' };
  // ── MOCK END ──
}

// ─── Reference data ───────────────────────────────────────────────────────────

/**
 * Fetch the list of locations available for a visit.
 *
 * TODO: ATTACH API — replace with:
 *   const res = await fetch('/api/locations');
 *   return res.json();  // expects Array<{ id: string, name: string }>
 *
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function getLocations() {
  // ── MOCK START ──
  await delay(300);
  return [
    { id: 'LOC001', name: 'Medplus Head Office – Hyderabad' },
    { id: 'LOC002', name: 'Medplus Bangalore Office' },
    { id: 'LOC003', name: 'Medplus Chennai Office' },
    { id: 'LOC004', name: 'Medplus Mumbai Office' },
  ];
  // ── MOCK END ──
}

/**
 * Fetch employees who can be visited (for "Person To Meet" dropdown).
 *
 * TODO: ATTACH API — replace with:
 *   const res = await fetch('/api/employees?active=true');
 *   return res.json();  // expects Array<{ id, name, department }>
 *
 * @returns {Promise<Array<{ id: string, name: string, department: string }>>}
 */
export async function getPersonsToMeet() {
  // ── MOCK START ──
  await delay(300);
  return [
    { id: 'EMP001', name: 'Amit Sharma',  department: 'Operations' },
    { id: 'EMP002', name: 'Priya Verma',  department: 'HR'         },
    { id: 'EMP003', name: 'Sunita Reddy', department: 'IT'         },
    { id: 'EMP004', name: 'Rahul Mehta',  department: 'Finance'    },
    { id: 'EMP005', name: 'Kiran Reddy',  department: 'Security'   },
  ];
  // ── MOCK END ──
}

/**
 * Fetch the department list.
 *
 * TODO: ATTACH API — replace with:
 *   const res = await fetch('/api/departments');
 *   return res.json();  // expects Array<{ id: string, name: string }>
 *
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function getDepartments() {
  // ── MOCK START ──
  await delay(200);
  return [
    { id: 'D1', name: 'Operations' },
    { id: 'D2', name: 'HR'         },
    { id: 'D3', name: 'IT'         },
    { id: 'D4', name: 'Finance'    },
    { id: 'D5', name: 'Security'   },
    { id: 'D6', name: 'Admin'      },
  ];
  // ── MOCK END ──
}

// ─── Visitor entry creation ───────────────────────────────────────────────────

/**
 * Submit a new visitor check-in entry.
 *
 * TODO: ATTACH API — replace with:
 *   const res = await fetch('/api/entries', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(visitorData),
 *   });
 *   return res.json();  // expects { success: boolean, entryId: string }
 *
 * @param {object} visitorData  Full payload assembled by AddVisitorModal
 * @returns {Promise<{ success: boolean, entryId: string }>}
 */
export async function createVisitorEntry(visitorData) {
  // ── MOCK START ──
  await delay(1200);
  console.log('[Visitor] Creating entry:', visitorData);
  return { success: true, entryId: `VIS${Date.now()}` };
  // ── MOCK END ──
}
