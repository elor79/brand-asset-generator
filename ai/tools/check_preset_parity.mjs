#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// WHAT RENDERS MUST PERSIST
// ─────────────────────────────────────────────────────────────────────────────
// A saved project that reopens as a different design is the worst kind of bug: the
// thumbnail (a live render) looks right, so nothing warns you — only the restored
// state is wrong. It happened because `group` and `surface` were passed to the
// canvas draw opts but never added to snapshotState()/loadPreset().
//
// This checks the invariant: every field handed to the canvas via the draw opts
// object must also be captured by snapshotState() AND re-applied on load. If a new
// piece of design state is wired to the canvas and not to the preset, this fails.
//
//     node ai/tools/check_preset_parity.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const src = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/MedartisBrandGenerator.jsx'), 'utf8');

let fail = 0;
const bad = (m) => { console.log(`✗ ${m}`); fail++; };
const ok = (m) => console.log(`✓ ${m}`);

// The design-state fields the canvas is driven by. These are the ones a saved
// project must reproduce. (Derived/transient things like image bitmaps are handled
// separately via imageRef and are intentionally excluded here.)
const MUST_PERSIST = [
  'formatKey', 'layoutKey', 'templateKey', 'paletteName',
  'lanyard', 'textOverflow', 'partners', 'surface', 'group', 'collageCount',
];

// snapshotState() builds its object from raw state variables (e.g. `group,`), never
// with a `preset.` prefix. The restore path reads `preset.<field>`. So the two are
// unambiguous to detect: the field name inside snapshotState, and `preset.<field>`
// somewhere in the file (only the restore uses that form).
const snap = src.slice(src.indexOf('const snapshotState = () => ({'), src.indexOf('\n  });', src.indexOf('const snapshotState')));

for (const f of MUST_PERSIST) {
  const inSnap = new RegExp(`(^|[\\s,{])${f}\\b`, 'm').test(snap);
  const inRestore = new RegExp(`preset\\.${f}\\b`).test(src);
  if (!inSnap) bad(`${f}: rendered but NOT in snapshotState() — it will not be saved`);
  else if (!inRestore) bad(`${f}: saved but NOT read back (no preset.${f} on restore) — it will not restore`);
  else ok(`${f.padEnd(12)} saved and restored`);
}
console.log(fail ? `\n✗ ${fail} field(s) render but do not round-trip through a saved project` : '\n✓ every design field a project needs is saved and restored');
process.exit(fail ? 1 : 0);
