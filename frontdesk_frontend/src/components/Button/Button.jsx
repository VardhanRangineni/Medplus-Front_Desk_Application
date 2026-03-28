import React from 'react';
import './Button.css';

const Spinner = () => (
  <svg
    className="btn-spinner"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
);

const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  className = '',
  loading = false,
  disabled = false,
}) => {
  return (
    <button
      type={type}
      className={`custom-btn btn-${variant} ${className} ${loading ? 'btn-loading' : ''}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <>
          <Spinner />
          Logging in…
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
