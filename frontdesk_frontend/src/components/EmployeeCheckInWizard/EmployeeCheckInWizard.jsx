import React, { useState, useEffect, useRef } from 'react';
import {
  sendEmployeeOtp,
  verifyEmployeeOtp,
  getStaffMembers,
  getDepartments,
  getFormLocations,
  checkInSingle,
} from '../../api/checkInApi';
import './EmployeeCheckInWizard.css';

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
const IconBadge = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <line x1="16" y1="10" x2="18" y2="10"/><line x1="16" y1="14" x2="18" y2="14"/>
    <circle cx="9" cy="10" r="2"/>
    <path d="M6 14c0-1.1.9-2 2-2h2a2 2 0 0 1 2 2"/>
  </svg>
);
const IconUser = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconBriefcase = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);
const IconCamera = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);
const IconCheckVerified = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

// ── Custom Select Dropdown ─────────────────────────────────────────────────────

const WzSelect = ({ id, icon, value, onChange, options, placeholder, hasError }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const label = options.find(o => o.value === value)?.label;

  return (
    <div className={`ci-wz-csel${open ? ' ci-wz-csel--open' : ''}${hasError ? ' ci-wz-csel--err' : ''}`} ref={ref}>
      <button
        id={id}
        type="button"
        className="ci-wz-csel__trigger"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {icon && <span className="ci-wz-csel__icon">{icon}</span>}
        <span className={`ci-wz-csel__val${!value ? ' ci-wz-csel__val--ph' : ''}`}>
          {label ?? placeholder}
        </span>
        <svg className="ci-wz-csel__chev" width="12" height="12" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <ul className="ci-wz-csel__list" role="listbox">
          {options.map(o => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`ci-wz-csel__opt${o.value === value ? ' ci-wz-csel__opt--sel' : ''}`}
                onClick={() => { onChange(o.value); setOpen(false); }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ── OTP Input ──────────────────────────────────────────────────────────────────

const OTPInput = ({ value, onChange, disabled }) => {
  const DIGITS = 6;
  const refs   = useRef([]);
  const chars  = Array.from({ length: DIGITS }, (_, i) => value[i] || '');
  const update = (arr) => onChange(arr.join(''));

  const handleChange = (i, e) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...chars]; next[i] = char;
    update(next);
    if (char && i < DIGITS - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      if (chars[i]) { const n = [...chars]; n[i] = ''; update(n); }
      else if (i > 0) refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowLeft'  && i > 0)          refs.current[i - 1]?.focus();
      else if (e.key === 'ArrowRight' && i < DIGITS - 1) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, DIGITS);
    const next   = Array.from({ length: DIGITS }, (_, i) => pasted[i] || '');
    update(next);
    refs.current[Math.min(pasted.length, DIGITS - 1)]?.focus();
  };

  return (
    <div className="ecw-otp-boxes" role="group" aria-label="One-time passcode" onPaste={handlePaste}>
      {chars.map((d, i) => (
        <input
          key={i}
          ref={el => refs.current[i] = el}
          type="text"
          inputMode="numeric"
          pattern="[0-9]"
          maxLength={1}
          className={`ecw-otp-box${d ? ' ecw-otp-box-filled' : ''}`}
          value={d}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          disabled={disabled}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`OTP digit ${i + 1}`}
        />
      ))}
    </div>
  );
};

// ── Wizard Progress ────────────────────────────────────────────────────────────

const WizardProgress = ({ step, totalSteps }) => (
  <div className="ecw-progress-wrap">
    <div className="ecw-progress-track">
      <div
        className="ecw-progress-fill"
        style={{ width: `${(step / totalSteps) * 100}%` }}
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
      />
    </div>
    <p className="ecw-step-label">Step {step} of {totalSteps}</p>
  </div>
);

// ── Step 1: Employee ID + OTP + Details ────────────────────────────────────────

const Step1Details = ({ form, setField, staffMembers, departments, locations, onNext }) => {
  const [sending,   setSending]   = useState(false);
  const [otpSent,   setOtpSent]   = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified,  setVerified]  = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errors,    setErrors]    = useState({});
  const [otpError,  setOtpError]  = useState('');
  const timerRef = useRef(null);

  const empIdValid = form.empId.trim().length >= 3;

  const startCountdown = () => {
    setCountdown(30);
    timerRef.current = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(timerRef.current); return 0; } return c - 1; });
    }, 1000);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const handleSendOtp = async () => {
    if (!empIdValid) { setOtpError('Please enter a valid Employee ID.'); return; }
    setOtpError(''); setSending(true);
    try {
      await sendEmployeeOtp(form.empId.trim());
      setOtpSent(true); setField('otpCode')(''); startCountdown();
    } catch (err) {
      setOtpError(err.message || 'Failed to send OTP. Please try again.');
    } finally { setSending(false); }
  };

  const handleVerifyOtp = async () => {
    setOtpError(''); setVerifying(true);
    try {
      await verifyEmployeeOtp(form.empId.trim(), form.otpCode);
      setVerified(true); setField('otpVerified')(true);
    } catch (err) {
      setOtpError(err.message || 'Incorrect OTP. Please try again.');
    } finally { setVerifying(false); }
  };

  const validate = () => {
    const e = {};
    if (!form.location)              e.location = 'Please select a location.';
    if (!form.fullName.trim())       e.fullName = 'Full name is required.';
    else if (form.fullName.trim().length < 2) e.fullName = 'Name must be at least 2 characters.';
    return e;
  };

  const handleNext = () => {
    if (!verified) { setOtpError('Please verify your Employee ID via OTP first.'); return; }
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onNext();
  };

  const sf = (field) => (e) => {
    setField(field)(typeof e === 'string' ? e : e.target.value);
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  return (
    <div className="ecw-step">
      <div className="ecw-body-scroll">

        {/* Employee ID + OTP */}
        <div className="ecw-field">
          <label className="ecw-label" htmlFor="ecw-empid">Employee ID</label>
          <div className="ecw-input-row">
            <div className="ecw-input-wrap">
              <span className="ecw-icon"><IconBadge /></span>
              <input
                id="ecw-empid"
                className={`ecw-input${!empIdValid && form.empId ? ' error' : ''}`}
                type="text"
                placeholder="e.g. EMP1001"
                value={form.empId}
                onChange={e => {
                  const v = e.target.value.toUpperCase();
                  setField('empId')(v);
                  if (otpSent) { setOtpSent(false); setVerified(false); setField('otpVerified')(false); setField('otpCode')(''); }
                  setOtpError('');
                }}
                disabled={verified}
                autoComplete="off"
              />
            </div>
            {!verified ? (
              <button
                className="ecw-otp-btn"
                onClick={handleSendOtp}
                disabled={!empIdValid || sending || (otpSent && countdown > 0)}
              >
                {sending ? 'Sending…' : otpSent ? (countdown > 0 ? `Resend (${countdown}s)` : 'Resend OTP') : 'Send OTP'}
              </button>
            ) : (
              <span className="ecw-verified-badge"><IconCheckVerified /> Verified</span>
            )}
          </div>
        </div>

        {/* OTP entry */}
        {otpSent && !verified && (
          <div className="ecw-field">
            <label className="ecw-label">Enter OTP</label>
            <p className="ecw-hint">A 6-digit code was sent to your registered contact for {form.empId}</p>
            <OTPInput
              value={form.otpCode}
              onChange={v => { setField('otpCode')(v); setOtpError(''); }}
              disabled={verifying}
            />
            <button
              className="ecw-verify-btn"
              onClick={handleVerifyOtp}
              disabled={form.otpCode.length !== 6 || verifying}
            >
              {verifying ? 'Verifying…' : 'Verify OTP'}
            </button>
          </div>
        )}

        {otpError && <p className="ecw-error">{otpError}</p>}

        {/* Form fields — revealed only after OTP is verified */}
        {verified && (
          <>
            <div className="ecw-divider-light" />

            {/* Location */}
            <div className="ecw-field">
              <label className="ecw-label" htmlFor="ecw-location">
                Location <span className="ecw-req">*</span>
              </label>
              <WzSelect
                id="ecw-location"
                icon={<IconBadge />}
                value={form.location}
                onChange={(v) => sf('location')(v)}
                options={locations.map(l => ({ value: l.id, label: l.name }))}
                placeholder="Select a location…"
                hasError={!!errors.location}
              />
              {errors.location && <span className="ecw-field-error">{errors.location}</span>}
            </div>

            {/* Full Name */}
            <div className="ecw-field">
              <label className="ecw-label" htmlFor="ecw-name">
                Full Name <span className="ecw-req">*</span>
              </label>
              <div className="ecw-input-wrap">
                <span className="ecw-icon"><IconUser /></span>
                <input
                  id="ecw-name"
                  className={`ecw-input${errors.fullName ? ' error' : ''}`}
                  type="text"
                  placeholder="e.g. Ravi Kumar"
                  value={form.fullName}
                  onChange={sf('fullName')}
                  autoComplete="off"
                />
              </div>
              {errors.fullName && <span className="ecw-field-error">{errors.fullName}</span>}
            </div>

            {/* Department (employee's own dept — free text) */}
            <div className="ecw-field">
              <label className="ecw-label" htmlFor="ecw-dept-own">
                Department <span className="ecw-opt">(Optional)</span>
              </label>
              <div className="ecw-input-wrap">
                <span className="ecw-icon"><IconBriefcase /></span>
                <input
                  id="ecw-dept-own"
                  className="ecw-input"
                  type="text"
                  placeholder="e.g. Operations"
                  value={form.ownDepartment}
                  onChange={sf('ownDepartment')}
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Person to Meet */}
            <div className="ecw-field">
              <label className="ecw-label" htmlFor="ecw-person">
                Person to Meet <span className="ecw-opt">(Optional)</span>
              </label>
              <WzSelect
                id="ecw-person"
                icon={<IconUser />}
                value={form.personToMeet}
                onChange={(v) => {
                  sf('personToMeet')(v);
                  const staff = staffMembers.find(s => s.name === v);
                  if (staff) setField('hostDepartment')(staff.department);
                }}
                options={staffMembers.map(s => ({ value: s.name, label: s.name }))}
                placeholder="Select a person…"
              />
            </div>

            {/* Host Department */}
            <div className="ecw-field">
              <label className="ecw-label" htmlFor="ecw-host-dept">
                Host Department <span className="ecw-opt">(Optional)</span>
              </label>
              <WzSelect
                id="ecw-host-dept"
                icon={<IconBriefcase />}
                value={form.hostDepartment}
                onChange={(v) => sf('hostDepartment')(v)}
                options={departments.map(d => ({ value: d, label: d }))}
                placeholder="Select a department"
              />
            </div>

            {/* Reason for Visit */}
            <div className="ecw-field">
              <label className="ecw-label" htmlFor="ecw-reason">
                Reason for Visit <span className="ecw-opt">(Optional)</span>
              </label>
              <textarea
                id="ecw-reason"
                className="ecw-textarea"
                placeholder="e.g. Project meeting"
                rows={3}
                value={form.reasonForVisit}
                onChange={sf('reasonForVisit')}
              />
            </div>
          </>
        )}

      </div>

      <div className="ecw-footer">
        <button className="ecw-btn-primary" onClick={handleNext} disabled={!verified}>
          Next
        </button>
      </div>
    </div>
  );
};

// ── Step 2: Photo capture ──────────────────────────────────────────────────────

const Step2Photo = ({ form, setField, onBack, onSubmit, submitting }) => {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [camState,  setCamState]  = useState('idle');
  const [camError,  setCamError]  = useState('');
  const [submitErr, setSubmitErr] = useState('');

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    setCamState('loading'); setCamError(''); setField('photo')(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCamState('ready');
      }
    } catch (err) {
      stopCamera();
      setCamError(
        err.name === 'NotAllowedError'
          ? 'Camera access denied. Please allow camera access in your browser settings.'
          : 'Camera is unavailable on this device.',
      );
      setCamState('error');
    }
  };

  useEffect(() => { startCamera(); return stopCamera; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const capturePhoto = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    setField('photo')(canvas.toDataURL('image/jpeg', 0.88));
    stopCamera();
  };

  const handleSubmit = async (skipPhoto = false) => {
    if (skipPhoto) setField('photo')(null);
    setSubmitErr('');
    try { await onSubmit(); }
    catch (err) { setSubmitErr(err.message || 'Something went wrong. Please try again.'); }
  };

  return (
    <div className="ecw-step">
      <div className="ecw-step-padded">
        <div className="ecw-camera-viewport">
          {!form.photo ? (
            <>
              <video
                ref={videoRef}
                autoPlay muted playsInline
                className="ecw-camera-video"
                style={{ display: camState === 'ready' ? 'block' : 'none' }}
              />
              {camState === 'loading' && (
                <div className="ecw-camera-overlay-msg">
                  <div className="ecw-camera-spinner" />
                  <span>Starting camera…</span>
                </div>
              )}
              {camState === 'error' && (
                <div className="ecw-camera-overlay-msg">
                  <IconCamera />
                  <p>{camError}</p>
                </div>
              )}
              {camState === 'ready' && <div className="ecw-face-guide" />}
            </>
          ) : (
            <>
              <img src={form.photo} alt="Captured selfie" className="ecw-camera-video" style={{ objectFit: 'cover' }} />
              <div className="ecw-captured-badge"><IconCheckVerified /> Photo captured</div>
            </>
          )}
          <canvas ref={canvasRef} hidden />
        </div>

        {!form.photo && camState !== 'error' && (
          <p className="ecw-camera-hint">Position your face in the centre and tap Capture.</p>
        )}

        <div className="ecw-photo-actions">
          {!form.photo ? (
            <>
              <button className="ecw-btn-capture" onClick={capturePhoto} disabled={camState !== 'ready'}>
                <IconCamera /> Capture Selfie
              </button>
              <button className="ecw-btn-skip" onClick={() => handleSubmit(true)} disabled={submitting}>
                {submitting ? 'Checking in…' : 'Skip'}
              </button>
            </>
          ) : (
            <button className="ecw-btn-retake" onClick={startCamera}>
              <IconRefresh /> Retake
            </button>
          )}
        </div>

        {submitErr && <p className="ecw-error" style={{ marginLeft: 0 }}>{submitErr}</p>}
      </div>

      <div className="ecw-footer">
        <button className="ecw-btn-cancel" onClick={onBack} disabled={submitting}>← Back</button>
        <button className="ecw-btn-primary" onClick={() => handleSubmit(false)} disabled={submitting}>
          {submitting ? 'Checking in…' : 'Add and Check-in'}
        </button>
      </div>
    </div>
  );
};

// ── EmployeeCheckInWizard ──────────────────────────────────────────────────────

/**
 * EmployeeCheckInWizard
 *
 * 2-step wizard for employee check-in:
 *   Step 1 — Employee ID + OTP verification + details form
 *   Step 2 — Photo capture
 *
 * API integration:
 *   sendEmployeeOtp / verifyEmployeeOtp  → checkInApi.js (replace mocks)
 *   On submit: replace the mock in handleSubmit with:
 *     apiFetch('/api/checkins', { method: 'POST', body: JSON.stringify(payload) })
 */
const EmployeeCheckInWizard = ({ onClose, onBack, onSuccess }) => {
  const TOTAL    = 2;
  const modalRef = useRef(null);
  const [step,         setStep]       = useState(1);
  const [submitting,   setSubmitting] = useState(false);
  const [staffMembers, setStaff]      = useState([]);
  const [departments,  setDepts]      = useState([]);
  const [locations,    setLocs]       = useState([]);

  const [form, setForm] = useState({
    empId:          '',
    otpCode:        '',
    otpVerified:    false,
    location:       '',
    fullName:       '',
    ownDepartment:  '',
    personToMeet:   '',
    hostDepartment: '',
    reasonForVisit: '',
    photo:          null,
  });

  const setField = (field) => (value) => setForm(f => ({ ...f, [field]: value }));

  useFocusTrap(modalRef, true);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    Promise.all([getStaffMembers(), getDepartments(), getFormLocations()])
      .then(([staff, depts, locs]) => { setStaff(staff); setDepts(depts); setLocs(locs); })
      .catch(console.error);
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const entry = await checkInSingle({
        visitorType:          'EMPLOYEE',
        fullName:             form.fullName,
        locationId:           form.location,
        identificationNumber: form.empId,
        govtId:               null,
        personToMeet:         form.personToMeet || null,
        cardNumber:           null,
      });
      onSuccess(entry);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="ecw-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="ecw-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ecw-title"
        ref={modalRef}
      >
        {/* Fixed header */}
        <div className="ecw-header">
          <div>
            <h2 id="ecw-title">Add New Employee</h2>
            <p>Manually enter the details for a new employee.</p>
          </div>
          <button className="ecw-close-btn" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>

        {/* Progress */}
        <WizardProgress step={step} totalSteps={TOTAL} />

        {/* Steps */}
        {step === 1 && (
          <Step1Details
            form={form}
            setField={setField}
            staffMembers={staffMembers}
            departments={departments}
            locations={locations}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2Photo
            form={form}
            setField={setField}
            onBack={() => setStep(1)}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  );
};

export default EmployeeCheckInWizard;
