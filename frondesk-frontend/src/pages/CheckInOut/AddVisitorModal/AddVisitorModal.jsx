import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './AddVisitorModal.css';
import {
  IconX,
  IconUser,
  IconPhone,
  IconMail,
  IconCreditCard,
  IconBuilding,
  IconChevronDown,
} from '../../../components/Icons/Icons';
import {
  sendOtp,
  verifyOtp,
  getPersonsToMeet,
  getDepartments,
  createVisitorEntry,
  updateVisitorEntry,
} from './addVisitorService';

// ─── Constants ────────────────────────────────────────────────────────────────
const AADHAAR_REGEX       = /^\d{12}$/;
const OTP_RESEND_SECONDS  = 30;

// ─── Shared primitives ────────────────────────────────────────────────────────

function Field({ label, required, children, hint, error }) {
  return (
    <div className="avm-field">
      {label && (
        <label className="avm-label">
          {label}
          {required && <span className="avm-label__req" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error && <p className="avm-error" style={{ marginTop: 4, fontSize: 11 }}>{error}</p>}
      {hint && !error && <p className="avm-hint">{hint}</p>}
    </div>
  );
}

function InputWithIcon({ icon, inputRef, ...props }) {
  return (
    <div className="avm-input-wrap">
      <span className="avm-input-icon">{icon}</span>
      <input className="avm-input" ref={inputRef} {...props} />
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

// ─── Step 0 — OTP verification ────────────────────────────────────────────────
//
// Props:
//   mobile          – current mobile string (controlled by parent)
//   onMobileChange  – setter for mobile
//   verified        – boolean from parent (survives step navigation)
//   onVerified      – called with (mobile) when OTP is confirmed
//   onChangeNumber  – called when user wants to re-enter mobile (resets verified)
//
function StepOtp({ mobile, onMobileChange, verified, onVerified, onChangeNumber }) {
  const [otpSent,      setOtpSent]      = useState(false);
  const [otp,          setOtp]          = useState('');
  const [sending,      setSending]      = useState(false);
  const [verifying,    setVerifying]    = useState(false);
  const [otpError,     setOtpError]     = useState('');
  const [sendError,    setSendError]    = useState('');
  const [countdown,    setCountdown]    = useState(0);
  const [sentToMobile, setSentToMobile] = useState('');

  const otpInputRef = useRef(null);
  const timerRef    = useRef(null);

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // If the mobile changes after OTP was sent (but not yet verified), reset the OTP step
  useEffect(() => {
    if (mobile !== sentToMobile && otpSent) {
      setOtpSent(false);
      setOtp('');
      setOtpError('');
      setSendError('');
      setCountdown(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [mobile, sentToMobile, otpSent]);

  function startCountdown() {
    setCountdown(OTP_RESEND_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  async function handleSendOtp() {
    if (mobile.length < 10 || sending) return;
    setSending(true);
    setSendError('');
    setOtpError('');
    try {
      const res = await sendOtp(mobile);
      if (res.success) {
        setOtpSent(true);
        setSentToMobile(mobile);
        setOtp('');
        startCountdown();
        setTimeout(() => otpInputRef.current?.focus(), 80);
      } else {
        setSendError(res.message || 'Failed to send OTP. Please try again.');
      }
    } catch (e) {
      setSendError(e?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function handleResend() {
    if (countdown > 0 || sending) return;
    await handleSendOtp();
  }

  async function handleVerify() {
    if (otp.length !== 6 || verifying) return;
    setVerifying(true);
    setOtpError('');
    try {
      const res = await verifyOtp(mobile, otp);
      if (res.verified) {
        if (timerRef.current) clearInterval(timerRef.current);
        setCountdown(0);
        onVerified(mobile);
      } else {
        setOtpError(res.message || 'Invalid OTP. Please try again.');
      }
    } catch (e) {
      setOtpError(e?.message || 'Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="avm-step">

      {/* Intro block */}
      <div className="avm-otp-intro">
        <div className="avm-otp-intro__icon">
          <IconPhone size={26} />
        </div>
        <p className="avm-otp-intro__title">Verify Visitor's Mobile</p>
        <p className="avm-otp-intro__sub">
          Enter the visitor's mobile number. An OTP will be sent to confirm identity
          before proceeding to fill the details.
        </p>
      </div>

      {/* Mobile input row */}
      <Field label="Mobile Number" required error={sendError || null}>
        <div className="avm-side-by-side">
          <InputWithIcon
            icon={<IconPhone size={14} />}
            type="tel"
            inputMode="numeric"
            placeholder="10-digit mobile number"
            value={mobile}
            maxLength={10}
            disabled={verified}
            onChange={(e) => onMobileChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
          />
          {!verified && (
            <button
              type="button"
              className={`avm-otp-btn${otpSent && countdown > 0 ? ' avm-otp-btn--waiting' : ''}`}
              onClick={otpSent ? handleResend : handleSendOtp}
              disabled={mobile.length < 10 || sending || (otpSent && countdown > 0)}
            >
              {sending
                ? 'Sending…'
                : otpSent
                  ? (countdown > 0 ? `Resend (${countdown}s)` : 'Resend OTP')
                  : 'Send OTP'}
            </button>
          )}
        </div>
      </Field>

      {/* OTP input row — shown only after OTP is sent and not yet verified */}
      {otpSent && !verified && (
        <Field label="One-Time Password">
          <div className="avm-side-by-side">
            <input
              ref={otpInputRef}
              className="avm-input avm-input--otp"
              type="text"
              inputMode="numeric"
              placeholder="_ _ _ _ _ _"
              value={otp}
              maxLength={6}
              autoComplete="one-time-code"
              onChange={(e) => { setOtpError(''); setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && otp.length === 6) handleVerify(); }}
            />
            <button
              type="button"
              className="avm-otp-btn"
              onClick={handleVerify}
              disabled={otp.length !== 6 || verifying}
            >
              {verifying ? 'Verifying…' : 'Verify OTP'}
            </button>
          </div>
          {otpError && <p className="avm-error" style={{ marginTop: 4 }}>{otpError}</p>}
          {!otpError && (
            <p className="avm-hint">OTP sent to +91 {sentToMobile} · Check the visitor's phone.</p>
          )}
        </Field>
      )}

      {/* Verified banner */}
      {verified && (
        <div className="avm-verified">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="11" fill="#28883d" />
            <path d="M6 11.5L9.5 15L16 8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#28883d' }}>Mobile Verified</div>
            <div style={{ fontSize: 11.5, color: '#3da85a', marginTop: 1 }}>
              +91 {mobile} · Proceed to fill visitor details.
            </div>
          </div>
          <button type="button" className="avm-btn-link" onClick={onChangeNumber}>
            Change
          </button>
        </div>
      )}

    </div>
  );
}

// ─── Step 1 — Visitor details ──────────────────────────────────────────────────
function StepDetails({ state, dispatch, refData }) {
  const {
    fullName, email, govtIdNumber,
    personToMeet, hostDepartment, reasonForVisit, cardNumber,
  } = state;

  const { persons, departments } = refData;

  return (
    <div className="avm-step">

      <Field label="Full Name" required>
        <InputWithIcon
          icon={<IconUser size={14} />}
          type="text"
          placeholder="John Doe"
          value={fullName}
          onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'fullName', value: e.target.value })}
        />
      </Field>

      <Field label="Email (Optional)">
        <InputWithIcon
          icon={<IconMail size={14} />}
          type="email"
          placeholder="john.doe@example.com"
          value={email}
          onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'email', value: e.target.value })}
        />
      </Field>

      <Field
        label="Aadhaar Number"
        required
        error={govtIdNumber && !AADHAAR_REGEX.test(govtIdNumber) ? 'Aadhaar number must be exactly 12 digits' : null}
      >
        <InputWithIcon
          icon={<IconCreditCard size={14} />}
          type="text"
          inputMode="numeric"
          placeholder="12-digit Aadhaar number"
          value={govtIdNumber}
          maxLength={12}
          onChange={(e) =>
            dispatch({ type: 'SET_FIELD', field: 'govtIdNumber', value: e.target.value.replace(/\D/g, '').slice(0, 12) })
          }
        />
      </Field>

      <Field label="Person To Meet" required>
        <SelectField
          placeholder="Select a person…"
          value={personToMeet}
          onChange={(v) => dispatch({ type: 'SET_PERSON_TO_MEET', value: v })}
          options={persons.map((p) => ({ id: p.id, name: `${p.name} — ${p.department}` }))}
        />
      </Field>

      <Field label="Host Department">
        <SelectField
          icon={<IconBuilding size={14} />}
          placeholder="Select a department"
          value={hostDepartment}
          onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'hostDepartment', value: v })}
          options={departments}
        />
      </Field>

      <Field label="Reason for Visit">
        <textarea
          className="avm-textarea"
          placeholder="e.g. Scheduled meeting"
          rows={3}
          value={reasonForVisit}
          onChange={(e) =>
            dispatch({ type: 'SET_FIELD', field: 'reasonForVisit', value: e.target.value })
          }
        />
      </Field>

      <Field label="Visitor Card Number">
        <InputWithIcon
          icon={<IconCreditCard size={14} />}
          type="text"
          placeholder="Leave blank to auto-assign"
          value={cardNumber}
          onChange={(e) =>
            dispatch({ type: 'SET_FIELD', field: 'cardNumber', value: e.target.value })
          }
        />
        <span style={{ fontSize: 11, color: '#aaa', marginTop: 2, display: 'block' }}>
          A card will be automatically assigned if left blank.
        </span>
      </Field>

    </div>
  );
}

// ─── Step definitions ─────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Verify Mobile' },
  { label: 'Visitor Details' },
];

// ─── Initial detail-form state ────────────────────────────────────────────────
const initialDetails = {
  fullName:       '',
  email:          '',
  govtIdNumber:   '',
  personToMeet:   '',
  hostDepartment: '',
  reasonForVisit: '',
  cardNumber:     '',
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function AddVisitorModal({ onClose, onSuccess }) {

  // ── Wizard state ─────────────────────────────────────────────────────────
  const [step,           setStep]          = useState(0);          // 0 = OTP, 1 = Details
  const [mobile,         setMobile]        = useState('');
  const [mobileVerified, setMobileVerified] = useState(false);

  // ── Detail-form state ─────────────────────────────────────────────────────
  const [details,          setDetails]         = useState(initialDetails);
  const [submitting,       setSubmitting]       = useState(false);
  const [submitError,      setSubmitError]      = useState('');
  const [assignedCardHint, setAssignedCardHint] = useState(null);

  // ── Reference data ────────────────────────────────────────────────────────
  const [persons,     setPersons]     = useState([]);
  const [departments, setDepartments] = useState([]);
  const [refLoading,  setRefLoading]  = useState(true);
  const [refError,    setRefError]    = useState('');

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // Load reference data as soon as modal mounts (not on step change)
  useEffect(() => {
    setRefLoading(true);
    setRefError('');
    Promise.all([getPersonsToMeet(), getDepartments()])
      .then(([pers, depts]) => {
        setPersons(pers);
        setDepartments(depts);
        if (pers.length === 0) {
          setRefError('No employees found at your location. Contact your administrator.');
        }
      })
      .catch((err) => {
        setRefError(err?.message || 'Failed to load form data. Please close and reopen this modal.');
      })
      .finally(() => setRefLoading(false));
  }, []);

  // Escape key handler
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ── Detail-form dispatcher ────────────────────────────────────────────────
  function dispatch(action) {
    switch (action.type) {
      case 'SET_FIELD':
        setDetails((s) => ({ ...s, [action.field]: action.value }));
        break;

      case 'SET_PERSON_TO_MEET': {
        const person = persons.find((p) => p.id === action.value);
        const dept   = person ? departments.find((d) => d.name === person.department) : null;
        setDetails((s) => ({
          ...s,
          personToMeet:   action.value,
          hostDepartment: dept ? dept.id : s.hostDepartment,
        }));
        break;
      }

      default:
        break;
    }
  }

  // ── Form validity for step 1 ──────────────────────────────────────────────
  const detailsValid = !refLoading
    && details.fullName.trim() !== ''
    && details.personToMeet !== ''
    && AADHAAR_REGEX.test(details.govtIdNumber);

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        mobile,
        visitType:      'individual',
        fullName:       details.fullName,
        email:          details.email,
        govtIdType:     details.govtIdNumber ? 'AADHAAR' : '',
        govtIdNumber:   details.govtIdNumber,
        personToMeet:   details.personToMeet,
        hostDepartment: details.hostDepartment,
        reasonForVisit: details.reasonForVisit,
        cardNumber:     details.cardNumber,
      };
      const result = await createVisitorEntry(payload);
      if (result.success) {
        const assignedCard = result.cardCode || (result.card != null ? result.card : null);
        if (assignedCard) {
          setAssignedCardHint(assignedCard);
          setTimeout(() => { onSuccess?.(result); onClose(); }, 1800);
        } else {
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

  const progressPct = ((step + 1) / STEPS.length) * 100;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="avm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avm-title"
      onClick={handleOverlayClick}
    >
      <div className="avm-dialog">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="avm-header">
          <div>
            <h2 className="avm-title" id="avm-title">Add New Visitor</h2>
            <p className="avm-subtitle">
              Step {step + 1} of {STEPS.length} — {STEPS[step].label}
            </p>
          </div>
          <button className="avm-close" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>

        {/* ── Progress bar ────────────────────────────────────────────── */}
        <div className="avm-progress" aria-hidden="true">
          <div className="avm-progress__fill" style={{ width: `${progressPct}%` }} />
        </div>

        {/* ── Scrollable body ────────────────────────────────────────── */}
        <div className="avm-body">
          {step === 0 && (
            <StepOtp
              mobile={mobile}
              onMobileChange={setMobile}
              verified={mobileVerified}
              onVerified={(m) => { setMobileVerified(true); setMobile(m); }}
              onChangeNumber={() => { setMobileVerified(false); setMobile(''); }}
            />
          )}

          {step === 1 && (
            <>
              {refLoading && (
                <p className="avm-hint" style={{ textAlign: 'center', padding: '8px 0' }}>
                  Loading form data…
                </p>
              )}
              {!refLoading && refError && (
                <p className="avm-error" style={{ marginBottom: '12px' }}>{refError}</p>
              )}
              <StepDetails
                state={details}
                dispatch={dispatch}
                refData={{ persons, departments }}
              />
            </>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="avm-footer">
          {step > 0 && (
            <button
              className="avm-btn avm-btn--back"
              onClick={() => { setStep((s) => s - 1); setSubmitError(''); }}
              disabled={submitting}
            >
              ← Back
            </button>
          )}

          <div className="avm-footer__spacer" />

          {submitError && <p className="avm-error avm-error--footer">{submitError}</p>}

          {assignedCardHint && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              background: '#f0fdf4', border: '1.5px solid #bbf7d0',
              borderRadius: 9, padding: '10px 16px', fontSize: 13,
            }}>
              <span style={{ fontWeight: 700, color: '#16a34a', fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>
                Card Assigned
              </span>
              <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 18, color: '#111' }}>
                {assignedCardHint}
              </span>
              <span style={{ fontSize: 11, color: '#6b7280' }}>Hand this card to the visitor</span>
            </div>
          )}

          {step === 0 && (
            <button
              className="avm-btn avm-btn--next"
              onClick={() => setStep(1)}
              disabled={!mobileVerified}
            >
              Next →
            </button>
          )}

          {step === 1 && (
            <button
              className="avm-btn avm-btn--submit"
              onClick={handleSubmit}
              disabled={!detailsValid || submitting}
            >
              {submitting ? 'Adding…' : 'Add and Check-in'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
