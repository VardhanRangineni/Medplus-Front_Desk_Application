const BRAND = '#c2181d';
const BRAND_DARK = '#9e1418';
const BRAND_LIGHT = '#b9151a';
const TEXT = '#0f172a';
const TEXT_MUTED = '#64748b';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawBadge(ctx, text, x, y, { font, padX = 12, h = 24, bg, color } = {}) {
  ctx.font = font || '600 11px system-ui, "Segoe UI", sans-serif';
  const textW = ctx.measureText(text).width;
  const w = textW + padX * 2;
  ctx.fillStyle = bg || 'rgba(255,255,255,0.18)';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = color || '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padX, y + h / 2);
  ctx.textBaseline = 'alphabetic';
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Composes a branded visit-card PNG with QR, visitor name, and reference.
 */
export async function buildVisitCardDataUrl({ qrDataUrl, name, token }) {
  const W = 420;
  const H = 640;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#e8ecf2';
  ctx.fillRect(0, 0, W, H);

  const cardX = 20;
  const cardY = 20;
  const cardW = W - 40;
  const cardH = H - 40;

  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, 18);
  ctx.shadowColor = 'rgba(15, 23, 42, 0.14)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  const headerH = 108;
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, 18);
  ctx.clip();
  const grad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + headerH);
  grad.addColorStop(0, BRAND_LIGHT);
  grad.addColorStop(0.5, BRAND);
  grad.addColorStop(1, '#d42a2f');
  ctx.fillStyle = grad;
  ctx.fillRect(cardX, cardY, cardW, headerH);

  drawBadge(ctx, 'MVMS · RECEPTION CHECK-IN', cardX + 24, cardY + 22);

  ctx.font = '800 30px system-ui, "Segoe UI", sans-serif';
  ctx.fillText('MedPlus', cardX + 24, cardY + 78);

  ctx.font = '500 13px system-ui, "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText('Visitor Pass', cardX + 24, cardY + 98);
  ctx.restore();

  const qrSize = 220;
  const qrX = cardX + (cardW - qrSize) / 2;
  const qrY = cardY + headerH + 36;

  ctx.fillStyle = '#f8fafc';
  roundRect(ctx, qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 14);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  roundRect(ctx, qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 14);
  ctx.stroke();

  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  const displayName = (name || 'Visitor').trim();
  const shortRef = (token || '').slice(0, 8).toUpperCase();

  let y = qrY + qrSize + 44;
  ctx.textAlign = 'center';
  ctx.fillStyle = TEXT_MUTED;
  ctx.font = '600 11px system-ui, "Segoe UI", sans-serif';
  ctx.fillText('VISITOR', cardX + cardW / 2, y);

  y += 28;
  ctx.fillStyle = TEXT;
  ctx.font = '700 22px system-ui, "Segoe UI", sans-serif';
  const nameLines = wrapText(ctx, displayName, cardW - 48);
  for (const line of nameLines.slice(0, 2)) {
    ctx.fillText(line, cardX + cardW / 2, y);
    y += 28;
  }

  y += 8;
  ctx.fillStyle = '#f1f5f9';
  const refW = Math.min(cardW - 48, 280);
  const refX = cardX + (cardW - refW) / 2;
  roundRect(ctx, refX, y - 18, refW, 36, 8);
  ctx.fill();
  ctx.fillStyle = TEXT_MUTED;
  ctx.font = '500 12px ui-monospace, Consolas, monospace';
  ctx.fillText(`Ref · ${shortRef}`, cardX + cardW / 2, y + 6);

  y += 52;
  ctx.fillStyle = TEXT_MUTED;
  ctx.font = '500 13px system-ui, "Segoe UI", sans-serif';
  const hintLines = wrapText(ctx, 'Show this card at MedPlus reception when you arrive.', cardW - 56);
  for (const line of hintLines) {
    ctx.fillText(line, cardX + cardW / 2, y);
    y += 20;
  }

  ctx.strokeStyle = BRAND;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cardX + 48, cardY + cardH - 28);
  ctx.lineTo(cardX + cardW - 48, cardY + cardH - 28);
  ctx.stroke();

  ctx.fillStyle = BRAND_DARK;
  ctx.font = '700 11px system-ui, "Segoe UI", sans-serif';
  ctx.fillText('SCAN AT RECEPTION', cardX + cardW / 2, cardY + cardH - 10);

  return canvas.toDataURL('image/png');
}

export function visitCardFilename(token) {
  const shortRef = (token || 'card').slice(0, 8);
  return `MedPlus-VisitCard-${shortRef}.png`;
}
