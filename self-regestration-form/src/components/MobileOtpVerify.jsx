import { useEffect, useRef, useState } from 'react';
import { sendOtp, verifyOtp } from '../api/preRegisterApi';

const OTP_RESEND_SECONDS = 30;

export default function MobileOtpVerify({ mobile, onMobileChange, verified, onVerified, onChangeNumber }) {
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
        if (c <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
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

  async function handleVerify() {
    if (otp.length !== 5 || verifying) return;
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
    <div className="field">
      <label htmlFor="f-mobile">
        Mobile number <span className="req">*</span>
      </label>

      <div className="otp-row">
        <input
          id="f-mobile"
          type="tel"
          inputMode="numeric"
          placeholder="10-digit mobile"
          maxLength={10}
          value={mobile}
          disabled={verified}
          onChange={(e) => onMobileChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
        />
        {!verified && (
          <button
            type="button"
            className={`otp-btn${otpSent && countdown > 0 ? ' otp-btn--waiting' : ''}`}
            onClick={handleSendOtp}
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

      {sendError && (
        <div className="inline-error" role="alert">{sendError}</div>
      )}

      {otpSent && !verified && (
        <div className="otp-verify-block">
          <label htmlFor="f-otp" className="otp-verify-label">One-Time Password</label>
          <div className="otp-row">
            <input
              ref={otpInputRef}
              id="f-otp"
              className="otp-input"
              type="text"
              inputMode="numeric"
              placeholder="_ _ _ _ _"
              value={otp}
              maxLength={5}
              autoComplete="one-time-code"
              onChange={(e) => {
                setOtpError('');
                setOtp(e.target.value.replace(/\D/g, '').slice(0, 5));
              }}
              onKeyDown={(e) => { if (e.key === 'Enter' && otp.length === 5) handleVerify(); }}
            />
            <button
              type="button"
              className="otp-btn"
              onClick={handleVerify}
              disabled={otp.length !== 5 || verifying}
            >
              {verifying ? 'Verifying…' : 'Verify OTP'}
            </button>
          </div>
          {otpError
            ? <p className="field-error">{otpError}</p>
            : <p className="hint">OTP sent to +91 {sentToMobile}. Check your phone.</p>}
        </div>
      )}

      {verified && (
        <div className="verified-banner">
          <span aria-hidden="true">✓</span>
          <span>Mobile verified — +91 {mobile}</span>
          <button type="button" className="change-number-btn" onClick={onChangeNumber}>
            Change
          </button>
        </div>
      )}
    </div>
  );
}
