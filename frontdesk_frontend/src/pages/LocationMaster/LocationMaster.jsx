import React, { useState, useEffect, useRef, useCallback } from 'react';
import './LocationMaster.css';
import {
  getMasterLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  bulkUploadLocations,
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

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const MAX_FILE_SIZE_MB   = 10;

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

// ── Inline SVG Icons ──────────────────────────────────────────────────────────

const IconUpload = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
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

const IconFile = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const IconCloudUpload = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16"/>
    <line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
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

// ── CSV template download ──────────────────────────────────────────────────────

function downloadTemplate() {
  const headers = ['Location ID', 'Descriptive Name', 'Type', 'Address', 'City', 'State', 'Pincode', 'Coordinates', 'Status'];
  const example = ['ED-HYD-EX', 'Example Office', 'Branch Office', '123 Main St', 'Hyderabad', 'Telangana', '500001', '17.3850, 78.4867', 'Configured'];
  const csv = [headers.join(','), example.join(',')].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'location_master_template.csv';
  a.click();
  URL.revokeObjectURL(url);
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

// ── Create / Edit Modal ────────────────────────────────────────────────────────

const LocationFormModal = ({ mode, initial, onClose, onSave }) => {
  const [form,    setForm]    = useState(initial || EMPTY_FORM);
  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);
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

  const isEdit = mode === 'edit';

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
            <h2 id="lm-modal-title">{isEdit ? 'Edit Location' : 'Create New Location'}</h2>
            <p>{isEdit ? 'Update the details for this location.' : 'Enter the details for the new master location.'}</p>
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
                  placeholder="e.g. ED-HYD-RO (auto if blank)"
                  value={form.id}
                  onChange={set('id')}
                  disabled={isEdit}
                  style={isEdit ? { opacity: 0.55, cursor: 'not-allowed' } : {}}
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
                  {['Configured', 'Inactive'].map(s => (
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

          </div>{/* end modal-body */}
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
            {saving ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Location')}
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

// ── Bulk Upload Modal ──────────────────────────────────────────────────────────

const BulkUploadModal = ({ onClose, onUploaded }) => {
  const [file,        setFile]        = useState(null);
  const [dragActive,  setDragActive]  = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [fileError,   setFileError]   = useState('');
  const fileInputRef = useRef(null);
  const modalRef     = useRef(null);

  useFocusTrap(modalRef, true);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const validateFile = useCallback((f) => {
    if (!f) return '';
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext))
      return `Invalid file type. Accepted: ${ALLOWED_EXTENSIONS.join(', ')}`;
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024)
      return `File exceeds ${MAX_FILE_SIZE_MB} MB limit.`;
    return '';
  }, []);

  const pickFile = (f) => {
    const err = validateFile(f);
    setFileError(err);
    if (!err) setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) pickFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await bulkUploadLocations(file);
      onUploaded(result);
      onClose();
    } catch (err) {
      setFileError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="lm-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="lm-bulk-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lm-bulk-title"
        ref={modalRef}
      >
        {/* Header */}
        <div className="lm-modal-head">
          <div>
            <h2 id="lm-bulk-title">Bulk Upload Locations</h2>
            <p>Upload an Excel or CSV file to import multiple locations at once.</p>
          </div>
          <button className="lm-modal-close" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>

        <div className="lm-modal-body">
          {fileError && (
            <div className="lm-upload-error" role="alert">{fileError}</div>
          )}

          {/* Drop zone */}
          {!file ? (
            <div
              className={`lm-dropzone${dragActive ? ' active' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
              aria-label="Click or drag to upload file"
            >
              <div className="lm-dropzone-icon"><IconCloudUpload /></div>
              <p>Drag & drop your file here, or{' '}
                <span className="lm-dropzone-browse">browse</span>
              </p>
              <span>Supports .xlsx, .xls, .csv · Max {MAX_FILE_SIZE_MB} MB</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </div>
          ) : (
            <div className="lm-file-chosen">
              <IconFile />
              <span>{file.name}</span>
              <button
                className="lm-file-remove"
                onClick={() => { setFile(null); setFileError(''); }}
                aria-label="Remove file"
              >
                <IconX />
              </button>
            </div>
          )}

          <p className="lm-upload-note">
            Need a template?{' '}
            <a role="button" tabIndex={0} onClick={downloadTemplate}
               onKeyDown={(e) => { if (e.key === 'Enter') downloadTemplate(); }}>
              Download CSV template
            </a>
          </p>
        </div>

        <div className="lm-modal-footer">
          <button className="lm-btn-cancel" onClick={onClose} disabled={uploading}>Cancel</button>
          <button
            className="lm-btn-submit"
            onClick={handleUpload}
            disabled={!file || uploading}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main LocationMaster component ─────────────────────────────────────────────

const LocationMaster = () => {
  const [locations,    setLocations]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');

  // modal: null | 'create' | 'edit' | 'delete' | 'bulk'
  const [modal,        setModal]        = useState(null);
  const [activeRecord, setActiveRecord] = useState(null);

  // ── Load locations ──────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    getMasterLocations()
      .then(setLocations)
      .catch((err) => setError(err.message || 'Failed to load locations.'))
      .finally(() => setLoading(false));
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const openCreate = () => { setActiveRecord(null); setModal('create'); };
  const openEdit   = (loc) => { setActiveRecord(loc); setModal('edit'); };
  const openDelete = (loc) => { setActiveRecord(loc); setModal('delete'); };
  const closeModal = () => { setModal(null); setActiveRecord(null); };

  const handleCreate = async (form) => {
    const created = await createLocation(form);
    setLocations(prev => [created, ...prev]);
  };

  const handleEdit = async (form) => {
    const updated = await updateLocation(activeRecord.id, form);
    setLocations(prev =>
      prev.map(l => (l.id === activeRecord.id ? { ...l, ...updated } : l)),
    );
  };

  const handleDelete = async () => {
    const id = activeRecord.id;
    // Optimistic removal
    setLocations(prev => prev.filter(l => l.id !== id));
    closeModal();
    try {
      await deleteLocation(id);
    } catch (err) {
      // Rollback
      setLocations(prev => [...prev, activeRecord]);
      setError(err.message || 'Delete failed. Please try again.');
    }
  };

  const handleBulkUploaded = (result) => {
    // After a real upload the server returns { created, errors }
    // Re-fetch to get the latest data
    getMasterLocations()
      .then(setLocations)
      .catch(console.error);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Page header */}
      <div className="lm-page-header">
        <h1 className="lm-page-title">Location Master</h1>
        <p className="lm-page-sub">Manage your master locations here.</p>
      </div>

      {/* Toolbar */}
      <div className="lm-toolbar">
        <button className="lm-btn-outline" onClick={() => setModal('bulk')}>
          <IconUpload /> Bulk Upload
        </button>
        <button className="lm-btn-primary" onClick={openCreate}>
          <IconPlus /> Create Location
        </button>
        <button
          className="lm-btn-icon"
          onClick={downloadTemplate}
          title="Download Excel template"
          aria-label="Download Excel template"
        >
          <IconDownload />
        </button>
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
                      <span>Click "Create Location" to add your first master location.</span>
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
      {modal === 'create' && (
        <LocationFormModal mode="create" onClose={closeModal} onSave={handleCreate} />
      )}
      {modal === 'edit' && activeRecord && (
        <LocationFormModal mode="edit" initial={activeRecord} onClose={closeModal} onSave={handleEdit} />
      )}
      {modal === 'delete' && activeRecord && (
        <DeleteConfirmModal location={activeRecord} onClose={closeModal} onConfirm={handleDelete} />
      )}
      {modal === 'bulk' && (
        <BulkUploadModal onClose={closeModal} onUploaded={handleBulkUploaded} />
      )}
    </>
  );
};

export default LocationMaster;
