/**
 * EditEmployeeModal — 2-step form to edit an existing employee entry.
 *
 *  Step 1  Edit visit details (employee info chip read-only, rest editable)
 *  Step 2  Update photo proof
 *
 * Shares the avm-* / aem-* CSS design language with the Add modals.
 * Uses getEntryDetail() to load the full record on mount.
 */

import { useState, useEffect, useRef } from 'react';
import '../AddVisitorModal/AddVisitorModal.css';
import '../AddEmployeeModal/AddEmployeeModal.css';
import './EditEmployeeModal.css';
import {
  IconX,
  IconCamera,
  IconBuilding,
  IconChevronDown,
  IconIdCard,
  IconCreditCard,
  IconPlus,
  IconTrash,
  IconUsers,
} from '../../../components/Icons/Icons';
import { getEntryDetail } from '../checkInOutService';
import {
  getPersonsToMeet,
  getDepartments,
  updateEmployeeEntry,
} from '../AddEmployeeModal/addEmployeeService';

// ─── Shared primitives ────────────────────────────────────────────────────────

const TOTAL_STEPS = 2;

function ProgressBar({ step }) {
  return (
    <div className="avm-progress" role="progressbar" aria-valuenow={step} aria-valuemax={TOTAL_STEPS}>
      <div className="avm-progress__fill" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
    </div>
  );
}

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

function SelectField({ icon, placeholder, value, onChange, options }) {
  return (
    <div className="avm-select-wrap">
      {icon && <span className="avm-input-icon">{icon}</span>}
      <select
        className={`avm-select${icon ? ' avm-select--icon' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      <span className="avm-select-caret"><IconChevronDown size={14} /></span>
    </div>
  );
}

// ─── Step 1 — Edit visit details ──────────────────────────────────────────────
function Step1({ employee, form, setField, setPersonToMeet, persons, departments }) {
  const {
    visitType, personToMeet, hostDepartment,
    reasonForVisit, cardNumber, leadCardNumber, members,
  } = form;

  const addMember    = () => setField('members', [...members, { id: Date.now(), name: '', card: '' }]);
  const removeMember = (id) => setField('members', members.filter((m) => m.id !== id));
  const updateMember = (id, field, value) =>
    setField('members', members.map((m) => (m.id === id ? { ...m, [field]: value } : m)));

  return (
    <div className="avm-step">

      {/* Employee read-only chip */}
      {employee && (
        <div className="aem-emp-summary">
          <div className="aem-emp-summary__icon"><IconIdCard size={16} /></div>
          <div>
            <p className="aem-emp-summary__name">{employee.name}</p>
            <p className="aem-emp-summary__meta">
              {employee.id}&nbsp;·&nbsp;{employee.department}
            </p>
          </div>
        </div>
      )}

      {/* Visit type */}
      <Field label="Visit Type" required>
        <div className="avm-radio-group">
          {['individual', 'group'].map((t) => (
            <label key={t} className={`avm-radio${visitType === t ? ' avm-radio--active' : ''}`}>
              <input
                type="radio"
                name="eem-visitType"
                value={t}
                checked={visitType === t}
                onChange={() => setField('visitType', t)}
              />
              <span>{t === 'individual' ? 'Individual' : 'Group'}</span>
            </label>
          ))}
        </div>
      </Field>

      {/* Person to meet */}
      <Field label="Person To Meet" required>
        <SelectField
          placeholder="Select a person…"
          value={personToMeet}
          onChange={setPersonToMeet}
          options={persons.map((p) => ({ id: p.id, name: `${p.name} — ${p.department}` }))}
        />
      </Field>

      {/* Host department */}
      <Field label="Host Department">
        <SelectField
          icon={<IconBuilding size={14} />}
          placeholder="Select a department"
          value={hostDepartment}
          onChange={(v) => setField('hostDepartment', v)}
          options={departments}
        />
      </Field>

      {/* Reason */}
      <Field label="Reason for Visit">
        <textarea
          className="avm-textarea"
          placeholder="e.g. Project meeting"
          rows={3}
          value={reasonForVisit}
          onChange={(e) => setField('reasonForVisit', e.target.value)}
        />
      </Field>

      {/* Card number */}
      <Field label={visitType === 'group' ? 'Lead Card Number' : 'Card Number'}>
        <InputWithIcon
          icon={<IconCreditCard size={14} />}
          type="text"
          placeholder="e.g. 123"
          value={visitType === 'group' ? leadCardNumber : cardNumber}
          onChange={(e) =>
            setField(visitType === 'group' ? 'leadCardNumber' : 'cardNumber', e.target.value)
          }
        />
      </Field>

      {/* Group members */}
      {visitType === 'group' && (
        <div className="avm-members">
          <div className="avm-members__header">
            <span className="avm-members__title"><IconUsers size={14} />Sub-Visitors</span>
            <button className="avm-members__add-btn" onClick={addMember}>
              <IconPlus size={12} />Add Member
            </button>
          </div>
          {members.length === 0 ? (
            <p className="avm-members__empty">No sub-visitors yet. Click "+ Add Member" to begin.</p>
          ) : (
            <>
              <div className="avm-members__cols">
                <span>Name</span><span>Card #</span><span />
              </div>
              {members.map((m) => (
                <div key={m.id} className="avm-members__row">
                  <input
                    className="avm-input" type="text" placeholder="Guest name"
                    value={m.name} onChange={(e) => updateMember(m.id, 'name', e.target.value)}
                  />
                  <input
                    className="avm-input" type="text" placeholder="Card #"
                    value={m.card} onChange={(e) => updateMember(m.id, 'card', e.target.value)}
                  />
                  <button
                    className="avm-members__del-btn"
                    onClick={() => removeMember(m.id)}
                    aria-label="Remove member"
                  >
                    <IconTrash size={13} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step 2 — Update photo ────────────────────────────────────────────────────
function Step2({ photo, cameraActive, photoSkipped, videoRef, canvasRef, onStart, onCapture, onRetake, onSkip }) {
  return (
    <div className="avm-step avm-step--photo">
      <div
        className={[
          'avm-camera-area',
          cameraActive ? 'avm-camera-area--live'     : '',
          photo        ? 'avm-camera-area--captured' : '',
        ].join(' ').trim()}
      >
        {photo ? (
          <img className="avm-captured-img" src={photo} alt="Captured" />
        ) : cameraActive ? (
          <video ref={videoRef} className="avm-camera-video" autoPlay playsInline muted />
        ) : (
          <div className="avm-camera-placeholder">
            <IconCamera size={44} />
            <span>Camera preview will appear here</span>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="avm-photo-actions">
        {photo ? (
          <button className="avm-photo-btn avm-photo-btn--retake" onClick={onRetake}>
            Retake Photo
          </button>
        ) : cameraActive ? (
          <button className="avm-photo-btn avm-photo-btn--capture" onClick={onCapture}>
            <IconCamera size={15} />Take Photo
          </button>
        ) : (
          <button className="avm-photo-btn avm-photo-btn--capture" onClick={onStart}>
            <IconCamera size={15} />Update Photo
          </button>
        )}
        {!photo && (
          <button className="avm-photo-btn avm-photo-btn--skip" onClick={onSkip}>
            Keep Existing
          </button>
        )}
      </div>

      {photoSkipped && !photo && (
        <p className="avm-skip-note">Keeping the existing photo — proceed to save.</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const blankForm = {
  visitType: 'individual', personToMeet: '', hostDepartment: '',
  reasonForVisit: '', cardNumber: '', leadCardNumber: '', members: [],
};

export default function EditEmployeeModal({ entry, onClose, onSuccess }) {
  const [step,          setStep]          = useState(1);
  const [employee,      setEmployee]      = useState(null);
  const [form,          setFormState]     = useState(blankForm);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError,   setDetailError]   = useState('');

  // Reference data
  const [persons,     setPersons]     = useState([]);
  const [departments, setDepartments] = useState([]);

  // Photo
  const [photo,        setPhoto]        = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [photoSkipped, setPhotoSkipped] = useState(false);

  // Submission
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Camera refs
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // ── Load full entry detail + reference data on mount ─────────────────────
  useEffect(() => {
    setDetailLoading(true);
    setDetailError('');
    Promise.all([
      getEntryDetail(entry.id),
      getPersonsToMeet(),
      getDepartments(),
    ])
      .then(([detail, pers, depts]) => {
        setPersons(pers);
        setDepartments(depts);
        setEmployee({
          id:         detail.empId        ?? entry.empId  ?? '',
          name:       detail.name         ?? entry.name   ?? '',
          department: detail.department   ?? '',
        });
        setFormState({
          visitType:      (detail.visitType     ?? 'individual').toLowerCase(),
          personToMeet:   detail.personToMeetId ?? detail.personToMeet ?? entry.personToMeet ?? '',
          hostDepartment: detail.hostDepartment ?? '',
          reasonForVisit: detail.reasonForVisit ?? '',
          cardNumber:     detail.card           != null ? String(detail.card)           : '',
          leadCardNumber: detail.leadCardNumber != null ? String(detail.leadCardNumber) : '',
          members: (detail.members ?? entry.members ?? []).map((m) => ({
            id:   m.id   ?? Date.now() + Math.random(),
            name: m.name ?? '',
            card: m.card != null ? String(m.card) : '',
          })),
        });
      })
      .catch((err) => setDetailError(err?.message || 'Failed to load entry details.'))
      .finally(() => setDetailLoading(false));
  }, [entry.id]);

  // ── Keyboard / camera cleanup ─────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  useEffect(() => () => stopCamera(), []);
  useEffect(() => { if (step !== 2) stopCamera(); }, [step]);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  // ── Camera helpers ────────────────────────────────────────────────────────
  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setCameraActive(true);
    } catch { /* no camera — user can keep existing photo */ }
  }

  function capturePhoto() {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    setPhoto(canvas.toDataURL('image/jpeg', 0.85));
    stopCamera();
  }

  // ── Form helpers ──────────────────────────────────────────────────────────
  const setField = (field, value) => setFormState((f) => ({ ...f, [field]: value }));

  function handleSetPersonToMeet(personId) {
    setFormState((f) => {
      const person = persons.find((p) => p.id === personId);
      const dept   = person ? departments.find((d) => d.name === person.department) : null;
      return {
        ...f,
        personToMeet:   personId,
        hostDepartment: dept ? dept.id : f.hostDepartment,
      };
    });
  }

  // ── Navigation guards ─────────────────────────────────────────────────────
  const step1Valid = form.personToMeet !== '';
  const step2Ready = photo !== null || photoSkipped;

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        type:           'EMPLOYEE',
        visitType:      form.visitType,
        empId:          employee?.id ?? entry.empId ?? '',
        name:           employee?.name ?? entry.name ?? '',
        department:     employee?.department ?? '',
        personToMeet:   form.personToMeet,
        hostDepartment: form.hostDepartment,
        reasonForVisit: form.reasonForVisit,
        photo:          photo ?? null,
        ...(form.visitType === 'group'
          ? { leadCardNumber: form.leadCardNumber, members: form.members }
          : { cardNumber: form.cardNumber }),
      };
      const result = await updateEmployeeEntry(entry.id, payload);
      if (result.success) {
        onSuccess?.(result);
        onClose();
      }
    } catch {
      setSubmitError('Failed to save changes. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const handleOverlayClick = (e) => { if (e.target === e.currentTarget) onClose(); };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="avm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="eem-title"
      onClick={handleOverlayClick}
    >
      <div className="avm-dialog">

        {/* Header */}
        <div className="avm-header">
          <div>
            <h2 className="avm-title" id="eem-title">Edit Employee Entry</h2>
            <p className="avm-subtitle">
              Editing <strong>{entry.id}</strong> — update the fields and save.
            </p>
          </div>
          <button className="avm-close" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>

        {/* Progress */}
        <ProgressBar step={step} />
        <p className="avm-step-label">Step {step} of {TOTAL_STEPS}</p>

        {/* Body */}
        <div className="avm-body">
          {detailLoading && (
            <div className="eem-loading">
              <div className="eem-loading__spinner" />
              <span>Loading entry details…</span>
            </div>
          )}

          {!detailLoading && detailError && (
            <p className="avm-error" style={{ margin: '16px' }}>{detailError}</p>
          )}

          {!detailLoading && !detailError && step === 1 && (
            <Step1
              employee={employee}
              form={form}
              setField={setField}
              setPersonToMeet={handleSetPersonToMeet}
              persons={persons}
              departments={departments}
            />
          )}

          {!detailLoading && !detailError && step === 2 && (
            <Step2
              photo={photo}
              cameraActive={cameraActive}
              photoSkipped={photoSkipped}
              videoRef={videoRef}
              canvasRef={canvasRef}
              onStart={startCamera}
              onCapture={capturePhoto}
              onRetake={() => { setPhoto(null); setPhotoSkipped(false); }}
              onSkip={() => { stopCamera(); setPhotoSkipped(true); }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="avm-footer">
          <button
            className="avm-btn avm-btn--back"
            onClick={() => step === 1 ? onClose() : setStep((s) => s - 1)}
            disabled={submitting}
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          <div className="avm-footer__spacer" />

          {submitError && <p className="avm-error avm-error--footer">{submitError}</p>}

          {step < TOTAL_STEPS && (
            <button
              className="avm-btn avm-btn--next"
              onClick={() => setStep((s) => s + 1)}
              disabled={detailLoading || !!detailError || !step1Valid}
            >
              Next
            </button>
          )}

          {step === TOTAL_STEPS && (
            <button
              className="avm-btn avm-btn--submit"
              onClick={handleSubmit}
              disabled={!step2Ready || submitting}
            >
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
