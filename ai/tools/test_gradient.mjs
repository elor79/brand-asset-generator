#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// A RAMP MAY HAVE MORE THAN TWO COLOURS
// ─────────────────────────────────────────────────────────────────────────────
// The engine was from → to. "black → violet → teal → blue" cannot be said that way,
// so `stops` exists. Both forms must resolve identically for every renderer —
// canvas, SVG, PDF, and the contrast sampler — or they will disagree about what is
// on the page, and the screen and the proof will differ again.
//
//     node ai/tools/test_gradient.mjs
import { colorAt, stopColors, gradientStops, rampAt } from '../../src/gradient.js';
import { GROUP_GRADIENTS } from '../../src/groupBrands.js';

let fail = 0;
const ok = (m) => console.log(`✓ ${m}`);
const bad = (m) => { console.log(`✗ ${m}`); fail++; };
const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

// ── 1. The shorthand still means what it meant ──────────────────────────────
const two = { from: '#000000', to: '#ffffff', easing: 'linear' };
if (hex(colorAt(two, 0)) !== '#000000' || hex(colorAt(two, 1)) !== '#ffffff') bad('2-stop endpoints moved');
else if (hex(colorAt(two, 0.5)) !== '#808080') bad(`2-stop midpoint is ${hex(colorAt(two, 0.5))}, not #808080`);
else ok('from/to still resolves exactly as before — the shorthand is not a special case');

// ── 2. Every declared stop is actually hit ──────────────────────────────────
// The real risk: a stop that is in the list and never appears on the canvas.
for (const [key, g] of Object.entries(GROUP_GRADIENTS)) {
  if (!g.stops?.length) continue;
  const lin = { ...g, easing: 'linear', midpoint: 0.5, start: 0, end: 1 };
  const misses = g.stops.filter((want, i) => {
    const t = i / (g.stops.length - 1);
    return hex(colorAt(lin, t)).toLowerCase() !== want.toLowerCase();
  });
  if (misses.length) bad(`${key}: declares ${misses.join(', ')} but the ramp never reaches them`);
  else ok(`${key.padEnd(19)} all ${g.stops.length} stops land on the ramp at even spacing`);
}

// ── 3. Monotonic and continuous ─────────────────────────────────────────────
// A seam would show as a hard edge on a poster. Sample densely and check no step
// between adjacent samples is wildly bigger than its neighbours.
for (const [key, g] of Object.entries(GROUP_GRADIENTS)) {
  const N = 400;
  const cols = Array.from({ length: N }, (_, i) => colorAt(g, i / (N - 1)));
  const steps = cols.slice(1).map((c, i) => Math.hypot(...c.map((v, k) => v - cols[i][k])));
  const mean = steps.reduce((a, b) => a + b, 0) / steps.length;
  const worst = Math.max(...steps);
  if (worst > mean * 12 + 1) bad(`${key}: a jump of ${worst.toFixed(1)} against a mean step of ${mean.toFixed(2)} — the ramp has a seam`);
  else ok(`${key.padEnd(19)} continuous (worst step ${worst.toFixed(2)}, mean ${mean.toFixed(2)})`);
}

// ── 4. Easing spans the WHOLE ramp, not each segment ────────────────────────
// Easing per segment would put a soft landing at every stop and make a four-colour
// ramp read as three gradients glued together.
{
  const g = { stops: ['#000000', '#808080', '#ffffff'], easing: 'smooth' };
  const s = rampAt(g, 0.25);
  if (Math.abs(s - 0.15625) > 1e-6) bad(`rampAt is not smoothstepping the whole ramp (got ${s})`);
  else ok('rampAt smoothsteps the whole ramp');

  // AND colorAt must actually USE it. Testing rampAt alone proves the easing exists,
  // not that the ramp obeys it — colorAt could pick its segment from the RAW t and
  // this would still pass. It did: I reverted `s` to `t` in colorAt to check, and
  // nothing complained. A unit test of a helper is not a test of the thing that
  // calls it.
  const eased = hex(colorAt(g, 0.25));       // rampAt(0.25)=0.15625 → 0.3125 of seg 0 → #282828
  const linear = hex(colorAt({ ...g, easing: 'linear' }, 0.25));   // → #404040
  if (eased === linear) bad(`colorAt ignores easing: smooth and linear both give ${eased}`);
  else if (eased !== '#282828') bad(`colorAt's eased colour is ${eased}, expected #282828 — it is not picking its segment from the eased position`);
  else ok(`colorAt obeys the easing (smooth ${eased} vs linear ${linear}), not just rampAt in isolation`);
}

// ── 5. stopColors is the one shape everything downstream sees ───────────────
if (stopColors({ from: '#112233' }).length !== 2) bad('a from-only gradient must still give two stops');
else if (gradientStops({ stops: ['#000', '#fff'] }, 3).length !== 3) bad('gradientStops ignores stops');
else ok('stopColors normalises both forms; every renderer sees one shape');

console.log(fail ? `\n✗ ${fail} problem(s)` : '\n✓ two stops or four, the ramp is the ramp');
process.exit(fail ? 1 : 0);
