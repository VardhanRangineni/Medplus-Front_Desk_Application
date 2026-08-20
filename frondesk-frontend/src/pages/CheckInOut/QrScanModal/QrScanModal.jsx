/**
 * QrScanModal — Camera QR scanner with staff verification flow.
 *
 * Flow:
 *  1. Camera scans QR  → extracts PREREG:token
 *  2. GET /preview/{token} → show visitor details (person-to-meet from HRMS, read-only)
 *  3. POST /checkin/{token} with pre-validated personToMeetId → success
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './QrScanModal.css';
import {
  IconX,
  IconCamera,
  IconUser,
  IconBuilding,
  IconEye,
  IconEyeOff,
  IconCheck,
  IconCheckCircle,
  IconAlertCircle,
} from '../../../components/Icons/Icons';
import { getPreRegPreview, checkInByQr, recordZoneScan } from '../checkInOutService';

const SCAN_INTERVAL_MS = 300;
const jsQrReady = import('jsqr').then((m) => m.default);

function isMovementPayload(raw) {
  const v = (raw ?? '').trim();
  if (!v) return false;
  if (/^VISITOR:/i.test(v)) return true;
  return /^MED-(?:GV|V)-\d{4,12}$/i.test(v);
}

function normalizeToken(rawData) {
  let token = rawData.trim();
  if (token.startsWith('PREREG:')) token = token.slice('PREREG:'.length);
  return token.trim();
}

function personFromPreview(preview) {
  if (!preview?.personToMeetId) return null;
  return {
    id: preview.personToMeetId,
    name: preview.personName || '—',
    department: preview.hostDepartment || '',
  };
}

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

export default function QrScanModal({ onClose, onSuccess, mode = 'PREREG_CHECKIN' }) {
  const isZoneScan = mode === 'ZONE_SCAN';
  const [page,         setPage]         = useState('scan');
  const [statusMsg,    setStatusMsg]    = useState('');
  const [preview,      setPreview]      = useState(null);
  const [checkedEntry, setCheckedEntry] = useState(null);
  const [aadhaarFull,  setAadhaarFull]  = useState(false);
  const [resolvedPerson, setResolvedPerson] = useState(null);
  const [visitorCardNumber, setVisitorCardNumber] = useState('');

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError,  setCameraError]  = useState('');
  const [manualToken,  setManualToken]  = useState('');
  const [showManual,   setShowManual]   = useState(false);

  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const streamRef    = useRef(null);
  const scanTimerRef = useRef(null);
  const onCloseRef   = useRef(onClose);
  const processingRef = useRef(false);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

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
      const jsQR = await jsQrReady;
      const code  = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) handleQrDetected(code.data);
    } catch { /* silent */ }
  }

  const completeZoneScan = useCallback(async (rawData) => {
    setStatusMsg('Recording movement…');
    const result = await recordZoneScan(rawData);
    setCheckedEntry({
      id: result.visitorId,
      name: result.visitorName,
      deviceName: result.deviceName,
      message: result.message,
      duplicate: result.duplicateSuppressed,
    });
    setPage('done');
    onSuccess?.(result);
  }, [onSuccess]);

  const handleQrDetected = useCallback(async (rawData) => {
    if (page !== 'scan' || processingRef.current) return;
    processingRef.current = true;
    clearInterval(scanTimerRef.current);

    setPage('loading');
    stopCamera();

    try {
      if (isZoneScan || isMovementPayload(rawData)) {
        await completeZoneScan(rawData);
        return;
      }

      const token = normalizeToken(rawData);
      if (!token.match(/^[a-f0-9]{32}$/i)) {
        setPage('scan');
        processingRef.current = false;
        await startCamera();
        startScanLoop();
        return;
      }

      setStatusMsg('QR detected — loading visitor details…');

      const data = await getPreRegPreview(token);
      if (data.alreadyCheckedIn) {
        await completeZoneScan(rawData.startsWith('PREREG:') ? rawData : `PREREG:${token}`);
        return;
      }

      setPreview(data);
      setResolvedPerson(personFromPreview(data));
      setPage('preview');
    } catch (e) {
      const msg = e?.message || '';
      if (/already been used/i.test(msg)) {
        try {
          const token = normalizeToken(rawData);
          await completeZoneScan(rawData.startsWith('PREREG:') ? rawData : `PREREG:${token}`);
          return;
        } catch (zoneErr) {
          setStatusMsg(zoneErr?.message || 'Zone scan failed.');
          setPage('error');
          return;
        }
      }
      setStatusMsg(msg || 'Failed to load visitor details.');
      setPage('error');
    }
  }, [page, isZoneScan, completeZoneScan]);

  async function handleAccept() {
    if (!preview || !resolvedPerson) return;

    setPage('accepting');
    try {
      const cardNo = preview.entryType === 'VISITOR' ? visitorCardNumber.trim() : null;
      const entry = await checkInByQr(preview.token, resolvedPerson.id, cardNo);
      onSuccess?.({ ...entry, type: entry.type || entry.entryType || preview.entryType });
      onClose();
    } catch (e) {
      setStatusMsg(e?.message || 'Check-in failed.');
      setPage('error');
    }
  }

  function handleReject() {
    processingRef.current = false;
    resetPreview();
    setPage('scan');
    startCamera();
  }

  function handleRetry() {
    processingRef.current = false;
    resetPreview();
    setPage('scan');
    startCamera();
  }

  function resetPreview() {
    setPreview(null);
    setCheckedEntry(null);
    setStatusMsg('');
    setAadhaarFull(false);
    setResolvedPerson(null);
    setManualToken('');
    setVisitorCardNumber('');
  }

  async function handleManualCheckin() {
    const token = manualToken.trim().replace(/^PREREG:/i, '');
    if (!token) return;
    await handleQrDetected('PREREG:' + token);
  }

  const handleOverlayClick = (e) => { if (e.target === e.currentTarget) onClose(); };

  const canAccept = resolvedPerson
    && !preview?.alreadyCheckedIn
    && !(preview?.entryType === 'EMPLOYEE' && !preview?.empFound)
    && !(preview?.entryType === 'VISITOR' && !visitorCardNumber.trim());

  return createPortal(
    <div className="qsm-overlay" role="dialog" aria-modal="true" onClick={handleOverlayClick}>
      <div className="qsm-dialog">

        <div className="qsm-header">
          <div>
            <h2 className="qsm-title">{isZoneScan ? 'Zone Scan' : 'Scan Visitor QR'}</h2>
            <p className="qsm-sub">
              {page === 'preview'  ? 'Verify visitor details before accepting.' :
               page === 'done'     ? (isZoneScan ? 'Movement recorded.' : 'Check-in completed successfully.') :
               isZoneScan ? 'Scan a checked-in visitor\'s pass to record movement at this kiosk.' :
               'Point camera at the visitor\'s QR code.'}
            </p>
          </div>
          <button className="qsm-close" onClick={onClose} aria-label="Close"><IconX size={16} /></button>
        </div>

        <div className="qsm-body">

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

          {page === 'preview' && preview && (
            <div className="qsm-preview">

              <div className="qsm-id-card">
                <div className="qsm-id-card__type">
                  <span className={`qsm-type-badge qsm-type-badge--${preview.entryType?.toLowerCase()}`}>
                    {preview.entryType === 'EMPLOYEE'
                      ? <><IconBuilding size={14} /> Employee</>
                      : <><IconUser size={14} /> Visitor</>}
                  </span>
                </div>
                <div className="qsm-id-card__name">{preview.name}</div>

                {preview.entryType === 'VISITOR' && (
                  <div className="qsm-id-card__aadhaar">
                    <div className="qsm-id-card__aadhaar-label">
                      {preview.govtIdType || 'Aadhaar'} Number
                      {preview.govtIdNumber && (
                        <button type="button" className="qsm-toggle-mask" onClick={() => setAadhaarFull((v) => !v)}>
                          {aadhaarFull
                            ? <><IconEyeOff size={13} /> Hide</>
                            : <><IconEye size={13} /> Show full</>}
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

                {preview.entryType === 'EMPLOYEE' && (
                  <div className={`qsm-emp-verify qsm-emp-verify--${preview.empFound ? 'found' : 'notfound'}`}>
                    <span className="qsm-emp-verify__icon">
                      {preview.empFound ? <IconCheckCircle size={20} /> : <IconAlertCircle size={20} />}
                    </span>
                    <div>
                      <div className="qsm-emp-verify__label">Employee Verification</div>
                      {preview.empFound
                        ? <div className="qsm-emp-verify__detail">{preview.empFullName}{preview.empDept ? ` · ${preview.empDept}` : ''}</div>
                        : <div className="qsm-emp-verify__detail">Employee ID &quot;{preview.empId}&quot; not found in HRMS</div>
                      }
                    </div>
                  </div>
                )}

                {preview.entryType === 'EMPLOYEE' && preview.empFound && !preview.alreadyCheckedIn && (
                  <div className="qsm-emp-reminder">
                    Ensure the employee is wearing their official ID badge before accepting.
                  </div>
                )}

                <div className="qsm-id-card__details">
                  {preview.mobile         && <div className="qsm-id-detail"><span>Mobile</span><strong>{preview.mobile}</strong></div>}
                  {preview.empId && preview.entryType === 'VISITOR' && <div className="qsm-id-detail"><span>Emp ID</span><strong>{preview.empId}</strong></div>}
                  {preview.reasonForVisit && <div className="qsm-id-detail"><span>Purpose</span><strong>{preview.reasonForVisit}</strong></div>}
                </div>
              </div>

              <div className="qsm-ptm-section">
                <div className="qsm-ptm-header">
                  <span className="qsm-ptm-title">Person to Meet</span>
                  {resolvedPerson
                    ? (
                      <span className="qsm-ptm-status qsm-ptm-status--ok">
                        <IconCheck size={13} /> Verified
                      </span>
                    )
                    : <span className="qsm-ptm-status qsm-ptm-status--none">Not available</span>}
                </div>

                {resolvedPerson ? (
                  <div className="qsm-ptm-readonly">
                    <div className="qsm-ptm-readonly__row">
                      <span className="qsm-ptm-readonly__label">Name</span>
                      <span className="qsm-ptm-readonly__value">{resolvedPerson.name}</span>
                    </div>
                    {resolvedPerson.department && (
                      <div className="qsm-ptm-readonly__row">
                        <span className="qsm-ptm-readonly__label">Department</span>
                        <span className="qsm-ptm-readonly__value">{resolvedPerson.department}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="qsm-ptm-no-results">Person-to-meet details are missing from this registration.</div>
                )}
              </div>

              {preview.entryType === 'VISITOR' && !preview.alreadyCheckedIn && (
                <div className="qsm-card-field">
                  <label className="qsm-card-field__label" htmlFor="qsm-visitor-card">
                    Visitor ID Card Number <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="qsm-visitor-card"
                    className="qsm-card-field__input"
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter printed card number"
                    value={visitorCardNumber}
                    onChange={(e) => setVisitorCardNumber(e.target.value)}
                  />
                </div>
              )}

              {preview.alreadyCheckedIn && (
                <div className="qsm-emp-blocked qsm-emp-blocked--duplicate">
                  <IconAlertCircle size={16} className="qsm-inline-icon" />
                  Already checked in — {preview.entryType === 'EMPLOYEE'
                    ? `Employee ${preview.empId} (${preview.empFullName || preview.name})`
                    : preview.name
                  } is currently checked in (entry {preview.activeEntryId}).
                  Please check out the existing entry first.
                </div>
              )}

              {preview.entryType === 'EMPLOYEE' && !preview.empFound && !preview.alreadyCheckedIn && (
                <div className="qsm-emp-blocked">
                  <IconAlertCircle size={16} className="qsm-inline-icon" />
                  Check-in blocked — Employee ID &quot;{preview.empId}&quot; was not found in HRMS.
                  Ask the person to contact HR or verify their Employee ID / HRMS ID.
                </div>
              )}

              <div className="qsm-preview-actions">
                <button type="button" className="qsm-reject-btn" onClick={handleReject}>
                  <IconX size={15} /> Reject
                </button>
                <button
                  type="button"
                  className="qsm-accept-btn"
                  onClick={handleAccept}
                  disabled={!canAccept}
                >
                  <IconCheck size={15} /> Accept &amp; Check In
                </button>
              </div>
            </div>
          )}

          {page === 'accepting' && (
            <div className="qsm-status qsm-status--checking">Checking in {preview?.name}…</div>
          )}

          {page === 'done' && (
            <div className="qsm-result qsm-result--success">
              <div className="qsm-result-icon"><IconCheckCircle size={44} /></div>
              <div className="qsm-result-title">{isZoneScan ? 'Scan Recorded' : 'Checked In!'}</div>
              <div className="qsm-result-name">{checkedEntry?.name}</div>
              {isZoneScan ? (
                <div className="qsm-result-meta">
                  {checkedEntry?.deviceName && <span>at {checkedEntry.deviceName}</span>}
                  {checkedEntry?.message && <span>{checkedEntry.message}</span>}
                </div>
              ) : (
                <div className="qsm-result-meta">
                  {checkedEntry?.department   && <span>{checkedEntry.department}</span>}
                  {checkedEntry?.personToMeet && <span>→ {checkedEntry.personToMeet}</span>}
                </div>
              )}
              {!isZoneScan && checkedEntry?.card != null && (
                <div className="qsm-result-card">
                  <span className="qsm-result-card__label">Visitor Card</span>
                  <span className="qsm-result-card__code">{checkedEntry.card}</span>
                </div>
              )}
              <div className="qsm-result-id">{checkedEntry?.id}</div>
              <div className="qsm-result-actions">
                <button type="button" className="qsm-result-btn qsm-result-btn--done" onClick={onClose}>Done</button>
                <button type="button" className="qsm-result-btn qsm-result-btn--scan" onClick={handleRetry}>
                  {isZoneScan ? 'Scan Next' : 'Scan Next'}
                </button>
              </div>
            </div>
          )}

          {page === 'error' && (
            <div className="qsm-result qsm-result--error">
              <div className="qsm-result-icon"><IconAlertCircle size={44} /></div>
              <div className="qsm-result-title">Error</div>
              <div className="qsm-result-msg">{statusMsg}</div>
              <button type="button" className="qsm-result-btn qsm-result-btn--scan" onClick={handleRetry}>Try Again</button>
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}
