import React, { useState, useEffect, useRef } from 'react';
import {
  sendOtp,
  verifyOtp,
  getStaffMembers,
  getDepartments,
  getFormLocations,
  checkInSingle,
  checkInGroup,
} from '../../api/checkInApi';
import './VisitorCheckInWizard.css';

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
const IconPhone = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.6A16 16 0 0 0 14 14.59l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const IconMail = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);
const IconUser = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
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
const IconMapPin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
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
    <div className="ci-otp-boxes" role="group" aria-label="One-time passcode" onPaste={handlePaste}>
      {chars.map((d, i) => (
        <input
          key={i}
          ref={el => refs.current[i] = el}
          type="text"
          inputMode="numeric"
          pattern="[0-9]"
          maxLength={1}
          className={`ci-otp-box${d ? ' ci-otp-box-filled' : ''}`}
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
  <div className="ci-wizard-progress-wrap">
    <div className="ci-wizard-progress-track">
      <div
        className="ci-wizard-progress-fill"
        style={{ width: `${(step / totalSteps) * 100}%` }}
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
      />
    </div>
    <p className="ci-wizard-step-label">Step {step} of {totalSteps}</p>
  </div>
);

// ── Step 1: Mobile number + OTP ────────────────────────────────────────────────

const Step1Mobile = ({ form, setField, onNext }) => {
  const [sending,   setSending]   = useState(false);
  const [otpSent,   setOtpSent]   = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified,  setVerified]  = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error,     setError]     = useState('');
  const timerRef = useRef(null);

  const mobileValid = /^\d{10}$/.test(form.mobile);

  const startCountdown = () => {
    setCountdown(30);
    timerRef.current = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(timerRef.current); return 0; } return c - 1; });
    }, 1000);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const handleSendOtp = async () => {
    if (!mobileValid) { setError('Please enter a valid 10-digit mobile number.'); return; }
    setError(''); setSending(true);
    try {
      await sendOtp(form.mobile);
      setOtpSent(true); setField('otpCode')(''); startCountdown();
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally { setSending(false); }
  };

  const handleVerifyOtp = async () => {
    setError(''); setVerifying(true);
    try {
      await verifyOtp(form.mobile, form.otpCode);
      setVerified(true); setField('otpVerified')(true);
    } catch (err) {
      setError(err.message || 'Incorrect OTP. Please try again.');
    } finally { setVerifying(false); }
  };

  return (
    <div className="ci-wizard-step">
      <div className="ci-wizard-step-padded">

        {/* Mobile field */}
        <div className="ci-wz-field">
          <label className="ci-wz-label" htmlFor="wz-mobile">Mobile Number</label>
          <div className="ci-wz-input-row">
            <div className="ci-wz-input-wrap">
              <span className="ci-wz-icon"><IconPhone /></span>
              <input
                id="wz-mobile"
                className={`ci-wz-input${!mobileValid && form.mobile ? ' error' : ''}`}
                type="tel"
                inputMode="numeric"
                placeholder="9876543210"
                maxLength={10}
                value={form.mobile}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setField('mobile')(v);
                  if (otpSent) {
                    setOtpSent(false); setVerified(false);
                    setField('otpVerified')(false); setField('otpCode')('');
                  }
                  setError('');
                }}
                disabled={verified}
                autoComplete="tel-national"
              />
            </div>
            {!verified ? (
              <button
                className="ci-wz-otp-btn"
                onClick={handleSendOtp}
                disabled={!mobileValid || sending || (otpSent && countdown > 0)}
              >
                {sending ? 'Sending…' : otpSent ? (countdown > 0 ? `Resend (${countdown}s)` : 'Resend OTP') : 'Send OTP'}
              </button>
            ) : (
              <span className="ci-wz-verified-badge"><IconCheckVerified /> Verified</span>
            )}
          </div>
        </div>

        {/* OTP entry */}
        {otpSent && !verified && (
          <div className="ci-wz-field">
            <label className="ci-wz-label">Enter OTP</label>
            <p className="ci-wz-hint">A 6-digit code was sent to +91 {form.mobile}</p>
            <OTPInput
              value={form.otpCode}
              onChange={v => { setField('otpCode')(v); setError(''); }}
              disabled={verifying}
            />
            <button
              className="ci-wz-verify-btn"
              onClick={handleVerifyOtp}
              disabled={form.otpCode.length !== 6 || verifying}
            >
              {verifying ? 'Verifying…' : 'Verify OTP'}
            </button>
          </div>
        )}

        {error && <p className="ci-wz-error">{error}</p>}
      </div>

      <div className="ci-wizard-footer">
        <button className="ci-btn-primary" onClick={onNext} disabled={!verified}>
          Next
        </button>
      </div>
    </div>
  );
};

// ── Govt. ID types ─────────────────────────────────────────────────────────────

const GOVT_ID_TYPES = ['Aadhaar Card', 'PAN Card', 'Passport', 'Voter ID', 'Driving Licence'];

// ── Step 2: Visitor details (scrollable) ──────────────────────────────────────

const Step2Details = ({ form, setField, staffMembers, departments, locations, onNext, onBack }) => {
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.location)                   e.location      = 'Please select a location.';
    if (!form.fullName.trim())            e.fullName      = 'Full name is required.';
    else if (form.fullName.trim().length < 2) e.fullName  = 'Name must be at least 2 characters.';
    if (!form.personToMeet)               e.personToMeet  = 'Please select a person to meet.';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address.';
    if (form.govtIdType && !form.govtIdNumber.trim()) e.govtIdNumber = 'Please enter the ID number.';
    return e;
  };

  const handleNext = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onNext();
  };

  const sf = (field) => (e) => {
    setField(field)(typeof e === 'string' ? e : e.target.value);
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  return (
    <div className="ci-wizard-step">
      <div className="ci-wizard-body-scroll">

        {/* Visit Type */}
        <div className="ci-wz-field">
          <label className="ci-wz-label">Visit Type</label>
          <div className="ci-wz-radio-group" role="radiogroup" aria-label="Visit type">
            {['Individual', 'Group'].map(type => (
              <label key={type} className={`ci-wz-radio${form.visitType === type ? ' selected' : ''}`}>
                <input type="radio" name="wz-visitType" value={type} checked={form.visitType === type} onChange={() => setField('visitType')(type)} />
                {type}
              </label>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="ci-wz-field">
          <label className="ci-wz-label" htmlFor="wz-location">
            Location <span className="ci-wz-req">*</span>
          </label>
          <div className="ci-wz-select-wrap">
            <span className="ci-wz-icon"><IconMapPin /></span>
            <select
              id="wz-location"
              className={`ci-wz-select${errors.location ? ' error' : ''}`}
              value={form.location}
              onChange={sf('location')}
            >
              <option value="">Select a location for this entry</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          {errors.location && <span className="ci-wz-field-error">{errors.location}</span>}
        </div>

        {/* Full Name */}
        <div className="ci-wz-field">
          <label className="ci-wz-label" htmlFor="wz-name">
            Full Name <span className="ci-wz-req">*</span>
          </label>
          <div className="ci-wz-input-wrap">
            <span className="ci-wz-icon"><IconUser /></span>
            <input
              id="wz-name"
              className={`ci-wz-input${errors.fullName ? ' error' : ''}`}
              type="text"
              placeholder="John Doe"
              value={form.fullName}
              onChange={sf('fullName')}
              autoComplete="off"
            />
          </div>
          {errors.fullName && <span className="ci-wz-field-error">{errors.fullName}</span>}
        </div>

        {/* Email */}
        <div className="ci-wz-field">
          <label className="ci-wz-label" htmlFor="wz-email">
            Email <span className="ci-wz-opt">(Optional)</span>
          </label>
          <div className="ci-wz-input-wrap">
            <span className="ci-wz-icon"><IconMail /></span>
            <input
              id="wz-email"
              className={`ci-wz-input${errors.email ? ' error' : ''}`}
              type="email"
              inputMode="email"
              placeholder="john.doe@example.com"
              value={form.email}
              onChange={sf('email')}
              autoComplete="email"
            />
          </div>
          {errors.email && <span className="ci-wz-field-error">{errors.email}</span>}
        </div>

        {/* Govt. ID */}
        <div className="ci-wz-field">
          <label className="ci-wz-label">
            Verified Govt. ID <span className="ci-wz-opt">(Lead Only)</span>
          </label>
          <div className="ci-wz-select-wrap">
            <span className="ci-wz-icon"><IconIdCard /></span>
            <select
              className="ci-wz-select"
              value={form.govtIdType}
              onChange={e => { setField('govtIdType')(e.target.value); setField('govtIdNumber')(''); }}
            >
              <option value="">Select ID Type</option>
              {GOVT_ID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {form.govtIdType && (
            <div className="ci-wz-input-wrap" style={{ marginTop: 8 }}>
              <span className="ci-wz-icon"><IconIdCard /></span>
              <input
                className={`ci-wz-input${errors.govtIdNumber ? ' error' : ''}`}
                type="text"
                placeholder={`Enter ${form.govtIdType} number`}
                value={form.govtIdNumber}
                onChange={sf('govtIdNumber')}
                autoComplete="off"
              />
            </div>
          )}
          {errors.govtIdNumber && <span className="ci-wz-field-error">{errors.govtIdNumber}</span>}
        </div>

        {/* Person to Meet */}
        <div className="ci-wz-field">
          <label className="ci-wz-label" htmlFor="wz-person">
            Person to Meet <span className="ci-wz-req">*</span>
          </label>
          <div className="ci-wz-select-wrap">
            <span className="ci-wz-icon"><IconUser /></span>
            <select
              id="wz-person"
              className={`ci-wz-select${errors.personToMeet ? ' error' : ''}`}
              value={form.personToMeet}
              onChange={e => {
                setField('personToMeet')(e.target.value);
                const staff = staffMembers.find(s => s.name === e.target.value);
                if (staff && !form.hostDepartment) setField('hostDepartment')(staff.department);
                setErrors(prev => ({ ...prev, personToMeet: '' }));
              }}
            >
              <option value="">Select a person…</option>
              {staffMembers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          {errors.personToMeet && <span className="ci-wz-field-error">{errors.personToMeet}</span>}
        </div>

        {/* Host Department */}
        <div className="ci-wz-field">
          <label className="ci-wz-label" htmlFor="wz-dept">Host Department</label>
          <div className="ci-wz-select-wrap">
            <span className="ci-wz-icon"><IconBriefcase /></span>
            <select id="wz-dept" className="ci-wz-select" value={form.hostDepartment} onChange={sf('hostDepartment')}>
              <option value="">Select a department</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* Reason for Visit */}
        <div className="ci-wz-field">
          <label className="ci-wz-label" htmlFor="wz-reason">
            Reason for Visit <span className="ci-wz-opt">(Optional)</span>
          </label>
          <textarea
            id="wz-reason"
            className="ci-wz-textarea"
            placeholder="e.g. Scheduled meeting"
            rows={3}
            value={form.reasonForVisit}
            onChange={sf('reasonForVisit')}
          />
        </div>

        {/* Lead / Visitor Card Number */}
        <div className="ci-wz-field">
          <label className="ci-wz-label" htmlFor="wz-card">
            {form.visitType === 'Group' ? 'Lead Card Number' : 'Visitor Card Number'}{' '}
            <span className="ci-wz-opt">(Optional)</span>
          </label>
          <div className="ci-wz-input-wrap">
            <span className="ci-wz-icon"><IconCreditCard /></span>
            <input
              id="wz-card"
              className="ci-wz-input"
              type="text"
              placeholder="e.g. 123"
              value={form.cardNumber}
              onChange={sf('cardNumber')}
              autoComplete="off"
            />
          </div>
        </div>

        {/* Sub-Visitors — Group only */}
        {form.visitType === 'Group' && (
          <div className="ci-wz-field">
            <div className="ci-subvisitors-header">
              <span className="ci-wz-label" style={{ marginBottom: 0 }}>Sub-Visitors</span>
              <button
                type="button"
                className="ci-subvisitors-add-btn"
                onClick={() => setField('subVisitors')([...form.subVisitors, { name: '', cardNumber: '' }])}
              >
                <IconPlus /> Add Member
              </button>
            </div>

            {form.subVisitors.length > 0 && (
              <div className="ci-subvisitors-list">
                <div className="ci-subvisitors-list-header">
                  <span>Name</span>
                  <span>Card #</span>
                  <span />
                </div>
                {form.subVisitors.map((sv, idx) => (
                  <div key={idx} className="ci-subvisitors-row">
                    <input
                      className="ci-wz-input ci-subvisitor-input"
                      type="text"
                      placeholder="Guest name"
                      value={sv.name}
                      onChange={e => {
                        const updated = form.subVisitors.map((s, i) => i === idx ? { ...s, name: e.target.value } : s);
                        setField('subVisitors')(updated);
                      }}
                      autoComplete="off"
                      aria-label={`Sub-visitor ${idx + 1} name`}
                    />
                    <input
                      className="ci-wz-input ci-subvisitor-input"
                      type="text"
                      placeholder="Card #"
                      value={sv.cardNumber}
                      onChange={e => {
                        const updated = form.subVisitors.map((s, i) => i === idx ? { ...s, cardNumber: e.target.value } : s);
                        setField('subVisitors')(updated);
                      }}
                      autoComplete="off"
                      aria-label={`Sub-visitor ${idx + 1} card number`}
                    />
                    <button
                      type="button"
                      className="ci-subvisitor-delete"
                      onClick={() => setField('subVisitors')(form.subVisitors.filter((_, i) => i !== idx))}
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

      </div>

      <div className="ci-wizard-footer">
        <button className="ci-btn-cancel" onClick={onBack}>← Back</button>
        <button className="ci-btn-primary" onClick={handleNext}>Next</button>
      </div>
    </div>
  );
};

// ── Step 3: Photo capture ──────────────────────────────────────────────────────

const Step3Photo = ({ form, setField, onBack, onSubmit, submitting }) => {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [camState,  setCamState]  = useState('idle');   // 'idle'|'loading'|'ready'|'error'
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
    // Mirror the capture so the saved image matches real-world orientation
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
    <div className="ci-wizard-step">
      <div className="ci-wizard-step-padded">
        <div className="ci-camera-viewport">
          {!form.photo ? (
            <>
              <video
                ref={videoRef}
                autoPlay muted playsInline
                className="ci-camera-video"
                style={{ display: camState === 'ready' ? 'block' : 'none' }}
              />
              {camState === 'loading' && (
                <div className="ci-camera-overlay-msg">
                  <div className="ci-camera-spinner" />
                  <span>Starting camera…</span>
                </div>
              )}
              {camState === 'error' && (
                <div className="ci-camera-overlay-msg">
                  <IconCamera />
                  <p>{camError}</p>
                </div>
              )}
              {camState === 'ready' && <div className="ci-face-guide" />}
            </>
          ) : (
            <>
              <img src={form.photo} alt="Captured selfie" className="ci-camera-video" style={{ objectFit: 'cover' }} />
              <div className="ci-captured-badge"><IconCheckVerified /> Photo captured</div>
            </>
          )}
          <canvas ref={canvasRef} hidden />
        </div>

        {!form.photo && camState !== 'error' && (
          <p className="ci-camera-hint">Position your face in the centre and tap Capture.</p>
        )}

        <div className="ci-photo-actions">
          {!form.photo ? (
            <>
              <button className="ci-btn-capture" onClick={capturePhoto} disabled={camState !== 'ready'}>
                <IconCamera /> Capture Selfie
              </button>
              <button className="ci-btn-skip-photo" onClick={() => handleSubmit(true)} disabled={submitting}>
                {submitting ? 'Checking in…' : 'Skip'}
              </button>
            </>
          ) : (
            <button className="ci-btn-retake" onClick={startCamera}>
              <IconRefresh /> Retake
            </button>
          )}
        </div>

        {submitErr && <p className="ci-wz-error" style={{ marginLeft: 0 }}>{submitErr}</p>}
      </div>

      <div className="ci-wizard-footer">
        <button className="ci-btn-cancel" onClick={onBack} disabled={submitting}>← Back</button>
        <button className="ci-btn-primary" onClick={() => handleSubmit(false)} disabled={submitting}>
          {submitting ? 'Checking in…' : 'Add and Check-in'}
        </button>
      </div>
    </div>
  );
};

// ── Visitor Check-in Wizard ────────────────────────────────────────────────────

const VisitorCheckInWizard = ({ onClose, onBack, onSuccess }) => {
  const TOTAL    = 3;
  const modalRef = useRef(null);
  const [step,         setStep]       = useState(1);
  const [submitting,   setSubmitting] = useState(false);
  const [staffMembers, setStaff]      = useState([]);
  const [departments,  setDepts]      = useState([]);
  const [locations,    setLocs]       = useState([]);

  const [form, setForm] = useState({
    mobile: '', otpCode: '', otpVerified: false,
    visitType: 'Individual', location: '',
    fullName: '', email: '', govtIdType: '', govtIdNumber: '',
    personToMeet: '', hostDepartment: '', reasonForVisit: '', cardNumber: '',
    subVisitors: [],  // [{ name: string, cardNumber: string }] — Group visits only
    photo: null,
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
      const isGroup = form.visitType === 'Group' && form.subVisitors.some(sv => sv.name.trim());
      let entry;

      if (isGroup) {
        entry = await checkInGroup({
          fullName:             form.fullName,
          locationId:           form.location,
          identificationNumber: form.mobile,
          govtId:               form.govtIdNumber || null,
          personToMeet:         form.personToMeet || null,
          cardNumber:           form.cardNumber   || null,
          members:              form.subVisitors.filter(sv => sv.name.trim()),
        });
      } else {
        entry = await checkInSingle({
          visitorType:          'NONEMPLOYEE',
          fullName:             form.fullName,
          locationId:           form.location,
          identificationNumber: form.mobile,
          govtId:               form.govtIdNumber || null,
          personToMeet:         form.personToMeet || null,
          cardNumber:           form.cardNumber   || null,
        });
      }

      onSuccess(entry);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="ci-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="ci-wizard-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ci-wizard-title"
        ref={modalRef}
      >
        {/* Fixed header */}
        <div className="ci-wizard-head">
          <div>
            <h2 id="ci-wizard-title">Add New Visitor</h2>
            <p>Manually enter the details for a new visitor.</p>
          </div>
          <button className="ci-modal-close" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>

        {/* Progress bar */}
        <WizardProgress step={step} totalSteps={TOTAL} />

        {/* Steps */}
        {step === 1 && <Step1Mobile form={form} setField={setField} onNext={() => setStep(2)} />}
        {step === 2 && (
          <Step2Details
            form={form} setField={setField}
            staffMembers={staffMembers} departments={departments} locations={locations}
            onNext={() => setStep(3)} onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3Photo
            form={form} setField={setField}
            onBack={() => setStep(2)} onSubmit={handleSubmit} submitting={submitting}
          />
        )}
      </div>
    </div>
  );
};

export default VisitorCheckInWizard;
