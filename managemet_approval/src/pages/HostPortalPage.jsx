import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  approveGroup,
  approveVisit,
  decideGroupMembers,
  fetchHostPortal,
  rejectGroup,
  rejectVisit,
} from '../api/portalApi';
import logo from '../assets/logo.png';
import './HostPortalPage.css';

const REJECT_PRESETS = [
  { key: '1', label: 'Busy' },
  { key: '2', label: 'In a meeting' },
  { key: '3', label: 'Not available' },
  { key: '4', label: 'Not expecting visitor' },
];

function formatDateChip(date = new Date()) {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatVisitTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return String(iso);
  }
}

/** Compact “Today · 5:03 pm” / “12 Aug · 5:03 pm”. */
function formatWhenShort(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    if (sameDay) return `Today · ${time}`;
    const day = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return `${day} · ${time}`;
  } catch {
    return String(iso);
  }
}

function formatMobile(mobile) {
  if (!mobile) return null;
  const digits = String(mobile).replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return String(mobile);
}

function statusMeta(status) {
  if (status === 'pending-approval') {
    return { label: 'PENDING', tone: 'pending' };
  }
  if (status === 'approved' || status === 'checked-in') {
    return { label: 'APPROVED', tone: 'approved' };
  }
  if (status === 'rejected') {
    return { label: 'REJECTED', tone: 'rejected' };
  }
  if (status === 'mixed') {
    return { label: 'MIXED', tone: 'mixed' };
  }
  return { label: (status || '—').toUpperCase(), tone: 'unknown' };
}

/** Group-level badge + summary from member statuses (not a single overall approval). */
function groupDecisionSummary(visit) {
  const members = groupMembers(visit);
  let pending = 0;
  let approved = 0;
  let rejected = 0;
  for (const m of members) {
    if (m.status === 'pending-approval') pending += 1;
    else if (m.status === 'approved' || m.status === 'checked-in') approved += 1;
    else if (m.status === 'rejected') rejected += 1;
  }
  if (typeof visit.pendingCount === 'number') pending = visit.pendingCount;

  if (pending > 0) {
    return {
      label: 'PENDING',
      tone: 'pending',
      pending,
      approved,
      rejected,
      summary: pending === members.length
        ? null
        : `${pending} pending${approved ? ` · ${approved} approved` : ''}${rejected ? ` · ${rejected} rejected` : ''}`,
    };
  }
  if (approved > 0 && rejected > 0) {
    return {
      label: 'MIXED',
      tone: 'mixed',
      pending: 0,
      approved,
      rejected,
      summary: `${approved} approved · ${rejected} rejected`,
    };
  }
  if (approved > 0) {
    return {
      label: 'APPROVED',
      tone: 'approved',
      pending: 0,
      approved,
      rejected,
      summary: approved === 1 ? '1 visitor approved' : `${approved} visitors approved`,
    };
  }
  if (rejected > 0) {
    return {
      label: 'REJECTED',
      tone: 'rejected',
      pending: 0,
      approved,
      rejected,
      summary: rejected === 1 ? '1 visitor rejected' : `${rejected} visitors rejected`,
    };
  }
  return {
    label: statusMeta(visit.status).label,
    tone: statusMeta(visit.status).tone,
    pending: 0,
    approved: 0,
    rejected: 0,
    summary: null,
  };
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1l-2.2 2.2z"
      />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 2h2v2h6V2h2v2h3c.6 0 1 .4 1 1v15c0 .6-.4 1-1 1H4c-.6 0-1-.4-1-1V5c0-.6.4-1 1-1h3V2zm12 8H5v9h14v-9zM5 8h14V6H5v2z"
      />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M9.2 16.6 4.8 12.2l1.4-1.4 3 3 8-8 1.4 1.4z" />
    </svg>
  );
}

function visitCardKey(visit) {
  return visit.groupId || visit.visitorId;
}

function groupMembers(visit) {
  return Array.isArray(visit.members) ? visit.members : [];
}

function pendingActionCount(visit) {
  if (typeof visit.pendingCount === 'number') return visit.pendingCount;
  const members = groupMembers(visit);
  return members.filter((m) => m.status === 'pending-approval').length;
}

function purposeText(visit) {
  return visit.reasonForVisit
    || (visit.entryType === 'EMPLOYEE' ? 'Employee visit' : 'Visitor request');
}

function RejectForm({
  cardKey,
  busy,
  hotkeyActive,
  onReject,
  onCancel,
  visit,
  title,
  confirmLabel,
}) {
  const [remarks, setRemarks] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const customRef = useRef(null);

  useEffect(() => {
    if (!hotkeyActive || busy) return undefined;

    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName;
      const typingInCustom = tag === 'TEXTAREA' || tag === 'INPUT';

      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
        return;
      }

      if (!typingInCustom) {
        const preset = REJECT_PRESETS.find((p) => p.key === e.key);
        if (preset) {
          e.preventDefault();
          onReject(visit, preset.label);
          return;
        }
        if (e.key === '5' || e.key.toLowerCase() === 't') {
          e.preventDefault();
          setCustomMode(true);
          setTimeout(() => customRef.current?.focus(), 0);
        }
      }

      if (e.key === 'Enter' && !e.shiftKey && customMode && remarks.trim()) {
        e.preventDefault();
        onReject(visit, remarks.trim());
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hotkeyActive, busy, customMode, remarks, onReject, onCancel, visit]);

  return (
    <div className="hp-reject-form">
      <p className="hp-reject-form__label">
        {title}
        <span className="hp-reject-form__hint"> · press 1–4 · Esc to cancel</span>
      </p>
      <div className="hp-reject-presets" role="group" aria-label="Rejection reasons">
        {REJECT_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className="hp-preset"
            disabled={busy}
            onClick={() => onReject(visit, preset.label)}
          >
            <kbd className="hp-kbd">{preset.key}</kbd>
            <span>{preset.label}</span>
          </button>
        ))}
        <button
          type="button"
          className={`hp-preset${customMode ? ' hp-preset--active' : ''}`}
          disabled={busy}
          onClick={() => {
            setCustomMode(true);
            setTimeout(() => customRef.current?.focus(), 0);
          }}
        >
          <kbd className="hp-kbd">5</kbd>
          <span>Other</span>
        </button>
      </div>

      {customMode && (
        <>
          <label className="hp-reject-form__sublabel" htmlFor={`remarks-${cardKey}`}>
            Additional remarks
          </label>
          <textarea
            ref={customRef}
            id={`remarks-${cardKey}`}
            className="hp-reject-form__input"
            rows={2}
            maxLength={500}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Type rejection reason…"
            disabled={busy}
          />
          <div className="hp-card__actions hp-card__actions--reject">
            <button
              type="button"
              className="hp-btn hp-btn--ghost"
              disabled={busy}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="hp-btn hp-btn--reject"
              disabled={busy || !remarks.trim()}
              onClick={() => onReject(visit, remarks.trim())}
            >
              {busy ? '…' : confirmLabel}
            </button>
          </div>
        </>
      )}

      {!customMode && (
        <div className="hp-card__actions hp-card__actions--reject">
          <button
            type="button"
            className="hp-btn hp-btn--ghost"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel <kbd className="hp-kbd">Esc</kbd>
          </button>
        </div>
      )}
    </div>
  );
}

function IndividualVisitCard({ visit, busyId, onApprove, onReject, hotkeyActive }) {
  const cardKey = visitCardKey(visit);
  const pending = visit.status === 'pending-approval';
  const approved = visit.status === 'approved' || visit.status === 'checked-in';
  const busy = busyId === cardKey;
  const meta = statusMeta(visit.status);
  const [rejectOpen, setRejectOpen] = useState(false);

  useEffect(() => {
    if (!pending || rejectOpen || !hotkeyActive || busy) return undefined;

    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;

      if (e.key.toLowerCase() === 'a') {
        e.preventDefault();
        onApprove(visit);
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setRejectOpen(true);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, rejectOpen, hotkeyActive, busy, onApprove, visit]);

  return (
    <li className={`hp-card hp-card--${meta.tone}`}>
      <div className="hp-card__main">
        <div className={`hp-avatar hp-avatar--${meta.tone}`} aria-hidden="true">
          <span>{initials(visit.visitorName)}</span>
          <i className={`hp-avatar__dot hp-avatar__dot--${meta.tone}`} />
        </div>

        <div className="hp-card__content">
          <div className="hp-card__head">
            <div className="hp-card__title-row">
              <h2 className="hp-card__name">{visit.visitorName}</h2>
              <span className={`hp-badge hp-badge--${meta.tone}`}>{meta.label}</span>
            </div>
          </div>

          <p className="hp-card__when">{formatWhenShort(visit.checkInTime)}</p>
          <p className="hp-card__purpose">{purposeText(visit)}</p>

          {visit.visitorMobile && (
            <div className="hp-card__facts">
              <span className="hp-fact">
                <IconPhone />
                {formatMobile(visit.visitorMobile)}
              </span>
            </div>
          )}

          <div className="hp-card__footer">
            <div className="hp-card__times">
              {visit.approvedAt && (
                <span className="hp-fact hp-fact--time hp-fact--ok">
                  Approved {formatVisitTime(visit.approvedAt)}
                </span>
              )}
            </div>

            {pending && !rejectOpen && (
              <div className="hp-card__actions">
                <button
                  type="button"
                  className="hp-btn hp-btn--reject"
                  disabled={busy}
                  onClick={() => setRejectOpen(true)}
                  title="Reject (R)"
                >
                  Reject <kbd className="hp-kbd">R</kbd>
                </button>
                <button
                  type="button"
                  className="hp-btn hp-btn--approve"
                  disabled={busy}
                  onClick={() => onApprove(visit)}
                  title="Approve (A)"
                >
                  {busy ? '…' : <>Approve <kbd className="hp-kbd hp-kbd--on-dark">A</kbd></>}
                </button>
              </div>
            )}

            {approved && (
              <span className="hp-result hp-result--approved" title="Approved" aria-label="Approved">
                <IconCheck />
              </span>
            )}
          </div>

          {pending && rejectOpen && (
            <RejectForm
              cardKey={cardKey}
              busy={busy}
              hotkeyActive={hotkeyActive}
              onReject={onReject}
              onCancel={() => setRejectOpen(false)}
              visit={visit}
              title="Why are you rejecting this visit?"
              confirmLabel="Reject Visit"
            />
          )}
        </div>
      </div>
    </li>
  );
}

function GroupVisitCard({
  visit,
  busyId,
  onApprove,
  onReject,
  onDecideMembers,
  hotkeyActive,
}) {
  const cardKey = visitCardKey(visit);
  const busy = busyId === cardKey;
  const members = groupMembers(visit);
  const decision = groupDecisionSummary(visit);
  const pendingMembers = members.filter((m) => m.status === 'pending-approval');
  const pendingIds = pendingMembers.map((m) => m.visitorId);
  const actionCount = pendingActionCount(visit);

  const [selected, setSelected] = useState(() => new Set());
  const [rejectMode, setRejectMode] = useState(null); // null | 'selected' | 'all'
  const selectAllRef = useRef(null);

  const selectedIds = pendingIds.filter((id) => selected.has(id));
  const selectedCount = selectedIds.length;
  const allSelected = actionCount > 0 && selectedCount === actionCount;
  const someSelected = selectedCount > 0 && selectedCount < actionCount;

  const peopleCount = visit.memberCount || members.length || 0;
  const headlineCount = actionCount > 0 ? actionCount : peopleCount;

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(pendingIds));
  };

  const handleApproveSelected = async () => {
    if (selectedIds.length === 0 || busy) return;
    try {
      await onDecideMembers(
        visit,
        selectedIds.map((visitorId) => ({ visitorId, decision: 'APPROVED' })),
      );
    } catch {
      // Surfaced via page-level actionError
    }
  };

  const handleRejectSelected = async (_visit, remarks) => {
    if (selectedIds.length === 0 || busy) return;
    try {
      await onDecideMembers(
        visit,
        selectedIds.map((visitorId) => ({
          visitorId,
          decision: 'REJECTED',
          remarks: remarks || null,
        })),
      );
      setRejectMode(null);
    } catch {
      // Surfaced via page-level actionError
    }
  };

  useEffect(() => {
    const nextPending = groupMembers(visit)
      .filter((m) => m.status === 'pending-approval')
      .map((m) => m.visitorId);
    setSelected((prev) => new Set([...prev].filter((id) => nextPending.includes(id))));
    setRejectMode(null);
  }, [visit]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  useEffect(() => {
    if (actionCount === 0 || rejectMode || !hotkeyActive || busy) {
      return undefined;
    }

    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;

      if (e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (selectedCount > 0) {
          handleApproveSelected();
        } else {
          onApprove(visit);
        }
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setRejectMode(selectedCount > 0 ? 'selected' : 'all');
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional hotkey binding
  }, [actionCount, rejectMode, hotkeyActive, busy, selectedCount, onApprove, visit]);

  return (
    <li className={`hp-card hp-card--group hp-card--${decision.tone}`}>
      <div className="hp-group">
        <div className="hp-group__top">
          <span className="hp-group__eyebrow">Group visit</span>
          <span className={`hp-badge hp-badge--${decision.tone}`}>{decision.label}</span>
        </div>

        <h2 className="hp-group__headline">
          {actionCount > 0
            ? (
              <>
                {headlineCount}
                {' '}
                {headlineCount === 1 ? 'person wants' : 'people want'}
                {' '}
                to meet you
              </>
            )
            : (
              <>
                {peopleCount}
                {' '}
                {peopleCount === 1 ? 'visitor' : 'visitors'}
                {' '}
                in this group
              </>
            )}
        </h2>
        <p className="hp-group__when">{formatWhenShort(visit.checkInTime)}</p>
        {decision.summary && (
          <p className={`hp-group__decision-summary hp-group__decision-summary--${decision.tone}`}>
            {decision.summary}
          </p>
        )}

        <div className="hp-group__section">
          <div className="hp-group__section-head">
            <p className="hp-group__section-label">Visitors</p>
            {actionCount > 0 && (
              <label className="hp-group__select-all">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="hp-group__checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={busy}
                />
                <span>Select all</span>
              </label>
            )}
          </div>

          <ul className={`hp-group-people${members.length > 6 ? ' hp-group-people--scroll' : ''}`}>
            {members.map((m) => {
              const meta = statusMeta(m.status);
              const isPending = m.status === 'pending-approval';
              const isChecked = selected.has(m.visitorId);
              return (
                <li
                  key={m.visitorId}
                  className={`hp-group-person${isPending ? '' : ' hp-group-person--decided'}`}
                >
                  {isPending ? (
                    <label className="hp-group-person__row">
                      <input
                        type="checkbox"
                        className="hp-group__checkbox"
                        checked={isChecked}
                        disabled={busy}
                        onChange={() => toggleOne(m.visitorId)}
                      />
                      <span className={`hp-group-person__avatar hp-avatar--${meta.tone}`} aria-hidden="true">
                        {initials(m.visitorName)}
                      </span>
                      <span className="hp-group-person__body">
                        <span className="hp-group-person__name">{m.visitorName}</span>
                        <span className="hp-group-person__meta">
                          {formatMobile(m.visitorMobile) || m.empId || m.visitorId}
                        </span>
                      </span>
                    </label>
                  ) : (
                    <div className="hp-group-person__row hp-group-person__row--static">
                      <span className="hp-group__checkbox-spacer" aria-hidden="true" />
                      <span className={`hp-group-person__avatar hp-avatar--${meta.tone}`} aria-hidden="true">
                        {initials(m.visitorName)}
                      </span>
                      <span className="hp-group-person__body">
                        <span className="hp-group-person__name">{m.visitorName}</span>
                        <span className="hp-group-person__meta">
                          {formatMobile(m.visitorMobile) || m.empId || m.visitorId}
                        </span>
                      </span>
                      <span className={`hp-badge hp-badge--${meta.tone}`}>{meta.label}</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="hp-group__section">
          <p className="hp-group__section-label">Purpose</p>
          <p className="hp-group__purpose">{purposeText(visit)}</p>
        </div>

        {visit.groupId && (
          <p className="hp-group__id">
            Group ID <span>{visit.groupId}</span>
          </p>
        )}

        {actionCount > 0 && rejectMode === 'selected' && (
          <RejectForm
            cardKey={`${cardKey}-selected`}
            busy={busy}
            hotkeyActive={hotkeyActive}
            onReject={handleRejectSelected}
            onCancel={() => setRejectMode(null)}
            visit={visit}
            title={`Why are you rejecting ${selectedCount} ${selectedCount === 1 ? 'visitor' : 'visitors'}?`}
            confirmLabel={`Reject ${selectedCount}`}
          />
        )}

        {actionCount > 0 && rejectMode === 'all' && (
          <RejectForm
            cardKey={`${cardKey}-all`}
            busy={busy}
            hotkeyActive={hotkeyActive}
            onReject={onReject}
            onCancel={() => setRejectMode(null)}
            visit={visit}
            title={`Why are you rejecting these ${actionCount} people?`}
            confirmLabel={`Reject ${actionCount}`}
          />
        )}

        {actionCount > 0 && !rejectMode && (
          <>
            <div className="hp-group__selection-bar">
              <p className="hp-group__selected-text">
                {selectedCount === 0
                  ? 'Select visitors to approve or reject'
                  : (
                    <>
                      Selected
                      {' '}
                      <strong>
                        {selectedCount}
                        {' '}
                        of
                        {' '}
                        {actionCount}
                      </strong>
                    </>
                  )}
              </p>
              <div className="hp-group__actions">
                <button
                  type="button"
                  className="hp-btn hp-btn--reject"
                  disabled={busy || selectedCount === 0}
                  onClick={() => setRejectMode('selected')}
                >
                  {selectedCount === 0 ? 'Reject' : `Reject ${selectedCount}`}
                </button>
                <button
                  type="button"
                  className="hp-btn hp-btn--approve"
                  disabled={busy || selectedCount === 0}
                  onClick={handleApproveSelected}
                >
                  {busy ? '…' : (selectedCount === 0 ? 'Approve' : `Approve ${selectedCount}`)}
                </button>
              </div>
            </div>

            <div className="hp-group__quick-all">
              <button
                type="button"
                className="hp-group__quick-link"
                disabled={busy}
                onClick={() => setRejectMode('all')}
              >
                Reject all {actionCount}
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                className="hp-group__quick-link hp-group__quick-link--approve"
                disabled={busy}
                onClick={() => onApprove(visit)}
              >
                Approve all {actionCount}
              </button>
            </div>
          </>
        )}

        {actionCount === 0 && decision.tone === 'approved' && (
          <div className="hp-group__result">
            <span className="hp-result hp-result--approved" title="Approved" aria-label="Approved">
              <IconCheck />
            </span>
            <span className="hp-group__result-text">All approved</span>
          </div>
        )}

        {actionCount === 0 && decision.tone === 'rejected' && (
          <div className="hp-group__result">
            <span className="hp-result hp-result--rejected" title="Rejected" aria-label="Rejected">
              ×
            </span>
            <span className="hp-group__result-text">All rejected</span>
          </div>
        )}

        {actionCount === 0 && decision.tone === 'mixed' && (
          <p className="hp-group__mixed-note">Decisions recorded for each visitor</p>
        )}
      </div>
    </li>
  );
}

function VisitCard(props) {
  if (props.visit?.groupId) {
    return <GroupVisitCard {...props} />;
  }
  return <IndividualVisitCard {...props} />;
}

function PortalChrome({ children, hostName, pendingCount, loadingSub }) {
  return (
    <div className="hp-page">
      <header className="hp-hero">
        <div className="hp-hero__inner">
          <div className="hp-hero__bar">
            {hostName ? <h1 className="hp-hero__name">{hostName}</h1> : <span />}
            <img src={logo} alt="MedPlus Visitor" className="hp-logo" />
          </div>
          <p className="hp-hero__sub">
            {loadingSub
              ? 'Loading requests…'
              : typeof pendingCount === 'number'
                ? (pendingCount === 0
                  ? 'No pending requests'
                  : pendingCount === 1
                    ? '1 visit requires your approval'
                    : `${pendingCount} visits require your approval`)
                : 'Loading requests…'}
          </p>
          <div className="hp-date-chip" aria-label={formatDateChip()}>
            <IconCalendar />
            <span>{formatDateChip()}</span>
          </div>
        </div>
      </header>
      <main className="hp-shell">{children}</main>
    </div>
  );
}

export default function HostPortalPage() {
  const { portalToken } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [portal, setPortal] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchHostPortal(portalToken)
      .then((data) => {
        if (cancelled) return;
        const visits = (data?.visits || []).filter((v) => v.status !== 'rejected');
        setPortal({ ...data, visits });
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Invalid approval link.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [portalToken]);

  const replaceVisit = useCallback((updated) => {
    setPortal((prev) => {
      if (!prev) return prev;
      const key = visitCardKey(updated);
      if (updated?.status === 'rejected' && !updated?.groupId) {
        return {
          ...prev,
          visits: (prev.visits || []).filter((v) => visitCardKey(v) !== key),
        };
      }
      // Fully rejected groups: drop from today's actionable list.
      if (updated?.groupId && updated?.status === 'rejected') {
        return {
          ...prev,
          visits: (prev.visits || []).filter((v) => visitCardKey(v) !== key),
        };
      }
      return {
        ...prev,
        visits: (prev.visits || []).map((v) =>
          (visitCardKey(v) === key ? { ...v, ...updated } : v)),
      };
    });
  }, []);

  const handleApprove = useCallback(async (visit) => {
    setActionError(null);
    const key = visitCardKey(visit);
    setBusyId(key);
    try {
      const updated = visit.groupId
        ? await approveGroup(portalToken, visit.groupId)
        : await approveVisit(portalToken, visit.visitorId);
      replaceVisit(updated);
    } catch (err) {
      setActionError(err?.message || 'Could not approve visit.');
    } finally {
      setBusyId(null);
    }
  }, [portalToken, replaceVisit]);

  const handleReject = useCallback(async (visit, remarks) => {
    setActionError(null);
    const key = visitCardKey(visit);
    setBusyId(key);
    try {
      const updated = visit.groupId
        ? await rejectGroup(portalToken, visit.groupId, remarks)
        : await rejectVisit(portalToken, visit.visitorId, remarks);
      replaceVisit(updated);
    } catch (err) {
      setActionError(err?.message || 'Could not reject visit.');
    } finally {
      setBusyId(null);
    }
  }, [portalToken, replaceVisit]);

  const handleDecideMembers = useCallback(async (visit, decisions) => {
    setActionError(null);
    const key = visitCardKey(visit);
    setBusyId(key);
    try {
      const updated = await decideGroupMembers(portalToken, visit.groupId, decisions);
      replaceVisit(updated);
      return updated;
    } catch (err) {
      setActionError(err?.message || 'Could not update visitors.');
      throw err;
    } finally {
      setBusyId(null);
    }
  }, [portalToken, replaceVisit]);

  if (loading) {
    return (
      <PortalChrome loadingSub>
        <div className="hp-panel hp-panel--center">
          <div className="hp-spinner" aria-label="Loading" />
          <p className="hp-muted">Loading visits…</p>
        </div>
      </PortalChrome>
    );
  }

  if (error) {
    return (
      <PortalChrome pendingCount={0}>
        <div className="hp-panel hp-panel--center">
          <p className="hp-error-title">Unable to open link</p>
          <p className="hp-muted">{error}</p>
        </div>
      </PortalChrome>
    );
  }

  const visits = portal?.visits ?? [];
  const pendingCount = visits.filter((v) => v.status === 'pending-approval').length;
  const firstPendingKey = visitCardKey(
    visits.find((v) => v.status === 'pending-approval') || {},
  );

  return (
    <PortalChrome hostName={portal.hostName} pendingCount={pendingCount}>
      <div className="hp-section-head">
        <h2 className="hp-section-title">Requests</h2>
      </div>

      {actionError && <p className="hp-action-error" role="alert">{actionError}</p>}

      {visits.length === 0 ? (
        <div className="hp-panel hp-panel--center">
          <p className="hp-empty-title">No requests today</p>
          <p className="hp-muted">When someone checks in to meet you, they will appear here.</p>
        </div>
      ) : (
        <ul className="hp-list">
          {visits.map((v) => (
            <VisitCard
              key={visitCardKey(v)}
              visit={v}
              busyId={busyId}
              hotkeyActive={visitCardKey(v) === firstPendingKey}
              onApprove={handleApprove}
              onReject={handleReject}
              onDecideMembers={handleDecideMembers}
            />
          ))}
        </ul>
      )}
    </PortalChrome>
  );
}
