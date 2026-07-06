import { useState, useEffect, useCallback, useRef } from 'react';
import '../CheckInOut/CheckInOut.css';
import '../UserManagement/UserManagement.css';
import './LocationMaster.css';
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
  IconAlertCircle,
  IconMapPin,
} from '../../components/Icons/Icons';
import {
  getLocations,
  createLocation,
  updateLocationStatus,
  previewLocationId,
  getCompanies,
  createCompany,
  updateCompanyStatus,
  getLocationTypes,
  createLocationType,
  updateLocationTypeStatus,
} from './locationMasterService';

const TAB_LOCATIONS = 'locations';
const TAB_COMPANIES = 'companies';
const TAB_TYPES     = 'types';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const FILTER_DEBOUNCE   = 350;
const COL_COUNT         = 3;

const EMPTY_COLUMN_FILTERS = {
  locationId: '',
  locationName: '',
  status: '',
};

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const EMPTY_LOCATION_FORM = {
  companyId: '',
  locationTypeId: '',
  state: '',
  city: '',
  address: '',
};

const EMPTY_COMPANY_FORM = { companyName: '' };
const EMPTY_TYPE_FORM    = { typeName: '' };

function buildLocationNamePreview(companyId, locationTypeId, address, companies, locationTypes) {
  const company = companies.find((c) => String(c.id) === String(companyId));
  const locType = locationTypes.find((t) => String(t.id) === String(locationTypeId));
  const addr = address.trim();
  if (!company || !locType || !addr) return '';
  return `${company.companyName} - ${locType.typeName} - ${addr}`;
}

function LocationColumnFilterRow({ filters, onChange }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <tr className="ci-col-filters">
      <th className="lm-col-w--id">
        <input
          className="ci-col-filter ci-col-filter--mono"
          type="text"
          placeholder="Filter ID…"
          value={filters.locationId}
          onChange={(e) => set('locationId', e.target.value)}
          aria-label="Filter by location ID"
        />
      </th>
      <th className="lm-col-w--name">
        <input
          className="ci-col-filter"
          type="text"
          placeholder="Filter name…"
          value={filters.locationName}
          onChange={(e) => set('locationName', e.target.value)}
          aria-label="Filter by location name"
        />
      </th>
      <th className="lm-col-w--status">
        <SearchSelect
          compact
          value={filters.status}
          options={STATUS_FILTER_OPTIONS}
          placeholder="All"
          onChange={(v) => set('status', v)}
          ariaLabel="Filter by status"
          minMenuWidth={140}
        />
      </th>
    </tr>
  );
}

function StatusToggle({ active, onToggle, label }) {
  return (
    <button type="button" className="umg-toggle" onClick={onToggle} aria-label={`Toggle ${label}`}>
      {active
        ? <IconToggleRight size={28} className="umg-toggle__on" />
        : <IconToggleLeft size={28} className="umg-toggle__off" />
      }
      <span className={`umg-status${active ? ' umg-status--active' : ' umg-status--inactive'}`}>
        {active ? 'Active' : 'Inactive'}
      </span>
    </button>
  );
}

function AddLocationModal({
  open,
  onClose,
  onCreated,
  companies,
  locationTypes,
}) {
  const [form, setForm] = useState(EMPTY_LOCATION_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [previewId, setPreviewId] = useState('');

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_LOCATION_FORM);
      setErrors({});
      setPreviewId('');
    }
  }, [open]);

  useEffect(() => {
    if (!form.companyId || !form.locationTypeId) {
      setPreviewId('');
      return;
    }
    let cancelled = false;
    previewLocationId(Number(form.companyId), Number(form.locationTypeId))
      .then((id) => { if (!cancelled) setPreviewId(id); })
      .catch(() => { if (!cancelled) setPreviewId(''); });
    return () => { cancelled = true; };
  }, [form.companyId, form.locationTypeId]);

  if (!open) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const locationNamePreview = buildLocationNamePreview(
    form.companyId,
    form.locationTypeId,
    form.address,
    companies,
    locationTypes,
  );

  const validate = () => {
    const errs = {};
    if (!form.companyId) errs.companyId = 'Select a company';
    if (!form.locationTypeId) errs.locationTypeId = 'Select an office type';
    if (!form.state.trim()) errs.state = 'State is required';
    if (!form.city.trim()) errs.city = 'City is required';
    if (!form.address.trim()) errs.address = 'Address is required';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const created = await createLocation({
        companyId: Number(form.companyId),
        locationTypeId: Number(form.locationTypeId),
        state: form.state.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
      });
      onCreated(created);
      onClose();
    } catch (err) {
      setErrors({ submit: err?.message ?? 'Failed to create location.' });
    } finally {
      setSaving(false);
    }
  };

  const companyOptions = companies
    .filter((c) => c.active)
    .map((c) => ({ value: String(c.id), label: c.companyName }));

  const typeOptions = locationTypes
    .filter((t) => t.active)
    .map((t) => ({ value: String(t.id), label: t.typeName }));

  return (
    <div className="umg-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="umg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="umg-modal__header">
          <h2 className="umg-modal__title">Add Location</h2>
          <button className="umg-modal__close" onClick={onClose} aria-label="Close">
            <IconX size={14} />
          </button>
        </div>

        <form className="umg-modal__body" onSubmit={handleSubmit} noValidate>
          {errors.submit && (
            <div className="umg-error-banner" role="alert">
              <IconAlertCircle size={16} />
              {errors.submit}
            </div>
          )}

          <div className="umg-field">
            <span className="umg-field__label">Company</span>
            <SearchSelect
              value={form.companyId}
              onChange={(v) => set('companyId', v)}
              options={companyOptions}
              placeholder="Select company…"
              searchable
              ariaLabel="Company"
            />
            {errors.companyId && <span className="umg-field__error">{errors.companyId}</span>}
            {companyOptions.length === 0 && (
              <span className="umg-field__hint">Add a company in the Companies tab first.</span>
            )}
          </div>

          <div className="umg-field">
            <span className="umg-field__label">Office Type</span>
            <SearchSelect
              value={form.locationTypeId}
              onChange={(v) => set('locationTypeId', v)}
              options={typeOptions}
              placeholder="Select office type…"
              searchable
              ariaLabel="Office type"
            />
            {errors.locationTypeId && <span className="umg-field__error">{errors.locationTypeId}</span>}
          </div>

          {previewId && (
            <div className="lm-id-preview">
              <span className="lm-id-preview__label">Location ID</span>
              <span>{previewId}</span>
            </div>
          )}
          

          <label className="umg-field">
            <span className="umg-field__label">Address</span>
            <textarea
              className={`umg-input${errors.address ? ' umg-input--error' : ''}`}
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              placeholder="Full street address"
              rows={3}
              style={{ resize: 'vertical', minHeight: 72 }}
            />
            {errors.address && <span className="umg-field__error">{errors.address}</span>}
          </label>

          {locationNamePreview && (
            <div className="lm-name-preview">
              <span className="lm-name-preview__label">Location Name</span>
              <span>{locationNamePreview}</span>
            </div>
          )}

          <div className="umg-field-row">
            <label className="umg-field">
              <span className="umg-field__label">State</span>
              <input
                className={`umg-input${errors.state ? ' umg-input--error' : ''}`}
                value={form.state}
                onChange={(e) => set('state', e.target.value)}
                placeholder="Telangana"
                autoComplete="off"
              />
              {errors.state && <span className="umg-field__error">{errors.state}</span>}
            </label>

            <label className="umg-field">
              <span className="umg-field__label">City</span>
              <input
                className={`umg-input${errors.city ? ' umg-input--error' : ''}`}
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                placeholder="Hyderabad"
                autoComplete="off"
              />
              {errors.city && <span className="umg-field__error">{errors.city}</span>}
            </label>
          </div>

          <div className="umg-modal__footer">
            <button type="button" className="umg-btn umg-btn--ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="umg-btn umg-btn--primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LocationMaster() {
  const [activeTab, setActiveTab] = useState(TAB_LOCATIONS);

  const [locations, setLocations] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [columnFilters, setColumnFilters] = useState(EMPTY_COLUMN_FILTERS);
  const [initLoading, setInitLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [companies, setCompanies] = useState([]);
  const [locationTypes, setLocationTypes] = useState([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [companyForm, setCompanyForm] = useState(EMPTY_COMPANY_FORM);
  const [typeForm, setTypeForm] = useState(EMPTY_TYPE_FORM);
  const [masterError, setMasterError] = useState(null);
  const [masterSaving, setMasterSaving] = useState(false);

  const columnFilterTimerRef = useRef(null);

  const loadMasters = useCallback(async () => {
    const [co, lt] = await Promise.all([
      getCompanies(false),
      getLocationTypes(false),
    ]);
    setCompanies(co ?? []);
    setLocationTypes(lt ?? []);
  }, []);

  const fetchLocations = useCallback(async (page, filters, size, isInitial = false) => {
    if (isInitial) setInitLoading(true);
    else setPageLoading(true);
    setLoadError(null);
    try {
      const data = await getLocations({ page: page - 1, size, filters });
      setLocations(data?.content ?? []);
      setTotalElements(data?.totalElements ?? 0);
      setTotalPages(data?.totalPages ?? 1);
      setCurrentPage(page);
    } catch (err) {
      setLoadError(err?.message ?? 'Failed to load locations.');
    } finally {
      if (isInitial) setInitLoading(false);
      else setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations(1, EMPTY_COLUMN_FILTERS, DEFAULT_PAGE_SIZE, true);
    loadMasters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleColumnFiltersChange = useCallback((next) => {
    setColumnFilters(next);
    setCurrentPage(1);
    clearTimeout(columnFilterTimerRef.current);
    columnFilterTimerRef.current = setTimeout(() => {
      fetchLocations(1, next, pageSize);
    }, FILTER_DEBOUNCE);
  }, [fetchLocations, pageSize]);

  const handlePageChange = useCallback((page) => {
    fetchLocations(page, columnFilters, pageSize);
  }, [columnFilters, pageSize, fetchLocations]);

  const handlePageSizeChange = useCallback((next) => {
    setPageSize(next);
    setCurrentPage(1);
    fetchLocations(1, columnFilters, next);
  }, [columnFilters, fetchLocations]);

  const hasActiveFilters = Boolean(
    columnFilters.locationId.trim()
    || columnFilters.locationName.trim()
    || columnFilters.status,
  );

  const handleToggleLocation = async (locationId, current) => {
    const next = !current;
    setLocations((prev) => prev.map((l) =>
      l.locationId === locationId ? { ...l, active: next } : l
    ));
    try {
      await updateLocationStatus(locationId, next);
    } catch (err) {
      setLocations((prev) => prev.map((l) =>
        l.locationId === locationId ? { ...l, active: current } : l
      ));
      setLoadError(err?.message ?? 'Failed to update status.');
    }
  };

  const handleToggleCompany = async (id, current) => {
    const next = !current;
    setCompanies((prev) => prev.map((c) => c.id === id ? { ...c, active: next } : c));
    try {
      await updateCompanyStatus(id, next);
    } catch (err) {
      setCompanies((prev) => prev.map((c) => c.id === id ? { ...c, active: current } : c));
      setMasterError(err?.message ?? 'Failed to update company.');
    }
  };

  const handleToggleType = async (id, current) => {
    const next = !current;
    setLocationTypes((prev) => prev.map((t) => t.id === id ? { ...t, active: next } : t));
    try {
      await updateLocationTypeStatus(id, next);
    } catch (err) {
      setLocationTypes((prev) => prev.map((t) => t.id === id ? { ...t, active: current } : t));
      setMasterError(err?.message ?? 'Failed to update location type.');
    }
  };

  const handleAddCompany = async (e) => {
    e.preventDefault();
    setMasterError(null);
    setMasterSaving(true);
    try {
      const created = await createCompany({
        companyName: companyForm.companyName.trim(),
      });
      setCompanies((prev) => [...prev, created]);
      setCompanyForm(EMPTY_COMPANY_FORM);
    } catch (err) {
      setMasterError(err?.message ?? 'Failed to add company.');
    } finally {
      setMasterSaving(false);
    }
  };

  const handleAddType = async (e) => {
    e.preventDefault();
    setMasterError(null);
    setMasterSaving(true);
    try {
      const created = await createLocationType({
        typeName: typeForm.typeName.trim(),
      });
      setLocationTypes((prev) => [...prev, created]);
      setTypeForm(EMPTY_TYPE_FORM);
    } catch (err) {
      setMasterError(err?.message ?? 'Failed to add location type.');
    } finally {
      setMasterSaving(false);
    }
  };

  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + locations.length, pageStart + pageSize);
  const emptyTitle = hasActiveFilters ? 'No locations found' : 'No locations yet';
  const emptyDescription = hasActiveFilters
    ? 'Try adjusting your column filters.'
    : 'Add companies and office types, then create your first location.';

  return (
    <div className="ci-page">
      {loadError && activeTab === TAB_LOCATIONS && (
        <div className="umg-error-banner" role="alert">
          <IconAlertCircle size={15} />
          <span>{loadError}</span>
        </div>
      )}

      {masterError && activeTab !== TAB_LOCATIONS && (
        <div className="umg-error-banner" role="alert">
          <IconAlertCircle size={15} />
          <span>{masterError}</span>
        </div>
      )}

      <div className={`ci-card${pageLoading && activeTab === TAB_LOCATIONS ? ' ci-card--loading' : ''}`}>
        <div className="ci-topbar">
          <div className="ci-tabs" role="tablist" aria-label="Location master sections">
            {[
              { id: TAB_LOCATIONS, label: 'Locations' },
              { id: TAB_COMPANIES, label: 'Companies' },
              { id: TAB_TYPES, label: 'Office Types' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`ci-tab${activeTab === tab.id ? ' ci-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="ci-topbar__actions">
            {activeTab === TAB_LOCATIONS && (
              <button
                type="button"
                className="ci-add-btn"
                onClick={() => setShowAddModal(true)}
                aria-label="Add location"
              >
                <IconPlus size={14} />
                <span>Add Location</span>
              </button>
            )}
          </div>
        </div>

        {activeTab === TAB_LOCATIONS && (
          <>
            <div className="ci-table-wrap">
              <table className="ci-table lm-table" aria-label="Locations list">
                <colgroup>
                  <col className="lm-col-w--id" />
                  <col className="lm-col-w--name" />
                  <col className="lm-col-w--status" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className="lm-col-w--id">Location ID</th>
                    <th scope="col" className="lm-col-w--name">Location Name</th>
                    <th scope="col" className="lm-col-w--status">Status</th>
                  </tr>
                  <LocationColumnFilterRow
                    filters={columnFilters}
                    onChange={handleColumnFiltersChange}
                  />
                </thead>
                <tbody>
                  {initLoading ? (
                    <tr>
                      <td colSpan={COL_COUNT} className="ci-table-loading">
                        <LottieLoader size="md" ariaLabel="Loading locations" />
                      </td>
                    </tr>
                  ) : locations.length === 0 ? (
                    <tr>
                      <td colSpan={COL_COUNT} className="fd-empty-cell">
                        <EmptyState
                          compact
                          icon={<IconMapPin size={22} />}
                          title={emptyTitle}
                          description={emptyDescription}
                          action={
                            !hasActiveFilters
                              ? { label: 'Add Location', onClick: () => setShowAddModal(true), icon: <IconPlus size={14} /> }
                              : undefined
                          }
                        />
                      </td>
                    </tr>
                  ) : locations.map((loc) => (
                    <tr key={loc.locationId}>
                      <td className="lm-table__id">{loc.locationId}</td>
                      <td className="lm-table__name">{loc.descriptiveName}</td>
                      <td>
                        <StatusToggle
                          active={loc.active}
                          label={loc.locationId}
                          onToggle={() => handleToggleLocation(loc.locationId, loc.active)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ci-card-footer">
              <p className="ci-card-footer__info">
                {totalElements === 0 ? (
                  <>Showing <strong>0</strong> of <strong>0</strong> locations</>
                ) : (
                  <>
                    Showing&nbsp;
                    <strong>{pageStart + 1}–{pageEnd}</strong>
                    &nbsp;of&nbsp;<strong>{totalElements}</strong>&nbsp;locations
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
          </>
        )}

        {activeTab === TAB_COMPANIES && (
          <div className="lm-master-panel">
            <form className="lm-master-form" onSubmit={handleAddCompany}>
              <label className="umg-field">
                <span className="umg-field__label">Company</span>
                <input
                  className="umg-input"
                  value={companyForm.companyName}
                  onChange={(e) => setCompanyForm({ companyName: e.target.value })}
                  placeholder="Medplus Health Services"
                  required
                />
              </label>
              <div className="lm-master-form__submit">
                <button type="submit" className="umg-btn umg-btn--primary" disabled={masterSaving}>
                  <IconPlus size={14} />
                  Add Company
                </button>
              </div>
            </form>
            <div className="ci-table-wrap">
              <table className="ci-table lm-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.length === 0 ? (
                    <tr><td colSpan={2} style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>No companies yet</td></tr>
                  ) : companies.map((c) => (
                    <tr key={c.id}>
                      <td>{c.companyName}</td>
                      <td>
                        <StatusToggle
                          active={c.active}
                          label={c.companyName}
                          onToggle={() => handleToggleCompany(c.id, c.active)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === TAB_TYPES && (
          <div className="lm-master-panel">
            <form className="lm-master-form" onSubmit={handleAddType}>
              <label className="umg-field">
                <span className="umg-field__label">Office Type</span>
                <input
                  className="umg-input"
                  value={typeForm.typeName}
                  onChange={(e) => setTypeForm({ typeName: e.target.value })}
                  placeholder="Head Office"
                  required
                />
              </label>
              <div className="lm-master-form__submit">
                <button type="submit" className="umg-btn umg-btn--primary" disabled={masterSaving}>
                  <IconPlus size={14} />
                  Add Office Type
                </button>
              </div>
            </form>
            <div className="ci-table-wrap">
              <table className="ci-table lm-table">
                <thead>
                  <tr>
                    <th>Office Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {locationTypes.length === 0 ? (
                    <tr><td colSpan={2} style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>No office types yet</td></tr>
                  ) : locationTypes.map((t) => (
                    <tr key={t.id}>
                      <td>{t.typeName}</td>
                      <td>
                        <StatusToggle
                          active={t.active}
                          label={t.typeName}
                          onToggle={() => handleToggleType(t.id, t.active)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      <AddLocationModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={() => fetchLocations(1, columnFilters, pageSize)}
        companies={companies}
        locationTypes={locationTypes}
      />
    </div>
  );
}
