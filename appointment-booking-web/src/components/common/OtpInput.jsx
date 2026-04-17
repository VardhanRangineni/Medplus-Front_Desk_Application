import { useMemo } from 'react';

const OTP_LENGTH = 6;

const WRAPPER_STYLE = {
  width: '100%',
  maxWidth: '320px',
  margin: '0 auto',
};

const INPUT_STYLE = {
  display: 'block',
  width: '100%',
  height: '56px',
  padding: '0 16px',
  border: '2px solid #0d6efd',
  borderRadius: '12px',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: '700',
  letterSpacing: '0.55em',
  textAlign: 'center',
  boxSizing: 'border-box',
  outline: 'none',
  boxShadow: '0 0 0 4px rgba(13, 110, 253, 0.08)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
};

const HINT_STYLE = {
  marginTop: '8px',
  textAlign: 'center',
  color: '#6c757d',
  fontSize: '12px',
};

export default function OtpInput({ value = '', onChange, disabled = false }) {
  const sanitizedValue = useMemo(
    () => value.replace(/\D/g, '').slice(0, OTP_LENGTH),
    [value],
  );

  function handleChange(event) {
    const nextValue = event.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    onChange(nextValue);
  }

  return (
    <div style={WRAPPER_STYLE}>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        value={sanitizedValue}
        onChange={handleChange}
        disabled={disabled}
        placeholder="123456"
        aria-label="Enter 6-digit OTP"
        style={{
          ...INPUT_STYLE,
          opacity: disabled ? 0.7 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
        }}
      />
      <div style={HINT_STYLE}>Enter all 6 digits in this field.</div>
    </div>
  );
}
