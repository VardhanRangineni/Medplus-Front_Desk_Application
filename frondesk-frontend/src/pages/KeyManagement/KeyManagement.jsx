/**
 * Key Management — add / edit / remove approver phone numbers (Admin & Supervisor).
 * Mobile is looked up in HRMS; employee name is filled automatically.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import '../CheckInOut/CheckInOut.css';
import '../UserManagement/UserManagement.css';
import './KeyManagement.css';
import EmptyState from '../../components/EmptyState/EmptyState';
import LottieLoader from '../../components/LottieLoader/LottieLoader';
import Pagination from '../../components/Pagination/Pagination';
import PageSizeSelect from '../../components/Pagination/PageSizeSelect';
import { IconPlus, IconPhone, IconX, IconTrash, IconEdit, IconUser, IconRefreshCw } from '../../components/Icons/Icons';
import {
  getKeyManagementContacts,
  addKeyManagementContact,
  updateKeyManagementContact,
  removeKeyManagementContact,
  regenerateKeyManagementToken,
} from './keyManagementService';
import { lookupHrmsByPhoneNo } from '../../services/hrmsService';
import {
  LOOKUP_DEBOUNCE_MS,
  MOBILE_LOOKUP_LENGTH,
  cancelDebouncedLookup,
  isLookupStale,
  scheduleDebouncedLookup,
} from '../../utils/lookupDebounce';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const FILTER_DEBOUNCE = 350;
const COL_COUNT = 3;
const MOBILE_RE = /^[6-9]\d{9}$/;

const EMPTY_FILTERS = {
  mobile: '',
  displayName: '',
};

function ContactFormModal({ open, onClose, onSaved, initial }) {
  const isEdit = Boolean(initial?.id);
  const [mobile, setMobile] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [resolved, setResolved] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const timerRef = useRef(null);
  const generationRef = useRef(0);

  useEffect(() => () => cancelDebouncedLookup(generationRef, timerRef), []);

  useEffect(() => {
    if (!open) return;
    cancelDebouncedLookup(generationRef, timerRef);
    const initialMobile = initial?.mobile || '';
    const initialName = initial?.displayName || '';
    setMobile(initialMobile);
    setDisplayName(initialName);
    setResolved(initialMobile && initialName
      ? { name: initialName, phone: initialMobile }
      : null);
    setErrors({});
    setSaving(false);
    setLookupLoading(false);
  }, [open, initial]);

  if (!open) return null;

  function clearResolved() {
    setResolved(null);
    setDisplayName('');
  }

  function triggerLookup(digits) {
    setErrors((e) => ({ ...e, mobile: undefined, displayName: undefined, form: undefined }));
    if (digits.length < MOBILE_LOOKUP_LENGTH) {
      cancelDebouncedLookup(generationRef, timerRef);
      return;
    }

    const generation = scheduleDebouncedLookup(generationRef, timerRef, async () => {
      setLookupLoading(true);
      try {
        const emp = await lookupHrmsByPhoneNo(digits);
        if (isLookupStale(generation, generationRef)) return;
        const name = emp?.name?.trim() || '';
        if (!name) {
          clearResolved();
          setErrors({ mobile: 'HRMS returned no name for this mobile number.' });
          return;
        }
        setResolved({
          name,
          phone: emp.phone || digits,
          id: emp.id || '',
          department: emp.department || '',
        });
        setDisplayName(name);
        setErrors({});
      } catch (err) {
        if (isLookupStale(generation, generationRef)) return;
        clearResolved();
        setErrors({ mobile: err?.message || 'No employee found in HRMS for this mobile.' });
      } finally {
        if (!isLookupStale(generation, generationRef)) setLookupLoading(false);
      }
    }, LOOKUP_DEBOUNCE_MS);
  }

  function handleMobileChange(raw) {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    setMobile(digits);
    if (resolved) clearResolved();
    triggerLookup(digits);
  }

  const validate = () => {
    const next = {};
    if (!MOBILE_RE.test(mobile)) next.mobile = 'Enter a valid 10-digit Indian mobile number.';
    if (!displayName?.trim()) next.displayName = 'Look up a valid HRMS employee mobile first.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lookupLoading) return;
    if (!validate()) return;
    setSaving(true);
    const payload = {
      mobile,
      displayName: displayName.trim(),
    };
    try {
      if (isEdit) {
        await updateKeyManagementContact(initial.id, payload);
      } else {
        await addKeyManagementContact(payload);
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      setErrors({ form: err?.message || (isEdit ? 'Failed to update contact.' : 'Failed to add contact.') });
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = MOBILE_RE.test(mobile) && Boolean(displayName.trim()) && !lookupLoading;

  return createPortal(
    <div
      className="umg-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="km-form-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="umg-modal km-form-modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="umg-modal__header">
          <h2 id="km-form-title" className="umg-modal__title">
            {isEdit ? 'Edit Key Management contact' : 'Add Key Management contact'}
          </h2>
          <button type="button" className="umg-modal__close" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>

        <form className="umg-modal__body" onSubmit={handleSubmit}>
          {errors.form && (
            <p className="umg-field__error umg-field__error--banner">{errors.form}</p>
          )}

          <label className="umg-field">
            <span className="umg-field__label">Mobile number <span className="umg-req">*</span></span>
            <input
              className="umg-input umg-input--mono"
              value={mobile}
              onChange={(e) => handleMobileChange(e.target.value)}
              placeholder="10-digit mobile number"
              inputMode="numeric"
              autoComplete="tel"
              autoFocus
              required
            />
            {lookupLoading && (
              <span className="umg-field__hint">Looking up employee in HRMS…</span>
            )}
            {errors.mobile && <span className="umg-field__error">{errors.mobile}</span>}
          </label>

          {resolved ? (
            <div className="km-hrms-card" role="status">
              <div className="km-hrms-card__avatar" aria-hidden="true">
                <IconUser size={18} />
              </div>
              <div className="km-hrms-card__info">
                <p className="km-hrms-card__name">{resolved.name}</p>
                <p className="km-hrms-card__meta">
                  {[resolved.id, resolved.department].filter(Boolean).join(' · ') || 'HRMS employee'}
                </p>
              </div>
            </div>
          ) : (
            <p className="umg-field__hint umg-field__hint--muted">
              Enter a mobile number to fetch the employee name from HRMS.
            </p>
          )}
          {errors.displayName && <span className="umg-field__error">{errors.displayName}</span>}

          <div className="umg-modal__footer">
            <button type="button" className="umg-btn umg-btn--ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="umg-btn umg-btn--primary" disabled={saving || !canSubmit}>
              {saving ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Save changes' : 'Add contact')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function ConfirmRemoveModal({ contact, onCancel, onConfirm, removing }) {
  if (!contact) return null;
  return createPortal(
    <div
      className="umg-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="km-remove-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="umg-modal km-remove-modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="umg-modal__header">
          <h2 id="km-remove-title" className="umg-modal__title">Remove contact?</h2>
          <button type="button" className="umg-modal__close" onClick={onCancel} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>
        <div className="umg-modal__body">
          <p className="km-confirm-text">
            Remove <strong>{contact.mobile}</strong>
            {contact.displayName ? ` (${contact.displayName})` : ''}
            {' '}from Key Management?
          </p>
          <div className="umg-modal__footer">
            <button type="button" className="umg-btn umg-btn--ghost" onClick={onCancel} disabled={removing}>
              Cancel
            </button>
            <button
              type="button"
              className="umg-btn umg-btn--danger"
              onClick={onConfirm}
              disabled={removing}
            >
              {removing ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function RegenerateTokenModal({
  contact,
  phase,
  regenerating,
  onCancel,
  onConfirm,
  onCloseResult,
}) {
  if (phase === 'done') {
    return createPortal(
      <div
        className="umg-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="km-token-done-title"
        onClick={(e) => { if (e.target === e.currentTarget) onCloseResult(); }}
      >
        <div className="umg-modal km-token-modal" onClick={(ev) => ev.stopPropagation()}>
          <div className="umg-modal__header">
            <h2 id="km-token-done-title" className="umg-modal__title">Approval link regenerated</h2>
            <button type="button" className="umg-modal__close" onClick={onCloseResult} aria-label="Close">
              <IconX size={16} />
            </button>
          </div>
          <div className="umg-modal__body">
            <p className="km-confirm-text">
              The previous approval link has been revoked. Old SMS links will no longer open the portal.
              New visitor check-in SMS messages will use the new link automatically.
            </p>
            <div className="umg-modal__footer">
              <button type="button" className="umg-btn umg-btn--primary" onClick={onCloseResult}>
                Done
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  if (!contact) return null;

  return createPortal(
    <div
      className="umg-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="km-token-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="umg-modal km-token-modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="umg-modal__header">
          <h2 id="km-token-title" className="umg-modal__title">Regenerate approval link?</h2>
          <button type="button" className="umg-modal__close" onClick={onCancel} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>
        <div className="umg-modal__body">
          <p className="km-confirm-text">
            This creates a new portal token for{' '}
            <strong>{contact.displayName || contact.mobile}</strong>.
            Any old SMS or shared links will stop working immediately.
          </p>
          <div className="umg-modal__footer">
            <button type="button" className="umg-btn umg-btn--ghost" onClick={onCancel} disabled={regenerating}>
              Cancel
            </button>
            <button
              type="button"
              className="umg-btn umg-btn--primary"
              onClick={onConfirm}
              disabled={regenerating}
            >
              {regenerating ? 'Regenerating…' : 'Regenerate link'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function KeyManagement() {
  const [contacts, setContacts] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState(EMPTY_FILTERS);
  const [initLoading, setInitLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [regenTarget, setRegenTarget] = useState(null);
  const [regenPhase, setRegenPhase] = useState('confirm'); // confirm | done
  const [regenerating, setRegenerating] = useState(false);
  const filterTimer = useRef(null);

  useEffect(() => {
    if (filterTimer.current) clearTimeout(filterTimer.current);
    filterTimer.current = setTimeout(() => {
      setDebouncedFilters(filters);
      setCurrentPage(1);
    }, FILTER_DEBOUNCE);
    return () => { if (filterTimer.current) clearTimeout(filterTimer.current); };
  }, [filters]);

  const fetchContacts = useCallback(async (page, size, f, isInitial = false) => {
    if (isInitial) setInitLoading(true);
    else setPageLoading(true);
    setLoadError(null);
    try {
      const res = await getKeyManagementContacts({ page: page - 1, size, filters: f });
      setContacts(res?.content ?? []);
      setTotalElements(res?.totalElements ?? 0);
      setTotalPages(Math.max(1, res?.totalPages ?? 1));
    } catch (err) {
      setLoadError(err?.message ?? 'Failed to load Key Management contacts.');
      setContacts([]);
    } finally {
      setInitLoading(false);
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts(currentPage, pageSize, debouncedFilters, currentPage === 1 && initLoading);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initLoading only for first paint
  }, [currentPage, pageSize, debouncedFilters, fetchContacts]);

  const openAdd = () => {
    setEditContact(null);
    setShowForm(true);
  };

  const openEdit = (contact) => {
    setEditContact(contact);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditContact(null);
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await removeKeyManagementContact(removeTarget.id);
      setRemoveTarget(null);
      await fetchContacts(currentPage, pageSize, debouncedFilters);
    } catch (err) {
      setLoadError(err?.message ?? 'Failed to remove contact.');
      setRemoveTarget(null);
    } finally {
      setRemoving(false);
    }
  };

  const openRegen = (contact) => {
    setRegenTarget(contact);
    setRegenPhase('confirm');
  };

  const closeRegen = () => {
    setRegenTarget(null);
    setRegenPhase('confirm');
    setRegenerating(false);
  };

  const handleRegenerate = async () => {
    if (!regenTarget) return;
    setRegenerating(true);
    setLoadError(null);
    try {
      await regenerateKeyManagementToken(regenTarget.id);
      setRegenTarget(null);
      setRegenPhase('done');
      await fetchContacts(currentPage, pageSize, debouncedFilters);
    } catch (err) {
      setLoadError(err?.message ?? 'Failed to regenerate approval link.');
      closeRegen();
    } finally {
      setRegenerating(false);
    }
  };

  const pageStart = (currentPage - 1) * pageSize;
  const hasFilters = Boolean(filters.mobile.trim() || filters.displayName.trim());

  return (
    <div className="ci-page">
      {loadError && (
        <div className="umg-error-banner" role="alert">{loadError}</div>
      )}

      <div className={`ci-card${pageLoading ? ' ci-card--loading' : ''}`}>
        <div className="ci-topbar">
          <div className="ci-topbar__title-wrap">
            <h2 className="ci-topbar__title">Key Management</h2>
            <p className="km-intro">
              Add or remove phone numbers that receive visitor approval SMS.
            </p>
          </div>
          <div className="ci-topbar__actions">
            <button type="button" className="ci-add-btn" onClick={openAdd}>
              <IconPlus size={14} />
              <span>Add Contact</span>
            </button>
          </div>
        </div>

        <div className="ci-table-wrap">
          <table className="ci-table km-table">
            <thead>
              <tr>
                <th scope="col">Mobile</th>
                <th scope="col">Name</th>
                <th scope="col" className="km-col--actions">Actions</th>
              </tr>
              <tr className="ci-col-filters">
                <th>
                  <input
                    className="ci-col-filter"
                    placeholder="Filter mobile…"
                    value={filters.mobile}
                    onChange={(e) => setFilters((f) => ({
                      ...f,
                      mobile: e.target.value.replace(/\D/g, '').slice(0, 10),
                    }))}
                    aria-label="Filter by mobile"
                    inputMode="numeric"
                  />
                </th>
                <th>
                  <input
                    className="ci-col-filter"
                    placeholder="Filter name…"
                    value={filters.displayName}
                    onChange={(e) => setFilters((f) => ({ ...f, displayName: e.target.value }))}
                    aria-label="Filter by name"
                  />
                </th>
                <th className="km-col--actions ci-col-filter-cell--empty" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {initLoading ? (
                <tr>
                  <td colSpan={COL_COUNT} className="ci-table-loading">
                    <LottieLoader size="md" ariaLabel="Loading contacts" />
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className="fd-empty-cell">
                    <EmptyState
                      compact
                      icon={<IconPhone size={22} />}
                      title={hasFilters ? 'No contacts found' : 'No Key Management contacts yet'}
                      description={hasFilters
                        ? 'Try adjusting filters.'
                        : 'Add phone numbers that should receive visitor approval SMS.'}
                      action={!hasFilters
                        ? { label: 'Add Contact', onClick: openAdd, icon: <IconPlus size={14} /> }
                        : undefined}
                    />
                  </td>
                </tr>
              ) : contacts.map((c) => (
                <tr key={c.id}>
                  <td className="km-mono">{c.mobile}</td>
                  <td>{c.displayName || '—'}</td>
                  <td className="km-col--actions">
                    <div className="ci-actions">
                      <button
                        type="button"
                        className="ci-action-btn km-action-btn--regen"
                        onClick={() => openRegen(c)}
                        aria-label={`Regenerate approval link for ${c.mobile}`}
                        title="Regenerate approval link"
                      >
                        <IconRefreshCw size={14} />
                      </button>
                      <button
                        type="button"
                        className="ci-action-btn ci-action-btn--edit"
                        onClick={() => openEdit(c)}
                        aria-label={`Edit ${c.mobile}`}
                        title="Edit contact"
                      >
                        <IconEdit size={14} />
                      </button>
                      <button
                        type="button"
                        className="ci-action-btn km-action-btn--remove"
                        onClick={() => setRemoveTarget(c)}
                        aria-label={`Remove ${c.mobile}`}
                        title="Remove contact"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!initLoading && totalElements > 0 && (
          <div className="ci-card-footer">
            <p className="ci-card-footer__info">
              Showing {pageStart + 1}–{Math.min(pageStart + contacts.length, totalElements)} of {totalElements}
            </p>
            <div className="ci-card-footer__controls">
              <PageSizeSelect
                value={pageSize}
                options={PAGE_SIZE_OPTIONS}
                onChange={(size) => { setPageSize(size); setCurrentPage(1); }}
              />
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        )}
      </div>

      <ContactFormModal
        open={showForm}
        initial={editContact}
        onClose={closeForm}
        onSaved={() => fetchContacts(currentPage, pageSize, debouncedFilters)}
      />

      <ConfirmRemoveModal
        contact={removeTarget}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        removing={removing}
      />

      <RegenerateTokenModal
        contact={regenTarget}
        phase={regenPhase}
        regenerating={regenerating}
        onCancel={closeRegen}
        onConfirm={handleRegenerate}
        onCloseResult={closeRegen}
      />
    </div>
  );
}
