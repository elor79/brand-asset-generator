// ─────────────────────────────────────────────────────────────────────────────
// THE SUB-BRAND ROW — medartis · NeoOrtho · KeriMedical
// ─────────────────────────────────────────────────────────────────────────────
// Three logotypes side by side, and the whole problem is that they are not the
// same shape. Measured from the real artwork:
//
//     medartis      AR 7.59  (a long, low wordmark)
//     NeoOrtho      AR 4.23
//     KeriMedical   AR 2.58  (nearly three times as tall, proportionally)
//
// SIZE THEM BY HEIGHT AND KERIMEDICAL LOOKS ENORMOUS. Size them by width and
// medartis becomes a hairline. Neither is "equal", which is what the family row is
// supposed to express.
//
// So they are matched on OPTICAL AREA: each mark is scaled so its glyph covers the
// same area, then the row is centred on a shared optical axis. That is the standard
// answer for a logo row of mixed aspect, and unlike height-matching it survives a
// sub-brand redrawing its mark.
//
// WHAT THIS FILE DELIBERATELY DOES NOT INHERIT
// IBRA's drawCoBrandLockup sizes its marks with `size: partners.size ?? 0.78` — a
// fraction of the CANVAS, not of the row. That is why its sponsor strip draws the
// medartis wordmark at the wrong scale: the default is a magic number tuned for one
// format and silently wrong on every other. Porting it would import the bug along
// with the feature. Everything here is relative to the row box it is given.

import { GROUP_MARK, NEOORTHO_MARK, KERIMEDICAL_MARK, SUB_BRANDS, markMetrics } from './groupBrands.js';

/** The house wordmark is supplied by the engine (it already owns medartis). */
export const FAMILY_ORDER = ['medartis', 'neoortho', 'kerimedical'];

export const MARK_BY_KEY = {
  neoortho: NEOORTHO_MARK,
  kerimedical: KERIMEDICAL_MARK,
  group: GROUP_MARK,
};

/**
 * Lay out a row of marks inside (x, y, w, h), area-matched and optically centred.
 *
 * `gapRatio` is a fraction of the ROW HEIGHT, not the canvas — a gap that grows with
 * the canvas is how logo rows end up with a metre of air between them on a poster.
 *
 * Returns one rect per mark, with the scale needed to draw its viewBox into it.
 * Nothing is drawn here: geometry is testable, canvas calls are not.
 */
export function familyRow(marks, { x, y, w, h, gapRatio = 0.9, align = 'center' }) {
  const items = marks.filter(Boolean);
  if (!items.length) return [];

  const aspects = items.map((m) => m.glyph.w / m.glyph.h);
  const n = items.length;

  // Area matching: width_i = u·√(a_i) and height_i = u/√(a_i), so every mark's
  // area is u² regardless of aspect. One unknown, u, for the whole row.
  const sumSqrt = aspects.reduce((s, a) => s + Math.sqrt(a), 0);
  const meanInvSqrt = aspects.reduce((s, a) => s + 1 / Math.sqrt(a), 0) / n;

  // The gap is a fraction of the marks' own drawn height — NOT of the box.
  //
  // Sizing the gap off the box height looks fine on a wide strip and destroys a
  // square: a 600×600 box asks for 540px of gap, the row has −480px left for
  // artwork, and the function returns nothing. (It did exactly that.) It is the
  // same error as clamping a lanyard's axes independently — a measurement taken
  // from the container instead of from the content.
  //
  // gap = gapRatio · (mean drawn height) = gapRatio · u · meanInvSqrt, which keeps
  // u linear, so the row still solves in closed form:
  //     u·sumSqrt + (n−1)·gapRatio·u·meanInvSqrt = w
  let u = w / (sumSqrt + (n - 1) * gapRatio * meanInvSqrt);
  if (!(u > 0)) return [];

  // Height must bind too: the tallest mark is u/√(a_min).
  const tallest = u * Math.max(...aspects.map((a) => 1 / Math.sqrt(a)));
  if (tallest > h) u *= h / tallest;

  const gap = gapRatio * u * meanInvSqrt;
  const widths = aspects.map((a) => u * Math.sqrt(a));
  const heights = aspects.map((a) => u / Math.sqrt(a));
  const rowW = widths.reduce((s, v) => s + v, 0) + gap * (n - 1);
  let cx = align === 'left' ? x : align === 'right' ? x + w - rowW : x + (w - rowW) / 2;

  return items.map((m, i) => {
    const rect = {
      mark: m,
      glyph: m.glyph,
      paths: m.paths,
      x: cx,
      // Optical centring: the glyphs share a centre line, not a baseline — with
      // aspects this different a shared baseline visually drops the wide marks.
      y: y + (h - heights[i]) / 2,
      w: widths[i],
      h: heights[i],
      // viewBox → rect. The glyph is inset within the viewBox, so the draw transform
      // must account for that offset or the mark sits off-centre in its own box.
      scale: widths[i] / m.glyph.w,
      offsetX: -m.glyph.x * (widths[i] / m.glyph.w),
      offsetY: -m.glyph.y * (heights[i] / m.glyph.h),
    };
    cx += widths[i] + gap;
    return rect;
  });
}

/**
 * Endorsement: a sub-brand leads, the Group mark sits under it at a fixed ratio.
 * The Group mark is SUBORDINATE here — that is the whole point of endorsement — so
 * it is capped, never matched.
 */
export const ENDORSE_RATIO = 0.42;   // Group mark height ÷ lead mark height

export function endorsedLockup(leadMark, { x, y, w, h }) {
  const leadA = leadMark.glyph.w / leadMark.glyph.h;
  const groupA = GROUP_MARK.glyph.w / GROUP_MARK.glyph.h;
  const gapY = h * 0.18;
  // Solve so lead + gap + endorsement fills h, with the endorsement at ENDORSE_RATIO.
  const leadH = (h - gapY) / (1 + ENDORSE_RATIO);
  const groupH = leadH * ENDORSE_RATIO;
  const fit = (aspect, hh) => Math.min(hh * aspect, w);
  return [
    { mark: leadMark, x: x + (w - fit(leadA, leadH)) / 2, y, w: fit(leadA, leadH), h: leadH, role: 'lead' },
    { mark: GROUP_MARK, x: x + (w - fit(groupA, groupH)) / 2, y: y + leadH + gapY, w: fit(groupA, groupH), h: groupH, role: 'endorsement' },
  ];
}

export function subBrandLabel(key) {
  return SUB_BRANDS[key]?.label || key;
}


// ─────────────────────────────────────────────────────────────────────────────
// THE CO-BRAND ROW, SET LIKE TYPE
// ─────────────────────────────────────────────────────────────────────────────
// familyRow above matches optical AREA and centres each mark on its own centre
// line. That is a reasonable rule for marks of unknown shape, and it is the wrong
// rule for these: they are WORDMARKS. Area-matching left them standing at three
// different heights, because a bounding box does not know where the baseline is —
// KeriMedical's box is 130 tall and its letters are 41, so matched by box it
// shrinks and floats.
//
// A designer sets a row of wordmarks by matching the letterforms and standing them
// on one line. So:
//
//   width_i = cap x widthPerCap_i          (one cap height for the whole row)
//   baseline shared; ascenders rise and descenders hang from it
//
// The gap is a multiple of the CAP height — the size of the letters, which is what
// the space between them should relate to. Not the canvas, not the box, and not the
// bounding boxes (which for KeriMedical would measure mostly empty stroke).
//
// Solves in closed form, so no iteration and no failure mode where the row gives up:
//   cap x SUM(widthPerCap) + gapRatio x cap x (n-1) = boxW
export function baselineRow(marks, { x, y, w, h, gapRatio = 2.6, align = 'center', withByline = false }) {
  const items = (marks || []).filter(Boolean).map((m) => ({
    mark: m,
    ...markMetrics(m.__metricsFrom || m, withByline),
  }));
  if (!items.length || w <= 0 || h <= 0) return [];
  const n = items.length;

  const sumWPC = items.reduce((s, m) => s + m.widthPerCap, 0);
  let cap = w / (sumWPC + gapRatio * (n - 1));
  if (!(cap > 0)) return [];

  // Height binds too: the row occupies the tallest ascent plus the deepest descent,
  // both measured from the SHARED baseline — not the sum of individual box heights.
  const ascent = () => Math.max(...items.map((m) => m.above / m.cap)) * cap;
  const descent = () => Math.max(...items.map((m) => m.below / m.cap)) * cap;
  const need = ascent() + descent();
  if (need > h) cap *= h / need;

  const gap = gapRatio * cap;
  const widths = items.map((m) => m.widthPerCap * cap);
  const rowW = widths.reduce((s, v) => s + v, 0) + gap * (n - 1);
  const baselineY = y + (h - (ascent() + descent())) / 2 + ascent();

  let cx = align === 'left' ? x : align === 'right' ? x + w - rowW : x + (w - rowW) / 2;
  return items.map((m, i) => {
    const s = cap / m.cap;                      // viewBox → canvas
    const rect = {
      mark: m.mark,
      paths: m.paths,
      // The glyph the row actually SIZED against. The caller must scale by this and
      // not by mark.glyph: with the byline on, the two differ, and the draw would
      // squash the mark by the byline's share of the height while claiming to be
      // uniform.
      glyph: m.glyph,
      x: cx,
      y: baselineY - m.above * s,               // the glyph top, derived from the baseline
      w: widths[i],
      h: (m.above + m.below) * s,
      baselineY,
      cap,
      scale: s,
      // viewBox → rect. The glyph is inset in the viewBox, so the transform must
      // subtract that offset or the mark sits off-centre inside its own box.
      offsetX: -m.glyph.x * s,
      offsetY: -m.glyph.y * s,
    };
    cx += widths[i] + gap;
    return rect;
  });
}
