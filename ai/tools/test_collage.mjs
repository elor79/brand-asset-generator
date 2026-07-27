#!/usr/bin/env node
// The collage grid: every count fits its box exactly (no overflow, no gap beyond
// the gutter), returns the right number of cells, and the last row spans full width.
import { collageGrid, COLLAGE_COUNTS } from '../../src/collage.js';

let fail = 0;
const ok = (m) => console.log(`✓ ${m}`);
const bad = (m) => { console.log(`✗ ${m}`); fail++; };
const W = 1000, H = 800, G = 16;

for (let n = 1; n <= 9; n++) {
  const rects = collageGrid(n, W, H, G);
  if (rects.length !== n) { bad(`count ${n}: got ${rects.length} rects`); continue; }
  // inside the box
  const over = rects.find((r) => r.x < -0.5 || r.y < -0.5 || r.x + r.w > W + 0.5 || r.y + r.h > H + 0.5);
  if (over) { bad(`count ${n}: a cell overflows the box (${JSON.stringify(over)})`); continue; }
  // no negative sizes
  if (rects.some((r) => r.w <= 0 || r.h <= 0)) { bad(`count ${n}: a cell has non-positive size`); continue; }
  // the last row reaches the right edge (full-width span)
  const maxRight = Math.max(...rects.map((r) => r.x + r.w));
  if (Math.abs(maxRight - W) > 1) { bad(`count ${n}: rightmost cell ends at ${maxRight.toFixed(1)}, not ${W}`); continue; }
  const rowsY = [...new Set(rects.map((r) => Math.round(r.y)))];
  ok(`count ${n}: ${rects.length} cells, ${rowsY.length} row(s), fills the box`);
}

// gutter 0 → cells tile with no gap
const tight = collageGrid(4, 100, 100, 0);
const cover = tight.reduce((s, r) => s + r.w * r.h, 0);
if (Math.abs(cover - 100 * 100) > 1) bad(`gutter 0: 4 cells cover ${cover}, not 10000`);
else ok('gutter 0 tiles the box with no gap');

if (COLLAGE_COUNTS.every((c) => collageGrid(c, W, H, G).length === c)) ok('every preset count returns that many cells');
else bad('a preset count is wrong');

console.log(fail ? `\n✗ ${fail} problem(s)` : '\n✓ the collage grid fits every count from 1 to 9');
process.exit(fail ? 1 : 0);
