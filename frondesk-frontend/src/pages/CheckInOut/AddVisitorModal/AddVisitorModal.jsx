import { useState, useEffect, useRef } from 'react';
import './AddVisitorModal.css';
import {
  IconX,
  IconUser,
  IconPhone,
  IconMail,
  IconCreditCard,
  IconCamera,
  IconBuilding,
  IconPlus,
  IconTrash,
  IconChevronDown,
  IconCheckCircle,
  IconUsers,
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
const GOVT_ID_TYPES = [
  { id: 'AADHAAR',  name: 'Aadhaar Card'      },
  { id: 'PAN',      name: 'PAN Card'           },
  { id: 'PASSPORT', name: 'Passport'           },
  { id: 'VOTER',    name: 'Voter ID'           },
  { id: 'DL',       name: "Driver's License"   },
];

// ─── Tiny shared primitives ───────────────────────────────────────────────────

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

function InputWithIcon({ icon, inputRef, ...props }) {
  return (
    <div className="avm-input-wrap">
      <span className="avm-input-icon">{icon}</span>
      <input className="avm-input" ref={inputRef} {...props} />
    </div>
  );
}

function SelectField({ icon, placeholder, value, onChange, options, disabled }) {
  return (
    <div className="avm-select-wrap">
      {icon && <span className="avm-input-icon">{icon}</span>}
      <select
        className={`avm-select${icon ? ' avm-select--icon' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
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

// ─── Step 1 — Mobile + OTP ────────────────────────────────────────────────────
function Step1({ state, dispatch }) {
  const {
    mobile, otpSent, otp, otpVerified,
    sendingOtp, verifyingOtp, otpError,
  } = state;

  return (
    <div className="avm-step">
      <Field label="Mobile Number" required>
        <div className="avm-side-by-side">
          <InputWithIcon
            icon={<IconPhone size={14} />}
            type="tel"
            inputMode="numeric"
            placeholder="10-digit mobile number"
            value={mobile}
            maxLength={10}
            disabled={otpVerified}
            onChange={(e) =>
              dispatch({ type: 'SET_MOBILE', value: e.target.value.replace(/\D/g, '').slice(0, 10) })
            }
          />
          <button
            className={`avm-otp-btn${otpVerified ? ' avm-otp-btn--done' : ''}`}
            onClick={() => dispatch({ type: 'SEND_OTP' })}
            disabled={mobile.length < 10 || sendingOtp || otpVerified}
          >
            {sendingOtp ? 'Sending…' : otpSent ? 'Resend' : 'Send OTP'}
          </button>
        </div>
      </Field>

      {otpSent && !otpVerified && (
        <Field label="Enter OTP" required hint="Enter the 6-digit code sent to your mobile.">
          <div className="avm-side-by-side">
            <input
              className="avm-input avm-input--otp"
              type="text"
              inputMode="numeric"
              placeholder="• • • • • •"
              maxLength={6}
              value={otp}
              onChange={(e) =>
                dispatch({ type: 'SET_OTP', value: e.target.value.replace(/\D/g, '').slice(0, 6) })
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && otp.length === 6) dispatch({ type: 'VERIFY_OTP' });
              }}
            />
            <button
              className="avm-otp-btn"
              onClick={() => dispatch({ type: 'VERIFY_OTP' })}
              disabled={otp.length < 6 || verifyingOtp}
            >
              {verifyingOtp ? 'Verifying…' : 'Verify OTP'}
            </button>
          </div>
          {otpError && <p className="avm-error">{otpError}</p>}
        </Field>
      )}

      {otpVerified && (
        <div className="avm-verified">
          <IconCheckCircle size={16} />
          <span>OTP Verified — Mobile number has been verified.</span>
        </div>
      )}
    </div>
  );
}

// ─── Step 2 — Visitor details ─────────────────────────────────────────────────
function Step2({ state, dispatch, refData }) {
  const {
    visitType, fullName, email, govtIdType, govtIdNumber,
    personToMeet, hostDepartment, reasonForVisit,
    cardNumber, leadCardNumber, members,
  } = state;

  const { persons, departments } = refData;

  const addMember    = () => dispatch({ type: 'ADD_MEMBER' });
  const removeMember = (id) => dispatch({ type: 'REMOVE_MEMBER', id });
  const updateMember = (id, field, value) =>
    dispatch({ type: 'UPDATE_MEMBER', id, field, value });

  return (
    <div className="avm-step">

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
                name="visitType"
                value={t}
                checked={visitType === t}
                onChange={() => dispatch({ type: 'SET_FIELD', field: 'visitType', value: t })}
              />
              <span>{t === 'individual' ? 'Individual' : 'Group'}</span>
            </label>
          ))}
        </div>
      </Field>

      {/* Full name */}
      <Field label="Full Name" required>
        <InputWithIcon
          icon={<IconUser size={14} />}
          type="text"
          placeholder="John Doe"
          value={fullName}
          onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'fullName', value: e.target.value })}
        />
      </Field>

      {/* Email */}
      <Field label="Email (Optional)">
        <InputWithIcon
          icon={<IconMail size={14} />}
          type="email"
          placeholder="john.doe@example.com"
          value={email}
          onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'email', value: e.target.value })}
        />
      </Field>

      {/* Govt ID type */}
      <Field label="Verified Govt. ID (Lead Only)">
        <SelectField
          placeholder="Select ID Type"
          value={govtIdType}
          onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'govtIdType', value: v })}
          options={GOVT_ID_TYPES}
        />
      </Field>

      {/* Govt ID number — shown only when a type is selected */}
      {govtIdType && (
        <Field label={`${GOVT_ID_TYPES.find((t) => t.id === govtIdType)?.name} Number`} required>
          <InputWithIcon
            icon={<IconCreditCard size={14} />}
            type="text"
            placeholder="Enter the ID number"
            value={govtIdNumber}
            onChange={(e) =>
              dispatch({ type: 'SET_FIELD', field: 'govtIdNumber', value: e.target.value })
            }
          />
        </Field>
      )}

      {/* Person to meet — auto-fills Host Department */}
      <Field label="Person To Meet" required>
        <SelectField
          placeholder="Select a person…"
          value={personToMeet}
          onChange={(v) => dispatch({ type: 'SET_PERSON_TO_MEET', value: v })}
          options={persons.map((p) => ({ id: p.id, name: `${p.name} — ${p.department}` }))}
        />
      </Field>

      {/* Host department */}
      <Field label="Host Department">
        <SelectField
          icon={<IconBuilding size={14} />}
          placeholder="Select a department"
          value={hostDepartment}
          onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'hostDepartment', value: v })}
          options={departments}
        />
      </Field>

      {/* Reason */}
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

      {/* Card number — label changes based on visit type */}
      <Field label={visitType === 'group' ? 'Lead Card Number' : 'Visitor Card Number'}>
        <InputWithIcon
          icon={<IconCreditCard size={14} />}
          type="text"
          placeholder="e.g. 123"
          value={visitType === 'group' ? leadCardNumber : cardNumber}
          onChange={(e) =>
            dispatch({
              type: 'SET_FIELD',
              field: visitType === 'group' ? 'leadCardNumber' : 'cardNumber',
              value: e.target.value,
            })
          }
        />
      </Field>

      {/* Sub-visitors (group only) */}
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

      {/* Camera / photo area */}
      <div
        className={[
          'avm-camera-area',
          cameraActive  ? 'avm-camera-area--live'     : '',
          photo         ? 'avm-camera-area--captured' : '',
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

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Action buttons */}
      <div className="avm-photo-actions">
        {photo ? (
          <button className="avm-photo-btn avm-photo-btn--retake" onClick={onRetake}>
            Retake Photo
          </button>
        ) : cameraActive ? (
          <button className="avm-photo-btn avm-photo-btn--capture" onClick={onCapture}>
            <IconCamera size={15} />
            Take Photo
          </button>
        ) : (
          <button className="avm-photo-btn avm-photo-btn--capture" onClick={onStart}>
            <IconCamera size={15} />
            Capture Selfie
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

const initialState = {
  // Step 1
  mobile:        '',
  otpSent:       false,
  otp:           '',
  otpVerified:   false,
  sendingOtp:    false,
  verifyingOtp:  false,
  otpError:      '',
  // Step 2
  visitType:      'individual',
  fullName:       '',
  email:          '',
  govtIdType:     '',
  govtIdNumber:   '',
  personToMeet:   '',
  hostDepartment: '',
  reasonForVisit: '',
  cardNumber:     '',
  leadCardNumber: '',
  members:        [],
};

export default function AddVisitorModal({ onClose, onSuccess }) {
  const [step,          setStep]          = useState(1);
  const [formState,     setFormState]     = useState(initialState);
  const [photo,         setPhoto]         = useState(null);
  const [cameraActive,  setCameraActive]  = useState(false);
  const [photoSkipped,  setPhotoSkipped]  = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [submitError,   setSubmitError]   = useState('');

  // Reference data (populated on mount)
  const [persons,      setPersons]      = useState([]);
  const [departments,  setDepartments]  = useState([]);
  const [refLoading,   setRefLoading]   = useState(true);
  const [refError,     setRefError]     = useState('');

  // Camera refs
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Stable ref for onClose (avoids stale closure in keyboard effect)
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // ── Load reference data ──────────────────────────────────────────────────
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

  // ── Keyboard / cleanup ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Stop camera when the component unmounts or user navigates away from step 3
  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (step !== 3) stopCamera();
  }, [step]);

  // ── Attach stream once the <video> element is in the DOM ─────────────────
  // cameraActive=true causes React to render <video ref={videoRef}>.
  // This effect runs after that render and safely assigns srcObject.
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  // ── Camera helpers ───────────────────────────────────────────────────────
  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  async function startCamera() {
    try {
      // NOTE (Electron): camera permissions must be allowed in the
      // BrowserWindow session.setPermissionRequestHandler in main.js.
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      // Set cameraActive FIRST so React renders the <video> element,
      // then the useEffect above attaches the stream after the render.
      setCameraActive(true);
    } catch {
      // Camera unavailable or permission denied — user can still use Skip
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

  function retakePhoto() {
    setPhoto(null);
    setPhotoSkipped(false);
  }

  // ── Reducer-style dispatcher for form state ──────────────────────────────
  function dispatch(action) {
    switch (action.type) {

      case 'SET_MOBILE':
        setFormState((s) => ({ ...s, mobile: action.value, otpError: '' }));
        break;

      case 'SET_OTP':
        setFormState((s) => ({ ...s, otp: action.value, otpError: '' }));
        break;

      case 'SET_FIELD':
        setFormState((s) => ({ ...s, [action.field]: action.value }));
        break;

      // Selecting a person auto-fills Host Department from that person's dept
      case 'SET_PERSON_TO_MEET': {
        const person = persons.find((p) => p.id === action.value);
        const dept   = person ? departments.find((d) => d.name === person.department) : null;
        setFormState((s) => ({
          ...s,
          personToMeet:   action.value,
          hostDepartment: dept ? dept.id : s.hostDepartment,
        }));
        break;
      }

      case 'SEND_OTP':
        if (formState.mobile.length < 10 || formState.sendingOtp || formState.otpVerified) return;
        setFormState((s) => ({ ...s, sendingOtp: true, otpError: '' }));
        sendOtp(formState.mobile)
          .then(() => setFormState((s) => ({ ...s, otpSent: true, otp: '', sendingOtp: false })))
          .catch(() =>
            setFormState((s) => ({
              ...s, sendingOtp: false, otpError: 'Failed to send OTP. Please try again.',
            }))
          );
        break;

      case 'VERIFY_OTP':
        if (formState.otp.length < 6 || formState.verifyingOtp) return;
        setFormState((s) => ({ ...s, verifyingOtp: true, otpError: '' }));
        verifyOtp(formState.mobile, formState.otp)
          .then((result) => {
            if (result.verified) {
              setFormState((s) => ({ ...s, verifyingOtp: false, otpVerified: true }));
            } else {
              setFormState((s) => ({
                ...s, verifyingOtp: false, otpError: result.message,
              }));
            }
          })
          .catch(() =>
            setFormState((s) => ({
              ...s, verifyingOtp: false, otpError: 'Verification failed. Please try again.',
            }))
          );
        break;

      case 'ADD_MEMBER':
        setFormState((s) => ({
          ...s,
          members: [...s.members, { id: Date.now(), name: '', card: '' }],
        }));
        break;

      case 'REMOVE_MEMBER':
        setFormState((s) => ({ ...s, members: s.members.filter((m) => m.id !== action.id) }));
        break;

      case 'UPDATE_MEMBER':
        setFormState((s) => ({
          ...s,
          members: s.members.map((m) =>
            m.id === action.id ? { ...m, [action.field]: action.value } : m
          ),
        }));
        break;

      default:
        break;
    }
  }

  // ── Step guards ──────────────────────────────────────────────────────────
  const step1Valid  = formState.otpVerified;
  const step2Valid  = !refLoading
                   && formState.fullName.trim() !== ''
                   && formState.personToMeet !== '';
  const step3Ready  = photo !== null || photoSkipped;

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        mobile:         formState.mobile,
        visitType:      formState.visitType,
        fullName:       formState.fullName,
        email:          formState.email,
        govtIdType:     formState.govtIdType,
        govtIdNumber:   formState.govtIdNumber,
        personToMeet:   formState.personToMeet,
        hostDepartment: formState.hostDepartment,
        reasonForVisit: formState.reasonForVisit,
        photo:          photo ?? null,
        ...(formState.visitType === 'group'
          ? {
              leadCardNumber: formState.leadCardNumber,
              cardNumber:     formState.cardNumber,
              members:        formState.members,
            }
          : { cardNumber: formState.cardNumber }),
      };
      const result = await createVisitorEntry(payload);
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

  // ── Overlay click ────────────────────────────────────────────────────────
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // ── Render ───────────────────────────────────────────────────────────────
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
            <p className="avm-subtitle">Manually enter the details for a new visitor.</p>
          </div>
          <button className="avm-close" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>

        {/* ── Progress ───────────────────────────────────────────────── */}
        <ProgressBar step={step} />
        <p className="avm-step-label">Step {step} of 3</p>

        {/* ── Scrollable body ────────────────────────────────────────── */}
        <div className="avm-body">
          {step === 1 && <Step1 state={formState} dispatch={dispatch} />}

          {step === 2 && (
            <>
              {refLoading && (
                <p className="avm-hint" style={{ textAlign: 'center', padding: '8px 0' }}>
                  Loading form data…
                </p>
              )}
              {!refLoading && refError && (
                <p className="avm-error" style={{ marginBottom: '12px' }}>{refError}</p>
              )}
              <Step2
                state={formState}
                dispatch={dispatch}
                refData={{ persons, departments }}
              />
            </>
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
              onRetake={retakePhoto}
              onSkip={() => { stopCamera(); setPhotoSkipped(true); }}
            />
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="avm-footer">
          {step > 1 && (
            <button
              className="avm-btn avm-btn--back"
              onClick={() => setStep((s) => s - 1)}
              disabled={submitting}
            >
              Back
            </button>
          )}

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
