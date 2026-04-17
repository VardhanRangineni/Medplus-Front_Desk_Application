import { useState, useEffect, useCallback } from 'react';
import ProgressSteps from '../common/ProgressSteps';
import SearchableDropdown from '../common/SearchableDropdown';
import { PrimaryBtn, SecondaryBtn, Spinner } from '../common/Button';
import { useBooking } from '../../context/BookingContext';
import { searchEmployees, getLocations } from '../../api/appointmentApi';

const STEPS = ['Verify', 'Details', 'Schedule', 'Confirm'];

export default function VisitorDetailsStep() {
  const { submitDetails, goBack, verifiedMobile } = useBooking();

  const [form, setForm] = useState({
    name: '', email: '', aadhaar: '', locationId: '', personToMeet: null, reason: '',
  });
  const [errors,     setErrors]     = useState({});
  const [locations,  setLocations]  = useState([]);
  const [locLoading, setLocLoading] = useState(true);
  const [locError,   setLocError]   = useState('');

  useEffect(() => {
    getLocations()
      .then((data) => setLocations(Array.isArray(data) ? data : []))
      .catch(() => setLocError('Could not load office locations. Please refresh.'))
      .finally(() => setLocLoading(false));
  }, []);

  // When location changes, clear the previously selected person (they may be at a different site)
  function handleChange(field, value) {
    if (field === 'locationId') {
      setForm((p) => ({ ...p, locationId: value, personToMeet: null }));
      setErrors((p) => ({ ...p, locationId: '', personToMeet: '' }));
      return;
    }
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: '' }));
  }

  // Bound search — only returns employees at the selected location
  const boundSearchEmployees = useCallback(
    (q) => searchEmployees(q, form.locationId),
    [form.locationId],
  );

  function validate() {
    const e = {};
    if (!form.name.trim())                                      e.name        = 'Name is required.';
    if (!/^\d{12}$/.test(form.aadhaar.replace(/\s/g, '')))     e.aadhaar     = 'Aadhaar must be exactly 12 digits.';
    if (!form.locationId)                                       e.locationId  = 'Please select an office location.';
    if (!form.personToMeet)                                     e.personToMeet= 'Please select a person to meet.';
    if (form.email && !/^[\w.+\-]+@[\w\-]+\.[a-zA-Z]{2,}$/.test(form.email))
                                                                e.email       = 'Please enter a valid email address.';
    return e;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const loc = locations.find((l) => l.locationId === form.locationId);
    submitDetails({
      entryType: 'VISITOR', name: form.name.trim(), mobile: verifiedMobile,
      email: form.email.trim() || undefined, aadhaarNumber: form.aadhaar.replace(/\s/g, ''),
      locationId: form.locationId, locationName: loc?.descriptiveName ?? '',
      personToMeetId: form.personToMeet.id, personToMeetName: form.personToMeet.name,
      department: form.personToMeet.department, reasonForVisit: form.reason.trim() || undefined,
    });
  }

  return (
    <div className="card shadow-sm border rounded-3 p-4 p-sm-5">
      <ProgressSteps steps={STEPS} current={2} />

      <div className="mb-4">
        <h2 className="fw-bold fs-4 mb-1">Visitor Details</h2>
        <p className="text-muted small mb-0">
          Fields marked <span className="text-danger fw-bold">*</span> are required.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* Name */}
        <div className="mb-3">
          <label className="form-label fw-medium">Full Name <span className="text-danger">*</span></label>
          <input type="text" value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Rahul Sharma"
            className={`form-control ${errors.name ? 'is-invalid' : ''}`} />
          {errors.name && <div className="invalid-feedback">{errors.name}</div>}
        </div>

        {/* Email */}
        <div className="mb-3">
          <label className="form-label fw-medium">
            Email Address <span className="text-muted small">(optional)</span>
          </label>
          <input type="email" value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="rahul@example.com"
            className={`form-control ${errors.email ? 'is-invalid' : ''}`} />
          {errors.email && <div className="invalid-feedback">{errors.email}</div>}
        </div>

        {/* Aadhaar */}
        <div className="mb-3">
          <label className="form-label fw-medium">Aadhaar Number <span className="text-danger">*</span></label>
          <input type="text" inputMode="numeric" maxLength={14}
            value={form.aadhaar}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
              const fmt = raw.match(/.{1,4}/g)?.join(' ') ?? raw;
              handleChange('aadhaar', fmt);
            }}
            placeholder="1234 5678 9012"
            className={`form-control font-monospace ${errors.aadhaar ? 'is-invalid' : ''}`}
            style={{ letterSpacing: '0.15em' }} />
          {errors.aadhaar && <div className="invalid-feedback">{errors.aadhaar}</div>}
        </div>

        {/* Office Location */}
        <div className="mb-3">
          <label className="form-label fw-medium">Office Location <span className="text-danger">*</span></label>
          {locLoading ? (
            <div className="form-control d-flex align-items-center gap-2 text-muted">
              <Spinner /> Loading locations…
            </div>
          ) : (
            <select value={form.locationId}
              onChange={(e) => handleChange('locationId', e.target.value)}
              className={`form-select ${errors.locationId ? 'is-invalid' : ''}`}>
              <option value="">— Select office location —</option>
              {locations.map((loc) => (
                <option key={loc.locationId} value={loc.locationId}>
                  {loc.descriptiveName}{loc.city ? ` — ${loc.city}` : ''}
                </option>
              ))}
            </select>
          )}
          {(errors.locationId || locError) && (
            <div className="invalid-feedback d-block">{errors.locationId || locError}</div>
          )}
        </div>

        {/* Person to Meet */}
        <div className="mb-3">
          <SearchableDropdown label="Person to Meet" required
            value={form.personToMeet}
            onChange={(p) => handleChange('personToMeet', p)}
            onSearch={boundSearchEmployees}
            disabled={!form.locationId}
            placeholder={form.locationId ? 'Type name or department…' : 'Select a location first'}
            error={errors.personToMeet} />
        </div>

        {/* Department (auto-filled) */}
        {form.personToMeet && (
          <div className="mb-3">
            <label className="form-label fw-medium">Department</label>
            <div className="autofill-field">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
              <span className="fw-medium">{form.personToMeet.department}</span>
              <span className="badge bg-primary bg-opacity-10 text-primary ms-auto">Auto-filled</span>
            </div>
          </div>
        )}

        {/* Reason */}
        <div className="mb-3">
          <label className="form-label fw-medium">
            Reason for Visit <span className="text-muted small">(optional)</span>
          </label>
          <textarea value={form.reason}
            onChange={(e) => handleChange('reason', e.target.value)}
            placeholder="Brief description of the purpose of your visit…"
            rows={3} className="form-control" style={{ resize: 'none' }} />
        </div>

        {/* Verified mobile strip */}
        <div className="verified-strip d-flex align-items-center gap-2 mb-4">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#198754" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Verified mobile: <strong>+91 {verifiedMobile}</strong>
        </div>

        <div className="d-flex flex-column flex-sm-row gap-2">
          <SecondaryBtn type="button" onClick={goBack} className="flex-fill">← Back</SecondaryBtn>
          <PrimaryBtn type="submit" className="flex-fill">Continue →</PrimaryBtn>
        </div>
      </form>
    </div>
  );
}
