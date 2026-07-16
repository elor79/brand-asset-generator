// ─────────────────────────────────────────────────────────────────────────────
// GRADIENT — one model, one maths, three renderers
// ─────────────────────────────────────────────────────────────────────────────
// The canvas, the dithered raster export and the SVG export each used to
// interpolate their own way, so "the same" gradient could differ between the
// thing you composed, the thing you exported and the thing a designer opened.
// They all read this now.
//
// The model is deliberately as expressive as a real design tool's gradient:
//
//   from, to     the two colours (any hex — the brand check judges the pair)
//   angle        0–359°, 0° = left→right, 90° = top→bottom (y grows down)
//   type         linear | radial
//   start, end   where the ramp begins/finishes along the axis (0–1). Pull them
//                in and you get flat colour at each end with the transition
//                compressed between — how you keep a headline off the busy part.
//   midpoint     where the 50/50 blend lands (0–1). 0.5 = even.
//   easing       smooth (S-curve) | linear (constant rate)
//   cx, cy, r    radial centre + radius, as fractions of the canvas
//
// Guide §02 fixes the PAIR (navy origin, never reversed) — not the geometry.
// So the geometry is yours; the brand check has an opinion about the colours.

export const DEFAULT_GRADIENT = {
  // Coal → KeriMedical's own deep blue. See GROUP_GRADIENTS in groupBrands.js for
  // why these two, and where every other pair comes from.
  from: '#131310',
  to: '#001A72',
  angle: 0,
  type: 'linear',
  start: 0,
  end: 1,
  midpoint: 0.5,
  easing: 'smooth',
  cx: 0.5,
  cy: 0.5,
  r: 0.7,
};

// The gradient PRESETS live in groupBrands.js, not here.
//
// This file is the ENGINE — ramp, easing, axis, three renderers — and it has no
// business knowing which colours are sanctioned. Medartis Group's gradients are
// DERIVED from the sub-brands' own hexes (see GROUP_GRADIENTS), so hard-coding a
// list here would be a second source of truth that drifts the day a sub-brand
// updates its palette.
// Named angles, kept so the UI can offer one-click classics alongside the dial.
export const ANGLE_PRESETS = {
  horizontal: { label: '→', angle: 0 },
  diagonal:   { label: '↘', angle: 45 },
  vertical:   { label: '↓', angle: 90 },
  diagonalUp: { label: '↗', angle: 315 },
};

export const hexToRgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The heart of it: raw axis position t (0–1) → eased ramp position (0–1),
 * honouring start/end, midpoint and easing. Every renderer calls this, so they
 * cannot drift apart.
 */
export function rampAt(g, t) {
  const start = g.start ?? 0;
  const end = g.end ?? 1;
  // Outside the band the colour is flat — that is the point of start/end.
  if (end <= start) return t < start ? 0 : 1;
  let u = clamp01((t - start) / (end - start));

  // Midpoint bias, the way a design tool's diamond handle behaves: pick the
  // exponent that maps u = midpoint exactly onto 0.5.
  const m = Math.min(0.99, Math.max(0.01, g.midpoint ?? 0.5));
  if (Math.abs(m - 0.5) > 1e-4) u = Math.pow(u, Math.log(0.5) / Math.log(m));

  // Smoothstep: two saturated brand colours meeting on a linear ramp show a
  // visible seam in the middle. The S-curve eases that; 'linear' keeps a
  // constant rate, which is what you want for a technical/measured look.
  return (g.easing ?? 'smooth') === 'linear' ? u : u * u * (3 - 2 * u);
}

/**
 * The colours this gradient runs through, in order.
 *
 * `from`/`to` is the two-stop shorthand and stays the common case — most brand
 * ramps are two colours and writing them as a one-element-longer array helps
 * nobody. `stops` is for the ones that are not: black → violet → teal → blue is a
 * real gradient in the guide and cannot be said with two ends.
 *
 * Both forms resolve here, so every renderer downstream — canvas, SVG, PDF, the
 * contrast sampler — sees one shape and cannot disagree about which it got.
 */
export function stopColors(g) {
  if (g.stops?.length >= 2) return g.stops.map(hexToRgb);
  const a = hexToRgb(g.from);
  return [a, g.to ? hexToRgb(g.to) : a];
}

/** The colour at raw axis position t, as [r,g,b] floats (no rounding). */
export function colorAt(g, t) {
  const cols = stopColors(g);
  const s = rampAt(g, t);
  // The eased position walks the WHOLE ramp, then picks its segment. Easing per
  // segment would put a soft landing at every stop and make a four-colour ramp
  // read as three gradients glued together.
  const seg = s * (cols.length - 1);
  const i = Math.max(0, Math.min(cols.length - 2, Math.floor(seg)));
  const f = seg - i;
  const [r0, g0, b0] = cols[i];
  const [r1, g1, b1] = cols[i + 1];
  return [r0 + (r1 - r0) * f, g0 + (g1 - g0) * f, b0 + (b1 - b0) * f];
}

/**
 * Sample the ramp into discrete stops — for canvas's addColorStop and for SVG,
 * neither of which can express an easing curve. 24 is plenty: the eye cannot
 * see the difference, and the dithered raster path doesn't use stops at all.
 */
export function gradientStops(g, n = 24) {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const [r, gg, b] = colorAt(g, t);
    return { offset: t, color: rgbToHex(r, gg, b) };
  });
}

/**
 * The gradient's axis across a rect, for an arbitrary angle. Projects the rect
 * onto the axis so the ramp always spans the whole shape, whatever the angle.
 */
export function axisFor(g, x, y, w, h) {
  const rad = ((g.angle ?? 0) * Math.PI) / 180;
  const dx = Math.cos(rad), dy = Math.sin(rad);
  const cx = x + w / 2, cy = y + h / 2;
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  return {
    x0: cx - dx * half, y0: cy - dy * half,
    x1: cx + dx * half, y1: cy + dy * half,
    dx, dy, cx, cy, half,
  };
}

/** Raw axis position of a pixel — the inverse of axisFor, per pixel. */
export function tAt(g, px, py, x, y, w, h) {
  if (g.type === 'radial') {
    const cx = x + (g.cx ?? 0.5) * w;
    const cy = y + (g.cy ?? 0.5) * h;
    const maxR = Math.hypot(w, h) * (g.r ?? 0.7);
    return maxR <= 0 ? 0 : clamp01(Math.hypot(px - cx, py - cy) / maxR);
  }
  const a = axisFor(g, x, y, w, h);
  if (a.half <= 0) return 0;
  return clamp01(((px - a.cx) * a.dx + (py - a.cy) * a.dy) / (2 * a.half) + 0.5);
}

/** Set ctx.fillStyle to this gradient over the given rect. */
export function applyCanvasGradient(ctx, g, x, y, w, h) {
  let grad;
  if (g.type === 'radial') {
    const cx = x + (g.cx ?? 0.5) * w;
    const cy = y + (g.cy ?? 0.5) * h;
    grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(w, h) * (g.r ?? 0.7));
  } else {
    const a = axisFor(g, x, y, w, h);
    grad = ctx.createLinearGradient(a.x0, a.y0, a.x1, a.y1);
  }
  for (const s of gradientStops(g)) grad.addColorStop(s.offset, s.color);
  ctx.fillStyle = grad;
  return grad;
}

/** <defs> + fill for an SVG export. */
export function gradientToSvgDefs(g, id = 'g') {
  const stops = gradientStops(g, 16)
    .map((s) => `      <stop offset="${(s.offset * 100).toFixed(1)}%" stop-color="${s.color}"/>`)
    .join('\n');
  if (g.type === 'radial') {
    return `<radialGradient id="${id}" cx="${(g.cx ?? 0.5) * 100}%" cy="${(g.cy ?? 0.5) * 100}%" r="${(g.r ?? 0.7) * 100}%">
${stops}
    </radialGradient>`;
  }
  // gradientTransform rotates about the unit square's centre; our angle is
  // measured the same way (0 = left→right, clockwise, y down).
  return `<linearGradient id="${id}" gradientTransform="rotate(${g.angle ?? 0} 0.5 0.5)">
${stops}
    </linearGradient>`;
}

/** Human summary for the UI — "navy → amazonite · 45° · eased". */
export function describeGradient(g) {
  const bits = [];
  if (g.stops?.length > 2) bits.push(`${g.stops.length} stops`);
  bits.push(g.type === 'radial' ? 'radial' : `${Math.round(g.angle ?? 0)}°`);
  if ((g.start ?? 0) > 0.01 || (g.end ?? 1) < 0.99) {
    bits.push(`band ${Math.round((g.start ?? 0) * 100)}–${Math.round((g.end ?? 1) * 100)}%`);
  }
  if (Math.abs((g.midpoint ?? 0.5) - 0.5) > 0.01) bits.push(`mid ${Math.round((g.midpoint ?? 0.5) * 100)}%`);
  bits.push((g.easing ?? 'smooth') === 'linear' ? 'linear' : 'eased');
  return bits.join(' · ');
}
