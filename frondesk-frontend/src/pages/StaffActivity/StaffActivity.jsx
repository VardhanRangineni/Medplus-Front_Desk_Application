import { useState, useCallback, useEffect, useRef } from 'react';
import '../CheckInOut/CheckInOut.css';
import './StaffActivity.css';
import DateRangePicker, { defaultRangeToday } from '../../components/DateRangePicker/DateRangePicker';
import Pagination from '../../components/Pagination/Pagination';
import PageSizeSelect from '../../components/Pagination/PageSizeSelect';
import LottieLoader from '../../components/LottieLoader/LottieLoader';
import EmptyState from '../../components/EmptyState/EmptyState';
import SearchSelect from '../../components/SearchSelect/SearchSelect';
import { IconRefreshCw, IconSearch, IconEye } from '../../components/Icons/Icons';
import { getDepartments } from '../CheckInOut/checkInOutService';
import ViewEntryModal from '../CheckInOut/ViewEntryModal/ViewEntryModal';
import { getStaffActivityPage, hasAnyStaffFilter } from './staffActivityService';

const TAB_ALL = 'all';
const TAB_CHECKED_IN = 'checked-in';
const TAB_CHECKED_OUT = 'checked-out';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const FILTER_DEBOUNCE_MS = 350;
const COL_COUNT = 14;

const EMPTY_COL_FILTERS = {
  staffQuery: '',
  visitorName: '',
  entryType: '',
  department: '',
  personToMeet: '',
  status: '',
  workstationMac: '',
};

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'VISITOR', label: 'Visitor' },
  { value: 'EMPLOYEE', label: 'Employee' },
];

function buildDepartmentFilterOptions(departments) {
  const seen = new Set();
  const items = [];
  for (const raw of departments) {
    const name = typeof raw === 'string' ? raw.trim() : '';
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ value: name, label: name });
  }
  items.sort((a, b) => a.label.localeCompare(b.label));
  return [{ value: '', label: 'All' }, ...items];
}

function tabToStatus(tab) {
  if (tab === TAB_CHECKED_IN) return 'checked-in';
  if (tab === TAB_CHECKED_OUT) return 'checked-out';
  return '';
}

function statusToTab(status) {
  const s = (status || '').trim().toLowerCase();
  if (s === 'checked-in') return TAB_CHECKED_IN;
  if (s === 'checked-out') return TAB_CHECKED_OUT;
  return TAB_ALL;
}

function formatContact(row) {
  if (row.entryType === 'EMPLOYEE') return row.empId || '—';
  return row.mobile || '—';
}

function formatCard(row) {
  return row.cardNumber != null ? String(row.cardNumber) : '—';
}

function formatMac(mac) {
  if (!mac || !String(mac).trim()) return '—';
  return String(mac).trim().toUpperCase();
}

function formatStaffDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function resolveStaffStatus(row) {
  const s = (row.status || '').toUpperCase();
  if (s === 'CHECKED_IN') return { label: 'Checked-in', variant: 'in' };
  if (s === 'CHECKED_OUT') return { label: 'Checked-out', variant: 'out' };
  return { label: row.status || '—', variant: 'out' };
}

function staffRowToViewEntry(row) {
  const statusRaw = (row.status || '').toUpperCase();
  return {
    id: row.visitorId,
    type: row.entryType === 'EMPLOYEE' ? 'EMPLOYEE' : 'VISITOR',
    name: row.visitorName,
    mobile: row.mobile,
    empId: row.empId,
    status: statusRaw === 'CHECKED_IN' ? 'checked-in' : 'checked-out',
    personToMeet: row.personToMeet,
    department: row.department,
    card: row.cardNumber,
    companyName: row.companyName,
    checkIn: row.checkInTime ? new Date(row.checkInTime) : null,
    checkOut: row.checkOutTime ? new Date(row.checkOutTime) : null,
    workstationMac: row.workstationMac,
  };
}

function StaffColumnFilterRow({ filters, departments, onChange }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });
  const deptOptions = buildDepartmentFilterOptions(departments);

  return (
    <tr className="ci-col-filters">
      <th className="sa-col-w--entry" aria-hidden="true" />
      <th className="sa-col-w--recorded">
        <input
          className="ci-col-filter"
          type="text"
          placeholder="Filter staff…"
          value={filters.staffQuery}
          onChange={(e) => set('staffQuery', e.target.value)}
          aria-label="Filter by recorded-by staff"
        />
      </th>
      <th className="sa-col-w--name">
        <input
          className="ci-col-filter"
          type="text"
          placeholder="Filter name…"
          value={filters.visitorName}
          onChange={(e) => set('visitorName', e.target.value)}
          aria-label="Filter by visitor name"
        />
      </th>
      <th className="sa-col-w--contact" aria-hidden="true" />
      <th className="sa-col-w--type">
        <SearchSelect
          compact
          value={filters.entryType}
          options={TYPE_FILTER_OPTIONS}
          placeholder="All"
          onChange={(v) => set('entryType', v)}
          ariaLabel="Filter by type"
          minMenuWidth={140}
        />
      </th>
      <th className="sa-col-w--dept">
        <SearchSelect
          compact
          searchable
          searchInField
          value={filters.department}
          options={deptOptions}
          placeholder="All"
          searchPlaceholder="Filter department…"
          emptyMessage="No departments found"
          onChange={(v) => set('department', v)}
          ariaLabel="Filter by department"
          minMenuWidth={200}
        />
      </th>
      <th className="sa-col-w--person">
        <input
          className="ci-col-filter"
          type="text"
          placeholder="Filter person…"
          value={filters.personToMeet}
          onChange={(e) => set('personToMeet', e.target.value)}
          aria-label="Filter by person to meet"
        />
      </th>
      <th className="sa-col-w--location" aria-hidden="true" />
      <th className="sa-col-w--card" aria-hidden="true" />
      <th className="sa-col-w--mac">
        <input
          className="ci-col-filter ci-col-filter--mono"
          type="text"
          placeholder="Filter MAC…"
          value={filters.workstationMac}
          onChange={(e) => set('workstationMac', e.target.value)}
          aria-label="Filter by workstation MAC"
        />
      </th>
      <th className="sa-col-w--time" aria-hidden="true" />
      <th className="sa-col-w--time" aria-hidden="true" />
      <th className="sa-col-w--status" aria-hidden="true" />
      <th className="sa-col-w--actions ci-col--actions ci-col-filter-cell--empty" aria-hidden="true" />
    </tr>
  );
}

function StaffActivityRow({ row, onView }) {
  const status = resolveStaffStatus(row);
  const typeKey = (row.entryType || 'visitor').toLowerCase();

  return (
    <tr className="ci-row ci-row--main">
      <td className="sa-cell--mono">{row.visitorId || '—'}</td>
      <td>
        <div className="ci-name-cell">
          <span className="ci-name-text">
            {row.receptionistName || row.createdBy || '—'}
          </span>
          {row.createdBy && (
            <span className="sa-recorded-id">{row.createdBy}</span>
          )}
        </div>
      </td>
      <td className="ci-col--name">
        <div className="ci-name-cell">
          <span className="ci-name-text">{row.visitorName || '—'}</span>
          {row.companyName && row.entryType !== 'EMPLOYEE' && (
            <span className="ci-company-tag">
              {row.companyName}
            </span>
          )}
        </div>
      </td>
      <td className={`ci-col--contact${row.entryType === 'EMPLOYEE' ? ' ci-col--empid' : ''}`}>
        {formatContact(row)}
      </td>
      <td>
        <span className={`ci-type-badge ci-type-badge--${typeKey}`}>
          {row.entryType === 'EMPLOYEE' ? 'Employee' : 'Visitor'}
        </span>
      </td>
      <td className="ci-col--dept">
        {row.department
          ? <span className="ci-dept-badge">{row.department}</span>
          : <span className="ci-col--muted">—</span>}
      </td>
      <td className="ci-col--person">{row.personToMeet || '—'}</td>
      <td className="sa-cell--mono">{row.locationId || '—'}</td>
      <td className="ci-col--card sa-cell--mono">{formatCard(row)}</td>
      <td className="sa-cell--mac" title="Workstation MAC at check-in">
        {formatMac(row.workstationMac)}
      </td>
      <td className="ci-col--time">
        <span className="ci-time-text">{formatStaffDateTime(row.checkInTime)}</span>
      </td>
      <td className="ci-col--time">
        <span className="ci-time-text">{formatStaffDateTime(row.checkOutTime)}</span>
      </td>
      <td>
        <span className={`ci-status-badge ci-status-badge--${status.variant}`}>
          {status.label}
        </span>
      </td>
      <td className="ci-col--actions">
        <div className="ci-actions">
          <button
            type="button"
            className="ci-action-btn ci-action-btn--view"
            onClick={() => onView(row)}
            aria-label={`View ${row.visitorName || row.visitorId}`}
            title="View entry & movement"
          >
            <IconEye size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function StaffActivity({ session, locationScope }) {
  const locationId = locationScope?.locationId ?? null;

  const [range, setRange] = useState(defaultRangeToday);
  const [activeTab, setActiveTab] = useState(TAB_ALL);
  const [colFilters, setColFilters] = useState(EMPTY_COL_FILTERS);
  const [departments, setDepartments] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [hasQueried, setHasQueried] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [viewEntry, setViewEntry] = useState(null);

  const debounceRef = useRef(null);
  const colFiltersRef = useRef(colFilters);
  colFiltersRef.current = colFilters;

  useEffect(() => {
    let cancelled = false;
    getDepartments()
      .then((list) => { if (!cancelled) setDepartments(list ?? []); })
      .catch(() => { if (!cancelled) setDepartments([]); });
    return () => { cancelled = true; };
  }, []);

  const fetchPage = useCallback(async (page, filters, size = pageSize) => {
    if (!hasAnyStaffFilter(filters)) {
      setError('Enter at least one column filter or choose Checked-in / Checked-out.');
      return;
    }
    setError('');
    setLoading(true);
    setHasQueried(true);
    try {
      const data = await getStaffActivityPage({
        from: range.from,
        to: range.to,
        locationId,
        page: page - 1,
        size,
        filters,
      });
      setResults(data.content);
      setTotalElements(data.totalElements);
      setTotalPages(data.totalPages || 1);
      setCurrentPage(page);
    } catch (err) {
      setResults([]);
      setTotalElements(0);
      setTotalPages(1);
      setError(err?.message || 'Could not load staff activity.');
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, locationId, pageSize]);

  const runSearch = useCallback((page = 1) => {
    fetchPage(page, colFiltersRef.current, pageSize);
  }, [fetchPage, pageSize]);

  const clearAll = useCallback(() => {
    setColFilters(EMPTY_COL_FILTERS);
    setActiveTab(TAB_ALL);
    setResults([]);
    setError('');
    setHasQueried(false);
    setCurrentPage(1);
    setTotalPages(1);
    setTotalElements(0);
  }, []);

  const handleColumnFiltersChange = useCallback((next) => {
    setColFilters(next);
    setActiveTab(statusToTab(next.status));
    setCurrentPage(1);
  }, []);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setColFilters((prev) => ({ ...prev, status: tabToStatus(tab) }));
    setCurrentPage(1);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (refreshing || loading || !hasAnyStaffFilter(colFiltersRef.current)) return;
    setRefreshing(true);
    try {
      await fetchPage(currentPage, colFiltersRef.current, pageSize);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, loading, currentPage, fetchPage, pageSize]);

  const handlePageChange = useCallback((page) => {
    if (!hasAnyStaffFilter(colFiltersRef.current)) return;
    fetchPage(page, colFiltersRef.current, pageSize);
  }, [fetchPage, pageSize]);

  const handlePageSizeChange = useCallback((size) => {
    setPageSize(size);
    setCurrentPage(1);
    if (hasAnyStaffFilter(colFiltersRef.current)) {
      fetchPage(1, colFiltersRef.current, size);
    }
  }, [fetchPage]);

  const canClear = hasQueried || hasAnyStaffFilter(colFilters);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (hasAnyStaffFilter(colFiltersRef.current)) {
        fetchPage(1, colFiltersRef.current, pageSize);
      } else if (hasQueried) {
        setResults([]);
        setTotalElements(0);
        setTotalPages(1);
        setCurrentPage(1);
        setError('');
      }
    }, FILTER_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [colFilters, fetchPage, pageSize, hasQueried]);

  useEffect(() => {
    if (hasQueried && hasAnyStaffFilter(colFiltersRef.current)) {
      runSearch(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, locationId]);

  const pageStart = totalElements === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, totalElements);
  const filtersActive = hasAnyStaffFilter(colFilters);

  const emptyTitle = filtersActive
    ? 'No entries match your filters'
    : 'Set filters to view staff activity';
  const emptyDescription = filtersActive
    ? 'Try broader column filters or a different date range.'
    : 'Use column filters below, or select Checked-in / Checked-out.';

  return (
    <div className="ci-page">
      <div className={`ci-card${loading ? ' ci-card--loading' : ''}`}>

        <div className="ci-topbar">
          <div className="ci-tabs" role="tablist" aria-label="Entry status">
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
              className={`ci-tab${activeTab === TAB_CHECKED_IN ? ' ci-tab--active' : ''}`}
              onClick={() => handleTabChange(TAB_CHECKED_IN)}
              role="tab"
              aria-selected={activeTab === TAB_CHECKED_IN}
            >
              Checked-in
            </button>
            <button
              type="button"
              className={`ci-tab${activeTab === TAB_CHECKED_OUT ? ' ci-tab--active' : ''}`}
              onClick={() => handleTabChange(TAB_CHECKED_OUT)}
              role="tab"
              aria-selected={activeTab === TAB_CHECKED_OUT}
            >
              Checked-out
            </button>
          </div>

          <div className="ci-topbar__actions">
            <button
              type="button"
              className="ci-add-btn"
              onClick={() => runSearch(1)}
              disabled={loading || !filtersActive}
              title={filtersActive ? 'Run search' : 'Add at least one filter first'}
            >
              <IconSearch size={14} />
              <span>{loading ? 'Loading…' : 'Search'}</span>
            </button>
            {canClear && (
              <button
                type="button"
                className="ci-icon-btn"
                onClick={clearAll}
                disabled={loading}
              >
                Clear
              </button>
            )}
            <button
              type="button"
              className={`ci-icon-btn${refreshing ? ' ci-icon-btn--refreshing' : ''}`}
              onClick={handleRefresh}
              disabled={refreshing || loading || !filtersActive}
              title="Refresh results"
            >
              <IconRefreshCw size={14} className={refreshing ? 'ci-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="ci-filters">
          <DateRangePicker
            from={range.from}
            to={range.to}
            onChange={(r) => {
              setRange(r);
              setCurrentPage(1);
            }}
          />
        </div>

        {error && (
          <p className="sa-inline-error" role="alert">{error}</p>
        )}

        <div className="ci-table-wrap sa-table-wrap">
          <table className="ci-table sa-table" aria-label="Staff activity entries">
            <colgroup>
              <col className="sa-col-w--entry" />
              <col className="sa-col-w--recorded" />
              <col className="sa-col-w--name" />
              <col className="sa-col-w--contact" />
              <col className="sa-col-w--type" />
              <col className="sa-col-w--dept" />
              <col className="sa-col-w--person" />
              <col className="sa-col-w--location" />
              <col className="sa-col-w--card" />
              <col className="sa-col-w--mac" />
              <col className="sa-col-w--time" />
              <col className="sa-col-w--time" />
              <col className="sa-col-w--status" />
              <col className="sa-col-w--actions" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="sa-col-w--entry">Entry ID</th>
                <th scope="col" className="sa-col-w--recorded">Recorded by</th>
                <th scope="col" className="sa-col-w--name">Name</th>
                <th scope="col" className="sa-col-w--contact">Mobile / Emp ID</th>
                <th scope="col" className="sa-col-w--type">Type</th>
                <th scope="col" className="sa-col-w--dept">Department</th>
                <th scope="col" className="sa-col-w--person">Person to Meet</th>
                <th scope="col" className="sa-col-w--location">Location</th>
                <th scope="col" className="sa-col-w--card">Card</th>
                <th scope="col" className="sa-col-w--mac">Machine ID</th>
                <th scope="col" className="sa-col-w--time">Check-in</th>
                <th scope="col" className="sa-col-w--time">Check-out</th>
                <th scope="col" className="sa-col-w--status">Status</th>
                <th scope="col" className="sa-col-w--actions ci-col--actions">Actions</th>
              </tr>
              <StaffColumnFilterRow
                filters={colFilters}
                departments={departments}
                onChange={handleColumnFiltersChange}
              />
            </thead>
            <tbody>
              {loading && results.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className="ci-table-loading">
                    <LottieLoader size="md" ariaLabel="Loading staff activity" />
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className="fd-empty-cell">
                    <EmptyState
                      compact
                      title={emptyTitle}
                      description={emptyDescription}
                    />
                  </td>
                </tr>
              ) : (
                results.map((row, idx) => (
                  <StaffActivityRow
                    key={`${row.visitorId}-${row.checkInTime}-${idx}`}
                    row={row}
                    onView={(r) => setViewEntry(staffRowToViewEntry(r))}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="ci-card-footer">
          <p className="ci-card-footer__info">
            {totalElements === 0 ? (
              <>Showing <strong>0</strong> of <strong>0</strong> entries</>
            ) : (
              <>
                Showing&nbsp;
                <strong>{pageStart}–{pageEnd}</strong>
                &nbsp;of&nbsp;<strong>{totalElements}</strong>&nbsp;entries
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

      {viewEntry && (
        <ViewEntryModal
          entry={viewEntry}
          onClose={() => setViewEntry(null)}
          onEdit={() => setViewEntry(null)}
        />
      )}
    </div>
  );
}
