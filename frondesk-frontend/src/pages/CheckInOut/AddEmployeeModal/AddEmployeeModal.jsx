/**
 * AddEmployeeModal — employee check-in flow (individual + group).
 */

import { useState, useEffect, useRef } from 'react';
import '../AddVisitorModal/AddVisitorModal.css';
import './AddEmployeeModal.css';
import {
  IconX,
  IconIdCard,
  IconUser,
  IconPlus,
  IconTrash,
} from '../../../components/Icons/Icons';
import {
  lookupHrmsEmployee,
  createEmployeeEntry,
  createGroupEmployeeEntries,
} from './addEmployeeService';
import PersonToMeetMobileLookup from '../PersonToMeetMobileLookup';
import { PRESET_REASONS } from '../../../constants/visitReasons';
import {
  HRMS_MIN_ID_LENGTH,
  LOOKUP_DEBOUNCE_MS,
  cancelDebouncedLookup,
  isLookupStale,
  scheduleDebouncedLookup,
} from '../../../utils/lookupDebounce';

const HRMS_LOOKUP_DEBOUNCE = LOOKUP_DEBOUNCE_MS;

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

function VisitModeToggle({ isGroup, onChange, disabled }) {
  return (
    <div className="avm-mode-toggle">
      <div className="avm-mode-seg" role="group" aria-label="Visit type">
        <button
          type="button"
          className={`avm-mode-seg__btn${!isGroup ? ' avm-mode-seg__btn--active' : ''}`}
          aria-pressed={!isGroup}
          disabled={disabled}
          onClick={() => onChange(false)}
        >
          Individual
        </button>
        <button
          type="button"
          className={`avm-mode-seg__btn${isGroup ? ' avm-mode-seg__btn--active' : ''}`}
          aria-pressed={isGroup}
          disabled={disabled}
          onClick={() => onChange(true)}
        >
          Group Visit
        </button>
      </div>
      <p className="avm-mode-toggle__hint">
        {isGroup
          ? 'Add multiple employees by Emp ID. Shared host and reason apply to all.'
          : 'Single employee check-in via HRMS Emp ID.'}
      </p>
    </div>
  );
}

function SharedHostReason({
  personToMeet, personToMeetCustom, onPersonToMeetBulkChange,
  reasonForVisit, setReasonForVisit,
}) {
  return (
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
  );
}

function EmployeeCard({ employee, onReset }) {
  if (!employee) return null;
  return (
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
        onClick={onReset}
        title="Change employee"
      >
        ✕
      </button>
    </div>
  );
}

let memberKeySeq = 1;
function newEmpMember() {
  return {
    key: `e-${memberKeySeq++}`,
    lookupId: '',
    employee: null,
    hrmsError: '',
    hrmsLoading: false,
  };
}

export default function AddEmployeeModal({ onClose, onBack, onSuccess }) {
  const [isGroup, setIsGroup] = useState(false);
  const [step, setStep] = useState(0);

  const [lookupId, setLookupId] = useState('');
  const [employee, setEmployee] = useState(null);
  const [hrmsLoading, setHrmsLoading] = useState(false);
  const [hrmsError, setHrmsError] = useState('');
  const hrmsLookupTimer = useRef(null);
  const hrmsLookupGen = useRef(0);

  const [members, setMembers] = useState([newEmpMember()]);
  const memberTimers = useRef({});
  const memberGens = useRef({});

  const [personToMeet, setPersonToMeet] = useState('');
  const [personToMeetCustom, setPersonToMeetCustom] = useState('');
  const [hostDepartment, setHostDepartment] = useState('');
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => () => {
    cancelDebouncedLookup(hrmsLookupGen, hrmsLookupTimer);
    Object.keys(memberTimers.current).forEach((key) => {
      const genRef = memberGens.current[key];
      const timerRef = memberTimers.current[key];
      if (genRef && timerRef) cancelDebouncedLookup(genRef, timerRef);
    });
  }, []);

  function clearSharedFields() {
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
      phone: (emp.phone || emp.workPhoneNo || emp.personalPhoneNo || '').replace(/\D/g, ''),
    });
    setHrmsError('');
  }

  function triggerHrmsLookup(id) {
    setHrmsError('');
    const trimmed = id.trim();
    if (!trimmed || trimmed.length < HRMS_MIN_ID_LENGTH) {
      cancelDebouncedLookup(hrmsLookupGen, hrmsLookupTimer);
      return;
    }

    const generation = scheduleDebouncedLookup(hrmsLookupGen, hrmsLookupTimer, async () => {
      setHrmsLoading(true);
      try {
        const emp = await lookupHrmsEmployee(trimmed);
        if (isLookupStale(generation, hrmsLookupGen)) return;
        applyHrmsResult(emp, id);
      } catch (err) {
        if (isLookupStale(generation, hrmsLookupGen)) return;
        setHrmsError(err?.message ?? 'HRMS lookup failed.');
      } finally {
        if (!isLookupStale(generation, hrmsLookupGen)) setHrmsLoading(false);
      }
    }, HRMS_LOOKUP_DEBOUNCE);
  }

  function handleLookupIdChange(val) {
    setLookupId(val);
    setHrmsError('');
    if (employee) {
      setEmployee(null);
      clearSharedFields();
    }
    triggerHrmsLookup(val);
  }

  function handleResetEmployee() {
    cancelDebouncedLookup(hrmsLookupGen, hrmsLookupTimer);
    setLookupId('');
    setHrmsError('');
    setHrmsLoading(false);
    setEmployee(null);
    clearSharedFields();
  }

  function ensureMemberRefs(key) {
    if (!memberGens.current[key]) memberGens.current[key] = { current: 0 };
    if (!memberTimers.current[key]) memberTimers.current[key] = { current: null };
  }

  function updateMember(key, patch) {
    setMembers((list) => list.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  }

  function triggerMemberHrmsLookup(key, id) {
    ensureMemberRefs(key);
    const genRef = memberGens.current[key];
    const timerRef = memberTimers.current[key];
    const trimmed = id.trim();
    if (!trimmed || trimmed.length < HRMS_MIN_ID_LENGTH) {
      cancelDebouncedLookup(genRef, timerRef);
      return;
    }

    const generation = scheduleDebouncedLookup(genRef, timerRef, async () => {
      updateMember(key, { hrmsLoading: true, hrmsError: '' });
      try {
        const emp = await lookupHrmsEmployee(trimmed);
        if (isLookupStale(generation, genRef)) return;
        if (!emp?.name?.trim()) {
          updateMember(key, {
            employee: null,
            hrmsError: 'Employee not found in HRMS.',
            hrmsLoading: false,
          });
          return;
        }
        updateMember(key, {
          employee: {
            id: emp.id?.trim() || trimmed,
            hrmsId: emp.hrmsId?.trim() || '',
            name: emp.name.trim(),
            department: emp.department?.trim() || '',
            phone: (emp.phone || emp.workPhoneNo || emp.personalPhoneNo || '').replace(/\D/g, ''),
          },
          hrmsError: '',
          hrmsLoading: false,
        });
      } catch (err) {
        if (isLookupStale(generation, genRef)) return;
        updateMember(key, {
          employee: null,
          hrmsError: err?.message ?? 'HRMS lookup failed.',
          hrmsLoading: false,
        });
      }
    }, HRMS_LOOKUP_DEBOUNCE);
  }

  function handleMemberLookupChange(key, val) {
    updateMember(key, { lookupId: val, employee: null, hrmsError: '' });
    triggerMemberHrmsLookup(key, val);
  }

  function handleResetMember(key) {
    ensureMemberRefs(key);
    cancelDebouncedLookup(memberGens.current[key], memberTimers.current[key]);
    updateMember(key, {
      lookupId: '',
      employee: null,
      hrmsError: '',
      hrmsLoading: false,
    });
  }

  function handleRemoveMember(key) {
    ensureMemberRefs(key);
    cancelDebouncedLookup(memberGens.current[key], memberTimers.current[key]);
    delete memberGens.current[key];
    delete memberTimers.current[key];
    setMembers((list) => list.filter((m) => m.key !== key));
  }

  function handleModeChange(nextIsGroup) {
    if (nextIsGroup === isGroup) return;
    setIsGroup(nextIsGroup);
    setStep(0);
    setSubmitError('');
    handleResetEmployee();
    setMembers([newEmpMember()]);
    clearSharedFields();
  }

  function handlePersonToMeetBulkChange(updates) {
    setPersonToMeet(updates.personToMeet ?? '');
    setPersonToMeetCustom(updates.personToMeetCustom ?? '');
    setHostDepartment(updates.hostDepartment ?? '');
  }

  const individualValid = employee !== null
    && personToMeet.trim() !== ''
    && reasonForVisit.trim() !== '';

  const groupMembersValid = members.length >= 1
    && members.every((m) => m.employee != null);

  const groupDetailsValid = personToMeet.trim() !== ''
    && reasonForVisit.trim() !== '';

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      if (isGroup) {
        const result = await createGroupEmployeeEntries({
          personToMeet,
          personToMeetCustom,
          hostDepartment,
          reasonForVisit,
          members: members.map((m) => ({
            empId: m.employee.id,
            name: m.employee.name,
            mobile: m.employee.phone || null,
          })),
        });
        if (result.success) {
          onSuccess?.(result);
          onClose();
        }
      } else {
        const result = await createEmployeeEntry({
          visitType: 'INDIVIDUAL',
          empId: employee?.id ?? lookupId,
          name: employee?.name ?? '',
          mobile: employee?.phone || null,
          personToMeet,
          personToMeetCustom,
          hostDepartment,
          reasonForVisit,
        });
        if (result.success) {
          onSuccess?.(result);
          onClose();
        }
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

  const anyMemberLoading = members.some((m) => m.hrmsLoading);

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
            <h2 className="avm-title" id="aem-title">
              {isGroup ? 'Add Group Employees' : 'Add New Employee'}
            </h2>
          </div>
          <button className="avm-close" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>

        <div className="avm-body-top">
          <VisitModeToggle
            isGroup={isGroup}
            onChange={handleModeChange}
            disabled={submitting || (isGroup && step > 0)}
          />
        </div>

        {isGroup && (
          <div className="avm-progress" aria-hidden="true">
            <div
              className="avm-progress__fill"
              style={{ width: `${((step + 1) / 2) * 100}%` }}
            />
          </div>
        )}

        <div className="avm-body">
          {!isGroup && (
            <div className="avm-step">
              <Field label="Employee ID or HRMS ID" required>
                <InputWithIcon
                  icon={<IconIdCard size={14} />}
                  type="text"
                  placeholder="e.g. OTG06992 or MED1098233"
                  value={lookupId}
                  maxLength={32}
                  disabled={employee !== null}
                  onChange={(e) => handleLookupIdChange(e.target.value)}
                  autoComplete="off"
                />
                {hrmsError && <p className="avm-error">{hrmsError}</p>}
              </Field>

              <EmployeeCard employee={employee} onReset={handleResetEmployee} />

              {employee && (
                <SharedHostReason
                  personToMeet={personToMeet}
                  personToMeetCustom={personToMeetCustom}
                  onPersonToMeetBulkChange={handlePersonToMeetBulkChange}
                  reasonForVisit={reasonForVisit}
                  setReasonForVisit={setReasonForVisit}
                />
              )}
            </div>
          )}

          {isGroup && step === 0 && (
            <div className="avm-step">
              <div className="avm-member-list">
                {members.map((m, idx) => (
                  <div key={m.key} className="avm-member-card">
                    <div className="avm-member-card__head">
                      <span className="avm-member-card__title">Employee {idx + 1}</span>
                      {members.length > 1 && (
                        <button
                          type="button"
                          className="avm-member-card__remove"
                          onClick={() => handleRemoveMember(m.key)}
                          aria-label={`Remove employee ${idx + 1}`}
                          title="Remove"
                        >
                          <IconTrash size={14} />
                        </button>
                      )}
                    </div>
                    <Field label="Employee ID or HRMS ID" required>
                      <InputWithIcon
                        icon={<IconIdCard size={14} />}
                        type="text"
                        placeholder="e.g. OTG06992 or MED1098233"
                        value={m.lookupId}
                        maxLength={32}
                        disabled={m.employee !== null}
                        onChange={(e) => handleMemberLookupChange(m.key, e.target.value)}
                        autoComplete="off"
                      />
                      {m.hrmsError && <p className="avm-error">{m.hrmsError}</p>}
                    </Field>
                    <EmployeeCard
                      employee={m.employee}
                      onReset={() => handleResetMember(m.key)}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className="avm-add-member"
                  onClick={() => setMembers((list) => [...list, newEmpMember()])}
                >
                  <IconPlus size={14} />
                  Add employee
                </button>
              </div>
            </div>
          )}

          {isGroup && step === 1 && (
            <div className="avm-step">
              <div className="aem-group-summary">
                {members.filter((m) => m.employee).map((m) => (
                  <div key={m.key} className="aem-group-summary__chip">
                    {m.employee.name}
                    <span>{m.employee.id}</span>
                  </div>
                ))}
              </div>
              <SharedHostReason
                personToMeet={personToMeet}
                personToMeetCustom={personToMeetCustom}
                onPersonToMeetBulkChange={handlePersonToMeetBulkChange}
                reasonForVisit={reasonForVisit}
                setReasonForVisit={setReasonForVisit}
              />
            </div>
          )}
        </div>

        <div className="avm-footer">
          <button
            className="avm-btn avm-btn--back"
            onClick={() => {
              if (isGroup && step > 0) {
                setStep(0);
                setSubmitError('');
                return;
              }
              onBack?.();
            }}
            disabled={submitting}
          >
            {isGroup && step > 0 ? '← Back' : 'Back'}
          </button>

          <div className="avm-footer__spacer" />

          {submitError && <p className="avm-error avm-error--footer">{submitError}</p>}

          {isGroup && step === 0 && (
            <button
              className="avm-btn avm-btn--next"
              onClick={() => setStep(1)}
              disabled={!groupMembersValid || anyMemberLoading}
            >
              Next →
            </button>
          )}

          {(!isGroup || step === 1) && (
            <button
              className="avm-btn avm-btn--submit"
              onClick={handleSubmit}
              disabled={
                submitting
                || (isGroup
                  ? (!groupDetailsValid || !groupMembersValid)
                  : (!individualValid || hrmsLoading))
              }
            >
              {submitting
                ? 'Adding…'
                : (isGroup ? 'Add Group and Check-in' : 'Add and Check-in')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
