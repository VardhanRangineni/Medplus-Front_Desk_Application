import React from 'react';
import './Button.css';

const Button = ({ children, onClick, type = 'button', variant = 'primary', className = '' }) => {
  return (
    <button 
      type={type} 
      className={`custom-btn btn-${variant} ${className}`} 
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default Button;
