import { useState } from 'react';
import OtpInput from '../common/OtpInput';
import ProgressSteps from '../common/ProgressSteps';
import { PrimaryBtn, SecondaryBtn, Spinner } from '../common/Button';
import { useBooking } from '../../context/BookingContext';
import { sendVisitorOtp, verifyVisitorOtp, MOCK_OTP } from '../../api/appointmentApi';

const STEPS = ['Verify', 'Details', 'Schedule', 'Confirm'];
const RESEND_SECONDS = 60;

export default function MobileOtpStep() {
  const { otpVerified, goBack } = useBooking();

  const [phase,  setPhase]  = useState('idle');
  const [mobile, setMobile] = useState('');
  const [otp,    setOtp]    = useState('');
  const [error,  setError]  = useState('');
  const [resend, setResend] = useState(0);

  async function handleSendOtp(e) {
    e.preventDefault(); setError('');
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError('Please enter a valid 10-digit Indian mobile number.'); return;
    }
    setPhase('loading');
    try {
      const result = await sendVisitorOtp(mobile);
      if (!result?.success) throw new Error(result?.message ?? 'Failed to send OTP.');
      setPhase('otp-sent'); startResendCountdown();
    } catch (err) { setError(err.message); setPhase('idle'); }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault(); setError('');
    if (otp.replace(/\D/g, '').length !== 6) {
      setError('Please enter all 6 digits of the OTP.'); return;
    }
    setPhase('loading');
    try {
      const result = await verifyVisitorOtp(mobile, otp);
      if (!result?.verified) throw new Error(result?.message ?? 'Incorrect OTP. Please try again.');
      otpVerified(mobile);
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
      const result = await sendVisitorOtp(mobile);
      if (!result?.success) throw new Error(result?.message);
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
              d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3m-3 3h3m-3 3h3" />
          </svg>
        </div>
        <h2 className="fw-bold fs-4 mb-1">Verify Your Mobile</h2>
        <p className="text-muted small">
          {phase === 'otp-sent'
            ? <span>OTP sent to <strong>+91 {mobile}</strong></span>
            : 'Enter your 10-digit mobile number to receive a one-time password.'}
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

      {/* Phase: enter mobile */}
      {phase !== 'otp-sent' && (
        <form onSubmit={handleSendOtp}>
          <div className="mb-3">
            <label className="form-label fw-medium">Mobile Number <span className="text-danger">*</span></label>
            <div className="input-group">
              <span className="input-group-text fw-medium">+91</span>
              <input type="tel" inputMode="numeric" maxLength={10}
                value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                placeholder="9876543210"
                className="form-control" required autoFocus />
            </div>
          </div>
          <div className="d-grid gap-2">
            <PrimaryBtn type="submit" disabled={isLoading || mobile.length !== 10} className="w-100">
              {isLoading ? <><Spinner /> Sending OTP…</> : 'Send OTP'}
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
              onClick={() => { setPhase('idle'); setOtp(''); setError(''); }}
              className="w-100">
              Change Number
            </SecondaryBtn>
          </div>
        </form>
      )}
    </div>
  );
}
