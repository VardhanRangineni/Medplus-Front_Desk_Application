/**
 * PreRegModal — Front desk generates a group pre-registration link.
 *
 * Staff clicks "Group Pre-Reg", selects location, clicks Generate.
 * The modal shows a shareable URL + QR code visitors can scan on their phones
 * to self-register. After submitting the form, each visitor gets their own QR
 * code which is scanned at the front desk for instant check-in.
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './PreRegModal.css';
import { IconX } from '../../../components/Icons/Icons';
import { createGroupLink } from '../checkInOutService';

export default function PreRegModal({ session, onClose }) {
  const [locationId,  setLocationId]  = useState(session?.locationId || '');
  const [generating,  setGenerating]  = useState(false);
  const [error,       setError]       = useState('');
  const [linkData,    setLinkData]    = useState(null);
  const [copied,      setCopied]      = useState(false);
  const qrRef  = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Render QR code once linkData is available and qrRef is mounted
  useEffect(() => {
    if (!linkData || !qrRef.current) return;

    import('qrcode').then((mod) => {
      const QRCode = mod.default || mod;
      QRCode.toCanvas(qrRef.current, linkData.url, {
        width: 200,
        margin: 1,
        color: { dark: '#111111', light: '#ffffff' },
      }).catch(() => {});
    }).catch(() => {
      // qrcode unavailable — URL is still copyable
    });
  }, [linkData]);

  async function handleGenerate() {
    if (!locationId) { setError('Please enter a location ID.'); return; }
    setGenerating(true);
    setError('');
    try {
      // Prefer the machine's LAN IPv4 so links work on phones on the same Wi-Fi.
      // Fall back to the configured API base (which may still be localhost in dev).
      const lanIp = await resolveLanIp();
      const apiBase = await window.electronAPI.getApiBaseUrl?.().catch?.(() => null) ?? 'http://localhost:8080';
      const baseForLink = lanIp ? `http://${lanIp}:8080` : apiBase;

      const data = await createGroupLink(locationId);
      const url = `${baseForLink}/register.html?t=${data.groupToken}`;
      setLinkData({ ...data, url });
    } catch (e) {
      setError(e?.message || 'Failed to generate link. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function resolveLanIp() {
    try {
      const interfaces = await window.electronAPI.getNetworkInfo();
      // Prefer a 192.168.x.x or 10.x.x.x IPv4 address (LAN)
      const lan = interfaces.find(
        (i) => i.family === 'IPv4' && (i.ip.startsWith('192.168.') || i.ip.startsWith('10.') || i.ip.startsWith('172.'))
      );
      return lan?.ip ?? null;
    } catch {
      return null;
    }
  }

  function handleCopy() {
    if (!linkData) return;
    const doCopy = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    // navigator.clipboard is blocked in Electron without explicit permission;
    // fall back to the legacy execCommand approach.
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(linkData.url).then(doCopy).catch(() => execCopy());
    } else {
      execCopy();
    }
    function execCopy() {
      const el = document.createElement('textarea');
      el.value = linkData.url;
      el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      try { document.execCommand('copy'); doCopy(); } catch (_) {}
      document.body.removeChild(el);
    }
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const expiryStr = linkData?.expiresAt
    ? new Date(linkData.expiresAt).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
      })
    : '';

  return createPortal(
    <div className="prm-overlay" role="dialog" aria-modal="true" onClick={handleOverlayClick}>
      <div className="prm-dialog">

        {/* Header */}
        <div className="prm-header">
          <div>
            <h2 className="prm-title">Group Pre-Registration</h2>
            <p className="prm-sub">Generate a link for visitors to self-register on their phones.</p>
          </div>
          <button className="prm-close" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>

        <div className="prm-body">
          {!linkData ? (
            <>
              {/* Step: generate link */}
              <div className="prm-steps">
                <div className="prm-step-item">
                  <span className="prm-step-num">1</span>
                  <span>Click <strong>Generate Link</strong> below</span>
                </div>
                <div className="prm-step-item">
                  <span className="prm-step-num">2</span>
                  <span>Share the URL or QR with the group (WhatsApp / print)</span>
                </div>
                <div className="prm-step-item">
                  <span className="prm-step-num">3</span>
                  <span>Each visitor fills the form &amp; gets their own QR code</span>
                </div>
                <div className="prm-step-item">
                  <span className="prm-step-num">4</span>
                  <span>At front desk: click <strong>Scan QR</strong> to check them in instantly</span>
                </div>
              </div>

              {error && <p className="prm-error">{error}</p>}

              <button
                className="prm-generate-btn"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? 'Generating…' : '✦ Generate Link'}
              </button>
            </>
          ) : (
            <>
              {/* Step: show link + QR */}
              <div className="prm-success-strip">
                <span className="prm-success-icon">✅</span>
                <div>
                  <p className="prm-success-title">Link generated for <strong>{linkData.locationName}</strong></p>
                  <p className="prm-success-exp">Expires: {expiryStr}</p>
                </div>
              </div>

              {/* QR code */}
              <div className="prm-qr-wrap">
                <canvas ref={qrRef} className="prm-qr-canvas" />
                <p className="prm-qr-hint">Visitors scan this QR code with their phone camera</p>
              </div>

              {/* Copyable URL */}
              <div className="prm-url-row">
                <input
                  className="prm-url-input"
                  type="text"
                  readOnly
                  value={linkData.url}
                  onFocus={(e) => e.target.select()}
                />
                <button className={`prm-copy-btn${copied ? ' prm-copy-btn--done' : ''}`} onClick={handleCopy}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <p className="prm-note">
                Share this URL via WhatsApp or display the QR code on screen.
                Visitors on the same network open the link on their phone and
                fill in their own details — each receives a unique QR code for check-in.
              </p>

              <button className="prm-generate-btn prm-generate-btn--outline" onClick={() => { setLinkData(null); setCopied(false); }}>
                Generate New Link
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
