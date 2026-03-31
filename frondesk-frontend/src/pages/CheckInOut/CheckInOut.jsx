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
import { getEntries, checkOutEntry, checkOutMember } from './checkInOutService';
import AddVisitorModal   from './AddVisitorModal/AddVisitorModal';
import AddEmployeeModal  from './AddEmployeeModal/AddEmployeeModal';
import ViewEntryModal    from './ViewEntryModal/ViewEntryModal';
import EditVisitorModal  from './EditVisitorModal/EditVisitorModal';
import EditEmployeeModal from './EditEmployeeModal/EditEmployeeModal';

// ─── Constants ────────────────────────────────────────────────────────────────
const TAB_ALL        = 'all';
const TAB_CHECKED_IN = 'checked-in';
const TAB_CHECKED_OUT= 'checked-out';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateTime(date) {
  if (!date) return '—';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  }) + ', ' + date.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

/** Returns { label, variant } for the status badge */
function resolveStatus(entry) {
  if (entry.members.length > 0) {
    const total      = 1 + entry.members.length;
    const checkedIn  = (entry.status === 'checked-in' ? 1 : 0)
                     + entry.members.filter((m) => m.status === 'checked-in').length;
    if (checkedIn === 0) return { label: 'Checked-out', variant: 'out' };
    return { label: `Checked-in (${checkedIn}/${total})`, variant: 'in' };
  }
  return entry.status === 'checked-in'
    ? { label: 'Checked-in',  variant: 'in'  }
    : { label: 'Checked-out', variant: 'out' };
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
      <td>
        <span className={`ci-status-badge ci-status-badge--${isIn ? 'in' : 'out'}`}>
          {isIn ? 'Checked-in' : 'Checked-out'}
        </span>
      </td>
      <td>—</td>
      <td>{member.card ?? '—'}</td>
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

        {/* Expand toggle */}
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

        {/* Type badge */}
        <td>
          <span className={`ci-type-badge ci-type-badge--${entry.type.toLowerCase()}`}>
            {entry.type === 'EMPLOYEE' ? 'Employee' : 'Visitor'}
          </span>
        </td>

        {/* Name + member count pill */}
        <td className="ci-col--name">
          {entry.name}
          {hasMembers && (
            <span className="ci-member-count">+{entry.members.length}</span>
          )}
        </td>

        {/* Mobile / Emp ID */}
        <td className={`ci-col--contact${isEmp ? ' ci-col--empid' : ''}`}>
          {contact ?? '—'}
        </td>

        {/* Status */}
        <td>
          <span className={`ci-status-badge ci-status-badge--${status.variant}`}>
            {status.label}
          </span>
        </td>

        {/* Person to meet */}
        <td className="ci-col--person">{entry.personToMeet || '—'}</td>

        {/* Card */}
        <td className="ci-col--card">
          {isEmp ? 'N/A' : (entry.card ?? '—')}
        </td>

        {/* Check-in time */}
        <td className="ci-col--time">{formatDateTime(entry.checkIn)}</td>

        {/* Actions */}
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

      {/* Member sub-rows */}
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
  // Close on overlay click
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Close on Escape key
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
        {/* Header */}
        <div className="etm-header">
          <div>
            <h2 className="etm-title" id="etm-title">Select Entry Type</h2>
            <p className="etm-subtitle">Are you adding a visitor or an employee?</p>
          </div>
          <button className="etm-close" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>

        {/* Option cards */}
        <div className="etm-options">
          <button
            className="etm-option-card"
            onClick={() => onSelect('visitor')}
          >
            <span className="etm-option-icon etm-option-icon--visitor">
              <IconUser size={28} />
            </span>
            <span className="etm-option-label">Visitor</span>
          </button>

          <button
            className="etm-option-card"
            onClick={() => onSelect('employee')}
          >
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
  const [entries,             setEntries]             = useState([]);
  const [initLoading,         setInitLoading]         = useState(true);
  const [activeTab,           setActiveTab]           = useState(TAB_ALL);
  const [search,              setSearch]              = useState('');
  const [expandedRows,        setExpandedRows]        = useState(new Set());
  const [filterOpen,          setFilterOpen]          = useState(false);
  const [entryTypeModalOpen,  setEntryTypeModalOpen]  = useState(false);
  const [addVisitorOpen,      setAddVisitorOpen]      = useState(false);
  const [addEmployeeOpen,     setAddEmployeeOpen]     = useState(false);
  // View / Edit state
  const [viewEntry,           setViewEntry]           = useState(null);
  const [editEntry,           setEditEntry]           = useState(null);
  const filterRef = useRef(null);

  // ── Load entries on mount ───────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const today = new Date().toISOString().split('T')[0];
    getEntries(today)
      .then((data) => { if (active) setEntries(data); })
      .catch(() => {})
      .finally(() => { if (active) setInitLoading(false); });
    return () => { active = false; };
  }, []);

  // ── Close filter dropdown on outside click ──────────────────────────────
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

  // ── Check-out main entry (optimistic) ──────────────────────────────────
  const handleCheckOut = useCallback(async (id) => {
    const original = entries.find((e) => e.id === id);
    if (!original) return;

    setEntries((prev) =>
      prev.map((e) => e.id === id ? { ...e, status: 'checked-out', checkOut: new Date() } : e)
    );
    try {
      await checkOutEntry(id);
    } catch {
      setEntries((prev) =>
        prev.map((e) => e.id === id ? original : e)
      );
    }
  }, [entries]);

  // ── Check-out member (optimistic) ───────────────────────────────────────
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
    } catch {
      setEntries((prev) =>
        prev.map((e) => e.id === entryId ? entryOrig : e)
      );
    }
  }, [entries]);

  // ── Entry type modal handlers ────────────────────────────────────────────
  const handleEntryTypeSelect = useCallback((type) => {
    setEntryTypeModalOpen(false);
    if (type === 'visitor')  setAddVisitorOpen(true);
    if (type === 'employee') setAddEmployeeOpen(true);
  }, []);

  // Visitor modal
  const handleCloseAddVisitor  = useCallback(() => setAddVisitorOpen(false), []);
  const handleVisitorSuccess   = useCallback(() => {
    setAddVisitorOpen(false);
    const today = new Date().toISOString().split('T')[0];
    getEntries(today).then(setEntries).catch(() => {});
  }, []);

  // Employee modal
  const handleCloseAddEmployee = useCallback(() => setAddEmployeeOpen(false), []);
  const handleEmployeeBack     = useCallback(() => {
    setAddEmployeeOpen(false);
    setEntryTypeModalOpen(true);   // go back to type-selection
  }, []);
  const handleEmployeeSuccess  = useCallback(() => {
    setAddEmployeeOpen(false);
    const today = new Date().toISOString().split('T')[0];
    getEntries(today).then(setEntries).catch(() => {});
  }, []);

  // ── View entry ──────────────────────────────────────────────────────────
  const handleView = useCallback((entry) => setViewEntry(entry), []);
  const handleCloseView = useCallback(() => setViewEntry(null), []);

  // ── Edit entry ───────────────────────────────────────────────────────────
  const handleEdit = useCallback((entry) => {
    setViewEntry(null);   // close view modal if open
    setEditEntry(entry);
  }, []);
  const handleCloseEdit  = useCallback(() => setEditEntry(null), []);
  const handleEditSuccess = useCallback(() => {
    setEditEntry(null);
    const today = new Date().toISOString().split('T')[0];
    getEntries(today).then(setEntries).catch(() => {});
  }, []);

  // ── Toggle expand row ────────────────────────────────────────────────────
  const toggleExpand = useCallback((id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── Derived counts ───────────────────────────────────────────────────────
  const countAll       = entries.length;
  const countCheckedIn = entries.filter((e) => e.status === 'checked-in').length;
  const countCheckedOut= entries.filter((e) => e.status === 'checked-out').length;

  // ── Filtered rows ────────────────────────────────────────────────────────
  const filtered = entries.filter((e) => {
    const matchTab =
      activeTab === TAB_ALL        ? true :
      activeTab === TAB_CHECKED_IN ? e.status === 'checked-in' :
                                     e.status === 'checked-out';

    const q = search.trim().toLowerCase();
    const matchSearch = !q || (
      e.name.toLowerCase().includes(q)              ||
      (e.mobile  ?? '').toLowerCase().includes(q)   ||
      (e.empId   ?? '').toLowerCase().includes(q)   ||
      e.personToMeet.toLowerCase().includes(q)
    );

    return matchTab && matchSearch;
  });

  return (
    <div className="ci-page">

      {/* ── Page header ───────────────────────────────────────────────── */}
      <header className="ci-page__header">
        <h1 className="ci-page__title">Check-In / Check-Out</h1>
        <p className="ci-page__sub">Manage visitor, member, and employee entries for today.</p>
      </header>

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div className="ci-toolbar">

        {/* Filter tabs */}
        <div className="ci-tabs" role="tablist">
          <button
            className={`ci-tab${activeTab === TAB_ALL ? ' ci-tab--active' : ''}`}
            onClick={() => setActiveTab(TAB_ALL)}
            role="tab"
            aria-selected={activeTab === TAB_ALL}
          >
            All <span className="ci-tab__count">{countAll}</span>
          </button>
          <button
            className={`ci-tab${activeTab === TAB_CHECKED_IN ? ' ci-tab--active' : ''}`}
            onClick={() => setActiveTab(TAB_CHECKED_IN)}
            role="tab"
            aria-selected={activeTab === TAB_CHECKED_IN}
          >
            Checked-in <span className="ci-tab__count">{countCheckedIn}</span>
          </button>
          <button
            className={`ci-tab${activeTab === TAB_CHECKED_OUT ? ' ci-tab--active' : ''}`}
            onClick={() => setActiveTab(TAB_CHECKED_OUT)}
            role="tab"
            aria-selected={activeTab === TAB_CHECKED_OUT}
          >
            Checked-out <span className="ci-tab__count">{countCheckedOut}</span>
          </button>
        </div>

        {/* Right actions */}
        <div className="ci-toolbar__right">
          <label className="ci-search" aria-label="Search entries">
            <IconSearch size={14} />
            <input
              className="ci-search__input"
              type="search"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <div className="ci-filter-wrap" ref={filterRef}>
            <button
              className={`ci-icon-btn${filterOpen ? ' ci-icon-btn--active' : ''}`}
              onClick={() => setFilterOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={filterOpen}
            >
              <IconFilter size={14} />
              <span>Filter Dept</span>
            </button>
            {filterOpen && (
              <div className="ci-filter-dropdown" role="menu">
                {['All Departments', 'Operations', 'Security', 'HR', 'IT', 'Finance'].map((d) => (
                  <button key={d} className="ci-filter-option" role="menuitem">
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="ci-icon-btn">
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

      {/* ── Table card ────────────────────────────────────────────────── */}
      <div className="ci-card">
        <div className="ci-table-wrap">
          <table className="ci-table" aria-label="Check-in/Check-out entries">
            <thead>
              <tr>
                <th className="ci-col--expand" />
                <th scope="col">Type</th>
                <th scope="col">Name</th>
                <th scope="col">Mobile / Emp ID</th>
                <th scope="col">Status</th>
                <th scope="col">Person to Meet</th>
                <th scope="col">Card(s)</th>
                <th scope="col">Check-in</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {initLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="ci-row--skeleton">
                    {Array.from({ length: 9 }, (_, j) => (
                      <td key={j}><span className="ci-skeleton" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="ci-empty">
                    {search
                      ? `No entries match "${search}".`
                      : 'No entries found for the selected filter.'}
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => (
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

        {/* Footer */}
        {!initLoading && (
          <div className="ci-footer">
            <strong>{filtered.length}</strong>&nbsp;
            {filtered.length === 1 ? 'entry' : 'entries'}
            {activeTab !== TAB_ALL && ` · ${filtered.length} of ${countAll} total`}
          </div>
        )}
      </div>

      {/* ── Entry Type Modal ───────────────────────────────────────────── */}
      {entryTypeModalOpen && (
        <EntryTypeModal
          onClose={() => setEntryTypeModalOpen(false)}
          onSelect={handleEntryTypeSelect}
        />
      )}

      {/* ── Add Visitor (3-step) Modal ─────────────────────────────────── */}
      {addVisitorOpen && (
        <AddVisitorModal
          onClose={handleCloseAddVisitor}
          onSuccess={handleVisitorSuccess}
        />
      )}

      {/* ── Add Employee (3-step) Modal ────────────────────────────────── */}
      {addEmployeeOpen && (
        <AddEmployeeModal
          onClose={handleCloseAddEmployee}
          onBack={handleEmployeeBack}
          onSuccess={handleEmployeeSuccess}
        />
      )}

      {/* ── View Entry Modal ───────────────────────────────────────────── */}
      {viewEntry && (
        <ViewEntryModal
          entry={viewEntry}
          onClose={handleCloseView}
          onEdit={handleEdit}
        />
      )}

      {/* ── Edit Entry Modals ──────────────────────────────────────────── */}
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
