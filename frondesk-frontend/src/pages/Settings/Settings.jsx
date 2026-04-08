import { useState, useEffect, useCallback } from 'react';
import './Settings.css';
import {
  getCardStats,
  getCardRequests,
  submitCardRequest,
  fulfillCardRequest,
  cancelCardRequest,
  getCardsForRequest,
  markRequestDownloaded,
} from './cardService';
import { generateCardsPdf } from './cardPdfGenerator';
import {
  IconCreditCard,
  IconCheckCircle,
  IconAlertCircle,
  IconDownload,
} from '../../components/Icons/Icons';

// ── Constants ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: 'Card Overview' },
  { id: 'requests', label: 'Request Cards' },
];

const STATUS_COLORS = {
  AVAILABLE: '#16a34a',
  ASSIGNED:  '#d97706',
  MISSING:   '#dc2626',
};

const REQUEST_TYPE_LABELS = {
  ADDITIONAL:  'Additional Cards',
  REPLACEMENT: 'Replacement Cards',
  INITIAL:     'Initial Batch',
};

const REQUEST_STATUS_LABELS = {
  PENDING:   'Pending',
  FULFILLED: 'Fulfilled',
  CANCELLED: 'Cancelled',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function pct(value, total) {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

function formatDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ── Stats overview card ───────────────────────────────────────────────────────
function LocationStatsCard({ stats, session, onRestore, pendingDownload, onDownload, downloadingId }) {
  const isAdmin    = session?.role === 'PRIMARY_ADMIN' || session?.role === 'REGIONAL_ADMIN';
  const isDownloading = downloadingId === pendingDownload?.id;

  return (
    <div className="st-loc-card">
      <div className="st-loc-card__header">
        <span className="st-loc-card__name">{stats.locationName}</span>
        <span className="st-loc-card__id">{stats.locationId}</span>
      </div>

      <div className="st-loc-card__stats">
        <div className="st-stat">
          <span className="st-stat__value">{stats.total}</span>
          <span className="st-stat__label">Total</span>
        </div>
        <div className="st-stat st-stat--available">
          <span className="st-stat__value" style={{ color: STATUS_COLORS.AVAILABLE }}>
            {stats.available}
          </span>
          <span className="st-stat__label">Available</span>
        </div>
        <div className="st-stat st-stat--assigned">
          <span className="st-stat__value" style={{ color: STATUS_COLORS.ASSIGNED }}>
            {stats.assigned}
          </span>
          <span className="st-stat__label">Assigned</span>
        </div>
        <div className="st-stat st-stat--missing">
          <span className="st-stat__value" style={{ color: STATUS_COLORS.MISSING }}>
            {stats.missing}
          </span>
          <span className="st-stat__label">Missing</span>
        </div>
      </div>

      {/* Availability bar */}
      <div className="st-bar-wrap" title={`${pct(stats.available, stats.total)}% available`}>
        <div
          className="st-bar st-bar--available"
          style={{ width: `${pct(stats.available, stats.total)}%` }}
        />
        <div
          className="st-bar st-bar--assigned"
          style={{ width: `${pct(stats.assigned, stats.total)}%` }}
        />
        <div
          className="st-bar st-bar--missing"
          style={{ width: `${pct(stats.missing, stats.total)}%` }}
        />
      </div>

      {/* Download banner — shown when there are undownloaded cards */}
      {pendingDownload && (
        <div className="st-download-banner">
          <div className="st-download-banner__info">
            <IconDownload size={14} />
            <span>
              <strong>{pendingDownload.quantity} cards</strong> ready to download
              {pendingDownload.requestType === 'INITIAL' ? ' (Initial Batch)' : ` (${REQUEST_TYPE_LABELS[pendingDownload.requestType] ?? pendingDownload.requestType})`}
            </span>
          </div>
          <button
            className="st-btn st-btn--download"
            onClick={() => onDownload(pendingDownload)}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <span className="st-btn__spinner" />
            ) : (
              <IconDownload size={13} />
            )}
            {isDownloading ? 'Generating…' : 'Download Cards PDF'}
          </button>
        </div>
      )}

      {stats.missing > 0 && isAdmin && (
        <div className="st-loc-card__missing-hint">
          {stats.missing} card{stats.missing > 1 ? 's' : ''} missing —
          use the Request Cards tab to order replacements.
        </div>
      )}
    </div>
  );
}

// ── Request row ───────────────────────────────────────────────────────────────
function RequestRow({ req, session, onFulfill, onCancel, onDownload, downloadingId }) {
  const isAdmin       = session?.role === 'PRIMARY_ADMIN' || session?.role === 'REGIONAL_ADMIN';
  const canDownload   = req.status === 'FULFILLED' && !req.downloadedAt;
  const isDownloading = downloadingId === req.id;

  return (
    <tr className={`st-req-row st-req-row--${req.status.toLowerCase()}`}>
      <td>{req.locationName}</td>
      <td>
        <span className={`st-req-type st-req-type--${req.requestType.toLowerCase()}`}>
          {REQUEST_TYPE_LABELS[req.requestType] ?? req.requestType}
        </span>
      </td>
      <td className="st-req-qty">{req.quantity}</td>
      <td className="st-req-notes">{req.notes || '—'}</td>
      <td>
        <span className={`st-req-status st-req-status--${req.status.toLowerCase()}`}>
          {REQUEST_STATUS_LABELS[req.status] ?? req.status}
        </span>
      </td>
      <td className="st-req-date">{formatDate(req.requestedAt)}</td>
      <td>
        <div className="st-req-actions">
          {req.status === 'PENDING' && isAdmin && (
            <button
              className="st-btn st-btn--sm st-btn--fulfill"
              onClick={() => onFulfill(req.id)}
              title="Mark fulfilled — generates new card records"
            >
              Fulfill
            </button>
          )}
          {req.status === 'PENDING' && (
            <button
              className="st-btn st-btn--sm st-btn--cancel"
              onClick={() => onCancel(req.id)}
              title="Cancel this request"
            >
              Cancel
            </button>
          )}
          {req.status === 'FULFILLED' && !canDownload && (
            <span className="st-req-fulfilled-by">
              {req.fulfilledBy !== 'SYSTEM' && `by ${req.fulfilledBy} · `}
              {formatDate(req.fulfilledAt)}
              {req.downloadedAt && (
                <span className="st-req-downloaded-tag">
                  ✓ Downloaded
                </span>
              )}
            </span>
          )}
          {canDownload && (
            <button
              className="st-btn st-btn--sm st-btn--download"
              onClick={() => onDownload(req)}
              disabled={isDownloading}
              title="Download cards PDF"
            >
              {isDownloading ? (
                <span className="st-btn__spinner" />
              ) : (
                <IconDownload size={12} />
              )}
              {isDownloading ? 'Generating…' : 'Download PDF'}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Settings({ session }) {
  const [activeTab, setActiveTab] = useState('overview');

  const isAdmin     = session?.role === 'PRIMARY_ADMIN' || session?.role === 'REGIONAL_ADMIN';
  const isPrimary   = session?.role === 'PRIMARY_ADMIN';
  // RECEPTIONIST and REGIONAL_ADMIN are scoped to their own location by the backend.
  // Pass their locationId in the form pre-fill so they don't need to choose.
  const scopedLocId = isPrimary ? null : (session?.locationId ?? null);

  // ── Overview state ────────────────────────────────────────────────────────
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats,        setStats]        = useState([]);
  const [statsError,   setStatsError]   = useState('');

  // ── Requests state ────────────────────────────────────────────────────────
  const [reqsLoading,  setReqsLoading]  = useState(true);
  const [requests,     setRequests]     = useState([]);
  const [reqsError,    setReqsError]    = useState('');

  // ── New request form state ────────────────────────────────────────────────
  const [form,         setForm]         = useState({
    locationId:  scopedLocId ?? '',
    requestType: 'ADDITIONAL',
    quantity:    10,
    notes:       '',
  });
  const [submitting,   setSubmitting]   = useState(false);
  const [submitMsg,    setSubmitMsg]    = useState(null); // {ok, text}

  // ── Download state ────────────────────────────────────────────────────────
  const [downloadingId, setDownloadingId] = useState(null);

  // ── Feedback banners ──────────────────────────────────────────────────────
  const [banner, setBanner] = useState(null); // {ok, text}

  const flash = useCallback((ok, text) => {
    setBanner({ ok, text });
    setTimeout(() => setBanner(null), 4000);
  }, []);

  // ── Fetch data ────────────────────────────────────────────────────────────
  // Backend auto-scopes by role so we just call without params for non-admins.
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError('');
    try {
      const data = await getCardStats(null);
      setStats(Array.isArray(data) ? data : []);
    } catch (e) {
      setStatsError(e.message);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    setReqsLoading(true);
    setReqsError('');
    try {
      const data = await getCardRequests({});
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      setReqsError(e.message);
    } finally {
      setReqsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); fetchRequests(); }, [fetchStats, fetchRequests]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleFulfill = useCallback(async (id) => {
    try {
      await fulfillCardRequest(id);
      flash(true, 'Request fulfilled — new cards have been generated.');
      fetchRequests();
      fetchStats();
    } catch (e) {
      flash(false, e.message);
    }
  }, [flash, fetchRequests, fetchStats]);

  const handleCancel = useCallback(async (id) => {
    try {
      await cancelCardRequest(id);
      flash(true, 'Request cancelled.');
      fetchRequests();
    } catch (e) {
      flash(false, e.message);
    }
  }, [flash, fetchRequests]);

  const handleSubmitRequest = useCallback(async (e) => {
    e.preventDefault();
    // For non-primary-admin, the location is always their own
    const effectiveLocationId = isPrimary ? form.locationId : scopedLocId;
    if (!effectiveLocationId) {
      setSubmitMsg({ ok: false, text: 'Please select a location.' });
      return;
    }
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      await submitCardRequest({
        locationId:  effectiveLocationId,
        requestType: form.requestType,
        quantity:    parseInt(form.quantity, 10),
        notes:       form.notes || null,
      });
      setSubmitMsg({ ok: true, text: 'Request submitted successfully.' });
      setForm(f => ({ ...f, quantity: 10, notes: '' }));
      fetchRequests();
    } catch (e) {
      setSubmitMsg({ ok: false, text: e.message });
    } finally {
      setSubmitting(false);
    }
  }, [form, fetchRequests, isPrimary, scopedLocId]);

  const handleDownload = useCallback(async (req) => {
    setDownloadingId(req.id);
    try {
      const codes = await getCardsForRequest(req.id);
      if (!codes || codes.length === 0) {
        flash(false, 'No card codes found for this batch.');
        return;
      }
      await generateCardsPdf(codes, req.locationName);
      await markRequestDownloaded(req.id);
      flash(true, `Downloaded ${codes.length} cards for ${req.locationName}.`);
      fetchRequests();
    } catch (e) {
      flash(false, `Download failed: ${e.message}`);
    } finally {
      setDownloadingId(null);
    }
  }, [flash, fetchRequests]);

  // Derive the latest undownloaded FULFILLED request per location for the Overview tab
  const pendingDownloadByLocation = {};
  requests
    .filter(r => r.status === 'FULFILLED' && !r.downloadedAt)
    .forEach(r => {
      const existing = pendingDownloadByLocation[r.locationId];
      if (!existing || new Date(r.requestedAt) > new Date(existing.requestedAt)) {
        pendingDownloadByLocation[r.locationId] = r;
      }
    });

  // Unique location options for the request form (only used by PRIMARY_ADMIN)
  const locationOptions = stats.map(s => ({ id: s.locationId, name: s.locationName }));

  return (
    <div className="st-page">

      {/* Header */}
      <header className="st-page__header">
        <h1 className="st-page__title">Settings</h1>
        <p className="st-page__sub">Manage visitor cards and submit card requests.</p>
      </header>

      {/* Banner */}
      {banner && (
        <div className={`st-banner st-banner--${banner.ok ? 'ok' : 'error'}`}>
          {banner.ok ? <IconCheckCircle size={15} /> : <IconAlertCircle size={15} />}
          {banner.text}
        </div>
      )}

      {/* Tabs */}
      <nav className="st-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`st-tab${activeTab === t.id ? ' st-tab--active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Overview tab ──────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <section className="st-section">
          <div className="st-section__hdr">
            <h2 className="st-section__title">
              <IconCreditCard size={16} />
              Visitor Card Inventory
            </h2>
            <button className="st-btn st-btn--sm st-btn--ghost" onClick={fetchStats}>
              Refresh
            </button>
          </div>

          {/* Legend */}
          <div className="st-legend">
            {Object.entries(STATUS_COLORS).map(([s, c]) => (
              <span key={s} className="st-legend__item">
                <span className="st-legend__dot" style={{ background: c }} />
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </span>
            ))}
          </div>

          {statsLoading ? (
            <div className="st-loading">Loading card inventory…</div>
          ) : statsError ? (
            <div className="st-error">{statsError}</div>
          ) : stats.length === 0 ? (
            <div className="st-empty">No card inventory found. Cards are auto-generated when locations are synced.</div>
          ) : (
            <div className="st-loc-grid">
              {stats.map(s => (
                <LocationStatsCard
                  key={s.locationId}
                  stats={s}
                  session={session}
                  onRestore={fetchStats}
                  pendingDownload={pendingDownloadByLocation[s.locationId] ?? null}
                  onDownload={handleDownload}
                  downloadingId={downloadingId}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Requests tab ──────────────────────────────────────────────────── */}
      {activeTab === 'requests' && (
        <section className="st-section">

          {/* Request form */}
          <div className="st-section__hdr">
            <h2 className="st-section__title">Submit a Card Request</h2>
          </div>

          <form className="st-form" onSubmit={handleSubmitRequest}>
            <div className="st-form__row">
              <label className="st-form__field">
                <span className="st-form__label">Location</span>
                {isPrimary ? (
                  <select
                    className="st-form__select"
                    value={form.locationId}
                    onChange={e => setForm(f => ({ ...f, locationId: e.target.value }))}
                    required
                  >
                    <option value="">— Select location —</option>
                    {locationOptions.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                ) : (
                  /* RECEPTIONIST / REGIONAL_ADMIN: location is auto-locked to their own */
                  <input
                    className="st-form__input"
                    type="text"
                    value={stats.find(s => s.locationId === scopedLocId)?.locationName ?? session?.locationName ?? scopedLocId ?? '—'}
                    readOnly
                    style={{ background: '#f5f5f7', cursor: 'not-allowed', color: '#888' }}
                  />
                )}
              </label>

              <label className="st-form__field">
                <span className="st-form__label">Request Type</span>
                <select
                  className="st-form__select"
                  value={form.requestType}
                  onChange={e => setForm(f => ({ ...f, requestType: e.target.value }))}
                >
                  <option value="ADDITIONAL">Additional Cards</option>
                  <option value="REPLACEMENT">Replacement Cards (for missing)</option>
                </select>
              </label>

              <label className="st-form__field st-form__field--sm">
                <span className="st-form__label">Quantity</span>
                <input
                  className="st-form__input"
                  type="number"
                  min="1"
                  max="500"
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  required
                />
              </label>
            </div>

            <label className="st-form__field">
              <span className="st-form__label">Notes (optional)</span>
              <input
                className="st-form__input"
                type="text"
                placeholder="e.g. Cards lost in flood, urgent replacement needed"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </label>

            {submitMsg && (
              <div className={`st-banner st-banner--${submitMsg.ok ? 'ok' : 'error'} st-banner--inline`}>
                {submitMsg.ok ? <IconCheckCircle size={14} /> : <IconAlertCircle size={14} />}
                {submitMsg.text}
              </div>
            )}

            <button
              type="submit"
              className="st-btn st-btn--primary"
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </form>

          {/* Request list */}
          <div className="st-section__hdr" style={{ marginTop: 28 }}>
            <h2 className="st-section__title">Request History</h2>
            <button className="st-btn st-btn--sm st-btn--ghost" onClick={fetchRequests}>
              Refresh
            </button>
          </div>

          {reqsLoading ? (
            <div className="st-loading">Loading requests…</div>
          ) : reqsError ? (
            <div className="st-error">{reqsError}</div>
          ) : requests.length === 0 ? (
            <div className="st-empty">No card requests yet.</div>
          ) : (
            <div className="st-table-wrap">
              <table className="st-table">
                <thead>
                  <tr>
                    <th>Location</th>
                    <th>Type</th>
                    <th>Qty</th>
                    <th>Notes</th>
                    <th>Status</th>
                    <th>Requested At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(r => (
                    <RequestRow
                      key={r.id}
                      req={r}
                      session={session}
                      onFulfill={handleFulfill}
                      onCancel={handleCancel}
                      onDownload={handleDownload}
                      downloadingId={downloadingId}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
