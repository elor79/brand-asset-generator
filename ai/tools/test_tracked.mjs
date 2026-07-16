#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// A TRACKED LABEL MUST FIT ITS COLUMN
// ─────────────────────────────────────────────────────────────────────────────
//     node ai/tools/test_tracked.mjs
//
// The headline, subline and body are wrapped by wrapText. The eyebrow and the CTA
// were not — they were emitted as ONE tracked token that ignored the column width
// entirely. The shrink-to-fit that exists governs HEIGHT, so nothing ever looked
// at their width.
//
// It is invisible on a full-width layout and 38% over on a split, which is exactly
// why it survived: it depends on the format you happen to be testing, and it
// throws nothing. IBRA hit it from both sides — the label running under the
// photograph on one layout, clipped mid-word at the canvas edge on the other.
//
// Also guarded here: the tracking off-by-one. The letter-space AFTER the last
// glyph is not part of the drawn width, and counting it makes every tracked
// string measure too wide — which shrinks labels that would have fitted.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import url from 'node:url';

const ROOT = path.resolve(url.fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'src/MedartisBrandGenerator.jsx'), 'utf8');
const grab = (sig) => {
  const at = src.indexOf(sig);
  if (at < 0) throw new Error(`not found: ${sig}`);
  return src.slice(at, src.indexOf('\n}\n', at) + 3);
};
const mod = [
  grab('function trackedWidth(ctx, text, size, weight, family, trackFrac) {'),
  grab('function fitTracked(ctx, text, maxW, size, weight, family, trackFrac, floor = 0.62) {'),
  'export { trackedWidth, fitTracked };',
].join('\n');
// os.tmpdir(): this mount forbids unlink() inside the repo, so a temp file written
// there would be permanent.
const tmp = path.join(os.tmpdir(), `tracked-${process.pid}-${Date.now()}.mjs`);
fs.writeFileSync(tmp, mod);
const { trackedWidth, fitTracked } = await import(url.pathToFileURL(tmp).href);
try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ }

// A fake ctx with a monospace metric. The point is the ARITHMETIC, not the font.
const ADV = 0.6;
const ctx = { font: '', measureText: (t) => ({ width: [...t].reduce((s) => s + parseFloat(ctx.font) * ADV, 0) }) };
Object.defineProperty(ctx, 'font', {
  get() { return this._f || '16px x'; },
  set(v) { this._f = v.match(/([\d.]+)px/)[1] + 'px'; },
});

let fail = 0;
const t = (label, ok) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) fail++; };

console.log('measuring\n');
t('  the tracking after the LAST glyph is not counted', (() => {
  const size = 20, track = 0.16;
  // 3 glyphs → 3 advances + 2 gaps, never 3 gaps.
  const expect = 3 * size * ADV + 2 * size * track;
  return Math.abs(trackedWidth(ctx, 'ABC', size, 500, 'mono', track) - expect) < 0.01;
})());
t('  an empty label measures 0, not a negative', trackedWidth(ctx, '', 20, 500, 'mono', 0.16) === 0);
t('  a single glyph has no trailing gap', (() => {
  const size = 20;
  return Math.abs(trackedWidth(ctx, 'A', size, 500, 'mono', 0.16) - size * ADV) < 0.01;
})());

console.log('\nfitting — the real case from the split layouts\n');
const LABEL = 'MEDARTIS FELLOWSHIP · APPLICATIONS OPEN';
const CTA = 'APPLY NOW · MEDARTIS.COM/FELLOWSHIP';
const full = 929, split = 389;

t('  fits already → untouched, not shrunk for no reason', (() => {
  const r = fitTracked(ctx, '§ 01 — NEW SYSTEM', full, 20, 500, 'mono', 0.14);
  return r.size === 20 && r.lines.length === 1;
})());

for (const [name, text, w] of [['eyebrow', LABEL, split], ['cta', CTA, split]]) {
  const r = fitTracked(ctx, text, w, 20, 500, 'mono', 0.14);
  const widest = Math.max(...r.lines.map((l) => trackedWidth(ctx, l, r.size, 500, 'mono', 0.14)));
  t(`  ${name} on a ${w}px column → ${r.lines.length} line(s) at ${r.size.toFixed(1)}px, widest ${Math.round(widest)}px — FITS`,
    widest <= w + 0.5);
}

t('  shrinks BEFORE it wraps — a label that wraps reads as a broken sentence', (() => {
  const r = fitTracked(ctx, LABEL, split, 20, 500, 'mono', 0.14);
  return r.lines.length === 1 && r.size < 20;
})());

t('  wraps on the MIDDOT when even the floor cannot hold it', (() => {
  const r = fitTracked(ctx, CTA, 60, 20, 500, 'mono', 0.12);
  return r.lines.length > 1 && r.lines[0] === 'APPLY NOW';
})());

t('  never shrinks past the floor (unreadable is not a fit)', (() => {
  const r = fitTracked(ctx, LABEL, 20, 20, 500, 'mono', 0.14);
  return r.size >= 20 * 0.62 - 0.01;
})());

t('  an impossible column still returns lines, never an empty label', (() => {
  const r = fitTracked(ctx, LABEL, 5, 20, 500, 'mono', 0.14);
  return r.lines.length > 0 && r.lines.join('').length > 0;
})());

console.log('\nthe regression, in numbers\n');
{
  const before = trackedWidth(ctx, LABEL, 20, 500, 'mono', 0.14);
  const r = fitTracked(ctx, LABEL, split, 20, 500, 'mono', 0.14);
  const after = Math.max(...r.lines.map((l) => trackedWidth(ctx, l, r.size, 500, 'mono', 0.14)));
  console.log(`  unfitted: ${Math.round(before)}px into a ${split}px column → ${Math.round(before - split)}px over (${Math.round((before / split - 1) * 100)}%)`);
  console.log(`  fitted:   ${Math.round(after)}px → fits`);
  t('  the fix actually closes the overflow', before > split && after <= split + 0.5);
}

console.log(fail ? `\n✗ ${fail} failed` : '\n✓ tracked labels fit their column');
process.exit(fail ? 1 : 0);
