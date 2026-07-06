import { useState, useEffect, useRef } from 'react';
import { IconPhone, IconUser } from '../../components/Icons/Icons';
import { lookupPersonToMeetByMobile } from './AddVisitorModal/addVisitorService';

const LOOKUP_DEBOUNCE_MS = 600;

function Field({ label, required, children, error }) {
  return (
    <div className="avm-field">
      {label && (
        <label className="avm-label">
          {label}
          {required && <span className="avm-label__req" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error && <p className="avm-error" style={{ marginTop: 4, fontSize: 11 }}>{error}</p>}
    </div>
  );
}

/**
 * Person-to-meet lookup by mobile number (HRMS only — no manual name fallback).
 */
export default function PersonToMeetMobileLookup({
  personToMeet,
  onChange,
  existingPersonLabel = null,
  disabled = false,
}) {
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resolved, setResolved] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function applyResolved(person) {
    setResolved(person);
    setError('');
    onChange({
      personToMeet: person.id,
      personToMeetCustom: '',
      hostDepartment: person.department || '',
    });
  }

  function triggerLookup(digits) {
    clearTimeout(timerRef.current);
    setError('');
    if (digits.length < 10) return;

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const person = await lookupPersonToMeetByMobile(digits);
        applyResolved(person);
      } catch (err) {
        setResolved(null);
        onChange({ personToMeet: '', personToMeetCustom: '', hostDepartment: '' });
        setError(err?.message || 'Lookup failed. Please try again.');
      } finally {
        setLoading(false);
      }
    }, LOOKUP_DEBOUNCE_MS);
  }

  function handleMobileChange(raw) {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    setMobile(digits);
    if (resolved) {
      setResolved(null);
      onChange({ personToMeet: '', personToMeetCustom: '', hostDepartment: '' });
    }
    setError('');
    triggerLookup(digits);
  }

  function handleReset() {
    setMobile('');
    setError('');
    setResolved(null);
    onChange({ personToMeet: '', personToMeetCustom: '', hostDepartment: '' });
  }

  const showExisting = !resolved && !mobile && existingPersonLabel && personToMeet;

  return (
    <Field
      label="Person To Meet — Mobile Number"
      required
      error={error || null}
    >
      <div className="avm-input-wrap">
        <span className="avm-input-icon"><IconPhone size={14} /></span>
        <input
          className="avm-input"
          type="tel"
          inputMode="numeric"
          placeholder="10-digit mobile number"
          value={mobile}
          maxLength={10}
          disabled={disabled || !!resolved}
          onChange={(e) => handleMobileChange(e.target.value)}
        />
      </div>

      {showExisting && (
        <div className="aem-emp-card" style={{ marginTop: 8 }}>
          <div className="aem-emp-card__avatar"><IconUser size={20} /></div>
          <div className="aem-emp-card__info">
            <p className="aem-emp-card__name">{existingPersonLabel}</p>
          </div>
        </div>
      )}

      {loading && null}

      {resolved && (
        <div className="aem-emp-card" style={{ marginTop: 8 }}>
          <div className="aem-emp-card__avatar"><IconUser size={20} /></div>
          <div className="aem-emp-card__info">
            <p className="aem-emp-card__name">{resolved.name}</p>
            {resolved.department && (
              <p className="aem-emp-card__meta">{resolved.department}</p>
            )}
          </div>
          <button
            type="button"
            className="aem-emp-card__reset"
            onClick={handleReset}
            title="Change person"
            disabled={disabled}
          >
            ✕
          </button>
        </div>
      )}
    </Field>
  );
}
