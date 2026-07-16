#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// EVERY LAYOUT MUST HONOUR THE SAME CONTRACT
// ─────────────────────────────────────────────────────────────────────────────
// A layout is not just a draw function. It is a promise to obey the brand system:
// the mark keeps its clear space, the type shrinks rather than overflows, the
// partner wall gets painted, the QR appears if asked, and the PDF's skipOverlays
// pass is respected so the vector text is not drawn twice.
//
// Forgetting ONE of those lines produces artwork that looks fine on the format you
// were testing and is wrong everywhere else. That is exactly how partner logos
// ended up collected-but-never-drawn, and how the split layout ran text under the
// image for months. Neither threw. Neither showed up in a build.
//
// So the contract is checked mechanically, per layout, from the source.
//
//     node ai/tools/check_layouts.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(ROOT, 'src/MedartisBrandGenerator.jsx'), 'utf8');

/** The draw function bodies, by layout key, read from the LAYOUTS registry. */
const registry = src.slice(src.indexOf('const LAYOUTS = {'), src.indexOf('\n};', src.indexOf('const LAYOUTS = {')));
const entries = [...registry.matchAll(/^  '([\w-]+)':\s*\{[^}]*?draw:.*?=>\s*(\w+)\(/gm)]
  .map((m) => ({ key: m[1], fn: m[2] }));

function bodyOf(name) {
  const at = src.search(new RegExp('^function ' + name + '\\b', 'm'));
  if (at < 0) return null;
  const end = src.indexOf('\n}\n', at);
  return src.slice(at, end);
}

// Each rule says WHY, because a failing check that only names a missing token
// teaches nobody anything.
const CONTRACT = [
  {
    id: 'clear-space',
    needs: /brandBarClearance\(/,
    why: 'must call brandBarClearance() — otherwise type walks into the mark\'s 1.5x-d zone',
    skip: ['drawLanyardStrip', 'drawBrochurePage'],   // compose their own furniture
  },
  {
    id: 'shrink-to-fit',
    needs: /textMaxH/,
    why: 'must pass frame.textMaxH — without it the type overflows its band instead of shrinking (the square-format bug)',
    skip: ['drawLanyardStrip', 'drawBrochurePage', 'drawTable', 'drawStat', 'drawDuo'], // these size their own type
  },
  {
    id: 'brand-bar',
    needs: /drawBrandBar\(/,
    why: 'must draw the brand bar — the wordmark and folio are not optional furniture',
    skip: ['drawLanyardStrip', 'drawBrochurePage'],
  },
  {
    id: 'qr',
    needs: /drawQrOverlay\(/,
    why: 'must honour the QR panel — a layout that silently drops it makes the control a lie',
    skip: ['drawBrochurePage'],
  },
  {
    id: 'partners',
    needs: /drawPartnerLogos\(/,
    why: 'must draw partner logos — they were collected-but-never-drawn for months exactly this way',
    skip: ['drawBrochurePage'],   // has its own partner WALL page type
  },
  {
    id: 'group',
    needs: /drawGroupLockup\(/,
    why: 'must draw the Group lockup — a sub-brand row that is configured-but-never-drawn is the partner-logo bug wearing a new hat',
    // drawLanyardStrip composes the Group into its own repeat block, rotated onto
    // the strap axis. drawGroupLockup's horizontal band would sit sideways to
    // everything else on a 20mm webbing. This skip is a design decision, not an
    // omission — the strap DOES honour opts.group, just not with that function.
    skip: ['drawBrochurePage', 'drawLanyardStrip'],
  },
  {
    id: 'group-inline',
    // The counterpart to the 'group' skip above. A skip is a HOLE: having excused
    // the lanyard from drawGroupLockup, nothing was left checking that it honours
    // opts.group at all — which is precisely the "configured but never drawn" bug
    // the 'group' rule exists to prevent, reintroduced by the exemption meant to
    // be careful. So the exemption comes with an obligation.
    needs: /inlineGroupLockup\(/,
    why: 'must compose the Group into its repeat block via inlineGroupLockup() — it is exempt from drawGroupLockup, not from the Group',
    only: ['drawLanyardStrip'],
  },
  {
    id: 'skip-overlays',
    needs: /skipOverlays/,
    why: 'must respect opts.skipOverlays — the vector PDF draws text itself, and without this it lands twice',
    skip: ['drawBrochurePage'],
  },
  {
    id: 'own-surface',
    // A NEGATIVE rule: the presence of this is the bug.
    forbids: /ctx\.fillStyle\s*=\s*(palette|pal)\.bg\s*;/,
    why: 'paints its own surface instead of calling paintSurface() — that is how a gradient becomes unappliable: the control moves, the swatch updates, and nine layouts flatten it back to a colour',
    skip: [],
  },
  {
    id: 'surface',
    needs: /paintSurface\(/,
    why: 'must call paintSurface() — the surface is a property of the canvas, not a favour each layout remembers to do',
    skip: [],
  },
  {
    id: 'bleed',
    needs: /bleedPx/,
    why: 'must read frame.bleedPx — a print layout that ignores it leaves white edges after the trim',
    skip: [],
  },
];

let fail = 0;
console.log(`${entries.length} layouts registered\n`);

for (const { key, fn } of entries) {
  const body = bodyOf(fn);
  if (!body) {
    console.log(`✗ ${key.padEnd(13)} → ${fn}() not found`);
    fail++;
    continue;
  }
  const misses = CONTRACT.filter((r) => {
    if (r.only && !r.only.includes(fn)) return false;   // rule aimed at one layout
    if (r.skip?.includes(fn)) return false;
    if (r.forbids) return r.forbids.test(body);      // presence is the failure
    return !r.needs.test(body);                      // absence is the failure
  });
  if (!misses.length) {
    console.log(`✓ ${key.padEnd(13)} ${fn}`);
  } else {
    fail++;
    console.log(`✗ ${key.padEnd(13)} ${fn}`);
    for (const m of misses) console.log(`    ${m.id}: ${m.why}`);
  }
}

// Every layout the menus can reach must exist, or the picker offers a crash.
const allLayouts = (src.match(/const ALL_LAYOUTS = \[([^\]]*)\]/) || [])[1] || '';
const overrides = src.slice(src.indexOf('const FORMAT_LAYOUTS_OVERRIDES = {'), src.indexOf('\n};', src.indexOf('const FORMAT_LAYOUTS_OVERRIDES = {')));
const named = new Set([
  ...[...allLayouts.matchAll(/'([\w-]+)'/g)].map((m) => m[1]),
  ...[...overrides.matchAll(/'([\w-]+)'/g)].map((m) => m[1]),
]);
const known = new Set(entries.map((e) => e.key));
// FORMAT_LAYOUTS_OVERRIDES is keyed BY FORMAT and valued by layout, so its own
// keys are format ids — only the values are layout names.
const menuLayouts = new Set([
  ...[...allLayouts.matchAll(/'([\w-]+)'/g)].map((m) => m[1]),
  ...[...overrides.matchAll(/\[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/'([\w-]+)'/g)].map((x) => x[1])),
]);
const reachableUnknown = [...menuLayouts].filter((k) => !known.has(k));
if (reachableUnknown.length) {
  console.log(`\n✗ menus name layouts that do not exist: ${reachableUnknown.join(', ')}`);
  fail++;
}

console.log(fail ? `\n✗ ${fail} layout(s) break the contract` : '\n✓ every layout honours the brand contract');
process.exit(fail ? 1 : 0);
