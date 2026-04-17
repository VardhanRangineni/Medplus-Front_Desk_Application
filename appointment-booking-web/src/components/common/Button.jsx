export function Spinner() {
  return (
    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
  );
}

export function PrimaryBtn({ children, className = '', ...props }) {
  return (
    <button type="button" {...props}
      className={`btn btn-primary d-inline-flex align-items-center justify-content-center gap-2 ${className}`}>
      {children}
    </button>
  );
}

export function SecondaryBtn({ children, className = '', ...props }) {
  return (
    <button type="button" {...props}
      className={`btn btn-outline-secondary d-inline-flex align-items-center justify-content-center gap-2 ${className}`}>
      {children}
    </button>
  );
}
