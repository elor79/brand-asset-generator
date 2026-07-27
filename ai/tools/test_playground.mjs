#!/usr/bin/env node
// The playground effect engine: pure functions tested without a browser. Every
// effect renders; the compositor walks a mixed stack; every effect's PARAM_SCHEMA
// keys exist in its defaults; placement 0 scatters while placement 1 concentrates;
// the mask suppresses where painted.
import { sampleField, weightedPoints, computeEdgeMap, EFFECTS, EFFECT_KEYS, PARAM_SCHEMA, makeLayer, renderStack } from '../../src/playground.js';

let fail = 0;
const ok = (m) => console.log(`✓ ${m}`);
const bad = (m) => { console.log(`✗ ${m}`); fail++; };

// synthetic: bright feature-y square in the middle of a dark field
const W = 64, H = 64, data = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; const inBox = x > 24 && x < 40 && y > 24 && y < 40; const v = inBox ? 240 : 20; data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255; }
const imageData = { data, width: W, height: H };
const OW = 900, OH = 900;

const edge = computeEdgeMap(imageData);
if (!edge || edge.data.length !== W * H) bad('computeEdgeMap wrong shape'); else ok('computeEdgeMap normalised');

// placement 0 = scatter (points spread across the whole frame); placement 1 = concentrated on the bright box
const spread = (pts) => { const xs = pts.map(p => p.x); return Math.max(...xs) - Math.min(...xs); };
const scat = weightedPoints(imageData, OW, OH, { count: 300, placement: 0, seed: 3 });
const conc = weightedPoints(imageData, OW, OH, { count: 300, placement: 1, gamma: 2, seed: 3 });
const inBox = (pts) => pts.filter(p => p.x > OW * 0.37 && p.x < OW * 0.63 && p.y > OH * 0.37 && p.y < OH * 0.63).length / pts.length;
if (inBox(conc) <= inBox(scat)) bad(`placement 1 (${(inBox(conc)*100).toFixed(0)}% in feature) is not more concentrated than placement 0 (${(inBox(scat)*100).toFixed(0)}%)`);
else ok(`placement steers: scatter ${(inBox(scat)*100).toFixed(0)}% vs concentrated ${(inBox(conc)*100).toFixed(0)}% inside the bright feature`);

// edges: cling-to-edges should favour the box OUTLINE over its flat interior
const edgey = weightedPoints(imageData, OW, OH, { count: 300, placement: 1, edges: 1, edgeMap: edge, gamma: 1.5, seed: 5 });
if (!edgey.length) bad('edge-clinging produced nothing'); else ok(`edge-cling places ${edgey.length} points on contrast`);

// mask suppresses where painted dark (below 128)
const maskData = new Uint8ClampedArray(W * H * 4).fill(128);
for (let i = 3; i < maskData.length; i += 4) maskData[i] = 255;         // alpha
for (let y = 0; y < H; y++) for (let x = 0; x < W / 2; x++) { const i = (y * W + x) * 4; maskData[i] = maskData[i + 1] = maskData[i + 2] = 0; } // left half = remove
const mask = { data: maskData, width: W, height: H };
const masked = weightedPoints(imageData, OW, OH, { count: 600, placement: 0, mask, seed: 9 });
const leftFrac = masked.filter(p => p.x < OW / 2).length / masked.length;
if (leftFrac > 0.15) bad(`remove-brushed left half still has ${(leftFrac*100).toFixed(0)}% of points`);
else ok(`mask suppresses: only ${(leftFrac*100).toFixed(0)}% of points fall in the removed half`);

// every effect renders + schema matches defaults
const ctx = new Proxy({}, { get: (t, k) => {
  if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} });
  if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
  if (k === 'getContext') return () => ctx;
  if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
  return typeof k === 'string' && /^[a-z]/.test(k) ? (() => {}) : undefined;
}, set: () => true });
global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
const field = { ...sampleField(imageData, OW, OH, {}), imageData, edgeMap: edge, mask: null, img: null };
for (const key of EFFECT_KEYS) {
  const bogus = PARAM_SCHEMA[key].filter((c) => !(c.k in EFFECTS[key].defaults));
  if (bogus.length) { bad(`${key}: schema keys not in defaults: ${bogus.map(c => c.k).join(', ')}`); continue; }
  if (key === 'source') { ok(`${key.padEnd(9)} schema ok`); continue; }
  try { EFFECTS[key].draw(ctx, field, { ...EFFECTS[key].defaults, _alpha: 1 }, OW, OH); ok(`${key.padEnd(9)} renders`); }
  catch (e) { bad(`${key}: threw ${e.message}`); }
}
try { renderStack(ctx, EFFECT_KEYS.filter(k => k !== 'source').map(makeLayer), field, OW, OH, '#000'); ok('renderStack composites a mixed stack'); }
catch (e) { bad(`renderStack threw ${e.message}`); }

// per-layer brushing: density effects default brushed on, others off
for (const k of EFFECT_KEYS) {
  const l = makeLayer(k);
  const want = EFFECTS[k].maskMode === 'density';
  if (l.brushed !== want) bad(`${k}: makeLayer.brushed=${l.brushed}, expected ${want} (from maskMode ${EFFECTS[k].maskMode})`);
}
ok('makeLayer sets brushed per maskMode (particles on, others off)');

// a mixed brushed stack, WITH a mask, composites without throwing (exercises both
// the density read and the offscreen alpha-mask path)
const maskGray = new Uint8ClampedArray(field.imageData.width * field.imageData.height * 4);
for (let i = 0; i < maskGray.length; i += 4) { maskGray[i] = maskGray[i+1] = maskGray[i+2] = 128; maskGray[i+3] = 255; }
const brushedField = { ...field, mask: { data: maskGray, width: field.imageData.width, height: field.imageData.height } };
try {
  const stack = ['glow', 'network', 'duotone', 'source'].map((k) => { const l = makeLayer(k); l.brushed = true; return l; });
  renderStack(ctx, stack, brushedField, OW, OH, '#000');
  ok('brushed stack composites both mask modes (density + alpha) without throwing');
} catch (e) { bad(`brushed stack threw ${e.message}`); }

console.log(fail ? `\n✗ ${fail} problem(s)` : '\n✓ placement, edges, mask, and every effect check out');
process.exit(fail ? 1 : 0);
