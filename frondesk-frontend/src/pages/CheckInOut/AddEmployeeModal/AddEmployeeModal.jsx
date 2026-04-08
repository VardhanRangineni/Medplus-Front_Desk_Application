/**
 * AddEmployeeModal — 2-step employee check-in flow.
 *
 *  Step 1  Employee ID lookup → Visit details (person to meet, dept, reason, card)
 *  Step 2  Photo capture (selfie or skip)
 *
 * Reuses the avm-* CSS design-language as AddVisitorModal.
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import '../AddVisitorModal/AddVisitorModal.css';
import './AddEmployeeModal.css';
import {
  IconX,
  IconIdCard,
  IconBuilding,
  IconChevronDown,
  IconUsers,
  IconCreditCard,
} from '../../../components/Icons/Icons';
import {
  lookupEmployee,
  getPersonsToMeet,
  getDepartments,
  createEmployeeEntry,
  updateEmployeeEntry,
} from './addEmployeeService';

// ─── Shared primitives (same design as AddVisitorModal) ───────────────────────

function Field({ label, required, children, hint }) {
  return (
    <div className="avm-field">
      {label && (
        <label className="avm-label">
          {label}
          {required && <span className="avm-label__req" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {hint && <p className="avm-hint">{hint}</p>}
    </div>
  );
}

function InputWithIcon({ icon, ...props }) {
  return (
    <div className="avm-input-wrap">
      <span className="avm-input-icon">{icon}</span>
      <input className="avm-input" {...props} />
    </div>
  );
}

function SelectField({ icon, placeholder, value, onChange, options, disabled }) {
  const [open,      setOpen]      = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [dropStyle, setDropStyle] = useState({});
  const btnRef  = useRef(null);
  const dropRef = useRef(null);

  function openMenu() {
    const rect = btnRef.current.getBoundingClientRect();
    setDropStyle({ position: 'fixed', top: rect.bottom + 5, left: rect.left, width: rect.width, zIndex: 9999 });
    setOpen(true);
    setHighlight(-1);
  }
  function closeMenu() { setOpen(false); }
  function toggle() { if (!disabled) open ? closeMenu() : openMenu(); }
  function choose(id) { onChange(id); closeMenu(); }

  useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (btnRef.current && !btnRef.current.contains(e.target) &&
          (dropRef.current == null || !dropRef.current.contains(e.target))) closeMenu();
    }
    function onScroll() { closeMenu(); }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  function onKey(e) {
    if (e.key === 'Escape') { closeMenu(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && !open) { openMenu(); e.preventDefault(); return; }
    if (e.key === 'Enter' && open && highlight >= 0) { choose(options[highlight].id); e.preventDefault(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) openMenu(); setHighlight((h) => Math.min(h + 1, options.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
  }

  const selected = options.find((o) => o.id === value);

  return (
    <div className="avm-select-wrap">
      {icon && <span className="avm-input-icon">{icon}</span>}
      <button
        ref={btnRef}
        type="button"
        className={['avm-select-btn', icon ? 'avm-select-btn--icon' : '', open ? 'avm-select-btn--open' : '', !value ? 'avm-select-btn--empty' : ''].filter(Boolean).join(' ')}
        onClick={toggle}
        onKeyDown={onKey}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? selected.name : placeholder}
      </button>
      <span className={`avm-select-caret${open ? ' avm-select-caret--open' : ''}`}>
        <IconChevronDown size={14} />
      </span>
      {open && createPortal(
        <div ref={dropRef} className="avm-dropdown" style={dropStyle} role="listbox">
          {options.map((o, i) => (
            <div
              key={o.id}
              role="option"
              aria-selected={o.id === value}
              className={['avm-dropdown__option', o.id === value ? 'avm-dropdown__option--active' : '', i === highlight ? 'avm-dropdown__option--hi' : ''].filter(Boolean).join(' ')}
              onMouseDown={(e) => { e.preventDefault(); choose(o.id); }}
              onMouseEnter={() => setHighlight(i)}
            >
              {o.name}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── Step 1 — Employee ID lookup + Visit details ──────────────────────────────
function Step1({
  empId, onEmpIdChange,
  employee, lookupError, looking,
  onLookup,
  personToMeet, onPersonToMeetChange,
  hostDepartment, setHostDepartment,
  reasonForVisit, setReasonForVisit,
  cardNumber, setCardNumber,
  persons, departments,
}) {
  return (
    <div className="avm-step">

      {/* Employee ID lookup */}
      <Field label="Employee ID" required>
        <div className="avm-side-by-side">
          <InputWithIcon
            icon={<IconIdCard size={14} />}
            type="text"
            placeholder="e.g. EMP1001"
            value={empId}
            maxLength={20}
            disabled={employee !== null}
            onChange={(e) => onEmpIdChange(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter' && !employee) onLookup(); }}
          />
          <button
            className={`avm-otp-btn${employee ? ' avm-otp-btn--done' : ''}`}
            onClick={onLookup}
            disabled={empId.trim().length < 4 || looking || employee !== null}
          >
            {looking ? 'Looking up…' : employee ? 'Found ✓' : 'Lookup'}
          </button>
        </div>
        {lookupError && <p className="avm-error">{lookupError}</p>}
      </Field>

      {/* Employee info card */}
      {employee && (
        <div className="aem-emp-card">
          <div className="aem-emp-card__avatar">
            <IconUsers size={20} />
          </div>
          <div className="aem-emp-card__info">
            <p className="aem-emp-card__name">{employee.name}</p>
            <p className="aem-emp-card__meta">
              {employee.id} &nbsp;·&nbsp; {employee.department}
            </p>
          </div>
          <button
            className="aem-emp-card__reset"
            onClick={() => onEmpIdChange('')}
            title="Change employee"
          >
            ✕
          </button>
        </div>
      )}

      {/* Visit details — only shown after successful lookup */}
      {employee && (
        <>
          <Field label="Person To Meet" required>
            <SelectField
              placeholder="Select a person…"
              value={personToMeet}
              onChange={onPersonToMeetChange}
              options={persons.map((p) => ({ id: p.id, name: `${p.name} — ${p.department}` }))}
            />
          </Field>

          <Field label="Host Department">
            <SelectField
              icon={<IconBuilding size={14} />}
              placeholder="Select a department"
              value={hostDepartment}
              onChange={setHostDepartment}
              options={departments}
            />
          </Field>

          <Field label="Reason for Visit">
            <textarea
              className="avm-textarea"
              placeholder="e.g. Project meeting"
              rows={3}
              value={reasonForVisit}
              onChange={(e) => setReasonForVisit(e.target.value)}
            />
          </Field>

          <Field label="Card Number">
            <InputWithIcon
              icon={<IconCreditCard size={14} />}
              type="text"
              placeholder="e.g. 123"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
            />
          </Field>
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AddEmployeeModal({ onClose, onBack, onSuccess }) {
  // ── Step 1 state ──────────────────────────────────────────────────────────
  const [empId,         setEmpIdRaw]      = useState('');
  const [employee,      setEmployee]      = useState(null);
  const [lookupError,   setLookupError]   = useState('');
  const [looking,       setLooking]       = useState(false);
  const [personToMeet,   setPersonToMeet]   = useState('');
  const [hostDepartment, setHostDepartment] = useState('');
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [cardNumber,     setCardNumber]     = useState('');

  // ── Reference data ────────────────────────────────────────────────────────
  const [persons,     setPersons]     = useState([]);
  const [departments, setDepartments] = useState([]);

  // ── Submission ────────────────────────────────────────────────────────────
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState('');

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // ── Load reference data ───────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([getPersonsToMeet(), getDepartments()])
      .then(([pers, depts]) => { setPersons(pers); setDepartments(depts); })
      .catch(() => {});
  }, []);

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Pre-fill host department when employee is fetched
  useEffect(() => {
    if (employee?.department && departments.length > 0 && !hostDepartment) {
      const found = departments.find((d) => d.name === employee.department);
      if (found) setHostDepartment(found.id);
    }
  }, [employee, departments]);

  // ── Employee ID change ────────────────────────────────────────────────────
  function handleEmpIdChange(val) {
    setEmpIdRaw(val);
    setLookupError('');
    if (employee) {
      // Resetting — clear all downstream state
      setEmployee(null);
      setPersonToMeet('');
      setHostDepartment('');
      setReasonForVisit('');
      setCardNumber('');
    }
  }

  // ── Employee lookup (no OTP) ──────────────────────────────────────────────
  async function handleLookup() {
    if (empId.trim().length < 4 || looking || employee) return;
    setLooking(true);
    setLookupError('');
    try {
      const result = await lookupEmployee(empId);
      if (!result.found) {
        setLookupError(result.message || 'Employee ID not found.');
      } else {
        setEmployee(result.employee);
      }
    } catch {
      setLookupError('Something went wrong. Please try again.');
    } finally {
      setLooking(false);
    }
  }

  // ── Person-to-meet: auto-fill host department ─────────────────────────────
  function handlePersonToMeetChange(personId) {
    setPersonToMeet(personId);
    const person = persons.find((p) => p.id === personId);
    if (person) {
      const dept = departments.find((d) => d.name === person.department);
      if (dept) setHostDepartment(dept.id);
    }
  }

  // ── Form validity ─────────────────────────────────────────────────────────
  const formValid = employee !== null && personToMeet !== '';

  function handleBack() {
    onBack?.();
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        type:           'EMPLOYEE',
        visitType:      'individual',
        empId:          employee?.id ?? empId,
        name:           employee?.name ?? '',
        department:     employee?.department ?? '',
        personToMeet,
        hostDepartment,
        reasonForVisit,
        cardNumber,
      };
      const result = await createEmployeeEntry(payload);
      if (result.success) {
        onSuccess?.(result);
        onClose();
      }
    } catch (err) {
      setSubmitError(err?.message || 'Failed to create entry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="avm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aem-title"
      onClick={handleOverlayClick}
    >
      <div className="avm-dialog">

        {/* Header */}
        <div className="avm-header">
          <div>
            <h2 className="avm-title" id="aem-title">Add New Employee</h2>
            <p className="avm-subtitle">Look up employee and enter visit details.</p>
          </div>
          <button className="avm-close" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="avm-body">
          <Step1
            empId={empId}
            onEmpIdChange={handleEmpIdChange}
            employee={employee}
            lookupError={lookupError}
            looking={looking}
            onLookup={handleLookup}
            personToMeet={personToMeet}
            onPersonToMeetChange={handlePersonToMeetChange}
            hostDepartment={hostDepartment}
            setHostDepartment={setHostDepartment}
            reasonForVisit={reasonForVisit}
            setReasonForVisit={setReasonForVisit}
            cardNumber={cardNumber}
            setCardNumber={setCardNumber}
            persons={persons}
            departments={departments}
          />
        </div>

        {/* Footer */}
        <div className="avm-footer">
          <button
            className="avm-btn avm-btn--back"
            onClick={handleBack}
            disabled={submitting}
          >
            Back
          </button>

          <div className="avm-footer__spacer" />

          {submitError && <p className="avm-error avm-error--footer">{submitError}</p>}

          <button
            className="avm-btn avm-btn--submit"
            onClick={handleSubmit}
            disabled={!formValid || submitting}
          >
            {submitting ? 'Adding…' : 'Add and Check-in'}
          </button>
        </div>

      </div>
    </div>
  );
}
