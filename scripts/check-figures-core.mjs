import fs from 'node:fs';

function load(jsPath, marksPath) {
  global.window = {}; global.document = { getElementById: () => ({ set innerHTML(v){}, querySelectorAll: () => [] }), createElement: () => ({ style:{}, appendChild(){} }) };
  global.buildNav = () => {};
  if (marksPath && fs.existsSync(marksPath)) new Function(fs.readFileSync(marksPath, 'utf8'))();
  new Function(fs.readFileSync(jsPath, 'utf8'))();
  return window.DOC_FIGURES;
}
const C_BLUEBG='#eff6ff', C_VIOLETBG='#f5f3ff';
const C={canvas:'#f6f7f9',paper:'#ffffff'};
const attr = (tag, name) => { const m = new RegExp(name + '="([^"]*)"').exec(tag); return m ? m[1] : null; };

function textBoxes(svg) {
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  const W = +vb[1], H = +vb[2];
  const texts = [];
  for (const m of svg.matchAll(/<text\s([^>]*)>(.*?)<\/text>/g)) {
    const tag = m[1];
    const x = +attr(tag, 'x'), y = +attr(tag, 'y'), size = +attr(tag, 'font-size');
    const anchor = attr(tag, 'text-anchor') || 'start';
    const mono = /JetBrains/.test(attr(tag, 'font-family') || '');
    const raw = m[2].replace(/&[a-z]+;/g, 'x');
    const w = raw.length * size * (mono ? 0.6 : 0.52);
    let x0 = x; if (anchor === 'middle') x0 = x - w / 2; else if (anchor === 'end') x0 = x - w;
    texts.push({ x0, x1: x0 + w, y0: y - size * 0.82, y1: y + size * 0.24, s: raw.slice(0, 22), mono, fill: attr(tag,'fill') });
  }
  const rects = [];
  for (const m of svg.matchAll(/<rect\s([^>]*)>/g)) {
    const t = m[1];
    const x = +attr(t,'x'), y = +attr(t,'y'), w = +attr(t,'width'), h = +attr(t,'height');
    if (![x,y,w,h].every(Number.isFinite)) continue;
    rects.push({ x0:x, y0:y, x1:x+w, y1:y+h, fill: attr(t,'fill'), stroke: attr(t,'stroke') });
  }
  return { W, H, texts, rects };
}
const overlap = (a, b) => a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5;

let problems = 0;
for (const spec of process.argv.slice(2)) {
  const [label, jsPath, marksPath] = spec.split('=');
  const figs = load(jsPath, marksPath);
  console.log(`\n── ${label}`);
  for (const [name, fn] of Object.entries(figs)) {
    if (typeof fn !== 'function' || fn.length > 0) continue;
    let svg; try { svg = fn(); } catch (e) { console.log(`  ✗ ${name}: threw ${e.message}`); problems++; continue; }
    const { W, H, texts, rects } = textBoxes(svg);
    const issues = [];
    for (const t of texts) {
      if (t.x0 < -1.5 || t.x1 > W + 1.5) issues.push(`clip-x "${t.s}" ${t.x0.toFixed(0)}–${t.x1.toFixed(0)} / ${W}`);
      if (t.y0 < -1.5 || t.y1 > H + 1.5) issues.push(`clip-y "${t.s}" ${t.y0.toFixed(0)}–${t.y1.toFixed(0)} / ${H}`);
    }
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++)
      if (overlap(texts[i], texts[j])) issues.push(`text⨯text "${texts[i].s}" ⨯ "${texts[j].s}"`);
    // A text crossing a BORDERED box (or a solid-colour box) that does not enclose
    // it — a subtitle sitting on a chip, say. A box that strictly contains the text
    // is its background and is fine. White text on a colour is a header label, also
    // fine. This is the check that would have caught the architecture overlap.
    for (const t of texts) {
      if (t.fill === '#fff' || t.fill === '#ffffff') continue;
      for (const r of rects) {
        const bordered = r.stroke && r.stroke !== 'none';
        const solid = r.fill && !['none','#ffffff','#fff',C_BLUEBG,C_VIOLETBG,C.canvas,C.paper].includes(r.fill);
        if (!bordered && !solid) continue;
        const enc = r.x0 <= t.x0 + 1 && r.x1 >= t.x1 - 1 && r.y0 <= t.y0 + 1 && r.y1 >= t.y1 - 1;
        if (!enc && overlap(t, r)) { issues.push(`text-on-box "${t.s}" crosses a box`); break; }
      }
    }
    if (issues.length) { console.log(`  ✗ ${name}`); issues.slice(0, 5).forEach((x) => console.log(`      ${x}`)); problems += issues.length; }
    else console.log(`  ✓ ${name.padEnd(16)} ${texts.length} texts, ${W}×${H}`);
  }
}
console.log(problems ? `\n✗ ${problems} issue(s)` : '\n✓ all figures fit and read');
process.exit(problems ? 1 : 0);
