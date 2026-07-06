/**
 * AddEmployeeModal — employee check-in flow.
 */

import { useState, useEffect, useRef } from 'react';
import '../AddVisitorModal/AddVisitorModal.css';
import './AddEmployeeModal.css';
import {
  IconX,
  IconIdCard,
  IconUser,
} from '../../../components/Icons/Icons';
import {
  lookupHrmsEmployee,
  createEmployeeEntry,
} from './addEmployeeService';
import PersonToMeetMobileLookup from '../PersonToMeetMobileLookup';
import { PRESET_REASONS } from '../../../constants/visitReasons';

const HRMS_LOOKUP_DEBOUNCE = 600;
const HRMS_MIN_ID_LENGTH = 6;

function Field({ label, required, children }) {
  return (
    <div className="avm-field">
      {label && (
        <label className="avm-label">
          {label}
          {required && <span className="avm-label__req" aria-hidden="true">*</span>}
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

function Step1({
  lookupId, onLookupIdChange,
  employee, hrmsError, hrmsLoading,
  onResetEmployee,
  personToMeet,
  personToMeetCustom,
  onPersonToMeetBulkChange,
  reasonForVisit, setReasonForVisit,
}) {
  return (
    <div className="avm-step">

      <Field label="Employee ID or HRMS ID" required>
        <InputWithIcon
          icon={<IconIdCard size={14} />}
          type="text"
          placeholder="e.g. OTG06992 or MED1098233"
          value={lookupId}
          maxLength={32}
          disabled={employee !== null}
          onChange={(e) => onLookupIdChange(e.target.value)}
          autoComplete="off"
        />
        {hrmsError && <p className="avm-error">{hrmsError}</p>}
      </Field>

      {employee && (
        <div className="aem-emp-card">
          <div className="aem-emp-card__avatar">
            <IconUser size={20} />
          </div>
          <div className="aem-emp-card__info">
            <p className="aem-emp-card__name">{employee.name}</p>
            {employee.department && (
              <p className="aem-emp-card__meta">{employee.department}</p>
            )}
          </div>
          <button
            type="button"
            className="aem-emp-card__reset"
            onClick={onResetEmployee}
            title="Change employee"
          >
            ✕
          </button>
        </div>
      )}

      {employee && (
        <>
          <PersonToMeetMobileLookup
            personToMeet={personToMeet}
            personToMeetCustom={personToMeetCustom}
            onChange={onPersonToMeetBulkChange}
          />

          <Field label="Reason for Visit" required>
            <div className="avm-reason-chips">
              {PRESET_REASONS.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  className="avm-reason-chip"
                  onClick={() => setReasonForVisit(r.text)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <textarea
              className="avm-textarea"
              placeholder="e.g. Project meeting"
              rows={3}
              value={reasonForVisit}
              onChange={(e) => setReasonForVisit(e.target.value)}
            />
          </Field>
        </>
      )}
    </div>
  );
}

export default function AddEmployeeModal({ onClose, onBack, onSuccess }) {
  const [lookupId,           setLookupId]           = useState('');
  const [employee,           setEmployee]           = useState(null);
  const [hrmsLoading,        setHrmsLoading]        = useState(false);
  const [hrmsError,          setHrmsError]          = useState('');
  const hrmsLookupTimer = useRef(null);
  const [personToMeet,       setPersonToMeet]       = useState('');
  const [personToMeetCustom, setPersonToMeetCustom] = useState('');
  const [hostDepartment,     setHostDepartment]     = useState('');
  const [reasonForVisit,     setReasonForVisit]     = useState('');
  const [submitting,         setSubmitting]         = useState(false);
  const [submitError,        setSubmitError]        = useState('');

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => () => {
    clearTimeout(hrmsLookupTimer.current);
  }, []);

  function clearEmployeeFields() {
    setEmployee(null);
    setPersonToMeet('');
    setPersonToMeetCustom('');
    setHostDepartment('');
    setReasonForVisit('');
  }

  function applyHrmsResult(emp, typedId) {
    if (!emp?.name?.trim()) {
      setHrmsError('Employee not found in HRMS.');
      return;
    }
    setEmployee({
      id: emp.id?.trim() || typedId.trim(),
      hrmsId: emp.hrmsId?.trim() || '',
      name: emp.name.trim(),
      department: emp.department?.trim() || '',
    });
    setHrmsError('');
  }

  function triggerHrmsLookup(id) {
    clearTimeout(hrmsLookupTimer.current);
    setHrmsError('');
    if (employee || !id.trim() || id.trim().length < HRMS_MIN_ID_LENGTH) return;
    hrmsLookupTimer.current = setTimeout(async () => {
      setHrmsLoading(true);
      try {
        const emp = await lookupHrmsEmployee(id.trim());
        applyHrmsResult(emp, id);
      } catch (err) {
        setHrmsError(err?.message ?? 'HRMS lookup failed.');
      } finally {
        setHrmsLoading(false);
      }
    }, HRMS_LOOKUP_DEBOUNCE);
  }

  function handleLookupIdChange(val) {
    setLookupId(val);
    setHrmsError('');
    if (employee) clearEmployeeFields();
    triggerHrmsLookup(val);
  }

  function handleResetEmployee() {
    setLookupId('');
    setHrmsError('');
    clearEmployeeFields();
  }

  function handlePersonToMeetBulkChange(updates) {
    setPersonToMeet(updates.personToMeet ?? '');
    setPersonToMeetCustom(updates.personToMeetCustom ?? '');
    setHostDepartment(updates.hostDepartment ?? '');
  }

  const formValid = employee !== null
    && personToMeet.trim() !== ''
    && reasonForVisit.trim() !== '';

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await createEmployeeEntry({
        empId: employee?.id ?? lookupId,
        name: employee?.name ?? '',
        department: employee?.department ?? '',
        employeeDepartment: employee?.department ?? '',
        personToMeet,
        personToMeetCustom,
        hostDepartment,
        reasonForVisit,
      });
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

  return (
    <div
      className="avm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aem-title"
      onClick={handleOverlayClick}
    >
      <div className="avm-dialog">
        <div className="avm-header">
          <div>
            <h2 className="avm-title" id="aem-title">Add New Employee</h2>
          </div>
          <button className="avm-close" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>

        <div className="avm-body">
          <Step1
            lookupId={lookupId}
            onLookupIdChange={handleLookupIdChange}
            employee={employee}
            hrmsError={hrmsError}
            hrmsLoading={hrmsLoading}
            onResetEmployee={handleResetEmployee}
            personToMeet={personToMeet}
            personToMeetCustom={personToMeetCustom}
            onPersonToMeetBulkChange={handlePersonToMeetBulkChange}
            reasonForVisit={reasonForVisit}
            setReasonForVisit={setReasonForVisit}
          />
        </div>

        <div className="avm-footer">
          <button
            className="avm-btn avm-btn--back"
            onClick={onBack}
            disabled={submitting}
          >
            Back
          </button>

          <div className="avm-footer__spacer" />

          {submitError && <p className="avm-error avm-error--footer">{submitError}</p>}

          <button
            className="avm-btn avm-btn--submit"
            onClick={handleSubmit}
            disabled={!formValid || submitting || hrmsLoading}
          >
            {submitting ? 'Adding…' : 'Add and Check-in'}
          </button>
        </div>
      </div>
    </div>
  );
}
