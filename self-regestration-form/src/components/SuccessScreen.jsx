import { useEffect, useRef, useState } from 'react';
import { buildVisitCardDataUrl, visitCardFilename } from '../utils/visitCardImage';

function downloadBtnLabel() {
  return (
    <>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Download visit card
    </>
  );
}

export default function SuccessScreen({ name, token }) {
  const qrRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    if (!qrRef.current || !token || !window.QRCode) return;
    qrRef.current.innerHTML = '';
    // eslint-disable-next-line no-new
    new window.QRCode(qrRef.current, {
      text: `PREREG:${token}`,
      width: 200,
      height: 200,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: window.QRCode.CorrectLevel.M,
    });
  }, [token]);

  function getQrImageDataUrl() {
    if (!qrRef.current) return null;
    const canvas = qrRef.current.querySelector('canvas');
    if (canvas) return canvas.toDataURL('image/png');
    const img = qrRef.current.querySelector('img');
    if (!img) return null;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/png');
  }

  async function handleDownload() {
    setDownloadError('');
    setDownloading(true);

    try {
      const qrDataUrl = getQrImageDataUrl();
      if (!qrDataUrl) {
        setDownloadError('QR image is not ready yet. Please try again in a moment.');
        return;
      }

      const dataUrl = await buildVisitCardDataUrl({ qrDataUrl, name, token });
      const filename = visitCardFilename(token);

      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'MedPlus visit card',
            text: 'Save this visit card for MVMS reception check-in.',
          });
          return;
        }
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setDownloadError('Could not prepare visit card. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="success">
      <div className="success__icon" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      <h3 className="success__title">You&apos;re registered</h3>
      <p className="success__sub">
        Hi <strong>{name}</strong>, your visit is confirmed.
        <br />
        Show this QR code at MedPlus reception (MVMS) when you arrive.
      </p>
      <div className="qr-frame">
        <div ref={qrRef} id="qrcode-container" />
      </div>
      {downloadError && <div className="banner" role="alert">{downloadError}</div>}
      <div className="qr-actions">
        <button
          type="button"
          className="download-btn"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? 'Preparing…' : downloadBtnLabel()}
        </button>
      </div>
      <p className="qr-hint">Download your visit card — save it on your phone for reception check-in.</p>
      <div className="token-pill">
        Reference: <strong>{token}</strong>
      </div>
    </div>
  );
}
