import { useState, useEffect, useRef, useCallback } from 'react';
import './AddVisitorModal.css';
import { useToast } from '../../../components/AppToast/AppToast';
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
  lookupKnownVisitors,
  createVisitorEntry,
  createGroupVisitorEntries,
} from './addVisitorService';
import { getEntries } from '../checkInOutService';
import {
  scheduleDebouncedLookup,
  cancelDebouncedLookup,
  LOOKUP_DEBOUNCE_MS,
  MOBILE_LOOKUP_LENGTH,
} from '../../../utils/lookupDebounce';
import PersonToMeetMobileLookup from '../PersonToMeetMobileLookup';
import ReasonDropdown from '../../../components/ReasonDropdown/ReasonDropdown';
import SearchSelect from '../../../components/SearchSelect/SearchSelect';

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

/**
 * WarningCard — prominent inline warning displayed in the form body.
 */
function WarningCard({ message }) {
  return (
    <div className="avm-warning-card">
      <span className="avm-warning-card__icon" aria-hidden="true">⚠️</span>
      <div className="avm-warning-card__body">
        <p className="avm-warning-card__text">{message}</p>
      </div>
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
  // Known visitor props
  knownVisitors = [], selectedKnownVisitor = null, onSelectKnownVisitor,
  lookingUp = false, detailsEdited = false, onResetEdited,
}) {
  const otp = useOtpControls(mobile, verified, onVerified);

  // Show OTP only when NOT verified AND (no known visitor selected OR details were edited)
  const shouldShowOtp = !verified && (knownVisitors.length === 0 || detailsEdited);

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
          {!verified && shouldShowOtp && (
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

      {otp.otpSent && !verified && shouldShowOtp && (
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

      {/* Known visitor indicator */}
      {knownVisitors.length > 0 && !detailsEdited && (
        <div className="avm-known-visitor">
          <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="11" fill="#28883d" />
            <path d="M6 11.5L9.5 15L16 8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="avm-known-visitor__text">
            <div className="avm-known-visitor__title">Known Visitor</div>
            <div className="avm-known-visitor__sub">
              OTP skipped — verified from past visit
              {selectedKnownVisitor && selectedKnownVisitor.totalVisits > 1
                ? ` (${selectedKnownVisitor.totalVisits} visits)`
                : ''}
            </div>
          </div>
        </div>
      )}

      {/* Known visitor selector dropdown when multiple records */}
      {knownVisitors.length > 1 && !detailsEdited && (
        <div className="avm-known-selector">
          <label className="avm-label">Select Visitor Record</label>
          <SearchSelect
            value={selectedKnownVisitor ? String(selectedKnownVisitor.__idx) : ''}
            onChange={(val) => {
              const idx = parseInt(val, 10);
              if (!isNaN(idx)) {
                onSelectKnownVisitor(knownVisitors[idx]);
              }
            }}
            options={knownVisitors.map((kv, idx) => ({
              value: String(idx),
              label: kv.name + (kv.companyName ? ` — ${kv.companyName}` : '') + ` (last: ${kv.lastVisitDate})`
            }))}
            disabled={disabled}
            searchable={false}
          />
        </div>
      )}

      {/* Edit warning banner */}
      {detailsEdited && knownVisitors.length > 0 && !verified && (
        <div className="avm-edit-warning" role="alert">
          Details edited — OTP verification required to proceed.
        </div>
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
  // Known visitor props (individual only)
  knownVisitors, selectedKnownVisitor, onSelectKnownVisitor,
  lookingUp, detailsEdited, onResetEdited,
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
            : 'Enter the visitor mobile number first. Known visitors are auto-verified. New visitors require OTP.'}
        </p>
      </div>

      {!isGroup && (
        <>
          <MobileOtpBlock
            mobile={mobile}
            onMobileChange={onMobileChange}
            verified={verified}
            onVerified={onVerified}
            onChangeNumber={onChangeNumber}
            knownVisitors={knownVisitors}
            selectedKnownVisitor={selectedKnownVisitor}
            onSelectKnownVisitor={onSelectKnownVisitor}
            lookingUp={lookingUp}
            detailsEdited={detailsEdited}
            onResetEdited={onResetEdited}
          />
          <Field label="Full Name" required>
            <InputWithIcon
              icon={<IconUser size={14} />}
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => onFullNameChange(e.target.value)}
              // Note: intentionally NOT disabled — known visitors can edit pre-filled
              // name; edit detection in handleFullNameChange will re-require OTP
            />
          </Field>
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
            <GroupMemberCard
              key={m.key}
              m={m}
              idx={idx}
              membersLength={members.length}
              onRemoveMember={onRemoveMember}
              onMemberChange={onMemberChange}
            />
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
        <ReasonDropdown
          type="VISITOR"
          value={reasonForVisit}
          onChange={(val) => dispatch({ type: 'SET_FIELD', field: 'reasonForVisit', value: val })}
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

function GroupMemberCard({ m, idx, membersLength, onRemoveMember, onMemberChange }) {
  const [knownVisitors, setKnownVisitors] = useState([]);
  const [selectedKnownVisitor, setSelectedKnownVisitor] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [detailsEdited, setDetailsEdited] = useState(false);

  const lookupGenerationRef = useRef(0);
  const lookupTimerRef = useRef(null);

  const doLookup = useCallback(async (digits) => {
    if (digits.length < MOBILE_LOOKUP_LENGTH) {
      setKnownVisitors([]);
      setSelectedKnownVisitor(null);
      setDetailsEdited(false);
      return;
    }
    setLookingUp(true);
    try {
      const results = await lookupKnownVisitors(digits);
      setKnownVisitors(results);
      if (results.length > 0) {
        const selected = { ...results[0], __idx: 0 };
        setSelectedKnownVisitor(selected);
        onMemberChange(m.key, { fullName: selected.name || '', verified: true });
        setDetailsEdited(false);
      } else {
        setSelectedKnownVisitor(null);
        setDetailsEdited(false);
      }
    } catch (e) {
      setKnownVisitors([]);
      setSelectedKnownVisitor(null);
    } finally {
      setLookingUp(false);
    }
  }, [m.key, onMemberChange]);

  useEffect(() => {
    if (m.verified || knownVisitors.length > 0) return;
    if (m.mobile.length === MOBILE_LOOKUP_LENGTH) {
      scheduleDebouncedLookup(
        lookupGenerationRef,
        lookupTimerRef,
        () => doLookup(m.mobile)
      );
    } else if (m.mobile.length >= MOBILE_LOOKUP_LENGTH - 2) {
      cancelDebouncedLookup(lookupGenerationRef, lookupTimerRef);
    }
  }, [m.mobile, m.verified, knownVisitors.length, doLookup]);

  useEffect(() => {
    return () => cancelDebouncedLookup(lookupGenerationRef, lookupTimerRef);
  }, []);

  function handleSelectKnownVisitor(kv) {
    const idxKV = knownVisitors.indexOf(kv);
    const selected = { ...kv, __idx: idxKV >= 0 ? idxKV : 0 };
    setSelectedKnownVisitor(selected);
    onMemberChange(m.key, { fullName: selected.name || '', verified: true });
    setDetailsEdited(false);
  }

  function handleFullNameChange(value) {
    onMemberChange(m.key, { fullName: value });
    if (selectedKnownVisitor && !detailsEdited && value !== selectedKnownVisitor.name) {
      setDetailsEdited(true);
      onMemberChange(m.key, { verified: false });
    }
  }

  return (
    <div className="avm-member-card">
      <div className="avm-member-card__head">
        <span className="avm-member-card__title">Visitor {idx + 1}</span>
        {membersLength > 1 && (
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

      <MobileOtpBlock
        mobile={m.mobile}
        onMobileChange={(v) => {
          onMemberChange(m.key, { mobile: v, verified: false });
          setKnownVisitors([]);
          setSelectedKnownVisitor(null);
          setDetailsEdited(false);
        }}
        verified={m.verified}
        onVerified={() => onMemberChange(m.key, { verified: true })}
        onChangeNumber={() => onMemberChange(m.key, { verified: false, mobile: '' })}
        knownVisitors={knownVisitors}
        selectedKnownVisitor={selectedKnownVisitor}
        onSelectKnownVisitor={handleSelectKnownVisitor}
        lookingUp={lookingUp}
        detailsEdited={detailsEdited}
        onResetEdited={() => setDetailsEdited(false)}
      />

      <Field label="Full Name" required>
        <InputWithIcon
          icon={<IconUser size={14} />}
          type="text"
          placeholder="John Doe"
          value={m.fullName}
          onChange={(e) => handleFullNameChange(e.target.value)}
        />
      </Field>

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
  );
}

export default function AddVisitorModal({ onClose, onSuccess, locationScope }) {
  const toast = useToast();
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
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Known visitor state
  const [knownVisitors, setKnownVisitors] = useState([]);
  const [selectedKnownVisitor, setSelectedKnownVisitor] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [detailsEdited, setDetailsEdited] = useState(false);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Debounced known visitor lookup when mobile reaches 10 digits
  const doLookup = useCallback(async (digits) => {
    if (digits.length < MOBILE_LOOKUP_LENGTH) {
      setKnownVisitors([]);
      setSelectedKnownVisitor(null);
      return;
    }
    setLookingUp(true);
    try {
      const results = await lookupKnownVisitors(digits);
      setKnownVisitors(results);
      if (results.length > 0) {
        // Auto-select most recent (first in list), tag with index for dropdown
        const selected = { ...results[0], __idx: 0 };
        setSelectedKnownVisitor(selected);
        // Pre-fill fields from the selected record
        setFullName(selected.name || '');
        // Mark as verified — skip OTP
        setMobileVerified(true);
        setDetailsEdited(false);
      } else {
        setSelectedKnownVisitor(null);
        setDetailsEdited(false);
      }
    } catch (e) {
      // Lookup failures are silent — fall back to normal OTP flow
      setKnownVisitors([]);
      setSelectedKnownVisitor(null);
    } finally {
      setLookingUp(false);
    }
  }, []);

  const lookupGenerationRef = useRef(0);
  const lookupTimerRef = useRef(null);

  useEffect(() => {
    if (isGroup || mobileVerified || knownVisitors.length > 0) return;
    if (mobile.length === MOBILE_LOOKUP_LENGTH) {
      scheduleDebouncedLookup(
        lookupGenerationRef,
        lookupTimerRef,
        () => doLookup(mobile)
      );
    } else if (mobile.length >= MOBILE_LOOKUP_LENGTH - 2) {
      // Cancel any pending lookup as user is still typing
      cancelDebouncedLookup(lookupGenerationRef, lookupTimerRef);
    }
    return () => {
      cancelDebouncedLookup(lookupGenerationRef, lookupTimerRef);
    };
  }, [mobile, isGroup, mobileVerified, doLookup]);

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
    // Reset known visitor state
    setKnownVisitors([]);
    setSelectedKnownVisitor(null);
    setDetailsEdited(false);
  }

  function handleMemberChange(key, patch) {
    setMembers((list) => list.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  }

  // Handle name change — detect edit of pre-filled data
  function handleFullNameChange(value) {
    setFullName(value);
    if (selectedKnownVisitor && !detailsEdited && value !== selectedKnownVisitor.name) {
      setDetailsEdited(true);
      setMobileVerified(false);
    }
  }

  // Handle card number change
  function handleCardNumberChange(value) {
    setCardNumber(value);
  }

  // Handle selecting a known visitor from dropdown
  function handleSelectKnownVisitor(kv) {
    const idx = knownVisitors.indexOf(kv);
    const selected = { ...kv, __idx: idx >= 0 ? idx : 0 };
    setSelectedKnownVisitor(selected);
    setFullName(selected.name || '');
    setMobileVerified(true);
    setDetailsEdited(false);
  }

  // Handle mobile change — reset known visitor state
  function handleMobileChange(value) {
    setMobile(value);
    // Reset known visitor state when mobile changes
    setKnownVisitors([]);
    setSelectedKnownVisitor(null);
    setMobileVerified(false);
    setDetailsEdited(false);
  }

  function handleChangeNumber() {
    setMobileVerified(false);
    setMobile('');
    setKnownVisitors([]);
    setSelectedKnownVisitor(null);
    setDetailsEdited(false);
  }

  const step0Valid = isGroup
    ? members.length >= 1
      && members.every((m) =>
        m.fullName.trim()
        && m.mobile.length === 10
        && m.verified
        && String(m.cardNumber || '').trim() !== '')
    : fullName.trim() !== ''
      && mobile.length === 10
      && cardNumber.trim() !== ''
      && mobileVerified;

  const detailsValid = details.personToMeet.trim() !== ''
    && details.reasonForVisit.trim() !== ''
    && (details.govtIdNumber === '' || AADHAAR_REGEX.test(details.govtIdNumber));

  /**
   * Checks if a visitor with the same name + mobile is already checked in.
   * Returns { found: true, locationName: string } or { found: false }.
   */
  async function checkVisitorDuplicate(name, mobile) {
    if (!locationScope) return { found: false };
    try {
      const { entries } = await getEntries({
        page: 0,
        size: 200,
        status: 'checked-in',
        entryType: 'VISITOR',
        locationId: locationScope.locationId,
        allLocations: locationScope.allLocations,
      });
      const normalized = entries.map((e) => ({
        ...e,
        _name: (e.name || '').trim().toLowerCase(),
        _mobile: String(e.mobile || '').replace(/\D/g, ''),
      }));
      const searchName = name.trim().toLowerCase();
      const searchMobile = String(mobile).replace(/\D/g, '');
      const dup = normalized.find(
        (e) => e._name === searchName && e._mobile === searchMobile
      );
      if (dup) {
        return { found: true, locationName: dup.locationName || dup.locationId || 'this location' };
      }
    } catch (err) {
      console.warn('Could not check visitor duplicates:', err);
    }
    return { found: false };
  }

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
        // Check each group member for duplicates
        for (const m of members) {
          const dup = await checkVisitorDuplicate(m.fullName, m.mobile);
          if (dup.found) {
            const msg = `${m.fullName.trim()} is already checked in at ${dup.locationName}.`;
            setDuplicateWarning(msg);
            setSubmitError(msg);
            toast.showToast({
              title: 'Duplicate Visitor',
              message: msg,
              variant: 'warning',
              duration: 6000,
            });
            setSubmitting(false);
            return;
          }
        }
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
        // Check individual visitor for duplicates
        const dup = await checkVisitorDuplicate(fullName, mobile);
        if (dup.found) {
          const msg = `${fullName.trim()} is already checked in at ${dup.locationName}.`;
          setDuplicateWarning(msg);
          setSubmitError(msg);
          toast.showToast({
            title: 'Duplicate Visitor',
            message: msg,
            variant: 'warning',
            duration: 6000,
          });
          setSubmitting(false);
          return;
        }
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
              onFullNameChange={handleFullNameChange}
              mobile={mobile}
              onMobileChange={handleMobileChange}
              verified={mobileVerified}
              onVerified={(m) => {
                setMobileVerified(true);
                setMobile(m);
              }}
              onChangeNumber={handleChangeNumber}
              cardNumber={cardNumber}
              onCardNumberChange={handleCardNumberChange}
              members={members}
              onMemberChange={handleMemberChange}
              onAddMember={() => setMembers((list) => [...list, newMember()])}
              onRemoveMember={(key) => setMembers((list) => list.filter((m) => m.key !== key))}
              knownVisitors={knownVisitors}
              selectedKnownVisitor={selectedKnownVisitor}
              onSelectKnownVisitor={handleSelectKnownVisitor}
              lookingUp={lookingUp}
              detailsEdited={detailsEdited}
              onResetEdited={() => setDetailsEdited(false)}
            />
          )}

          {step === 1 && (
            <>
              <StepDetails state={details} dispatch={dispatch} />
              {duplicateWarning && (
                <WarningCard message={duplicateWarning} />
              )}
            </>
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
