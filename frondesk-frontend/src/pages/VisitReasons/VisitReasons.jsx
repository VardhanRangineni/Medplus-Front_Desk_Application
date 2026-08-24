import { useState, useEffect, useCallback, useRef } from 'react';
import '../CheckInOut/CheckInOut.css';
import '../UserManagement/UserManagement.css';
import './VisitReasons.css';
import EmptyState from '../../components/EmptyState/EmptyState';
import LottieLoader from '../../components/LottieLoader/LottieLoader';
import {
  IconPlus,
  IconToggleRight,
  IconToggleLeft,
  IconX,
  IconAlertCircle,
  IconInfo,
  IconEdit,
  IconTrash,
} from '../../components/Icons/Icons';
import {
  getVisitReasons,
  getActiveVisitReasons,
  createVisitReason,
  updateVisitReason,
  toggleVisitReasonStatus,
  deleteVisitReason,
  MAX_REASONS_PER_TYPE,
} from './visitReasonsService';
import { clearCache } from '../../components/ReasonDropdown/ReasonDropdown';

const TAB_VISITOR = 'visitor';
const TAB_EMPLOYEE = 'employee';

/** Map UI type label -> API type value */
const TYPE_MAP = {
  [TAB_VISITOR]: 'VISITOR',
  [TAB_EMPLOYEE]: 'EMPLOYEE',
};

const COL_COUNT = 3;

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

function AddReasonModal({ open, onClose, onCreated, typeLabel }) {
  const [reasonName, setReasonName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setReasonName('');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const trimmed = reasonName.trim();
    if (!trimmed) {
      setError('Reason name is required.');
      return;
    }
    setSaving(true);
    try {
      const created = await createVisitReason({
        type: TYPE_MAP[typeLabel],
        reasonName: trimmed,
      });
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err?.message ?? 'Failed to add reason.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="umg-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="umg-modal umg-modal--small" onClick={(e) => e.stopPropagation()}>
        <div className="umg-modal__header">
          <h2 className="umg-modal__title">
            Add {typeLabel === TAB_VISITOR ? 'Visitor' : 'Employee'} Reason
          </h2>
          <button className="umg-modal__close" onClick={onClose} aria-label="Close">
            <IconX size={14} />
          </button>
        </div>
        <form className="umg-modal__body" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="umg-error-banner" role="alert">
              <IconAlertCircle size={16} />
              {error}
            </div>
          )}
          <div className="umg-field">
            <span className="umg-field__label">Reason Name</span>
            <input
              ref={inputRef}
              className="umg-input"
              value={reasonName}
              onChange={(e) => setReasonName(e.target.value)}
              placeholder={typeLabel === TAB_VISITOR ? 'e.g. Delivery' : 'e.g. Project Update'}
              autoComplete="off"
              required
            />
          </div>
          <div className="umg-modal__footer">
            <button type="button" className="umg-btn umg-btn--ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="umg-btn umg-btn--primary" disabled={saving}>
              {saving ? 'Adding…' : 'Add Reason'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditReasonModal({ open, onClose, onSave, reason, typeLabel }) {
  const [reasonName, setReasonName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && reason) {
      setReasonName(reason.reasonName);
      setError('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, reason]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const trimmed = reasonName.trim();
    if (!trimmed) {
      setError('Reason name is required.');
      return;
    }
    setSaving(true);
    try {
      await updateVisitReason(reason.id, { reasonName: trimmed });
      onSave(reason.id, trimmed);
      onClose();
    } catch (err) {
      setError(err?.message ?? 'Failed to update reason.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="umg-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="umg-modal umg-modal--small" onClick={(e) => e.stopPropagation()}>
        <div className="umg-modal__header">
          <h2 className="umg-modal__title">
            Edit {typeLabel === TAB_VISITOR ? 'Visitor' : 'Employee'} Reason
          </h2>
          <button className="umg-modal__close" onClick={onClose} aria-label="Close">
            <IconX size={14} />
          </button>
        </div>
        <form className="umg-modal__body" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="umg-error-banner" role="alert">
              <IconAlertCircle size={16} />
              {error}
            </div>
          )}
          <div className="umg-field">
            <span className="umg-field__label">Reason Name</span>
            <input
              ref={inputRef}
              className="umg-input"
              value={reasonName}
              onChange={(e) => setReasonName(e.target.value)}
              autoComplete="off"
              required
            />
          </div>
          <div className="umg-modal__footer">
            <button type="button" className="umg-btn umg-btn--ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="umg-btn umg-btn--primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReasonList({ typeLabel, initLoading, pageLoading, reasons, loadError, onToggle, onDelete, onAdd, onEdit }) {
  const label = typeLabel === TAB_VISITOR ? 'Visitor' : 'Employee';
  const list = Array.isArray(reasons) ? reasons : [];

  if (initLoading) {
    return (
      <div className="vr-loading">
        <LottieLoader size="md" ariaLabel={`Loading ${label.toLowerCase()} reasons`} />
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <EmptyState
        compact
        icon={<IconInfo size={22} />}
        title={`No ${label.toLowerCase()} reasons yet`}
        description={`Add the first ${label.toLowerCase()} visit reason.`}
        action={{ label: 'Add Reason', onClick: onAdd, icon: <IconPlus size={14} /> }}
      />
    );
  }

  return (
    <div className="ci-table-wrap">
      <table className="ci-table vr-table" aria-label={`${label} reasons`}>
        <colgroup>
          <col className="vr-col--name" />
          <col className="vr-col--status" />
          <col className="vr-col--actions" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="vr-col--name">Reason Name</th>
            <th scope="col" className="vr-col--status">Status</th>
            <th scope="col" className="vr-col--actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id}>
              <td className="vr-reason-name">{r.reasonName}</td>
              <td>
                <StatusToggle
                  active={r.isActive}
                  label={r.reasonName}
                  onToggle={() => onToggle(r.id, r.isActive)}
                />
              </td>
              <td className="vr-actions">
                <button
                  type="button"
                  className="vr-action-btn vr-action-btn--edit"
                  onClick={() => onEdit(r)}
                  title="Edit"
                  aria-label={`Edit ${r.reasonName}`}
                >
                  <IconEdit size={14} />
                </button>
                <button
                  type="button"
                  className="vr-action-btn vr-action-btn--delete"
                  onClick={() => onDelete(r)}
                  title="Delete"
                  aria-label={`Delete ${r.reasonName}`}
                >
                  <IconTrash size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function VisitReasons() {
  const [activeTab, setActiveTab] = useState(TAB_VISITOR);

  // Data per tab
  const [visitorReasons, setVisitorReasons] = useState([]);
  const [employeeReasons, setEmployeeReasons] = useState([]);
  const [initLoading, setInitLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editReason, setEditReason] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const currentReasons = activeTab === TAB_VISITOR ? visitorReasons : employeeReasons;
  const setCurrentReasons = activeTab === TAB_VISITOR ? setVisitorReasons : setEmployeeReasons;

  const loadReasons = useCallback(async (type, isInitial = false) => {
    if (isInitial) setInitLoading(true);
    else setPageLoading(true);
    setLoadError(null);
    try {
      const paged = await getVisitReasons({ type, page: 0, size: 50 });
      const list = Array.isArray(paged?.content) ? paged.content : (Array.isArray(paged) ? paged : []);
      const setter = type === 'VISITOR' ? setVisitorReasons : setEmployeeReasons;
      setter(list);
    } catch (err) {
      setLoadError(err?.message ?? 'Failed to load visit reasons.');
    } finally {
      if (isInitial) setInitLoading(false);
      else setPageLoading(false);
    }
  }, []);

  const reloadActive = useCallback(() => {
    loadReasons(TYPE_MAP[activeTab]);
  }, [activeTab, loadReasons]);

  // Initial load for both types
  useEffect(() => {
    let cancelled = false;
    setInitLoading(true);
    setLoadError(null);
    Promise.allSettled([
      getVisitReasons({ type: 'VISITOR', page: 0, size: 50 }),
      getVisitReasons({ type: 'EMPLOYEE', page: 0, size: 50 }),
    ]).then(([visitorResult, employeeResult]) => {
      if (cancelled) return;
      let hadError = false;
      let firstErrMsg = null;

      if (visitorResult.status === 'fulfilled') {
        const v = visitorResult.value;
        const vList = Array.isArray(v?.content) ? v.content : (Array.isArray(v) ? v : []);
        setVisitorReasons(vList);
      } else {
        hadError = true;
        firstErrMsg = firstErrMsg ?? visitorResult.reason?.message ?? 'Failed to load visit reasons.';
      }

      if (employeeResult.status === 'fulfilled') {
        const e = employeeResult.value;
        const eList = Array.isArray(e?.content) ? e.content : (Array.isArray(e) ? e : []);
        setEmployeeReasons(eList);
      } else {
        hadError = true;
        firstErrMsg = firstErrMsg ?? employeeResult.reason?.message ?? 'Failed to load visit reasons.';
      }

      if (hadError) {
        setLoadError(firstErrMsg);
      }
      setInitLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleToggle = async (id, currentActive) => {
    const next = !currentActive;
    setCurrentReasons((prev) => prev.map((r) => (r.id === id ? { ...r, isActive: next } : r)));
    try {
      await toggleVisitReasonStatus(id, next);
      clearCache(TYPE_MAP[activeTab]);
    } catch (err) {
      setCurrentReasons((prev) => prev.map((r) => (r.id === id ? { ...r, isActive: currentActive } : r)));
      setLoadError(err?.message ?? 'Failed to update status.');
    }
  };

  const handleDelete = async (reason) => {
    if (!confirm(`Delete "${reason.reasonName}"? This cannot be undone.`)) return;
    setCurrentReasons((prev) => prev.filter((r) => r.id !== reason.id));
    try {
      await deleteVisitReason(reason.id);
      clearCache(TYPE_MAP[activeTab]);
    } catch (err) {
      setCurrentReasons((prev) => [...prev, reason]);
      setLoadError(err?.message ?? 'Failed to delete reason.');
    }
  };

  const handleAdd = () => {
    if (currentReasons.length >= MAX_REASONS_PER_TYPE) {
      setLoadError(`Maximum ${MAX_REASONS_PER_TYPE} reasons allowed per type.`);
      return;
    }
    setShowAddModal(true);
  };

  const handleAdded = () => {
    reloadActive();
    clearCache(TYPE_MAP[activeTab]);
  };

  const handleEdit = (reason) => {
    setEditReason(reason);
    setShowEditModal(true);
  };

  const handleEdited = (id, newName) => {
    setCurrentReasons((prev) => prev.map((r) => (r.id === id ? { ...r, reasonName: newName } : r)));
    clearCache(TYPE_MAP[activeTab]);
  };

  return (
    <div className="ci-page">
      {loadError && (
        <div className="umg-error-banner" role="alert">
          <IconAlertCircle size={15} />
          <span>{loadError}</span>
        </div>
      )}

      <div className={`ci-card${pageLoading ? ' ci-card--loading' : ''}`}>
        <div className="ci-topbar">
          <div className="ci-tabs" role="tablist" aria-label="Visit reasons sections">
            {[
              { id: TAB_VISITOR, label: 'Visitor Reasons' },
              { id: TAB_EMPLOYEE, label: 'Employee Reasons' },
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
            <button
              type="button"
              className="ci-add-btn"
              onClick={handleAdd}
              disabled={currentReasons.length >= MAX_REASONS_PER_TYPE}
              aria-label={`Add ${activeTab === TAB_VISITOR ? 'visitor' : 'employee'} reason`}
              title={currentReasons.length >= MAX_REASONS_PER_TYPE ? `Maximum ${MAX_REASONS_PER_TYPE} reasons allowed` : ''}
            >
              <IconPlus size={14} />
              <span>{currentReasons.length >= MAX_REASONS_PER_TYPE ? `Max (${MAX_REASONS_PER_TYPE})` : 'Add Reason'}</span>
            </button>
          </div>
        </div>

        <ReasonList
          typeLabel={activeTab}
          initLoading={initLoading}
          pageLoading={pageLoading}
          reasons={currentReasons}
          loadError={loadError}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onAdd={handleAdd}
          onEdit={handleEdit}
        />
      </div>

      <AddReasonModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={handleAdded}
        typeLabel={activeTab}
      />

      <EditReasonModal
        open={showEditModal}
        onClose={() => { setShowEditModal(false); setEditReason(null); }}
        onSave={handleEdited}
        reason={editReason}
        typeLabel={activeTab}
      />
    </div>
  );
}
