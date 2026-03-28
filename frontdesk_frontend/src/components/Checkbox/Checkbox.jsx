import React from 'react';
import './Checkbox.css';

const Checkbox = ({ id, label, checked, onChange }) => {
  return (
    <div className="custom-checkbox">
      <input 
        type="checkbox" 
        id={id} 
        checked={checked} 
        onChange={onChange}
      />
      <label htmlFor={id}>{label}</label>
    </div>
  );
};

export default Checkbox;
