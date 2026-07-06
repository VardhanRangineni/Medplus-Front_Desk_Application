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
import '../AddVisitorModal/AddVisitorModal.css';
import './EditVisitorModal.css';
import {
  IconX,
  IconUser,
  IconPhone,
  IconMail,
  IconCreditCard,
  IconBuilding,
} from '../../../components/Icons/Icons';
import { getEntryDetail } from '../checkInOutService';
import { updateVisitorEntry } from '../AddVisitorModal/addVisitorService';
import PersonToMeetMobileLookup from '../PersonToMeetMobileLookup';
import { PRESET_REASONS } from '../../../constants/visitReasons';

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

// ─── Build form from entry + optional detail ──────────────────────────────────

function buildForm(entry, detail) {
  const d          = detail ?? {};
  const ptmId      = d.personToMeetId ?? entry.personToMeetId ?? '';
  const company    = d.companyName ?? entry.companyName ?? '';
  return {
    mobile:             d.mobile         ?? entry.mobile ?? '',
    fullName:           d.name           ?? entry.name   ?? '',
    email:              d.email          ?? '',
    govtIdType:         d.govtIdType     ?? '',
    govtIdNumber:       d.govtIdNumber   ?? '',
    personToMeet:       ptmId === '__OTHER__' ? '' : ptmId,
    personToMeetCustom: '',
    hostDepartment:     d.hostDepartment ?? entry.hostDepartment ?? '',
    reasonForVisit:     d.reasonForVisit ?? entry.reasonForVisit ?? '',
    cardNumber:         d.card != null ? String(d.card) : (entry.card != null ? String(entry.card) : ''),
    representsCompany:  !!company,
    companyName:        company,
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EditVisitorModal({ entry, onClose, onSuccess }) {
  const [form,            setFormState]       = useState(() => buildForm(entry, null));
  const [existingPtmLabel, setExistingPtmLabel] = useState('');
  const [submitting,      setSubmitting]      = useState(false);
  const [submitError,     setSubmitError]     = useState('');

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // ── Silently enrich from full detail ──────────────────────────────────────
  useEffect(() => {
    getEntryDetail(entry.id)
      .then((detail) => {
        setFormState(buildForm(entry, detail));
        setExistingPtmLabel(detail.personToMeet ?? entry.personToMeet ?? '');
      })
      .catch(() => {
        setExistingPtmLabel(entry.personToMeet ?? '');
      });
  }, [entry.id]);

  // ── Escape key ────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  // ── Form helpers ──────────────────────────────────────────────────────────
  const setField = (field, value) => setFormState((f) => ({ ...f, [field]: value }));

  function handlePersonToMeetBulk(updates) {
    setFormState((f) => ({ ...f, ...updates }));
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        mobile:             form.mobile,
        fullName:           form.fullName,
        email:              form.email,
        govtIdType:         form.govtIdType,
        govtIdNumber:       form.govtIdNumber,
        personToMeet:       form.personToMeet,
        personToMeetCustom: form.personToMeetCustom,
        hostDepartment:     form.hostDepartment,
        reasonForVisit:     form.reasonForVisit,
        cardNumber:         form.cardNumber,
        companyName:        form.representsCompany ? form.companyName.trim() : '',
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
               && form.personToMeet.trim() !== ''
               && form.reasonForVisit.trim() !== ''
               && (form.govtIdNumber === '' || AADHAAR_REGEX.test(form.govtIdNumber));

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

            <PersonToMeetMobileLookup
              personToMeet={form.personToMeet}
              personToMeetCustom={form.personToMeetCustom}
              onChange={handlePersonToMeetBulk}
              existingPersonLabel={existingPtmLabel}
            />

            {/* Company representation */}
            <Field label="Representing a Company?">
              <div className="avm-toggle-row">
                <label className="avm-toggle-label">
                  {form.representsCompany ? 'Yes — enter company name below' : 'No'}
                </label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.representsCompany}
                  className={`avm-toggle-switch${form.representsCompany ? ' avm-toggle-switch--on' : ''}`}
                  onClick={() => setField('representsCompany', !form.representsCompany)}
                >
                  <span className="avm-toggle-switch__thumb" />
                </button>
              </div>
              {form.representsCompany && (
                <div style={{ marginTop: 8 }}>
                  <InputWithIcon
                    icon={<IconBuilding size={14} />}
                    type="text"
                    placeholder="Enter company / organisation name"
                    value={form.companyName}
                    onChange={(e) => setField('companyName', e.target.value)}
                  />
                </div>
              )}
            </Field>

            {/* Reason */}
            <Field label="Reason for Visit" required>
              <div className="avm-reason-chips">
                {PRESET_REASONS.map((r) => (
                  <button
                    key={r.label}
                    type="button"
                    className="avm-reason-chip"
                    onClick={() => setField('reasonForVisit', r.text)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <textarea
                className="avm-textarea"
                placeholder="e.g. Scheduled meeting"
                rows={3}
                value={form.reasonForVisit}
                onChange={(e) => setField('reasonForVisit', e.target.value)}
              />
            </Field>

            {/* Card number */}
            <Field label="Visitor Card Number">
              <InputWithIcon
                icon={<IconCreditCard size={14} />}
                type="text"
                placeholder="e.g. 123"
                value={form.cardNumber}
                onChange={(e) => setField('cardNumber', e.target.value)}
              />
            </Field>

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
