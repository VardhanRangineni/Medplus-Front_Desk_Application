import { useState } from 'react';
import OtpInput from '../common/OtpInput';
import ProgressSteps from '../common/ProgressSteps';
import { PrimaryBtn, SecondaryBtn, Spinner } from '../common/Button';
import { useBooking } from '../../context/BookingContext';
import { lookupEmployee, verifyEmployeeOtp, MOCK_OTP } from '../../api/appointmentApi';

const STEPS = ['Verify', 'Details', 'Schedule', 'Confirm'];
const RESEND_SECONDS = 60;

export default function EmployeeIdStep() {
  const { employeeVerified, goBack } = useBooking();

  const [phase,   setPhase]   = useState('idle');
  const [empId,   setEmpId]   = useState('');
  const [empInfo, setEmpInfo] = useState(null);
  const [otp,     setOtp]     = useState('');
  const [error,   setError]   = useState('');
  const [resend,  setResend]  = useState(0);

  async function handleLookup(e) {
    e.preventDefault(); setError('');
    if (!empId.trim()) { setError('Please enter your Employee ID.'); return; }
    setPhase('loading');
    try {
      const result = await lookupEmployee(empId.trim());
      if (!result?.found) throw new Error(result?.message ?? 'Employee ID not found.');
      setEmpInfo(result.employee); setPhase('otp-sent'); startResendCountdown();
    } catch (err) { setError(err.message); setPhase('idle'); }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault(); setError('');
    if (otp.replace(/\D/g, '').length !== 6) {
      setError('Please enter all 6 digits of the OTP.'); return;
    }
    setPhase('loading');
    try {
      const result = await verifyEmployeeOtp(empId.trim(), otp);
      if (!result?.verified) throw new Error(result?.message ?? 'Incorrect OTP. Please try again.');
      employeeVerified(empInfo);
    } catch (err) { setError(err.message); setPhase('otp-sent'); }
  }

  function startResendCountdown() {
    setResend(RESEND_SECONDS);
    const id = setInterval(() => {
      setResend((s) => { if (s <= 1) { clearInterval(id); return 0; } return s - 1; });
    }, 1000);
  }

  async function handleResend() {
    if (resend > 0) return;
    setOtp(''); setError(''); setPhase('loading');
    try {
      const result = await lookupEmployee(empId.trim());
      if (!result?.found) throw new Error(result?.message);
      setPhase('otp-sent'); startResendCountdown();
    } catch (err) { setError(err.message); setPhase('otp-sent'); }
  }

  const isLoading   = phase === 'loading';
  const otpComplete = otp.replace(/\D/g, '').length === 6;

  return (
    <div className="card shadow-sm border rounded-3 p-4 p-sm-5">
      <ProgressSteps steps={STEPS} current={1} />

      {/* Header */}
      <div className="text-center mb-4">
        <div className="d-inline-flex align-items-center justify-content-center bg-primary bg-opacity-10 rounded-3 mb-3"
          style={{ width: '3.5rem', height: '3.5rem' }}>
          <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#0d6efd" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>
        <h2 className="fw-bold fs-4 mb-1">Employee Verification</h2>
        <p className="text-muted small">
          {phase === 'otp-sent'
            ? <span>OTP sent to <strong>{empInfo?.maskedPhone}</strong></span>
            : 'Enter your Employee ID to receive an OTP on your registered phone.'}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small mb-3" role="alert">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {error}
        </div>
      )}

      {/* Employee badge */}
      {empInfo && (
        <div className="alert alert-success d-flex align-items-center gap-3 py-2 mb-3">
          <div className="rounded-circle bg-success bg-opacity-25 text-success fw-bold d-flex align-items-center justify-content-center flex-shrink-0"
            style={{ width: '2.2rem', height: '2.2rem' }}>
            {empInfo.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-grow-1">
            <div className="fw-semibold small">{empInfo.name}</div>
            <div className="text-muted" style={{ fontSize: '0.75rem' }}>{empInfo.department} · {empInfo.maskedPhone}</div>
          </div>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#198754" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      )}

      {/* Phase: enter empId */}
      {phase !== 'otp-sent' && (
        <form onSubmit={handleLookup}>
          <div className="mb-3">
            <label className="form-label fw-medium">Employee ID <span className="text-danger">*</span></label>
            <input type="text" value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              placeholder="e.g. EMP001"
              className="form-control" required autoFocus />
          </div>
          <div className="d-grid gap-2">
            <PrimaryBtn type="submit" disabled={isLoading || !empId.trim()} className="w-100">
              {isLoading ? <><Spinner /> Looking up…</> : 'Lookup Employee'}
            </PrimaryBtn>
            <SecondaryBtn type="button" onClick={goBack} className="w-100">← Back</SecondaryBtn>
          </div>
        </form>
      )}

      {/* Phase: enter OTP */}
      {phase === 'otp-sent' && (
        <form onSubmit={handleVerifyOtp}>
          <div className="mb-3">
            <p className="text-center text-muted small fw-medium mb-3">Enter the 6-digit code</p>
            <OtpInput value={otp} onChange={setOtp} disabled={isLoading} />
            {MOCK_OTP && (
              <p className="text-center text-muted mt-2" style={{ fontSize: '0.75rem' }}>
                SMS gateway not yet active. Use test code&nbsp;
                <span className="fw-bold font-monospace">{MOCK_OTP}</span>
              </p>
            )}
          </div>
          <div className="text-center mb-3 small">
            {resend > 0
              ? <span className="text-muted">Resend OTP in <strong>{resend}s</strong></span>
              : <button type="button" onClick={handleResend} className="btn btn-link btn-sm p-0">Resend OTP</button>
            }
          </div>
          <div className="d-grid gap-2">
            <PrimaryBtn type="submit" disabled={isLoading || !otpComplete} className="w-100">
              {isLoading ? <><Spinner /> Verifying…</> : 'Verify OTP'}
            </PrimaryBtn>
            <SecondaryBtn type="button"
              onClick={() => { setPhase('idle'); setOtp(''); setError(''); setEmpInfo(null); }}
              className="w-100">
              Change Employee ID
            </SecondaryBtn>
          </div>
        </form>
      )}
    </div>
  );
}
