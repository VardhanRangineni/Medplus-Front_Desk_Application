import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import './LocationMaster.css';
import PageFilters from '../../components/PageFilters/PageFilters';
import {
  getMasterLocations,
  syncLocations,
  updateLocation,
  deleteLocation,
} from '../../api/locationApi';

// ── Constants ─────────────────────────────────────────────────────────────────

const LOCATION_TYPES = [
  'Head Office',
  'Branch Office',
  'Warehouse',
  'Residential',
  'Manufacturing',
  'Distribution Center',
  'Data Center',
  'Retail',
  'Other',
];

const EMPTY_FORM = {
  id:          '',
  name:        '',
  type:        '',
  address:     '',
  city:        '',
  state:       '',
  pincode:     '',
  coordinates: '',
  status:      'Configured',
};

const LAST_SYNCED_KEY = 'locationMaster_lastSynced';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSyncTime(iso) {
  if (!iso) return null;
  const d     = new Date(iso);
  const now   = new Date();
  const today = now.toDateString() === d.toDateString();
  const time  = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (today) return `Today at ${time}`;
  const date  = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${date} at ${time}`;
}

// ── Inline SVG Icons ──────────────────────────────────────────────────────────

const IconRefresh = ({ spinning }) => (
  <svg
    width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    style={spinning ? { animation: 'lmSpin 0.7s linear infinite' } : {}}
  >
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconAlertTriangle = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const IconMapPin = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

// ── Validation ─────────────────────────────────────────────────────────────────

const COORD_RE = /^-?\d{1,3}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?$/;
const PIN_RE   = /^\d{6}$/;

function validateForm(form) {
  const errors = {};
  if (!form.name.trim())    errors.name    = 'Location name is required.';
  if (!form.type)           errors.type    = 'Please select a type.';
  if (!form.address.trim()) errors.address = 'Address is required.';
  if (!form.city.trim())    errors.city    = 'City is required.';
  if (!form.state.trim())   errors.state   = 'State is required.';
  if (form.pincode && !PIN_RE.test(form.pincode))
    errors.pincode = 'Enter a valid 6-digit pincode.';
  if (form.coordinates && !COORD_RE.test(form.coordinates))
    errors.coordinates = 'Use format: 17.3850, 78.4867';
  return errors;
}

// ── Focus trap helper ──────────────────────────────────────────────────────────

function useFocusTrap(ref, isActive) {
  useEffect(() => {
    if (!isActive || !ref.current) return;
    const el = ref.current;
    const focusable = el.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    first?.focus();
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
      }
    };
    el.addEventListener('keydown', trap);
    return () => el.removeEventListener('keydown', trap);
  }, [isActive, ref]);
}

// ── Skeleton rows ──────────────────────────────────────────────────────────────

const SkeletonRows = () =>
  Array.from({ length: 5 }).map((_, i) => (
    <tr key={i} className="lm-skeleton-row">
      {[80, 120, 90, 160, 90, 90, 70, 60].map((w, j) => (
        <td key={j}><div className="lm-skeleton" style={{ width: w }} /></td>
      ))}
    </tr>
  ));

// ── Edit Modal ────────────────────────────────────────────────────────────────

const EditLocationModal = ({ initial, onClose, onSave }) => {
  const [form,   setForm]   = useState(initial || EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const modalRef = useRef(null);

  useFocusTrap(modalRef, true);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (field) => (e) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateForm(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setErrors({ _global: err.message || 'Something went wrong. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="lm-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="lm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lm-modal-title"
        ref={modalRef}
      >
        {/* Header */}
        <div className="lm-modal-head">
          <div>
            <h2 id="lm-modal-title">Edit Location</h2>
            <p>Update the details for this location.</p>
          </div>
          <button className="lm-modal-close" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>

        {/* Body */}
        <form id="lm-location-form" onSubmit={handleSubmit} noValidate>
          <div className="lm-modal-body">
            {errors._global && (
              <div className="lm-error-banner" role="alert">{errors._global}</div>
            )}

            {/* Location Name */}
            <div className="lm-form-row full">
              <div className="lm-field">
                <label className="lm-label" htmlFor="lm-name">
                  Location name (Descriptive) <span className="lm-required">*</span>
                </label>
                <input
                  id="lm-name"
                  className={`lm-input${errors.name ? ' error' : ''}`}
                  placeholder="e.g. Corporate Office"
                  value={form.name}
                  onChange={set('name')}
                  autoComplete="off"
                />
                {errors.name && <span className="lm-field-error">{errors.name}</span>}
              </div>
            </div>

            {/* Type + Location ID */}
            <div className="lm-form-row">
              <div className="lm-field">
                <label className="lm-label" htmlFor="lm-type">
                  Type <span className="lm-required">*</span>
                </label>
                <select
                  id="lm-type"
                  className={`lm-select${errors.type ? ' error' : ''}`}
                  value={form.type}
                  onChange={set('type')}
                >
                  <option value="">Select a type</option>
                  {LOCATION_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {errors.type && <span className="lm-field-error">{errors.type}</span>}
              </div>

              <div className="lm-field">
                <label className="lm-label" htmlFor="lm-id">Location ID</label>
                <input
                  id="lm-id"
                  className="lm-input"
                  value={form.id}
                  disabled
                  style={{ opacity: 0.55, cursor: 'not-allowed' }}
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Coordinates */}
            <div className="lm-form-row full">
              <div className="lm-field">
                <label className="lm-label" htmlFor="lm-coords">Coordinates</label>
                <input
                  id="lm-coords"
                  className={`lm-input${errors.coordinates ? ' error' : ''}`}
                  placeholder="e.g. 17.3850, 78.4867"
                  value={form.coordinates}
                  onChange={set('coordinates')}
                  autoComplete="off"
                />
                {errors.coordinates && <span className="lm-field-error">{errors.coordinates}</span>}
              </div>
            </div>

            {/* Address */}
            <div className="lm-form-row full">
              <div className="lm-field">
                <label className="lm-label" htmlFor="lm-address">
                  Address <span className="lm-required">*</span>
                </label>
                <input
                  id="lm-address"
                  className={`lm-input${errors.address ? ' error' : ''}`}
                  placeholder="e.g. 123 Main St"
                  value={form.address}
                  onChange={set('address')}
                  autoComplete="off"
                />
                {errors.address && <span className="lm-field-error">{errors.address}</span>}
              </div>
            </div>

            {/* City + State */}
            <div className="lm-form-row">
              <div className="lm-field">
                <label className="lm-label" htmlFor="lm-city">
                  City <span className="lm-required">*</span>
                </label>
                <input
                  id="lm-city"
                  className={`lm-input${errors.city ? ' error' : ''}`}
                  placeholder="e.g. Hyderabad"
                  value={form.city}
                  onChange={set('city')}
                  autoComplete="off"
                />
                {errors.city && <span className="lm-field-error">{errors.city}</span>}
              </div>

              <div className="lm-field">
                <label className="lm-label" htmlFor="lm-state">
                  State <span className="lm-required">*</span>
                </label>
                <input
                  id="lm-state"
                  className={`lm-input${errors.state ? ' error' : ''}`}
                  placeholder="e.g. Telangana"
                  value={form.state}
                  onChange={set('state')}
                  autoComplete="off"
                />
                {errors.state && <span className="lm-field-error">{errors.state}</span>}
              </div>
            </div>

            {/* Pincode + Status */}
            <div className="lm-form-row">
              <div className="lm-field">
                <label className="lm-label" htmlFor="lm-pincode">Pincode</label>
                <input
                  id="lm-pincode"
                  className={`lm-input${errors.pincode ? ' error' : ''}`}
                  placeholder="e.g. 500001"
                  value={form.pincode}
                  onChange={set('pincode')}
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="off"
                />
                {errors.pincode && <span className="lm-field-error">{errors.pincode}</span>}
              </div>

              <div className="lm-field">
                <label className="lm-label">Status</label>
                <div className="lm-radio-group" role="radiogroup" aria-label="Status">
                  {['Configured', 'Not Configured'].map(s => (
                    <label key={s} className="lm-radio-option">
                      <input
                        type="radio"
                        name="lm-status"
                        value={s}
                        checked={form.status === s}
                        onChange={set('status')}
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </form>

        {/* Footer */}
        <div className="lm-modal-footer">
          <button className="lm-btn-cancel" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="lm-btn-submit"
            type="submit"
            form="lm-location-form"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Delete confirmation modal ──────────────────────────────────────────────────

const DeleteConfirmModal = ({ location, onClose, onConfirm }) => {
  const [deleting, setDeleting] = useState(false);
  const modalRef = useRef(null);

  useFocusTrap(modalRef, true);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleConfirm = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  };

  return (
    <div className="lm-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="lm-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="lm-confirm-title"
        aria-describedby="lm-confirm-desc"
        ref={modalRef}
      >
        <div className="lm-confirm-icon"><IconAlertTriangle /></div>
        <div>
          <h3 id="lm-confirm-title">Delete Location?</h3>
          <p id="lm-confirm-desc">
            This will permanently remove <strong>{location.name}</strong> ({location.id}).
            This action cannot be undone.
          </p>
        </div>
        <div className="lm-confirm-actions">
          <button className="lm-btn-cancel" onClick={onClose} disabled={deleting}>Cancel</button>
          <button className="lm-btn-danger" onClick={handleConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main LocationMaster component ─────────────────────────────────────────────

const LocationMaster = () => {
  const {
    location: filterLocation,
    locations: filterLocations,
    dateRange,
    setLocation: setFilterLocation,
    setDateRange,
  } = useOutletContext();

  const [locations,    setLocations]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [syncing,      setSyncing]      = useState(false);
  const [error,        setError]        = useState('');
  const [lastSynced,   setLastSynced]   = useState(
    () => localStorage.getItem(LAST_SYNCED_KEY) || null,
  );

  const [filtersState, setFiltersState] = useState(null);
  const filterToggleRef = useRef(null);

  const toggleFilters = () =>
    setFiltersState(s => s === null ? 'open' : s === 'open' ? 'closing' : 'open');

  const handleFiltersAnimEnd = () =>
    setFiltersState(s => s === 'closing' ? null : s);

  useEffect(() => {
    const handler = (e) => {
      if (filterToggleRef.current && !filterToggleRef.current.contains(e.target))
        setFiltersState(s => s === 'open' ? 'closing' : s);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // modal: null | 'edit' | 'delete'
  const [modal,        setModal]        = useState(null);
  const [activeRecord, setActiveRecord] = useState(null);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    getMasterLocations()
      .then(setLocations)
      .catch((err) => setError(err.message || 'Failed to load locations.'))
      .finally(() => setLoading(false));
  }, []);

  // ── Sync / Fetch handler ────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    setError('');
    try {
      const fresh = await syncLocations();
      setLocations(fresh);
      const now = new Date().toISOString();
      setLastSynced(now);
      localStorage.setItem(LAST_SYNCED_KEY, now);
    } catch (err) {
      setError(err.message || 'Fetch failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  // ── Row handlers ────────────────────────────────────────────────────────────
  const openEdit   = (loc) => { setActiveRecord(loc); setModal('edit');   };
  const openDelete = (loc) => { setActiveRecord(loc); setModal('delete'); };
  const closeModal = ()     => { setModal(null); setActiveRecord(null);   };

  const handleEdit = async (form) => {
    const updated = await updateLocation(activeRecord.id, form);
    setLocations(prev =>
      prev.map(l => (l.id === activeRecord.id ? { ...l, ...updated } : l)),
    );
  };

  const handleDelete = async () => {
    const id = activeRecord.id;
    setLocations(prev => prev.filter(l => l.id !== id));
    closeModal();
    try {
      await deleteLocation(id);
    } catch (err) {
      setLocations(prev => [...prev, activeRecord]);
      setError(err.message || 'Delete failed. Please try again.');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Page header */}
      <div className="lm-page-header">
        <div className="lm-page-header-left">
          <h1 className="lm-page-title">Location Master</h1>
          <p className="lm-page-sub">Manage your master locations here.</p>
        </div>
        <div className="pf-toggle-wrap" ref={filterToggleRef}>
          {filtersState !== null && (
            <div
              className={`pf-inline-filters${filtersState === 'closing' ? ' closing' : ''}`}
              onAnimationEnd={handleFiltersAnimEnd}
            >
              <PageFilters
                locations={filterLocations}
                location={filterLocation}
                onLocationChange={setFilterLocation}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
            </div>
          )}
          <button
            className={`pf-toggle-btn${filtersState === 'open' ? ' open' : ''}${filterLocation !== 'All' ? ' active' : ''}`}
            onClick={toggleFilters}
            aria-expanded={filtersState === 'open'}
            aria-label="Toggle filters"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Filters
            {filterLocation !== 'All' && <span className="pf-filter-dot" />}
            <svg
              className={`pf-toggle-chevron${filtersState === 'open' ? ' rotated' : ''}`}
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="lm-toolbar">
        <div className="lm-fetch-group">
        {lastSynced && (
            <span className="lm-last-synced">
              Last fetched: {formatSyncTime(lastSynced)}
            </span>
          )}
          <button
            className="lm-btn-fetch"
            onClick={handleSync}
            disabled={syncing}
            title="Fetch latest locations from the system"
          >
            <IconRefresh spinning={syncing} />
            {syncing ? 'Fetching…' : 'Fetch Locations'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="lm-error-banner" role="alert">
          {error}
          <button
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '0 4px' }}
            onClick={() => setError('')}
            aria-label="Dismiss"
          >
            <IconX />
          </button>
        </div>
      )}

      {/* Table card */}
      <div className="lm-table-card">
        <div className="lm-table-header">
          <span>Master Locations</span>
          {!loading && (
            <span className="lm-table-count">{locations.length} location{locations.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        <div className="lm-table-scroll">
          <table className="lm-table">
            <thead>
              <tr>
                <th>Location ID</th>
                <th>Descriptive Name</th>
                <th>Type</th>
                <th>Address</th>
                <th>City</th>
                <th>State</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : locations.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 0, border: 'none' }}>
                    <div className="lm-empty">
                      <IconMapPin />
                      <p>No locations found</p>
                      <span>Click "Fetch Locations" to pull the latest data.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                locations.map((loc) => (
                  <tr key={loc.id}>
                    <td className="lm-td-id">{loc.id}</td>
                    <td className="lm-td-name">{loc.name}</td>
                    <td className="lm-td-type">{loc.type}</td>
                    <td className="lm-td-address" title={loc.address}>{loc.address}</td>
                    <td className="lm-td-muted">{loc.city}</td>
                    <td className="lm-td-muted">{loc.state}</td>
                    <td>
                      <span className={`lm-status-badge ${loc.status === 'Configured' ? 'lm-status-configured' : 'lm-status-inactive'}`}>
                        <span className="lm-status-dot" />
                        {loc.status}
                      </span>
                    </td>
                    <td>
                      <div className="lm-actions-cell">
                        <button
                          className="lm-action-btn"
                          onClick={() => openEdit(loc)}
                          title={`Edit ${loc.name}`}
                          aria-label={`Edit ${loc.name}`}
                        >
                          <IconEdit />
                        </button>
                        <button
                          className="lm-action-btn delete"
                          onClick={() => openDelete(loc)}
                          title={`Delete ${loc.name}`}
                          aria-label={`Delete ${loc.name}`}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {modal === 'edit' && activeRecord && (
        <EditLocationModal initial={activeRecord} onClose={closeModal} onSave={handleEdit} />
      )}
      {modal === 'delete' && activeRecord && (
        <DeleteConfirmModal location={activeRecord} onClose={closeModal} onConfirm={handleDelete} />
      )}
    </>
  );
};

export default LocationMaster;
