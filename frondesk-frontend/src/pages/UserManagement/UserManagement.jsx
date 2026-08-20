import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import '../CheckInOut/CheckInOut.css';
import './UserManagement.css';
import EmptyState from '../../components/EmptyState/EmptyState';
import LottieLoader from '../../components/LottieLoader/LottieLoader';
import SearchSelect from '../../components/SearchSelect/SearchSelect';
import {
  IconPlus,
  IconUsers,
  IconEdit,
  IconToggleRight,
  IconToggleLeft,
  IconX,
  IconAlertCircle,
  IconLock,
  IconEye,
  IconEyeOff,
  IconRefreshCw,
  IconMonitor,
} from '../../components/Icons/Icons';
import TempAccessModal from './TempAccessModal';
import Pagination from '../../components/Pagination/Pagination';
import PageSizeSelect from '../../components/Pagination/PageSizeSelect';
import {
  getManagedUsers,
  getManagedUserById,
  createManagedUser,
  updateManagedUser,
  updateManagedUserStatus,
  searchUsers,
  getRoles,
  resetUserPassword,
} from './userManagementService';
import { lookupHrmsByEmployeeId, lookupHrmsByHrmsId } from '../../services/hrmsService';
import { getActiveLocations } from '../../services/locationService';
import { getDevices } from '../LocationMaster/locationMasterService';

// ─── Constants ────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  id:         '',
  hrmsId:     '',
  name:       '',
  location:   '',
  locationIds: [],
  assignedDeviceId: '',
  designation: '',
  department: '',
  phone:      '',
  workEmail:  '',
  status:     true,
  password:   '',
  roleIds:    [3],
};

function normalizeLocationIds(locationIds, fallbackLocation = '') {
  const source = Array.isArray(locationIds) && locationIds.length > 0
    ? locationIds
    : (fallbackLocation ? [fallbackLocation] : []);
  return [...new Set(source.map((id) => String(id || '').trim()).filter(Boolean))];
}

function normalizeRoleIds(roleIds, fallbackRoleId = 3) {
  const source = Array.isArray(roleIds) && roleIds.length > 0
    ? roleIds
    : [fallbackRoleId];
  const out = [...new Set(source.map((id) => normalizeRoleId(id)))].sort((a, b) => a - b);
  return out.length > 0 ? out : [3];
}

function hasReceptionistRoleIds(roleIds) {
  return normalizeRoleIds(roleIds).includes(3);
}

function hasSupervisorRoleIds(roleIds) {
  return normalizeRoleIds(roleIds).includes(2);
}

const TAB_ALL      = 'all';
const TAB_ACTIVE   = 'active';
const TAB_INACTIVE = 'inactive';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const FILTER_DEBOUNCE   = 350;
const COL_COUNT         = 6;

const EMPTY_COLUMN_FILTERS = {
  id: '', name: '', role: '',
};

const HRMS_LOOKUP_DEBOUNCE = 600;
const HRMS_MIN_ID_LENGTH = 6;

function normalizeRoleId(roleId) {
  const n = Number(roleId);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

function isReceptionistRole(roleId) {
  return normalizeRoleId(roleId) === 3;
}

function columnFiltersToServer(filters, tab) {
  return {
    search: filters.id.trim() || filters.name.trim() || '',
    roleId: filters.role ? Number(filters.role) : null,
    status: tab === TAB_ACTIVE ? 'ACTIVE' : tab === TAB_INACTIVE ? 'INACTIVE' : null,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UserColumnFilterRow({ filters, roles, onChange }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });
  const roleOptions = [
    { value: '', label: 'All' },
    ...roles.map((r) => ({ value: String(r.id), label: r.displayName })),
  ];

  return (
    <tr className="ci-col-filters">
      <th className="umg-col-w--id">
        <input
          className="ci-col-filter"
          type="text"
          placeholder="Filter ID…"
          value={filters.id}
          onChange={(e) => set('id', e.target.value)}
          aria-label="Filter by employee ID"
        />
      </th>
      <th className="umg-col-w--name">
        <input
          className="ci-col-filter"
          type="text"
          placeholder="Filter name…"
          value={filters.name}
          onChange={(e) => set('name', e.target.value)}
          aria-label="Filter by name"
        />
      </th>
      <th className="umg-col-w--role">
        <SearchSelect
          compact
          value={filters.role}
          options={roleOptions}
          placeholder="All"
          onChange={(v) => set('role', v)}
          ariaLabel="Filter by role"
          minMenuWidth={160}
        />
      </th>
      <th className="umg-col-w--location" aria-hidden="true" />
      <th className="umg-col-w--status" aria-hidden="true" />
      <th className="umg-col-w--actions ci-col--actions" aria-hidden="true" />
    </tr>
  );
}

function UserRow({ user, onToggle, onEdit, onResetPassword, onTempAccess }) {
  const roleKey = (user.roleName ?? '').toLowerCase();
  const isReceptionist = isReceptionistRole(user.roleId) || roleKey.includes('receptionist');

  return (
    <tr className="ci-row ci-row--main">
      <td className="umg-col--id">
        {user.id}
        {user.activeTempGrant && (
          <span className="umg-temp-badge" title={`Temp access until ${user.activeTempGrant.expiresAt}`}>
            Temp
          </span>
        )}
      </td>
      <td className="ci-col--name">
        <span className="ci-name-text" title={user.name}>{user.name}</span>
      </td>
      <td>
        {user.roleName && (
          <span className={`umg-role-badge umg-role-badge--${roleKey}`}>
            {user.roleName}
          </span>
        )}
      </td>
      <td className="umg-col--kiosk">
        {isReceptionist ? (
          <span className="umg-kiosk-label" title={user.assignedDeviceId || ''}>
            {user.assignedDeviceName || '—'}
          </span>
        ) : (
          <span className="umg-kiosk-label umg-kiosk-label--na">—</span>
        )}
      </td>
      <td>
        <button
          type="button"
          className="umg-toggle"
          onClick={() => onToggle(user.id)}
          aria-label={`${user.status ? 'Deactivate' : 'Activate'} ${user.name}`}
          aria-pressed={user.status}
        >
          {user.status
            ? <><IconToggleRight size={22} /><span className="umg-status umg-status--on">Active</span></>
            : <><IconToggleLeft size={22} /><span className="umg-status umg-status--off">Inactive</span></>
          }
        </button>
      </td>
      <td className="ci-col--actions">
        <div className="ci-actions">
          <button
            type="button"
            className="ci-action-btn ci-action-btn--edit"
            onClick={() => onEdit(user)}
            aria-label={`Edit ${user.name}`}
            title="Edit"
          >
            <IconEdit size={14} />
          </button>
          {isReceptionist && (
            <button
              type="button"
              className="ci-action-btn ci-action-btn--edit"
              onClick={() => onTempAccess(user)}
              aria-label={`Temporary desk access for ${user.name}`}
              title="Temporary desk access"
            >
              <IconMonitor size={14} />
            </button>
          )}
          <button
            type="button"
            className="ci-action-btn ci-action-btn--checkout"
            onClick={() => onResetPassword(user)}
            aria-label={`Reset password for ${user.name}`}
            title="Reset password"
          >
            <IconLock size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
function UserModal({ user, roles, onClose, onSave, saving, saveError }) {
  const [form,         setForm]        = useState(() => user ? {
    id:         user.id         ?? '',
    hrmsId:     user.hrmsId     ?? '',
    name:       user.name       ?? '',
    location:   user.location   ?? '',
    locationIds: normalizeLocationIds(user.locationIds, user.location),
    assignedDeviceId: user.assignedDeviceId ?? '',
    designation:  user.designation  ?? '',
    department:   user.department   ?? '',
    phone:        user.phone        ?? '',
    workEmail:    user.workEmail    ?? '',
    status:     user.status     ?? true,
    password:   '',
    roleIds:    normalizeRoleIds(user.roleIds, user.roleId),
  } : EMPTY_FORM);
  const [errors,       setErrors]      = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [allLocations, setAllLocations] = useState([]);
  const isEdit = !!user;
  const selectedRoleIds = normalizeRoleIds(form.roleIds);
  const selectedLocationIds = normalizeLocationIds(form.locationIds, form.location);
  const receptionistRole = hasReceptionistRoleIds(selectedRoleIds);

  // ── Typeahead state ──────────────────────────────────────────────────────
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [activeUserField, setActiveUserField] = useState(null); // 'id' | 'name' | null
  const [hrmsLoading, setHrmsLoading] = useState(false);
  const [hrmsError,   setHrmsError]   = useState('');
  const userTimer = useRef(null);
  const hrmsEmployeeTimer = useRef(null);
  const hrmsIdTimer       = useRef(null);

  // Clear timers on unmount
  useEffect(() => () => {
    clearTimeout(userTimer.current);
    clearTimeout(hrmsEmployeeTimer.current);
    clearTimeout(hrmsIdTimer.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getActiveLocations()
      .then((list) => {
        if (!cancelled) setAllLocations(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setAllLocations([]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isEdit || !user?.id) return undefined;
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      try {
        const full = await getManagedUserById(user.id);
        if (cancelled || !full) return;
        const locationIds = normalizeLocationIds(full.locationIds, full.location);
        setForm((f) => ({
          ...f,
          name: full.name ?? f.name,
          location: locationIds[0] ?? full.location ?? f.location,
          locationIds,
          assignedDeviceId: full.assignedDeviceId ?? '',
          status: full.status ?? f.status,
          roleIds: normalizeRoleIds(full.roleIds, full.roleId ?? f.roleIds?.[0]),
        }));
      } catch {
        // List row data is still usable if detail fetch fails.
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, user?.id]);

  useEffect(() => {
    if (!receptionistRole) {
      setDevices([]);
      setDevicesError('');
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setDevicesLoading(true);
      setDevicesError('');
      try {
        const res = await getDevices({ page: 0, size: 200, filters: { status: 'ACTIVE' } });
        if (!cancelled) setDevices(res?.content ?? []);
      } catch (err) {
        if (!cancelled) {
          setDevices([]);
          setDevicesError(err?.message || 'Could not load kiosks from Device Master.');
        }
      } finally {
        if (!cancelled) setDevicesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [receptionistRole]);

  const deviceOptions = useMemo(() => {
    const opts = devices.map((d) => ({
      value: d.deviceId,
      label: `${d.displayName} · ${d.locationName || d.locationId}`,
    }));
    if (form.assignedDeviceId
        && !opts.some((o) => o.value === form.assignedDeviceId)
        && user?.assignedDeviceName) {
      opts.unshift({
        value: form.assignedDeviceId,
        label: user.assignedDeviceName,
      });
    }
    return opts;
  }, [devices, form.assignedDeviceId, user?.assignedDeviceName]);

  const roleOptions = useMemo(
    () => roles.map((r) => ({
      id: normalizeRoleId(r.id),
      label: r.displayName,
    })),
    [roles],
  );

  const toggleRole = (roleId) => {
    const id = normalizeRoleId(roleId);
    setForm((f) => {
      const current = normalizeRoleIds(f.roleIds);
      const next = current.includes(id)
        ? current.filter((r) => r !== id)
        : [...current, id].sort((a, b) => a - b);
      const safeNext = next.length > 0 ? next : [3];
      return {
        ...f,
        roleIds: safeNext,
        location: safeNext.includes(2) ? f.location : '',
        locationIds: safeNext.includes(2) ? f.locationIds : [],
        assignedDeviceId: safeNext.includes(3) ? f.assignedDeviceId : '',
      };
    });
    setErrors((prev) => ({
      ...prev,
      roleIds: undefined,
      location: undefined,
      locationIds: undefined,
      assignedDeviceId: undefined,
    }));
  };

  const setLocations = (nextIds) => {
    const next = (Array.isArray(nextIds) ? nextIds : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean);
    setForm((f) => ({
      ...f,
      locationIds: next,
      location: next[0] ?? '',
    }));
    setErrors((prev) => ({ ...prev, location: undefined, locationIds: undefined }));
  };

  const locationOptions = useMemo(
    () => allLocations.map((loc) => ({
      value: loc.code,
      label: loc.name || loc.code,
    })),
    [allLocations],
  );

  const triggerUserSearch = (q) => {
    clearTimeout(userTimer.current);
    if (!q.trim()) { setUserSuggestions([]); return; }
    userTimer.current = setTimeout(async () => {
      try {
        const res = await searchUsers(q.trim());
        setUserSuggestions(res ?? []);
      } catch { setUserSuggestions([]); }
    }, 280);
  };

  const pickUser = (u) => {
    setForm((f) => ({
      ...f,
      id:       u.id       ?? f.id,
      hrmsId:   u.hrmsId   ?? f.hrmsId,
      name:     u.name     ?? f.name,
      location: u.location ?? f.location,
    }));
    setErrors((e) => ({ ...e, id: undefined, hrmsId: undefined, name: undefined, location: undefined }));
    setUserSuggestions([]);
    setActiveUserField(null);
    setHrmsError('');
  };

  /** HRMS API — fill ids, name, and HR profile fields from lookup. */
  const applyHrmsResult = (emp) => {
    if (!emp) return;
    setForm((f) => ({
      ...f,
      id:          emp.id?.trim()          ? emp.id.trim()          : f.id,
      hrmsId:      emp.hrmsId?.trim()      ? emp.hrmsId.trim()      : f.hrmsId,
      name:        emp.name?.trim()        ? emp.name.trim()        : f.name,
      designation: emp.designation?.trim() ? emp.designation.trim() : f.designation,
      department:  emp.department?.trim()  ? emp.department.trim()  : f.department,
      phone:       emp.phone?.trim()
        || emp.personalPhoneNo?.trim()
        || emp.workPhoneNo?.trim()
        || f.phone,
      workEmail:   emp.workEmail?.trim()   ? emp.workEmail.trim()   : f.workEmail,
    }));
    setErrors((e) => ({ ...e, id: undefined, hrmsId: undefined, name: undefined }));
    setHrmsError('');
  };

  const triggerHrmsLookupByEmployeeId = (employeeId) => {
    clearTimeout(hrmsEmployeeTimer.current);
    setHrmsError('');
    if (isEdit || !employeeId.trim() || employeeId.trim().length < HRMS_MIN_ID_LENGTH) {
      return;
    }
    hrmsEmployeeTimer.current = setTimeout(async () => {
      setHrmsLoading(true);
      try {
        const emp = await lookupHrmsByEmployeeId(employeeId.trim());
        applyHrmsResult(emp);
      } catch (err) {
        setHrmsError(err?.message ?? 'HRMS lookup failed.');
      } finally {
        setHrmsLoading(false);
      }
    }, HRMS_LOOKUP_DEBOUNCE);
  };

  const triggerHrmsLookupByHrmsId = (hrmsId) => {
    clearTimeout(hrmsIdTimer.current);
    setHrmsError('');
    if (isEdit || !hrmsId.trim() || hrmsId.trim().length < HRMS_MIN_ID_LENGTH) {
      return;
    }
    hrmsIdTimer.current = setTimeout(async () => {
      setHrmsLoading(true);
      try {
        const emp = await lookupHrmsByHrmsId(hrmsId.trim());
        applyHrmsResult(emp);
      } catch (err) {
        setHrmsError(err?.message ?? 'HRMS lookup failed.');
      } finally {
        setHrmsLoading(false);
      }
    }, HRMS_LOOKUP_DEBOUNCE);
  };

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const needsLocation = hasSupervisorRoleIds(selectedRoleIds);

  const validate = () => {
    const e = {};
    if (!form.id.trim())         e.id         = 'Employee ID is required.';
    if (!form.name.trim())       e.name       = 'Employee name is required.';
    if (needsLocation && selectedLocationIds.length === 0) {
      e.locationIds = 'Assign at least one location for supervisors.';
    }
    if (receptionistRole && !form.assignedDeviceId.trim()) {
      e.assignedDeviceId = 'Assigned kiosk is required for receptionists.';
    }
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave(form);
  };

  return (
    <div className="umg-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="umg-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="umg-modal__header">
          <h2 className="umg-modal__title">{isEdit ? 'Edit User' : 'Add New User'}</h2>
          <button className="umg-modal__close" onClick={onClose} aria-label="Close">
            <IconX size={14} />
          </button>
        </div>

        {/* Body */}
        <form className="umg-modal__body" onSubmit={handleSubmit} noValidate>

          <div className="umg-field-row">

            {/* ── Employee ID — typeahead (add mode only) ──────────────── */}
            <div className="umg-field">
              <span className="umg-field__label">Employee ID</span>
              <div className="umg-typeahead">
                <input
                  className={`umg-input${errors.id ? ' umg-input--error' : ''}`}
                  value={form.id}
                  onChange={(e) => {
                    set('id', e.target.value);
                    if (!isEdit) {
                      setActiveUserField('id');
                      triggerUserSearch(e.target.value);
                      triggerHrmsLookupByEmployeeId(e.target.value);
                    }
                  }}
                  onBlur={() => setTimeout(() => setActiveUserField(null), 150)}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setActiveUserField(null); setUserSuggestions([]); } }}
                  placeholder="e.g. EMP-008"
                  disabled={isEdit}
                  autoComplete="off"
                />
                {activeUserField === 'id' && userSuggestions.length > 0 && (
                  <ul className="umg-dropdown" role="listbox">
                    {userSuggestions.map((u) => (
                      <li
                        key={u.id}
                        className="umg-dropdown__item"
                        onMouseDown={(e) => { e.preventDefault(); pickUser(u); }}
                        role="option"
                      >
                        <span className="umg-dropdown__primary">{u.id}</span>
                        <span className="umg-dropdown__secondary">{u.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {errors.id && <span className="umg-field__error">{errors.id}</span>}
            </div>

            {/* ── HRMS ID — HRMS lookup (add mode only) ───────────────── */}
            <div className="umg-field">
              <span className="umg-field__label">HRMS ID</span>
              <input
                className={`umg-input${errors.hrmsId ? ' umg-input--error' : ''}`}
                value={form.hrmsId}
                onChange={(e) => {
                  set('hrmsId', e.target.value);
                  if (!isEdit) triggerHrmsLookupByHrmsId(e.target.value);
                }}
                placeholder="e.g. MED000849"
                disabled={isEdit}
                autoComplete="off"
              />
              {errors.hrmsId && <span className="umg-field__error">{errors.hrmsId}</span>}
            </div>

          </div>

          <div className="umg-field">
            <span className="umg-field__label">Employee Name</span>
            <div className="umg-typeahead">
                <input
                  className={`umg-input${errors.name ? ' umg-input--error' : ''}`}
                  value={form.name}
                  onChange={(e) => {
                    set('name', e.target.value);
                    if (!isEdit) { setActiveUserField('name'); triggerUserSearch(e.target.value); }
                  }}
                  onBlur={() => setTimeout(() => setActiveUserField(null), 150)}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setActiveUserField(null); setUserSuggestions([]); } }}
                  placeholder="Full name"
                  autoComplete="off"
                />
                {activeUserField === 'name' && userSuggestions.length > 0 && (
                  <ul className="umg-dropdown" role="listbox">
                    {userSuggestions.map((u) => (
                      <li
                        key={u.id}
                        className="umg-dropdown__item"
                        onMouseDown={(e) => { e.preventDefault(); pickUser(u); }}
                        role="option"
                      >
                        <span className="umg-dropdown__primary">{u.name}</span>
                        <span className="umg-dropdown__secondary">{u.id}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {errors.name && <span className="umg-field__error">{errors.name}</span>}
              {!isEdit && hrmsLoading && (
                <span className="umg-field__hint">Fetching from HRMS…</span>
              )}
              {!isEdit && !hrmsLoading && hrmsError && (
                <span className="umg-field__error">{hrmsError}</span>
              )}
          </div>

          {/* ── HRMS profile fields (auto-filled, editable) ────────────── */}
          <div className="umg-field-row">
            <div className="umg-field">
              <span className="umg-field__label">Department</span>
              <input
                className="umg-input"
                value={form.department}
                onChange={(e) => set('department', e.target.value)}
                placeholder="e.g. Operations"
                autoComplete="off"
              />
            </div>

            <div className="umg-field">
              <span className="umg-field__label">Designation</span>
              <input
                className="umg-input"
                value={form.designation}
                onChange={(e) => set('designation', e.target.value)}
                placeholder="e.g. Store Manager"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="umg-field-row">
            <div className="umg-field">
              <span className="umg-field__label">Phone</span>
              <input
                className="umg-input"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="10-digit mobile"
                autoComplete="off"
              />
            </div>

            <div className="umg-field">
              <span className="umg-field__label">Work Email</span>
              <input
                className="umg-input"
                type="email"
                value={form.workEmail}
                onChange={(e) => set('workEmail', e.target.value)}
                placeholder="employee@medplus.com"
                autoComplete="off"
              />
            </div>
          </div>

          {/* ── Role assignment (multi-select) ─────────────────────────── */}
          <div className="umg-field">
            <span className="umg-field__label">Roles</span>
            <div className="umg-role-checks" role="group" aria-label="User roles">
              {roleOptions.map((r) => (
                <label key={r.id} className="umg-role-check">
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(r.id)}
                    onChange={() => toggleRole(r.id)}
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
            <span className="umg-field__hint">
              Assign <strong>Receptionist</strong> to allow desk check-ins. Admins and supervisors
              without Receptionist can monitor data only.
            </span>
          </div>

          {needsLocation && (
          <div className="umg-field">
            <span className="umg-field__label">Locations <span className="umg-req">*</span></span>
            {allLocations.length === 0 ? (
              <span className="umg-field__hint">No active locations found.</span>
            ) : (
              <SearchSelect
                className="search-select--umg"
                multiple
                searchable
                maxVisibleChips={2}
                value={selectedLocationIds}
                options={locationOptions}
                placeholder="Search and select locations…"
                searchPlaceholder="Type to search locations…"
                onChange={setLocations}
                ariaLabel="Assigned locations"
                minMenuWidth={400}
                emptyMessage="No matching locations"
              />
            )}
            <span className="umg-field__hint">
              Supervisors can monitor and manage devices at every selected location.
            </span>
            {errors.locationIds && <span className="umg-field__error">{errors.locationIds}</span>}
          </div>
          )}

          <div className="umg-field">
            <span className="umg-field__label">Assigned kiosk</span>
            {receptionistRole ? (
              <>
                <SearchSelect
                  className="search-select--umg"
                  value={form.assignedDeviceId}
                  options={deviceOptions}
                  placeholder={
                    detailLoading || devicesLoading
                      ? 'Loading…'
                      : 'Select registered kiosk…'
                  }
                  onChange={(v) => set('assignedDeviceId', v)}
                  ariaLabel="Assigned kiosk"
                  disabled={detailLoading || devicesLoading}
                  searchable
                  searchInField
                  searchPlaceholder="Search kiosk…"
                  minMenuWidth={320}
                />
                {errors.assignedDeviceId && (
                  <span className="umg-field__error">{errors.assignedDeviceId}</span>
                )}
                {devicesError && (
                  <span className="umg-field__error">{devicesError}</span>
                )}
                <span className="umg-field__hint">
                  Receptionists may only sign in from this kiosk (or a temporary grant on another desk).
                </span>
              </>
            ) : (
              <p className="umg-field__hint umg-field__hint--muted">
                Only <strong>Receptionist</strong> accounts are tied to a kiosk. Admins and supervisors
                sign in from any PC. To assign a desk, set role to Receptionist or edit a receptionist user.
              </p>
            )}
          </div>

          <label className="umg-field">
            <span className="umg-field__label">
              {isEdit ? 'New Password' : 'Password'}
              {isEdit && <span className="umg-field__optional"> (leave blank to keep current)</span>}
            </span>
            <div className={`umg-input-wrap${errors.password ? ' umg-input-wrap--error' : ''}`}>
              <IconLock size={13} className="umg-input-wrap__icon" />
              <input
                className="umg-input umg-input--padded-icon"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder={isEdit ? 'Enter new password to change it' : 'Optional (defaults to Employee ID in caps)'}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="umg-input-wrap__eye"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <IconEyeOff size={14} /> : <IconEye size={14} />}
              </button>
            </div>
            {errors.password && <span className="umg-field__error">{errors.password}</span>}
            {!isEdit && !errors.password && (
              <span className="umg-field__hint">If left blank, defaults to Employee ID in ALL CAPS.</span>
            )}
          </label>

          <div className="umg-field umg-field--inline">
            <span className="umg-field__label">Status</span>
            <button
              type="button"
              className="umg-toggle"
              onClick={() => set('status', !form.status)}
              aria-pressed={form.status}
              aria-label={form.status ? 'Set inactive' : 'Set active'}
            >
              {form.status
                ? <><IconToggleRight size={28} /><span className="umg-status umg-status--on">Active</span></>
                : <><IconToggleLeft  size={28} /><span className="umg-status umg-status--off">Inactive</span></>
              }
            </button>
          </div>

          {/* Save error */}
          {saveError && (
            <div className="umg-modal__error" role="alert">
              <IconAlertCircle size={13} />
              <span>{saveError}</span>
            </div>
          )}

          {/* Footer */}
          <div className="umg-modal__footer">
            <button type="button" className="umg-btn umg-btn--ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="umg-btn umg-btn--primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add User'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function UserManagement() {

  const [users,         setUsers]         = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages,    setTotalPages]    = useState(1);
  const [currentPage,   setCurrentPage]   = useState(1);
  const [pageSize,      setPageSize]      = useState(DEFAULT_PAGE_SIZE);

  const [activeTab,       setActiveTab]       = useState(TAB_ALL);
  const [columnFilters,   setColumnFilters]   = useState(EMPTY_COLUMN_FILTERS);
  const [initLoading,     setInitLoading]     = useState(true);
  const [pageLoading,     setPageLoading]     = useState(false);
  const [refreshing,      setRefreshing]      = useState(false);
  const [modal,           setModal]           = useState(null);
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState('');
  const [saveError,       setSaveError]       = useState('');
  const [roles,           setRoles]           = useState([]);
  const [resetTarget,     setResetTarget]     = useState(null);
  const [resetting,       setResetting]       = useState(false);
  const [resetMsg,        setResetMsg]        = useState('');
  const [tempAccessUser,  setTempAccessUser]  = useState(null);

  const columnFilterTimerRef = useRef(null);

  const fetchPage = useCallback(async (page, filters, size, tab, isInitial = false) => {
    if (isInitial) setInitLoading(true);
    else           setPageLoading(true);
    setError('');

    try {
      const apiFilters = columnFiltersToServer(filters, tab);
      const data = await getManagedUsers({
        page: page - 1,
        size,
        search: apiFilters.search,
        roleId: apiFilters.roleId,
        status: apiFilters.status,
      });
      setUsers(data?.content ?? []);
      setTotalElements(data?.totalElements ?? 0);
      setTotalPages(data?.totalPages ?? 1);
      setCurrentPage(page);
    } catch (err) {
      setError(err?.message ?? 'Failed to load users.');
    } finally {
      if (isInitial) setInitLoading(false);
      else           setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(1, EMPTY_COLUMN_FILTERS, DEFAULT_PAGE_SIZE, TAB_ALL, true);
    getRoles().then(setRoles).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleColumnFiltersChange = useCallback((next) => {
    setColumnFilters(next);
    setCurrentPage(1);
    clearTimeout(columnFilterTimerRef.current);
    columnFilterTimerRef.current = setTimeout(() => {
      fetchPage(1, next, pageSize, activeTab);
    }, FILTER_DEBOUNCE);
  }, [fetchPage, pageSize, activeTab]);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    fetchPage(1, columnFilters, pageSize, tab);
  }, [columnFilters, pageSize, fetchPage]);

  const handlePageChange = useCallback((page) => {
    fetchPage(page, columnFilters, pageSize, activeTab);
  }, [columnFilters, pageSize, activeTab, fetchPage]);

  const handlePageSizeChange = useCallback((next) => {
    setPageSize(next);
    setCurrentPage(1);
    fetchPage(1, columnFilters, next, activeTab);
  }, [columnFilters, activeTab, fetchPage]);

  const handleRefresh = useCallback(async () => {
    if (refreshing || pageLoading) return;
    setRefreshing(true);
    try {
      await fetchPage(currentPage, columnFilters, pageSize, activeTab);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, pageLoading, currentPage, columnFilters, pageSize, activeTab, fetchPage]);

  // ── Save (add / edit) ────────────────────────────────────────────────────────
  const handleSave = useCallback(async (form) => {
    setSaving(true);
    setSaveError('');
    try {
      const roleIds = normalizeRoleIds(form.roleIds);
      const locationIds = roleIds.includes(2)
        ? normalizeLocationIds(form.locationIds, form.location)
        : [];
      const payload = {
        ...form,
        roleIds,
        roleId: Math.min(...roleIds),
        locationIds,
        location: locationIds[0] ?? '',
        assignedDeviceId: roleIds.includes(3) ? form.assignedDeviceId : '',
      };
      if (modal === 'add') {
        await createManagedUser(payload);
        setModal(null);
        fetchPage(1, columnFilters, pageSize, activeTab);
      } else {
        const updated = await updateManagedUser(form.id, payload);
        // Update in-place on current page without a full reload
        setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u));
        setModal(null);
      }
    } catch (err) {
      setSaveError(err.message ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [modal, columnFilters, pageSize, fetchPage]);

  const handleModalClose = useCallback(() => {
    if (!saving) { setModal(null); setSaveError(''); }
  }, [saving]);

  // ── Status toggle (optimistic, rollback on failure) ─────────────────────────
  const handleToggle = useCallback(async (id) => {
    const original = users.find((u) => u.id === id);
    if (!original) return;
    const next = !original.status;

    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: next } : u));
    setError('');
    try {
      await updateManagedUserStatus(id, next);
    } catch (err) {
      setUsers((prev) => prev.map((u) => u.id === id ? original : u));
      setError(err.message ?? 'Failed to update status. Please try again.');
    }
  }, [users]);

  // ── Reset password ───────────────────────────────────────────────────────────
  const handleResetPassword = useCallback(async () => {
    if (!resetTarget) return;
    setResetting(true);
    setResetMsg('');
    try {
      await resetUserPassword(resetTarget.id);
      setResetMsg(`Password for ${resetTarget.name} has been reset to their Employee ID (all caps).`);
      setTimeout(() => { setResetTarget(null); setResetMsg(''); }, 2500);
    } catch (err) {
      setResetMsg(err?.message || 'Failed to reset password. Please try again.');
    } finally {
      setResetting(false);
    }
  }, [resetTarget]);

  const handleTempAccessSuccess = useCallback((grant) => {
    if (!tempAccessUser) return;
    setUsers((prev) => prev.map((u) => (
      u.id === tempAccessUser.id ? { ...u, activeTempGrant: grant || null } : u
    )));
  }, [tempAccessUser]);

  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + users.length, totalElements);

  const hasFilters = Boolean(columnFiltersToServer(columnFilters, activeTab).search)
    || Boolean(columnFilters.role)
    || activeTab !== TAB_ALL;

  const emptyTitle = hasFilters ? 'No users found' : 'No users yet';
  const emptyDescription = hasFilters
    ? 'Try adjusting your column filters or status tab.'
    : 'Add front-desk accounts. Staff sign in at registered kiosks — location is set by the device.';

  return (
    <div className="ci-page">
      {error && (
        <div className="umg-error-banner" role="alert">
          <IconAlertCircle size={15} />
          <span>{error}</span>
          <button
            type="button"
            className="umg-error-banner__dismiss"
            onClick={() => setError('')}
            aria-label="Dismiss error"
          >
            <IconX size={12} />
          </button>
        </div>
      )}

      <div className={`ci-card${pageLoading ? ' ci-card--loading' : ''}`}>

        <div className="ci-topbar">
          <div className="ci-tabs" role="tablist" aria-label="User status">
            <button
              type="button"
              className={`ci-tab${activeTab === TAB_ALL ? ' ci-tab--active' : ''}`}
              onClick={() => handleTabChange(TAB_ALL)}
              role="tab"
              aria-selected={activeTab === TAB_ALL}
            >
              All
            </button>
            <button
              type="button"
              className={`ci-tab${activeTab === TAB_ACTIVE ? ' ci-tab--active' : ''}`}
              onClick={() => handleTabChange(TAB_ACTIVE)}
              role="tab"
              aria-selected={activeTab === TAB_ACTIVE}
            >
              Active
            </button>
            <button
              type="button"
              className={`ci-tab${activeTab === TAB_INACTIVE ? ' ci-tab--active' : ''}`}
              onClick={() => handleTabChange(TAB_INACTIVE)}
              role="tab"
              aria-selected={activeTab === TAB_INACTIVE}
            >
              Inactive
            </button>
          </div>

          <div className="ci-topbar__actions">
            <button
              type="button"
              className="ci-add-btn"
              onClick={() => setModal('add')}
              aria-label="Add new user"
            >
              <IconPlus size={14} />
              <span>Add User</span>
            </button>
            <button
              type="button"
              className={`ci-icon-btn${refreshing ? ' ci-icon-btn--refreshing' : ''}`}
              onClick={handleRefresh}
              disabled={refreshing || pageLoading || initLoading}
              title="Refresh users"
            >
              <IconRefreshCw size={14} className={refreshing ? 'ci-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="ci-table-wrap">
          <table className="ci-table umg-table" aria-label="User management list">
            <colgroup>
              <col className="umg-col-w--id" />
              <col className="umg-col-w--name" />
              <col className="umg-col-w--role" />
              <col className="umg-col-w--location" />
              <col className="umg-col-w--status" />
              <col className="umg-col-w--actions" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="umg-col-w--id">Employee ID</th>
                <th scope="col" className="umg-col-w--name">Employee Name</th>
                <th scope="col" className="umg-col-w--role">Role</th>
                <th scope="col" className="umg-col-w--location">Assigned kiosk</th>
                <th scope="col" className="umg-col-w--status">Status</th>
                <th scope="col" className="umg-col-w--actions ci-col--actions">Actions</th>
              </tr>
              <UserColumnFilterRow
                filters={columnFilters}
                roles={roles}
                onChange={handleColumnFiltersChange}
              />
            </thead>
            <tbody>
              {initLoading ? (
                <tr>
                  <td colSpan={COL_COUNT} className="ci-table-loading">
                    <LottieLoader size="md" ariaLabel="Loading users" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className="fd-empty-cell">
                    <EmptyState
                      compact
                      icon={<IconUsers size={22} />}
                      title={emptyTitle}
                      description={emptyDescription}
                      action={
                        !hasFilters
                          ? { label: 'Add User', onClick: () => setModal('add'), icon: <IconPlus size={14} /> }
                          : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    onToggle={handleToggle}
                    onEdit={setModal}
                    onTempAccess={setTempAccessUser}
                    onResetPassword={(u) => { setResetTarget(u); setResetMsg(''); }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="ci-card-footer">
          <p className="ci-card-footer__info">
            {totalElements === 0 ? (
              <>Showing <strong>0</strong> of <strong>0</strong> users</>
            ) : (
              <>
                Showing&nbsp;
                <strong>{pageStart + 1}–{pageEnd}</strong>
                &nbsp;of&nbsp;<strong>{totalElements}</strong>&nbsp;users
              </>
            )}
          </p>
          <div className="ci-card-footer__controls">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              alwaysShow
            />
            <PageSizeSelect
              value={pageSize}
              options={PAGE_SIZE_OPTIONS}
              onChange={handlePageSizeChange}
            />
          </div>
        </div>
      </div>

      {/* ── Add/Edit Modal ──────────────────────────────────────────────── */}
      {modal && (
        <UserModal
          key={modal === 'add' ? 'add' : modal.id}
          user={modal === 'add' ? null : modal}
          roles={roles}
          onClose={handleModalClose}
          onSave={handleSave}
          saving={saving}
          saveError={saveError}
        />
      )}

      {/* ── Temporary desk access ─────────────────────────────────────────── */}
      {tempAccessUser && (
        <TempAccessModal
          user={tempAccessUser}
          onClose={() => setTempAccessUser(null)}
          onSuccess={handleTempAccessSuccess}
        />
      )}

      {/* ── Reset Password Confirm Dialog ────────────────────────────────── */}
      {resetTarget && (
        <div className="umg-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget && !resetting) setResetTarget(null); }}>
          <div className="umg-confirm-dialog">
            <div className="umg-confirm-dialog__icon">🔑</div>
            <h3 className="umg-confirm-dialog__title">Reset Password</h3>
            <p className="umg-confirm-dialog__msg">
              Reset the password for <strong>{resetTarget.name}</strong> ({resetTarget.id})?<br />
              <span style={{ fontSize: 12, color: '#888', marginTop: 4, display: 'block' }}>
                New password will be: <strong style={{ fontFamily: 'monospace', color: '#333' }}>{resetTarget.id?.toUpperCase()}</strong>
              </span>
            </p>
            {resetMsg && (
              <p className={`umg-confirm-dialog__result${resetMsg.includes('reset to') ? ' umg-confirm-dialog__result--ok' : ' umg-confirm-dialog__result--err'}`}>
                {resetMsg}
              </p>
            )}
            {!resetMsg && (
              <div className="umg-confirm-dialog__actions">
                <button className="umg-btn umg-btn--ghost" onClick={() => setResetTarget(null)} disabled={resetting}>
                  Cancel
                </button>
                <button className="umg-btn umg-btn--danger" onClick={handleResetPassword} disabled={resetting}>
                  {resetting ? 'Resetting…' : 'Yes, Reset Password'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
