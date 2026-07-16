#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// A FORMAT MUST BE THE SIZE IT CLAIMS, AND ITS MARK MUST CLEAR THE GUIDE
// ─────────────────────────────────────────────────────────────────────────────
//     node ai/tools/check_formats.mjs
//
// Two bug classes, both silent, both found only by measuring:
//
// 1 · THE BUSINESS CARD WAS THE WRONG SIZE. It declared ratio '85×55' and shipped
//     1050 × 600 px at 300 dpi = 88.9 × 50.8 mm — 3.9 mm too wide, 4.2 mm too
//     short. A card that does not fit a wallet. The label was right and the pixels
//     were not, and nothing in the app compares the two.
//
// 2 · formatCategory() FELL THROUGH TO 'social'. 'Print · brochure' and
//     'Print · wearables' matched no prefix, and LOGO_SHORT_PCT has no `social`
//     key — so defaultWordmarkShortFrac took its else-branch and DISCARDED the
//     format's declared wmPct. brochure-a4 asked for 46.2 mm and rendered 27.3 mm;
//     lanyard-20 asked 11.0 mm and rendered 2.6 mm. Every brochure shipped with
//     the mark under the guide's own non-negotiable minimum, and the app's own
//     BRAND CHECK would have said so if anyone had opened it.
//
// So: measure. A print format that lies about its size, or whose default mark
// fails the check the app itself runs, fails here first.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(ROOT, 'src/MedartisBrandGenerator.jsx'), 'utf8');
const body = src.slice(src.indexOf('const FORMATS = {'), src.indexOf('\n};', src.indexOf('const FORMATS = {')));

const F = {};
for (const m of body.matchAll(/^  '([\w-]+)':\s*\{([^\n]*)\}/gm)) {
  const b = m[2];
  const num = (re) => { const x = b.match(re); return x ? +x[1] : undefined; };
  F[m[1]] = {
    group: (b.match(/group: '([^']+)'/) || [])[1],
    label: (b.match(/label: '([^']+)'/) || [])[1],
    ratio: (b.match(/ratio: '([^']+)'/) || [])[1],
    w: num(/w: (\d+)/), h: num(/h: (\d+)/),
    wmPct: num(/wmPct: ([\d.]+)/),
    printDpi: num(/printDpi: (\d+)/),
    printable: /printable: true/.test(b),
  };
}

// The engine's own rules, mirrored. If these drift, the check is worthless — so
// they are asserted against the source below.
const cat = (k) => {
  const f = F[k] || {}; const g = f.group || '';
  if (k === 'business-card' || k === 'postcard-a6') return 'card';
  if (g.startsWith('Print · poster')) return 'poster';
  if (g.startsWith('Print · paged')) return 'paged';
  if (g.startsWith('Print · brochure')) return 'paged';
  if (g.startsWith('Print · wearables')) return 'poster';
  if (g.startsWith('Digital')) return 'digital';
  return 'social';
};
const SHORT = { poster: 0.30, paged: 0.27, card: 0.30 };
const WIDE = { social: 0.13, digital: 0.13 };
const AR = 342.98 / 61.30;
const markMm = (k) => {
  const f = F[k], c = cat(k), short = Math.min(f.w, f.h);
  let t = f.wmPct != null ? short * f.wmPct : SHORT[c] != null ? short * SHORT[c] : f.w * (WIDE[c] ?? 0.13);
  t = Math.max(f.w * 0.055, Math.min(t, f.w * 0.32));
  t = Math.min(t, f.h * 0.14 * AR);
  return f.printDpi ? (t / f.printDpi) * 25.4 : null;
};
const mm = (px, dpi) => (px / dpi) * 25.4;

let fail = 0;
const t = (label, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : `\n    ${detail}`}`);
  if (!ok) fail++;
};

// ── 1 · every format is the size its label claims
console.log('SIZE — the label vs the pixels\n');
const ISO = {
  'a3-portrait': [297, 420], 'a4-portrait': [210, 297], 'a4-landscape': [297, 210],
  'a5-portrait': [148, 210], 'postcard-a6': [105, 148],
  'brochure-a4': [210, 297], 'brochure-a5': [148, 210],
};
for (const [k, [ew, eh]] of Object.entries(ISO)) {
  if (!F[k]) continue;
  const aw = mm(F[k].w, F[k].printDpi), ah = mm(F[k].h, F[k].printDpi);
  t(`${k.padEnd(14)} ${aw.toFixed(1)} × ${ah.toFixed(1)} mm`,
    Math.abs(aw - ew) < 0.6 && Math.abs(ah - eh) < 0.6, `spec is ${ew} × ${eh} mm`);
}
// A ratio like "85×55" is a claim about REAL DIMENSIONS — but the unit is implied
// by the object, not by the string. A business card is 85×55 MILLIMETRES; a
// roll-up banner is 85×200 CENTIMETRES. My first version assumed mm for both and
// reported the roll-up as 765 mm wrong: a checker over-reaching, not a bug.
//
// So the unit is declared per format rather than guessed from the number, because
// "guess from the magnitude" is the same shape of mistake as the fall-through this
// file exists to catch.
const DIM_CLAIMS = {
  'business-card': { w: 85, h: 55, unit: 'mm' },
  'rollup-banner': { w: 85, h: 200, unit: 'cm' },
  'lanyard-20':    { w: 20, h: 900, unit: 'mm', tol: 3 },   // strap length is nominal
  'lanyard-25':    { w: 25, h: 900, unit: 'mm', tol: 3 },
};
for (const [k, claim] of Object.entries(DIM_CLAIMS)) {
  const f = F[k];
  if (!f?.printDpi) continue;
  const k2mm = claim.unit === 'cm' ? 10 : 1;
  const ew = claim.w * k2mm, eh = claim.h * k2mm;
  const tol = claim.tol ?? 0.6;
  const aw = mm(f.w, f.printDpi), ah = mm(f.h, f.printDpi);
  t(`${k.padEnd(14)} claims ${claim.w}×${claim.h} ${claim.unit} → ${aw.toFixed(1)} × ${ah.toFixed(1)} mm`,
    Math.abs(aw - ew) < tol && Math.abs(ah - eh) < tol,
    `off by ${(aw - ew).toFixed(1)} × ${(ah - eh).toFixed(1)} mm`);
}

// ── 2 · no print format may fall through to a screen category
console.log('\nCATEGORY — no print format may fall through to a screen scale\n');
for (const [k, f] of Object.entries(F)) {
  if (!(f.group || '').startsWith('Print')) continue;
  t(`${k.padEnd(14)} ${String(f.group).padEnd(20)} → ${cat(k)}`, cat(k) !== 'social',
    "fell through to 'social'; LOGO_SHORT_PCT has no such key, so the declared wmPct is DISCARDED");
}

// ── 3 · the shipped default must pass the app's own brand check
console.log('\nMARK — every shipped default vs the guide minimum (16 mm)\n');
for (const [k, f] of Object.entries(F)) {
  if (!f.printable) continue;
  const v = markMm(k);
  if (v === null) continue;
  if (/lanyard/.test(k)) {
    // The strap has no brand bar; its mark is composed by the layout.
    t(`${k.padEnd(14)} exempt — composes its own mark`, f.wmPct === undefined,
      'declares a wmPct it never reads: a number that looks authoritative and is dead');
    continue;
  }
  t(`${k.padEnd(14)} ${v.toFixed(1)} mm`, v >= 16, 'under the guide minimum the app itself enforces');
}

// ── 4 · the mirrored rules must still match the source
console.log('\nDRIFT — this checker mirrors the engine; do the rules still agree?\n');
t("formatCategory names 'Print · brochure'", /startsWith\('Print · brochure'\)/.test(src),
  'the engine no longer maps brochures explicitly — this checker is now lying');
t("formatCategory names 'Print · wearables'", /startsWith\('Print · wearables'\)/.test(src),
  'the engine no longer maps wearables explicitly');
t('a declared wmPct wins over the category default', /fmt\.wmPct != null\)\s*\n?\s*\? shortSide \* fmt\.wmPct/.test(src),
  'defaultWordmarkShortFrac no longer honours a declared wmPct first');

console.log(fail ? `\n✗ ${fail} failed` : '\n✓ every format is the size it claims, and every default clears the guide');
process.exit(fail ? 1 : 0);
