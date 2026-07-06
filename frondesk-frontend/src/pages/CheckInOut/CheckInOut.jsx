import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import './CheckInOut.css';
import {
  IconDownload,
  IconPlus,
  IconEye,
  IconEdit,
  IconDoorOut,
  IconX,
  IconUser,
  IconBuilding,
  IconQrCode,
  IconRefreshCw,
} from '../../components/Icons/Icons';
import Pagination       from '../../components/Pagination/Pagination';
import PageSizeSelect   from '../../components/Pagination/PageSizeSelect';
import DateRangePicker, { defaultRangeToday } from '../../components/DateRangePicker/DateRangePicker';
import { getPrimaryWorkstationMac, macsMatch } from '../../services/workstationMac';
import {
  getEntries,
  getStatusCounts,
  getDepartments,
  checkOutEntry,
  exportToExcel,
  fetchAllEntriesForExport,
} from './checkInOutService';
import AddVisitorModal   from './AddVisitorModal/AddVisitorModal';
import AddEmployeeModal  from './AddEmployeeModal/AddEmployeeModal';
import ViewEntryModal    from './ViewEntryModal/ViewEntryModal';
import EditVisitorModal  from './EditVisitorModal/EditVisitorModal';
import EditEmployeeModal from './EditEmployeeModal/EditEmployeeModal';
import PreRegModal       from './PreRegModal/PreRegModal';
import QrScanModal       from './QrScanModal/QrScanModal';
import EmptyState        from '../../components/EmptyState/EmptyState';
import LottieLoader      from '../../components/LottieLoader/LottieLoader';
import SearchSelect      from '../../components/SearchSelect/SearchSelect';
import { ToastProvider, useToast } from '../../components/AppToast/AppToast';
import CardReturnModal   from './CardReturnModal';
import { notifyCheckInSuccess } from './checkInNotifications';
import { canCheckIn, hasRole } from '../../services/locationScope';

// ─── Constants ────────────────────────────────────────────────────────────────
const TAB_ALL         = 'all';
const TAB_CHECKED_IN  = 'checked-in';
const TAB_CHECKED_OUT = 'checked-out';
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const FILTER_DEBOUNCE   = 350; // ms
const COL_COUNT         = 11;  // type + name + contact + dept + person + card + in + out + lastScan + status + actions

const EMPTY_COLUMN_FILTERS = {
  type: '',
  name: '',
  contact: '',
  department: '',
  personToMeet: '',
  card: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateTime(date) {
  if (!date) return '—';
  return (
    date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' +
    date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  );
}

function formatLastScan(entry) {
  if (!entry.lastScanDeviceName && !entry.lastScan) return '—';
  return {
    place: entry.lastScanDeviceName ?? '—',
    time: entry.lastScan ? formatDateTime(entry.lastScan) : null,
  };
}

function resolveStatus(entry) {
  return entry.status === 'checked-in'
    ? { label: 'Checked-in',  variant: 'in'  }
    : { label: 'Checked-out', variant: 'out' };
}

/** Maps a TAB constant to the `status` query param value expected by the backend. */
function tabToStatus(tab) {
  if (tab === TAB_CHECKED_IN)  return 'checked-in';
  if (tab === TAB_CHECKED_OUT) return 'checked-out';
  return null;
}

/** Maps column filters to API params (department + full-text search). */
function columnFiltersToServer({ name, contact, personToMeet, department }) {
  const search =
    name.trim() ||
    contact.trim() ||
    personToMeet.trim() ||
    '';
  return {
    search,
    department: department.trim() || null,
  };
}

/** Client-side filters for columns not covered by the search API (type, card, extra text). */
function matchesColumnFilters(entry, filters) {
  if (filters.type && entry.type !== filters.type) return false;

  if (filters.name.trim()) {
    const q = filters.name.trim().toLowerCase();
    if (!entry.name?.toLowerCase().includes(q)) return false;
  }

  if (filters.contact.trim()) {
    const q = filters.contact.trim().toLowerCase();
    const value = (entry.type === 'EMPLOYEE' ? entry.empId : entry.mobile) || '';
    if (!value.toLowerCase().includes(q)) return false;
  }

  if (filters.department.trim() && entry.department !== filters.department.trim()) {
    return false;
  }

  if (filters.personToMeet.trim()) {
    const q = filters.personToMeet.trim().toLowerCase();
    if (!entry.personToMeet?.toLowerCase().includes(q)) return false;
  }

  if (filters.card.trim()) {
    const q = filters.card.trim().toLowerCase();
    const cardVal = String(entry.card ?? '').toLowerCase();
    if (!cardVal.includes(q)) return false;
  }

  return true;
}

function hasClientOnlyColumnFilters(filters) {
  const textCount = [filters.name, filters.contact, filters.personToMeet]
    .filter((s) => s.trim()).length;
  return Boolean(filters.type || filters.card.trim() || textCount > 1);
}

// ─── Empty-state illustration (badge + plant) ─────────────────────────────────
function CheckInOutEmptyIllustration() {
  return (
    <div className="ci-empty-art">
      <div className="ci-empty-art__badge">
        <div className="ci-empty-art__badge-photo" />
        <div className="ci-empty-art__badge-lines">
          <span /><span /><span />
        </div>
      </div>
      <div className="ci-empty-art__plant">
        <div className="ci-empty-art__pot" />
        <div className="ci-empty-art__leaf ci-empty-art__leaf--l" />
        <div className="ci-empty-art__leaf ci-empty-art__leaf--r" />
      </div>
    </div>
  );
}

// ─── Sub-component: main entry row ────────────────────────────────────────────
function EntryRow({ entry, onCheckOut, onView, onEdit, canMutate }) {
  const isIn    = entry.status === 'checked-in';
  const status  = resolveStatus(entry);
  const contact = entry.type === 'EMPLOYEE' ? entry.empId : entry.mobile;
  const isEmp   = entry.type === 'EMPLOYEE';
  const lastScan = formatLastScan(entry);

  return (
    <>
      <tr className={`ci-row ci-row--main${isIn ? '' : ' ci-row--out'}`}>

        <td>
          <span className={`ci-type-badge ci-type-badge--${entry.type.toLowerCase()}`}>
            {entry.type === 'EMPLOYEE' ? 'Employee' : 'Visitor'}
          </span>
        </td>

        <td className="ci-col--name">
          <div className="ci-name-cell">
            <span className="ci-name-text">{entry.name}</span>
            {entry.type === 'VISITOR' && entry.companyName && (
              <span className="ci-company-tag">
                🏢 {entry.companyName}
              </span>
            )}
          </div>
        </td>

        <td className={`ci-col--contact${isEmp ? ' ci-col--empid' : ''}`}>
          {contact ?? '—'}
        </td>

        <td className="ci-col--dept">
          {entry.department
            ? <span className="ci-dept-badge">{entry.department}</span>
            : <span className="ci-col--muted">—</span>
          }
        </td>

        <td className="ci-col--person">{entry.personToMeet || '—'}</td>

        <td className="ci-col--card">
          {entry.card != null ? entry.card : '—'}
        </td>

        <td className="ci-col--time">
          <span className="ci-time-text">{formatDateTime(entry.checkIn)}</span>
        </td>
        <td className="ci-col--time">
          <span className="ci-time-text">{entry.checkOut ? formatDateTime(entry.checkOut) : '—'}</span>
        </td>

        <td className="ci-col--last-scan">
          {lastScan === '—' ? (
            <span className="ci-col--muted">—</span>
          ) : (
            <div className="ci-last-scan-cell">
              <span className="ci-last-scan-place">{lastScan.place}</span>
              {lastScan.time && (
                <span className="ci-last-scan-time">{lastScan.time}</span>
              )}
            </div>
          )}
        </td>

        <td>
          <span className={`ci-status-badge ci-status-badge--${status.variant}`}>
            {status.label}
          </span>
        </td>

        <td className="ci-col--actions">
          <div className="ci-actions">
            <button
              className="ci-action-btn ci-action-btn--view"
              onClick={() => onView(entry)}
              aria-label={`View ${entry.name}`}
              title="View"
            >
              <IconEye size={14} />
            </button>
            {isIn && canMutate && (
              <button
                className="ci-action-btn ci-action-btn--edit"
                onClick={() => onEdit(entry)}
                aria-label={`Edit ${entry.name}`}
                title="Edit"
              >
                <IconEdit size={14} />
              </button>
            )}
            {isIn && canMutate && (
              <button
                className="ci-action-btn ci-action-btn--checkout"
                onClick={() => onCheckOut(entry.id)}
                aria-label={`Check out ${entry.name}`}
                title="Check Out"
              >
                <IconDoorOut size={14} />
              </button>
            )}
          </div>
        </td>
      </tr>

    </>
  );
}

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

// ─── Table column filters (second header row) ─────────────────────────────────
function ColumnFilterRow({ filters, departments, onChange }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });
  const deptOptions = buildDepartmentFilterOptions(departments);

  return (
    <tr className="ci-col-filters">
      <th className="ci-col-w--type">
        <SearchSelect
          compact
          value={filters.type}
          options={TYPE_FILTER_OPTIONS}
          placeholder="All"
          onChange={(v) => set('type', v)}
          ariaLabel="Filter by type"
          minMenuWidth={140}
        />
      </th>
      <th className="ci-col-w--name">
        <input
          className="ci-col-filter"
          type="text"
          placeholder="Filter name…"
          value={filters.name}
          onChange={(e) => set('name', e.target.value)}
          aria-label="Filter by name"
        />
      </th>
      <th className="ci-col-w--contact">
        <input
          className="ci-col-filter"
          type="text"
          placeholder="Filter mobile / ID…"
          value={filters.contact}
          onChange={(e) => set('contact', e.target.value)}
          aria-label="Filter by mobile or employee ID"
        />
      </th>
      <th className="ci-col-w--dept">
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
      <th className="ci-col-w--person">
        <input
          className="ci-col-filter"
          type="text"
          placeholder="Filter person…"
          value={filters.personToMeet}
          onChange={(e) => set('personToMeet', e.target.value)}
          aria-label="Filter by person to meet"
        />
      </th>
      <th className="ci-col-w--card">
        <input
          className="ci-col-filter"
          type="text"
          placeholder="Filter card…"
          value={filters.card}
          onChange={(e) => set('card', e.target.value)}
          aria-label="Filter by assigned card"
        />
      </th>
      <th className="ci-col-w--time ci-col-filter-cell--empty" aria-hidden="true" />
      <th className="ci-col-w--time ci-col-filter-cell--empty" aria-hidden="true" />
      <th className="ci-col-w--last-scan ci-col-filter-cell--empty" aria-hidden="true" />
      <th className="ci-col-w--status ci-col-filter-cell--empty" aria-hidden="true" />
      <th className="ci-col-w--actions ci-col--actions ci-col-filter-cell--empty" aria-hidden="true" />
    </tr>
  );
}

// ─── Entry Type Selection Modal ───────────────────────────────────────────────
function EntryTypeModal({ onClose, onSelect }) {
  const handleOverlayClick = (e) => { if (e.target === e.currentTarget) onClose(); };

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="etm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="etm-title"
      onClick={handleOverlayClick}
    >
      <div className="etm-dialog">
        <div className="etm-header">
          <div>
            <h2 className="etm-title" id="etm-title">Select Entry Type</h2>
            <p className="etm-subtitle">Are you adding a visitor or an employee?</p>
          </div>
          <button className="etm-close" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>

        <div className="etm-options">
          <button className="etm-option-card" onClick={() => onSelect('visitor')}>
            <span className="etm-option-icon etm-option-icon--visitor">
              <IconUser size={28} />
            </span>
            <span className="etm-option-label">Visitor</span>
          </button>
          <button className="etm-option-card" onClick={() => onSelect('employee')}>
            <span className="etm-option-icon etm-option-icon--employee">
              <IconBuilding size={28} />
            </span>
            <span className="etm-option-label">Employee</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CheckInOut(props) {
  return (
    <ToastProvider>
      <CheckInOutPage {...props} />
    </ToastProvider>
  );
}

function CheckInOutPage({ session, locationScope }) {
  const { showToast } = useToast();

  const isAdmin = hasRole(session, 'PRIMARY_ADMIN');
  const isRegionalAdmin = hasRole(session, 'REGIONAL_ADMIN');
  const canDoCheckIn = canCheckIn(session);
  const scopeParams = useMemo(() => ({
    locationId: locationScope?.locationId ?? null,
    allLocations: locationScope?.allLocations ?? false,
  }), [locationScope?.locationId, locationScope?.allLocations]);
  const currentEmployeeId = (session?.employeeId ?? '').toLowerCase();
  const [workstationMac, setWorkstationMac] = useState('');

  useEffect(() => {
    let cancelled = false;
    getPrimaryWorkstationMac().then((mac) => {
      if (!cancelled) setWorkstationMac(mac);
    });
    return () => { cancelled = true; };
  }, []);

  // ── Server-side data ────────────────────────────────────────────────────────
  const [entries,       setEntries]       = useState([]);
  const canMutateEntry = useCallback((entry) => {
    if (!entry || entry.status !== 'checked-in') return false;
    if (isAdmin || isRegionalAdmin) return true;
    const createdBy = (entry.createdBy ?? '').toLowerCase();
    if (createdBy && createdBy === currentEmployeeId) return true;
    return macsMatch(entry.workstationMac, workstationMac);
  }, [isAdmin, isRegionalAdmin, currentEmployeeId, workstationMac]);

  const [totalElements, setTotalElements] = useState(0);
  const [totalPages,    setTotalPages]    = useState(1);
  const [statusCounts,  setStatusCounts]  = useState({ total: 0, checkedIn: 0, checkedOut: 0 });
  const [departments,   setDepartments]   = useState([]);

  // ── Loading states ──────────────────────────────────────────────────────────
  const [initLoading, setInitLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [exporting,   setExporting]   = useState(false);

  // ── Filter / UI state ───────────────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState(TAB_ALL);
  const [myEntriesOnly, setMyEntriesOnly] = useState(false);
  const [columnFilters, setColumnFilters] = useState(EMPTY_COLUMN_FILTERS);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [pageSize,     setPageSize]     = useState(DEFAULT_PAGE_SIZE);
  const [range,        setRange]        = useState(defaultRangeToday);

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [entryTypeModalOpen, setEntryTypeModalOpen] = useState(false);
  const [addVisitorOpen,     setAddVisitorOpen]      = useState(false);
  const [addEmployeeOpen,    setAddEmployeeOpen]     = useState(false);
  const [viewEntry,          setViewEntry]           = useState(null);
  const [editEntry,          setEditEntry]           = useState(null);
  const [preRegOpen,         setPreRegOpen]          = useState(false);
  const [qrScanOpen,         setQrScanOpen]          = useState(false);
  const [zoneScanOpen,       setZoneScanOpen]        = useState(false);
  const [cardReturnTarget,   setCardReturnTarget]    = useState(null);
  const columnFilterTimerRef = useRef(null);

  const createdByFilter = myEntriesOnly && session?.employeeId
    ? session.employeeId
    : null;

  // ── Core fetch function ─────────────────────────────────────────────────────
  // Accepts explicit params to avoid stale-closure issues in callbacks.
  const fetchPage = useCallback(async (page, tab, filters, from, to, createdBy, size, isInitial = false) => {
    if (isInitial) setInitLoading(true);
    else           setPageLoading(true);

    const { search, department } = columnFiltersToServer(filters);

    try {
      const result = await getEntries({
        page:       page - 1,
        size:       size ?? pageSize,
        search,
        status:     tabToStatus(tab),
        department,
        from,
        to,
        createdBy,
        ...scopeParams,
      });
      setEntries(result.entries);
      setTotalElements(result.totalElements);
      setTotalPages(result.totalPages || 1);
      setCurrentPage(page);
    } catch {
      // Leave stale data; UI stays usable
    } finally {
      if (isInitial) setInitLoading(false);
      else           setPageLoading(false);
    }
  }, [pageSize, scopeParams]);

  const refreshCounts = useCallback((from, to, createdBy) => {
    getStatusCounts({ from, to, createdBy, ...scopeParams })
      .then(setStatusCounts)
      .catch(() => {});
  }, [scopeParams]);

  const refreshDepartments = useCallback(() => {
    getDepartments()
      .then(setDepartments)
      .catch(() => {});
  }, []);

  // ── Initial load — run all three requests in parallel ───────────────────────
  useEffect(() => {
    let active = true;
    setInitLoading(true);

    const { from, to } = range;
    const createdBy = myEntriesOnly && session?.employeeId ? session.employeeId : null;
    const { search, department } = columnFiltersToServer(columnFilters);
    Promise.all([
      getEntries({ page: 0, size: pageSize, search, department, from, to, createdBy, ...scopeParams }),
      getStatusCounts({ from, to, createdBy, ...scopeParams }),
      getDepartments(),
    ])
      .then(([pageData, counts, depts]) => {
        if (!active) return;
        setEntries(pageData.entries);
        setTotalElements(pageData.totalElements);
        setTotalPages(pageData.totalPages || 1);
        setStatusCounts(counts);
        setDepartments(depts);
      })
      .catch(() => {})
      .finally(() => { if (active) setInitLoading(false); });

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, scopeParams, myEntriesOnly, pageSize, columnFilters]);

  const handleColumnFiltersChange = useCallback((next) => {
    setColumnFilters(next);
    clearTimeout(columnFilterTimerRef.current);
    columnFilterTimerRef.current = setTimeout(() => {
      fetchPage(1, activeTab, next, range.from, range.to, createdByFilter, pageSize);
    }, FILTER_DEBOUNCE);
  }, [activeTab, range, createdByFilter, pageSize, fetchPage]);

  // ── Tab change ──────────────────────────────────────────────────────────────
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    fetchPage(1, tab, columnFilters, range.from, range.to, createdByFilter, pageSize);
  }, [columnFilters, range, createdByFilter, pageSize, fetchPage]);

  const handleMyEntriesToggle = useCallback(() => {
    const next = !myEntriesOnly;
    setMyEntriesOnly(next);
    const createdBy = next && session?.employeeId ? session.employeeId : null;
    fetchPage(1, activeTab, columnFilters, range.from, range.to, createdBy, pageSize);
    refreshCounts(range.from, range.to, createdBy);
  }, [myEntriesOnly, session, activeTab, columnFilters, range, scopeParams, pageSize, fetchPage, refreshCounts]);

  const handlePageSizeChange = useCallback((next) => {
    setPageSize(next);
    setCurrentPage(1);
    fetchPage(1, activeTab, columnFilters, range.from, range.to, createdByFilter, next);
  }, [activeTab, columnFilters, range, createdByFilter, fetchPage]);

  // ── Page change ─────────────────────────────────────────────────────────────
  const handlePageChange = useCallback((page) => {
    fetchPage(page, activeTab, columnFilters, range.from, range.to, createdByFilter, pageSize);
  }, [activeTab, columnFilters, range, createdByFilter, pageSize, fetchPage]);

  // ── Checkout ────────────────────────────────────────────────────────────────
  const handleCheckOut = useCallback((id) => {
    const entry = entries.find((e) => e.id === id);
    if (entry?.card != null) {
      setCardReturnTarget(entry);
      return;
    }
    doCheckOut(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  const handleCardReturnAnswer = useCallback((returned) => {
    if (!cardReturnTarget) return;
    const id = cardReturnTarget.id;
    if (!returned) {
      showToast({
        variant: 'warning',
        title: 'Card not returned',
        message: 'Please collect the visitor card before completing checkout.',
      });
      setCardReturnTarget(null);
      return;
    }
    setCardReturnTarget(null);
    doCheckOut(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardReturnTarget, showToast]);

  const handleCardReturnCancel = useCallback(() => {
    setCardReturnTarget(null);
  }, []);

  const doCheckOut = useCallback(async (id) => {
    const original = entries.find((e) => e.id === id);
    if (!original) return;

    setEntries((prev) => {
      const updated = prev.map((e) =>
        e.id === id ? { ...e, status: 'checked-out', checkOut: new Date() } : e
      );
      return activeTab === TAB_CHECKED_IN ? updated.filter((e) => e.id !== id) : updated;
    });
    if (activeTab === TAB_CHECKED_IN) {
      setTotalElements((n) => Math.max(0, n - 1));
    }

    try {
      await checkOutEntry(id);
      refreshCounts(range.from, range.to, createdByFilter);
    } catch {
      showToast({
        variant: 'error',
        title: 'Check-out failed',
        message: 'Could not check out this entry. Please try again.',
      });
      fetchPage(currentPage, activeTab, columnFilters, range.from, range.to, createdByFilter, pageSize);
    }
  }, [entries, activeTab, currentPage, columnFilters, range, scopeParams, createdByFilter, pageSize, fetchPage, refreshCounts, showToast]);

  // ── Entry type modal ────────────────────────────────────────────────────────
  const handleEntryTypeSelect = useCallback((type) => {
    setEntryTypeModalOpen(false);
    if (type === 'visitor')  setAddVisitorOpen(true);
    if (type === 'employee') setAddEmployeeOpen(true);
  }, []);

  // After a successful add/edit: go to page 1, refresh counts & departments
  const afterMutation = useCallback(() => {
    fetchPage(1, activeTab, columnFilters, range.from, range.to, createdByFilter, pageSize);
    refreshCounts(range.from, range.to, createdByFilter);
    refreshDepartments();
  }, [activeTab, columnFilters, range, scopeParams, createdByFilter, pageSize, fetchPage, refreshCounts, refreshDepartments]);

  const handleCloseAddVisitor  = useCallback(() => setAddVisitorOpen(false), []);
  const handleVisitorSuccess   = useCallback((result) => {
    setAddVisitorOpen(false);
    notifyCheckInSuccess(showToast, result);
    afterMutation();
  }, [afterMutation, showToast]);

  const handleCloseAddEmployee = useCallback(() => setAddEmployeeOpen(false), []);
  const handleEmployeeBack     = useCallback(() => { setAddEmployeeOpen(false); setEntryTypeModalOpen(true); }, []);
  const handleEmployeeSuccess  = useCallback((result) => {
    setAddEmployeeOpen(false);
    notifyCheckInSuccess(showToast, result);
    afterMutation();
  }, [afterMutation, showToast]);

  const handleQrCheckInSuccess = useCallback((entry) => {
    notifyCheckInSuccess(showToast, entry);
    afterMutation();
  }, [afterMutation, showToast]);

  // ── View / Edit ─────────────────────────────────────────────────────────────
  const handleView      = useCallback((entry) => setViewEntry(entry), []);
  const handleCloseView = useCallback(() => setViewEntry(null), []);
  const handleEdit      = useCallback((entry) => { setViewEntry(null); setEditEntry(entry); }, []);
  const handleCloseEdit = useCallback(() => setEditEntry(null), []);
  const handleEditSuccess = useCallback(() => { setEditEntry(null); afterMutation(); }, [afterMutation]);

  // ── Export: all rows matching current date range, tab, search, dept, location ─
  const handleExport = useCallback(async () => {
    if (totalElements === 0 || exporting) return;
    setExporting(true);
    try {
      const { search, department } = columnFiltersToServer(columnFilters);
      const rows = await fetchAllEntriesForExport({
        search,
        status:     tabToStatus(activeTab),
        department,
        from:       range.from,
        to:         range.to,
        createdBy:  createdByFilter,
        ...scopeParams,
      }).then((all) => all.filter((e) => matchesColumnFilters(e, columnFilters)));
      if (rows.length === 0) return;
      const from = range.from;
      const to   = range.to;
      const name = from && to && from !== to
        ? `visitors_${from}_to_${to}.xlsx`
        : `visitors_${from || to}.xlsx`;
      await exportToExcel(rows, name);
    } catch (err) {
      window.alert(err?.message || 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [
    totalElements, exporting, columnFilters, activeTab,
    range.from, range.to, createdByFilter, scopeParams,
  ]);

  // ── Manual refresh ───────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    if (refreshing || pageLoading) return;
    setRefreshing(true);
    try {
      await fetchPage(currentPage, activeTab, columnFilters, range.from, range.to, createdByFilter, pageSize);
      refreshCounts(range.from, range.to, createdByFilter);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, pageLoading, currentPage, activeTab, columnFilters, range, createdByFilter, pageSize, fetchPage, refreshCounts]);

  // ── Pagination helpers ──────────────────────────────────────────────────────
  const displayEntries = entries.filter((e) => matchesColumnFilters(e, columnFilters));
  const clientFilterActive = hasClientOnlyColumnFilters(columnFilters);
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd   = Math.min(pageStart + displayEntries.length, pageStart + pageSize);
  const visibleCount = clientFilterActive ? displayEntries.length : totalElements;

  const emptyTitle = 'No visitors yet for this selection';
  const emptyDescription = 'Try adjusting your column filters or add a new entry to get started.';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="ci-page">
      <div className={`ci-card${pageLoading ? ' ci-card--loading' : ''}`}>

        {/* ── Top bar: status tabs + primary actions ─────────────────────── */}
        <div className="ci-topbar">
          <div className="ci-tabs" role="tablist">
            <button
              className={`ci-tab${activeTab === TAB_ALL ? ' ci-tab--active' : ''}`}
              onClick={() => handleTabChange(TAB_ALL)}
              role="tab" aria-selected={activeTab === TAB_ALL}
            >
              All ({statusCounts.total})
            </button>
            <button
              className={`ci-tab${activeTab === TAB_CHECKED_IN ? ' ci-tab--active' : ''}`}
              onClick={() => handleTabChange(TAB_CHECKED_IN)}
              role="tab" aria-selected={activeTab === TAB_CHECKED_IN}
            >
              Checked-in ({statusCounts.checkedIn})
            </button>
            <button
              className={`ci-tab${activeTab === TAB_CHECKED_OUT ? ' ci-tab--active' : ''}`}
              onClick={() => handleTabChange(TAB_CHECKED_OUT)}
              role="tab" aria-selected={activeTab === TAB_CHECKED_OUT}
            >
              Checked-out ({statusCounts.checkedOut})
            </button>
            <button
              type="button"
              className={`ci-tab ci-tab--mine${myEntriesOnly ? ' ci-tab--active' : ''}`}
              onClick={handleMyEntriesToggle}
              aria-pressed={myEntriesOnly}
              title="Show only entries you checked in"
            >
              <IconUser size={14} />
              My Entries
            </button>
          </div>

          <div className="ci-topbar__actions">
            {canDoCheckIn && (
              <>
                <button
                  type="button"
                  className="ci-add-btn"
                  onClick={() => setEntryTypeModalOpen(true)}
                >
                  <IconPlus size={14} />
                  <span>Add Entry</span>
                </button>
                <button
                  type="button"
                  className="ci-icon-btn ci-icon-btn--scan"
                  onClick={() => setQrScanOpen(true)}
                  title="Scan visitor QR code to check in"
                >
                  <IconQrCode size={14} />
                  <span>Scan QR</span>
                </button>
                <button
                  type="button"
                  className="ci-icon-btn"
                  onClick={() => setZoneScanOpen(true)}
                  title="Record visitor movement at this kiosk"
                >
                  <IconQrCode size={14} />
                  <span>Zone Scan</span>
                </button>
              </>
            )}
            <button
              type="button"
              className="ci-icon-btn"
              onClick={handleExport}
              disabled={totalElements === 0 || exporting || initLoading}
              title={exporting ? 'Preparing export…' : 'Export all matching rows to Excel (.xlsx)'}
            >
              <IconDownload size={14} className={exporting ? 'ci-spin' : ''} />
              <span>{exporting ? 'Exporting…' : 'Export'}</span>
            </button>
            <button
              type="button"
              className={`ci-icon-btn${refreshing ? ' ci-icon-btn--refreshing' : ''}`}
              onClick={handleRefresh}
              disabled={refreshing || pageLoading}
              title="Refresh data"
            >
              <IconRefreshCw size={14} className={refreshing ? 'ci-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* ── Location + date (column filters are in the table header) ── */}
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
        <div className="ci-table-wrap">
          <table className="ci-table" aria-label="Check-in/Check-out entries">
            <colgroup>
              <col className="ci-col-w--type" />
              <col className="ci-col-w--name" />
              <col className="ci-col-w--contact" />
              <col className="ci-col-w--dept" />
              <col className="ci-col-w--person" />
              <col className="ci-col-w--card" />
              <col className="ci-col-w--time" />
              <col className="ci-col-w--time" />
              <col className="ci-col-w--last-scan" />
              <col className="ci-col-w--status" />
              <col className="ci-col-w--actions" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="ci-col-w--type">Type</th>
                <th scope="col" className="ci-col-w--name">Name</th>
                <th scope="col" className="ci-col-w--contact">Mobile / Emp ID</th>
                <th scope="col" className="ci-col-w--dept">Department</th>
                <th scope="col" className="ci-col-w--person">Person to Meet</th>
                <th scope="col" className="ci-col-w--card">Assigned Card</th>
                <th scope="col" className="ci-col-w--time">Check-in</th>
                <th scope="col" className="ci-col-w--time">Check-out</th>
                <th scope="col" className="ci-col-w--last-scan">Last Scan</th>
                <th scope="col" className="ci-col-w--status">Status</th>
                <th scope="col" className="ci-col-w--actions ci-col--actions">Actions</th>
              </tr>
              <ColumnFilterRow
                filters={columnFilters}
                departments={departments}
                onChange={handleColumnFiltersChange}
              />
            </thead>
            <tbody>
              {initLoading ? (
                <tr>
                  <td colSpan={COL_COUNT} className="ci-table-loading">
                    <LottieLoader size="md" ariaLabel="Loading entries" />
                  </td>
                </tr>
              ) : displayEntries.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className="fd-empty-cell">
                    <EmptyState
                      compact
                      illustration={<CheckInOutEmptyIllustration />}
                      title={emptyTitle}
                      description={emptyDescription}
                      actions={canDoCheckIn ? [
                        {
                          label: 'Add Entry',
                          onClick: () => setEntryTypeModalOpen(true),
                          icon: <IconPlus size={14} />,
                          variant: 'primary',
                        },
                        {
                          label: 'Scan QR',
                          onClick: () => setQrScanOpen(true),
                          icon: <IconQrCode size={14} />,
                          variant: 'scan',
                        },
                      ] : []}
                    />
                  </td>
                </tr>
              ) : (
                displayEntries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    onCheckOut={handleCheckOut}
                    onView={handleView}
                    onEdit={handleEdit}
                            canMutate={canMutateEntry(entry)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: entry count + pagination */}
        {!initLoading && (
          <div className="ci-card-footer">
            <p className="ci-card-footer__info">
              {visibleCount === 0 ? (
                <>Showing <strong>0</strong> of <strong>0</strong> entries</>
              ) : clientFilterActive ? (
                <>
                  Showing&nbsp;<strong>{displayEntries.length}</strong>
                  &nbsp;on this page (column filters applied)
                </>
              ) : (
                <>
                  Showing&nbsp;
                  <strong>{pageStart + 1}–{pageEnd}</strong>
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
        )}
      </div>

      {/* ── Entry Type Modal ─────────────────────────────────────────────── */}
      {entryTypeModalOpen && (
        <EntryTypeModal
          onClose={() => setEntryTypeModalOpen(false)}
          onSelect={handleEntryTypeSelect}
        />
      )}

      {addVisitorOpen && (
        <AddVisitorModal
          onClose={handleCloseAddVisitor}
          onSuccess={handleVisitorSuccess}
        />
      )}

      {addEmployeeOpen && (
        <AddEmployeeModal
          onClose={handleCloseAddEmployee}
          onBack={handleEmployeeBack}
          onSuccess={handleEmployeeSuccess}
        />
      )}

      {viewEntry && (
        <ViewEntryModal
          entry={viewEntry}
          onClose={handleCloseView}
          onEdit={handleEdit}
        />
      )}

      {editEntry && editEntry.type === 'VISITOR' && (
        <EditVisitorModal
          entry={editEntry}
          onClose={handleCloseEdit}
          onSuccess={handleEditSuccess}
        />
      )}

      {editEntry && editEntry.type === 'EMPLOYEE' && (
        <EditEmployeeModal
          entry={editEntry}
          onClose={handleCloseEdit}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* ── Pre-Registration Link Modal ──────────────────────────────── */}
      {preRegOpen && (
        <PreRegModal
          session={session}
          onClose={() => setPreRegOpen(false)}
        />
      )}

      {/* ── QR Scan Modal ────────────────────────────────────────────── */}
      {qrScanOpen && (
        <QrScanModal
          onClose={() => { setQrScanOpen(false); afterMutation(); }}
          onSuccess={(entry) => {
            handleQrCheckInSuccess(entry);
            setQrScanOpen(false);
          }}
        />
      )}

      {cardReturnTarget && (
        <CardReturnModal
          entry={cardReturnTarget}
          onAnswer={handleCardReturnAnswer}
          onCancel={handleCardReturnCancel}
        />
      )}

      {zoneScanOpen && (
        <QrScanModal
          mode="ZONE_SCAN"
          onClose={() => setZoneScanOpen(false)}
          onSuccess={() => {
            handleRefresh();
          }}
        />
      )}

    </div>
  );
}
