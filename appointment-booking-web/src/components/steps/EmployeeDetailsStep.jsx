import { useState, useEffect, useCallback } from 'react';
import ProgressSteps from '../common/ProgressSteps';
import SearchableDropdown from '../common/SearchableDropdown';
import { PrimaryBtn, SecondaryBtn, Spinner } from '../common/Button';
import { useBooking } from '../../context/BookingContext';
import { searchEmployees, getLocations } from '../../api/appointmentApi';

const STEPS = ['Verify', 'Details', 'Schedule', 'Confirm'];

export default function EmployeeDetailsStep() {
  const { submitDetails, goBack, verifiedEmployee } = useBooking();

  const [locationId,   setLocationId]   = useState('');
  const [personToMeet, setPersonToMeet] = useState(null);
  const [reason,       setReason]       = useState('');
  const [errors,       setErrors]       = useState({});

  const [locations,  setLocations]  = useState([]);
  const [locLoading, setLocLoading] = useState(true);
  const [locError,   setLocError]   = useState('');

  useEffect(() => {
    getLocations()
      .then((data) => setLocations(Array.isArray(data) ? data : []))
      .catch(() => setLocError('Could not load office locations. Please refresh.'))
      .finally(() => setLocLoading(false));
  }, []);

  // Bound search — only returns employees at the selected location
  const boundSearchEmployees = useCallback(
    (q) => searchEmployees(q, locationId),
    [locationId],
  );

  function validate() {
    const e = {};
    if (!locationId)   e.locationId   = 'Please select an office location.';
    if (!personToMeet) e.personToMeet = 'Please select a person to meet.';
    return e;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const loc = locations.find((l) => l.locationId === locationId);
    submitDetails({
      entryType: 'EMPLOYEE', empId: verifiedEmployee.id, name: verifiedEmployee.name,
      locationId, locationName: loc?.descriptiveName ?? '',
      personToMeetId: personToMeet.id, personToMeetName: personToMeet.name,
      department: personToMeet.department, reasonForVisit: reason.trim() || undefined,
    });
  }

  return (
    <div className="card shadow-sm border rounded-3 p-4 p-sm-5">
      <ProgressSteps steps={STEPS} current={2} />

      <div className="mb-4">
        <h2 className="fw-bold fs-4 mb-1">Appointment Details</h2>
        <p className="text-muted small mb-0">Select the office location and who you want to meet.</p>
      </div>

      {/* Verified employee banner */}
      <div className="alert alert-primary d-flex align-items-center gap-3 py-2 mb-4">
        <div className="rounded-circle bg-primary bg-opacity-25 text-primary fw-bold d-flex align-items-center justify-content-center flex-shrink-0"
          style={{ width: '2.2rem', height: '2.2rem' }}>
          {verifiedEmployee?.name?.[0]?.toUpperCase()}
        </div>
        <div className="flex-grow-1">
          <div className="fw-semibold small">{verifiedEmployee?.name}</div>
          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
            {verifiedEmployee?.department} · ID: {verifiedEmployee?.id}
          </div>
        </div>
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#0d6efd" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* Office Location */}
        <div className="mb-3">
          <label className="form-label fw-medium">Office Location <span className="text-danger">*</span></label>
          {locLoading ? (
            <div className="form-control d-flex align-items-center gap-2 text-muted">
              <Spinner /> Loading locations…
            </div>
          ) : (
            <select value={locationId}
              onChange={(e) => {
                setLocationId(e.target.value);
                setPersonToMeet(null);  // clear — person may be at a different site
                setErrors((p) => ({ ...p, locationId: '', personToMeet: '' }));
              }}
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
            value={personToMeet}
            onChange={(p) => { setPersonToMeet(p); setErrors((prev) => ({ ...prev, personToMeet: '' })); }}
            onSearch={boundSearchEmployees}
            disabled={!locationId}
            placeholder={locationId ? 'Type name or department…' : 'Select a location first'}
            error={errors.personToMeet} />
        </div>

        {/* Department (auto-filled) */}
        {personToMeet && (
          <div className="mb-3">
            <label className="form-label fw-medium">Department</label>
            <div className="autofill-field">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
              <span className="fw-medium">{personToMeet.department}</span>
              <span className="badge bg-primary bg-opacity-10 text-primary ms-auto">Auto-filled</span>
            </div>
          </div>
        )}

        {/* Reason */}
        <div className="mb-4">
          <label className="form-label fw-medium">
            Reason for Visit <span className="text-muted small">(optional)</span>
          </label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Brief description of the purpose…"
            rows={3} className="form-control" style={{ resize: 'none' }} />
        </div>

        <div className="d-flex flex-column flex-sm-row gap-2">
          <SecondaryBtn type="button" onClick={goBack} className="flex-fill">← Back</SecondaryBtn>
          <PrimaryBtn type="submit" className="flex-fill">Continue →</PrimaryBtn>
        </div>
      </form>
    </div>
  );
}
