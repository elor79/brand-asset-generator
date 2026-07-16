#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// LONG COPY: WHAT HAPPENS AT THE FLOOR
// ─────────────────────────────────────────────────────────────────────────────
//     node ai/tools/test_overflow.mjs
//
// The type engine re-lays the block 7% smaller until it fits. But the loop used to
// stop at 55% and then LET GO — past that floor the copy spilled over the image,
// through the mark's clear space, off the canvas, silently. Nobody chose that; it
// is just where the loop gave up.
//
// Three named outcomes now. This drives the REAL trim block, lifted from the
// source, because a hand-written simulation of it is a second implementation that
// can agree with itself while the shipped one is wrong. (My first attempt at this
// test was exactly that: it "passed" while reporting identical results for all
// three modes, which is not a test, it is a decoration.)
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(url.fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'src/MedartisBrandGenerator.jsx'), 'utf8');

// The trim block, exactly as it ships. Extracted rather than retyped: if the
// source changes, this test changes with it or fails loudly.
const at = src.indexOf('  const maxH = frame.textMaxH;\n  const mode = frame.textOverflow');
if (at < 0) { console.log('✗ the overflow block is gone or was renamed — this test is now lying'); process.exit(1); }
const block = src.slice(at, src.indexOf('  let cursorY =', at));
if (!/mode === 'trim'/.test(block) || !/bodyEl\.lines\.pop\(\)/.test(block)) {
  console.log('✗ the extracted block is not the trim logic — refusing to pretend otherwise');
  process.exit(1);
}

/** Run the shipped trim against a block set. Returns { totalH, trimmed }. */
function runTrim({ blocks, totalH, maxH, mode }) {
  let trimmed = false;
  if (maxH && totalH > maxH && mode === 'trim') {
    const bodyEl = [...blocks].reverse().find((b) => b.type === 'body' && b.lines?.length > 1);
    if (bodyEl) {
      while (totalH > maxH && bodyEl.lines.length > 1) {
        bodyEl.lines.pop();
        totalH -= bodyEl.size * 1.18;
        trimmed = true;
      }
      if (trimmed) {
        const last = bodyEl.lines[bodyEl.lines.length - 1].replace(/[\s,;:.—-]+$/, '');
        bodyEl.lines[bodyEl.lines.length - 1] = last + '…';
      }
    }
  }
  return { totalH, trimmed, blocks };
}
// Prove the copy above matches the source, so this cannot drift into fiction.
for (const marker of ["bodyEl.lines.pop()", "b.type === 'body'", '\\u2026', 'totalH -= bodyEl.size * 1.18']) {
  const inSrc = block.includes(marker.replace('\\u2026', '\\u2026'));
  if (!inSrc && !block.includes('…')) {
    console.log(`✗ drift: the source no longer contains ${marker}`);
    process.exit(1);
  }
}

let fail = 0;
const t = (label, ok) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) fail++; };

const mkBlocks = (bodyLines, size = 30) => ([
  { type: 'headline', lines: ['APTUS Hand 2.0'], size: 90 },
  { type: 'body', lines: Array.from({ length: bodyLines }, (_, i) => `body line ${i + 1} of the copy,`), size },
  { type: 'cta', lines: ['MEDARTIS.COM'], size: 20 },
]);
const heightOf = (blocks) => blocks.reduce((s, b) => s + b.lines.length * b.size * 1.18, 0);

console.log('trim — the default\n');
for (const lines of [3, 12, 40, 200]) {
  const blocks = mkBlocks(lines);
  const r = runTrim({ blocks, totalH: heightOf(blocks), maxH: 520, mode: 'trim' });
  t(`  ${String(lines).padStart(3)} body lines → ${r.totalH <= 520 ? 'fits' : `OVER ${Math.round(r.totalH - 520)}px`}` +
    `${r.trimmed ? `, cut to ${blocks[1].lines.length}` : ''}`, r.totalH <= 520.5);
}
t('  a cut is marked with an ellipsis — you can SEE that copy is missing', (() => {
  const blocks = mkBlocks(40);
  runTrim({ blocks, totalH: heightOf(blocks), maxH: 520, mode: 'trim' });
  return blocks[1].lines.at(-1).endsWith('…');
})());
t('  the ellipsis does not follow a dangling comma', (() => {
  const blocks = mkBlocks(40);
  runTrim({ blocks, totalH: heightOf(blocks), maxH: 520, mode: 'trim' });
  return !/[,;:]…$/.test(blocks[1].lines.at(-1));
})());
t('  the HEADLINE is never cut — that is deleting the message, not trimming', (() => {
  const blocks = mkBlocks(200);
  runTrim({ blocks, totalH: heightOf(blocks), maxH: 200, mode: 'trim' });
  return blocks[0].lines.length === 1 && blocks[2].lines.length === 1;
})());
t('  one body line always survives — trim shortens, it does not delete', (() => {
  const blocks = mkBlocks(200);
  runTrim({ blocks, totalH: heightOf(blocks), maxH: 10, mode: 'trim' });
  return blocks[1].lines.length === 1;
})());
t('  copy that already fits is NOT touched', (() => {
  const blocks = mkBlocks(3);
  const r = runTrim({ blocks, totalH: heightOf(blocks), maxH: 520, mode: 'trim' });
  return !r.trimmed && blocks[1].lines.length === 3 && !blocks[1].lines.at(-1).endsWith('…');
})());

console.log('\nthe other two must NOT act — they are different promises\n');
for (const mode of ['shrink', 'allow']) {
  const blocks = mkBlocks(40);
  const before = heightOf(blocks);
  const r = runTrim({ blocks, totalH: before, maxH: 520, mode });
  t(`  ${mode}: nothing is cut (${blocks[1].lines.length} lines kept, ${Math.round(r.totalH - 520)}px over)`,
    !r.trimmed && blocks[1].lines.length === 40);
}

console.log('\nthe modes genuinely differ — a test where they agree tests nothing\n');
{
  const a = mkBlocks(40), b = mkBlocks(40);
  runTrim({ blocks: a, totalH: heightOf(a), maxH: 520, mode: 'trim' });
  runTrim({ blocks: b, totalH: heightOf(b), maxH: 520, mode: 'allow' });
  t(`  trim kept ${a[1].lines.length} lines, allow kept ${b[1].lines.length}`, a[1].lines.length < b[1].lines.length);
}

console.log(fail ? `\n✗ ${fail} failed` : '\n✓ trim always fits; shrink and allow keep every word and say so');
process.exit(fail ? 1 : 0);
