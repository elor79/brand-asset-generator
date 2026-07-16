const PDF_MARK_DEFAULTS = {
  crop: true,
  bleed: false,
  registration: false,
  colourBar: false,
  pageInfo: false,
  offsetMm: 2.117,        // InDesign's default: 6pt
  weightPt: 0.25,
};
function pdfDrawMarks(pdf, {
  trimWmm, trimHmm, bleedMm, marks, rgb, pageLabel,
}) {
  if (!(bleedMm > 0)) return;   // nowhere to put them without bleed
  const m = { ...PDF_MARK_DEFAULTS, ...(marks || {}) };
  const [r, g, b] = rgb;
  pdf.setDrawColor(r, g, b);
  pdf.setLineWidth(Math.max(0.05, (m.weightPt || 0.25) / 72 * 25.4));

  const T = bleedMm, B = bleedMm + trimHmm;
  const L = bleedMm, R = bleedMm + trimWmm;

  // ── THE SPACE THAT EXISTS ─────────────────────────────────────────────────
  // The page is trim + 2 × bleed, so the room outside the trim is EXACTLY bleedMm.
  // A crop mark occupies off + len of it. I previously capped only the OFFSET and
  // left `len` free — the term that actually overflows. At a 3mm bleed that put
  // the mark 2.42mm off the page.
  //
  // This bug is invisible on screen: content outside the MediaBox is CLIPPED, so
  // the export looks perfect and the print is wrong. You find out from the printer.
  //
  // So: derive from the space, never from a wish. off + len === bleedMm, exactly,
  // at any bleed, for any offset.
  // NOTE the absence of a minimum length. My first fix wrote Math.max(0.6, …) —
  // a floor that protects the MARK at the page's expense, which is the same
  // mistake one size down: at a 1mm bleed it overflowed again. On a tiny bleed a
  // tiny mark is the correct answer. The page always wins.
  const offWanted = Math.max(0, m.offsetMm ?? 2.117);
  const off = Math.min(offWanted, bleedMm * 0.55);   // the mark keeps at least 45%
  const len = bleedMm - off;                          // …and gets exactly the rest

  if (m.crop) {
    pdf.line(L - len - off, T, L - off, T);  pdf.line(L, T - len - off, L, T - off);
    pdf.line(R + off, T, R + len + off, T);  pdf.line(R, T - len - off, R, T - off);
    pdf.line(L - len - off, B, L - off, B);  pdf.line(L, B + off, L, B + len + off);
    pdf.line(R + off, B, R + len + off, B);  pdf.line(R, B + off, R, B + len + off);
  }

  // Bleed marks sit AT the bleed edge — that is the whole point of them.
  if (m.bleed) {
    const bl = Math.min(3, bleedMm * 0.8);
    const bT = 0, bB = bleedMm * 2 + trimHmm, bL = 0, bR = bleedMm * 2 + trimWmm;
    pdf.line(bL, bT, bL + bl, bT);  pdf.line(bL, bT, bL, bT + bl);
    pdf.line(bR - bl, bT, bR, bT);  pdf.line(bR, bT, bR, bT + bl);
    pdf.line(bL, bB, bL + bl, bB);  pdf.line(bL, bB - bl, bL, bB);
    pdf.line(bR - bl, bB, bR, bB);  pdf.line(bR, bB - bl, bR, bB);
  }

  if (m.registration) {
    // The cross's ARMS reach rad × 1.7 from a centre at bleed × 0.5 — so the arms,
    // not the circle, are what must fit. rad = (0.5 / 1.7) × bleed puts the arm tip
    // exactly on the page edge; 0.28 keeps a hair inside it. Sizing this from the
    // circle (bleed × 0.5) put the tip 1.05mm off the page at EVERY bleed the
    // 2.5mm threshold below admits.
    const rad = Math.min(1.8, bleedMm * 0.28);
    const cross = (cx, cy) => {
      pdf.circle(cx, cy, rad, 'S');
      pdf.line(cx - rad * 1.7, cy, cx + rad * 1.7, cy);
      pdf.line(cx, cy - rad * 1.7, cx, cy + rad * 1.7);
    };
    if (bleedMm >= 2.5) {
      cross(bleedMm + trimWmm / 2, bleedMm * 0.5);
      cross(bleedMm + trimWmm / 2, bleedMm * 1.5 + trimHmm);
      cross(bleedMm * 0.5, bleedMm + trimHmm / 2);
      cross(bleedMm * 1.5 + trimWmm, bleedMm + trimHmm / 2);
    }
  }

  if (m.colourBar && bleedMm >= 2.5) {
    // A real density strip: process solids, then a grey ramp.
    const patches = [
      [0, 0, 0], [255, 255, 255], [128, 128, 128], [190, 190, 190],
      [0, 174, 239], [236, 0, 140], [255, 241, 0],
    ];
    const pw = Math.min(4, trimWmm / 14);
    const ph = Math.min(bleedMm * 0.6, 3);
    let x = bleedMm;
    const y = bleedMm * 1.5 + trimHmm - ph / 2;
    for (const p of patches) {
      pdf.setFillColor(p[0], p[1], p[2]);
      pdf.rect(x, y, pw, ph, 'F');
      x += pw;
    }
    pdf.setDrawColor(r, g, b);
  }

  if (m.pageInfo) {
    pdf.setFontSize(5);
    pdf.setTextColor(r, g, b);
    try { pdf.setFont('Inter', 'normal', 400); } catch { /* fonts not registered — use the default */ }
    const label = pageLabel || '';
    if (label && bleedMm >= 2) pdf.text(label, bleedMm, bleedMm * 0.55);
  }
}

const parsePageRange = (spec, count) => {
    const t = (spec || '').trim();
    if (!t) return Array.from({ length: count }, (_, i) => i);
    const out = new Set();
    for (const part of t.split(',')) {
      const m = part.trim().match(/^(\d+)\s*(?:-\s*(\d+))?$/);
      if (!m) continue;
      const a = Math.max(1, parseInt(m[1], 10));
      const b = m[2] ? Math.min(count, parseInt(m[2], 10)) : a;
      for (let i = a; i <= b && i <= count; i++) out.add(i - 1);
    }
    return out.size ? [...out].sort((x, y) => x - y) : Array.from({ length: count }, (_, i) => i);
  };
export { pdfDrawMarks, PDF_MARK_DEFAULTS, parsePageRange };