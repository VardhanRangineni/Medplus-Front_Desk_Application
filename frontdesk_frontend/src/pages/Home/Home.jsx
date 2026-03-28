import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import './Home.css';
import PageFilters from '../../components/PageFilters/PageFilters';
import {
  getCheckInEntries,
  checkOutEntry,
  getDepartments,
} from '../../api/checkInApi';
import VisitorCheckInWizard from '../../components/VisitorCheckInWizard/VisitorCheckInWizard';
import ViewEntryModal       from '../../components/ViewEntryModal/ViewEntryModal';
import EditEntryModal            from '../../components/EditEntryModal/EditEntryModal';
import EmployeeCheckInWizard    from '../../components/EmployeeCheckInWizard/EmployeeCheckInWizard';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDateTime(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getGroupCheckedInCount(entry) {
  const main    = entry.status === 'Checked-in' ? 1 : 0;
  const members = (entry.members || []).filter((m) => m.status === 'Checked-in').length;
  return main + members;
}

function getGroupTotalCount(entry) {
  return 1 + (entry.members?.length ?? 0);
}

// ── Icons ──────────────────────────────────────────────────────────────────────

const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconFilter = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);
const IconExport = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const IconEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconCheckOut = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const IconChevronDown = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const IconChevronRight = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconUsers = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconAlertCircle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

// ── Type badge ─────────────────────────────────────────────────────────────────

const TypeBadge = ({ type }) => {
  if (!type) return null;
  return <span className={`ci-type-badge ci-type-${type.toLowerCase()}`}>{type}</span>;
};

// ── Status badge ───────────────────────────────────────────────────────────────

const StatusBadge = ({ status, groupCount }) => {
  const isIn  = status === 'Checked-in';
  const label = groupCount ? `${status} (${groupCount})` : status;
  return (
    <span className={`ci-status-badge ${isIn ? 'ci-status-in' : 'ci-status-out'}`}>
      {label}
    </span>
  );
};

// ── Skeleton rows ──────────────────────────────────────────────────────────────

const SkeletonRows = () =>
  Array.from({ length: 6 }).map((_, i) => (
    <tr key={i} className="ci-skeleton-row">
      {[20, 60, 120, 100, 90, 100, 55, 130, 130, 80].map((w, j) => (
        <td key={j}><div className="ci-skeleton" style={{ width: w }} /></td>
      ))}
    </tr>
  ));

// ── Focus trap ─────────────────────────────────────────────────────────────────

function useFocusTrap(ref, isActive) {
  useEffect(() => {
    if (!isActive || !ref.current) return;
    const el       = ref.current;
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

// ── Dept filter dropdown ───────────────────────────────────────────────────────

const DeptFilter = ({ departments, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref             = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="ci-dept-filter" ref={ref}>
      <button
        className={`ci-toolbar-btn${selected ? ' ci-toolbar-btn-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <IconFilter />
        {selected || 'Filter Dept'}
      </button>

      {open && (
        <div className="ci-dept-dropdown" role="listbox" aria-label="Filter by department">
          <button
            role="option"
            aria-selected={!selected}
            className={`ci-dept-option${!selected ? ' ci-dept-selected' : ''}`}
            onClick={() => { onChange(''); setOpen(false); }}
          >
            All Departments
          </button>
          {departments.map((dept) => (
            <button
              key={dept}
              role="option"
              aria-selected={selected === dept}
              className={`ci-dept-option${selected === dept ? ' ci-dept-selected' : ''}`}
              onClick={() => { onChange(dept); setOpen(false); }}
            >
              {dept}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Check-out confirmation modal ───────────────────────────────────────────────

const CheckOutModal = ({ entry, isGroup, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false);
  const modalRef = useRef(null);

  useFocusTrap(modalRef, true);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleConfirm = async (cardsReturned = false) => {
    setLoading(true);
    await onConfirm(cardsReturned);
    setLoading(false);
  };

  const isEmployee  = entry.type === 'Employee';
  const hasCards    = (entry.cards?.length ?? 0) > 0;
  const memberCount = entry.members?.length ?? 0;
  const showCardActions = !isEmployee && hasCards;

  return (
    <div
      className="ci-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="ci-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ci-confirm-title"
        aria-describedby="ci-confirm-desc"
        ref={modalRef}
      >
        <div className="ci-confirm-icon">
          <IconCheckOut />
        </div>
        <div>
          <h3 id="ci-confirm-title">Confirm Checkout</h3>
          <p id="ci-confirm-desc">
            Are you sure you want to check out <strong>{entry.name}</strong>
            {isGroup && memberCount > 0 && (
              <> and <strong>{memberCount} member{memberCount > 1 ? 's' : ''}</strong></>
            )}?
          </p>
        </div>
        <div className={`ci-confirm-actions${showCardActions ? ' ci-confirm-actions-cards' : ''}`}>
          <button className="ci-btn-cancel" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          {showCardActions ? (
            <>
              <button
                className="ci-btn-cards-no"
                onClick={() => handleConfirm(false)}
                disabled={loading}
              >
                {loading ? 'Checking out…' : 'No, Cards Not Returned'}
              </button>
              <button
                className="ci-btn-checkout"
                onClick={() => handleConfirm(true)}
                disabled={loading}
              >
                {loading ? 'Checking out…' : 'Confirm & Return Cards'}
              </button>
            </>
          ) : (
            <button
              className="ci-btn-checkout"
              onClick={() => handleConfirm(false)}
              disabled={loading}
            >
              {loading ? 'Checking out…' : 'Confirm Check-out'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Add Entry placeholder modal ────────────────────────────────────────────────

// ── Entry type icons ───────────────────────────────────────────────────────────

const IconVisitor = () => (
  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconEmployee = () => (
  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/>
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    <line x1="12" y1="12" x2="12" y2="16"/>
    <line x1="10" y1="14" x2="14" y2="14"/>
  </svg>
);

// ── Add Entry — Select Type modal ──────────────────────────────────────────────

const AddEntryModal = ({ onClose, onSelectType }) => {
  const modalRef = useRef(null);

  useFocusTrap(modalRef, true);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="ci-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="ci-select-type-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ci-select-type-title"
        ref={modalRef}
      >
        {/* Header */}
        <div className="ci-modal-head">
          <div>
            <h2 id="ci-select-type-title">Select Entry Type</h2>
            <p>Are you adding a visitor or an employee?</p>
          </div>
          <button className="ci-modal-close" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>

        {/* Type cards */}
        <div className="ci-modal-body">
          <div className="ci-type-cards">
            <button
              className="ci-type-card"
              onClick={() => onSelectType('Visitor')}
              aria-label="Add Visitor entry"
            >
              <span className="ci-type-card-icon ci-type-card-visitor">
                <IconVisitor />
              </span>
              <span className="ci-type-card-label">Visitor</span>
              <span className="ci-type-card-hint">Guest, client, or walk-in</span>
            </button>

            <button
              className="ci-type-card"
              onClick={() => onSelectType('Employee')}
              aria-label="Add Employee entry"
            >
              <span className="ci-type-card-icon ci-type-card-employee">
                <IconEmployee />
              </span>
              <span className="ci-type-card-label">Employee</span>
              <span className="ci-type-card-hint">Staff member with an EMP ID</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


// ── Main Home component ────────────────────────────────────────────────────────

const Home = () => {
  const { location, locations, dateRange, setLocation, setDateRange } = useOutletContext();

  const [entries,          setEntries]          = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState('');
  const [departments,      setDepartments]      = useState([]);
  const [searchQuery,      setSearchQuery]      = useState('');
  const [statusFilter,     setStatusFilter]     = useState('all');
  const [deptFilter,       setDeptFilter]       = useState('');
  const [expandedRows,     setExpandedRows]     = useState(new Set());
  const [modal,            setModal]            = useState(null);
  const [activeEntry,      setActiveEntry]      = useState(null);
  const [activeParentEntry, setActiveParentEntry] = useState(null);
  const [entryType,        setEntryType]        = useState(null); // 'Visitor' | 'Employee'
  // null = closed · 'open' = visible · 'closing' = animating out
  const [filtersState,     setFiltersState]     = useState(null);
  const filterToggleRef = useRef(null);

  const toggleFilters = () =>
    setFiltersState(s => s === null ? 'open' : s === 'open' ? 'closing' : 'open');

  const handleFiltersAnimEnd = () =>
    setFiltersState(s => s === 'closing' ? null : s);

  // Smooth-close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (filterToggleRef.current && !filterToggleRef.current.contains(e.target))
        setFiltersState(s => s === 'open' ? 'closing' : s);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadEntries = useCallback(() => {
    setLoading(true);
    setError('');
    getCheckInEntries({
      location,
      from: dateRange?.from,
      to:   dateRange?.to,
    })
      .then(setEntries)
      .catch((err) => setError(err.message || 'Failed to load entries.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, dateRange?.from?.getTime(), dateRange?.to?.getTime()]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  useEffect(() => {
    getDepartments().then(setDepartments).catch(console.error);
  }, []);

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = entries.filter((entry) => {
    if (statusFilter === 'checked-in'  && entry.status !== 'Checked-in')  return false;
    if (statusFilter === 'checked-out' && entry.status !== 'Checked-out') return false;
    if (deptFilter && entry.department !== deptFilter)                     return false;

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const inName   = entry.name.toLowerCase().includes(q);
      const inMobile = (entry.mobileOrEmpId ?? '').toLowerCase().includes(q);
      const inMeet   = (entry.personToMeet  ?? '').toLowerCase().includes(q);
      const inMember = (entry.members ?? []).some((m) => m.name.toLowerCase().includes(q));
      return inName || inMobile || inMeet || inMember;
    }
    return true;
  });

  const counts = {
    all: entries.reduce((sum, e) => sum + 1 + (e.members?.length ?? 0), 0),
    'checked-in': entries.reduce((sum, e) => {
      const headIn    = e.status === 'Checked-in' ? 1 : 0;
      const membersIn = (e.members ?? []).filter((m) => m.status === 'Checked-in').length;
      return sum + headIn + membersIn;
    }, 0),
    'checked-out': entries.reduce((sum, e) => {
      const headOut    = e.status === 'Checked-out' ? 1 : 0;
      const membersOut = (e.members ?? []).filter((m) => m.status === 'Checked-out').length;
      return sum + headOut + membersOut;
    }, 0),
  };

  // ── Row expand ─────────────────────────────────────────────────────────────

  const toggleExpand = (id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Checkout ───────────────────────────────────────────────────────────────

  const openView = (entry) => {
    setActiveEntry(entry);
    setModal('view');
  };

  const openEdit = (entry) => {
    setActiveEntry(entry);
    setModal('edit');
  };

  const handleEditSave = (updatedEntry) => {
    setEntries(prev =>
      prev.map(e => e.id === updatedEntry.id ? { ...e, ...updatedEntry } : e),
    );
    setModal(null);
    setActiveEntry(null);
  };

  const openCheckOut = (entry, parentEntry = null) => {
    setActiveEntry(entry);
    setActiveParentEntry(parentEntry);
    setModal('checkout');
  };

  const handleCheckOut = async (cardsReturned = false) => {
    if (!activeEntry) return;
    try {
      const result = await checkOutEntry(activeEntry.id);
      const checkOutTime = result.checkOutTime || new Date().toISOString();

      setEntries(prev => prev.map(e => {
        if (e.id === activeEntry.id) {
          return { ...e, status: 'Checked-out', checkOutTime };
        }
        if (activeParentEntry && e.id === activeParentEntry.id) {
          return {
            ...e,
            members: (e.members || []).map(m =>
              m.id === activeEntry.id
                ? { ...m, status: 'Checked-out', checkOutTime }
                : m,
            ),
          };
        }
        return e;
      }));
    } catch (err) {
      setError(err.message || 'Checkout failed. Please try again.');
    } finally {
      setModal(null);
      setActiveEntry(null);
      setActiveParentEntry(null);
    }
  };

  // ── CSV export ─────────────────────────────────────────────────────────────

  const handleExport = () => {
    const header = ['Type', 'Name', 'Mobile / Emp ID', 'Status', 'Person to Meet', 'Card(s)', 'Check-in Time', 'Check-out Time', 'Department'];
    const rows   = [header];

    filtered.forEach((e) => {
      rows.push([
        e.type,
        e.name,
        e.mobileOrEmpId ?? '',
        e.status,
        e.personToMeet  ?? '',
        (e.cards ?? []).join(', '),
        formatDateTime(e.checkInTime),
        e.checkOutTime ? formatDateTime(e.checkOutTime) : '',
        e.department ?? '',
      ]);
      (e.members ?? []).forEach((m) => {
        rows.push([
          m.type,
          `  ${m.name} (member of ${e.name})`,
          '',
          m.status,
          '',
          (m.cards ?? []).join(', '),
          formatDateTime(m.checkInTime),
          m.checkOutTime ? formatDateTime(m.checkOutTime) : '',
          e.department ?? '',
        ]);
      });
    });

    const csv  = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `check-in-entries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Page header */}
      <div className="ci-page-header">
        <div className="ci-page-header-left">
          <h1 className="ci-page-title">Check-In / Check-Out</h1>
          <p className="ci-page-sub">Manage visitor, member, and employee entries for today.</p>
        </div>

        {/* Filter toggle — expands from right to left */}
        <div className="pf-toggle-wrap" ref={filterToggleRef}>
          {filtersState !== null && (
            <div
              className={`pf-inline-filters${filtersState === 'closing' ? ' closing' : ''}`}
              onAnimationEnd={handleFiltersAnimEnd}
            >
              <PageFilters
                locations={locations}
                location={location}
                onLocationChange={setLocation}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
            </div>
          )}
          <button
            className={`pf-toggle-btn${filtersState === 'open' ? ' open' : ''}${location !== 'All' ? ' active' : ''}`}
            onClick={toggleFilters}
            aria-expanded={filtersState === 'open'}
            aria-label="Toggle filters"
          >
            <IconFilter />
            Filters
            {location !== 'All' && <span className="pf-filter-dot" />}
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
      <div className="ci-toolbar">

        {/* Status filter tabs */}
        <div className="ci-filter-tabs" role="tablist" aria-label="Filter by status">
          {[
            { key: 'all',          label: 'All'         },
            { key: 'checked-in',   label: 'Checked-in'  },
            { key: 'checked-out',  label: 'Checked-out' },
          ].map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={statusFilter === key}
              className={`ci-tab${statusFilter === key ? ' ci-tab-active' : ''}`}
              onClick={() => setStatusFilter(key)}
            >
              {label}
              {!loading && (
                <span className={`ci-tab-count${statusFilter === key ? ' ci-tab-count-active' : ''}`}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Right controls */}
        <div className="ci-toolbar-right">

          {/* Search */}
          <div className="ci-search-wrap">
            <span className="ci-search-icon"><IconSearch /></span>
            <input
              className="ci-search-input"
              type="search"
              placeholder="Search by name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search entries"
            />
            {searchQuery && (
              <button
                className="ci-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                tabIndex={0}
              >
                <IconX />
              </button>
            )}
          </div>

          {/* Dept filter */}
          <DeptFilter
            departments={departments}
            selected={deptFilter}
            onChange={setDeptFilter}
          />

          {/* Export */}
          <button
            className="ci-toolbar-btn"
            onClick={handleExport}
            disabled={loading || filtered.length === 0}
            title="Export visible entries to CSV"
          >
            <IconExport />
            Export
          </button>

          {/* Add Entry */}
          <button
            className="ci-btn-primary"
            onClick={() => setModal('add')}
          >
            <IconPlus />
            Add Entry
          </button>

        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="ci-error-banner" role="alert">
          <IconAlertCircle />
          {error}
          <button
            className="ci-error-dismiss"
            onClick={() => setError('')}
            aria-label="Dismiss error"
          >
            <IconX />
          </button>
        </div>
      )}

      {/* Table card */}
      <div className="ci-table-card">
        <div className="ci-table-header">
          <span>Entries</span>
          {!loading && (
            <span className="ci-table-count">
              {filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}
            </span>
          )}
        </div>

        <div className="ci-table-scroll">
          <table className="ci-table">
            <thead>
              <tr>
                <th className="ci-th-expand" aria-hidden="true" />
                <th>Type</th>
                <th>Name</th>
                <th>Mobile / Emp ID</th>
                <th>Status</th>
                <th>Person to Meet</th>
                <th>Card(s)</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: 0, border: 'none' }}>
                    <div className="ci-empty">
                      <IconUsers />
                      <p>No entries found</p>
                      <span>
                        {searchQuery || deptFilter
                          ? 'Try adjusting your search or filters.'
                          : 'Click "Add Entry" to check in a visitor, member, or employee.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => {
                  const hasMembers   = (entry.members?.length ?? 0) > 0;
                  const isExpanded   = expandedRows.has(entry.id);
                  const checkedInCnt = hasMembers ? getGroupCheckedInCount(entry) : null;
                  const totalCnt     = hasMembers ? getGroupTotalCount(entry)     : null;

                  return (
                    <React.Fragment key={entry.id}>

                      {/* ── Main row ── */}
                      <tr className={`ci-row${isExpanded ? ' ci-row-expanded' : ''}`}>

                        {/* Expand chevron */}
                        <td className="ci-expand-cell">
                          {hasMembers && (
                            <button
                              className="ci-expand-btn"
                              onClick={() => toggleExpand(entry.id)}
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? 'Collapse group' : 'Expand group'}
                            >
                              {isExpanded ? <IconChevronDown /> : <IconChevronRight />}
                            </button>
                          )}
                        </td>

                        <td><TypeBadge type={entry.type} /></td>

                        <td className="ci-td-name">
                          <span className="ci-name">{entry.name}</span>
                          {hasMembers && (
                            <span className="ci-member-count" aria-label={`${entry.members.length} additional members`}>
                              +{entry.members.length}
                            </span>
                          )}
                        </td>

                        <td className="ci-td-mobile">
                          {entry.mobileOrEmpId
                            ? <span className={entry.type === 'Employee' ? 'ci-emp-id' : ''}>{entry.mobileOrEmpId}</span>
                            : '—'}
                        </td>

                        <td>
                          <StatusBadge
                            status={entry.status}
                            groupCount={entry.status === 'Checked-in' && hasMembers
                              ? `${checkedInCnt}/${totalCnt}`
                              : undefined}
                          />
                        </td>

                        <td className="ci-td-meet">{entry.personToMeet || '—'}</td>

                        <td className="ci-td-cards">
                          {entry.cards?.length > 0 ? entry.cards.join(', ') : 'N/A'}
                        </td>

                        <td className="ci-td-time">{formatDateTime(entry.checkInTime)}</td>

                        <td className="ci-td-time ci-td-checkout">
                          {entry.checkOutTime ? formatDateTime(entry.checkOutTime) : '—'}
                        </td>

                        <td>
                          <div className="ci-actions-cell">
                            <button
                              className="ci-action-btn"
                              title={`View ${entry.name}`}
                              aria-label={`View ${entry.name}`}
                              onClick={() => openView(entry)}
                            >
                              <IconEye />
                            </button>
                            <button
                              className="ci-action-btn"
                              title={`Edit ${entry.name}`}
                              aria-label={`Edit ${entry.name}`}
                              onClick={() => openEdit(entry)}
                            >
                              <IconEdit />
                            </button>
                            {entry.status === 'Checked-in' && (
                              <button
                                className="ci-action-btn ci-action-checkout"
                                title={`Check out ${entry.name}`}
                                aria-label={`Check out ${entry.name}`}
                                onClick={() => openCheckOut(entry)}
                              >
                                <IconCheckOut />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* ── Member sub-rows ── */}
                      {hasMembers && isExpanded && entry.members.map((member) => (
                        <tr key={member.id} className="ci-member-row">
                          <td className="ci-expand-cell" />
                          <td><TypeBadge type={member.type} /></td>
                          <td className="ci-td-name">
                            <span className="ci-name ci-member-name">{member.name}</span>
                          </td>
                          <td className="ci-td-mobile">—</td>
                          <td>
                            <span className={`ci-inline-status${member.status === 'Checked-in' ? ' ci-inline-in' : ' ci-inline-out'}`}>
                              {member.status}
                            </span>
                          </td>
                          <td className="ci-td-meet">—</td>
                          <td className="ci-td-cards">
                            {member.cards?.length > 0
                              ? member.cards.join(', ')
                              : member.cardNumber || '—'}
                          </td>
                          <td className="ci-td-time">—</td>

                          <td className="ci-td-time ci-td-checkout">
                            {member.checkOutTime ? formatDateTime(member.checkOutTime) : '—'}
                          </td>

                          <td>
                            <div className="ci-actions-cell">
                              {member.status === 'Checked-in' && (
                                <button
                                  className="ci-action-btn ci-action-checkout"
                                  title={`Check out ${member.name}`}
                                  aria-label={`Check out ${member.name}`}
                                  onClick={() => openCheckOut(member, entry)}
                                >
                                  <IconCheckOut />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}

                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals ── */}
      {modal === 'add' && (
        <AddEntryModal
          onClose={() => setModal(null)}
          onSelectType={(type) => { setEntryType(type); setModal('add-form'); }}
        />
      )}
      {modal === 'add-form' && entryType === 'Visitor' && (
        <VisitorCheckInWizard
          onClose={() => { setModal(null); setEntryType(null); }}
          onBack={() => { setModal('add'); setEntryType(null); }}
          onSuccess={(entry) => {
            setEntries(prev => [entry, ...prev]);
            setModal(null);
            setEntryType(null);
          }}
        />
      )}
      {modal === 'add-form' && entryType === 'Employee' && (
        <EmployeeCheckInWizard
          locationId={location}
          onClose={() => { setModal(null); setEntryType(null); }}
          onBack={() => { setModal('add'); setEntryType(null); }}
          onSuccess={(entry) => {
            setEntries(prev => [entry, ...prev]);
            setModal(null);
            setEntryType(null);
          }}
        />
      )}
      {modal === 'view' && activeEntry && (
        <ViewEntryModal
          entry={activeEntry}
          onClose={() => { setModal(null); setActiveEntry(null); }}
        />
      )}
      {modal === 'edit' && activeEntry && (
        <EditEntryModal
          entry={activeEntry}
          onClose={() => { setModal(null); setActiveEntry(null); }}
          onSave={handleEditSave}
        />
      )}
      {modal === 'checkout' && activeEntry && (
        <CheckOutModal
          entry={activeEntry}
          isGroup={!activeParentEntry}
          onClose={() => { setModal(null); setActiveEntry(null); setActiveParentEntry(null); }}
          onConfirm={handleCheckOut}
        />
      )}
    </>
  );
};

export default Home;
