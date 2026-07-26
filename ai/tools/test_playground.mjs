#!/usr/bin/env node
// The playground effect engine: pure functions, so they are tested here without a
// browser. Every effect must render without throwing, the compositor must walk a
// mixed stack, and every effect must declare a param schema whose keys exist in its
// defaults (or the sidebar renders a control bound to nothing).
import { sampleField, weightedPoints, EFFECTS, EFFECT_KEYS, PARAM_SCHEMA, makeLayer, renderStack, stackNeeds } from '../../src/playground.js';

let fail = 0;
const ok = (m) => console.log(`✓ ${m}`);
const bad = (m) => { console.log(`✗ ${m}`); fail++; };

// synthetic gradient image
const W = 48, H = 48, data = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, v = Math.floor((x / W) * 255); data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255; }
const imageData = { data, width: W, height: H };
const OW = 1080, OH = 1440;

const f = sampleField(imageData, OW, OH, {});
if (!f.grid.length || !f.points.length) bad('sampleField produced no grid/points'); else ok(`sampleField: ${f.grid.length} grid, ${f.points.length} points`);
const wp = weightedPoints(imageData, OW, OH, { count: 400 });
if (!wp.length) bad('weightedPoints empty'); else ok(`weightedPoints: ${wp.length} luminance-weighted`);

// stub ctx + document
const ctx = new Proxy({}, { get: (t, k) => {
  if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} });
  if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
  if (k === 'getContext') return () => ctx;
  if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
  return typeof k === 'string' && /^[a-z]/.test(k) ? (() => {}) : undefined;
}, set: () => true });
global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
const field = { ...f, imageData, img: null };

for (const key of EFFECT_KEYS) {
  if (!PARAM_SCHEMA[key]) { bad(`${key}: no PARAM_SCHEMA`); continue; }
  const bogus = PARAM_SCHEMA[key].filter((c) => !(c.k in EFFECTS[key].defaults));
  if (bogus.length) { bad(`${key}: schema keys not in defaults: ${bogus.map((c) => c.k).join(', ')}`); continue; }
  if (key === 'source') { ok(`${key.padEnd(9)} schema ok (needs a real image)`); continue; }
  try { EFFECTS[key].draw(ctx, field, { ...EFFECTS[key].defaults, _alpha: 1 }, OW, OH); ok(`${key.padEnd(9)} renders, schema matches defaults`); }
  catch (e) { bad(`${key}: threw ${e.message}`); }
}

// mixed stack
try { renderStack(ctx, EFFECT_KEYS.filter((k) => k !== 'source').map(makeLayer), field, OW, OH, '#000'); ok('renderStack composites a mixed stack'); }
catch (e) { bad(`renderStack threw ${e.message}`); }

// disabled layers are skipped
const l = makeLayer('glow'); l.enabled = false;
let drew = false; const spy = new Proxy(ctx, { get: (t, k) => (k === 'arc' ? (() => { drew = true; }) : t[k]) });
renderStack(spy, [l], field, OW, OH, '#000');
if (drew) bad('a disabled layer still drew'); else ok('disabled layers are skipped');

console.log(fail ? `\n✗ ${fail} problem(s) in the playground engine` : '\n✓ every effect renders, composites, and matches its schema');
process.exit(fail ? 1 : 0);
