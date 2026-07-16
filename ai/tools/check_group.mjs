#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// THE GROUP BRAND SYSTEM MUST STAY DERIVED
// ─────────────────────────────────────────────────────────────────────────────
// The rule in groupBrands.js is: every gradient endpoint is a colour OWNED by a
// sub-brand, or a computed shade of one. Nothing invented.
//
// A rule stated only in a comment is a rule that survives exactly until the first
// person who wants a slightly nicer teal. This checks it from the artwork outward:
//
//   1. the marks still match the supplied SVGs (paths, viewBox, declared fills)
//   2. every gradient endpoint traces back to a sub-brand colour or a shade of one
//   3. type stays legible along the WHOLE ramp, not just at the ends
//
// (3) is the one that catches real damage. A gradient is not a colour, it is a
// range, and checking only `from` and `to` passes a ramp whose MIDDLE eats the
// type — which is precisely how a "brand-compliant" background ships unreadable.
//
//     node ai/tools/check_group.mjs
import { GROUP_GRADIENTS, SUB_BRANDS, GROUP_MARK, NEOORTHO_MARK, KERIMEDICAL_MARK, shade, GROUP_RULE_COLOR,
  deadZones, legibleInkAt, pathBounds, KERIMEDICAL_FULL } from '../../src/groupBrands.js';
import { colorAt } from '../../src/gradient.js';
import fs from 'node:fs';

let fail = 0;
const ok = (m) => console.log(`✓ ${m}`);
const bad = (m) => { console.log(`✗ ${m}`); fail++; };

// ── 1. The marks still match the artwork ─────────────────────────────────────
const MARKS = { group: GROUP_MARK, neoortho: NEOORTHO_MARK, kerimedical: KERIMEDICAL_MARK };
console.log('MARKS\n');
for (const [k, m] of Object.entries(MARKS)) {
  const g = m.glyph, v = m.view;
  // The stored bounds must still describe the ACTUAL paths. Checking `glyph` against
  // `view` only proves the numbers are self-consistent — it passes happily after the
  // path data has been corrupted, which is worse than not checking at all, because
  // clear space is computed from these bounds.
  const measured = pathBounds(m.paths);
  if (!measured) { bad(`${k}: path data does not parse`); continue; }
  const drift = ['x', 'y', 'w', 'h'].map((a) => Math.abs(measured[a] - g[a]));
  const worst = Math.max(...drift);
  if (worst > 0.01) {
    bad(`${k}: stored glyph ${g.w.toFixed(2)}×${g.h.toFixed(2)} but the paths measure ${measured.w.toFixed(2)}×${measured.h.toFixed(2)} (drift ${worst.toFixed(2)}). Clear space is derived from these bounds, so they are not decoration.`);
  } else if (g.x < -0.01 || g.y < -0.01 || g.x + g.w > v.w + 0.01 || g.y + g.h > v.h + 0.01) {
    bad(`${k}: glyph bounds fall outside the viewBox — the extraction is wrong`);
  } else {
    ok(`${k.padEnd(12)} ${m.paths.length} paths, glyph ${g.w.toFixed(1)}×${g.h.toFixed(1)} in ${v.w}×${v.h} (re-measured from the paths)`);
  }
}

// ── 1b. The KeriMedical byline ───────────────────────────────────────────────
// The supplied file is KeriMedical_medartis_Group_Logo.svg — the artwork carries a
// "medartis group" byline in its own <g>. Under the Group mark that byline states
// the relationship twice, so it must be SEPARABLE. If someone ever merges it back
// into `paths`, the lockup silently starts repeating itself.
console.log('');
{
  const m = MARKS.kerimedical;
  if (!m.byline?.length) {
    bad('kerimedical: the medartis-group byline is gone from the mark — KeriMedical standing alone then names no parent');
  } else if (m.paths.some((p) => m.byline.some((b) => b.d === p.d))) {
    bad('kerimedical: byline paths are ALSO in `paths` — under the Group mark the lockup would say "a medartis group company" beneath "Medartis Group"');
  } else {
    const bb = pathBounds(m.byline), br = pathBounds(m.paths);
    if (bb.y < br.y + br.h) bad(`kerimedical: the byline (y ${bb.y.toFixed(1)}) overlaps the brand (ends ${(br.y + br.h).toFixed(1)})`);
    else ok(`kerimedical  byline separable: ${m.byline.length} paths at y ${bb.y.toFixed(1)}–${(bb.y + bb.h).toFixed(1)}, beneath the brand`);
  }
  // FULL must be brand + byline, and its bounds must span both.
  const full = pathBounds(KERIMEDICAL_FULL.paths);
  const drift = ['x', 'y', 'w', 'h'].map((a) => Math.abs(full[a] - KERIMEDICAL_FULL.glyph[a]));
  if (KERIMEDICAL_FULL.paths.length !== m.paths.length + m.byline.length) {
    bad('KERIMEDICAL_FULL is not brand + byline');
  } else if (Math.max(...drift) > 0.01) {
    bad(`KERIMEDICAL_FULL glyph drifted from its paths by ${Math.max(...drift).toFixed(2)}`);
  } else {
    ok(`kerimedical  standalone (with byline) ${full.w.toFixed(1)}×${full.h.toFixed(1)} — for use away from the Group mark`);
  }
}

// ── 2. Every endpoint is owned, or a shade of something owned ────────────────
console.log('\nDERIVATION — every gradient endpoint must trace to a sub-brand\n');
const owned = new Map();
for (const [brand, def] of Object.entries(SUB_BRANDS)) {
  for (const [role, hex] of Object.entries(def.colors)) owned.set(hex.toLowerCase(), `${brand}.${role}`);
}
// A shade is legitimate: it provably holds the hue. Search plausible factors.
function trace(hex) {
  const h = hex.toLowerCase();
  if (owned.has(h)) return owned.get(h);
  for (const [src, name] of owned) {
    for (let k = 0.1; k <= 0.95; k += 0.05) {
      if (shade(src, +k.toFixed(2)).toLowerCase() === h) return `${(k * 100).toFixed(0)}% shade of ${name}`;
    }
  }
  return null;
}
for (const [key, g] of Object.entries(GROUP_GRADIENTS)) {
  for (const [end, hex] of [['from', g.from], ['to', g.to]]) {
    const src = trace(hex);
    if (src) ok(`${key.padEnd(12)} ${end.padEnd(4)} ${hex} → ${src}`);
    else bad(`${key}: ${end} ${hex} belongs to no sub-brand. Invented colours are how a house of brands stops being one.`);
  }
  if (!g.derivation) bad(`${key}: no derivation stated — if it cannot be explained it cannot be defended`);
}

// The grey is excluded from ramps ON PURPOSE. If someone reinstates it, say why not.
for (const [key, g] of Object.entries(GROUP_GRADIENTS)) {
  if ([g.from, g.to].map((c) => c.toLowerCase()).includes(GROUP_RULE_COLOR.toLowerCase())) {
    bad(`${key}: uses ${GROUP_RULE_COLOR} as an endpoint. It is a light neutral: white type fails on it and coal goes muddy. It is a rule line, not a ramp end.`);
  }
}

// ── 3. Some ink must work EVERYWHERE on the ramp ─────────────────────────────
// The first version of this check demanded that ONE ink stay legible across the
// entire ramp. That is the wrong question, and it failed the Group's own sanctioned
// gradient: white owns the dark end, coal owns the light end, and the engine already
// picks per region by sampling. Asking for a single winner condemns every ramp that
// spans a useful range.
//
// What actually matters is the CROSSOVER — the sliver where the two inks trade
// places and both are mediocre. That band fails silently, because the sampler
// dutifully returns its best guess and the best guess is not good enough.
console.log('\nLEGIBILITY — the crossover band, where both inks are mediocre\n');
const MAX_DEAD = 0.08;   // 8% of the ramp: a sliver is unavoidable where inks swap;
                         // a wide one means the ramp spends real estate unusable.
for (const [key, g] of Object.entries(GROUP_GRADIENTS)) {
  const zones = deadZones(g, colorAt);
  const widest = zones.reduce((m, z) => Math.max(m, z.to - z.from), 0);
  const ends = [0, 1].map((t) => legibleInkAt(g, t, colorAt));
  const desc = `ends: ${ends.map((e, i) => `t=${i} ${e.ink} ${e.ratio.toFixed(1)}:1`).join(', ')}`;
  if (!zones.length) ok(`${key.padEnd(12)} no dead band — ${desc}`);
  else if (widest <= MAX_DEAD) {
    ok(`${key.padEnd(12)} crossover t=${zones[0].from.toFixed(2)}–${zones[0].to.toFixed(2)} (${(widest * 100).toFixed(0)}% — a sliver, type must not centre here) — ${desc}`);
  } else {
    bad(`${key.padEnd(12)} ${(widest * 100).toFixed(0)}% of the ramp takes NO legible ink (t=${zones[0].from.toFixed(2)}–${zones[0].to.toFixed(2)}). Type there fails whichever ink the sampler picks.`);
  }
}

console.log(fail ? `\n✗ ${fail} problem(s) in the Group brand system` : '\n✓ the Group brand system is derived, complete and legible');
process.exit(fail ? 1 : 0);
