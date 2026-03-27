import React, { useState, useEffect, useRef } from 'react';
import {
  getStaffMembers,
  getDepartments,
  getFormLocations,
  updateEntry,
} from '../../api/checkInApi';
import './EditEntryModal.css';

// ── Focus trap ─────────────────────────────────────────────────────────────────

function useFocusTrap(ref, isActive) {
  useEffect(() => {
    if (!isActive || !ref.current) return;
    const el        = ref.current;
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
  }, [ref, isActive]);
}

// ── Icons ──────────────────────────────────────────────────────────────────────

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconUser = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconMail = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);
const IconMapPin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);
const IconIdCard = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <line x1="16" y1="10" x2="18" y2="10"/><line x1="16" y1="14" x2="18" y2="14"/>
    <circle cx="9" cy="10" r="2"/>
    <path d="M6 14c0-1.1.9-2 2-2h2a2 2 0 0 1 2 2"/>
  </svg>
);
const IconCreditCard = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);
const IconBriefcase = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);
const IconPlus = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

// ── Constants ──────────────────────────────────────────────────────────────────

const GOVT_ID_TYPES = ['Aadhaar Card', 'PAN Card', 'Passport', 'Voter ID', 'Driving Licence'];

// ── EditEntryModal ─────────────────────────────────────────────────────────────

/**
 * EditEntryModal — editable form for an existing check-in entry.
 *
 * Props:
 *   entry    {object}   The current entry object from state.
 *   onClose  {function} Called when the user cancels or closes.
 *   onSave   {function} Called with the updated entry object on success.
 *
 * API integration:
 *   When the backend is ready, replace the mock in checkInApi.js:
 *     updateEntry(id, updates) → PATCH /api/checkins/:id
 *   The component itself needs no changes — it already calls updateEntry().
 */
const EditEntryModal = ({ entry, onClose, onSave }) => {
  const modalRef = useRef(null);
  useFocusTrap(modalRef, true);

  // ── Reference data ─────────────────────────────────────────────────────────
  const [staffMembers, setStaffMembers] = useState([]);
  const [departments,  setDepartments]  = useState([]);
  const [locations,    setLocations]    = useState([]);
  const [dataLoading,  setDataLoading]  = useState(true);

  // ── Form state (initialised from the entry) ────────────────────────────────
  const [form, setForm] = useState(() => ({
    fullName:      entry.name         ?? '',
    email:         entry.email        ?? '',
    govtIdType:    entry.govtIdType   ?? '',
    govtIdNumber:  entry.govtIdNumber ?? '',
    location:      entry.location     ?? '',
    personToMeet:  entry.personToMeet ?? '',
    hostDepartment: entry.department  ?? '',
    reasonForVisit: entry.purpose     ?? '',
    cardNumber:    entry.cards?.[0]?.toString() ?? '',
    visitType:     entry.visitType    ?? 'Individual',
    subVisitors:   entry.members?.map(m => ({
      name:       m.name       ?? '',
      cardNumber: m.cards?.[0]?.toString() ?? m.cardNumber ?? '',
    })) ?? [],
  }));

  const [errors,    setErrors]    = useState({});
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState('');

  // ── Load dropdowns ─────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([getStaffMembers(), getDepartments(), getFormLocations()])
      .then(([staff, depts, locs]) => {
        setStaffMembers(staff);
        setDepartments(depts);
        setLocations(locs);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  }, []);

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Field helpers ──────────────────────────────────────────────────────────
  const set = (field) => (e) => {
    const value = typeof e === 'string' ? e : e.target.value;
    setForm(f => ({ ...f, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.fullName.trim())       e.fullName     = 'Full name is required.';
    else if (form.fullName.trim().length < 2) e.fullName = 'Name must be at least 2 characters.';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'Enter a valid email address.';
    if (form.govtIdType && !form.govtIdNumber.trim())
      e.govtIdNumber = 'Please enter the ID number.';
    return e;
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    setSaveError('');
    try {
      // Construct the payload — only editable fields are sent.
      // TODO: when wiring to the backend, updateEntry() in checkInApi.js sends
      //       PATCH /api/checkins/:id with this payload.
      const updates = {
        name:          form.fullName.trim(),
        email:         form.email.trim()        || null,
        govtIdType:    form.govtIdType          || null,
        govtIdNumber:  form.govtIdNumber.trim() || null,
        location:      form.location            || null,
        personToMeet:  form.personToMeet        || null,
        department:    form.hostDepartment      || null,
        purpose:       form.reasonForVisit.trim() || null,
        cards:         form.cardNumber ? [Number(form.cardNumber)] : [],
        visitType:     form.visitType,
        members:       form.visitType === 'Group'
          ? form.subVisitors
              .filter(sv => sv.name.trim())
              .map((sv, i) => ({
                id:         entry.members?.[i]?.id ?? `sv-${Date.now()}-${i}`,
                name:       sv.name.trim(),
                cards:      sv.cardNumber ? [Number(sv.cardNumber)] : [],
                cardNumber: sv.cardNumber.trim() || null,
                status:     entry.members?.[i]?.status ?? 'Checked-in',
                type:       'Member',
              }))
          : [],
      };

      const updated = await updateEntry(entry.id, updates);
      onSave(updated);
    } catch (err) {
      setSaveError(err.message || 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="eem-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="eem-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="eem-title"
        ref={modalRef}
      >
        {/* Header */}
        <div className="eem-header">
          <div>
            <h2 id="eem-title">Edit Entry</h2>
            <p>Update details for {entry.name}.</p>
          </div>
          <button className="eem-close-btn" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="eem-body">

          {dataLoading ? (
            <div className="eem-loading">
              <div className="eem-spinner" />
              <span>Loading…</span>
            </div>
          ) : (
            <>
              {/* Visit Type */}
              {entry.type !== 'Employee' && (
                <div className="eem-field">
                  <label className="eem-label">Visit Type</label>
                  <div className="eem-radio-group" role="radiogroup" aria-label="Visit type">
                    {['Individual', 'Group'].map(type => (
                      <label key={type} className={`eem-radio${form.visitType === type ? ' selected' : ''}`}>
                        <input
                          type="radio"
                          name="eem-visitType"
                          value={type}
                          checked={form.visitType === type}
                          onChange={() => set('visitType')(type)}
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Name */}
              <div className="eem-field">
                <label className="eem-label" htmlFor="eem-name">
                  Full Name <span className="eem-req">*</span>
                </label>
                <div className="eem-input-wrap">
                  <span className="eem-icon"><IconUser /></span>
                  <input
                    id="eem-name"
                    className={`eem-input${errors.fullName ? ' error' : ''}`}
                    type="text"
                    placeholder="John Doe"
                    value={form.fullName}
                    onChange={set('fullName')}
                    autoComplete="off"
                  />
                </div>
                {errors.fullName && <span className="eem-field-error">{errors.fullName}</span>}
              </div>

              {/* Email */}
              <div className="eem-field">
                <label className="eem-label" htmlFor="eem-email">
                  Email <span className="eem-opt">(Optional)</span>
                </label>
                <div className="eem-input-wrap">
                  <span className="eem-icon"><IconMail /></span>
                  <input
                    id="eem-email"
                    className={`eem-input${errors.email ? ' error' : ''}`}
                    type="email"
                    inputMode="email"
                    placeholder="john.doe@example.com"
                    value={form.email}
                    onChange={set('email')}
                    autoComplete="email"
                  />
                </div>
                {errors.email && <span className="eem-field-error">{errors.email}</span>}
              </div>

              {/* Govt. ID */}
              {entry.type !== 'Employee' && (
                <div className="eem-field">
                  <label className="eem-label">
                    Verified Govt. ID <span className="eem-opt">(Optional)</span>
                  </label>
                  <div className="eem-select-wrap">
                    <span className="eem-icon"><IconIdCard /></span>
                    <select
                      className="eem-select"
                      value={form.govtIdType}
                      onChange={e => { set('govtIdType')(e); set('govtIdNumber')(''); }}
                    >
                      <option value="">Select ID Type</option>
                      {GOVT_ID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  {form.govtIdType && (
                    <div className="eem-input-wrap" style={{ marginTop: 8 }}>
                      <span className="eem-icon"><IconIdCard /></span>
                      <input
                        className={`eem-input${errors.govtIdNumber ? ' error' : ''}`}
                        type="text"
                        placeholder={`Enter ${form.govtIdType} number`}
                        value={form.govtIdNumber}
                        onChange={set('govtIdNumber')}
                        autoComplete="off"
                      />
                    </div>
                  )}
                  {errors.govtIdNumber && <span className="eem-field-error">{errors.govtIdNumber}</span>}
                </div>
              )}

              {/* Location */}
              <div className="eem-field">
                <label className="eem-label" htmlFor="eem-location">
                  Location <span className="eem-opt">(Optional)</span>
                </label>
                <div className="eem-select-wrap">
                  <span className="eem-icon"><IconMapPin /></span>
                  <select
                    id="eem-location"
                    className="eem-select"
                    value={form.location}
                    onChange={set('location')}
                  >
                    <option value="">Select a location</option>
                    {locations.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              {/* Person to Meet */}
              <div className="eem-field">
                <label className="eem-label" htmlFor="eem-person">
                  Person to Meet <span className="eem-opt">(Optional)</span>
                </label>
                <div className="eem-select-wrap">
                  <span className="eem-icon"><IconUser /></span>
                  <select
                    id="eem-person"
                    className="eem-select"
                    value={form.personToMeet}
                    onChange={e => {
                      set('personToMeet')(e);
                      const staff = staffMembers.find(s => s.name === e.target.value);
                      if (staff && !form.hostDepartment)
                        setForm(f => ({ ...f, hostDepartment: staff.department }));
                    }}
                  >
                    <option value="">Select a person…</option>
                    {staffMembers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Host Department */}
              <div className="eem-field">
                <label className="eem-label" htmlFor="eem-dept">
                  Host Department <span className="eem-opt">(Optional)</span>
                </label>
                <div className="eem-select-wrap">
                  <span className="eem-icon"><IconBriefcase /></span>
                  <select
                    id="eem-dept"
                    className="eem-select"
                    value={form.hostDepartment}
                    onChange={set('hostDepartment')}
                  >
                    <option value="">Select a department</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              {/* Reason for Visit */}
              {entry.type !== 'Employee' && (
                <div className="eem-field">
                  <label className="eem-label" htmlFor="eem-reason">
                    Reason for Visit <span className="eem-opt">(Optional)</span>
                  </label>
                  <textarea
                    id="eem-reason"
                    className="eem-textarea"
                    placeholder="e.g. Scheduled meeting"
                    rows={3}
                    value={form.reasonForVisit}
                    onChange={set('reasonForVisit')}
                  />
                </div>
              )}

              {/* Card Number */}
              <div className="eem-field">
                <label className="eem-label" htmlFor="eem-card">
                  {form.visitType === 'Group' ? 'Lead Card Number' : 'Card Number'}{' '}
                  <span className="eem-opt">(Optional)</span>
                </label>
                <div className="eem-input-wrap">
                  <span className="eem-icon"><IconCreditCard /></span>
                  <input
                    id="eem-card"
                    className="eem-input"
                    type="text"
                    placeholder="e.g. 123"
                    value={form.cardNumber}
                    onChange={set('cardNumber')}
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Sub-Visitors — Group only */}
              {form.visitType === 'Group' && (
                <div className="eem-field">
                  <div className="eem-subvisitors-header">
                    <span className="eem-label" style={{ marginBottom: 0 }}>Sub-Visitors</span>
                    <button
                      type="button"
                      className="eem-subvisitors-add-btn"
                      onClick={() =>
                        setForm(f => ({
                          ...f,
                          subVisitors: [...f.subVisitors, { name: '', cardNumber: '' }],
                        }))
                      }
                    >
                      <IconPlus /> Add Member
                    </button>
                  </div>

                  {form.subVisitors.length > 0 && (
                    <div className="eem-subvisitors-list">
                      <div className="eem-subvisitors-list-header">
                        <span>Name</span>
                        <span>Card #</span>
                        <span />
                      </div>
                      {form.subVisitors.map((sv, idx) => (
                        <div key={idx} className="eem-subvisitors-row">
                          <input
                            className="eem-input eem-subvisitor-input"
                            type="text"
                            placeholder="Guest name"
                            value={sv.name}
                            onChange={e => {
                              const updated = form.subVisitors.map((s, i) =>
                                i === idx ? { ...s, name: e.target.value } : s,
                              );
                              setForm(f => ({ ...f, subVisitors: updated }));
                            }}
                            autoComplete="off"
                            aria-label={`Sub-visitor ${idx + 1} name`}
                          />
                          <input
                            className="eem-input eem-subvisitor-input"
                            type="text"
                            placeholder="Card #"
                            value={sv.cardNumber}
                            onChange={e => {
                              const updated = form.subVisitors.map((s, i) =>
                                i === idx ? { ...s, cardNumber: e.target.value } : s,
                              );
                              setForm(f => ({ ...f, subVisitors: updated }));
                            }}
                            autoComplete="off"
                            aria-label={`Sub-visitor ${idx + 1} card number`}
                          />
                          <button
                            type="button"
                            className="eem-subvisitor-delete"
                            onClick={() =>
                              setForm(f => ({
                                ...f,
                                subVisitors: f.subVisitors.filter((_, i) => i !== idx),
                              }))
                            }
                            aria-label={`Remove sub-visitor ${idx + 1}`}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {saveError && <p className="eem-save-error">{saveError}</p>}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="eem-footer">
          <button className="eem-btn-cancel" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="eem-btn-save" onClick={handleSave} disabled={saving || dataLoading}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditEntryModal;
