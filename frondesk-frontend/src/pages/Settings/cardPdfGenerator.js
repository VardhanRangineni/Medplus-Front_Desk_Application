/**
 * cardPdfGenerator.js
 *
 * Generates print-ready PVC visitor ID cards using jsPDF.
 *
 * Page size  : CR80 — 85.6 × 54 mm (exact physical card size, 1 card per page)
 * Design     : Clean full-width corporate layout — red header + slim left strip,
 *              prominent card-number box, branch name, and branded footer.
 *
 * Print note : Print at 100% / Actual Size — no scaling.
 */

import { jsPDF } from 'jspdf';
import logoUrl  from '../../assets/images/logo.png';

// ── Card dimensions (CR80) ────────────────────────────────────────────────────
const W = 85.6;
const H = 54;

// ── Layout zones ──────────────────────────────────────────────────────────────
const HDR_H = 14;    // red header height
const FTR_H =  9;    // footer strip height
const STRIP =  3;    // slim red left strip (below header)
const PAD   =  5;    // padding from strip edge to text
const TX    = STRIP + PAD;  // x where body text starts (8 mm from left)

// ── MedPlus brand colours ─────────────────────────────────────────────────────
const C = {
  red:      [198,  40,  40],
  redDark:  [158,  20,  20],
  redLight: [255, 245, 245],
  navy:     [ 13,  71, 161],
  dark:     [ 33,  33,  33],
  label:    [130, 130, 130],
  ftrBg:    [245, 245, 245],
  ftrText:  [110, 110, 110],
  wm:       [236, 236, 236],
  codeBox:  [255, 248, 248],
  codeBdr:  [210, 170, 170],
  white:    [255, 255, 255],
  border:   [190, 190, 190],
  divider:  [220, 220, 220],
};

// ── Load image → base64 data URL (async) ──────────────────────────────────────
function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = src;
  });
}

// ── Draw one PVC card ─────────────────────────────────────────────────────────
function drawPvcCard(doc, cardCode, locationName, logoData) {

  // ── 1. White card base ──────────────────────────────────────────────────────
  doc.setFillColor(...C.white);
  doc.rect(0, 0, W, H, 'F');

  // ── 2. Red header (full width) ──────────────────────────────────────────────
  doc.setFillColor(...C.red);
  doc.rect(0, 0, W, HDR_H, 'F');
  // Thin shadow under header
  doc.setFillColor(...C.redDark);
  doc.rect(0, HDR_H - 0.7, W, 0.7, 'F');

  // ── 3. Slim red left strip (content area only) ──────────────────────────────
  doc.setFillColor(...C.red);
  doc.rect(0, HDR_H, STRIP, H - HDR_H - FTR_H, 'F');

  // ── 4. Logo — white rounded badge inside header ─────────────────────────────
  const LOGO  = 9.5;
  const LX    = 2.5;
  const LY    = (HDR_H - LOGO) / 2;

  doc.setFillColor(...C.white);
  doc.roundedRect(LX - 0.5, LY - 0.5, LOGO + 1, LOGO + 1, 1.5, 1.5, 'F');
  if (logoData) {
    doc.addImage(logoData, 'PNG', LX, LY, LOGO, LOGO);
  }

  // ── 5. Brand name & sub-title ───────────────────────────────────────────────
  const BX   = LX + LOGO + 3;
  const MIDY = HDR_H / 2;

  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text('MedPlus', BX, MIDY + 1.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.text('H E A L T H C A R E', BX, MIDY + 6.2);

  // ── 6. "VISITOR / PASS" — right of header ──────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('VISITOR', W - 4, MIDY + 1.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('P  A  S  S', W - 4, MIDY + 6.2, { align: 'right' });

  // ── 7. Watermark (behind content, very light) ───────────────────────────────
  doc.setTextColor(...C.wm);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.text('VISITOR', W / 2 + 2, H / 2 + 5, { align: 'center', angle: -12 });

  // ── 8. "CARD NUMBER" label ──────────────────────────────────────────────────
  const CONTENT_Y = HDR_H + 5;

  doc.setTextColor(...C.label);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.text('C A R D  N U M B E R', TX, CONTENT_Y);

  // ── 9. Card-code box ────────────────────────────────────────────────────────
  const BOX_X = TX;
  const BOX_Y = CONTENT_Y + 2.5;
  const BOX_W = W - TX - 4;
  const BOX_H = 11.5;

  // Light red background + border
  doc.setFillColor(...C.codeBox);
  doc.setDrawColor(...C.codeBdr);
  doc.setLineWidth(0.3);
  doc.roundedRect(BOX_X, BOX_Y, BOX_W, BOX_H, 1.5, 1.5, 'FD');

  // Red left accent stripe inside box
  doc.setFillColor(...C.red);
  doc.roundedRect(BOX_X, BOX_Y, 2.5, BOX_H, 1, 1, 'F');
  doc.rect(BOX_X + 1.25, BOX_Y, 1.25, BOX_H, 'F');   // square off right side

  // Code text — auto font-size by length
  const codeLen = cardCode.length;
  const codeFz  = codeLen <= 14 ? 13.5
                : codeLen <= 18 ? 11.5
                : codeLen <= 22 ? 10
                :                  8.5;

  doc.setTextColor(...C.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(codeFz);
  doc.text(
    cardCode,
    BOX_X + 2.5 + (BOX_W - 2.5) / 2,
    BOX_Y + BOX_H / 2 + codeFz * 0.19,
    { align: 'center' },
  );

  // ── 10. Thin divider line under box ────────────────────────────────────────
  const DIV_Y = BOX_Y + BOX_H + 3;
  doc.setDrawColor(...C.divider);
  doc.setLineWidth(0.2);
  doc.line(TX, DIV_Y, W - 4, DIV_Y);

  // ── 11. "BRANCH" label + name ──────────────────────────────────────────────
  const BRANCH_Y = DIV_Y + 3.5;

  doc.setTextColor(...C.label);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.text('B R A N C H', TX, BRANCH_Y);

  const branchText = locationName.length > 38
    ? locationName.slice(0, 36) + '…'
    : locationName;
  doc.setTextColor(...C.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(branchText, TX, BRANCH_Y + 4.5);

  // ── 12. Footer ──────────────────────────────────────────────────────────────
  doc.setFillColor(...C.ftrBg);
  doc.rect(0, H - FTR_H, W, FTR_H, 'F');
  doc.setDrawColor(...C.divider);
  doc.setLineWidth(0.2);
  doc.line(0, H - FTR_H, W, H - FTR_H);

  // Red dot accent
  doc.setFillColor(...C.red);
  doc.circle(STRIP + 2.5, H - FTR_H + FTR_H / 2, 0.9, 'F');

  doc.setTextColor(...C.ftrText);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.2);
  doc.text('Property of MedPlus Healthcare', STRIP + 5, H - FTR_H + 3.4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.8);
  doc.text('Return after use  ·  Not transferable', STRIP + 5, H - FTR_H + 7);

  // ── 13. Outer border (cut guide) ───────────────────────────────────────────
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.35);
  doc.rect(0, 0, W, H, 'D');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generates a print-ready PVC visitor-card PDF (async — loads logo first).
 * Each page = one CR80 card (85.6 × 54 mm). Print at 100 % / Actual Size.
 *
 * @param {string[]} cardCodes    e.g. ["MSOH-VISITOR-1", ...]
 * @param {string}   locationName e.g. "Medplus Osmania Hospital"
 */
export async function generateCardsPdf(cardCodes, locationName) {
  let logoData = null;
  try {
    logoData = await loadImg(logoUrl);
  } catch {
    // Logo failed to load — cards render without it (graceful fallback)
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit:        'mm',
    format:      [W, H],   // W=85.6 > H=54 → landscape keeps 85.6 wide × 54 tall
  });

  for (let i = 0; i < cardCodes.length; i++) {
    if (i > 0) doc.addPage([W, H], 'landscape');
    drawPvcCard(doc, cardCodes[i], locationName, logoData);
  }

  const safeName = locationName.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
  doc.save(`${safeName}_VisitorCards.pdf`);
}
