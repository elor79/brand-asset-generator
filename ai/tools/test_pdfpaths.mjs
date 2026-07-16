#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// THE PDF PATH CONVERTER MUST AGREE WITH THE CANVAS
// ─────────────────────────────────────────────────────────────────────────────
// There are two renderers for the same artwork: the browser's Path2D (canvas) and
// svgPathToPdfOps (print). When they disagree, the screen is right and the proof is
// wrong, which is the worst possible split — you approve one and print the other.
//
// They disagreed. svgPathToPdfOps never reset the smooth-curve reflection point on
// a line command, so `v29.257s7.619,0,7.619,0` reflected a control point from some
// earlier curve. KeriMedical printed 63% too wide and burst out of a 20mm strap
// while the canvas drew it perfectly. It was invisible for as long as the only
// artwork was the medartis wordmark, which happens never to use that pattern.
//
// So: every path of every mark, converted, measured, and compared against the
// canvas flattener. Not "does it parse" — does it come out the same SHAPE.
//
//     node ai/tools/test_pdfpaths.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROUP_MARK, NEOORTHO_MARK, KERIMEDICAL_MARK, pathBounds } from '../../src/groupBrands.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(ROOT, 'src/MedartisBrandGenerator.jsx'), 'utf8');
const bodyOf = (n) => {
  const a = src.search(new RegExp('^function ' + n + '\\b', 'm'));
  if (a < 0) return null;
  return src.slice(a, src.indexOf('\n}\n', a) + 3);
};

let fail = 0;
const ok = (m) => console.log(`✓ ${m}`);
const bad = (m) => { console.log(`✗ ${m}`); fail++; };

const body = bodyOf('svgPathToPdfOps');
if (!body) { bad('svgPathToPdfOps not found'); process.exit(1); }
const toOps = new Function(body + '\nreturn svgPathToPdfOps;')();

// Flatten the converter's cubics the same way the canvas flattener does, so the two
// bounds are measuring the same thing. Comparing raw control points to flattened
// curves would report a difference that is not there.
function opsBounds(ops) {
  const xs = [], ys = [];
  let px = 0, py = 0;
  for (const o of ops) {
    if (o.op === 'M' || o.op === 'L') { xs.push(o.x); ys.push(o.y); px = o.x; py = o.y; }
    else if (o.op === 'C') {
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, m = 1 - t;
        xs.push(m*m*m*px + 3*m*m*t*o.x1 + 3*m*t*t*o.x2 + t*t*t*o.x);
        ys.push(m*m*m*py + 3*m*m*t*o.y1 + 3*m*t*t*o.y2 + t*t*t*o.y);
      }
      px = o.x; py = o.y;
    }
  }
  if (!xs.length) return null;
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
}

const MARKS = { 'medartis group': GROUP_MARK, NeoOrtho: NEOORTHO_MARK, KeriMedical: KERIMEDICAL_MARK };
for (const [name, mark] of Object.entries(MARKS)) {
  let worst = 0, worstAt = -1;
  for (const [i, p] of mark.paths.entries()) {
    const a = opsBounds(toOps(p.d));
    const b = pathBounds([p]);
    if (!a) { bad(`${name} path ${i}: converter produced nothing`); continue; }
    const d = Math.max(...['x', 'y', 'w', 'h'].map((k) => Math.abs(a[k] - b[k])));
    if (d > worst) { worst = d; worstAt = i; }
  }
  if (worst > 0.05) bad(`${name}: path ${worstAt} differs between the PDF converter and the canvas by ${worst.toFixed(2)} units — the proof will not be what you approved`);
  else ok(`${name.padEnd(15)} ${String(mark.paths.length).padStart(2)} paths, PDF === canvas (worst drift ${worst.toFixed(3)})`);
}

// The specific rule that was broken, stated as a rule rather than an anecdote.
const SPEC = 'M0,0 L10,0 s5,0,10,0';   // a smooth curve straight after a LINE
const b = opsBounds(toOps(SPEC));
if (!b) bad('spec case produced nothing');
else if (b.h > 0.01) {
  bad(`a smooth curve after a LINE must reflect the CURRENT point (SVG spec), giving a flat line. It bulges ${b.h.toFixed(2)} — lastC is stale again.`);
} else ok(`'s' after a line reflects the current point, per spec — the curve stays flat`);

console.log(fail ? `\n✗ ${fail} problem(s): the print will differ from the screen` : '\n✓ the PDF converter and the canvas draw the same shapes');
process.exit(fail ? 1 : 0);
