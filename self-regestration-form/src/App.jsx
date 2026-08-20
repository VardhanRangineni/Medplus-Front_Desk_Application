import { useEffect, useRef, useState } from 'react';
import {
  submitWalkIn,
  verifyEmployee,
  verifyPersonToMeet,
} from './api/preRegisterApi';
import MobileOtpVerify from './components/MobileOtpVerify';
import SuccessScreen from './components/SuccessScreen';
import VerifyBox, { VerifySpinner } from './components/VerifyBox';
import { PRESET_REASONS } from './constants/visitReasons';
import {
  HRMS_MIN_ID_LENGTH,
  LOOKUP_DEBOUNCE_MS,
  MOBILE_LOOKUP_LENGTH,
  cancelDebouncedLookup,
  isLookupStale,
  scheduleDebouncedLookup,
} from './utils/lookupDebounce';
import './App.css';

const ENTRY_VISITOR = 'VISITOR';
const ENTRY_EMPLOYEE = 'EMPLOYEE';

function fmtAadhaar(value) {
  const d = value.replace(/\D/g, '').slice(0, 12);
  return d.replace(/(\d{4})(\d{0,4})(\d{0,4})/, (_, a, b, c) => [a, b, c].filter(Boolean).join(' '));
}

export default function App() {
  const [entryType, setEntryType] = useState(ENTRY_VISITOR);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [mobileVerified, setMobileVerified] = useState(false);
  const [email, setEmail] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [aadhaarError, setAadhaarError] = useState(false);
  const [empId, setEmpId] = useState('');
  const [empVerifyState, setEmpVerifyState] = useState(null);
  const [empVerified, setEmpVerified] = useState(false);
  const [verifiedEmployeeName, setVerifiedEmployeeName] = useState(null);
  const [ptmMobile, setPtmMobile] = useState('');
  const [ptmVerifyState, setPtmVerifyState] = useState(null);
  const [ptmVerified, setPtmVerified] = useState(false);
  const [verifiedPtm, setVerifiedPtm] = useState(null);
  const [companyToggled, setCompanyToggled] = useState(false);
  const [company, setCompany] = useState('');
  const [reason, setReason] = useState('');
  const [banner, setBanner] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  const empTimerRef = useRef(null);
  const ptmTimerRef = useRef(null);
  const empLookupGen = useRef(0);
  const ptmLookupGen = useRef(0);

  const isVisitor = entryType === ENTRY_VISITOR;

  useEffect(() => () => {
    cancelDebouncedLookup(empLookupGen, empTimerRef);
    cancelDebouncedLookup(ptmLookupGen, ptmTimerRef);
  }, []);

  function selectType(type) {
    setEntryType(type);
    setBanner('');
    setAadhaarError(false);
    setMobileVerified(false);
    setEmpVerifyState(null);
    setEmpVerified(false);
    setVerifiedEmployeeName(null);
    setPtmVerifyState(null);
    setPtmVerified(false);
    setVerifiedPtm(null);
    if (type === ENTRY_EMPLOYEE && companyToggled) {
      setCompanyToggled(false);
      setCompany('');
    }
    if (type === ENTRY_EMPLOYEE && empId.trim().length >= HRMS_MIN_ID_LENGTH) {
      scheduleEmpVerify(empId.trim());
    }
  }

  async function runEmpVerify(id, generation) {
    setEmpVerifyState('checking');
    setEmpVerified(false);
    setVerifiedEmployeeName(null);
    try {
      const result = await verifyEmployee(id);
      if (generation != null && isLookupStale(generation, empLookupGen)) return;
      if (result.found) {
        setEmpVerified(true);
        setVerifiedEmployeeName(result.data.name || null);
        setEmpVerifyState('ok');
      } else {
        setEmpVerifyState('err');
      }
    } catch {
      if (generation != null && isLookupStale(generation, empLookupGen)) return;
      setEmpVerifyState('err');
    }
  }

  function scheduleEmpVerify(id) {
    setEmpVerifyState(null);
    const generation = scheduleDebouncedLookup(empLookupGen, empTimerRef, () => runEmpVerify(id, generation), LOOKUP_DEBOUNCE_MS);
  }

  function handleEmpIdChange(value) {
    setEmpId(value);
    setEmpVerified(false);
    setVerifiedEmployeeName(null);
    const raw = value.trim();
    if (!raw || isVisitor || raw.length < HRMS_MIN_ID_LENGTH) {
      cancelDebouncedLookup(empLookupGen, empTimerRef);
      setEmpVerifyState(null);
      return;
    }
    scheduleEmpVerify(raw);
  }

  async function runPtmVerify(phone, generation) {
    setPtmVerifyState('checking');
    setPtmVerified(false);
    setVerifiedPtm(null);
    try {
      const result = await verifyPersonToMeet(phone);
      if (generation != null && isLookupStale(generation, ptmLookupGen)) return;
      if (result.found) {
        setPtmVerified(true);
        setVerifiedPtm({
          employeeId: result.data.employeeId,
          name: result.data.name,
          department: result.data.department || '',
        });
        setPtmVerifyState('ok');
      } else {
        setPtmVerifyState('err');
      }
    } catch {
      if (generation != null && isLookupStale(generation, ptmLookupGen)) return;
      setPtmVerifyState('err');
    }
  }

  function schedulePtmVerify(phone) {
    setPtmVerifyState(null);
    const generation = scheduleDebouncedLookup(ptmLookupGen, ptmTimerRef, () => runPtmVerify(phone, generation), LOOKUP_DEBOUNCE_MS);
  }

  function handlePtmChange(value) {
    const digits = value.replace(/\D/g, '').slice(0, MOBILE_LOOKUP_LENGTH);
    setPtmMobile(digits);
    setPtmVerified(false);
    setVerifiedPtm(null);
    if (digits.length < MOBILE_LOOKUP_LENGTH) {
      cancelDebouncedLookup(ptmLookupGen, ptmTimerRef);
      setPtmVerifyState(null);
      return;
    }
    schedulePtmVerify(digits);
  }

  function toggleCompany() {
    setCompanyToggled((on) => {
      if (on) setCompany('');
      return !on;
    });
  }

  function displayName(data) {
    const fromApi = (data.name || '').trim();
    if (fromApi) return fromApi;
    if (!isVisitor && verifiedEmployeeName) return verifiedEmployeeName.trim();
    return 'there';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBanner('');
    setAadhaarError(false);

    const aadhaarDigits = aadhaar.replace(/\D/g, '');

    if (isVisitor && !name.trim()) {
      setBanner('Please enter your full name.');
      return;
    }
    if (isVisitor && mobile.length < 10) {
      setBanner('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (isVisitor && !mobileVerified) {
      setBanner('Please verify your mobile number with OTP before submitting.');
      return;
    }
    if (!isVisitor && !empId.trim()) {
      setBanner('Please enter your Employee ID or HRMS ID.');
      return;
    }
    if (!isVisitor && !empVerified) {
      setBanner('Please wait for HRMS verification, or enter a valid Employee ID / HRMS ID.');
      if (empId.trim()) runEmpVerify(empId.trim(), null);
      return;
    }
    if (isVisitor && aadhaarDigits.length > 0 && aadhaarDigits.length !== 12) {
      setAadhaarError(true);
      return;
    }
    if (ptmMobile.length < 10) {
      setBanner('Please enter a valid 10-digit mobile number for the person you want to meet.');
      return;
    }
    if (!ptmVerified || !verifiedPtm?.employeeId) {
      setBanner('Please wait for HRMS verification of the person to meet, or check the mobile number.');
      if (ptmMobile.length >= MOBILE_LOOKUP_LENGTH) runPtmVerify(ptmMobile, null);
      return;
    }
    if (!reason.trim()) {
      setBanner('Please enter a reason for your visit.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        entryType,
        name: isVisitor ? name.trim() : null,
        mobile: isVisitor ? mobile : null,
        empId: !isVisitor ? empId.trim() : null,
        email: isVisitor ? (email.trim() || null) : null,
        govtIdType: isVisitor && aadhaarDigits ? 'AADHAAR' : null,
        govtIdNumber: isVisitor ? (aadhaarDigits || null) : null,
        personToMeetId: verifiedPtm.employeeId,
        personName: verifiedPtm.name,
        hostDepartment: verifiedPtm.department || null,
        reasonForVisit: reason.trim(),
        companyName: isVisitor && companyToggled ? (company.trim() || null) : null,
      };
      const data = await submitWalkIn(payload);
      setSuccess({
        name: displayName(data),
        token: data.token || '',
      });
    } catch (err) {
      setBanner(err?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function ptmLabel() {
    if (!verifiedPtm?.name) return 'Employee verified';
    return `${verifiedPtm.name}${verifiedPtm.department ? ` · ${verifiedPtm.department}` : ''}`;
  }

  const visitorDetailsReady = isVisitor && mobileVerified;
  const employeeDetailsReady = !isVisitor && empVerified;
  const visitSectionReady = visitorDetailsReady || employeeDetailsReady;

  return (
    <div className="page">
      <header className="hero">
        <div className="hero__inner">
          <div className="hero__badge">MVMS · Reception check-in</div>
          <h1 className="hero__logo">MedPlus</h1>
          <p className="hero__tagline">Pre-register your visit and get a QR code to show at reception.</p>
        </div>
      </header>

      <main className="shell">
        <div className="card">
          <div className="card__head">
            <h2 className="card__title">Register your visit</h2>
            <p className="card__sub">Complete the form below. You will receive a QR code to scan when you arrive.</p>
          </div>
          <div className="card__body">
            {success ? (
              <SuccessScreen name={success.name} token={success.token} />
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                {banner && <div className="banner" role="alert">{banner}</div>}

                <div className="type-toggle" role="tablist" aria-label="Visitor type">
                  <button
                    type="button"
                    className={`type-toggle__btn${isVisitor ? ' active' : ''}`}
                    role="tab"
                    aria-selected={isVisitor}
                    onClick={() => selectType(ENTRY_VISITOR)}
                  >
                    <span className="type-toggle__icon" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
                    <span className="type-toggle__label">Visitor</span>
                  </button>
                  <button
                    type="button"
                    className={`type-toggle__btn${!isVisitor ? ' active' : ''}`}
                    role="tab"
                    aria-selected={!isVisitor}
                    onClick={() => selectType(ENTRY_EMPLOYEE)}
                  >
                    <span className="type-toggle__icon" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="7" width="20" height="14" rx="2" />
                        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                      </svg>
                    </span>
                    <span className="type-toggle__label">Employee</span>
                  </button>
                </div>

                <p className="section-label">{isVisitor ? 'Your details' : 'Your employee ID'}</p>

                {isVisitor && (
                  <div className="field">
                    <label htmlFor="f-name">Full name <span className="req">*</span></label>
                    <input
                      id="f-name"
                      type="text"
                      placeholder="As on your ID"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (!e.target.value.trim()) {
                          setMobileVerified(false);
                          setMobile('');
                        }
                      }}
                    />
                  </div>
                )}

                {isVisitor && name.trim() && (
                  <MobileOtpVerify
                    mobile={mobile}
                    onMobileChange={(v) => {
                      setMobile(v);
                      setMobileVerified(false);
                    }}
                    verified={mobileVerified}
                    onVerified={() => setMobileVerified(true)}
                    onChangeNumber={() => {
                      setMobileVerified(false);
                      setMobile('');
                    }}
                  />
                )}

                {visitorDetailsReady && (
                  <>
                    <div className="field">
                      <label htmlFor="f-email">Email <span className="opt">(optional)</span></label>
                      <input
                        id="f-email"
                        type="email"
                        placeholder="you@company.com"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="f-aadhaar">Aadhaar number <span className="opt">(optional)</span></label>
                      <input
                        id="f-aadhaar"
                        type="text"
                        inputMode="numeric"
                        placeholder="XXXX XXXX XXXX"
                        maxLength={14}
                        className="mono"
                        value={aadhaar}
                        onChange={(e) => {
                          setAadhaarError(false);
                          setAadhaar(fmtAadhaar(e.target.value));
                        }}
                      />
                      <p className="hint">12-digit UID for identity verification at entry</p>
                      {aadhaarError && (
                        <p className="field-error">Enter a valid 12-digit Aadhaar number.</p>
                      )}
                    </div>
                  </>
                )}

                {!isVisitor && (
                  <div className="field">
                    <label htmlFor="f-empid">Employee ID or HRMS ID <span className="req">*</span></label>
                    <input
                      id="f-empid"
                      type="text"
                      className="mono"
                      placeholder="e.g. OTG001 or MED1098233"
                      autoComplete="off"
                      value={empId}
                      onChange={(e) => handleEmpIdChange(e.target.value)}
                    />
                    <p className="hint">Enter either your official Employee ID or HRMS ID — we will verify against HR records.</p>
                    <VerifyBox state={empVerifyState}>
                      {empVerifyState === 'checking' && (
                        <>
                          <VerifySpinner />
                          <span>Verifying with HRMS…</span>
                        </>
                      )}
                      {empVerifyState === 'ok' && (
                        <>
                          <span aria-hidden="true">✓</span>
                          <span>ID verified — you can continue with your visit details.</span>
                        </>
                      )}
                      {empVerifyState === 'err' && (
                        <>
                          <span aria-hidden="true">✕</span>
                          <span>No employee found in HRMS for this ID.</span>
                        </>
                      )}
                    </VerifyBox>
                  </div>
                )}

                {visitSectionReady && (
                  <>
                <p className="section-label section-label--spaced">Visit details</p>

                <div className="field">
                  <label htmlFor="f-ptm-mobile">
                    Person you want to meet — mobile number <span className="req">*</span>
                  </label>
                  <input
                    id="f-ptm-mobile"
                    type="tel"
                    inputMode="numeric"
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    value={ptmMobile}
                    onChange={(e) => handlePtmChange(e.target.value)}
                  />
                  <p className="hint">Enter the mobile number of the person you are visiting. We will verify against HRMS.</p>
                  <VerifyBox state={ptmVerifyState}>
                    {ptmVerifyState === 'checking' && (
                      <>
                        <VerifySpinner />
                        <span>Looking up in HRMS…</span>
                      </>
                    )}
                    {ptmVerifyState === 'ok' && (
                      <>
                        <span aria-hidden="true">✓</span>
                        <span>{ptmLabel()}</span>
                      </>
                    )}
                    {ptmVerifyState === 'err' && (
                      <>
                        <span aria-hidden="true">✕</span>
                        <span>No employee found in HRMS for this mobile number.</span>
                      </>
                    )}
                  </VerifyBox>
                </div>

                {isVisitor && (
                  <div className="field">
                    <label>Representing a company? <span className="opt">(optional)</span></label>
                    <div className="switch-row">
                      <span className="switch-row__label">
                        {companyToggled ? 'Yes — enter company below' : 'No'}
                      </span>
                      <button
                        type="button"
                        className="switch"
                        role="switch"
                        aria-checked={companyToggled}
                        onClick={toggleCompany}
                      >
                        <span className="switch__thumb" />
                      </button>
                    </div>
                    {companyToggled && (
                      <input
                        id="f-company"
                        type="text"
                        placeholder="Company / organisation name"
                        autoComplete="organization"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                      />
                    )}
                  </div>
                )}

                <div className="field">
                  <label htmlFor="f-reason">Reason for visit <span className="req">*</span></label>
                  <div className="reason-chips">
                    {PRESET_REASONS.map((r) => (
                      <button
                        key={r.label}
                        type="button"
                        className="reason-chip"
                        onClick={() => setReason(r.text)}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    id="f-reason"
                    placeholder="e.g. Meeting, interview, courier delivery…"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <button type="submit" className="submit-btn" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit & get my QR code'}
                </button>
                  </>
                )}

                {!visitSectionReady && (
                  <p className="hint hint--gate">
                    {isVisitor
                      ? 'Enter your full name and verify your mobile number to continue.'
                      : 'Verify your employee ID to continue with visit details.'}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
        <p className="footer-note">
          Your information is used only for MedPlus visitor management check-in.
          Show your QR code at reception when you arrive.
        </p>
      </main>
    </div>
  );
}
