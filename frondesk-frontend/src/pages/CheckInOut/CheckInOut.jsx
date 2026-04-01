import { useState, useEffect, useCallback, useRef } from 'react';
import './CheckInOut.css';
import {
  IconSearch,
  IconFilter,
  IconDownload,
  IconPlus,
  IconEye,
  IconEdit,
  IconDoorOut,
  IconChevronRight,
  IconChevronDown,
  IconX,
  IconUser,
  IconBuilding,
} from '../../components/Icons/Icons';
import Pagination from '../../components/Pagination/Pagination';
import {
  getEntries,
  getStatusCounts,
  getDepartments,
  checkOutEntry,
  checkOutMember,
  exportToExcel,
} from './checkInOutService';
import AddVisitorModal   from './AddVisitorModal/AddVisitorModal';
import AddEmployeeModal  from './AddEmployeeModal/AddEmployeeModal';
import ViewEntryModal    from './ViewEntryModal/ViewEntryModal';
import EditVisitorModal  from './EditVisitorModal/EditVisitorModal';
import EditEmployeeModal from './EditEmployeeModal/EditEmployeeModal';

// ─── Constants ────────────────────────────────────────────────────────────────
const TAB_ALL         = 'all';
const TAB_CHECKED_IN  = 'checked-in';
const TAB_CHECKED_OUT = 'checked-out';
const PAGE_SIZE       = 20;
const SEARCH_DEBOUNCE = 350; // ms
const COL_COUNT       = 11;  // expand + type + name + contact + dept + status + person + card + in + out + actions

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateTime(date) {
  if (!date) return '—';
  return (
    date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' +
    date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  );
}

function resolveStatus(entry) {
  if (entry.members.length > 0) {
    const total     = 1 + entry.members.length;
    const checkedIn = (entry.status === 'checked-in' ? 1 : 0)
                    + entry.members.filter((m) => m.status === 'checked-in').length;
    if (checkedIn === 0) return { label: 'Checked-out', variant: 'out' };
    return { label: `Checked-in (${checkedIn}/${total})`, variant: 'in' };
  }
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

// ─── Sub-component: member sub-row ────────────────────────────────────────────
function MemberRow({ member, entryId, onCheckOut }) {
  const isIn = member.status === 'checked-in';
  return (
    <tr className="ci-row ci-row--member">
      <td className="ci-col--expand" />
      <td><span className="ci-type-badge ci-type-badge--member">Member</span></td>
      <td className="ci-col--name ci-col--name-sub">{member.name}</td>
      <td className="ci-col--contact">—</td>
      <td>—</td>
      <td>
        <span className={`ci-status-badge ci-status-badge--${isIn ? 'in' : 'out'}`}>
          {isIn ? 'Checked-in' : 'Checked-out'}
        </span>
      </td>
      <td>—</td>
      <td>{member.card ?? '—'}</td>
      <td>—</td>
      <td>—</td>
      <td>
        <div className="ci-actions">
          {isIn && (
            <button
              className="ci-action-btn ci-action-btn--checkout"
              onClick={() => onCheckOut(entryId, member.id)}
              aria-label={`Check out ${member.name}`}
              title="Check Out"
            >
              <IconDoorOut size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Sub-component: main entry row ────────────────────────────────────────────
function EntryRow({ entry, expanded, onToggleExpand, onCheckOut, onMemberCheckOut, onView, onEdit }) {
  const hasMembers = entry.members.length > 0;
  const isIn       = entry.status === 'checked-in';
  const status     = resolveStatus(entry);
  const contact    = entry.type === 'EMPLOYEE' ? entry.empId : entry.mobile;
  const isEmp      = entry.type === 'EMPLOYEE';

  return (
    <>
      <tr className={`ci-row ci-row--main${isIn ? '' : ' ci-row--out'}`}>

        <td className="ci-col--expand">
          {hasMembers && (
            <button
              className="ci-expand-btn"
              onClick={() => onToggleExpand(entry.id)}
              aria-label={expanded ? 'Collapse members' : 'Expand members'}
              aria-expanded={expanded}
            >
              {expanded ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
            </button>
          )}
        </td>

        <td>
          <span className={`ci-type-badge ci-type-badge--${entry.type.toLowerCase()}`}>
            {entry.type === 'EMPLOYEE' ? 'Employee' : 'Visitor'}
          </span>
        </td>

        <td className="ci-col--name">
          {entry.name}
          {hasMembers && <span className="ci-member-count">+{entry.members.length}</span>}
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

        <td>
          <span className={`ci-status-badge ci-status-badge--${status.variant}`}>
            {status.label}
          </span>
        </td>

        <td className="ci-col--person">{entry.personToMeet || '—'}</td>

        <td className="ci-col--card">
          {isEmp ? 'N/A' : (entry.card ?? '—')}
        </td>

        <td className="ci-col--time">{formatDateTime(entry.checkIn)}</td>
        <td className="ci-col--time">{entry.checkOut ? formatDateTime(entry.checkOut) : '—'}</td>

        <td>
          <div className="ci-actions">
            <button
              className="ci-action-btn ci-action-btn--view"
              onClick={() => onView(entry)}
              aria-label={`View ${entry.name}`}
              title="View"
            >
              <IconEye size={14} />
            </button>
            {isIn && (
              <button
                className="ci-action-btn ci-action-btn--edit"
                onClick={() => onEdit(entry)}
                aria-label={`Edit ${entry.name}`}
                title="Edit"
              >
                <IconEdit size={14} />
              </button>
            )}
            {isIn && (
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

      {expanded && entry.members.map((m) => (
        <MemberRow
          key={m.id}
          member={m}
          entryId={entry.id}
          onCheckOut={onMemberCheckOut}
        />
      ))}
    </>
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
export default function CheckInOut() {

  // ── Server-side data ────────────────────────────────────────────────────────
  const [entries,       setEntries]       = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages,    setTotalPages]    = useState(1);
  const [statusCounts,  setStatusCounts]  = useState({ total: 0, checkedIn: 0, checkedOut: 0 });
  const [departments,   setDepartments]   = useState([]);

  // ── Loading states ──────────────────────────────────────────────────────────
  const [initLoading, setInitLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);

  // ── Filter / UI state ───────────────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState(TAB_ALL);
  const [search,       setSearch]       = useState('');
  const [selectedDept, setSelectedDept] = useState(null);
  const [filterOpen,   setFilterOpen]   = useState(false);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [expandedRows, setExpandedRows] = useState(new Set());

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [entryTypeModalOpen, setEntryTypeModalOpen] = useState(false);
  const [addVisitorOpen,     setAddVisitorOpen]      = useState(false);
  const [addEmployeeOpen,    setAddEmployeeOpen]     = useState(false);
  const [viewEntry,          setViewEntry]           = useState(null);
  const [editEntry,          setEditEntry]           = useState(null);

  const filterRef     = useRef(null);
  const searchTimerRef = useRef(null);

  // ── Core fetch function ─────────────────────────────────────────────────────
  // Accepts explicit params to avoid stale-closure issues in callbacks.
  const fetchPage = useCallback(async (page, tab, q, dept, isInitial = false) => {
    if (isInitial) setInitLoading(true);
    else           setPageLoading(true);

    try {
      const result = await getEntries({
        page:       page - 1,          // service expects 0-based; UI uses 1-based
        size:       PAGE_SIZE,
        search:     q,
        status:     tabToStatus(tab),
        department: dept,
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
  }, []);

  const refreshCounts = useCallback(() => {
    getStatusCounts()
      .then(setStatusCounts)
      .catch(() => {});
  }, []);

  const refreshDepartments = useCallback(() => {
    getDepartments()
      .then(setDepartments)
      .catch(() => {});
  }, []);

  // ── Initial load — run all three requests in parallel ───────────────────────
  useEffect(() => {
    let active = true;
    setInitLoading(true);

    Promise.all([
      getEntries({ page: 0, size: PAGE_SIZE }),
      getStatusCounts(),
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
  }, []);

  // ── Close filter dropdown on outside click ──────────────────────────────────
  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filterOpen]);

  // ── Tab change ──────────────────────────────────────────────────────────────
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    fetchPage(1, tab, search, selectedDept);
  }, [search, selectedDept, fetchPage]);

  // ── Search (debounced) ──────────────────────────────────────────────────────
  const handleSearchChange = useCallback((value) => {
    setSearch(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchPage(1, activeTab, value, selectedDept);
    }, SEARCH_DEBOUNCE);
  }, [activeTab, selectedDept, fetchPage]);

  // ── Department filter ───────────────────────────────────────────────────────
  const handleSelectDept = useCallback((dept) => {
    setSelectedDept(dept);
    setFilterOpen(false);
    fetchPage(1, activeTab, search, dept);
  }, [activeTab, search, fetchPage]);

  const handleClearDept = useCallback((e) => {
    e.stopPropagation();
    setSelectedDept(null);
    fetchPage(1, activeTab, search, null);
  }, [activeTab, search, fetchPage]);

  // ── Page change ─────────────────────────────────────────────────────────────
  const handlePageChange = useCallback((page) => {
    fetchPage(page, activeTab, search, selectedDept);
    setExpandedRows(new Set()); // collapse all on page turn
  }, [activeTab, search, selectedDept, fetchPage]);

  // ── Optimistic check-out ────────────────────────────────────────────────────
  const handleCheckOut = useCallback(async (id) => {
    const original = entries.find((e) => e.id === id);
    if (!original) return;

    // Optimistic: update status; if on "checked-in" tab remove the row
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
      refreshCounts();
    } catch {
      // Rollback: re-fetch the current page
      fetchPage(currentPage, activeTab, search, selectedDept);
    }
  }, [entries, activeTab, currentPage, search, selectedDept, fetchPage, refreshCounts]);

  // ── Optimistic member check-out ─────────────────────────────────────────────
  const handleMemberCheckOut = useCallback(async (entryId, memberId) => {
    const entryOrig = entries.find((e) => e.id === entryId);
    if (!entryOrig) return;

    setEntries((prev) =>
      prev.map((e) =>
        e.id !== entryId ? e : {
          ...e,
          members: e.members.map((m) =>
            m.id === memberId ? { ...m, status: 'checked-out' } : m
          ),
        }
      )
    );

    try {
      await checkOutMember(entryId, memberId);
      refreshCounts();
    } catch {
      fetchPage(currentPage, activeTab, search, selectedDept);
    }
  }, [entries, currentPage, activeTab, search, selectedDept, fetchPage, refreshCounts]);

  // ── Entry type modal ────────────────────────────────────────────────────────
  const handleEntryTypeSelect = useCallback((type) => {
    setEntryTypeModalOpen(false);
    if (type === 'visitor')  setAddVisitorOpen(true);
    if (type === 'employee') setAddEmployeeOpen(true);
  }, []);

  // After a successful add/edit: go to page 1, refresh counts & departments
  const afterMutation = useCallback(() => {
    fetchPage(1, activeTab, search, selectedDept);
    refreshCounts();
    refreshDepartments();
  }, [activeTab, search, selectedDept, fetchPage, refreshCounts, refreshDepartments]);

  const handleCloseAddVisitor  = useCallback(() => setAddVisitorOpen(false), []);
  const handleVisitorSuccess   = useCallback(() => { setAddVisitorOpen(false);  afterMutation(); }, [afterMutation]);

  const handleCloseAddEmployee = useCallback(() => setAddEmployeeOpen(false), []);
  const handleEmployeeBack     = useCallback(() => { setAddEmployeeOpen(false); setEntryTypeModalOpen(true); }, []);
  const handleEmployeeSuccess  = useCallback(() => { setAddEmployeeOpen(false); afterMutation(); }, [afterMutation]);

  // ── View / Edit ─────────────────────────────────────────────────────────────
  const handleView      = useCallback((entry) => setViewEntry(entry), []);
  const handleCloseView = useCallback(() => setViewEntry(null), []);
  const handleEdit      = useCallback((entry) => { setViewEntry(null); setEditEntry(entry); }, []);
  const handleCloseEdit = useCallback(() => setEditEntry(null), []);
  const handleEditSuccess = useCallback(() => { setEditEntry(null); afterMutation(); }, [afterMutation]);

  // ── Expand / collapse row ───────────────────────────────────────────────────
  const toggleExpand = useCallback((id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── Export current page ─────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (entries.length === 0) return;
    const today = new Date().toISOString().split('T')[0];
    exportToExcel(entries, `visitors_${today}.xlsx`);
  }, [entries]);

  // ── Pagination helpers ──────────────────────────────────────────────────────
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEnd   = Math.min(pageStart + entries.length, pageStart + PAGE_SIZE);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="ci-page">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <header className="ci-page__header">
        <h1 className="ci-page__title">Check-In / Check-Out</h1>
        <p className="ci-page__sub">Manage visitor, member, and employee entries.</p>
      </header>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="ci-toolbar">

        {/* Status tabs */}
        <div className="ci-tabs" role="tablist">
          <button
            className={`ci-tab${activeTab === TAB_ALL ? ' ci-tab--active' : ''}`}
            onClick={() => handleTabChange(TAB_ALL)}
            role="tab"
            aria-selected={activeTab === TAB_ALL}
          >
            All <span className="ci-tab__count">{statusCounts.total}</span>
          </button>
          <button
            className={`ci-tab${activeTab === TAB_CHECKED_IN ? ' ci-tab--active' : ''}`}
            onClick={() => handleTabChange(TAB_CHECKED_IN)}
            role="tab"
            aria-selected={activeTab === TAB_CHECKED_IN}
          >
            Checked-in <span className="ci-tab__count">{statusCounts.checkedIn}</span>
          </button>
          <button
            className={`ci-tab${activeTab === TAB_CHECKED_OUT ? ' ci-tab--active' : ''}`}
            onClick={() => handleTabChange(TAB_CHECKED_OUT)}
            role="tab"
            aria-selected={activeTab === TAB_CHECKED_OUT}
          >
            Checked-out <span className="ci-tab__count">{statusCounts.checkedOut}</span>
          </button>
        </div>

        {/* Right actions */}
        <div className="ci-toolbar__right">

          {/* Search */}
          <label className="ci-search" aria-label="Search entries">
            <IconSearch size={14} />
            <input
              className="ci-search__input"
              type="search"
              placeholder="Search name, mobile, dept…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </label>

          {/* Filter Dept dropdown */}
          <div className="ci-filter-wrap" ref={filterRef}>
            <button
              className={`ci-icon-btn${filterOpen || selectedDept ? ' ci-icon-btn--active' : ''}`}
              onClick={() => setFilterOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={filterOpen}
              aria-label="Filter by department"
            >
              <IconFilter size={14} />
              <span>Filter Dept</span>
              {selectedDept && (
                <span
                  className="ci-filter-clear"
                  onClick={handleClearDept}
                  role="button"
                  tabIndex={0}
                  aria-label="Clear department filter"
                  onKeyDown={(e) => e.key === 'Enter' && handleClearDept(e)}
                >
                  <IconX size={10} />
                </span>
              )}
            </button>

            {filterOpen && (
              <div className="ci-filter-dropdown" role="menu" aria-label="Department filter options">
                <button
                  className={`ci-filter-option${!selectedDept ? ' ci-filter-option--active' : ''}`}
                  role="menuitemradio"
                  aria-checked={!selectedDept}
                  onClick={() => handleSelectDept(null)}
                >
                  <span>All Departments</span>
                  {!selectedDept && <span className="ci-filter-check">✓</span>}
                </button>

                {departments.length > 0 && <div className="ci-filter-divider" role="separator" />}

                {departments.length === 0 && !initLoading && (
                  <div className="ci-filter-empty">No departments found</div>
                )}

                {departments.map((dept) => (
                  <button
                    key={dept}
                    className={`ci-filter-option${selectedDept === dept ? ' ci-filter-option--active' : ''}`}
                    role="menuitemradio"
                    aria-checked={selectedDept === dept}
                    onClick={() => handleSelectDept(dept)}
                  >
                    <span>{dept}</span>
                    {selectedDept === dept && <span className="ci-filter-check">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export */}
          <button
            className="ci-icon-btn"
            onClick={handleExport}
            disabled={entries.length === 0}
            aria-label="Export current page to Excel"
            title="Export to Excel (.xlsx)"
          >
            <IconDownload size={14} />
            <span>Export</span>
          </button>

          <button
            className="ci-add-btn"
            onClick={() => setEntryTypeModalOpen(true)}
          >
            <IconPlus size={14} />
            <span>Add Entry</span>
          </button>
        </div>
      </div>

      {/* ── Active filter pill ───────────────────────────────────────────── */}
      {selectedDept && (
        <div className="ci-active-filters">
          <span className="ci-active-filter-label">Filtered by:</span>
          <button
            className="ci-active-filter-pill"
            onClick={() => handleSelectDept(null)}
            aria-label={`Remove department filter: ${selectedDept}`}
          >
            {selectedDept}
            <IconX size={10} />
          </button>
        </div>
      )}

      {/* ── Table card ──────────────────────────────────────────────────── */}
      <div className={`ci-card${pageLoading ? ' ci-card--loading' : ''}`}>
        <div className="ci-table-wrap">
          <table className="ci-table" aria-label="Check-in/Check-out entries">
            <thead>
              <tr>
                <th className="ci-col--expand" />
                <th scope="col">Type</th>
                <th scope="col">Name</th>
                <th scope="col">Mobile / Emp ID</th>
                <th scope="col">Department</th>
                <th scope="col">Status</th>
                <th scope="col">Person to Meet</th>
                <th scope="col">Card(s)</th>
                <th scope="col">Check-in</th>
                <th scope="col">Check-out</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {initLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="ci-row--skeleton">
                    {Array.from({ length: COL_COUNT }, (_, j) => (
                      <td key={j}><span className="ci-skeleton" /></td>
                    ))}
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className="ci-empty">
                    {search
                      ? `No entries match "${search}".`
                      : selectedDept
                        ? `No entries for department "${selectedDept}".`
                        : 'No entries found for the selected filter.'}
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    expanded={expandedRows.has(entry.id)}
                    onToggleExpand={toggleExpand}
                    onCheckOut={handleCheckOut}
                    onMemberCheckOut={handleMemberCheckOut}
                    onView={handleView}
                    onEdit={handleEdit}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!initLoading && totalElements > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}

        {/* Footer */}
        {!initLoading && (
          <div className="ci-footer">
            {totalElements > 0 ? (
              <>
                Showing&nbsp;
                <strong>{pageStart + 1}–{pageEnd}</strong>
                &nbsp;of&nbsp;<strong>{totalElements}</strong>&nbsp;
                {totalElements === 1 ? 'entry' : 'entries'}
                {(activeTab !== TAB_ALL || selectedDept || search) &&
                  ` (filtered from ${statusCounts.total} total)`}
              </>
            ) : (
              'No entries to display'
            )}
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

    </div>
  );
}
