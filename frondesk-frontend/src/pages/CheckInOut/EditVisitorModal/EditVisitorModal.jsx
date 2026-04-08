/**
 * EditVisitorModal — single-page form to edit an existing visitor entry.
 *
 * No steps, no photo. Just a scrollable form pre-filled with the entry data.
 * Shares the avm-* CSS design language with AddVisitorModal.
 *
 * Pre-fills immediately from the `entry` prop (no blocking API call).
 * Silently enriches from getEntryDetail when the backend is ready.
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import '../AddVisitorModal/AddVisitorModal.css';
import './EditVisitorModal.css';
import {
  IconX,
  IconUser,
  IconPhone,
  IconMail,
  IconCreditCard,
  IconBuilding,
  IconPlus,
  IconTrash,
  IconChevronDown,
  IconUsers,
} from '../../../components/Icons/Icons';
import { getEntryDetail } from '../checkInOutService';
import {
  getPersonsToMeet,
  getDepartments,
  updateVisitorEntry,
} from '../AddVisitorModal/addVisitorService';

// ─── Constants ────────────────────────────────────────────────────────────────

const AADHAAR_REGEX = /^\d{12}$/;

// ─── Shared primitives ────────────────────────────────────────────────────────

function Field({ label, required, children, hint, error }) {
  return (
    <div className="avm-field">
      {label && (
        <label className="avm-label">
          {label}
          {required && <span className="avm-label__req">*</span>}
        </label>
      )}
      {children}
      {error && <p className="avm-error" style={{ marginTop: 4, fontSize: 11 }}>{error}</p>}
      {hint && !error && <p className="avm-hint">{hint}</p>}
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

// ─── Build form from entry + optional detail ──────────────────────────────────

function buildForm(entry, detail) {
  const d = detail ?? {};
  return {
    mobile:         d.mobile         ?? entry.mobile          ?? '',
    visitType:      (d.visitType     ?? entry.visitType       ?? 'individual').toLowerCase(),
    fullName:       d.name           ?? entry.name            ?? '',
    email:          d.email          ?? '',
    govtIdType:     d.govtIdType     ?? '',
    govtIdNumber:   d.govtIdNumber   ?? '',
    personToMeet:   d.personToMeetId ?? d.personToMeet        ?? entry.personToMeet ?? '',
    hostDepartment: d.hostDepartment ?? '',
    reasonForVisit: d.reasonForVisit ?? '',
    cardNumber:     d.card           != null ? String(d.card)           : (entry.card != null ? String(entry.card) : ''),
    leadCardNumber: d.leadCardNumber != null ? String(d.leadCardNumber) : '',
    members: (d.members ?? entry.members ?? []).map((m) => ({
      id:   m.id   ?? Date.now() + Math.random(),
      name: m.name ?? '',
      card: m.card != null ? String(m.card) : '',
    })),
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EditVisitorModal({ entry, onClose, onSuccess }) {
  const [form,        setFormState]   = useState(() => buildForm(entry, null));
  const [persons,     setPersons]     = useState([]);
  const [departments, setDepartments] = useState([]);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState('');

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // ── Load dropdowns + silently try full detail ─────────────────────────────
  useEffect(() => {
    Promise.all([getPersonsToMeet(), getDepartments()])
      .then(([pers, depts]) => { setPersons(pers); setDepartments(depts); })
      .catch(() => {});

    getEntryDetail(entry.id)
      .then((detail) => setFormState(buildForm(entry, detail)))
      .catch(() => {});
  }, [entry.id]);

  // ── Escape key ────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  // ── Form helpers ──────────────────────────────────────────────────────────
  const setField = (field, value) => setFormState((f) => ({ ...f, [field]: value }));

  function handlePersonToMeet(personId) {
    setFormState((f) => {
      const person = persons.find((p) => p.id === personId);
      const dept   = person ? departments.find((d) => d.name === person.department) : null;
      return { ...f, personToMeet: personId, hostDepartment: dept ? dept.id : f.hostDepartment };
    });
  }

  const addMember    = () => setField('members', [...form.members, { id: Date.now(), name: '', card: '' }]);
  const removeMember = (id) => setField('members', form.members.filter((m) => m.id !== id));
  const updateMember = (id, field, val) =>
    setField('members', form.members.map((m) => (m.id === id ? { ...m, [field]: val } : m)));

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const isGroup = form.visitType === 'group';
      const payload = {
        mobile:         form.mobile,
        visitType:      form.visitType,
        fullName:       form.fullName,
        email:          form.email,
        govtIdType:     form.govtIdType,
        govtIdNumber:   form.govtIdNumber,
        personToMeet:   form.personToMeet,
        hostDepartment: form.hostDepartment,
        reasonForVisit: form.reasonForVisit,
        ...(isGroup
          ? { leadCardNumber: form.leadCardNumber, cardNumber: form.cardNumber, members: form.members }
          : { cardNumber: form.cardNumber }),
      };
      const result = await updateVisitorEntry(entry.id, payload);
      if (result.success) { onSuccess?.(result); onClose(); }
    } catch {
      setSubmitError('Failed to save changes. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const canSave = form.fullName.trim() !== ''
               && form.personToMeet !== ''
               && AADHAAR_REGEX.test(form.govtIdNumber);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="avm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evm-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="avm-dialog evm-dialog">

        {/* Header */}
        <div className="avm-header">
          <div>
            <h2 className="avm-title" id="evm-title">Edit Visitor Entry</h2>
            <p className="avm-subtitle">
              Editing <strong>{entry.id}</strong> — update the fields and save.
            </p>
          </div>
          <button className="avm-close" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>

        {/* Scrollable body — all fields, no steps */}
        <div className="avm-body">
          <div className="avm-step">

            {/* Visit type */}
            <Field label="Visit Type" required>
              <div className="avm-radio-group">
                {['individual', 'group'].map((t) => (
                  <label key={t} className={`avm-radio${form.visitType === t ? ' avm-radio--active' : ''}`}>
                    <input
                      type="radio" name="evm-visitType" value={t}
                      checked={form.visitType === t}
                      onChange={() => setField('visitType', t)}
                    />
                    <span>{t === 'individual' ? 'Individual' : 'Group'}</span>
                  </label>
                ))}
              </div>
            </Field>

            {/* Full name */}
            <Field label="Full Name" required>
              <InputWithIcon
                icon={<IconUser size={14} />}
                type="text"
                placeholder="John Doe"
                value={form.fullName}
                onChange={(e) => setField('fullName', e.target.value)}
              />
            </Field>

            {/* Mobile — read-only */}
            <Field label="Mobile Number" hint="Already verified — cannot be changed.">
              <InputWithIcon
                icon={<IconPhone size={14} />}
                type="tel"
                value={form.mobile}
                disabled
              />
            </Field>

            {/* Email */}
            <Field label="Email (Optional)">
              <InputWithIcon
                icon={<IconMail size={14} />}
                type="email"
                placeholder="john.doe@example.com"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
              />
            </Field>

            {/* Aadhaar Number */}
            <Field
              label="Aadhaar Number"
              required
              error={form.govtIdNumber && !AADHAAR_REGEX.test(form.govtIdNumber) ? 'Aadhaar number must be exactly 12 digits' : null}
            >
              <InputWithIcon
                icon={<IconCreditCard size={14} />}
                type="text"
                inputMode="numeric"
                placeholder="12-digit Aadhaar number"
                value={form.govtIdNumber}
                maxLength={12}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                  setField('govtIdNumber', val);
                  setField('govtIdType', val ? 'AADHAAR' : '');
                }}
              />
            </Field>

            {/* Person to meet */}
            <Field label="Person To Meet" required>
              <SelectField
                placeholder="Select a person…"
                value={form.personToMeet}
                onChange={handlePersonToMeet}
                options={persons.map((p) => ({ id: p.id, name: `${p.name} — ${p.department}` }))}
              />
            </Field>

            {/* Host department */}
            <Field label="Host Department">
              <SelectField
                icon={<IconBuilding size={14} />}
                placeholder="Select a department"
                value={form.hostDepartment}
                onChange={(v) => setField('hostDepartment', v)}
                options={departments}
              />
            </Field>

            {/* Reason */}
            <Field label="Reason for Visit">
              <textarea
                className="avm-textarea"
                placeholder="e.g. Scheduled meeting"
                rows={3}
                value={form.reasonForVisit}
                onChange={(e) => setField('reasonForVisit', e.target.value)}
              />
            </Field>

            {/* Card number */}
            <Field label={form.visitType === 'group' ? 'Lead Card Number' : 'Visitor Card Number'}>
              <InputWithIcon
                icon={<IconCreditCard size={14} />}
                type="text"
                placeholder="e.g. 123"
                value={form.visitType === 'group' ? form.leadCardNumber : form.cardNumber}
                onChange={(e) =>
                  setField(form.visitType === 'group' ? 'leadCardNumber' : 'cardNumber', e.target.value)
                }
              />
            </Field>

            {/* Group members */}
            {form.visitType === 'group' && (
              <div className="avm-members">
                <div className="avm-members__header">
                  <span className="avm-members__title"><IconUsers size={14} />Sub-Visitors</span>
                  <button className="avm-members__add-btn" onClick={addMember}>
                    <IconPlus size={12} />Add Member
                  </button>
                </div>
                {form.members.length === 0 ? (
                  <p className="avm-members__empty">No sub-visitors yet.</p>
                ) : (
                  <>
                    <div className="avm-members__cols">
                      <span>Name</span><span>Card #</span><span />
                    </div>
                    {form.members.map((m) => (
                      <div key={m.id} className="avm-members__row">
                        <input className="avm-input" type="text" placeholder="Guest name"
                          value={m.name} onChange={(e) => updateMember(m.id, 'name', e.target.value)} />
                        <input className="avm-input" type="text" placeholder="Card #"
                          value={m.card} onChange={(e) => updateMember(m.id, 'card', e.target.value)} />
                        <button className="avm-members__del-btn" onClick={() => removeMember(m.id)}
                          aria-label="Remove"><IconTrash size={13} /></button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="avm-footer">
          <button className="avm-btn avm-btn--back" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <div className="avm-footer__spacer" />
          {submitError && <p className="avm-error avm-error--footer">{submitError}</p>}
          <button
            className="avm-btn avm-btn--submit"
            onClick={handleSubmit}
            disabled={!canSave || submitting}
          >
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

      </div>
    </div>
  );
}
