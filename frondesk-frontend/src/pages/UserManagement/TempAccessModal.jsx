import { useState, useEffect } from 'react';
import {
  IconX,
  IconMonitor,
} from '../../components/Icons/Icons';
import SearchSelect from '../../components/SearchSelect/SearchSelect';
import {
  grantTempDeviceAccess,
  revokeTempDeviceAccess,
  getActiveTempDeviceGrant,
  getTempDeviceGrantHistory,
} from './userManagementService';
import { getDevices } from '../LocationMaster/locationMasterService';

const DURATION_PRESETS = [
  { label: '4 hours', hours: 4 },
  { label: '8 hours', hours: 8 },
  { label: '12 hours', hours: 12 },
  { label: '24 hours', hours: 24 },
];

function formatExpiry(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function statusClass(status) {
  const s = (status || '').toUpperCase();
  if (s === 'ACTIVE') return 'umg-temp-status--active';
  if (s === 'REVOKED') return 'umg-temp-status--revoked';
  return 'umg-temp-status--expired';
}

export default function TempAccessModal({ user, onClose, onSuccess }) {
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const [durationHours, setDurationHours] = useState(8);
  const [reason, setReason] = useState('');
  const [activeGrant, setActiveGrant] = useState(user?.activeTempGrant ?? null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [active, hist, deviceRes] = await Promise.all([
          getActiveTempDeviceGrant(user.id),
          getTempDeviceGrantHistory(user.id, 15),
          getDevices({ page: 0, size: 100, filters: { status: 'ACTIVE' } }),
        ]);
        if (!cancelled) {
          setActiveGrant(active || null);
          setHistory(Array.isArray(hist) ? hist : []);
          setDevices(deviceRes?.content ?? []);
          if (active?.deviceId) setDeviceId(active.deviceId);
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load grant data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user.id]);

  const deviceOptions = devices.map((d) => ({
    value: d.deviceId,
    label: `${d.displayName} · ${d.locationName || d.locationId}`,
  }));

  const selectedDevice = devices.find((d) => d.deviceId === deviceId);

  async function handleGrant(e) {
    e.preventDefault();
    if (!deviceId) return;
    setError('');
    setSubmitting(true);
    try {
      const grant = await grantTempDeviceAccess(user.id, {
        deviceId,
        reason: reason.trim(),
        durationHours,
      });
      setActiveGrant(grant);
      setReason('');
      const hist = await getTempDeviceGrantHistory(user.id, 15);
      setHistory(Array.isArray(hist) ? hist : []);
      onSuccess?.(grant);
    } catch (err) {
      setError(err?.message || 'Failed to grant temporary access.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke() {
    setError('');
    setRevoking(true);
    try {
      await revokeTempDeviceAccess(user.id);
      setActiveGrant(null);
      const hist = await getTempDeviceGrantHistory(user.id, 15);
      setHistory(Array.isArray(hist) ? hist : []);
      onSuccess?.(null);
    } catch (err) {
      setError(err?.message || 'Failed to revoke temporary access.');
    } finally {
      setRevoking(false);
    }
  }

  const canSubmit = Boolean(deviceId) && reason.trim().length > 0;

  return (
    <div
      className="umg-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="temp-access-title"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <div className="umg-temp-dialog">
        <div className="umg-temp-dialog__head">
          <div>
            <h3 className="umg-temp-dialog__title" id="temp-access-title">
              Temporary Kiosk Access
            </h3>
            <p className="umg-temp-dialog__sub">
              Allow <strong>{user.name}</strong> to sign in at a registered kiosk
            </p>
          </div>
          <button type="button" className="umg-modal__close" onClick={onClose} aria-label="Close">
            <IconX size={14} />
          </button>
        </div>

        <div className="umg-temp-dialog__body">
          {error && <p className="umg-temp-error" role="alert">{error}</p>}

          {loading ? (
            <p className="umg-hint">Loading…</p>
          ) : (
            <>
              {activeGrant && (
                <div className="umg-temp-active">
                  <div className="umg-temp-active__label">Active grant</div>
                  <div className="umg-temp-active__row">
                    <span>{activeGrant.deviceName || activeGrant.deviceId}</span>
                    <span className={`umg-temp-status ${statusClass(activeGrant.status)}`}>
                      {activeGrant.status}
                    </span>
                  </div>
                  <div className="umg-temp-active__meta">
                    Expires {formatExpiry(activeGrant.expiresAt)} · {activeGrant.reason}
                  </div>
                  <button
                    type="button"
                    className="umg-btn umg-btn--danger umg-btn--sm"
                    onClick={handleRevoke}
                    disabled={revoking || submitting}
                  >
                    {revoking ? 'Revoking…' : 'Revoke access'}
                  </button>
                </div>
              )}

              <form className="umg-temp-form" onSubmit={handleGrant}>
                <p className="umg-temp-section-label">New grant</p>

                <label className="umg-field">
                  <span className="umg-field__label">
                    Kiosk <span className="umg-req">*</span>
                  </span>
                  <SearchSelect
                    value={deviceId}
                    options={deviceOptions}
                    placeholder={devices.length ? 'Select kiosk…' : 'No devices registered'}
                    onChange={setDeviceId}
                    ariaLabel="Select kiosk"
                    searchable
                    searchInField
                    searchPlaceholder="Search kiosk…"
                    minMenuWidth={320}
                  />
                  {devices.length === 0 && (
                    <span className="umg-field__hint">
                      Register kiosks in Device Master first.
                    </span>
                  )}
                </label>

                {selectedDevice && (
                  <div className="umg-temp-desk">
                    <div className="umg-temp-desk__label">Selected kiosk</div>
                    <div className="umg-temp-desk__user">
                      <IconMonitor size={16} />
                      <span>
                        {selectedDevice.displayName}
                        {selectedDevice.macAddress && (
                          <span className="mono"> · {selectedDevice.macAddress}</span>
                        )}
                      </span>
                    </div>
                    <p className="umg-temp-desk__hint umg-temp-desk__hint--ok">
                      {user.name} can sign in at this kiosk until the grant expires.
                    </p>
                  </div>
                )}

                <label className="umg-field">
                  <span className="umg-field__label">Duration</span>
                  <div className="umg-temp-duration-chips">
                    {DURATION_PRESETS.map((p) => (
                      <button
                        key={p.hours}
                        type="button"
                        className={`umg-temp-chip${durationHours === p.hours ? ' umg-temp-chip--on' : ''}`}
                        onClick={() => setDurationHours(p.hours)}
                        disabled={submitting}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </label>

                <label className="umg-field">
                  <span className="umg-field__label">Reason <span className="umg-req">*</span></span>
                  <textarea
                    className="umg-textarea"
                    rows={2}
                    placeholder="e.g. Covering morning shift at reception desk 2"
                    value={reason}
                    disabled={submitting}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>

                <div className="umg-temp-form__actions">
                  <button type="button" className="umg-btn umg-btn--ghost" onClick={onClose} disabled={submitting}>
                    Close
                  </button>
                  <button
                    type="submit"
                    className="umg-btn umg-btn--primary"
                    disabled={!canSubmit || submitting}
                  >
                    {submitting ? 'Granting…' : 'Grant kiosk access'}
                  </button>
                </div>
              </form>

              {history.length > 0 && (
                <div className="umg-temp-history">
                  <p className="umg-temp-section-label">History</p>
                  <div className="umg-temp-history__scroll">
                    <table className="umg-temp-history__table">
                      <thead>
                        <tr>
                          <th>Kiosk</th>
                          <th>Expires</th>
                          <th>Status</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((g) => (
                          <tr key={g.id}>
                            <td>{g.deviceName || g.deviceId || g.macAddress || '—'}</td>
                            <td>{formatExpiry(g.expiresAt)}</td>
                            <td>
                              <span className={`umg-temp-status ${statusClass(g.status)}`}>
                                {g.status}
                              </span>
                            </td>
                            <td title={g.reason}>{g.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
