// ─────────────────────────────────────────────────────────────────────────────
// PRINTER MARKS — geometry, checked against the page
// ─────────────────────────────────────────────────────────────────────────────
//     node ai/tools/test_marks.mjs
//
// Printer marks are the one thing in the app whose bugs are INVISIBLE on screen:
// content outside the PDF MediaBox is clipped, so a mark that lands off the page
// renders a perfect-looking export and a truncated print. You find out from the
// printer, at proof stage.
//
// This drives the real pdfDrawMarks with a recording fake jsPDF and asserts on
// coordinates. It caught two live bugs the moment it existed:
//
//   · crop marks: off + len exceeded the bleed, so the outer end sat at −2.42 mm
//     on the shipped 3 mm bleed. This code capped the OFFSET — which is not the
//     term that overflows. IBRA found it while porting this panel FROM here, and
//     had the identical bug in its own original. Two independent implementations,
//     the same wrong guard.
//   · registration: the cross's arms reach rad × 1.7 from a centre at
//     bleed × 0.5, so rad = bleed × 0.5 put the arm tip off the page at every
//     bleed the 2.5 mm threshold admits.
//
// A third, found by this test on the FIX: my first correction floored the length
// at 0.6 mm — a floor that protects the mark at the page's expense, which is the
// same mistake one size down. It overflowed again at a 1 mm bleed. On a tiny
// bleed a tiny mark is the correct answer. The page always wins.
//
// The fake records rather than renders, so the assertions are about millimetres,
// not pixels — which is the only thing a printer cares about.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import os from 'node:os';
const ROOT = path.resolve(url.fileURLToPath(new URL('.', import.meta.url)), '../..');
const src = fs.readFileSync(path.join(ROOT, 'src/MedartisBrandGenerator.jsx'), 'utf8');
const defs = src.match(/const PDF_MARK_DEFAULTS = \{[\s\S]*?\n\};/)[0];
const fn = src.match(/function pdfDrawMarks\(pdf, \{[\s\S]*?\n\}\n/)[0];
// parsePageRange lives inside the component but closes over nothing.
const rng = src.match(/const parsePageRange = \(spec, count\) => \{[\s\S]*?\n  \};/)[0];
const mod = `${defs}\n${fn}\n${rng}\nexport { pdfDrawMarks, PDF_MARK_DEFAULTS, parsePageRange };`;
// Extracted rather than imported: pdfDrawMarks lives in a 10.5k-line component
// that pulls jspdf, ag-psd and a DOM. The function itself is pure.
// os.tmpdir(), not the repo: a test should not litter the source tree, and this
// mount forbids unlink() inside it — so a temp file written here is permanent.
const tmp = path.join(os.tmpdir(), `marks-${process.pid}-${Date.now()}.mjs`);
fs.writeFileSync(tmp, mod);
const { pdfDrawMarks, PDF_MARK_DEFAULTS, parsePageRange } = await import(url.pathToFileURL(tmp).href);
try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ }

const fake = () => {
  const ops = { lines: [], circles: [], rects: [], texts: [], width: null };
  return {
    ops,
    setDrawColor(){}, setFillColor(){}, setTextColor(){}, setFontSize(){}, setFont(){},
    setLineWidth(w){ ops.width = w; },
    line(a,b,c,d){ ops.lines.push([a,b,c,d]); },
    circle(x,y,r){ ops.circles.push([x,y,r]); },
    rect(x,y,w,h){ ops.rects.push([x,y,w,h]); },
    text(t,x,y){ ops.texts.push([t,x,y]); },
  };
};

let pass=0, fail=0;
const t=(n,f)=>{ try{f();pass++;console.log('  ✓',n);}catch(e){fail++;console.log('  ✗',n,'\n      '+e.message);} };
const A4 = { trimWmm: 210, trimHmm: 297 };

t('no bleed → nothing is drawn (there is nowhere to put it)', () => {
  const p = fake();
  pdfDrawMarks(p, { ...A4, bleedMm: 0, marks: { crop:true, bleed:true, registration:true }, rgb:[0,0,0] });
  if (p.ops.lines.length || p.ops.circles.length) throw new Error('drew marks with no bleed');
});

t('crop marks: 8 lines, all OUTSIDE the trim box', () => {
  const p = fake();
  pdfDrawMarks(p, { ...A4, bleedMm: 3, marks: { crop:true }, rgb:[0,0,0] });
  if (p.ops.lines.length !== 8) throw new Error(`${p.ops.lines.length} lines, expected 8`);
  const L=3, R=3+210, T=3, B=3+297;
  for (const [x1,y1,x2,y2] of p.ops.lines) {
    const insideX = (x) => x > L + 0.001 && x < R - 0.001;
    const insideY = (y) => y > T + 0.001 && y < B - 0.001;
    if (insideX(x1) && insideY(y1)) throw new Error(`a mark starts INSIDE the trim at ${x1},${y1}`);
    if (insideX(x2) && insideY(y2)) throw new Error(`a mark ends INSIDE the trim at ${x2},${y2}`);
  }
});

t('crop marks use the bleed EXACTLY — off + len never exceeds it', () => {
  // The property that matters is not "the offset is capped" (both the original
  // and the ported version capped it and were still wrong) — it is that the
  // OUTER END of the mark lands on the page. At the shipped 3mm bleed the
  // outer end must be at x=0, not at -2.42.
  for (const bleedMm of [1, 2, 3, 5, 10]) {
    const p = fake();
    pdfDrawMarks(p, { ...A4, bleedMm, marks: { crop:true, offsetMm: 2.117 }, rgb:[0,0,0] });
    const minX = Math.min(...p.ops.lines.flatMap(l=>[l[0],l[2]]));
    const minY = Math.min(...p.ops.lines.flatMap(l=>[l[1],l[3]]));
    if (minX < -1e-9 || minY < -1e-9) throw new Error(`bleed ${bleedMm}: marks left the page at ${minX.toFixed(2)},${minY.toFixed(2)}`);
  }
});

t('nothing ever leaves the page, at any bleed/offset combination', () => {
  for (const bleedMm of [1,2,3,5,10]) for (const offsetMm of [0,1,2.117,3]) {
    const p = fake();
    pdfDrawMarks(p, { ...A4, bleedMm, marks: { crop:true,bleed:true,registration:true,colourBar:true,pageInfo:true, offsetMm }, rgb:[0,0,0], pageLabel:'x' });
    const W = 210+bleedMm*2, H = 297+bleedMm*2;
    const xs = [...p.ops.lines.flatMap(l=>[l[0],l[2]]), ...p.ops.circles.map(c=>c[0]), ...p.ops.rects.map(r=>r[0])];
    const ys = [...p.ops.lines.flatMap(l=>[l[1],l[3]]), ...p.ops.circles.map(c=>c[1]), ...p.ops.rects.map(r=>r[1])];
    if (Math.min(...xs) < -0.001 || Math.min(...ys) < -0.001) throw new Error(`bleed ${bleedMm} off ${offsetMm}: negative coord`);
    if (Math.max(...xs) > W+0.001 || Math.max(...ys) > H+0.001) throw new Error(`bleed ${bleedMm} off ${offsetMm}: past the page edge`);
  }
});

t('bleed marks sit AT the bleed edge — the whole point of them', () => {
  const p = fake();
  pdfDrawMarks(p, { ...A4, bleedMm: 3, marks: { crop:false, bleed:true }, rgb:[0,0,0] });
  if (!p.ops.lines.length) throw new Error('no bleed marks');
  const touches0 = p.ops.lines.some(([x1,y1]) => Math.abs(x1) < 1e-9 || Math.abs(y1) < 1e-9);
  if (!touches0) throw new Error('bleed marks are not at the bleed edge');
});

t('registration and the colour bar need >= 2.5mm and stay silent below', () => {
  const small = fake();
  pdfDrawMarks(small, { ...A4, bleedMm: 2, marks: { crop:false, registration:true, colourBar:true }, rgb:[0,0,0] });
  if (small.ops.circles.length || small.ops.rects.length) throw new Error('drew them on a 2mm bleed');
  const ok = fake();
  pdfDrawMarks(ok, { ...A4, bleedMm: 3, marks: { crop:false, registration:true, colourBar:true }, rgb:[0,0,0] });
  if (ok.ops.circles.length !== 4) throw new Error(`${ok.ops.circles.length} registration marks, expected 4`);
  if (ok.ops.rects.length !== 7) throw new Error(`${ok.ops.rects.length} colour patches, expected 7`);
});

t('line weight is converted pt -> mm (jsPDF works in document units)', () => {
  const p = fake();
  pdfDrawMarks(p, { ...A4, bleedMm: 3, marks: { crop:true, weightPt: 0.25 }, rgb:[0,0,0] });
  const expect = 0.25/72*25.4;   // 0.0882 mm
  if (Math.abs(p.ops.width - Math.max(0.05, expect)) > 1e-6) throw new Error(`${p.ops.width} != ${expect}`);
});

t('page info prints only when asked, and only with room', () => {
  const off = fake();
  pdfDrawMarks(off, { ...A4, bleedMm: 3, marks: { crop:false, pageInfo:false }, rgb:[0,0,0], pageLabel:'IBRA' });
  if (off.ops.texts.length) throw new Error('printed page info when off');
  const on = fake();
  pdfDrawMarks(on, { ...A4, bleedMm: 3, marks: { crop:false, pageInfo:true }, rgb:[0,0,0], pageLabel:'IBRA' });
  if (on.ops.texts.length !== 1) throw new Error('did not print page info');
});

t('defaults are InDesign\'s: crop on, 6pt offset, 0.25pt', () => {
  if (PDF_MARK_DEFAULTS.crop !== true) throw new Error('crop should default on');
  if (Math.abs(PDF_MARK_DEFAULTS.offsetMm - 2.117) > 0.001) throw new Error('offset is not 6pt');
  if (PDF_MARK_DEFAULTS.weightPt !== 0.25) throw new Error('weight is not 0.25pt');
  for (const k of ['bleed','registration','colourBar','pageInfo']) {
    if (PDF_MARK_DEFAULTS[k] !== false) throw new Error(`${k} should be opt-in`);
  }
});

// ── PAGE RANGE ──────────────────────────────────────────────────────────────
console.log('\npage range');

t('empty means all', () => {
  if (parsePageRange('', 5).join() !== '0,1,2,3,4') throw new Error('empty did not give all');
  if (parsePageRange('   ', 5).length !== 5) throw new Error('whitespace did not give all');
  if (parsePageRange(null, 3).length !== 3) throw new Error('null did not give all');
});

t('single pages and ranges, 1-based in → 0-based out', () => {
  if (parsePageRange('1', 5).join() !== '0') throw new Error('single');
  if (parsePageRange('3', 5).join() !== '2') throw new Error('single mid');
  if (parsePageRange('2-4', 5).join() !== '1,2,3') throw new Error('range');
  if (parsePageRange('1,3-5', 5).join() !== '0,2,3,4') throw new Error('mixed');
  if (parsePageRange(' 1 , 3 - 5 ', 5).join() !== '0,2,3,4') throw new Error('whitespace tolerance');
});

t('duplicates collapse and order is normalised', () => {
  if (parsePageRange('3,1,3,2', 5).join() !== '0,1,2') throw new Error('did not dedupe/sort');
  if (parsePageRange('2-4,3', 5).join() !== '1,2,3') throw new Error('overlapping range');
});

t('out-of-range is clamped, not an error', () => {
  if (parsePageRange('3-99', 5).join() !== '2,3,4') throw new Error('did not clamp the top');
  if (parsePageRange('0', 5).join() !== '0') throw new Error('page 0 should clamp to the first');
  if (parsePageRange('99', 5).length !== 5) throw new Error('wholly out of range should give all');
});

t('UNPARSEABLE INPUT EXPORTS EVERYTHING — an empty PDF looks like a crash', () => {
  for (const junk of ['abc', '-', ',', 'a-b', '!!', '5-1']) {
    const r = parsePageRange(junk, 5);
    if (r.length !== 5) throw new Error(`"${junk}" gave ${r.length} pages, expected all 5`);
  }
});

t('a partly-valid spec keeps the valid part', () => {
  // "1,junk,3" is a typo, not a request for everything — honouring what parsed
  // is more useful than throwing the whole thing away.
  if (parsePageRange('1,junk,3', 5).join() !== '0,2') throw new Error('lost the valid part');
});

console.log(`\n${fail?'✗':'✓'} ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
