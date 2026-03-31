import { useState, useEffect, useCallback, useRef } from 'react';
import './LocationMaster.css';
import {
  IconSearch,
  IconToggleRight,
  IconToggleLeft,
  IconMapPin,
  IconRefreshCw,
  IconCheckCircle,
  IconAlertCircle,
} from '../../components/Icons/Icons';
import {
  getLocations,
  syncLocationsFromMaster,
  updateLocationStatus,
} from './locationService';

// ─── Constants ────────────────────────────────────────────────────────────────
const TABLE_COLUMNS = [
  { key: 'code',    label: 'Code'          },
  { key: 'name',    label: 'Location Name' },
  { key: 'address', label: 'Address'       },
  { key: 'city',    label: 'City'          },
  { key: 'state',   label: 'State'         },
  { key: 'status',  label: 'Status'        },
];

const SKELETON_ROW_COUNT = 5;
const BANNER_DISMISS_MS  = 4500;

/** @typedef {'idle'|'loading'|'success'|'error'} FetchStatus */

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(date) {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LocationMaster() {
  const [locations,   setLocations]   = useState([]);
  const [search,      setSearch]      = useState('');
  const [initLoading, setInitLoading] = useState(true);
  const [loadError,   setLoadError]   = useState(null);

  /** @type {[FetchStatus, Function]} */
  const [syncStatus,  setSyncStatus]  = useState('idle');
  const [syncError,   setSyncError]   = useState(null);
  const [syncCount,   setSyncCount]   = useState(null);
  const [lastSynced,  setLastSynced]  = useState(null);

  const bannerTimer = useRef(null);

  // ── Load from local DB on mount ─────────────────────────────────────────
  useEffect(() => {
    let active = true;
    setLoadError(null);
    getLocations()
      .then((data) => { if (active) setLocations(data ?? []); })
      .catch((err) => { if (active) setLoadError(err.message ?? 'Failed to load locations.'); })
      .finally(()  => { if (active) setInitLoading(false); });
    return () => { active = false; };
  }, []);

  // ── Auto-dismiss success / error banner ─────────────────────────────────
  useEffect(() => {
    if (syncStatus === 'success' || syncStatus === 'error') {
      clearTimeout(bannerTimer.current);
      bannerTimer.current = setTimeout(() => setSyncStatus('idle'), BANNER_DISMISS_MS);
    }
    return () => clearTimeout(bannerTimer.current);
  }, [syncStatus]);

  // ── Sync from master DB via backend ─────────────────────────────────────
  const handleSync = useCallback(async () => {
    if (syncStatus === 'loading') return;
    setSyncStatus('loading');
    setSyncError(null);
    try {
      const synced = await syncLocationsFromMaster();
      setLocations(synced);
      setSyncCount(synced.length);
      setLastSynced(new Date());
      setSyncStatus('success');
    } catch (err) {
      setSyncError(err?.message ?? 'Failed to sync. Please try again.');
      setSyncStatus('error');
    }
  }, [syncStatus]);

  // ── Toggle status — optimistic update with rollback on failure ───────────
  const handleToggle = useCallback(async (code) => {
    const original = locations.find((l) => l.code === code);
    if (!original) return;
    const next = !original.status;

    setLocations((prev) =>
      prev.map((l) => (l.code === code ? { ...l, status: next } : l))
    );

    try {
      await updateLocationStatus(code, next);
    } catch (err) {
      // Roll back the optimistic update and surface the error via the sync banner
      setLocations((prev) =>
        prev.map((l) => (l.code === code ? { ...l, status: original.status } : l))
      );
      setSyncError(err.message ?? 'Failed to update status. Please try again.');
      setSyncStatus('error');
    }
  }, [locations]);

  // ── Filtered rows ────────────────────────────────────────────────────────
  const filtered = search.trim()
    ? locations.filter((l) => {
        const q = search.toLowerCase();
        return (
          (l.code ?? '').toLowerCase().includes(q) ||
          (l.name ?? '').toLowerCase().includes(q) ||
          (l.city ?? '').toLowerCase().includes(q)
        );
      })
    : locations;

  const isSyncing = syncStatus === 'loading';

  return (
    <div className="lm-page">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <header className="lm-page__header">
        <h1 className="lm-page__title">Location Master</h1>
        <p className="lm-page__sub">
          Manage branches and office locations
          {lastSynced && (
            <span className="lm-page__sync-time">
              &nbsp;· Last synced at {formatTime(lastSynced)}
            </span>
          )}
        </p>
      </header>

      {/* ── Load error banner ───────────────────────────────────────────── */}
      {loadError && (
        <div className="lm-banner lm-banner--error" role="alert" aria-live="assertive">
          <IconAlertCircle size={15} />
          <span>{loadError}</span>
        </div>
      )}

      {/* ── Feedback banner ─────────────────────────────────────────────── */}
      {syncStatus === 'success' && (
        <div className="lm-banner lm-banner--success" role="status" aria-live="polite">
          <IconCheckCircle size={15} />
          <span>
            Successfully synced <strong>{syncCount}</strong> location
            {syncCount !== 1 ? 's' : ''} from master database.
          </span>
        </div>
      )}
      {syncStatus === 'error' && (
        <div className="lm-banner lm-banner--error" role="alert" aria-live="assertive">
          <IconAlertCircle size={15} />
          <span>{syncError}</span>
        </div>
      )}

      {/* ── Table card ──────────────────────────────────────────────────── */}
      <div className="lm-card">

        {/* ── Toolbar: search (left) · fetch button (right) ── */}
        <div className="lm-toolbar">
          <label className="lm-search" aria-label="Search locations">
            <IconSearch size={15} />
            <input
              className="lm-search__input"
              type="search"
              placeholder="Search by name, code or city…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <button
            className={`lm-fetch-btn${isSyncing ? ' lm-fetch-btn--loading' : ''}`}
            onClick={handleSync}
            disabled={isSyncing}
            aria-label="Sync locations from master database"
          >
            <IconRefreshCw size={15} className={isSyncing ? 'lm-spin' : ''} />
            <span>{isSyncing ? 'Syncing…' : 'Fetch Locations'}</span>
          </button>
        </div>

        {/* ── Table ── */}
        <div className="lm-table-wrap">
          <table className="lm-table" aria-label="Location list">
            <thead>
              <tr>
                {TABLE_COLUMNS.map((col) => (
                  <th key={col.key} scope="col">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initLoading ? (
                Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
                  <tr key={i} className="lm-row--skeleton">
                    {TABLE_COLUMNS.map((col) => (
                      <td key={col.key}><span className="lm-skeleton" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS.length} className="lm-empty">
                    {search
                      ? `No locations match "${search}".`
                      : 'No locations yet — click Fetch Locations to sync from master.'}
                  </td>
                </tr>
              ) : (
                filtered.map((loc) => (
                  <tr key={loc.code}>
                    <td className="lm-col--code">{loc.code}</td>
                    <td className="lm-col--name">
                      <span className="lm-name-cell">
                        <IconMapPin size={13} />
                        {loc.name}
                      </span>
                    </td>
                    <td className="lm-col--addr" title={loc.address ?? ''}>{loc.address}</td>
                    <td>{loc.city}</td>
                    <td>{loc.state}</td>
                    <td>
                      <button
                        className="lm-toggle"
                        onClick={() => handleToggle(loc.code)}
                        aria-label={`${loc.status ? 'Deactivate' : 'Activate'} ${loc.name}`}
                        aria-pressed={loc.status}
                      >
                        {loc.status
                          ? <><IconToggleRight size={24} /><span className="lm-status lm-status--on">Active</span></>
                          : <><IconToggleLeft  size={24} /><span className="lm-status lm-status--off">Inactive</span></>
                        }
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Footer: row count ── */}
        {!initLoading && locations.length > 0 && (
          <div className="lm-footer">
            Showing&nbsp;<strong>{filtered.length}</strong>&nbsp;of&nbsp;
            <strong>{locations.length}</strong>&nbsp;
            location{locations.length !== 1 ? 's' : ''}
          </div>
        )}

      </div>
    </div>
  );
}
