#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// THE FAMILY ROW MUST FIT, AND MUST LOOK EQUAL
// ─────────────────────────────────────────────────────────────────────────────
// Two claims are made in groupLockup.js, and both are the kind that sound obviously
// true and are obviously false at some aspect ratio nobody tested:
//
//   1. the marks are AREA-MATCHED (that is what makes them read as equals)
//   2. the row FITS its box — at every format, including the extreme ones
//
// (2) is where logo rows actually break. A lanyard is 45:1. A row sized to fill the
// width of a lanyard overflows its height by a factor of six unless the height
// clamp actually engages — which is exactly the bug that stretched the lanyard
// artwork earlier in this project, one layer up.
//
//     node ai/tools/test_grouplockup.mjs
import { familyRow, endorsedLockup } from '../../src/groupLockup.js';
import { GROUP_MARK, NEOORTHO_MARK, KERIMEDICAL_MARK } from '../../src/groupBrands.js';

let fail = 0;
const ok = (m) => console.log(`✓ ${m}`);
const bad = (m) => { console.log(`✗ ${m}`); fail++; };

const MARKS = [GROUP_MARK, NEOORTHO_MARK, KERIMEDICAL_MARK];

// ── 1. Equal optical area ────────────────────────────────────────────────────
const row = familyRow(MARKS, { x: 0, y: 0, w: 1000, h: 120 });
const areas = row.map((r) => r.w * r.h);
const spread = (Math.max(...areas) - Math.min(...areas)) / Math.max(...areas);
if (spread < 0.001) ok(`area-matched across aspects 7.59 / 4.23 / 2.58 (spread ${(spread * 100).toFixed(3)}%)`);
else bad(`areas differ by ${(spread * 100).toFixed(1)}% — the row will not read as equals`);

// Sanity: height-matching (the naive approach) would be badly unequal. Prove the
// area match is actually doing work rather than coincidentally agreeing.
const naive = MARKS.map((m) => { const a = m.glyph.w / m.glyph.h; return 120 * a * 120; });
const naiveSpread = (Math.max(...naive) - Math.min(...naive)) / Math.max(...naive);
ok(`for contrast, height-matching would spread areas by ${(naiveSpread * 100).toFixed(0)}% — which is why this is not that`);

// ── 2. It fits. Everywhere. ──────────────────────────────────────────────────
const BOXES = [
  ['A4 strip',     800, 90],
  ['square',       600, 600],
  ['lanyard',      2400, 55],     // 43:1 — the shape that broke the layout before
  ['banner',       1600, 120],
  ['business card',260, 40],
  ['tall poster',  400, 900],     // taller than wide: the height clamp must bind
  ['tiny',         120, 24],
];
for (const [name, w, h] of BOXES) {
  const r = familyRow(MARKS, { x: 10, y: 5, w, h });
  if (!r.length) { bad(`${name}: returned nothing`); continue; }
  const right = Math.max(...r.map((q) => q.x + q.w));
  const bottom = Math.max(...r.map((q) => q.y + q.h));
  const overW = right - (10 + w), overH = bottom - (5 + h);
  if (overW > 0.01 || overH > 0.01) {
    bad(`${name} ${w}×${h}: row overflows by ${overW.toFixed(1)}×${overH.toFixed(1)}px`);
  } else {
    const a = r.map((q) => q.w * q.h);
    const s = (Math.max(...a) - Math.min(...a)) / Math.max(...a);
    if (s > 0.001) bad(`${name}: fits but areas drifted ${(s * 100).toFixed(1)}%`);
    else ok(`${name.padEnd(14)} ${String(w).padStart(4)}×${String(h).padStart(3)} → fits, areas equal, tallest ${Math.max(...r.map((q) => q.h)).toFixed(1)}px`);
  }
}

// ── 3. Endorsement keeps the Group mark subordinate ──────────────────────────
const e = endorsedLockup(KERIMEDICAL_MARK, { x: 0, y: 0, w: 400, h: 300 });
const [lead, end] = e;
if (end.h >= lead.h) bad('endorsement mark is not smaller than the lead — that is not an endorsement, it is a co-brand');
else if (end.y < lead.y + lead.h) bad('endorsement overlaps the lead mark');
else if (end.x + end.w > 400.01 || lead.x + lead.w > 400.01) bad('endorsed lockup overflows its box');
else ok(`endorsed lockup: lead ${lead.h.toFixed(0)}px, Group ${end.h.toFixed(0)}px (${(end.h / lead.h).toFixed(2)}× — subordinate, inside the box)`);

console.log(fail ? `\n✗ ${fail} problem(s) in the group lockup` : '\n✓ the family row fits every box and reads as equals');
process.exit(fail ? 1 : 0);
