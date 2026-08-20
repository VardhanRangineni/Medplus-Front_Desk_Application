import { useState, useEffect, useRef } from 'react';
import './AddVisitorModal.css';
import {
  IconX,
  IconUser,
  IconPhone,
  IconMail,
  IconCreditCard,
  IconBuilding,
  IconPlus,
  IconTrash,
} from '../../../components/Icons/Icons';
import {
  sendOtp,
  verifyOtp,
  createVisitorEntry,
  createGroupVisitorEntries,
} from './addVisitorService';
import PersonToMeetMobileLookup from '../PersonToMeetMobileLookup';
import { PRESET_REASONS } from '../../../constants/visitReasons';

const AADHAAR_REGEX = /^\d{12}$/;
const OTP_RESEND_SECONDS = 30;

function Field({ label, required, children, error }) {
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
          ? 'Add multiple visitors. Each mobile must be OTP-verified. Shared details apply to all.'
          : 'Single visitor. Name and mobile verified first, then visit details.'}
      </p>
    </div>
  );
}

function useOtpControls(mobile, verified, onVerified) {
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [sendError, setSendError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sentToMobile, setSentToMobile] = useState('');
  const otpInputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

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
    if (mobile.length < 10 || sending || verified) return;
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

  async function handleVerify() {
    if (otp.length !== 5 || verifying || verified) return;
    setVerifying(true);
    setOtpError('');
    try {
      const res = await verifyOtp(mobile, otp);
      if (res.verified) {
        if (timerRef.current) clearInterval(timerRef.current);
        setCountdown(0);
        onVerified?.(mobile);
      } else {
        setOtpError(res.message || 'Invalid OTP. Please try again.');
      }
    } catch (e) {
      setOtpError(e?.message || 'Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  }

  function resetOtpUi() {
    setOtpSent(false);
    setOtp('');
    setOtpError('');
    setSendError('');
    setCountdown(0);
    setSentToMobile('');
    if (timerRef.current) clearInterval(timerRef.current);
  }

  return {
    otpSent, otp, setOtp, sending, verifying, otpError, setOtpError,
    sendError, countdown, otpInputRef,
    handleSendOtp, handleVerify, resetOtpUi,
  };
}

function MobileOtpBlock({
  mobile, onMobileChange, verified, onVerified, onChangeNumber, disabled,
}) {
  const otp = useOtpControls(mobile, verified, onVerified);

  return (
    <>
      <Field label="Mobile Number" required>
        <div className="avm-side-by-side">
          <InputWithIcon
            icon={<IconPhone size={14} />}
            type="tel"
            inputMode="numeric"
            placeholder="10-digit mobile number"
            value={mobile}
            maxLength={10}
            disabled={verified || disabled}
            onChange={(e) => onMobileChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
          />
          {!verified && (
            <button
              type="button"
              className={`avm-otp-btn${otp.otpSent && otp.countdown > 0 ? ' avm-otp-btn--waiting' : ''}`}
              onClick={otp.otpSent && otp.countdown === 0 ? otp.handleSendOtp : otp.handleSendOtp}
              disabled={mobile.length < 10 || otp.sending || (otp.otpSent && otp.countdown > 0) || disabled}
            >
              {otp.sending
                ? 'Sending…'
                : otp.otpSent
                  ? (otp.countdown > 0 ? `Resend (${otp.countdown}s)` : 'Resend OTP')
                  : 'Send OTP'}
            </button>
          )}
        </div>
      </Field>

      {otp.sendError && (
        <div className="avm-send-error-banner" role="alert">
          {otp.sendError}
        </div>
      )}

      {otp.otpSent && !verified && (
        <Field label="One-Time Password">
          <div className="avm-side-by-side">
            <input
              ref={otp.otpInputRef}
              className="avm-input avm-input--otp"
              type="text"
              inputMode="numeric"
              placeholder="_ _ _ _ _"
              value={otp.otp}
              maxLength={5}
              autoComplete="one-time-code"
              disabled={disabled}
              onChange={(e) => {
                otp.setOtpError('');
                otp.setOtp(e.target.value.replace(/\D/g, '').slice(0, 5));
              }}
              onKeyDown={(e) => { if (e.key === 'Enter' && otp.otp.length === 5) otp.handleVerify(); }}
            />
            <button
              type="button"
              className="avm-otp-btn"
              onClick={otp.handleVerify}
              disabled={otp.otp.length !== 5 || otp.verifying || disabled}
            >
              {otp.verifying ? 'Verifying…' : 'Verify OTP'}
            </button>
          </div>
          {otp.otpError && <p className="avm-error" style={{ marginTop: 4 }}>{otp.otpError}</p>}
        </Field>
      )}

      {verified && (
        <div className="avm-verified">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="11" fill="#28883d" />
            <path d="M6 11.5L9.5 15L16 8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="avm-verified__text">
            <div className="avm-verified__title">Mobile Verified</div>
            <div className="avm-verified__sub">+91 {mobile}</div>
          </div>
          {onChangeNumber && (
            <button
              type="button"
              className="avm-btn-link avm-verified__change"
              onClick={() => { otp.resetOtpUi(); onChangeNumber(); }}
              disabled={disabled}
            >
              Change
            </button>
          )}
        </div>
      )}
    </>
  );
}

function StepIdentity({
  isGroup,
  fullName, onFullNameChange,
  mobile, onMobileChange, verified, onVerified, onChangeNumber,
  cardNumber, onCardNumberChange,
  members, onMemberChange, onAddMember, onRemoveMember,
}) {
  return (
    <div className="avm-step">
      <div className="avm-otp-intro">
        <div className="avm-otp-intro__icon">
          <IconPhone size={26} />
        </div>
        <p className="avm-otp-intro__title">
          {isGroup ? 'Add Group Visitors' : "Verify Visitor's Mobile"}
        </p>
        <p className="avm-otp-intro__sub">
          {isGroup
            ? 'Enter name, mobile, and card for each visitor. OTP must be verified for every number before continuing.'
            : 'Enter the visitor name, mobile, and card number. An OTP will be sent to confirm identity.'}
        </p>
      </div>

      {!isGroup && (
        <>
          <Field label="Full Name" required>
            <InputWithIcon
              icon={<IconUser size={14} />}
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => onFullNameChange(e.target.value)}
              disabled={verified}
            />
          </Field>
          <MobileOtpBlock
            mobile={mobile}
            onMobileChange={onMobileChange}
            verified={verified}
            onVerified={onVerified}
            onChangeNumber={onChangeNumber}
          />
          <Field label="Visitor ID Card Number" required>
            <InputWithIcon
              icon={<IconCreditCard size={14} />}
              type="text"
              inputMode="numeric"
              placeholder="Enter printed card number"
              value={cardNumber}
              onChange={(e) => onCardNumberChange(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
        </>
      )}

      {isGroup && (
        <div className="avm-member-list">
          {members.map((m, idx) => (
            <div key={m.key} className="avm-member-card">
              <div className="avm-member-card__head">
                <span className="avm-member-card__title">Visitor {idx + 1}</span>
                {members.length > 1 && (
                  <button
                    type="button"
                    className="avm-member-card__remove"
                    onClick={() => onRemoveMember(m.key)}
                    aria-label={`Remove visitor ${idx + 1}`}
                    disabled={m.verified}
                    title="Remove"
                  >
                    <IconTrash size={14} />
                  </button>
                )}
              </div>
              <Field label="Full Name" required>
                <InputWithIcon
                  icon={<IconUser size={14} />}
                  type="text"
                  placeholder="John Doe"
                  value={m.fullName}
                  disabled={m.verified}
                  onChange={(e) => onMemberChange(m.key, { fullName: e.target.value })}
                />
              </Field>
              <MobileOtpBlock
                mobile={m.mobile}
                onMobileChange={(v) => onMemberChange(m.key, { mobile: v, verified: false })}
                verified={m.verified}
                onVerified={() => onMemberChange(m.key, { verified: true })}
                onChangeNumber={() => onMemberChange(m.key, { verified: false, mobile: '' })}
              />
              <Field label="Visitor ID Card Number" required>
                <InputWithIcon
                  icon={<IconCreditCard size={14} />}
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter printed card number"
                  value={m.cardNumber}
                  onChange={(e) => onMemberChange(m.key, {
                    cardNumber: e.target.value.replace(/\D/g, ''),
                  })}
                />
              </Field>
            </div>
          ))}
          <button type="button" className="avm-add-member" onClick={onAddMember}>
            <IconPlus size={14} />
            Add visitor
          </button>
        </div>
      )}
    </div>
  );
}

function StepDetails({ state, dispatch }) {
  const {
    email, govtIdNumber,
    personToMeet, personToMeetCustom, reasonForVisit,
    representsCompany, companyName,
  } = state;

  return (
    <div className="avm-step">
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
        label="Aadhaar Number (Optional)"
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

      <PersonToMeetMobileLookup
        personToMeet={personToMeet}
        personToMeetCustom={personToMeetCustom}
        onChange={(updates) => dispatch({ type: 'SET_PERSON_TO_MEET_BULK', ...updates })}
      />

      <Field label="Representing a Company?">
        <div className="avm-toggle-row">
          <label className="avm-toggle-label" htmlFor="avm-company-toggle">
            {representsCompany ? 'Yes — enter company name below' : 'No'}
          </label>
          <button
            id="avm-company-toggle"
            type="button"
            role="switch"
            aria-checked={representsCompany}
            className={`avm-toggle-switch${representsCompany ? ' avm-toggle-switch--on' : ''}`}
            onClick={() => dispatch({ type: 'SET_FIELD', field: 'representsCompany', value: !representsCompany })}
          >
            <span className="avm-toggle-switch__thumb" />
          </button>
        </div>
        {representsCompany && (
          <div style={{ marginTop: 8 }}>
            <InputWithIcon
              icon={<IconBuilding size={14} />}
              type="text"
              placeholder="Enter company / organisation name"
              value={companyName}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'companyName', value: e.target.value })}
              autoFocus
            />
          </div>
        )}
      </Field>

      <Field label="Reason for Visit" required>
        <div className="avm-reason-chips">
          {PRESET_REASONS.map((r) => (
            <button
              key={r.label}
              type="button"
              className="avm-reason-chip"
              onClick={() => dispatch({ type: 'SET_FIELD', field: 'reasonForVisit', value: r.text })}
            >
              {r.label}
            </button>
          ))}
        </div>
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
    </div>
  );
}

const STEPS = [
  { label: 'Identity' },
  { label: 'Visitor Details' },
];

const initialDetails = {
  email: '',
  govtIdNumber: '',
  personToMeet: '',
  personToMeetCustom: '',
  hostDepartment: '',
  reasonForVisit: '',
  representsCompany: false,
  companyName: '',
};

let memberKeySeq = 1;
function newMember() {
  return { key: `m-${memberKeySeq++}`, fullName: '', mobile: '', cardNumber: '', verified: false };
}

export default function AddVisitorModal({ onClose, onSuccess }) {
  const [isGroup, setIsGroup] = useState(false);
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [mobileVerified, setMobileVerified] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [members, setMembers] = useState([newMember()]);
  const [details, setDetails] = useState(initialDetails);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  function dispatch(action) {
    switch (action.type) {
      case 'SET_FIELD':
        setDetails((s) => ({ ...s, [action.field]: action.value }));
        break;
      case 'SET_PERSON_TO_MEET_BULK': {
        const { type: _t, ...updates } = action;
        setDetails((s) => ({ ...s, ...updates }));
        break;
      }
      default:
        break;
    }
  }

  function handleModeChange(nextIsGroup) {
    if (nextIsGroup === isGroup) return;
    setIsGroup(nextIsGroup);
    setStep(0);
    setSubmitError('');
    setFullName('');
    setMobile('');
    setMobileVerified(false);
    setCardNumber('');
    setMembers([newMember()]);
    setDetails(initialDetails);
  }

  function handleMemberChange(key, patch) {
    setMembers((list) => list.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  }

  const step0Valid = isGroup
    ? members.length >= 1
      && members.every((m) =>
        m.fullName.trim()
        && m.mobile.length === 10
        && m.verified
        && String(m.cardNumber || '').trim() !== '')
    : fullName.trim() !== ''
      && mobileVerified
      && cardNumber.trim() !== '';

  const detailsValid = details.personToMeet.trim() !== ''
    && details.reasonForVisit.trim() !== ''
    && (details.govtIdNumber === '' || AADHAAR_REGEX.test(details.govtIdNumber));

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const shared = {
        email: details.email,
        govtIdType: details.govtIdNumber ? 'AADHAAR' : '',
        govtIdNumber: details.govtIdNumber,
        personToMeet: details.personToMeet,
        personToMeetCustom: details.personToMeetCustom,
        hostDepartment: details.hostDepartment,
        reasonForVisit: details.reasonForVisit,
        companyName: details.representsCompany ? details.companyName.trim() : '',
      };

      if (isGroup) {
        const result = await createGroupVisitorEntries({
          ...shared,
          members: members.map((m) => ({
            fullName: m.fullName.trim(),
            mobile: m.mobile,
            cardNumber: m.cardNumber,
          })),
        });
        if (result.success) {
          onSuccess?.(result);
          onClose();
        }
      } else {
        const result = await createVisitorEntry({
          ...shared,
          visitType: 'INDIVIDUAL',
          mobile,
          fullName: fullName.trim(),
          cardNumber,
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

  const progressPct = ((step + 1) / STEPS.length) * 100;

  return (
    <div
      className="avm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avm-title"
      onClick={handleOverlayClick}
    >
      <div className="avm-dialog avm-dialog--visitor">
        <div className="avm-header">
          <div>
            <h2 className="avm-title" id="avm-title">
              {isGroup ? 'Add Group Visit' : 'Add New Visitor'}
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
            disabled={submitting || step > 0}
          />
        </div>

        <div className="avm-progress" aria-hidden="true">
          <div className="avm-progress__fill" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="avm-body">
          {step === 0 && (
            <StepIdentity
              isGroup={isGroup}
              fullName={fullName}
              onFullNameChange={setFullName}
              mobile={mobile}
              onMobileChange={setMobile}
              verified={mobileVerified}
              onVerified={(m) => { setMobileVerified(true); setMobile(m); }}
              onChangeNumber={() => { setMobileVerified(false); setMobile(''); }}
              cardNumber={cardNumber}
              onCardNumberChange={setCardNumber}
              members={members}
              onMemberChange={handleMemberChange}
              onAddMember={() => setMembers((list) => [...list, newMember()])}
              onRemoveMember={(key) => setMembers((list) => list.filter((m) => m.key !== key))}
            />
          )}

          {step === 1 && (
            <StepDetails state={details} dispatch={dispatch} />
          )}
        </div>

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

          {step === 0 && (
            <button
              className="avm-btn avm-btn--next"
              onClick={() => setStep(1)}
              disabled={!step0Valid}
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
              {submitting ? 'Adding…' : (isGroup ? 'Add Group and Check-in' : 'Add and Check-in')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
