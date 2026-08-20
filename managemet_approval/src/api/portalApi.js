/**
 * API helpers for Key Management host portal (public, no auth).
 */

const DEFAULT_BASE = 'http://localhost:9090';
//const DEFAULT_BASE = 'https://tapping-overhang-gigabyte.ngrok-free.dev/';


export function getApiBase() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('api');
  return (fromQuery || DEFAULT_BASE).replace(/\/$/, '');
}

async function parseJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function portalRequest(path, options = {}) {
  const res = await fetch(`${getApiBase()}${path}`, options);
  const json = await parseJson(res);
  if (!json) {
    throw new Error('Unexpected response from server.');
  }
  if (!res.ok || json.success === false) {
    throw new Error(json.message || 'Request failed.');
  }
  return json.data;
}

export async function fetchHostPortal(portalToken) {
  return portalRequest(
    `/api/key-management/public/portal/${encodeURIComponent(portalToken)}`,
  );
}

export async function approveVisit(portalToken, visitorId) {
  return portalRequest(
    `/api/key-management/public/portal/${encodeURIComponent(portalToken)}/visits/${encodeURIComponent(visitorId)}/approve`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  );
}

export async function rejectVisit(portalToken, visitorId, remarks) {
  return portalRequest(
    `/api/key-management/public/portal/${encodeURIComponent(portalToken)}/visits/${encodeURIComponent(visitorId)}/reject`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks: remarks || null }),
    },
  );
}

export async function approveGroup(portalToken, groupId) {
  return portalRequest(
    `/api/key-management/public/portal/${encodeURIComponent(portalToken)}/groups/${encodeURIComponent(groupId)}/approve`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  );
}

export async function rejectGroup(portalToken, groupId, remarks) {
  return portalRequest(
    `/api/key-management/public/portal/${encodeURIComponent(portalToken)}/groups/${encodeURIComponent(groupId)}/reject`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks: remarks || null }),
    },
  );
}

/**
 * Partial member decisions for a group.
 * @param {Array<{visitorId:string, decision:'APPROVED'|'REJECTED', remarks?:string}>} decisions
 */
export async function decideGroupMembers(portalToken, groupId, decisions) {
  return portalRequest(
    `/api/key-management/public/portal/${encodeURIComponent(portalToken)}/groups/${encodeURIComponent(groupId)}/members/decision`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisions }),
    },
  );
}
