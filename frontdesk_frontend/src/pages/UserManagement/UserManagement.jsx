import React, { useState, useEffect, useRef } from 'react';
import './UserManagement.css';
import { getUsers, createUser, updateUser, deleteUser } from '../../api/userApi';

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLES = ['Admin', 'Receptionist'];

const USER_STATUSES = ['Active', 'Inactive'];

const EMPTY_CREATE_FORM = {
  role:     '',
  location: '',
  email:    '',
  password: '',
};

const EMPTY_EDIT_FORM = {
  role:     '',
  location: '',
  email:    '',
  password: '',
};

// ── Inline SVG Icons ──────────────────────────────────────────────────────────

const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconAlertTriangle = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const IconEye = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const IconEyeOff = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const IconUsers = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

// ── Validation ─────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCreateForm(form) {
  const errors = {};
  if (!form.role)                         errors.role     = 'Please select a role.';
  if (!form.email.trim())                 errors.email    = 'Email is required.';
  else if (!EMAIL_RE.test(form.email))    errors.email    = 'Enter a valid email address.';
  if (!form.password)                     errors.password = 'Password is required.';
  else if (form.password.length < 8)      errors.password = 'Password must be at least 8 characters.';
  return errors;
}

function validateEditForm(form) {
  const errors = {};
  if (!form.role)                                              errors.role     = 'Please select a role.';
  if (!form.email.trim())                                      errors.email    = 'Email is required.';
  else if (!EMAIL_RE.test(form.email))                         errors.email    = 'Enter a valid email address.';
  if (form.password && form.password.length < 8)               errors.password = 'Password must be at least 8 characters.';
  return errors;
}

// ── Focus trap helper ──────────────────────────────────────────────────────────

function useFocusTrap(ref, isActive) {
  useEffect(() => {
    if (!isActive || !ref.current) return;
    const el = ref.current;
    const focusable = el.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    first?.focus();

    const trap = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
      }
    };

    el.addEventListener('keydown', trap);
    return () => el.removeEventListener('keydown', trap);
  }, [isActive, ref]);
}

// ── Skeleton rows ──────────────────────────────────────────────────────────────

const SkeletonRows = () =>
  Array.from({ length: 5 }).map((_, i) => (
    <tr key={i} className="um-skeleton-row">
      {[100, 140, 180, 80, 60].map((w, j) => (
        <td key={j}><div className="um-skeleton" style={{ width: w }} /></td>
      ))}
    </tr>
  ));

// ── Role badge ─────────────────────────────────────────────────────────────────

const RoleBadge = ({ role }) => (
  <span className={`um-role-badge ${role === 'Admin' ? 'um-role-admin' : 'um-role-receptionist'}`}>
    {role}
  </span>
);

// ── Status badge ───────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => (
  <span className={`um-status-badge ${status === 'Active' ? 'um-status-active' : 'um-status-inactive'}`}>
    <span className="um-status-dot" />
    {status}
  </span>
);

// ── Create User Modal ──────────────────────────────────────────────────────────

const CreateUserModal = ({ onClose, onSave }) => {
  const [form,     setForm]     = useState(EMPTY_CREATE_FORM);
  const [errors,   setErrors]   = useState({});
  const [saving,   setSaving]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const modalRef = useRef(null);

  useFocusTrap(modalRef, true);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (field) => (e) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateCreateForm(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setErrors({ _global: err.message || 'Something went wrong. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="um-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="um-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="um-create-title"
        ref={modalRef}
      >
        {/* Header */}
        <div className="um-modal-head">
          <div>
            <h2 id="um-create-title">Create New User</h2>
            <p>Fill in the details to create a new user account.</p>
          </div>
          <button className="um-modal-close" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>

        {/* Body */}
        <form id="um-create-form" onSubmit={handleSubmit} noValidate>
          <div className="um-modal-body">
            {errors._global && (
              <div className="um-error-banner" role="alert">{errors._global}</div>
            )}

            {/* Role */}
            <div className="um-form-row full">
              <div className="um-field">
                <label className="um-label" htmlFor="um-role">
                  Role <span className="um-required">*</span>
                </label>
                <select
                  id="um-role"
                  className={`um-select${errors.role ? ' error' : ''}`}
                  value={form.role}
                  onChange={set('role')}
                >
                  <option value="">Select a role</option>
                  {ROLES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {errors.role && <span className="um-field-error">{errors.role}</span>}
              </div>
            </div>

            {/* Email */}
            <div className="um-form-row full">
              <div className="um-field">
                <label className="um-label" htmlFor="um-email">
                  Email <span className="um-required">*</span>
                </label>
                <input
                  id="um-email"
                  type="email"
                  className={`um-input${errors.email ? ' error' : ''}`}
                  placeholder="user@example.com"
                  value={form.email}
                  onChange={set('email')}
                  autoComplete="off"
                  inputMode="email"
                />
                {errors.email && <span className="um-field-error">{errors.email}</span>}
              </div>
            </div>

            {/* Password */}
            <div className="um-form-row full">
              <div className="um-field">
                <label className="um-label" htmlFor="um-password">
                  Password <span className="um-required">*</span>
                </label>
                <div className="um-input-wrap">
                  <input
                    id="um-password"
                    type={showPass ? 'text' : 'password'}
                    className={`um-input um-input-pw${errors.password ? ' error' : ''}`}
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={set('password')}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="um-pw-toggle"
                    onClick={() => setShowPass(v => !v)}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPass ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
                {errors.password && <span className="um-field-error">{errors.password}</span>}
              </div>
            </div>

          </div>
        </form>

        {/* Footer */}
        <div className="um-modal-footer">
          <button className="um-btn-cancel" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="um-btn-submit"
            type="submit"
            form="um-create-form"
            disabled={saving}
          >
            {saving ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Edit User Modal ────────────────────────────────────────────────────────────

const EditUserModal = ({ user, onClose, onSave }) => {
  const [form,     setForm]     = useState({
    role:     user.role     || '',
    location: user.location || '',
    email:    user.email    || '',
    status:   user.status   || 'Active',
    password: '',
  });
  const [errors,   setErrors]   = useState({});
  const [saving,   setSaving]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const modalRef = useRef(null);

  useFocusTrap(modalRef, true);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (field) => (e) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateEditForm(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    const payload = { ...form };
    if (!payload.password) delete payload.password;
    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      setErrors({ _global: err.message || 'Something went wrong. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="um-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="um-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="um-edit-title"
        ref={modalRef}
      >
        {/* Header */}
        <div className="um-modal-head">
          <div>
            <h2 id="um-edit-title">Edit User</h2>
            <p>Update the details for <strong>{user.email}</strong>.</p>
          </div>
          <button className="um-modal-close" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>

        {/* Body */}
        <form id="um-edit-form" onSubmit={handleSubmit} noValidate>
          <div className="um-modal-body">
            {errors._global && (
              <div className="um-error-banner" role="alert">{errors._global}</div>
            )}

            {/* Role + Status */}
            <div className="um-form-row">
              <div className="um-field">
                <label className="um-label" htmlFor="um-edit-role">
                  Role <span className="um-required">*</span>
                </label>
                <select
                  id="um-edit-role"
                  className={`um-select${errors.role ? ' error' : ''}`}
                  value={form.role}
                  onChange={set('role')}
                >
                  <option value="">Select a role</option>
                  {ROLES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {errors.role && <span className="um-field-error">{errors.role}</span>}
              </div>

              <div className="um-field">
                <label className="um-label">Status</label>
                <div className="um-radio-group" role="radiogroup" aria-label="Status">
                  {USER_STATUSES.map(s => (
                    <label key={s} className="um-radio-option">
                      <input
                        type="radio"
                        name="um-status"
                        value={s}
                        checked={form.status === s}
                        onChange={set('status')}
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="um-form-row full">
              <div className="um-field">
                <label className="um-label" htmlFor="um-edit-email">
                  Email <span className="um-required">*</span>
                </label>
                <input
                  id="um-edit-email"
                  type="email"
                  className={`um-input${errors.email ? ' error' : ''}`}
                  placeholder="user@example.com"
                  value={form.email}
                  onChange={set('email')}
                  autoComplete="off"
                  inputMode="email"
                />
                {errors.email && <span className="um-field-error">{errors.email}</span>}
              </div>
            </div>

            {/* Location */}
            <div className="um-form-row full">
              <div className="um-field">
                <label className="um-label" htmlFor="um-edit-location">Location</label>
                <input
                  id="um-edit-location"
                  className="um-input"
                  placeholder="e.g. Corporate Office"
                  value={form.location}
                  onChange={set('location')}
                  autoComplete="off"
                />
              </div>
            </div>

            {/* New password (optional) */}
            <div className="um-form-row full">
              <div className="um-field">
                <label className="um-label" htmlFor="um-edit-password">
                  New Password{' '}
                  <span className="um-label-hint">(leave blank to keep current)</span>
                </label>
                <div className="um-input-wrap">
                  <input
                    id="um-edit-password"
                    type={showPass ? 'text' : 'password'}
                    className={`um-input um-input-pw${errors.password ? ' error' : ''}`}
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={set('password')}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="um-pw-toggle"
                    onClick={() => setShowPass(v => !v)}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPass ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
                {errors.password && <span className="um-field-error">{errors.password}</span>}
              </div>
            </div>

          </div>
        </form>

        {/* Footer */}
        <div className="um-modal-footer">
          <button className="um-btn-cancel" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="um-btn-submit"
            type="submit"
            form="um-edit-form"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Delete confirmation modal ──────────────────────────────────────────────────

const DeleteConfirmModal = ({ user, onClose, onConfirm }) => {
  const [deleting, setDeleting] = useState(false);
  const modalRef = useRef(null);

  useFocusTrap(modalRef, true);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleConfirm = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  };

  return (
    <div
      className="um-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="um-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="um-confirm-title"
        aria-describedby="um-confirm-desc"
        ref={modalRef}
      >
        <div className="um-confirm-icon"><IconAlertTriangle /></div>
        <div>
          <h3 id="um-confirm-title">Delete User?</h3>
          <p id="um-confirm-desc">
            This will permanently remove <strong>{user.email}</strong>.
            This action cannot be undone.
          </p>
        </div>
        <div className="um-confirm-actions">
          <button className="um-btn-cancel" onClick={onClose} disabled={deleting}>Cancel</button>
          <button className="um-btn-danger" onClick={handleConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main UserManagement component ─────────────────────────────────────────────

const UserManagement = () => {
  const [users,        setUsers]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');

  // modal: null | 'create' | 'edit' | 'delete'
  const [modal,        setModal]        = useState(null);
  const [activeRecord, setActiveRecord] = useState(null);

  // ── Load users ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    getUsers()
      .then(setUsers)
      .catch((err) => setError(err.message || 'Failed to load users.'))
      .finally(() => setLoading(false));
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const openCreate = ()      => { setActiveRecord(null); setModal('create'); };
  const openEdit   = (user)  => { setActiveRecord(user); setModal('edit');   };
  const openDelete = (user)  => { setActiveRecord(user); setModal('delete'); };
  const closeModal = ()      => { setModal(null); setActiveRecord(null);     };

  const handleCreate = async (form) => {
    const created = await createUser(form);
    setUsers(prev => [created, ...prev]);
  };

  const handleEdit = async (form) => {
    const updated = await updateUser(activeRecord.id, form);
    setUsers(prev =>
      prev.map(u => (u.id === activeRecord.id ? { ...u, ...updated } : u)),
    );
  };

  const handleDelete = async () => {
    const id = activeRecord.id;
    setUsers(prev => prev.filter(u => u.id !== id));
    closeModal();
    try {
      await deleteUser(id);
    } catch (err) {
      setUsers(prev => [...prev, activeRecord]);
      setError(err.message || 'Delete failed. Please try again.');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Page header */}
      <div className="um-page-header">
        <h1 className="um-page-title">User Management</h1>
        <p className="um-page-sub">Manage system users and their access roles.</p>
      </div>

      {/* Toolbar */}
      <div className="um-toolbar">
        <button className="um-btn-primary" onClick={openCreate}>
          <IconPlus /> Create User
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="um-error-banner" role="alert">
          {error}
          <button
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '0 4px' }}
            onClick={() => setError('')}
            aria-label="Dismiss"
          >
            <IconX />
          </button>
        </div>
      )}

      {/* Table card */}
      <div className="um-table-card">
        <div className="um-table-header">
          <span>System Users</span>
          {!loading && (
            <span className="um-table-count">{users.length} user{users.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        <div className="um-table-scroll">
          <table className="um-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Location</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 0, border: 'none' }}>
                    <div className="um-empty">
                      <IconUsers />
                      <p>No users found</p>
                      <span>Click "Create User" to add the first system user.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td><RoleBadge role={user.role} /></td>
                    <td className="um-td-location">{user.location || '—'}</td>
                    <td className="um-td-email">{user.email}</td>
                    <td><StatusBadge status={user.status} /></td>
                    <td>
                      <div className="um-actions-cell">
                        <button
                          className="um-action-btn"
                          onClick={() => openEdit(user)}
                          title={`Edit ${user.email}`}
                          aria-label={`Edit ${user.email}`}
                        >
                          <IconEdit />
                        </button>
                        <button
                          className="um-action-btn delete"
                          onClick={() => openDelete(user)}
                          title={`Delete ${user.email}`}
                          aria-label={`Delete ${user.email}`}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {modal === 'create' && (
        <CreateUserModal onClose={closeModal} onSave={handleCreate} />
      )}
      {modal === 'edit' && activeRecord && (
        <EditUserModal user={activeRecord} onClose={closeModal} onSave={handleEdit} />
      )}
      {modal === 'delete' && activeRecord && (
        <DeleteConfirmModal user={activeRecord} onClose={closeModal} onConfirm={handleDelete} />
      )}
    </>
  );
};

export default UserManagement;
