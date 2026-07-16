#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// THE LOCKUP BAND MUST TERMINATE, AND MUST RESERVE WHAT IT DRAWS
// ─────────────────────────────────────────────────────────────────────────────
// This exists because I shipped `function groupLockupBand() { const band =
// groupLockupBand(...) }` — a function whose entire body was a call to itself. It
// took the whole app down with "too much recursion" on first render.
//
// Nothing caught it. esbuild parses it happily (it is valid JavaScript). The
// layout contract greps for call sites and found one. check_group never calls it.
// Every tool I had was structural, and the bug was BEHAVIOURAL: the code had to
// RUN to be wrong.
//
// So this runs it. The functions are lifted out of the component file by source
// extraction, because the alternative — importing a 10k-line JSX module into node —
// is not something a check should need a browser for.
//
//     node ai/tools/test_groupband.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROUP_MARK, clearSpaceFor } from '../../src/groupBrands.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(ROOT, 'src/MedartisBrandGenerator.jsx'), 'utf8');

let fail = 0;
const ok = (m) => console.log(`✓ ${m}`);
const bad = (m) => { console.log(`✗ ${m}`); fail++; };

function bodyOf(name) {
  const at = src.search(new RegExp('^function ' + name + '\\b', 'm'));
  if (at < 0) return null;
  const end = src.indexOf('\n}\n', at);
  return src.slice(at, end + 3);
}

// ── 1. Static: does it call itself unconditionally? ──────────────────────────
const bandSrc = bodyOf('groupLockupBand');
if (!bandSrc) { bad('groupLockupBand not found'); process.exit(1); }
const selfCalls = (bandSrc.match(/groupLockupBand\s*\(/g) || []).length - 1;  // minus the declaration
if (selfCalls > 0) bad(`groupLockupBand calls itself ${selfCalls}x — that is infinite recursion, not a base case`);
else ok('groupLockupBand does not call itself');

// ── 2. Behavioural: RUN it. This is the part that was missing. ───────────────
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fn = new Function('clamp', 'clearSpaceFor', 'GROUP_MARK',
  bandSrc + '\nreturn groupLockupBand;')(clamp, clearSpaceFor, GROUP_MARK);

const FRAME = { w: 1080, h: 1350, padX: 80, padY: 80, bleedPx: 0 };
const CASES = [
  ['disabled',      { enabled: false }, null],
  ['top',           { enabled: true, pos: 'top', size: 0.14 }, 'top'],
  ['bottom',        { enabled: true, pos: 'bottom', size: 0.14 }, 'bottom'],
  ['no pos (default)', { enabled: true, size: 0.14 }, 'top'],
  ['huge size',     { enabled: true, pos: 'top', size: 9 }, 'top'],
  ['zero size',     { enabled: true, pos: 'top', size: 0 }, 'top'],
];
for (const [name, group, expect] of CASES) {
  let r;
  try {
    r = fn(FRAME, group);   // if this recurses, the process dies here — which is the point
  } catch (e) {
    bad(`${name}: threw ${e.constructor.name}: ${e.message}`);
    continue;
  }
  if (expect === null) {
    if (r !== null) bad(`${name}: expected null, got a band`);
    else ok(`${name.padEnd(18)} → null, as it should`);
    continue;
  }
  if (!r) { bad(`${name}: returned null but the Group is enabled`); continue; }
  const inside = r.y >= 0 && r.y + r.h <= FRAME.h + 0.01 && r.x >= 0 && r.x + r.w <= FRAME.w + 0.01;
  if (!inside) bad(`${name}: band ${r.x},${r.y} ${r.w}×${r.h} falls outside the ${FRAME.w}×${FRAME.h} canvas`);
  else if (r.top > r.y || r.bottom < r.y + r.h) bad(`${name}: clear space does not enclose the band`);
  else if (expect === 'top' && r.y > FRAME.h / 2) bad(`${name}: pos=top but the band is in the lower half`);
  else if (expect === 'bottom' && r.y < FRAME.h / 2) bad(`${name}: pos=bottom but the band is in the upper half`);
  else ok(`${name.padEnd(18)} → y=${r.y.toFixed(0)} h=${r.h.toFixed(0)}, clear ${r.top.toFixed(0)}–${r.bottom.toFixed(0)}, inside the canvas`);
}

// ── 3. Clearance must actually reserve it ───────────────────────────────────
const clr = bodyOf('brandBarClearance');
if (!clr) bad('brandBarClearance not found');
else if (!/groupLockupBand\(/.test(clr)) {
  bad('brandBarClearance does not reserve the Group band — the lockup and the headline will both claim the strip, and the later draw wins');
} else if (/\bbotY\b/.test(clr)) {
  bad('brandBarClearance references `botY`; the variable is `bottomY` — a ReferenceError on every draw with the Group at the bottom');
} else ok('brandBarClearance reserves the Group band, using the same function that draws it');

console.log(fail ? `\n✗ ${fail} problem(s)` : '\n✓ the band terminates, stays on the canvas, and is reserved');
process.exit(fail ? 1 : 0);
