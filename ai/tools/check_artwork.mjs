#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// THE MARKS MUST MATCH THE ARTWORK — CHECKED, NOT ASSERTED
// ─────────────────────────────────────────────────────────────────────────────
// groupBrands.js claims its paths are "extracted verbatim from the supplied SVGs,
// never traced". That was a comment. A comment is a promise with no enforcement:
// it stays true right up until someone nudges a coordinate, and then it is a lie
// that reads like documentation.
//
// check_group re-measures the glyph bounds FROM the paths, which catches the bounds
// drifting from the artwork — but not the artwork drifting from the ARTWORK. Both
// could be wrong together and it would pass.
//
// So the real files live in assets/brand/ and this diffs the module against them,
// path by path, byte for byte. It also proves the generated `white` variant is the
// brand's OWN negative artwork rather than my recolouring being merely plausible.
//
//     node ai/tools/check_artwork.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GROUP_MARK, NEOORTHO_MARK, KERIMEDICAL_MARK, markPaths, pathBounds, markGeometry,
} from '../../src/groupBrands.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ART = path.join(ROOT, 'assets/brand');

let fail = 0;
const ok = (m) => console.log(`✓ ${m}`);
const bad = (m) => { console.log(`✗ ${m}`); fail++; };

// ── READING AN SVG THE WAY A RENDERER DOES ───────────────────────────────────
// The first version of this only looked for <path>. Every one of these files also
// contains a <polygon> and a <rect>, and both were silently dropped: NeoOrtho lost
// the "t" (it rendered "NeoOr ho"), KeriMedical lost the tilted stroke under the
// "l", and both lost a rule line.
//
// It passed. Of course it did — the check used the SAME regex as the extractor, so
// it compared my mistake against my mistake and agreed. A test that reimplements
// its subject's bug is a second copy of the bug wearing a rosette.
//
// So: every drawable element is converted to path data, and an element type this
// does NOT know how to convert is a HARD FAILURE. Silence is what got us here — an
// unhandled <use> or <text> must stop the build, not quietly produce a logo with a
// letter missing.
const TO_PATH = {
  path: (a) => /\bd="([^"]+)"/.exec(a)[1],
  rect: (a) => {
    const g = (k, d = 0) => { const m = new RegExp(`\\b${k}="([-\\d.]+)"`).exec(a); return m ? +m[1] : d; };
    const x = g('x'), y = g('y'), w = g('width'), h = g('height');
    return `M${x},${y}H${x + w}V${y + h}H${x}Z`;
  },
  polygon: (a) => {
    const pts = /points="([^"]+)"/.exec(a)[1].trim().split(/[\s,]+/).map(Number);
    let d = `M${pts[0]},${pts[1]}`;
    for (let i = 2; i < pts.length; i += 2) d += `L${pts[i]},${pts[i + 1]}`;
    return d + 'Z';
  },
  polyline: (a) => TO_PATH.polygon(a).replace(/Z$/, ''),
  line: (a) => {
    const g = (k) => +new RegExp(`\\b${k}="([-\\d.]+)"`).exec(a)[1];
    return `M${g('x1')},${g('y1')}L${g('x2')},${g('y2')}`;
  },
  circle: (a) => {
    const g = (k) => +new RegExp(`\\b${k}="([-\\d.]+)"`).exec(a)[1];
    const cx = g('cx'), cy = g('cy'), r = g('r');
    return `M${cx - r},${cy}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z`;
  },
};
const DRAWABLE = /<(path|rect|polygon|polyline|line|circle|ellipse|use|text|image)\b([^>]*?)\/?>/g;

function readSvg(file) {
  const s = fs.readFileSync(path.join(ART, file), 'utf8');
  const vb = /viewBox="([\d.\-\s]+)"/.exec(s)[1].trim().split(/\s+/).map(Number);
  const rules = {};
  for (const [, cls, body] of s.matchAll(/\.([\w-]+)\s*\{([^}]+)\}/g)) {
    const fill = /fill:\s*([^;\s]+)/.exec(body);
    rules[cls] = { fill: fill ? fill[1] : null, hidden: /display:\s*none/.test(body) };
  }
  const gStart = s.indexOf('<g id="medartis_group"');
  const gEnd = s.indexOf('<g id="KeriMedical"');
  const gCls = gStart >= 0 ? /class="([\w-]+)"/.exec(s.slice(gStart, s.indexOf('>', gStart))) : null;
  const bylineGroupHidden = !!(gCls && rules[gCls[1]]?.hidden);

  const paths = [];
  for (const m of s.matchAll(DRAWABLE)) {
    const [, tag, a] = m;
    if (!TO_PATH[tag]) {
      bad(`${file}: <${tag}> is drawable and this tool cannot convert it. Refusing to compare against a partial logo — that is exactly how NeoOrtho lost its "t".`);
      return null;
    }
    const cls = /class="([\w-]+)"/.exec(a);
    const fa = /\bfill="([^"]+)"/.exec(a);
    const rule = cls ? rules[cls[1]] : null;
    const inByline = gStart >= 0 && gEnd > gStart && m.index > gStart && m.index < gEnd;
    paths.push({
      tag,
      d: TO_PATH[tag](a),
      fill: fa ? fa[1] : (rule?.fill ?? null),
      hidden: !!rule?.hidden || (inByline && bylineGroupHidden),
      inByline,
    });
  }
  return { view: { w: vb[2], h: vb[3] }, paths, bylineGroupHidden };
}

const eqPaths = (a, b) => a.length === b.length && a.every((p, i) => p.d === b[i].d);

/**
 * The same SHAPE, however it was written down.
 *
 * Comparing `d` strings ACROSS two separately-exported files is the wrong test, and
 * it fails on artwork that is perfectly correct: KeriMedical's negative encodes a
 * horizontal line as `h7.619` where the colour file says `s7.619,0,7.619,0`. Same
 * geometry, different Illustrator export. A string diff calls that a mismatch and
 * sends you looking for a bug that is not there.
 *
 * So: flatten and compare bounds, per path and overall.
 */
function eqGeometry(a, b, eps = 0.01) {
  if (a.length !== b.length) return { same: false, why: `${a.length} paths vs ${b.length}` };
  for (let i = 0; i < a.length; i++) {
    const p = pathBounds([a[i]]), q = pathBounds([b[i]]);
    if (!p || !q) return { same: false, why: `path ${i} does not parse` };
    const d = Math.max(...['x', 'y', 'w', 'h'].map((k) => Math.abs(p[k] - q[k])));
    if (d > eps) return { same: false, why: `path ${i} bounds differ by ${d.toFixed(3)} (${p.w.toFixed(1)}×${p.h.toFixed(1)} vs ${q.w.toFixed(1)}×${q.h.toFixed(1)})` };
  }
  const A = pathBounds(a), B = pathBounds(b);
  const d = Math.max(...['x', 'y', 'w', 'h'].map((k) => Math.abs(A[k] - B[k])));
  if (d > eps) return { same: false, why: `overall bounds differ by ${d.toFixed(3)}` };
  return { same: true, identical: a.every((p, i) => p.d === b[i].d) };
}

// ── 1. Positive artwork ↔ the module ─────────────────────────────────────────
console.log('MODULE vs SUPPLIED ARTWORK\n');
const CASES = [
  { file: 'medartis_group_RGB.svg', mark: GROUP_MARK, name: 'Medartis Group' },
  { file: 'neoortho_logotype_rgb.svg', mark: NEOORTHO_MARK, name: 'NeoOrtho' },
  { file: 'KeriMedical_medartis_Group_Logo.svg', mark: KERIMEDICAL_MARK, name: 'KeriMedical' },
];
for (const { file, mark, name } of CASES) {
  const art = readSvg(file);
  if (!art) continue;
  if (art.view.w !== mark.view.w || art.view.h !== mark.view.h) {
    bad(`${name}: viewBox ${mark.view.w}×${mark.view.h} but the artwork is ${art.view.w}×${art.view.h}`);
    continue;
  }
  // Geometry, not strings. <rect> and <polygon> have no `d` in the file at all —
  // both sides synthesise one, and two correct converters can format it
  // differently. Byte-equality would fail on artwork that is exactly right.
  const geo = eqGeometry(mark.paths, art.paths);
  if (!geo.same) {
    bad(`${name}: the module is not the artwork — ${geo.why}`);
    continue;
  }
  // Every drawable must be present. This is the check that would have caught the
  // missing "t": eleven paths where the file has thirteen elements.
  if (mark.paths.length !== art.paths.length) {
    bad(`${name}: ${mark.paths.length} elements but the artwork has ${art.paths.length} — a logo with a piece missing still renders`);
    continue;
  }
  // Fills too — a right shape in the wrong colour is still the wrong logo.
  const wrongFill = mark.paths.findIndex((p, i) => (p.fill || null) !== (art.paths[i].fill || null));
  if (wrongFill >= 0) {
    bad(`${name}: element ${wrongFill} fill ${mark.paths[wrongFill].fill} but the artwork says ${art.paths[wrongFill].fill}`);
  } else {
    const kinds = art.paths.reduce((m, p) => (m[p.tag] = (m[p.tag] || 0) + 1, m), {});
    const nb = mark.paths.filter((p) => p.byline).length;
    ok(`${name.padEnd(16)} ${String(mark.paths.length).padStart(2)} elements match ${file} — ${Object.entries(kinds).map(([k, v]) => `${v} ${k}`).join(', ')}${nb ? `; ${nb} flagged byline` : ''}`);
  }
}

// ── 2. The generated negatives ↔ the brand's own negatives ───────────────────
// My `white` variant recolours every path to #FFFFFF. That is an ASSUMPTION about
// what a negative is. The brands ship real negative artwork, so it is checkable.
console.log('\nGENERATED white VARIANT vs THE BRAND\'S OWN NEGATIVE\n');
const NEG = [
  { file: 'medartis_group_neg_RGB.svg', mark: GROUP_MARK, name: 'Medartis Group' },
  { file: 'neoortho_logotype_white.svg', mark: NEOORTHO_MARK, name: 'NeoOrtho' },
  { file: 'KeriMedical_medartis_Group_Logo_neg.svg', mark: KERIMEDICAL_MARK, name: 'KeriMedical' },
];
for (const { file, mark, name } of NEG) {
  const art = readSvg(file);
  if (!art) continue;
  const mine = markPaths(mark, 'white', '#131310', true);
  const geo = eqGeometry(mine, art.paths);
  if (!geo.same) {
    bad(`${name}: my white variant is not the official negative — ${geo.why}`);
    continue;
  }
  const off = art.paths.findIndex((p, i) =>
    (p.fill || '').toLowerCase() !== mine[i].fill.toLowerCase()
    && !(p.fill === '#fff' && mine[i].fill.toLowerCase() === '#ffffff'));
  if (off >= 0) bad(`${name}: official negative path ${off} is ${art.paths[off].fill}, mine is ${mine[off].fill}`);
  else ok(`${name.padEnd(20)} my white variant IS the official negative — ${geo.identical ? 'byte-identical' : 'same geometry, re-exported encoding'} (${file})`);
}

// ── 3. The byline, against the brand's own byline-off file ───────────────────
// KeriMedical_Logo_neg.svg hides <g id="medartis_group"> with display:none. The
// brand itself ships a byline-off build — so the model is theirs, not my invention,
// and my split must land on exactly the same paths.
console.log('\nTHE BYLINE — against KeriMedical\'s own byline-off build\n');
{
  const art = readSvg('KeriMedical_Logo_neg.svg');
  if (!art) { /* already reported */ }
  else if (!art.bylineGroupHidden) {
    bad('KeriMedical_Logo_neg.svg no longer hides the medartis_group byline — the premise of the split has changed');
  } else {
    // The byline group carries display:none; its member paths are what comes off.
    const visible = art.paths.filter((p) => !p.inByline);
    const hidden = art.paths.filter((p) => p.inByline);
    const mineBrand = markGeometry(KERIMEDICAL_MARK, false).paths;
    const mineByline = KERIMEDICAL_MARK.paths.filter((p) => p.byline);
    if (!eqGeometry(mineBrand, visible).same) {
      bad(`their byline-off build shows ${visible.length} elements; mine has ${mineBrand.length}. My split is not the brand's.`);
    } else if (!eqGeometry(mineByline, hidden).same) {
      bad(`they hide ${hidden.length} elements; I flag ${mineByline.length}. My split is not the brand's.`);
    } else {
      ok(`the split is the BRAND'S: display:none on the same ${hidden.length} elements I flag \`byline\``);
      ok(`my byline-off build (${mineBrand.length} elements) === theirs, element for element`);
    }
  }
}

console.log(fail ? `\n✗ ${fail} mark(s) differ from the supplied artwork` : '\n✓ every mark is the artwork, and every negative is the brand\'s own');
process.exit(fail ? 1 : 0);
