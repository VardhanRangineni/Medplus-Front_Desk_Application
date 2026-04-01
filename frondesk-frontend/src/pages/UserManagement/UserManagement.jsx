import { useState, useEffect, useCallback, useRef } from 'react';
import './UserManagement.css';
import {
  IconSearch,
  IconPlus,
  IconEdit,
  IconToggleRight,
  IconToggleLeft,
  IconX,
  IconAlertCircle,
  IconLock,
  IconEye,
  IconEyeOff,
} from '../../components/Icons/Icons';
import Pagination from '../../components/Pagination/Pagination';
import {
  getManagedUsers,
  createManagedUser,
  updateManagedUser,
  updateManagedUserStatus,
  searchUsers,
} from './userManagementService';
import { searchLocations } from '../LocationMaster/locationService';

// ─── Constants ────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  id:         '',
  name:       '',
  location:   '',
  ipAddress:  '',
  macAddress: '',
  status:     true,
  password:   '',
};

const SKELETON_ROW_COUNT = 6;
const PAGE_SIZE          = 20;

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
function UserModal({ user, onClose, onSave, saving, saveError }) {
  const [form,         setForm]        = useState(() => user ? {
    id:         user.id         ?? '',
    name:       user.name       ?? '',
    location:   user.location   ?? '',
    ipAddress:  user.ipAddress  ?? '',
    macAddress: user.macAddress ?? '',
    status:     user.status     ?? true,
    password:   '',   // never pre-populated — backend never returns it
  } : EMPTY_FORM);
  const [errors,       setErrors]      = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const isEdit = !!user;

  // ── Typeahead state ──────────────────────────────────────────────────────
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [activeUserField, setActiveUserField] = useState(null); // 'id' | 'name' | null
  const [locSuggestions,  setLocSuggestions]  = useState([]);
  const [showLocDropdown, setShowLocDropdown] = useState(false);
  const userTimer = useRef(null);
  const locTimer  = useRef(null);

  // Clear timers on unmount
  useEffect(() => () => {
    clearTimeout(userTimer.current);
    clearTimeout(locTimer.current);
  }, []);

  const triggerUserSearch = (q) => {
    clearTimeout(userTimer.current);
    if (!q.trim()) { setUserSuggestions([]); return; }
    userTimer.current = setTimeout(async () => {
      try {
        const res = await searchUsers(q.trim());
        setUserSuggestions(res ?? []);
      } catch { setUserSuggestions([]); }
    }, 280);
  };

  const pickUser = (u) => {
    setForm((f) => ({
      ...f,
      id:       u.id       ?? f.id,
      name:     u.name     ?? f.name,
      location: u.location ?? f.location,
    }));
    setErrors((e) => ({ ...e, id: undefined, name: undefined, location: undefined }));
    setUserSuggestions([]);
    setActiveUserField(null);
  };

  const triggerLocSearch = (q) => {
    clearTimeout(locTimer.current);
    if (!q.trim()) { setLocSuggestions([]); setShowLocDropdown(false); return; }
    locTimer.current = setTimeout(async () => {
      try {
        const res = await searchLocations(q.trim());
        setLocSuggestions(res ?? []);
        setShowLocDropdown((res?.length ?? 0) > 0);
      } catch { setLocSuggestions([]); setShowLocDropdown(false); }
    }, 280);
  };

  const pickLocation = (loc) => {
    setForm((f) => ({ ...f, location: loc.name }));
    setErrors((e) => ({ ...e, location: undefined }));
    setLocSuggestions([]);
    setShowLocDropdown(false);
  };

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.id.trim())         e.id         = 'Employee ID is required.';
    if (!form.name.trim())       e.name       = 'Employee name is required.';
    if (!form.location.trim())   e.location   = 'Location is required.';
    if (!form.ipAddress.trim())  e.ipAddress  = 'IP address is required.';
    if (!form.macAddress.trim()) e.macAddress = 'MAC address is required.';
    if (!isEdit && !form.password.trim()) e.password = 'Password is required.';
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave(form);
  };

  return (
    <div className="umg-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="umg-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="umg-modal__header">
          <h2 className="umg-modal__title">{isEdit ? 'Edit User' : 'Add New User'}</h2>
          <button className="umg-modal__close" onClick={onClose} aria-label="Close">
            <IconX size={14} />
          </button>
        </div>

        {/* Body */}
        <form className="umg-modal__body" onSubmit={handleSubmit} noValidate>

          <div className="umg-field-row">

            {/* ── Employee ID — typeahead (add mode only) ──────────────── */}
            <div className="umg-field">
              <span className="umg-field__label">Employee ID</span>
              <div className="umg-typeahead">
                <input
                  className={`umg-input${errors.id ? ' umg-input--error' : ''}`}
                  value={form.id}
                  onChange={(e) => {
                    set('id', e.target.value);
                    if (!isEdit) { setActiveUserField('id'); triggerUserSearch(e.target.value); }
                  }}
                  onBlur={() => setTimeout(() => setActiveUserField(null), 150)}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setActiveUserField(null); setUserSuggestions([]); } }}
                  placeholder="e.g. EMP-008"
                  disabled={isEdit}
                  autoComplete="off"
                />
                {activeUserField === 'id' && userSuggestions.length > 0 && (
                  <ul className="umg-dropdown" role="listbox">
                    {userSuggestions.map((u) => (
                      <li
                        key={u.id}
                        className="umg-dropdown__item"
                        onMouseDown={(e) => { e.preventDefault(); pickUser(u); }}
                        role="option"
                      >
                        <span className="umg-dropdown__primary">{u.id}</span>
                        <span className="umg-dropdown__secondary">{u.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {errors.id && <span className="umg-field__error">{errors.id}</span>}
            </div>

            {/* ── Employee Name — typeahead (add mode only) ────────────── */}
            <div className="umg-field">
              <span className="umg-field__label">Employee Name</span>
              <div className="umg-typeahead">
                <input
                  className={`umg-input${errors.name ? ' umg-input--error' : ''}`}
                  value={form.name}
                  onChange={(e) => {
                    set('name', e.target.value);
                    if (!isEdit) { setActiveUserField('name'); triggerUserSearch(e.target.value); }
                  }}
                  onBlur={() => setTimeout(() => setActiveUserField(null), 150)}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setActiveUserField(null); setUserSuggestions([]); } }}
                  placeholder="Full name"
                  autoComplete="off"
                />
                {activeUserField === 'name' && userSuggestions.length > 0 && (
                  <ul className="umg-dropdown" role="listbox">
                    {userSuggestions.map((u) => (
                      <li
                        key={u.id}
                        className="umg-dropdown__item"
                        onMouseDown={(e) => { e.preventDefault(); pickUser(u); }}
                        role="option"
                      >
                        <span className="umg-dropdown__primary">{u.name}</span>
                        <span className="umg-dropdown__secondary">{u.id}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {errors.name && <span className="umg-field__error">{errors.name}</span>}
            </div>

          </div>

          {/* ── Location — typeahead (both add and edit mode) ────────────── */}
          <div className="umg-field">
            <span className="umg-field__label">Location</span>
            <div className="umg-typeahead">
              <input
                className={`umg-input${errors.location ? ' umg-input--error' : ''}`}
                value={form.location}
                onChange={(e) => { set('location', e.target.value); triggerLocSearch(e.target.value); }}
                onBlur={() => setTimeout(() => setShowLocDropdown(false), 150)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setShowLocDropdown(false); setLocSuggestions([]); } }}
                placeholder="Search location…"
                autoComplete="off"
              />
              {showLocDropdown && locSuggestions.length > 0 && (
                <ul className="umg-dropdown" role="listbox">
                  {locSuggestions.map((loc) => (
                    <li
                      key={loc.code}
                      className="umg-dropdown__item"
                      onMouseDown={(e) => { e.preventDefault(); pickLocation(loc); }}
                      role="option"
                    >
                      <span className="umg-dropdown__primary">{loc.name}</span>
                      <span className="umg-dropdown__secondary">{loc.city}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {errors.location && <span className="umg-field__error">{errors.location}</span>}
          </div>

          <div className="umg-field-row">
            <label className="umg-field">
              <span className="umg-field__label">IP Address</span>
              <input
                className={`umg-input umg-input--mono${errors.ipAddress ? ' umg-input--error' : ''}`}
                value={form.ipAddress}
                onChange={(e) => set('ipAddress', e.target.value)}
                placeholder="e.g. 192.168.1.101"
              />
              {errors.ipAddress && <span className="umg-field__error">{errors.ipAddress}</span>}
            </label>

            <label className="umg-field">
              <span className="umg-field__label">MAC Address</span>
              <input
                className={`umg-input umg-input--mono${errors.macAddress ? ' umg-input--error' : ''}`}
                value={form.macAddress}
                onChange={(e) => set('macAddress', e.target.value)}
                placeholder="e.g. A4:C3:F0:11:22:33"
              />
              {errors.macAddress && <span className="umg-field__error">{errors.macAddress}</span>}
            </label>
          </div>

          <label className="umg-field">
            <span className="umg-field__label">
              {isEdit ? 'New Password' : 'Password'}
              {isEdit && <span className="umg-field__optional"> (leave blank to keep current)</span>}
            </span>
            <div className={`umg-input-wrap${errors.password ? ' umg-input-wrap--error' : ''}`}>
              <IconLock size={13} className="umg-input-wrap__icon" />
              <input
                className="umg-input umg-input--padded-icon"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder={isEdit ? 'Enter new password to change it' : 'Enter password'}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="umg-input-wrap__eye"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <IconEyeOff size={14} /> : <IconEye size={14} />}
              </button>
            </div>
            {errors.password && <span className="umg-field__error">{errors.password}</span>}
            {!isEdit && !errors.password && (
              <span className="umg-field__hint">If left blank, defaults to the employee ID.</span>
            )}
          </label>

          <div className="umg-field umg-field--inline">
            <span className="umg-field__label">Status</span>
            <button
              type="button"
              className="umg-toggle"
              onClick={() => set('status', !form.status)}
              aria-pressed={form.status}
              aria-label={form.status ? 'Set inactive' : 'Set active'}
            >
              {form.status
                ? <><IconToggleRight size={28} /><span className="umg-status umg-status--on">Active</span></>
                : <><IconToggleLeft  size={28} /><span className="umg-status umg-status--off">Inactive</span></>
              }
            </button>
          </div>

          {/* Save error */}
          {saveError && (
            <div className="umg-modal__error" role="alert">
              <IconAlertCircle size={13} />
              <span>{saveError}</span>
            </div>
          )}

          {/* Footer */}
          <div className="umg-modal__footer">
            <button type="button" className="umg-btn umg-btn--ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="umg-btn umg-btn--primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add User'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function UserManagement() {
  const [users,       setUsers]       = useState([]);
  const [search,      setSearch]      = useState('');
  const [initLoading, setInitLoading] = useState(true);
  const [modal,       setModal]       = useState(null); // null | 'add' | user-object
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');   // page-level error banner
  const [saveError,   setSaveError]   = useState('');   // modal-level save error
  const [currentPage, setCurrentPage] = useState(1);

  // ── Load on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    setError('');
    getManagedUsers()
      .then((data) => { if (active) setUsers(data ?? []); })
      .catch((err) => { if (active) setError(err.message ?? 'Failed to load users.'); })
      .finally(() => { if (active) setInitLoading(false); });
    return () => { active = false; };
  }, []);

  // ── Save (add / edit) ────────────────────────────────────────────────────
  const handleSave = useCallback(async (form) => {
    setSaving(true);
    setSaveError('');
    try {
      if (modal === 'add') {
        const created = await createManagedUser(form);
        setUsers((prev) => [created, ...prev]);
      } else {
        const updated = await updateManagedUser(form.id, form);
        setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u));
      }
      setModal(null);
    } catch (err) {
      setSaveError(err.message ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [modal]);

  const handleModalClose = useCallback(() => {
    if (!saving) { setModal(null); setSaveError(''); }
  }, [saving]);

  // ── Status toggle (optimistic UI, roll back on failure) ──────────────────
  const handleToggle = useCallback(async (id) => {
    const original = users.find((u) => u.id === id);
    if (!original) return;
    const next = !original.status;

    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: next } : u));
    setError('');
    try {
      await updateManagedUserStatus(id, next);
    } catch (err) {
      setUsers((prev) => prev.map((u) => u.id === id ? original : u));
      setError(err.message ?? 'Failed to update status. Please try again.');
    }
  }, [users]);

  // ── Filtered rows ────────────────────────────────────────────────────────
  const filtered = search.trim()
    ? users.filter((u) => {
        const q = search.toLowerCase();
        return (
          u.id.toLowerCase().includes(q)         ||
          u.name.toLowerCase().includes(q)       ||
          u.location.toLowerCase().includes(q)   ||
          u.ipAddress.toLowerCase().includes(q)  ||
          u.macAddress.toLowerCase().includes(q)
        );
      })
    : users;

  // Reset to first page whenever search changes
  useEffect(() => { setCurrentPage(1); }, [search]);

  // ── Pagination ───────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(currentPage, totalPages);
  const pageStart  = (safePage - 1) * PAGE_SIZE;
  const paginated  = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div className="umg-page">

      {/* ── Page-level error banner ──────────────────────────────────────── */}
      {error && (
        <div className="umg-error-banner" role="alert">
          <IconAlertCircle size={15} />
          <span>{error}</span>
          <button
            className="umg-error-banner__dismiss"
            onClick={() => setError('')}
            aria-label="Dismiss error"
          >
            <IconX size={12} />
          </button>
        </div>
      )}

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <header className="umg-page__header">
        <div>
          <h1 className="umg-page__title">User Management</h1>
          <p className="umg-page__sub">Manage employee device access and permissions</p>
        </div>
        <button
          className="umg-add-btn"
          onClick={() => setModal('add')}
          aria-label="Add new user"
        >
          <IconPlus size={15} />
          <span>Add User</span>
        </button>
      </header>

      {/* ── Table card ──────────────────────────────────────────────────── */}
      <div className="umg-card">

        {/* Toolbar */}
        <div className="umg-toolbar">
          <label className="umg-search" aria-label="Search users">
            <IconSearch size={15} />
            <input
              className="umg-search__input"
              type="search"
              placeholder="Search by name, ID, location, IP or MAC…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        {/* Table */}
        <div className="umg-table-wrap">
          <table className="umg-table" aria-label="User management list">
            <thead>
              <tr>
                <th scope="col">Employee ID</th>
                <th scope="col">Employee Name</th>
                <th scope="col">Location</th>
                <th scope="col">IP Address</th>
                <th scope="col">MAC Address</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {initLoading ? (
                Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
                  <tr key={i} className="umg-row--skeleton">
                    {Array.from({ length: 7 }, (_, j) => (
                      <td key={j}><span className="umg-skeleton" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="umg-empty">
                    {search
                      ? `No users match "${search}".`
                      : 'No users yet — click Add User to get started.'}
                  </td>
                </tr>
              ) : (
                paginated.map((user) => (
                  <tr key={user.id}>
                    <td className="umg-col--id">{user.id}</td>
                    <td className="umg-col--name">{user.name}</td>
                    <td>{user.location}</td>
                    <td className="umg-col--mono">{user.ipAddress}</td>
                    <td className="umg-col--mono">{user.macAddress}</td>
                    <td>
                      <button
                        className="umg-toggle"
                        onClick={() => handleToggle(user.id)}
                        aria-label={`${user.status ? 'Deactivate' : 'Activate'} ${user.name}`}
                        aria-pressed={user.status}
                      >
                        {user.status
                          ? <><IconToggleRight size={22} /><span className="umg-status umg-status--on">Active</span></>
                          : <><IconToggleLeft  size={22} /><span className="umg-status umg-status--off">Inactive</span></>
                        }
                      </button>
                    </td>
                    <td>
                      <button
                        className="umg-action-btn"
                        onClick={() => setModal(user)}
                        aria-label={`Edit ${user.name}`}
                        title="Edit"
                      >
                        <IconEdit size={14} />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {!initLoading && filtered.length > 0 && (
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}

        {/* Footer */}
        {!initLoading && users.length > 0 && (
          <div className="umg-footer">
            Showing&nbsp;<strong>{pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)}</strong>&nbsp;of&nbsp;
            <strong>{filtered.length}</strong>&nbsp;user{filtered.length !== 1 ? 's' : ''}
            {search && <span>&nbsp;(filtered from {users.length} total)</span>}
          </div>
        )}

      </div>

      {/* ── Modal ───────────────────────────────────────────────────────── */}
      {modal && (
        <UserModal
          user={modal === 'add' ? null : modal}
          onClose={handleModalClose}
          onSave={handleSave}
          saving={saving}
          saveError={saveError}
        />
      )}

    </div>
  );
}
