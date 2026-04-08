/**
 * QrScanModal — Camera QR scanner with staff verification flow.
 *
 * Flow:
 *  1. Camera scans QR  → extracts PREREG:token
 *  2. GET /preview/{token} → show visitor details
 *     - If EMPLOYEE: shows ✅/❌ employee verification result
 *     - Person to Meet: auto-searches by name visitor typed; staff can override
 *  3. Staff selects a person to meet → Accept button enables
 *  4. POST /checkin/{token} with resolvedPersonId → success
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './QrScanModal.css';
import { IconX, IconCamera } from '../../../components/Icons/Icons';
import { getPreRegPreview, searchPreRegStaff, checkInByQr } from '../checkInOutService';

const SCAN_INTERVAL_MS  = 300;
const SEARCH_DEBOUNCE   = 350;

function fmtAadhaar(num) {
  if (!num) return '—';
  const d = num.replace(/\D/g, '');
  return d.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3') || num;
}
function maskAadhaar(num) {
  if (!num) return '—';
  const d = num.replace(/\D/g, '');
  if (d.length !== 12) return fmtAadhaar(num);
  return `${d.slice(0, 4)} XXXX ${d.slice(8)}`;
}

export default function QrScanModal({ onClose, onSuccess }) {
  // page: 'scan' | 'loading' | 'preview' | 'accepting' | 'done' | 'error'
  const [page,          setPage]          = useState('scan');
  const [statusMsg,     setStatusMsg]     = useState('');
  const [preview,       setPreview]       = useState(null);
  const [checkedEntry,  setCheckedEntry]  = useState(null);
  const [aadhaarFull,   setAadhaarFull]   = useState(false);

  // Camera
  const [cameraActive,  setCameraActive]  = useState(false);
  const [cameraError,   setCameraError]   = useState('');
  const [manualToken,   setManualToken]   = useState('');
  const [showManual,    setShowManual]    = useState(false);

  // Person-to-meet search
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [selectedPerson,setSelectedPerson]= useState(null); // {id, name, department}

  const videoRef      = useRef(null);
  const canvasRef     = useRef(null);
  const streamRef     = useRef(null);
  const scanTimerRef  = useRef(null);
  const searchTimerRef= useRef(null);
  const onCloseRef    = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  useEffect(() => { startCamera(); return () => stopCamera(); }, []);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
      startScanLoop();
    }
  }, [cameraActive]);

  // Auto-search when preview loads
  useEffect(() => {
    if (preview?.personName) {
      setSearchQuery(preview.personName);
      doSearch(preview.personName, preview.token);
    }
  }, [preview?.token]);

  // Debounced search on manual query change
  useEffect(() => {
    if (!preview?.token || !searchQuery.trim()) { setSearchResults([]); return; }
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => doSearch(searchQuery, preview.token), SEARCH_DEBOUNCE);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery]);

  async function doSearch(query, token) {
    if (!query || query.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const results = await searchPreRegStaff(query.trim(), token);
      setSearchResults(results);
      // Auto-select if exactly one result and name matches
      if (results.length === 1 && !selectedPerson) {
        setSelectedPerson(results[0]);
      }
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }

  // ── Camera ──────────────────────────────────────────────────────────────────
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      setCameraActive(true);
      setCameraError('');
    } catch {
      setCameraError('Camera not available. Enter the token manually below.');
    }
  }

  function stopCamera() {
    clearInterval(scanTimerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  function startScanLoop() {
    clearInterval(scanTimerRef.current);
    scanTimerRef.current = setInterval(scanFrame, SCAN_INTERVAL_MS);
  }

  async function scanFrame() {
    if (page !== 'scan') { clearInterval(scanTimerRef.current); return; }
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    canvas.width  = video.videoWidth  || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const jsQR = (await import('jsqr')).default;
      const code  = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) handleQrDetected(code.data);
    } catch { /* silent */ }
  }

  const handleQrDetected = useCallback(async (rawData) => {
    if (page !== 'scan') return;
    clearInterval(scanTimerRef.current);

    let token = rawData;
    if (rawData.startsWith('PREREG:')) token = rawData.slice('PREREG:'.length);
    else if (!rawData.match(/^[a-f0-9]{32}$/i)) { startScanLoop(); return; }

    setPage('loading');
    setStatusMsg('QR detected — loading visitor details…');
    stopCamera();

    try {
      const data = await getPreRegPreview(token);
      setPreview(data);
      setSelectedPerson(null);
      setSearchResults([]);
      setSearchQuery(data.personName || '');
      setPage('preview');
    } catch (e) {
      setStatusMsg(e?.message || 'Failed to load visitor details.');
      setPage('error');
    }
  }, [page]);

  // ── Accept ───────────────────────────────────────────────────────────────────
  async function handleAccept() {
    if (!preview || !selectedPerson) return;
    setPage('accepting');
    try {
      const entry = await checkInByQr(preview.token, selectedPerson.id);
      setCheckedEntry(entry);
      setPage('done');
      onSuccess?.(entry);
    } catch (e) {
      setStatusMsg(e?.message || 'Check-in failed.');
      setPage('error');
    }
  }

  function handleReject() {
    resetPreview();
    setPage('scan');
    startCamera();
  }

  function handleRetry() {
    resetPreview();
    setPage('scan');
    startCamera();
  }

  function resetPreview() {
    setPreview(null);
    setCheckedEntry(null);
    setStatusMsg('');
    setAadhaarFull(false);
    setSelectedPerson(null);
    setSearchResults([]);
    setSearchQuery('');
    setManualToken('');
  }

  async function handleManualCheckin() {
    const token = manualToken.trim().replace(/^PREREG:/i, '');
    if (!token) return;
    await handleQrDetected('PREREG:' + token);
  }

  const handleOverlayClick = (e) => { if (e.target === e.currentTarget) onClose(); };

  // ── Render ───────────────────────────────────────────────────────────────────
  return createPortal(
    <div className="qsm-overlay" role="dialog" aria-modal="true" onClick={handleOverlayClick}>
      <div className="qsm-dialog">

        <div className="qsm-header">
          <div>
            <h2 className="qsm-title">Scan Visitor QR</h2>
            <p className="qsm-sub">
              {page === 'preview'  ? 'Verify details and select person to meet before accepting.' :
               page === 'done'     ? 'Check-in completed successfully.' :
               'Point camera at the visitor\'s QR code.'}
            </p>
          </div>
          <button className="qsm-close" onClick={onClose} aria-label="Close"><IconX size={16} /></button>
        </div>

        <div className="qsm-body">

          {/* ── SCAN / LOADING ── */}
          {(page === 'scan' || page === 'loading') && (
            <>
              <div className={`qsm-camera-wrap${cameraActive ? ' qsm-camera-wrap--live' : ''}`}>
                {cameraActive ? (
                  <>
                    <video ref={videoRef} className="qsm-video" autoPlay playsInline muted />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <div className="qsm-scan-frame"><div className="qsm-scan-line" /></div>
                  </>
                ) : (
                  <div className="qsm-camera-placeholder">
                    <IconCamera size={40} />
                    <span>{cameraError || (page === 'loading' ? statusMsg : 'Starting camera…')}</span>
                  </div>
                )}
              </div>
              {page === 'loading' && <div className="qsm-status qsm-status--checking">{statusMsg}</div>}
              {page === 'scan' && (
                !showManual ? (
                  <button className="qsm-manual-toggle" onClick={() => setShowManual(true)}>Enter token manually</button>
                ) : (
                  <div className="qsm-manual-wrap">
                    <input className="qsm-manual-input" type="text" placeholder="Paste visitor token here"
                      value={manualToken} onChange={(e) => setManualToken(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleManualCheckin(); }} />
                    <button className="qsm-manual-btn" onClick={handleManualCheckin} disabled={!manualToken.trim()}>
                      Load
                    </button>
                  </div>
                )
              )}
            </>
          )}

          {/* ── PREVIEW ── */}
          {page === 'preview' && preview && (
            <div className="qsm-preview">

              {/* Visitor identity */}
              <div className="qsm-id-card">
                <div className="qsm-id-card__type">
                  <span className={`qsm-type-badge qsm-type-badge--${preview.entryType?.toLowerCase()}`}>
                    {preview.entryType === 'EMPLOYEE' ? '🏢 Employee' : '👤 Visitor'}
                  </span>
                </div>
                <div className="qsm-id-card__name">{preview.name}</div>

                {/* Aadhaar — visitor only */}
                {preview.entryType === 'VISITOR' && (
                  <div className="qsm-id-card__aadhaar">
                    <div className="qsm-id-card__aadhaar-label">
                      {preview.govtIdType || 'Aadhaar'} Number
                      {preview.govtIdNumber && (
                        <button className="qsm-toggle-mask" onClick={() => setAadhaarFull(v => !v)}>
                          {aadhaarFull ? '🙈 Hide' : '👁 Show full'}
                        </button>
                      )}
                    </div>
                    <div className="qsm-id-card__aadhaar-num">
                      {preview.govtIdNumber
                        ? (aadhaarFull ? fmtAadhaar(preview.govtIdNumber) : maskAadhaar(preview.govtIdNumber))
                        : <span className="qsm-id-card__not-provided">Not provided</span>}
                    </div>
                  </div>
                )}

                {/* Employee verification */}
                {preview.entryType === 'EMPLOYEE' && (
                  <div className={`qsm-emp-verify qsm-emp-verify--${preview.empFound ? 'found' : 'notfound'}`}>
                    <span className="qsm-emp-verify__icon">{preview.empFound ? '✅' : '❌'}</span>
                    <div>
                      <div className="qsm-emp-verify__label">Employee Verification</div>
                      {preview.empFound
                        ? <div className="qsm-emp-verify__detail">{preview.empFullName} · {preview.empDept}</div>
                        : <div className="qsm-emp-verify__detail">Employee ID "{preview.empId}" not found in system</div>
                      }
                    </div>
                  </div>
                )}

                {/* Secondary details */}
                <div className="qsm-id-card__details">
                  {preview.mobile        && <div className="qsm-id-detail"><span>Mobile</span><strong>{preview.mobile}</strong></div>}
                  {preview.empId && preview.entryType === 'VISITOR' && <div className="qsm-id-detail"><span>Emp ID</span><strong>{preview.empId}</strong></div>}
                  {preview.reasonForVisit&& <div className="qsm-id-detail"><span>Purpose</span><strong>{preview.reasonForVisit}</strong></div>}
                </div>
              </div>

              {/* ── Person to Meet section ── */}
              <div className="qsm-ptm-section">
                <div className="qsm-ptm-header">
                  <span className="qsm-ptm-title">Person to Meet</span>
                  {selectedPerson
                    ? <span className="qsm-ptm-status qsm-ptm-status--ok">✅ Selected</span>
                    : <span className="qsm-ptm-status qsm-ptm-status--none">Not selected</span>
                  }
                </div>

                {/* What visitor typed */}
                {preview.personName && (
                  <div className="qsm-ptm-typed">
                    Visitor said: <em>"{preview.personName}"</em>
                    {preview.hostDepartment && <span> · {preview.hostDepartment}</span>}
                  </div>
                )}

                {/* Selected person chip */}
                {selectedPerson && (
                  <div className="qsm-ptm-selected">
                    <span className="qsm-ptm-selected__name">{selectedPerson.name}</span>
                    <span className="qsm-ptm-selected__dept">{selectedPerson.department}</span>
                    <button className="qsm-ptm-selected__clear" onClick={() => setSelectedPerson(null)} title="Change">✕</button>
                  </div>
                )}

                {/* Search box */}
                <div className="qsm-ptm-search-wrap">
                  <input
                    className="qsm-ptm-search"
                    type="text"
                    placeholder="Search by name, emp ID, or mobile…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searching && <span className="qsm-ptm-searching">Searching…</span>}
                </div>

                {/* Search results */}
                {searchResults.length > 0 && (
                  <div className="qsm-ptm-results">
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        className={`qsm-ptm-result${selectedPerson?.id === p.id ? ' qsm-ptm-result--active' : ''}`}
                        onClick={() => setSelectedPerson(p)}
                      >
                        <span className="qsm-ptm-result__check">{selectedPerson?.id === p.id ? '✓' : ' '}</span>
                        <span className="qsm-ptm-result__name">{p.name}</span>
                        <span className="qsm-ptm-result__dept">{p.department}</span>
                      </button>
                    ))}
                  </div>
                )}

                {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                  <div className="qsm-ptm-no-results">No matching staff found</div>
                )}
              </div>

              {/* Already checked-in block */}
              {preview.alreadyCheckedIn && (
                <div className="qsm-emp-blocked qsm-emp-blocked--duplicate">
                  ⚠️ Already checked in — {preview.entryType === 'EMPLOYEE'
                    ? `Employee ${preview.empId} (${preview.empFullName || preview.name})`
                    : preview.name
                  } is currently checked in (entry {preview.activeEntryId}).
                  Please check out the existing entry first.
                </div>
              )}

              {/* Employee not found block */}
              {preview.entryType === 'EMPLOYEE' && !preview.empFound && !preview.alreadyCheckedIn && (
                <div className="qsm-emp-blocked">
                  ❌ Check-in blocked — Employee ID "{preview.empId}" was not found in the system.
                  Ask the person to contact HR or use the correct Employee ID.
                </div>
              )}

              <div className="qsm-preview-actions">
                <button className="qsm-reject-btn" onClick={handleReject}>✕ Reject</button>
                <button
                  className="qsm-accept-btn"
                  onClick={handleAccept}
                  disabled={
                    !selectedPerson ||
                    preview.alreadyCheckedIn ||
                    (preview.entryType === 'EMPLOYEE' && !preview.empFound)
                  }
                >
                  ✓ Accept &amp; Check In
                </button>
              </div>
              <p className="qsm-preview-note">
                {preview.alreadyCheckedIn
                  ? "This person is already inside — check-in is not permitted."
                  : preview.entryType === 'VISITOR'
                    ? "Verify Aadhaar against the visitor\u2019s physical ID card before accepting."
                    : preview.empFound
                      ? "Verify the employee\u2019s physical ID before accepting."
                      : "Employee not found \u2014 check-in is not permitted."}
              </p>
            </div>
          )}

          {/* ── ACCEPTING ── */}
          {page === 'accepting' && (
            <div className="qsm-status qsm-status--checking">Checking in {preview?.name}…</div>
          )}

          {/* ── DONE ── */}
          {page === 'done' && (
            <div className="qsm-result qsm-result--success">
              <div className="qsm-result-icon">✅</div>
              <div className="qsm-result-title">Checked In!</div>
              <div className="qsm-result-name">{checkedEntry?.name}</div>
              <div className="qsm-result-meta">
                {checkedEntry?.department  && <span>{checkedEntry.department}</span>}
                {checkedEntry?.personToMeet&& <span>→ {checkedEntry.personToMeet}</span>}
              </div>
              {/* Show assigned card */}
              {(checkedEntry?.cardCode || checkedEntry?.card != null) && (
                <div className="qsm-result-card">
                  <span className="qsm-result-card__label">Visitor Card</span>
                  <span className="qsm-result-card__code">
                    {checkedEntry.cardCode || checkedEntry.card}
                  </span>
                  <span className="qsm-result-card__hint">Hand this card to the visitor</span>
                </div>
              )}
              <div className="qsm-result-id">{checkedEntry?.id}</div>
              <div className="qsm-result-actions">
                <button className="qsm-result-btn qsm-result-btn--done" onClick={onClose}>Done</button>
                <button className="qsm-result-btn qsm-result-btn--scan" onClick={handleRetry}>Scan Next</button>
              </div>
            </div>
          )}

          {/* ── ERROR ── */}
          {page === 'error' && (
            <div className="qsm-result qsm-result--error">
              <div className="qsm-result-icon">⚠️</div>
              <div className="qsm-result-title">Error</div>
              <div className="qsm-result-msg">{statusMsg}</div>
              <button className="qsm-result-btn qsm-result-btn--scan" onClick={handleRetry}>Try Again</button>
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}
