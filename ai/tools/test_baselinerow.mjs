#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// THE CO-BRAND ROW: ONE CAP HEIGHT, ONE BASELINE
// ─────────────────────────────────────────────────────────────────────────────
// "Make them optically equal and put them on a baseline, so they don't stand at
// different heights."
//
// They stood at different heights because the row matched bounding-box AREA, and a
// bounding box does not know where the letters are. KeriMedical's box is 130 tall
// and its letters are 41: two thirds of its "height" is a set of bars and a hanging
// stroke. Matched by box it shrinks and floats. Matched by cap it reads as an equal.
//
// Both properties are checked here, because both are invisible in code review and
// obvious on screen — which is the wrong way round.
//
//     node ai/tools/test_baselinerow.mjs
import { baselineRow } from '../../src/groupLockup.js';
import { NEOORTHO_MARK, KERIMEDICAL_MARK, GROUP_MARK, markMetrics } from '../../src/groupBrands.js';

let fail = 0;
const ok = (m) => console.log(`✓ ${m}`);
const bad = (m) => { console.log(`✗ ${m}`); fail++; };

// The medartis wordmark, as the engine holds it.
const WM = {
  view: { w: 526.755, h: 245.078 },
  glyph: { x: 91.89, y: 91.89, w: 342.98, h: 61.30 },
  baseline: 153.19, cap: 61.30,
  paths: [{ fill: null, d: 'M91.89,91.89H434.87V153.19H91.89Z' }],
};
const ROW = [WM, NEOORTHO_MARK, KERIMEDICAL_MARK];
const NAMES = ['medartis', 'NeoOrtho', 'KeriMedical'];

// ── 1. One baseline ──────────────────────────────────────────────────────────
{
  const r = baselineRow(ROW, { x: 0, y: 0, w: 1420, h: 220 });
  const lines = new Set(r.map((q) => q.baselineY.toFixed(4)));
  if (lines.size !== 1) bad(`the marks sit on ${lines.size} different baselines — that is the bug being fixed`);
  else ok(`one baseline at y=${r[0].baselineY.toFixed(1)} for all ${r.length} marks`);

  // ── 2. One cap height — the letterforms match, not the boxes ──────────────
  const caps = r.map((q) => q.cap);
  const spread = (Math.max(...caps) - Math.min(...caps)) / Math.max(...caps);
  if (spread > 1e-6) bad(`cap heights differ by ${(spread * 100).toFixed(2)}% — the letters are not equal`);
  else ok(`one cap height (${caps[0].toFixed(1)}px) — the LETTERS match, not the bounding boxes`);

  // The boxes must NOT match. If they did, cap-matching would be doing nothing and
  // this whole change would be theatre.
  const hs = r.map((q) => q.h);
  const hSpread = (Math.max(...hs) - Math.min(...hs)) / Math.max(...hs);
  if (hSpread < 0.05) bad('the bounding boxes came out equal — cap-matching is not actually doing anything');
  else ok(`boxes deliberately differ by ${(hSpread * 100).toFixed(0)}% (${hs.map((v) => v.toFixed(0)).join(' / ')}px) — KeriMedical's stroke hangs below the line, as it should`);
}

// ── 3. It fits — every box, including the cruel ones ─────────────────────────
console.log('');
for (const [name, w, h] of [
  ['A4 strip', 800, 90], ['square', 600, 600], ['lanyard', 2400, 55],
  ['banner', 1600, 120], ['card', 260, 40], ['tall', 400, 900], ['tiny', 120, 24],
]) {
  const r = baselineRow(ROW, { x: 10, y: 5, w, h });
  if (!r.length) { bad(`${name}: returned nothing`); continue; }
  const right = Math.max(...r.map((q) => q.x + q.w));
  const top = Math.min(...r.map((q) => q.y));
  const bottom = Math.max(...r.map((q) => q.y + q.h));
  const over = Math.max(right - (10 + w), bottom - (5 + h), 5 - top);
  if (over > 0.01) bad(`${name} ${w}×${h}: overflows by ${over.toFixed(1)}px`);
  else ok(`${name.padEnd(9)} ${String(w).padStart(4)}×${String(h).padStart(3)} → fits, cap ${r[0].cap.toFixed(1)}px, baseline ${r[0].baselineY.toFixed(0)}`);
}

// ── 4. The proportions match the reference ───────────────────────────────────
// The approved artwork sets the three at roughly 325 / 405 / 375 across a 1420-wide
// row. Cap-matching is a RULE, not a copy of that image, so it will not land on it
// exactly — but if it drifts far, the rule is wrong and this should say so.
console.log('');
{
  const r = baselineRow(ROW, { x: 0, y: 0, w: 1420, h: 220 });
  const REF = [325, 405, 375];
  let worst = 0;
  const parts = r.map((q, i) => {
    const err = Math.abs(q.w - REF[i]) / REF[i];
    worst = Math.max(worst, err);
    return `${NAMES[i]} ${q.w.toFixed(0)} (ref ${REF[i]}, ${(err * 100).toFixed(0)}%)`;
  });
  if (worst > 0.15) bad(`widths drift up to ${(worst * 100).toFixed(0)}% from the approved artwork — cap-matching may be the wrong rule: ${parts.join(', ')}`);
  else ok(`within ${(worst * 100).toFixed(0)}% of the approved artwork — ${parts.join(', ')}`);
}

console.log(fail ? `\n✗ ${fail} problem(s) in the co-brand row` : '\n✓ one cap height, one baseline, fits everywhere');
process.exit(fail ? 1 : 0);
