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
  deadZones, legibleInkAt, pathBounds, markGeometry } from '../../src/groupBrands.js';
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
  // `glyph` describes the BRAND, not the byline — the lockup reserves space for
  // what it will actually draw. So re-measure from the elements that survive the
  // byline coming off.
  const measured = pathBounds(m.paths.filter((p) => !p.byline));
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

// ── 1b. The byline, on BOTH co-brands ────────────────────────────────────────
// Both files carry a "medartis group" byline. KeriMedical announces it with a
// <g id="medartis_group">; NeoOrtho does not — its byline is bare outlines, which
// is how it went on rendering underneath the Group mark unnoticed.
//
// So neither is trusted to declare itself: each must FLAG the byline, and the
// flagged elements must sit below the brand. check_artwork.mjs proves the flags
// match the real files.
console.log('');
for (const key of ['neoortho', 'kerimedical']) {
  const m = MARKS[key];
  const byl = m.paths.filter((p) => p.byline);
  const brand = m.paths.filter((p) => !p.byline);
  if (!byl.length) {
    bad(`${key}: no byline flagged. Both co-brands have one — if this mark truly lost it, say so here rather than letting the lockup repeat itself.`);
    continue;
  }
  const bb = pathBounds(byl), br = pathBounds(brand);
  // NOT "strictly below the brand". That rule sounds obvious and is false:
  // KeriMedical's tilted stroke descends to y=130, running down PAST the byline at
  // y=93-114. The artwork disproved the rule, so the rule goes — inventing a
  // geometric law and then trusting it over the real files is how you end up
  // "fixing" correct artwork.
  //
  // What is true: the byline sits in the lower part of the mark. And the authority
  // for the split is check_artwork.mjs, which diffs the flags against the brands'
  // own byline-off builds.
  const brandMid = br.y + br.h / 2;
  if (bb.y < brandMid) {
    bad(`${key}: the flagged byline starts at y ${bb.y.toFixed(1)}, above the mark's middle (${brandMid.toFixed(1)}) — that is not a byline`);
  } else {
    const off = markGeometry(m, false), on = markGeometry(m, true);
    // NOT "byline-off must be SHORTER". Also false, and again the artwork said so:
    // KeriMedical's tilted stroke reaches y=130.2, below the byline's own bottom at
    // 114.1, so dropping the byline changes the width and not the height at all.
    //
    // What must hold is containment: removing elements can never make the mark
    // cover MORE ground. That is true of every mark, it catches a stale `glyph`
    // (the thing clear space is computed from), and it does not pretend to know
    // where a brand chose to put its own strokes.
    const grew = off.glyph.x < on.glyph.x - 0.01 || off.glyph.y < on.glyph.y - 0.01
              || off.glyph.x + off.glyph.w > on.glyph.x + on.glyph.w + 0.01
              || off.glyph.y + off.glyph.h > on.glyph.y + on.glyph.h + 0.01;
    if (grew) {
      bad(`${key}: byline-off bounds (${off.glyph.w.toFixed(1)}×${off.glyph.h.toFixed(1)}) fall outside byline-on (${on.glyph.w.toFixed(1)}×${on.glyph.h.toFixed(1)}) — removing artwork cannot enlarge the mark, so a glyph is stale`);
    } else if (off.paths.length >= on.paths.length) {
      bad(`${key}: byline-off draws ${off.paths.length} elements, byline-on ${on.paths.length} — the flag is doing nothing`);
    } else {
      ok(`${key.padEnd(12)} byline separable: ${byl.length} of ${m.paths.length} elements, y ${bb.y.toFixed(0)}–${(bb.y + bb.h).toFixed(0)}`);
      ok(`${key.padEnd(12)} off ${off.paths.length} els ${off.glyph.w.toFixed(0)}×${off.glyph.h.toFixed(0)} ⊆ on ${on.paths.length} els ${on.glyph.w.toFixed(0)}×${on.glyph.h.toFixed(0)}`);
    }
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
