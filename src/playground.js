// ─────────────────────────────────────────────────────────────────────────────
// GEOMETRIC PLAYGROUND — the effect engine
// ─────────────────────────────────────────────────────────────────────────────
// A luminance field sampled from an image, and a stack of effect LAYERS composited
// onto a canvas. Everything here is a pure function of (ctx, field, params) — no
// React, no DOM state — so effects are testable in isolation and the view stays a
// thin shell that just holds the layer list and drives the compositor.
//
// A layer is { id, type, enabled, opacity, blend, params }. The compositor walks
// the stack bottom-to-top, setting globalAlpha + globalCompositeOperation per layer,
// so "several effects applied together" is just a list with blend modes — no
// per-effect special-casing in the view.

export const BLEND_MODES = [
  ['source-over', 'Normal'],
  ['screen', 'Screen'],
  ['lighter', 'Add'],       // additive — the bloom mode for glow/particles
  ['multiply', 'Multiply'],
  ['overlay', 'Overlay'],
];

// Effect-only accents. The playground is § 99 (experimental), so it may reach past
// the strict brand palette — but the defaults still lean on the brand's gold, with a
// cool steel tone for contrast, exactly the gold/blue split in the reference image.
export const PLAY_COLORS = {
  gold: '#CFAB5C',
  goldDeep: '#8A6828',
  steel: '#7FA8C9',
  warm: '#FAF8F0',
  coal: '#131310',
  ink: '#1d1d1b',
  bone: '#F4F2EA',
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (h1, h2, t) => {
  const a = hexRgb(h1), b = hexRgb(h2);
  return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t)).toString()).join(',')})`;
};

// ─── Luminance sampling ──────────────────────────────────────────────────────
// One shared field, computed once from the downscaled imageData, reused by every
// effect. `grid` keeps ALL cells (for halftone/contour, which want a dense map);
// `points` is the thresholded, spaced, radius-weighted subset (for network/shapes).

export function sampleField(imageData, W, H, { blockSize = 28, threshold = 44, minDistance = 30, maxCount = 220, minRadius = 13, maxRadius = 36 } = {}) {
  if (!imageData) return { grid: [], points: [], cols: 0, rows: 0, cell: 1 };
  const { data, width, height } = imageData;
  const ab = Math.max(4, Math.round(blockSize * (width / W)));
  const grid = [];
  let cols = 0, rows = 0;
  for (let y = 0; y < height; y += ab) {
    cols = 0;
    for (let x = 0; x < width; x += ab) {
      let sum = 0, n = 0, minL = 255, maxL = 0;
      for (let by = 0; by < ab && y + by < height; by += 2) {
        for (let bx = 0; bx < ab && x + bx < width; bx += 2) {
          const idx = ((y + by) * width + (x + bx)) * 4;
          const l = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          sum += l; if (l < minL) minL = l; if (l > maxL) maxL = l; n++;
        }
      }
      if (!n) continue;
      const avg = sum / n;
      grid.push({ gx: cols, gy: rows, x: (x + ab / 2) * (W / width), y: (y + ab / 2) * (H / height), lum: avg / 255, contrast: (maxL - minL) / 255 });
      cols++;
    }
    rows++;
  }
  // The thresholded, spaced subset for shape/network effects.
  const scored = grid
    .map((g) => ({ ...g, score: (g.lum * 0.5 + g.contrast * 0.5) * 255 }))
    .filter((g) => g.score >= threshold)
    .sort((a, b) => b.score - a.score);
  const points = [];
  for (const p of scored) {
    if (points.length >= maxCount) break;
    if (points.every((q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2 >= minDistance * minDistance)) points.push(p);
  }
  const maxScore = Math.max(...points.map((p) => p.score), 1);
  points.forEach((p) => { p.r = minRadius + (maxRadius - minRadius) * (p.score / maxScore); });
  return { grid, points, cols, rows, cell: ab * (W / width) };
}

// Local-contrast (edge) map — high where the image changes fast, which is exactly
// where facial features live: the outlines of eyes, nose, mouth, jaw. Normalised
// 0..1. Cheap central-difference gradient, computed once per image.
export function computeEdgeMap(imageData) {
  if (!imageData) return null;
  const { data, width, height } = imageData;
  const lum = new Float32Array(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) lum[j] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
  const edge = new Float32Array(width * height);
  let max = 1e-6;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const j = y * width + x;
      const gx = lum[j + 1] - lum[j - 1];
      const gy = lum[j + width] - lum[j - width];
      const m = Math.sqrt(gx * gx + gy * gy);
      edge[j] = m; if (m > max) max = m;
    }
  }
  for (let i = 0; i < edge.length; i++) edge[i] /= max;
  return { data: edge, width, height };
}

// A weighted scatter of N points (rejection sampling). Its placement is steerable:
//   placement 0 → uniform random (pure scatter, ignores the image)
//   placement 1 → fully concentrated on the FEATURE score
//   edges 0 → the feature score is brightness; edges 1 → it is contrast/edges
//     (facial features); in between it is a blend.
// An optional `mask` (grayscale, 128 = neutral) multiplies the local probability so
// an add/remove brush can push density up or down by hand.
export function weightedPoints(imageData, W, H, opts = {}) {
  if (!imageData) return [];
  const { count = 1400, gamma = 1.6, seed = 1, placement = 1, edges = 0, edgeMap = null, mask = null, maskStrength = 1 } = opts;
  const { data, width, height } = imageData;
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const em = edges > 0 ? edgeMap : null;
  const out = [];
  let guard = count * 60;
  while (out.length < count && guard-- > 0) {
    const px = Math.floor(rnd() * width), py = Math.floor(rnd() * height);
    const idx = (py * width + px) * 4;
    const l = (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]) / 255;
    const e = em ? em.data[py * width + px] : 0;
    const feature = clamp(lerp(l, e, edges), 0, 1);
    // accept = blend between "always" (scatter) and the feature-weighted probability
    let prob = lerp(1, Math.pow(feature, gamma), clamp(placement, 0, 1));
    if (mask) {
      const mx = Math.min(mask.width - 1, Math.floor((px / width) * mask.width));
      const my = Math.min(mask.height - 1, Math.floor((py / height) * mask.height));
      const g = mask.data[(my * mask.width + mx) * 4];          // grayscale channel
      prob *= clamp(1 + ((g - 128) / 127) * maskStrength, 0, 2);
    }
    if (rnd() < prob) out.push({ x: px * (W / width), y: py * (H / height), lum: l, edge: e, rnd: rnd() });
  }
  return out;
}

// ─── Effects ─────────────────────────────────────────────────────────────────
// Each renders directly to ctx. The compositor has already applied the layer's
// opacity and blend mode, so effects only draw.

function drawGlow(ctx, field, p, W, H) {
  // The hero effect: soft radial-gradient particles, denser and brighter where the
  // image is bright, coloured gold on the highlights and steel-blue toward the mids
  // — the gold/blue split in the reference. Additive blend (set by the layer) makes
  // overlapping particles bloom.
  const pts = weightedPoints(field.imageData, W, H, { count: p.count, gamma: p.gamma, seed: p.seed || 1, placement: p.placement, edges: p.edges, edgeMap: field.edgeMap, mask: field.mask, maskStrength: p.maskStrength ?? 1 });
  for (const pt of pts) {
    const t = clamp(Math.pow(pt.lum, 0.8), 0, 1);
    const col = mix(p.cool, p.warm, t);            // shadow→highlight colour ramp
    const size = lerp(p.minSize, p.maxSize, pt.rnd) * (0.5 + t);
    const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, size);
    g.addColorStop(0, col);
    g.addColorStop(0.25, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.globalAlpha = clamp(0.25 + t * 0.75, 0, 1) * (p._alpha ?? 1);
    ctx.beginPath(); ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2); ctx.fill();
    // bright core on the strongest particles
    if (t > 0.6) {
      ctx.fillStyle = p.warm;
      ctx.globalAlpha = (t - 0.6) * 2 * (p._alpha ?? 1);
      ctx.beginPath(); ctx.arc(pt.x, pt.y, Math.max(0.6, size * 0.14), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawNetwork(ctx, field, p, W, H) {
  const pts = field.points;
  ctx.strokeStyle = p.color; ctx.fillStyle = p.color; ctx.lineWidth = p.lineWeight;
  ctx.globalAlpha = 0.5 * (p._alpha ?? 1);
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j];
      if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 < p.connect ** 2) {
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = (p._alpha ?? 1);
  for (const pt of pts) {
    ctx.beginPath();
    if (p.shape === 'circle') ctx.arc(pt.x, pt.y, pt.r * p.scale, 0, Math.PI * 2);
    else ctx.rect(pt.x - pt.r * p.scale, pt.y - pt.r * p.scale, pt.r * 2 * p.scale, pt.r * 2 * p.scale);
    p.fill ? ctx.fill() : ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawHalftone(ctx, field, p, W, H) {
  ctx.fillStyle = p.color;
  ctx.globalAlpha = (p._alpha ?? 1);
  const cell = field.cell || 20;
  for (const g of field.grid) {
    const l = p.invert ? 1 - g.lum : g.lum;
    const r = (cell / 2) * clamp(l, 0, 1) * p.scale;
    if (r < 0.4) continue;
    ctx.beginPath(); ctx.arc(g.x, g.y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawContour(ctx, field, p, W, H) {
  // Topographic scan lines: evenly spaced horizontal lines displaced vertically by
  // the luminance beneath them — a landscape read of the image. Cheap and striking.
  ctx.strokeStyle = p.color; ctx.lineWidth = p.lineWeight;
  ctx.globalAlpha = (p._alpha ?? 1);
  const rows = Math.max(6, Math.round(p.density));
  const step = H / rows, amp = p.amp;
  const sampleLum = (x, y) => {
    // nearest grid cell
    let best = 0, bd = Infinity;
    for (const g of field.grid) { const d = (g.x - x) ** 2 + (g.y - y) ** 2; if (d < bd) { bd = d; best = g.lum; } }
    return best;
  };
  for (let r = 1; r < rows; r++) {
    const baseY = r * step;
    ctx.beginPath();
    for (let x = 0; x <= W; x += Math.max(4, W / 160)) {
      const lum = sampleLum(x, baseY);
      const y = baseY - lum * amp;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawScatter(ctx, field, p, W, H) {
  ctx.fillStyle = p.color;
  ctx.globalAlpha = clamp(p.dotAlpha, 0, 1) * (p._alpha ?? 1);
  for (const pt of weightedPoints(field.imageData, W, H, { count: p.count, gamma: p.gamma, seed: p.seed || 7, placement: p.placement, edges: p.edges, edgeMap: field.edgeMap, mask: field.mask, maskStrength: p.maskStrength ?? 1 })) {
    const r = lerp(p.minSize, p.maxSize, pt.rnd);
    ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawDuotone(ctx, field, p, W, H) {
  // Remap the source luminance to a two-colour ramp. Done from the downscaled
  // imageData scaled up — soft, but a duotone is a flat tint anyway, and it keeps a
  // per-pixel pass off the 1080×1440 hot path on every slider drag.
  const src = field.imageData;
  if (!src) return;
  const { data, width, height } = src;
  const off = document.createElement('canvas');
  off.width = width; off.height = height;
  const octx = off.getContext('2d');
  const out = octx.createImageData(width, height);
  const [sr, sg, sb] = hexRgb(p.shadow), [hr, hg, hb] = hexRgb(p.highlight);
  for (let i = 0; i < data.length; i += 4) {
    const l = clamp((0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255, 0, 1);
    out.data[i] = lerp(sr, hr, l); out.data[i + 1] = lerp(sg, hg, l); out.data[i + 2] = lerp(sb, hb, l);
    out.data[i + 3] = 255;
  }
  octx.putImageData(out, 0, 0);
  ctx.globalAlpha = (p._alpha ?? 1);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, W, H);
  ctx.globalAlpha = 1;
}

function drawSource(ctx, field, p, W, H) {
  if (!field.img) return;
  ctx.globalAlpha = (p._alpha ?? 1);
  const ir = field.img.width / field.img.height, cr = W / H;
  let dw, dh, dx, dy;
  if (ir > cr) { dw = W; dh = dw / ir; dx = 0; dy = (H - dh) / 2; }
  else { dh = H; dw = dh * ir; dy = 0; dx = (W - dw) / 2; }
  ctx.drawImage(field.img, dx, dy, dw, dh);
  ctx.globalAlpha = 1;
}

// ─── Registry ────────────────────────────────────────────────────────────────
export const EFFECTS = {
  source:   { label: 'Source image', draw: drawSource,   defaults: {} },
  glow:     { label: 'Glow particles', draw: drawGlow,    defaults: { count: 1600, gamma: 1.7, placement: 1, edges: 0.4, minSize: 3, maxSize: 16, seed: 1, maskStrength: 1, cool: PLAY_COLORS.steel, warm: PLAY_COLORS.gold }, blend: 'lighter' },
  network:  { label: 'Network',        draw: drawNetwork, defaults: { shape: 'circle', scale: 1, fill: false, lineWeight: 0.8, connect: 230, color: PLAY_COLORS.bone } },
  halftone: { label: 'Halftone',       draw: drawHalftone,defaults: { scale: 1, invert: false, color: PLAY_COLORS.bone } },
  contour:  { label: 'Contour lines',  draw: drawContour, defaults: { density: 46, amp: 90, lineWeight: 1, color: PLAY_COLORS.gold } },
  scatter:  { label: 'Scatter',        draw: drawScatter, defaults: { count: 2600, gamma: 1.5, placement: 1, edges: 0.3, minSize: 0.5, maxSize: 2.2, dotAlpha: 0.9, seed: 7, maskStrength: 1, color: PLAY_COLORS.warm } },
  duotone:  { label: 'Duotone',        draw: drawDuotone, defaults: { shadow: PLAY_COLORS.coal, highlight: PLAY_COLORS.gold }, blend: 'source-over' },
};

export const EFFECT_KEYS = Object.keys(EFFECTS);

let _seq = 0;
export function makeLayer(type) {
  const e = EFFECTS[type];
  return { id: `L${Date.now().toString(36)}${_seq++}`, type, enabled: true, opacity: 1, blend: e.blend || 'source-over', brushed: e.maskMode === 'density', params: { ...e.defaults } };
}

// Which derived data does a given stack need? (so the view computes only what's used)
export function stackNeeds(layers) {
  const t = new Set(layers.map((l) => l.type));
  return {
    // grid/points for the structured effects; imageData for the pixel-driven ones
    // (glow/scatter compute their own weighted points, duotone remaps pixels).
    field: t.has('network') || t.has('halftone') || t.has('contour'),
    imageData: t.has('glow') || t.has('scatter') || t.has('duotone'),
  };
}

// ─── Compositor ──────────────────────────────────────────────────────────────
export function renderStack(ctx, layers, field, W, H, bg) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  for (const layer of layers) {
    if (!layer.enabled) continue;
    const e = EFFECTS[layer.type];
    if (!e) continue;
    const useMask = !!(layer.brushed && field.mask);
    if (useMask && e.maskMode === 'alpha') {
      // Render the effect clean to an offscreen, erase it through the brush mask,
      // then composite the stencilled result — so line/raster effects (and the
      // source photo) obey the brush just like the particles do.
      const off = document.createElement('canvas'); off.width = W; off.height = H;
      const octx = off.getContext('2d');
      e.draw(octx, { ...field, mask: null }, { ...layer.params, _alpha: 1 }, W, H);
      octx.globalCompositeOperation = 'destination-in';
      octx.imageSmoothingEnabled = true;
      octx.drawImage(maskToAlpha(field.mask), 0, 0, W, H);
      octx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.globalCompositeOperation = layer.blend || 'source-over';
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(off, 0, 0);
      ctx.restore();
    } else {
      // Density effects read the mask themselves; a non-brushed layer gets mask:null
      // so it ignores the brush entirely.
      const lf = useMask ? field : { ...field, mask: null };
      ctx.save();
      ctx.globalCompositeOperation = layer.blend || 'source-over';
      e.draw(ctx, lf, { ...layer.params, _alpha: layer.opacity }, W, H);
      ctx.restore();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// ─── Parameter schema — drives the per-layer controls in the view ────────────
// Data, not UI code: each effect lists its editable params so the sidebar can
// render sliders and colour wells generically. Keys must exist in EFFECTS.defaults.
export const PARAM_SCHEMA = {
  source:   [],
  glow:     [
    { k: 'count', label: 'Density', min: 200, max: 6000, step: 50 },
    { k: 'placement', label: 'Placement · scatter→features', min: 0, max: 1, step: 0.05 },
    { k: 'edges', label: 'Cling to edges', min: 0, max: 1, step: 0.05 },
    { k: 'gamma', label: 'Falloff', min: 0.5, max: 4, step: 0.1 },
    { k: 'minSize', label: 'Min size', min: 0.5, max: 24, step: 0.5 },
    { k: 'maxSize', label: 'Max size', min: 2, max: 60, step: 1 },
    { k: 'seed', label: 'Seed', min: 1, max: 99, step: 1 },
    { k: 'warm', label: 'Highlight', type: 'color' },
    { k: 'cool', label: 'Shadow', type: 'color' },
  ],
  network:  [
    { k: 'connect', label: 'Connection', min: 0, max: 500, step: 5 },
    { k: 'lineWeight', label: 'Line weight', min: 0, max: 3, step: 0.1 },
    { k: 'scale', label: 'Shape size', min: 0.2, max: 3, step: 0.1 },
    { k: 'shape', label: 'Shape', type: 'pills', options: ['circle', 'square'] },
    { k: 'fill', label: 'Filled', type: 'toggle' },
    { k: 'color', label: 'Colour', type: 'color' },
  ],
  halftone: [
    { k: 'scale', label: 'Dot size', min: 0.2, max: 2, step: 0.05 },
    { k: 'invert', label: 'Invert', type: 'toggle' },
    { k: 'color', label: 'Colour', type: 'color' },
  ],
  contour:  [
    { k: 'density', label: 'Lines', min: 8, max: 120, step: 2 },
    { k: 'amp', label: 'Height', min: 0, max: 300, step: 5 },
    { k: 'lineWeight', label: 'Line weight', min: 0.2, max: 4, step: 0.1 },
    { k: 'color', label: 'Colour', type: 'color' },
  ],
  scatter:  [
    { k: 'count', label: 'Density', min: 300, max: 12000, step: 100 },
    { k: 'placement', label: 'Placement · scatter→features', min: 0, max: 1, step: 0.05 },
    { k: 'edges', label: 'Cling to edges', min: 0, max: 1, step: 0.05 },
    { k: 'gamma', label: 'Falloff', min: 0.5, max: 4, step: 0.1 },
    { k: 'minSize', label: 'Min size', min: 0.2, max: 6, step: 0.1 },
    { k: 'maxSize', label: 'Max size', min: 0.5, max: 10, step: 0.1 },
    { k: 'dotAlpha', label: 'Opacity', min: 0.1, max: 1, step: 0.05 },
    { k: 'color', label: 'Colour', type: 'color' },
  ],
  duotone:  [
    { k: 'shadow', label: 'Shadow', type: 'color' },
    { k: 'highlight', label: 'Highlight', type: 'color' },
  ],
};
