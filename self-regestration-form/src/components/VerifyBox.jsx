export default function VerifyBox({ state, children }) {
  if (!state) return null;
  return (
    <div className={`verify-box verify-box--${state}`} role="status" aria-live="polite">
      {children}
    </div>
  );
}

export function VerifySpinner() {
  return <span className="verify-spinner" aria-hidden="true" />;
}
