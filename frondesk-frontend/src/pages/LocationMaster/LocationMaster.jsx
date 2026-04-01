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
import Pagination from '../../components/Pagination/Pagination';

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
const PAGE_SIZE          = 20;
const SEARCH_DEBOUNCE    = 350; // ms

/** @typedef {'idle'|'loading'|'success'|'error'} FetchStatus */

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(date) {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LocationMaster() {

  // ── Server-side data ────────────────────────────────────────────────────────
  const [locations,     setLocations]     = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages,    setTotalPages]    = useState(1);
  const [currentPage,   setCurrentPage]   = useState(1);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState('');
  const [initLoading, setInitLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [loadError,   setLoadError]   = useState(null);

  /** @type {[FetchStatus, Function]} */
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncError,  setSyncError]  = useState(null);
  const [syncCount,  setSyncCount]  = useState(null);
  const [lastSynced, setLastSynced] = useState(null);

  const bannerTimer    = useRef(null);
  const searchTimerRef = useRef(null);

  // ── Core fetch function ─────────────────────────────────────────────────────
  const fetchPage = useCallback(async (page, q, isInitial = false) => {
    if (isInitial) setInitLoading(true);
    else           setPageLoading(true);
    setLoadError(null);

    try {
      const data = await getLocations({ page: page - 1, size: PAGE_SIZE, search: q });
      setLocations(data?.content        ?? []);
      setTotalElements(data?.totalElements ?? 0);
      setTotalPages(data?.totalPages    ?? 1);
      setCurrentPage(page);
    } catch (err) {
      setLoadError(err?.message ?? 'Failed to load locations.');
    } finally {
      if (isInitial) setInitLoading(false);
      else           setPageLoading(false);
    }
  }, []);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchPage(1, '', true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-dismiss banner ─────────────────────────────────────────────────────
  useEffect(() => {
    if (syncStatus === 'success' || syncStatus === 'error') {
      clearTimeout(bannerTimer.current);
      bannerTimer.current = setTimeout(() => setSyncStatus('idle'), BANNER_DISMISS_MS);
    }
    return () => clearTimeout(bannerTimer.current);
  }, [syncStatus]);

  // ── Sync from master DB ─────────────────────────────────────────────────────
  const handleSync = useCallback(async () => {
    if (syncStatus === 'loading') return;
    setSyncStatus('loading');
    setSyncError(null);
    try {
      const synced = await syncLocationsFromMaster();
      setSyncCount(synced?.length ?? 0);
      setLastSynced(new Date());
      setSyncStatus('success');
      // Reload page 1 after sync
      setSearch('');
      fetchPage(1, '');
    } catch (err) {
      setSyncError(err?.message ?? 'Failed to sync. Please try again.');
      setSyncStatus('error');
    }
  }, [syncStatus, fetchPage]);

  // ── Search (debounced) ──────────────────────────────────────────────────────
  const handleSearchChange = useCallback((value) => {
    setSearch(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchPage(1, value);
    }, SEARCH_DEBOUNCE);
  }, [fetchPage]);

  // ── Page change ─────────────────────────────────────────────────────────────
  const handlePageChange = useCallback((page) => {
    fetchPage(page, search);
  }, [search, fetchPage]);

  // ── Toggle status — optimistic update with rollback on failure ──────────────
  const handleToggle = useCallback(async (code) => {
    const original = locations.find((l) => l.code === code);
    if (!original) return;
    const next = !original.status;

    setLocations((prev) => prev.map((l) => l.code === code ? { ...l, status: next } : l));

    try {
      await updateLocationStatus(code, next);
    } catch (err) {
      setLocations((prev) => prev.map((l) => l.code === code ? original : l));
      setSyncError(err.message ?? 'Failed to update status. Please try again.');
      setSyncStatus('error');
    }
  }, [locations]);

  const isSyncing = syncStatus === 'loading';
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEnd   = Math.min(pageStart + locations.length, pageStart + PAGE_SIZE);

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

      {/* ── Sync feedback banner ─────────────────────────────────────────── */}
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
      <div className={`lm-card${pageLoading ? ' lm-card--loading' : ''}`}>

        {/* ── Toolbar ─────────────────────────────────────────────────── */}
        <div className="lm-toolbar">
          <label className="lm-search" aria-label="Search locations">
            <IconSearch size={15} />
            <input
              className="lm-search__input"
              type="search"
              placeholder="Search by name, code or city…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
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

        {/* ── Table ─────────────────────────────────────────────────────── */}
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
              ) : locations.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS.length} className="lm-empty">
                    {search
                      ? `No locations match "${search}".`
                      : 'No locations yet — click Fetch Locations to sync from master.'}
                  </td>
                </tr>
              ) : (
                locations.map((loc) => (
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

        {/* ── Pagination ─────────────────────────────────────────────────── */}
        {!initLoading && totalElements > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        {!initLoading && totalElements > 0 && (
          <div className="lm-footer">
            Showing&nbsp;
            <strong>{pageStart + 1}–{pageEnd}</strong>
            &nbsp;of&nbsp;<strong>{totalElements}</strong>&nbsp;
            location{totalElements !== 1 ? 's' : ''}
          </div>
        )}

      </div>
    </div>
  );
}
