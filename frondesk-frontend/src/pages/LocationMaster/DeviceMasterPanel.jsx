/**
 * Device Master panel — kiosks / scan points under Location Master.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import '../CheckInOut/CheckInOut.css';
import '../UserManagement/UserManagement.css';
import '../LocationMaster/LocationMaster.css';
import EmptyState from '../../components/EmptyState/EmptyState';
import LottieLoader from '../../components/LottieLoader/LottieLoader';
import SearchSelect from '../../components/SearchSelect/SearchSelect';
import Pagination from '../../components/Pagination/Pagination';
import PageSizeSelect from '../../components/Pagination/PageSizeSelect';
import {
  IconPlus,
  IconToggleRight,
  IconToggleLeft,
  IconX,
  IconMonitor,
  IconEdit,
} from '../../components/Icons/Icons';
import {
  getDevices,
  createDevice,
  updateDevice,
  updateDeviceStatus,
  getLocations,
} from './locationMasterService';
import { getActiveLocations } from '../../services/locationService';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const FILTER_DEBOUNCE = 350;
const COL_COUNT = 8;

const EMPTY_FILTERS = {
  locationId: '',
  displayName: '',
  status: '',
};

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const EMPTY_FORM = {
  locationId: '',
  displayName: '',
  floor: '',
  area: '',
  macAddress: '',
  ipAddress: '',
};

function StatusToggle({ active, onToggle, label }) {
  return (
    <button type="button" className="umg-toggle" onClick={onToggle} aria-label={`Toggle ${label}`}>
      {active
        ? <IconToggleRight size={28} className="umg-toggle__on" />
        : <IconToggleLeft size={28} className="umg-toggle__off" />}
      <span className={`umg-status${active ? ' umg-status--active' : ' umg-status--inactive'}`}>
        {active ? 'Active' : 'Inactive'}
      </span>
    </button>
  );
}

function DeviceFormModal({ open, onClose, onSaved, locations, initial, lockedLocationId }) {
  const isEdit = Boolean(initial?.deviceId);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  // Single assigned site → lock field; multiple allowed sites → pick among them.
  const locationLocked = Boolean(lockedLocationId) && locations.length <= 1;
  // Primary admin or multi-site supervisor may move device between locations on edit.
  const canChangeLocation = !locationLocked;

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setErrors({});
      return;
    }
    if (initial) {
      setForm({
        locationId: initial.locationId ?? lockedLocationId ?? '',
        displayName: initial.displayName ?? '',
        floor: initial.floor ?? '',
        area: initial.area ?? '',
        macAddress: initial.macAddress ?? '',
        ipAddress: initial.ipAddress ?? '',
      });
    } else {
      const defaultLoc = lockedLocationId
        || locations[0]?.locationId
        || '';
      setForm({
        ...EMPTY_FORM,
        locationId: defaultLoc,
      });
    }
    setErrors({});
  }, [open, initial, lockedLocationId, locations]);

  if (!open) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const validate = () => {
    const errs = {};
    if (!form.locationId) errs.locationId = 'Select a location';
    if (!form.displayName.trim()) errs.displayName = 'Display name is required';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const payload = {
        displayName: form.displayName.trim(),
        floor: form.floor.trim() || null,
        area: form.area.trim() || null,
        macAddress: form.macAddress.trim() || null,
        ipAddress: form.ipAddress.trim() || null,
      };
      if (isEdit) {
        if (canChangeLocation) {
          payload.locationId = form.locationId;
        }
        await updateDevice(initial.deviceId, payload);
      } else {
        await createDevice({
          ...payload,
          locationId: form.locationId,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setErrors({ submit: err?.message ?? 'Failed to save device.' });
    } finally {
      setSaving(false);
    }
  };

  const locationOptions = locations.map((l) => ({
    value: l.locationId,
    label: `${l.locationId} — ${l.descriptiveName}`,
  }));

  const locationLabel = locationOptions.find((o) => o.value === form.locationId)?.label
    || form.locationId;

  return createPortal(
    <div className="umg-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="umg-modal lm-device-modal" onClick={(e) => e.stopPropagation()}>
        <div className="umg-modal__header">
          <h2 className="umg-modal__title">{isEdit ? 'Edit Device' : 'Add Device'}</h2>
          <button type="button" className="umg-modal__close" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>
        <form className="umg-modal__body" onSubmit={handleSubmit}>
          {errors.submit && <p className="umg-field__error umg-field__error--banner">{errors.submit}</p>}

          <label className="umg-field">
            <span className="umg-field__label">Location <span className="umg-req">*</span></span>
            {!canChangeLocation ? (
              <input
                className="umg-input"
                value={locationLabel}
                disabled
                readOnly
              />
            ) : (
              <SearchSelect
                className="search-select--umg"
                value={form.locationId}
                options={locationOptions}
                placeholder="Select location…"
                onChange={(v) => set('locationId', v)}
                ariaLabel="Location"
                searchable
                searchInField
                searchPlaceholder="Search location…"
                minMenuWidth={320}
              />
            )}
            {isEdit && canChangeLocation && (
              <span className="umg-field__hint">
                Move device to another site — it will leave the previous location list.
              </span>
            )}
            {errors.locationId && <span className="umg-field__error">{errors.locationId}</span>}
          </label>

          <label className="umg-field">
            <span className="umg-field__label">Display name <span className="umg-req">*</span></span>
            <input
              className="umg-input"
              value={form.displayName}
              onChange={(e) => set('displayName', e.target.value)}
              placeholder="e.g. Floor 2 — Accounts"
              required
            />
            {errors.displayName && <span className="umg-field__error">{errors.displayName}</span>}
          </label>

          <div className="lm-device-form__row">
            <label className="umg-field">
              <span className="umg-field__label">Floor</span>
              <input className="umg-input" value={form.floor} onChange={(e) => set('floor', e.target.value)} placeholder="2" />
            </label>
            <label className="umg-field">
              <span className="umg-field__label">Area</span>
              <input className="umg-input" value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="Accounts" />
            </label>
          </div>

          <label className="umg-field">
            <span className="umg-field__label">MAC address</span>
            <input
              className="umg-input umg-input--mono"
              value={form.macAddress}
              onChange={(e) => set('macAddress', e.target.value)}
              placeholder="AA:BB:CC:DD:EE:FF"
            />
            <span className="umg-field__hint">Bind kiosk hardware — copy from login screen network info.</span>
          </label>

          <label className="umg-field">
            <span className="umg-field__label">IP address</span>
            <input
              className="umg-input umg-input--mono"
              value={form.ipAddress}
              onChange={(e) => set('ipAddress', e.target.value)}
              placeholder="e.g. 10.123.2.4"
            />
          </label>

          <div className="umg-modal__footer">
            <button type="button" className="umg-btn umg-btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="umg-btn umg-btn--primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add device'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default function DeviceMasterPanel({
  locationLocked = false,
  lockedLocationId = null,
  lockedLocationName = null,
  allowedLocationIds = null,
}) {
  const canAddDevice = !locationLocked || Boolean(lockedLocationId)
    || (Array.isArray(allowedLocationIds) && allowedLocationIds.length > 0);
  const [devices, setDevices] = useState([]);
  const [locations, setLocations] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [filters, setFilters] = useState(() => (
    locationLocked && lockedLocationId && !(allowedLocationIds?.length > 1)
      ? { ...EMPTY_FILTERS, locationId: lockedLocationId }
      : EMPTY_FILTERS
  ));
  const [debouncedFilters, setDebouncedFilters] = useState(() => (
    locationLocked && lockedLocationId && !(allowedLocationIds?.length > 1)
      ? { ...EMPTY_FILTERS, locationId: lockedLocationId }
      : EMPTY_FILTERS
  ));
  const [initLoading, setInitLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editDevice, setEditDevice] = useState(null);
  const filterTimer = useRef(null);

  useEffect(() => {
    if (locationLocked && Array.isArray(allowedLocationIds) && allowedLocationIds.length > 0) {
      // Supervisor cannot call location-master list API — use shared active locations.
      getActiveLocations()
        .then((list) => {
          const all = Array.isArray(list) ? list : [];
          const allowed = new Set(allowedLocationIds.map((id) => String(id).toLowerCase()));
          const matched = all
            .filter((l) => allowed.has(String(l.code || '').toLowerCase()))
            .map((l) => ({ locationId: l.code, descriptiveName: l.name || l.code }));
          if (matched.length > 0) {
            setLocations(matched);
            return;
          }
          setLocations(allowedLocationIds.map((id) => ({
            locationId: id,
            descriptiveName: id === lockedLocationId ? (lockedLocationName || id) : id,
          })));
        })
        .catch(() => {
          setLocations(allowedLocationIds.map((id) => ({
            locationId: id,
            descriptiveName: id === lockedLocationId ? (lockedLocationName || id) : id,
          })));
        });
      return;
    }
    if (locationLocked) {
      setLocations([{
        locationId: lockedLocationId,
        descriptiveName: lockedLocationName || lockedLocationId,
      }]);
      return;
    }
    getLocations({ page: 0, size: 200, filters: { status: 'ACTIVE' } })
      .then((res) => setLocations(res?.content ?? []))
      .catch(() => setLocations([]));
  }, [locationLocked, lockedLocationId, lockedLocationName, allowedLocationIds]);

  useEffect(() => {
    if (filterTimer.current) clearTimeout(filterTimer.current);
    filterTimer.current = setTimeout(() => {
      setDebouncedFilters(filters);
      setCurrentPage(1);
    }, FILTER_DEBOUNCE);
    return () => { if (filterTimer.current) clearTimeout(filterTimer.current); };
  }, [filters]);

  const fetchDevices = useCallback(async (page, size, f, isInitial = false) => {
    if (isInitial) setInitLoading(true);
    else setPageLoading(true);
    setLoadError(null);
    try {
      const res = await getDevices({ page: page - 1, size, filters: f });
      setDevices(res?.content ?? []);
      setTotalElements(res?.totalElements ?? 0);
      setTotalPages(Math.max(1, res?.totalPages ?? 1));
    } catch (err) {
      setLoadError(err?.message ?? 'Failed to load devices.');
      setDevices([]);
    } finally {
      setInitLoading(false);
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices(currentPage, pageSize, debouncedFilters, currentPage === 1 && initLoading);
  }, [currentPage, pageSize, debouncedFilters, fetchDevices]);

  const handleToggle = async (deviceId, current) => {
    const next = !current;
    setDevices((prev) => prev.map((d) => d.deviceId === deviceId ? { ...d, active: next } : d));
    try {
      await updateDeviceStatus(deviceId, next);
    } catch (err) {
      setDevices((prev) => prev.map((d) => d.deviceId === deviceId ? { ...d, active: current } : d));
      setLoadError(err?.message ?? 'Failed to update status.');
    }
  };

  const multiSiteSupervisor = locationLocked && locations.length > 1;
  const locationFilterOptions = locationLocked
    ? (multiSiteSupervisor
      ? [
        { value: '', label: 'All my locations' },
        ...locations.map((l) => ({ value: l.locationId, label: l.descriptiveName })),
      ]
      : [{ value: lockedLocationId, label: lockedLocationName || lockedLocationId }])
    : [
      { value: '', label: 'All locations' },
      ...locations.map((l) => ({ value: l.locationId, label: l.descriptiveName })),
    ];

  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + devices.length, pageStart + pageSize);
  const hasFilters = Boolean(
    (!locationLocked && filters.locationId)
    || filters.displayName.trim()
    || filters.status,
  );

  return (
    <div className="ci-page">
      {loadError && (
        <div className="umg-error-banner" role="alert">{loadError}</div>
      )}

      <div className={`ci-card${pageLoading ? ' ci-card--loading' : ''}`}>
        <div className="ci-topbar">
          <div className="ci-topbar__title-wrap">
            <h2 className="ci-topbar__title">Device Master</h2>
            <p className="lm-device-intro">
              {locationLocked
                ? (canAddDevice
                  ? 'Register and manage kiosks at your assigned location.'
                  : 'No location is assigned to your account. Contact an administrator.')
                : 'Register kiosks for each floor or area. Staff log in on any active device at their location.'}
            </p>
          </div>
          {canAddDevice && (
            <div className="ci-topbar__actions">
              <button type="button" className="ci-add-btn" onClick={() => { setEditDevice(null); setShowModal(true); }}>
                <IconPlus size={14} />
                <span>Add Device</span>
              </button>
            </div>
          )}
        </div>

        <div className="ci-table-wrap lm-device-table-wrap">
          <table className="ci-table lm-table lm-device-table" aria-label="Devices list">
            <thead>
              <tr>
                <th className="lm-col-w--device-id">Device ID</th>
                <th className="lm-col-w--display">Display name</th>
                <th className="lm-col-w--location">Location</th>
                <th className="lm-col-w--floor">Floor / Area</th>
                <th className="lm-col-w--mac">MAC</th>
                <th className="lm-col-w--ip">IP</th>
                <th className="lm-col--status">Status</th>
                <th className="lm-col--actions ci-col--actions">Actions</th>
              </tr>
              <tr className="ci-col-filters">
                <th>
                  <input className="ci-col-filter" disabled placeholder="—" aria-hidden="true" />
                </th>
                <th>
                  <input
                    className="ci-col-filter"
                    placeholder="Filter name…"
                    value={filters.displayName}
                    onChange={(e) => setFilters((f) => ({ ...f, displayName: e.target.value }))}
                  />
                </th>
                <th>
                  {locationLocked && !multiSiteSupervisor ? (
                    <input
                      className="ci-col-filter"
                      value={lockedLocationName || lockedLocationId}
                      disabled
                      readOnly
                      title="Your assigned location"
                    />
                  ) : (
                    <SearchSelect
                      compact
                      value={filters.locationId}
                      options={locationFilterOptions}
                      placeholder="All"
                      onChange={(v) => setFilters((f) => ({ ...f, locationId: v }))}
                      ariaLabel="Filter by location"
                      searchable
                      searchInField
                      searchPlaceholder="Search location…"
                      minMenuWidth={260}
                    />
                  )}
                </th>
                <th><input className="ci-col-filter" disabled placeholder="—" aria-hidden="true" /></th>
                <th><input className="ci-col-filter" disabled placeholder="—" aria-hidden="true" /></th>
                <th><input className="ci-col-filter" disabled placeholder="—" aria-hidden="true" /></th>
                <th className="lm-col--status">
                  <SearchSelect
                    compact
                    value={filters.status}
                    options={STATUS_FILTER_OPTIONS}
                    placeholder="All"
                    onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
                    ariaLabel="Filter by status"
                  />
                </th>
                <th className="lm-col--actions ci-col-filter-cell--empty" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {initLoading ? (
                <tr>
                  <td colSpan={COL_COUNT} className="ci-table-loading">
                    <LottieLoader size="md" ariaLabel="Loading devices" />
                  </td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className="fd-empty-cell">
                    <EmptyState
                      compact
                      icon={<IconMonitor size={22} />}
                      title={hasFilters ? 'No devices found' : 'No devices yet'}
                      description={hasFilters ? 'Try adjusting filters.' : 'Add a kiosk for each floor or reception desk.'}
                      action={!hasFilters && canAddDevice ? { label: 'Add Device', onClick: () => setShowModal(true), icon: <IconPlus size={14} /> } : undefined}
                    />
                  </td>
                </tr>
              ) : devices.map((d) => (
                <tr key={d.deviceId} className="lm-device-row">
                  <td className="lm-table__id">{d.deviceId}</td>
                  <td>{d.displayName}</td>
                  <td className="lm-table__name--sub" title={d.locationName || ''}>{d.locationName}</td>
                  <td>{[d.floor, d.area].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="lm-table__mono">{d.macAddress || '—'}</td>
                  <td className="lm-table__mono">{d.ipAddress || d.lastKnownIp || '—'}</td>
                  <td className="lm-col--status">
                    <StatusToggle
                      active={d.active}
                      label={d.displayName}
                      onToggle={() => handleToggle(d.deviceId, d.active)}
                    />
                  </td>
                  <td className="lm-col--actions ci-col--actions">
                    <div className="ci-actions">
                      <button
                        type="button"
                        className="ci-action-btn ci-action-btn--edit"
                        onClick={() => { setEditDevice(d); setShowModal(true); }}
                        aria-label={`Edit ${d.displayName}`}
                        title="Edit device"
                      >
                        <IconEdit size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ci-card-footer">
          <p className="ci-card-footer__info">
            Showing <strong>{totalElements === 0 ? 0 : pageStart + 1}–{pageEnd}</strong> of <strong>{totalElements}</strong> devices
          </p>
          <div className="ci-card-footer__controls">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} alwaysShow />
            <PageSizeSelect value={pageSize} options={PAGE_SIZE_OPTIONS} onChange={(s) => { setPageSize(s); setCurrentPage(1); }} />
          </div>
        </div>
      </div>

      {canAddDevice && (
        <DeviceFormModal
          open={showModal}
          onClose={() => { setShowModal(false); setEditDevice(null); }}
          onSaved={() => fetchDevices(currentPage, pageSize, debouncedFilters)}
          locations={locations}
          initial={editDevice}
          lockedLocationId={locationLocked ? lockedLocationId : null}
        />
      )}
    </div>
  );
}
