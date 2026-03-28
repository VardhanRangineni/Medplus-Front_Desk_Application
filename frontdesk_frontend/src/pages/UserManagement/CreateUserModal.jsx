import React, { useState, useEffect, useRef } from 'react';
import { lookupEmployee } from '../../api/userApi';
import './UserManagement.css';

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
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

const IconSpinner = () => (
  <svg className="um-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 2a10 10 0 0 1 10 10"/>
  </svg>
);

// ── Validation ─────────────────────────────────────────────────────────────────

const IP_RE   = /^(\d{1,3}\.){3}\d{1,3}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(form) {
  const errors = {};
  if (!form.ipAddress.trim())
    errors.ipAddress = 'IP address is required.';
  else if (!IP_RE.test(form.ipAddress.trim()))
    errors.ipAddress = 'Enter a valid IP address (e.g. 192.168.1.10).';

  if (!form.employeeId.trim())
    errors.employeeId = 'Employee ID is required.';

  if (!form.employeeName.trim())
    errors.employeeName = 'Employee name is required.';

  if (!form.email.trim())
    errors.email = 'Mail ID is required.';
  else if (!EMAIL_RE.test(form.email))
    errors.email = 'Enter a valid email address.';

  if (!form.password)
    errors.password = 'Password is required.';
  else if (form.password.length < 8)
    errors.password = 'Password must be at least 8 characters.';

  return errors;
}

// ── Focus trap ─────────────────────────────────────────────────────────────────

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

// ── CreateUserModal ────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  ipAddress:    '',
  employeeId:   '',
  employeeName: '',
  email:        '',
  password:     '',
};

const CreateUserModal = ({ onClose, onSave }) => {
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [errors,       setErrors]       = useState({});
  const [saving,       setSaving]       = useState(false);
  const [showPass,     setShowPass]     = useState(false);
  const [lookupState,  setLookupState]  = useState('idle'); // 'idle' | 'loading' | 'found' | 'error'
  const [lookupMsg,    setLookupMsg]    = useState('');
  const lookupTimer = useRef(null);
  const modalRef    = useRef(null);

  useFocusTrap(modalRef, true);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Cleanup debounce timer on unmount
  useEffect(() => () => clearTimeout(lookupTimer.current), []);

  const set = (field) => (e) => {
    const value = e.target.value;
    setForm(f => ({ ...f, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  // ── Employee ID auto-fill ──────────────────────────────────────────────────

  const handleEmployeeIdChange = (e) => {
    const value = e.target.value;
    setForm(f => ({ ...f, employeeId: value, employeeName: '', email: '' }));
    setErrors(prev => ({ ...prev, employeeId: undefined, employeeName: undefined, email: undefined }));
    setLookupState('idle');
    setLookupMsg('');

    clearTimeout(lookupTimer.current);

    if (!value.trim()) return;

    // Debounce lookup by 500 ms
    lookupTimer.current = setTimeout(async () => {
      setLookupState('loading');
      try {
        const emp = await lookupEmployee(value.trim());
        setForm(f => ({
          ...f,
          employeeName: emp.employeeName,
          email:        emp.email,
          // silently carry role + location for the payload
          _role:        emp.role,
          _location:    emp.location,
        }));
        setLookupState('found');
        setLookupMsg('Employee found.');
      } catch {
        setLookupState('error');
        setLookupMsg('No employee found with that ID.');
      }
    }, 500);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await onSave({
        ipAddress:    form.ipAddress.trim(),
        employeeId:   form.employeeId.trim(),
        employeeName: form.employeeName.trim(),
        email:        form.email.trim(),
        password:     form.password,
        role:         form._role     || 'Receptionist',
        location:     form._location || '',
      });
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

            {/* IP Address */}
            <div className="um-form-row full">
              <div className="um-field">
                <label className="um-label" htmlFor="um-ipAddress">
                  IP Address <span className="um-required">*</span>
                </label>
                <input
                  id="um-ipAddress"
                  className={`um-input${errors.ipAddress ? ' error' : ''}`}
                  placeholder="e.g. 192.168.1.10"
                  value={form.ipAddress}
                  onChange={set('ipAddress')}
                  autoComplete="off"
                  inputMode="decimal"
                />
                {errors.ipAddress && <span className="um-field-error">{errors.ipAddress}</span>}
              </div>
            </div>

            {/* Employee ID */}
            <div className="um-form-row full">
              <div className="um-field">
                <label className="um-label" htmlFor="um-employeeId">
                  Employee ID <span className="um-required">*</span>
                </label>
                <div className="um-input-wrap">
                  <input
                    id="um-employeeId"
                    className={`um-input${errors.employeeId ? ' error' : ''}`}
                    placeholder="e.g. EMP-001"
                    value={form.employeeId}
                    onChange={handleEmployeeIdChange}
                    autoComplete="off"
                  />
                  {lookupState === 'loading' && (
                    <span className="um-lookup-indicator loading" aria-label="Looking up employee">
                      <IconSpinner />
                    </span>
                  )}
                  {lookupState === 'found' && (
                    <span className="um-lookup-indicator found" aria-label="Employee found">✓</span>
                  )}
                </div>
                {errors.employeeId  && <span className="um-field-error">{errors.employeeId}</span>}
                {lookupState === 'error' && (
                  <span className="um-field-error">{lookupMsg}</span>
                )}
              </div>
            </div>

            {/* Employee Name (auto-filled) */}
            <div className="um-form-row full">
              <div className="um-field">
                <label className="um-label" htmlFor="um-employeeName">
                  Employee Name <span className="um-required">*</span>
                  {lookupState === 'found' && (
                    <span className="um-autofill-tag">auto-filled</span>
                  )}
                </label>
                <input
                  id="um-employeeName"
                  className={`um-input${lookupState === 'found' ? ' um-input-autofilled' : ''}${errors.employeeName ? ' error' : ''}`}
                  placeholder="Auto-filled from Employee ID"
                  value={form.employeeName}
                  onChange={set('employeeName')}
                  readOnly={lookupState === 'found'}
                  autoComplete="off"
                />
                {errors.employeeName && <span className="um-field-error">{errors.employeeName}</span>}
              </div>
            </div>

            {/* Mail ID (auto-filled) */}
            <div className="um-form-row full">
              <div className="um-field">
                <label className="um-label" htmlFor="um-email">
                  Mail ID <span className="um-required">*</span>
                  {lookupState === 'found' && (
                    <span className="um-autofill-tag">auto-filled</span>
                  )}
                </label>
                <input
                  id="um-email"
                  type="email"
                  className={`um-input${lookupState === 'found' ? ' um-input-autofilled' : ''}${errors.email ? ' error' : ''}`}
                  placeholder="Auto-filled from Employee ID"
                  value={form.email}
                  onChange={set('email')}
                  readOnly={lookupState === 'found'}
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

export default CreateUserModal;
