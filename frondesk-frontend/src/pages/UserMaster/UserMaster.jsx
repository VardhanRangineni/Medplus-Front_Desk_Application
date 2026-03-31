import { useState, useEffect, useCallback, useRef } from 'react';
import './UserMaster.css';
import {
  IconSearch,
  IconRefreshCw,
  IconCheckCircle,
  IconAlertCircle,
} from '../../components/Icons/Icons';
import { getUsers, syncUsersFromMaster } from './userService';

// ─── Constants ────────────────────────────────────────────────────────────────
const TABLE_COLUMNS = [
  { key: 'id',           label: 'Employee ID'    },
  { key: 'name',         label: 'Employee Name'  },
  { key: 'role',         label: 'Role'           },
  { key: 'designation',  label: 'Designation'    },
  { key: 'dept',         label: 'Dept'           },
  { key: 'workLocation', label: 'Work Location'  },
  { key: 'email',        label: 'Work Email'     },
  { key: 'phone',        label: 'Phone'          },
];

const SKELETON_ROW_COUNT = 6;
const BANNER_DISMISS_MS  = 4500;

/** @typedef {'idle'|'loading'|'success'|'error'} SyncStatus */

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(date) {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function UserMaster() {
  const [users,       setUsers]       = useState([]);
  const [search,      setSearch]      = useState('');
  const [initLoading, setInitLoading] = useState(true);
  const [loadError,   setLoadError]   = useState(null);

  /** @type {[SyncStatus, Function]} */
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncError,  setSyncError]  = useState(null);
  const [syncCount,  setSyncCount]  = useState(null);
  const [lastSynced, setLastSynced] = useState(null);

  const bannerTimer = useRef(null);

  // ── Load from local DB on mount ─────────────────────────────────────────
  useEffect(() => {
    let active = true;
    setLoadError(null);
    getUsers()
      .then((data)  => { if (active) setUsers(data ?? []); })
      .catch((err)  => { if (active) setLoadError(err.message ?? 'Failed to load users.'); })
      .finally(()   => { if (active) setInitLoading(false); });
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
      const synced = await syncUsersFromMaster();
      setUsers(synced);
      setSyncCount(synced.length);
      setLastSynced(new Date());
      setSyncStatus('success');
    } catch (err) {
      setSyncError(err?.message ?? 'Failed to sync. Please try again.');
      setSyncStatus('error');
    }
  }, [syncStatus]);

  // ── Filtered rows ────────────────────────────────────────────────────────
  const filtered = search.trim()
    ? users.filter((u) => {
        const q = search.toLowerCase();
        return (
          (u.id           ?? '').toLowerCase().includes(q) ||
          (u.name         ?? '').toLowerCase().includes(q) ||
          (u.role         ?? '').toLowerCase().includes(q) ||
          (u.dept         ?? '').toLowerCase().includes(q) ||
          (u.workLocation ?? '').toLowerCase().includes(q) ||
          (u.email        ?? '').toLowerCase().includes(q)
        );
      })
    : users;

  const isSyncing = syncStatus === 'loading';

  return (
    <div className="um-page">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <header className="um-page__header">
        <h1 className="um-page__title">User Master</h1>
        <p className="um-page__sub">
          Manage employee accounts and access
          {lastSynced && (
            <span className="um-page__sync-time">
              &nbsp;· Last synced at {formatTime(lastSynced)}
            </span>
          )}
        </p>
      </header>

      {/* ── Load error banner ───────────────────────────────────────────── */}
      {loadError && (
        <div className="um-banner um-banner--error" role="alert" aria-live="assertive">
          <IconAlertCircle size={15} />
          <span>{loadError}</span>
        </div>
      )}

      {/* ── Feedback banner ─────────────────────────────────────────────── */}
      {syncStatus === 'success' && (
        <div className="um-banner um-banner--success" role="status" aria-live="polite">
          <IconCheckCircle size={15} />
          <span>
            Successfully synced <strong>{syncCount}</strong> user
            {syncCount !== 1 ? 's' : ''} from master database.
          </span>
        </div>
      )}
      {syncStatus === 'error' && (
        <div className="um-banner um-banner--error" role="alert" aria-live="assertive">
          <IconAlertCircle size={15} />
          <span>{syncError}</span>
        </div>
      )}

      {/* ── Table card ──────────────────────────────────────────────────── */}
      <div className="um-card">

        {/* ── Toolbar: search (left) · fetch button (right) ── */}
        <div className="um-toolbar">
          <label className="um-search" aria-label="Search users">
            <IconSearch size={15} />
            <input
              className="um-search__input"
              type="search"
              placeholder="Search by name, ID, role, dept or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <button
            className={`um-fetch-btn${isSyncing ? ' um-fetch-btn--loading' : ''}`}
            onClick={handleSync}
            disabled={isSyncing}
            aria-label="Sync users from master database"
          >
            <IconRefreshCw size={15} className={isSyncing ? 'um-spin' : ''} />
            <span>{isSyncing ? 'Syncing…' : 'Fetch Users'}</span>
          </button>
        </div>

        {/* ── Table ── */}
        <div className="um-table-wrap">
          <table className="um-table" aria-label="User list">
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
                  <tr key={i} className="um-row--skeleton">
                    {TABLE_COLUMNS.map((col) => (
                      <td key={col.key}><span className="um-skeleton" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS.length} className="um-empty">
                    {search
                      ? `No users match "${search}".`
                      : 'No users yet — click Fetch Users to sync from master.'}
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id}>
                    <td className="um-col--id">{user.id}</td>
                    <td className="um-col--name">{user.name}</td>
                    <td><span className="um-role-badge">{user.role}</span></td>
                    <td>{user.designation}</td>
                    <td><span className="um-dept-badge">{user.dept}</span></td>
                    <td>{user.workLocation}</td>
                    <td className="um-col--email">{user.email}</td>
                    <td className="um-col--phone">{user.phone}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Footer: row count ── */}
        {!initLoading && users.length > 0 && (
          <div className="um-footer">
            Showing&nbsp;<strong>{filtered.length}</strong>&nbsp;of&nbsp;
            <strong>{users.length}</strong>&nbsp;
            user{users.length !== 1 ? 's' : ''}
          </div>
        )}

      </div>
    </div>
  );
}
