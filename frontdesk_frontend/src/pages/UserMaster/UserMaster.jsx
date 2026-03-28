import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import './UserMaster.css';
import PageFilters from '../../components/PageFilters/PageFilters';
import {
  getEmployees,
  syncEmployees,
  updateEmployee,
  deleteEmployee,
} from '../../api/employeeApi';

// ── Constants ─────────────────────────────────────────────────────────────────

const DESIGNATIONS = [
  'Front Desk Administrator',
  'Receptionist',
  'Senior Receptionist',
  'Office Manager',
  'HR Executive',
  'IT Support Specialist',
  'Security Officer',
  'Facility Manager',
  'Accounts Executive',
  'Operations Manager',
];

const DEPARTMENTS = [
  'Administration',
  'Customer Relations',
  'Human Resources',
  'Information Technology',
  'Operations',
  'Finance',
  'Facility Management',
  'Security',
  'Procurement',
];

const WORK_LOCATIONS = [
  'Corporate Office',
  'Software Office',
  'Main Warehouse',
  'Branch - Hyderabad',
  'Branch - Bangalore',
];

const STATUSES = ['Active', 'Inactive'];

const LAST_SYNCED_KEY = 'userMaster_lastSynced';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSyncTime(iso) {
  if (!iso) return null;
  const d     = new Date(iso);
  const now   = new Date();
  const today = now.toDateString() === d.toDateString();
  const time  = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (today) return `Today at ${time}`;
  const date  = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${date} at ${time}`;
}

const EMPTY_FORM = {
  employeeId:   '',
  name:         '',
  workEmail:    '',
  phone:        '',
  designation:  '',
  workLocation: '',
  department:   '',
  status:       'Active',
};

// ── Inline SVG Icons ──────────────────────────────────────────────────────────

const IconRefresh = ({ spinning }) => (
  <svg
    width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    style={spinning ? { animation: 'umtSpin 0.7s linear infinite' } : {}}
  >
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
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

const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
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
const PHONE_RE = /^[+]?[\d\s\-().]{7,20}$/;

function validateForm(form) {
  const errors = {};
  if (!form.employeeId.trim())  errors.employeeId  = 'Employee ID is required.';
  if (!form.name.trim())        errors.name        = 'Full name is required.';
  if (!form.workEmail.trim())   errors.workEmail   = 'Work email is required.';
  else if (!EMAIL_RE.test(form.workEmail)) errors.workEmail = 'Enter a valid email address.';
  if (form.phone && !PHONE_RE.test(form.phone)) errors.phone = 'Enter a valid phone number.';
  if (!form.designation)        errors.designation  = 'Please select a designation.';
  if (!form.workLocation)       errors.workLocation = 'Please select a work location.';
  if (!form.department)         errors.department   = 'Please select a department.';
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
  Array.from({ length: 6 }).map((_, i) => (
    <tr key={i} className="umt-skeleton-row">
      {[80, 130, 190, 110, 160, 130, 120, 70].map((w, j) => (
        <td key={j}><div className="umt-skeleton" style={{ width: w }} /></td>
      ))}
    </tr>
  ));

// ── Status badge ───────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => (
  <span className={`umt-status-badge ${status === 'Active' ? 'umt-status-active' : 'umt-status-inactive'}`}>
    <span className="umt-status-dot" />
    {status}
  </span>
);

// ── Employee Form Modal (shared for Add & Edit) ────────────────────────────────

const EmployeeFormModal = ({ mode, initial, onClose, onSave }) => {
  const [form,   setForm]   = useState(initial || EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
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
    const errs = validateForm(form);
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

  const isEdit = mode === 'edit';

  return (
    <div
      className="umt-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="umt-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="umt-modal-title"
        ref={modalRef}
      >
        {/* Header */}
        <div className="umt-modal-head">
          <div>
            <h2 id="umt-modal-title">{isEdit ? 'Edit Employee' : 'Add Employee'}</h2>
            <p>{isEdit ? `Update the details for ${form.name}.` : 'Enter the details for the new employee.'}</p>
          </div>
          <button className="umt-modal-close" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>

        {/* Body */}
        <form id="umt-employee-form" onSubmit={handleSubmit} noValidate>
          <div className="umt-modal-body">
            {errors._global && (
              <div className="umt-error-banner" role="alert">{errors._global}</div>
            )}

            {/* Employee ID + Name */}
            <div className="umt-form-row">
              <div className="umt-field">
                <label className="umt-label" htmlFor="umt-employee-id">
                  Employee ID <span className="umt-required">*</span>
                </label>
                <input
                  id="umt-employee-id"
                  className={`umt-input${errors.employeeId ? ' error' : ''}`}
                  placeholder="e.g. EMP-009"
                  value={form.employeeId}
                  onChange={set('employeeId')}
                  disabled={isEdit}
                  style={isEdit ? { opacity: 0.55, cursor: 'not-allowed' } : {}}
                  autoComplete="off"
                />
                {errors.employeeId && <span className="umt-field-error">{errors.employeeId}</span>}
              </div>

              <div className="umt-field">
                <label className="umt-label" htmlFor="umt-name">
                  Full Name <span className="umt-required">*</span>
                </label>
                <input
                  id="umt-name"
                  className={`umt-input${errors.name ? ' error' : ''}`}
                  placeholder="e.g. Arun Kumar"
                  value={form.name}
                  onChange={set('name')}
                  autoComplete="off"
                />
                {errors.name && <span className="umt-field-error">{errors.name}</span>}
              </div>
            </div>

            {/* Work Email + Phone */}
            <div className="umt-form-row">
              <div className="umt-field">
                <label className="umt-label" htmlFor="umt-email">
                  Work Email <span className="umt-required">*</span>
                </label>
                <input
                  id="umt-email"
                  type="email"
                  className={`umt-input${errors.workEmail ? ' error' : ''}`}
                  placeholder="name@medplus.com"
                  value={form.workEmail}
                  onChange={set('workEmail')}
                  autoComplete="off"
                  inputMode="email"
                />
                {errors.workEmail && <span className="umt-field-error">{errors.workEmail}</span>}
              </div>

              <div className="umt-field">
                <label className="umt-label" htmlFor="umt-phone">Phone</label>
                <input
                  id="umt-phone"
                  type="tel"
                  className={`umt-input${errors.phone ? ' error' : ''}`}
                  placeholder="e.g. +91 98765 43210"
                  value={form.phone}
                  onChange={set('phone')}
                  autoComplete="off"
                  inputMode="tel"
                />
                {errors.phone && <span className="umt-field-error">{errors.phone}</span>}
              </div>
            </div>

            {/* Designation */}
            <div className="umt-form-row full">
              <div className="umt-field">
                <label className="umt-label" htmlFor="umt-designation">
                  Designation <span className="umt-required">*</span>
                </label>
                <select
                  id="umt-designation"
                  className={`umt-select${errors.designation ? ' error' : ''}`}
                  value={form.designation}
                  onChange={set('designation')}
                >
                  <option value="">Select a designation</option>
                  {DESIGNATIONS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                {errors.designation && <span className="umt-field-error">{errors.designation}</span>}
              </div>
            </div>

            {/* Work Location + Department */}
            <div className="umt-form-row">
              <div className="umt-field">
                <label className="umt-label" htmlFor="umt-location">
                  Work Location <span className="umt-required">*</span>
                </label>
                <select
                  id="umt-location"
                  className={`umt-select${errors.workLocation ? ' error' : ''}`}
                  value={form.workLocation}
                  onChange={set('workLocation')}
                >
                  <option value="">Select a location</option>
                  {WORK_LOCATIONS.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
                {errors.workLocation && <span className="umt-field-error">{errors.workLocation}</span>}
              </div>

              <div className="umt-field">
                <label className="umt-label" htmlFor="umt-department">
                  Department <span className="umt-required">*</span>
                </label>
                <select
                  id="umt-department"
                  className={`umt-select${errors.department ? ' error' : ''}`}
                  value={form.department}
                  onChange={set('department')}
                >
                  <option value="">Select a department</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                {errors.department && <span className="umt-field-error">{errors.department}</span>}
              </div>
            </div>

            {/* Status */}
            <div className="umt-form-row full">
              <div className="umt-field">
                <label className="umt-label">Status</label>
                <div className="umt-radio-group" role="radiogroup" aria-label="Status">
                  {STATUSES.map(s => (
                    <label key={s} className="umt-radio-option">
                      <input
                        type="radio"
                        name="umt-status"
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

          </div>
        </form>

        {/* Footer */}
        <div className="umt-modal-footer">
          <button className="umt-btn-cancel" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="umt-btn-submit"
            type="submit"
            form="umt-employee-form"
            disabled={saving}
          >
            {saving
              ? (isEdit ? 'Saving…' : 'Adding…')
              : (isEdit ? 'Save Changes' : 'Add Employee')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Delete confirmation modal ──────────────────────────────────────────────────

const DeleteConfirmModal = ({ employee, onClose, onConfirm }) => {
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
      className="umt-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="umt-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="umt-confirm-title"
        aria-describedby="umt-confirm-desc"
        ref={modalRef}
      >
        <div className="umt-confirm-icon"><IconAlertTriangle /></div>
        <div>
          <h3 id="umt-confirm-title">Delete Employee?</h3>
          <p id="umt-confirm-desc">
            This will permanently remove <strong>{employee.name}</strong> ({employee.employeeId}).
            This action cannot be undone.
          </p>
        </div>
        <div className="umt-confirm-actions">
          <button className="umt-btn-cancel" onClick={onClose} disabled={deleting}>Cancel</button>
          <button className="umt-btn-danger" onClick={handleConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main UserMaster component ─────────────────────────────────────────────────

const UserMaster = () => {
  const { location, locations, dateRange, setLocation, setDateRange } = useOutletContext();

  const [filtersState, setFiltersState] = useState(null);
  const filterToggleRef = useRef(null);

  const toggleFilters = () =>
    setFiltersState(s => s === null ? 'open' : s === 'open' ? 'closing' : 'open');

  const handleFiltersAnimEnd = () =>
    setFiltersState(s => s === 'closing' ? null : s);

  useEffect(() => {
    const handler = (e) => {
      if (filterToggleRef.current && !filterToggleRef.current.contains(e.target))
        setFiltersState(s => s === 'open' ? 'closing' : s);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const [employees,    setEmployees]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [syncing,      setSyncing]      = useState(false);
  const [error,        setError]        = useState('');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [lastSynced,   setLastSynced]   = useState(
    () => localStorage.getItem(LAST_SYNCED_KEY) || null,
  );

  // modal: null | 'edit' | 'delete'
  const [modal,        setModal]        = useState(null);
  const [activeRecord, setActiveRecord] = useState(null);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    getEmployees()
      .then(setEmployees)
      .catch((err) => setError(err.message || 'Failed to load employees.'))
      .finally(() => setLoading(false));
  }, []);

  // ── Sync / Fetch handler ────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    setError('');
    try {
      const fresh = await syncEmployees();
      setEmployees(fresh);
      const now = new Date().toISOString();
      setLastSynced(now);
      localStorage.setItem(LAST_SYNCED_KEY, now);
    } catch (err) {
      setError(err.message || 'Fetch failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  // ── Client-side search filtering ────────────────────────────────────────────
  const filteredEmployees = useCallback(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(emp =>
      emp.employeeId.toLowerCase().includes(q)   ||
      emp.name.toLowerCase().includes(q)         ||
      emp.workEmail.toLowerCase().includes(q)    ||
      emp.phone.toLowerCase().includes(q)        ||
      emp.designation.toLowerCase().includes(q)  ||
      emp.workLocation.toLowerCase().includes(q) ||
      emp.department.toLowerCase().includes(q),
    );
  }, [employees, searchQuery])();

  // ── Row handlers ────────────────────────────────────────────────────────────

  const openEdit   = (emp) => { setActiveRecord(emp); setModal('edit');   };
  const openDelete = (emp) => { setActiveRecord(emp); setModal('delete'); };
  const closeModal = ()    => { setModal(null); setActiveRecord(null);    };

  const handleEdit = async (form) => {
    const updated = await updateEmployee(activeRecord.id, form);
    setEmployees(prev =>
      prev.map(e => (e.id === activeRecord.id ? { ...e, ...updated } : e)),
    );
  };

  const handleDelete = async () => {
    const id = activeRecord.id;
    setEmployees(prev => prev.filter(e => e.id !== id));
    closeModal();
    try {
      await deleteEmployee(id);
    } catch (err) {
      setEmployees(prev => [...prev, activeRecord]);
      setError(err.message || 'Delete failed. Please try again.');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Page header */}
      <div className="umt-page-header">
        <div className="umt-page-header-left">
          <h1 className="umt-page-title">User Master</h1>
          <p className="umt-page-sub">Manage employee information and organisational details.</p>
        </div>
        <div className="pf-toggle-wrap" ref={filterToggleRef}>
          {filtersState !== null && (
            <div
              className={`pf-inline-filters${filtersState === 'closing' ? ' closing' : ''}`}
              onAnimationEnd={handleFiltersAnimEnd}
            >
              <PageFilters
                locations={locations}
                location={location}
                onLocationChange={setLocation}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
            </div>
          )}
          <button
            className={`pf-toggle-btn${filtersState === 'open' ? ' open' : ''}${location !== 'All' ? ' active' : ''}`}
            onClick={toggleFilters}
            aria-expanded={filtersState === 'open'}
            aria-label="Toggle filters"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Filters
            {location !== 'All' && <span className="pf-filter-dot" />}
            <svg
              className={`pf-toggle-chevron${filtersState === 'open' ? ' rotated' : ''}`}
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="umt-toolbar">
        <div className="umt-search-wrap">
          <span className="umt-search-icon" aria-hidden="true"><IconSearch /></span>
          <input
            type="search"
            className="umt-search-input"
            placeholder="Search by name, ID, email, designation…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search employees"
          />
          {searchQuery && (
            <button
              className="umt-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <IconX />
            </button>
          )}
        </div>
        <div className="umt-fetch-group">
          {lastSynced && (
            <span className="umt-last-synced">
              Last fetched: {formatSyncTime(lastSynced)}
            </span>
          )}
          <button
            className="umt-btn-fetch"
            onClick={handleSync}
            disabled={syncing}
            title="Fetch latest employees from the system"
          >
            <IconRefresh spinning={syncing} />
            {syncing ? 'Fetching…' : 'Fetch Employees'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="umt-error-banner" role="alert">
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
      <div className="umt-table-card">
        <div className="umt-table-header">
          <span>Employee Records</span>
          {!loading && (
            <span className="umt-table-count">
              {searchQuery
                ? `${filteredEmployees.length} of ${employees.length} employee${employees.length !== 1 ? 's' : ''}`
                : `${employees.length} employee${employees.length !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>

        <div className="umt-table-scroll">
          <table className="umt-table">
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Work Email</th>
                <th>Phone</th>
                <th>Designation</th>
                <th>Work Location</th>
                <th>Department</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 0, border: 'none' }}>
                    <div className="umt-empty">
                      <IconUsers />
                      <p>{searchQuery ? 'No results found' : 'No employees found'}</p>
                      <span>
                        {searchQuery
                          ? `No employees match "${searchQuery}". Try a different search.`
                          : 'Click "Fetch Employees" to pull the latest data.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id}>
                    <td className="umt-td-id">{emp.employeeId}</td>
                    <td className="umt-td-name">{emp.name}</td>
                    <td className="umt-td-email">{emp.workEmail}</td>
                    <td className="umt-td-phone">{emp.phone || '—'}</td>
                    <td className="umt-td-designation">{emp.designation}</td>
                    <td className="umt-td-location">{emp.workLocation}</td>
                    <td className="umt-td-department">{emp.department}</td>
                    <td><StatusBadge status={emp.status} /></td>
                    <td>
                      <div className="umt-actions-cell">
                        <button
                          className="umt-action-btn"
                          onClick={() => openEdit(emp)}
                          title={`Edit ${emp.name}`}
                          aria-label={`Edit ${emp.name}`}
                        >
                          <IconEdit />
                        </button>
                        <button
                          className="umt-action-btn delete"
                          onClick={() => openDelete(emp)}
                          title={`Delete ${emp.name}`}
                          aria-label={`Delete ${emp.name}`}
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
      {modal === 'edit' && activeRecord && (
        <EmployeeFormModal mode="edit" initial={activeRecord} onClose={closeModal} onSave={handleEdit} />
      )}
      {modal === 'delete' && activeRecord && (
        <DeleteConfirmModal employee={activeRecord} onClose={closeModal} onConfirm={handleDelete} />
      )}
    </>
  );
};

export default UserMaster;
