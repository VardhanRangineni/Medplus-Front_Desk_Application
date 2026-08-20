/**
 * EditEmployeeModal — single-page form to edit an existing employee entry.
 *
 * No steps, no photo. Just a scrollable form pre-filled with the entry data.
 * Employee chip is read-only; visit details are editable.
 *
 * Shares the avm-* / aem-* CSS design language with the Add modals.
 * Pre-fills immediately from `entry`; silently enriches from getEntryDetail.
 */

import { useState, useEffect, useRef } from 'react';
import '../AddVisitorModal/AddVisitorModal.css';
import '../AddEmployeeModal/AddEmployeeModal.css';
import './EditEmployeeModal.css';
import {
  IconX,
  IconIdCard,
} from '../../../components/Icons/Icons';
import { getEntryDetail } from '../checkInOutService';
import { updateEmployeeEntry } from '../AddEmployeeModal/addEmployeeService';
import PersonToMeetMobileLookup from '../PersonToMeetMobileLookup';
import { PRESET_REASONS } from '../../../constants/visitReasons';

// ─── Shared primitives ────────────────────────────────────────────────────────

function Field({ label, required, children }) {
  return (
    <div className="avm-field">
      {label && (
        <label className="avm-label">
          {label}
          {required && <span className="avm-label__req">*</span>}
        </label>
      )}
      {children}
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
  const d       = detail ?? {};
  const ptmId   = d.personToMeetId ?? entry.personToMeetId ?? '';
  return {
    personToMeet:       ptmId === '__OTHER__' ? '' : ptmId,
    personToMeetCustom: '',
    hostDepartment:     d.hostDepartment ?? entry.hostDepartment ?? '',
    reasonForVisit:     d.reasonForVisit ?? entry.reasonForVisit ?? '',
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EditEmployeeModal({ entry, onClose, onSuccess }) {
  const [form,        setFormState]   = useState(() => buildForm(entry, null));
  const [employee,    setEmployee]    = useState({
    name:       entry.name  ?? '',
    empId:      entry.empId ?? '',
    mobile:     entry.mobile ?? '',
    department: '',
  });
  const [existingPtmLabel, setExistingPtmLabel] = useState('');
  const [submitting,       setSubmitting]       = useState(false);
  const [submitError,      setSubmitError]      = useState('');

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // ── Silently enrich from full detail ──────────────────────────────────────
  useEffect(() => {
    getEntryDetail(entry.id)
      .then((detail) => {
        setEmployee({
          name:       detail.name       ?? entry.name  ?? '',
          empId:      detail.empId      ?? entry.empId ?? '',
          mobile:     detail.mobile     ?? entry.mobile ?? '',
          department: detail.hostDepartment ?? detail.department ?? '',
        });
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
        type:               'EMPLOYEE',
        empId:              employee.empId,
        name:               employee.name,
        mobile:             employee.mobile || null,
        personToMeet:       form.personToMeet,
        personToMeetCustom: form.personToMeetCustom,
        hostDepartment:     form.hostDepartment,
        reasonForVisit:     form.reasonForVisit,
      };
      const result = await updateEmployeeEntry(entry.id, payload);
      if (result.success) { onSuccess?.(result); onClose(); }
    } catch {
      setSubmitError('Failed to save changes. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const canSave = form.personToMeet.trim() !== ''
               && form.reasonForVisit.trim() !== '';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="avm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="eem-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="avm-dialog eem-dialog">

        {/* Header */}
        <div className="avm-header">
          <div>
            <h2 className="avm-title" id="eem-title">Edit Employee Entry</h2>
          </div>
          <button className="avm-close" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>

        {/* Scrollable body — all fields, no steps */}
        <div className="avm-body">
          <div className="avm-step">

            {/* Employee read-only chip */}
            <div className="aem-emp-summary">
              <div className="aem-emp-summary__icon"><IconIdCard size={16} /></div>
              <div>
                <p className="aem-emp-summary__name">{employee.name}</p>
                <p className="aem-emp-summary__meta">
                  {employee.empId}
                  {employee.department && <>&nbsp;·&nbsp;{employee.department}</>}
                </p>
              </div>
            </div>

            <PersonToMeetMobileLookup
              personToMeet={form.personToMeet}
              personToMeetCustom={form.personToMeetCustom}
              onChange={handlePersonToMeetBulk}
              existingPersonLabel={existingPtmLabel}
            />

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
                placeholder="e.g. Project meeting"
                rows={3}
                value={form.reasonForVisit}
                onChange={(e) => setField('reasonForVisit', e.target.value)}
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
