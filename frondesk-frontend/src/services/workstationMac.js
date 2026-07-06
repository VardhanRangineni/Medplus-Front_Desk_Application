/**
 * Workstation MAC helpers — must match backend WorkstationMacUtil / login adapter pick.
 */

export function normalizeMac(mac) {
  return (mac ?? '').replace(/[-:]/g, '').trim().toUpperCase();
}

export function macsMatch(a, b) {
  const na = normalizeMac(a);
  const nb = normalizeMac(b);
  return Boolean(na && nb && na === nb);
}

/** @returns {Promise<string>} */
export async function getPrimaryWorkstationMac() {
  if (!window.electronAPI?.getNetworkInfo) return '';
  try {
    const list = await window.electronAPI.getNetworkInfo();
    const primary = Array.isArray(list) ? list[0] : null;
    return primary?.mac ?? '';
  } catch {
    return '';
  }
}
