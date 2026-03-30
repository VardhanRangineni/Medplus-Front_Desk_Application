import { useState, useEffect, useCallback, useRef } from 'react';
import './UserManagement.css';
import {
  IconSearch,
  IconPlus,
  IconEdit,
  IconToggleRight,
  IconToggleLeft,
  IconX,
} from '../../components/Icons/Icons';
import {
  getManagedUsers,
  createManagedUser,
  updateManagedUser,
  updateManagedUserStatus,
} from './userManagementService';

// ─── Constants ────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  id:         '',
  name:       '',
  location:   '',
  ipAddress:  '',
  macAddress: '',
  status:     true,
};

const SKELETON_ROW_COUNT = 6;

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
function UserModal({ user, onClose, onSave, saving }) {
  const [form,   setForm]   = useState(user ?? EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const isEdit = !!user;

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
            <label className="umg-field">
              <span className="umg-field__label">Employee ID</span>
              <input
                className={`umg-input${errors.id ? ' umg-input--error' : ''}`}
                value={form.id}
                onChange={(e) => set('id', e.target.value)}
                placeholder="e.g. EMP-008"
                disabled={isEdit}
              />
              {errors.id && <span className="umg-field__error">{errors.id}</span>}
            </label>

            <label className="umg-field">
              <span className="umg-field__label">Employee Name</span>
              <input
                className={`umg-input${errors.name ? ' umg-input--error' : ''}`}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Full name"
              />
              {errors.name && <span className="umg-field__error">{errors.name}</span>}
            </label>
          </div>

          <label className="umg-field">
            <span className="umg-field__label">Location</span>
            <input
              className={`umg-input${errors.location ? ' umg-input--error' : ''}`}
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="e.g. Branch - Kondapur"
            />
            {errors.location && <span className="umg-field__error">{errors.location}</span>}
          </label>

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

          {/* Footer */}
          <div className="umg-modal__footer">
            <button type="button" className="umg-btn umg-btn--ghost" onClick={onClose}>
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

  // ── Load on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    getManagedUsers()
      .then((data) => { if (active) setUsers(data); })
      .catch(() => {})
      .finally(() => { if (active) setInitLoading(false); });
    return () => { active = false; };
  }, []);

  // ── Save (add / edit) ────────────────────────────────────────────────────
  const handleSave = useCallback(async (form) => {
    setSaving(true);
    try {
      if (modal === 'add') {
        const created = await createManagedUser(form);
        setUsers((prev) => [created, ...prev]);
      } else {
        const updated = await updateManagedUser(form.id, form);
        setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u));
      }
      setModal(null);
    } catch {
      // errors can be surfaced here once a toast system is added
    } finally {
      setSaving(false);
    }
  }, [modal]);

  // ── Status toggle (optimistic) ───────────────────────────────────────────
  const handleToggle = useCallback(async (id) => {
    const original = users.find((u) => u.id === id);
    if (!original) return;
    const next = !original.status;

    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: next } : u));
    try {
      await updateManagedUserStatus(id, next);
    } catch {
      setUsers((prev) => prev.map((u) => u.id === id ? original : u));
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

  return (
    <div className="umg-page">

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
                filtered.map((user) => (
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

        {/* Footer */}
        {!initLoading && users.length > 0 && (
          <div className="umg-footer">
            Showing&nbsp;<strong>{filtered.length}</strong>&nbsp;of&nbsp;
            <strong>{users.length}</strong>&nbsp;user{users.length !== 1 ? 's' : ''}
          </div>
        )}

      </div>

      {/* ── Modal ───────────────────────────────────────────────────────── */}
      {modal && (
        <UserModal
          user={modal === 'add' ? null : modal}
          onClose={() => !saving && setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

    </div>
  );
}
