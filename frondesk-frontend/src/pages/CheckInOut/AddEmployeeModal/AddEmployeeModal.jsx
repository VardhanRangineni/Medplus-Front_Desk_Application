/**
 * AddEmployeeModal — 3-step employee check-in flow.
 *
 *  Step 1  Employee ID  →  Send OTP  →  Verify OTP
 *  Step 2  Visit details (person to meet, host dept, reason)
 *  Step 3  Photo capture (selfie or skip)
 *
 * Reuses the same avm-* CSS design-language as AddVisitorModal.
 * Employee-specific additions live in AddEmployeeModal.css.
 */

import { useState, useEffect, useRef } from 'react';
import '../AddVisitorModal/AddVisitorModal.css';
import './AddEmployeeModal.css';
import {
  IconX,
  IconIdCard,
  IconBuilding,
  IconCamera,
  IconChevronDown,
  IconCheckCircle,
  IconUsers,
  IconPlus,
  IconTrash,
  IconCreditCard,
} from '../../../components/Icons/Icons';
import {
  lookupEmployee,
  sendEmployeeOtp,
  verifyEmployeeOtp,
  getPersonsToMeet,
  getDepartments,
  createEmployeeEntry,
  updateEmployeeEntry,
} from './addEmployeeService';

// ─── Shared primitives (same design as AddVisitorModal) ───────────────────────

function ProgressBar({ step, total = 3 }) {
  return (
    <div className="avm-progress" role="progressbar" aria-valuenow={step} aria-valuemax={total}>
      <div className="avm-progress__fill" style={{ width: `${(step / total) * 100}%` }} />
    </div>
  );
}

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

// ─── Step 1 — Employee ID + OTP ───────────────────────────────────────────────
function Step1({
  empId, onEmpIdChange,
  employee, lookupError,
  otpSent, otp, onOtpChange,
  otpVerified, sendingOtp, verifyingOtp, otpError,
  onSendOtp, onVerifyOtp,
}) {
  return (
    <div className="avm-step">

      {/* Employee ID row */}
      <Field label="Employee ID" required>
        <div className="avm-side-by-side">
          <InputWithIcon
            icon={<IconIdCard size={14} />}
            type="text"
            placeholder="e.g. EMP1001"
            value={empId}
            maxLength={20}
            disabled={otpVerified}
            onChange={(e) => onEmpIdChange(e.target.value.toUpperCase())}
          />
          <button
            className={`avm-otp-btn${otpVerified ? ' avm-otp-btn--done' : ''}`}
            onClick={onSendOtp}
            disabled={empId.trim().length < 4 || sendingOtp || otpVerified}
          >
            {sendingOtp ? 'Looking up…' : otpSent ? 'Resend OTP' : 'Send OTP'}
          </button>
        </div>
        {lookupError && <p className="avm-error">{lookupError}</p>}
      </Field>

      {/* Employee info card — shown after successful lookup */}
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
            {otpSent && !otpVerified && (
              <p className="aem-emp-card__otp-hint">
                OTP sent to <strong>{employee.maskedPhone}</strong>
              </p>
            )}
          </div>
        </div>
      )}

      {/* OTP input — shown after OTP is sent */}
      {otpSent && !otpVerified && (
        <Field
          label="Enter OTP"
          required
          hint="Enter the 6-digit code sent to the registered phone number."
        >
          <div className="avm-side-by-side">
            <input
              className="avm-input avm-input--otp"
              type="text"
              inputMode="numeric"
              placeholder="• • • • • •"
              maxLength={6}
              value={otp}
              onChange={(e) => onOtpChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => { if (e.key === 'Enter' && otp.length === 6) onVerifyOtp(); }}
            />
            <button
              className="avm-otp-btn"
              onClick={onVerifyOtp}
              disabled={otp.length < 6 || verifyingOtp}
            >
              {verifyingOtp ? 'Verifying…' : 'Verify OTP'}
            </button>
          </div>
          {otpError && <p className="avm-error">{otpError}</p>}
        </Field>
      )}

      {/* Verified badge */}
      {otpVerified && (
        <div className="avm-verified">
          <IconCheckCircle size={16} />
          <span>OTP Verified — Identity confirmed.</span>
        </div>
      )}
    </div>
  );
}

// ─── Step 2 — Visit details ───────────────────────────────────────────────────
function Step2({
  employee,
  visitType, setVisitType,
  personToMeet, onPersonToMeetChange,
  hostDepartment, setHostDepartment,
  reasonForVisit, setReasonForVisit,
  cardNumber, setCardNumber,
  leadCardNumber, setLeadCardNumber,
  members, addMember, removeMember, updateMember,
  persons, departments,
}) {
  return (
    <div className="avm-step">

      {/* Employee read-only summary */}
      {employee && (
        <div className="aem-emp-summary">
          <div className="aem-emp-summary__icon">
            <IconIdCard size={16} />
          </div>
          <div>
            <p className="aem-emp-summary__name">{employee.name}</p>
            <p className="aem-emp-summary__meta">{employee.id} &nbsp;·&nbsp; {employee.department}</p>
          </div>
        </div>
      )}

      {/* Visit type */}
      <Field label="Visit Type" required>
        <div className="avm-radio-group">
          {['individual', 'group'].map((t) => (
            <label
              key={t}
              className={`avm-radio${visitType === t ? ' avm-radio--active' : ''}`}
            >
              <input
                type="radio"
                name="empVisitType"
                value={t}
                checked={visitType === t}
                onChange={() => setVisitType(t)}
              />
              <span>{t === 'individual' ? 'Individual' : 'Group'}</span>
            </label>
          ))}
        </div>
      </Field>

      {/* Person to meet — auto-fills Host Department */}
      <Field label="Person To Meet" required>
        <SelectField
          placeholder="Select a person…"
          value={personToMeet}
          onChange={onPersonToMeetChange}
          options={persons.map((p) => ({ id: p.id, name: `${p.name} — ${p.department}` }))}
        />
      </Field>

      {/* Host department — pre-filled, editable */}
      <Field label="Host Department">
        <SelectField
          icon={<IconBuilding size={14} />}
          placeholder="Select a department"
          value={hostDepartment}
          onChange={setHostDepartment}
          options={departments}
        />
      </Field>

      {/* Reason for visit */}
      <Field label="Reason for Visit">
        <textarea
          className="avm-textarea"
          placeholder="e.g. Project meeting"
          rows={3}
          value={reasonForVisit}
          onChange={(e) => setReasonForVisit(e.target.value)}
        />
      </Field>

      {/* Card number — label changes for group */}
      <Field label={visitType === 'group' ? 'Lead Card Number' : 'Card Number'}>
        <InputWithIcon
          icon={<IconCreditCard size={14} />}
          type="text"
          placeholder="e.g. 123"
          value={visitType === 'group' ? leadCardNumber : cardNumber}
          onChange={(e) =>
            visitType === 'group'
              ? setLeadCardNumber(e.target.value)
              : setCardNumber(e.target.value)
          }
        />
      </Field>

      {/* Sub-visitors section (group only) */}
      {visitType === 'group' && (
        <div className="avm-members">
          <div className="avm-members__header">
            <span className="avm-members__title">
              <IconUsers size={14} />
              Sub-Visitors
            </span>
            <button className="avm-members__add-btn" onClick={addMember}>
              <IconPlus size={12} />
              Add Member
            </button>
          </div>

          {members.length === 0 ? (
            <p className="avm-members__empty">No sub-visitors yet. Click "+ Add Member" to begin.</p>
          ) : (
            <>
              <div className="avm-members__cols">
                <span>Name</span>
                <span>Card #</span>
                <span />
              </div>
              {members.map((m) => (
                <div key={m.id} className="avm-members__row">
                  <input
                    className="avm-input"
                    type="text"
                    placeholder="Guest name"
                    value={m.name}
                    onChange={(e) => updateMember(m.id, 'name', e.target.value)}
                  />
                  <input
                    className="avm-input"
                    type="text"
                    placeholder="Card #"
                    value={m.card}
                    onChange={(e) => updateMember(m.id, 'card', e.target.value)}
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

// ─── Step 3 — Photo capture ───────────────────────────────────────────────────
function Step3({ photo, cameraActive, photoSkipped, videoRef, canvasRef, onStart, onCapture, onRetake, onSkip }) {
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
          <img className="avm-captured-img" src={photo} alt="Captured selfie" />
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
            <IconCamera size={15} /> Take Photo
          </button>
        ) : (
          <button className="avm-photo-btn avm-photo-btn--capture" onClick={onStart}>
            <IconCamera size={15} /> Capture Selfie
          </button>
        )}
        {!photo && (
          <button className="avm-photo-btn avm-photo-btn--skip" onClick={onSkip}>
            Skip
          </button>
        )}
      </div>

      {photoSkipped && !photo && (
        <p className="avm-skip-note">Photo skipped — you can proceed to check in.</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AddEmployeeModal({ onClose, onBack, onSuccess }) {
  const [step, setStep] = useState(1);

  // ── Step 1 state ──────────────────────────────────────────────────────────
  const [empId,         setEmpId]         = useState('');
  const [employee,      setEmployee]      = useState(null);
  const [lookupError,   setLookupError]   = useState('');
  const [otpSent,       setOtpSent]       = useState(false);
  const [otp,           setOtp]           = useState('');
  const [otpVerified,   setOtpVerified]   = useState(false);
  const [sendingOtp,    setSendingOtp]    = useState(false);
  const [verifyingOtp,  setVerifyingOtp]  = useState(false);
  const [otpError,      setOtpError]      = useState('');

  // ── Step 2 state ──────────────────────────────────────────────────────────
  const [visitType,      setVisitType]      = useState('individual');
  const [personToMeet,   setPersonToMeet]   = useState('');
  const [hostDepartment, setHostDepartment] = useState('');
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [cardNumber,     setCardNumber]     = useState('');
  const [leadCardNumber, setLeadCardNumber] = useState('');
  const [members,        setMembers]        = useState([]);

  // ── Step 3 state ──────────────────────────────────────────────────────────
  const [photo,        setPhoto]        = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [photoSkipped, setPhotoSkipped] = useState(false);

  // ── Reference data ────────────────────────────────────────────────────────
  const [persons,     setPersons]     = useState([]);
  const [departments, setDepartments] = useState([]);

  // ── Submission ────────────────────────────────────────────────────────────
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Camera refs ───────────────────────────────────────────────────────────
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Stable onClose ref for Escape handler
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // ── Load reference data ───────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([getPersonsToMeet(), getDepartments()])
      .then(([pers, depts]) => { setPersons(pers); setDepartments(depts); })
      .catch(() => {});
  }, []);

  // ── Keyboard / cleanup ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => () => stopCamera(), []);
  useEffect(() => { if (step !== 3) stopCamera(); }, [step]);

  // Attach stream after <video> renders (same fix as AddVisitorModal)
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  // Pre-fill host department from employee record when it's fetched
  useEffect(() => {
    if (employee?.department && !hostDepartment) {
      const found = departments.find((d) => d.name === employee.department);
      if (found) setHostDepartment(found.id);
    }
  }, [employee, departments]);

  // ── OTP handlers ──────────────────────────────────────────────────────────
  async function handleSendOtp() {
    if (empId.trim().length < 4 || sendingOtp || otpVerified) return;
    setSendingOtp(true);
    setLookupError('');
    setOtpError('');
    try {
      const lookup = await lookupEmployee(empId);
      if (!lookup.found) {
        setLookupError(lookup.message);
        setSendingOtp(false);
        return;
      }
      setEmployee(lookup.employee);
      await sendEmployeeOtp(empId);
      setOtpSent(true);
      setOtp('');
    } catch {
      setLookupError('Something went wrong. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.length < 6 || verifyingOtp) return;
    setVerifyingOtp(true);
    setOtpError('');
    try {
      const result = await verifyEmployeeOtp(empId, otp);
      if (result.verified) {
        setOtpVerified(true);
      } else {
        setOtpError(result.message);
      }
    } catch {
      setOtpError('Verification failed. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  }

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
      setCameraActive(true); // render <video> first, useEffect attaches stream
    } catch {
      // Camera unavailable — user can skip
    }
  }

  function capturePhoto() {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    setPhoto(canvas.toDataURL('image/jpeg', 0.85));
    stopCamera();
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

  // ── Group visit member helpers ────────────────────────────────────────────
  const addMember    = () => setMembers((prev) => [...prev, { id: Date.now(), name: '', card: '' }]);
  const removeMember = (id) => setMembers((prev) => prev.filter((m) => m.id !== id));
  const updateMember = (id, field, value) =>
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));

  // ── Navigation guards ─────────────────────────────────────────────────────
  const step1Valid = otpVerified;
  const step2Valid = personToMeet !== '';
  const step3Ready = photo !== null || photoSkipped;

  function handleBack() {
    if (step === 1) {
      onBack?.();   // reopen EntryTypeModal from CheckInOut
    } else {
      setStep((s) => s - 1);
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        type:           'EMPLOYEE',
        visitType,
        empId:          employee?.id ?? empId,
        name:           employee?.name ?? '',
        department:     employee?.department ?? '',
        personToMeet,
        hostDepartment,
        reasonForVisit,
        photo:          photo ?? null,
        ...(visitType === 'group'
          ? { leadCardNumber, members }
          : { cardNumber }),
      };
      const result = await createEmployeeEntry(payload);
      if (result.success) {
        onSuccess?.(result);
        onClose();
      }
    } catch {
      setSubmitError('Failed to create entry. Please try again.');
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
            <p className="avm-subtitle">Manually enter the details for a new employee.</p>
          </div>
          <button className="avm-close" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>

        {/* Progress */}
        <ProgressBar step={step} />
        <p className="avm-step-label">Step {step} of 3</p>

        {/* Scrollable body */}
        <div className="avm-body">
          {step === 1 && (
            <Step1
              empId={empId}
              onEmpIdChange={(v) => { setEmpId(v); setLookupError(''); }}
              employee={employee}
              lookupError={lookupError}
              otpSent={otpSent}
              otp={otp}
              onOtpChange={(v) => { setOtp(v); setOtpError(''); }}
              otpVerified={otpVerified}
              sendingOtp={sendingOtp}
              verifyingOtp={verifyingOtp}
              otpError={otpError}
              onSendOtp={handleSendOtp}
              onVerifyOtp={handleVerifyOtp}
            />
          )}

          {step === 2 && (
            <Step2
              employee={employee}
              visitType={visitType}
              setVisitType={setVisitType}
              personToMeet={personToMeet}
              onPersonToMeetChange={handlePersonToMeetChange}
              hostDepartment={hostDepartment}
              setHostDepartment={setHostDepartment}
              reasonForVisit={reasonForVisit}
              setReasonForVisit={setReasonForVisit}
              cardNumber={cardNumber}
              setCardNumber={setCardNumber}
              leadCardNumber={leadCardNumber}
              setLeadCardNumber={setLeadCardNumber}
              members={members}
              addMember={addMember}
              removeMember={removeMember}
              updateMember={updateMember}
              persons={persons}
              departments={departments}
            />
          )}

          {step === 3 && (
            <Step3
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
            onClick={handleBack}
            disabled={submitting}
          >
            Back
          </button>

          <div className="avm-footer__spacer" />

          {submitError && <p className="avm-error avm-error--footer">{submitError}</p>}

          {step < 3 && (
            <button
              className="avm-btn avm-btn--next"
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 1 ? !step1Valid : !step2Valid}
            >
              Next
            </button>
          )}

          {step === 3 && (
            <button
              className="avm-btn avm-btn--submit"
              onClick={handleSubmit}
              disabled={!step3Ready || submitting}
            >
              {submitting ? 'Adding…' : 'Add and Check-in'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
