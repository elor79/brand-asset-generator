// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTATION CONTENT + INFOGRAPHICS
// ─────────────────────────────────────────────────────────────────────────────
// Every figure here is drawn from the same numbers the application uses — the mark
// geometry in window.MARKS (the real artwork), the sub-brand hexes, the measured
// cap heights. Nothing is a screenshot, so nothing drifts when the tool changes.
//
// The helpers up top render a real mark; the sections below are the prose. Keeping
// them in one file means a figure and the paragraph that explains it cannot fall
// out of step.

const C = {
  coal: '#131310', ink: '#1d1d1b', ink600: '#555550', ink300: '#9A9A8E',
  ink100: '#D8D6CA', paper: '#FFFFFF', bone: '#F4F2EA', gold: '#CFAB5C',
  goldDeep: '#8A6828', neoV: '#582d83', neoT: '#00afb9', keriB: '#001a72', keriG: '#bbbdbd',
};

/* ── Render a real mark into a box, cap-matched and baseline-aware ──────────── */
function markSVG(key, { color, h = 40, alignBaseline = null } = {}) {
  const m = window.MARKS[key];
  const g = m.glyph;
  const scale = h / g.h;
  const w = g.w * scale;
  const paths = m.paths.map((p) => {
    const fill = color === 'white' ? '#fff' : color === 'coal' ? C.coal : (p.fill || C.coal);
    return `<path fill="${fill}" d="${p.d}"/>`;
  }).join('');
  return `<svg width="${w.toFixed(1)}" height="${h}" viewBox="${g.x} ${g.y} ${g.w} ${g.h}" style="display:block">${paths}</svg>`;
}
function markWidth(key, h) { const g = window.MARKS[key].glyph; return g.w * (h / g.h); }

/* ═══ INFOGRAPHIC 1 · The house of brands ══════════════════════════════════ */
function figHierarchy() {
  const W = 820, H = 340;
  const cx = W / 2;
  // The Group mark on top; three brands beneath, connected by an org-chart rule.
  const groupH = 34, kidH = 26, kidY = 232;
  const gw = markWidth('group', groupH);
  const kids = [
    { key: 'medartis', label: 'medartis', note: 'the main brand' },
    { key: 'neoortho', label: 'NeoOrtho', note: 'sub-brand' },
    { key: 'kerimedical', label: 'KeriMedical', note: 'sub-brand' },
  ];
  // medartis wordmark isn't in MARKS (the engine owns it); draw it as text at the
  // right cap so the row still reads true.
  const slotW = W / 3;
  let out = `<svg viewBox="0 0 ${W} ${H}">`;
  out += `<rect width="${W}" height="${H}" fill="${C.coal}"/>`;
  // the house
  out += `<g transform="translate(${cx - gw / 2}, 40)">${markSVG('group', { color: 'white', h: groupH })}</g>`;
  out += `<text x="${cx}" y="102" fill="${C.ink300}" font-family="var(--mono)" font-size="10" letter-spacing="1.5" text-anchor="middle">THE HOUSE</text>`;
  // connectors
  out += `<line x1="${cx}" y1="118" x2="${cx}" y2="150" stroke="${C.gold}" stroke-width="1"/>`;
  out += `<line x1="${slotW * 0.5}" y1="150" x2="${slotW * 2.5}" y2="150" stroke="${C.gold}" stroke-width="1"/>`;
  kids.forEach((k, i) => {
    const kx = slotW * (i + 0.5);
    out += `<line x1="${kx}" y1="150" x2="${kx}" y2="182" stroke="${C.gold}" stroke-width="1"/>`;
    if (k.key === 'medartis') {
      out += `<text x="${kx}" y="${kidY - 2}" fill="#fff" font-family="var(--display)" font-size="26" font-weight="300" text-anchor="middle">medartis</text>`;
    } else {
      const wpx = markWidth(k.key, kidH);
      out += `<g transform="translate(${kx - wpx / 2}, ${kidY - kidH})">${markSVG(k.key, { color: 'white', h: kidH })}</g>`;
    }
    out += `<text x="${kx}" y="285" fill="${C.ink300}" font-family="var(--mono)" font-size="9.5" letter-spacing="1" text-anchor="middle">${k.note.toUpperCase()}</text>`;
  });
  out += `</svg>`;
  return out;
}

/* ═══ INFOGRAPHIC 2 · Cap-match vs box-match ═══════════════════════════════ */
function figCapMatch() {
  const W = 820, rowH = 150;
  const marks = ['group', 'neoortho', 'kerimedical'];
  const draw = (matchBy, y0, title, sub) => {
    let s = `<text x="0" y="${y0 - 14}" font-family="var(--mono)" font-size="11" letter-spacing="1" fill="${C.coal}" font-weight="600">${title}</text>`;
    s += `<text x="0" y="${y0 + 2}" font-family="var(--mono)" font-size="9.5" fill="${C.ink600}">${sub}</text>`;
    const baseY = y0 + rowH - 30;
    const slot = W / 3;
    const cap = 34;
    marks.forEach((key, i) => {
      const g = window.MARKS[key].glyph;
      let h;
      if (matchBy === 'cap') {
        // cap-matched: every mark drawn so its CAP height is `cap`. KeriMedical's
        // box is 3.13× its cap, so it is the tallest box but the caps agree.
        const m = window.MARKS[key];
        h = cap * (g.h / (key === 'kerimedical' ? 41.45 : key === 'group' ? 14.26 : g.h));
        if (key === 'group') h = cap * (g.h / 14.26);
        if (key === 'neoortho') h = cap; // ratio ~1
        if (key === 'kerimedical') h = cap * (g.h / 41.45);
      } else {
        h = cap * 1.0; // box-matched: all boxes the same height → letters unequal
      }
      const w = g.w * (h / g.h);
      const cx = slot * (i + 0.5);
      s += `<g transform="translate(${cx - w / 2}, ${baseY - h})">${markSVG(key, { color: 'white', h })}</g>`;
    });
    // a baseline for the cap-matched row
    if (matchBy === 'cap') s += `<line x1="20" y1="${baseY}" x2="${W - 20}" y2="${baseY}" stroke="${C.gold}" stroke-width="1" stroke-dasharray="3 3"/>`;
    return s;
  };
  let out = `<svg viewBox="0 0 ${W} ${rowH * 2 + 60}">`;
  out += `<rect width="${W}" height="${rowH * 2 + 60}" fill="${C.coal}"/>`;
  out += draw('box', 44, 'MATCHED BY BOUNDING BOX', 'the letters come out unequal — KeriMedical shrinks and floats');
  out += draw('cap', rowH + 84, 'MATCHED BY CAP HEIGHT · ONE BASELINE', 'the letters agree; KeriMedical’s bars and stroke simply extend past the line');
  out += `</svg>`;
  return out;
}

/* ═══ INFOGRAPHIC 3 · Gradient ramp + crossover ════════════════════════════ */
function figGradient(stops, label, deadFrom, deadTo) {
  const W = 820, H = 120, barY = 30, barH = 44;
  // Sample the ramp the way colorAt() does — evenly spaced stops, linear here.
  const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const col = (t) => {
    const seg = t * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(seg));
    const c = lerp(hx(stops[i]), hx(stops[i + 1]), seg - i);
    return `rgb(${c.join(',')})`;
  };
  const N = 60;
  let bars = '';
  for (let i = 0; i < N; i++) bars += `<rect x="${(i / N) * W}" y="${barY}" width="${W / N + 0.5}" height="${barH}" fill="${col(i / N)}"/>`;
  let out = `<svg viewBox="0 0 ${W} ${H}">`;
  out += `<text x="0" y="18" font-family="var(--mono)" font-size="11" letter-spacing="1" fill="${C.coal}" font-weight="600">${label}</text>`;
  out += bars;
  // the crossover band, where neither ink clears 4.5:1
  if (deadFrom != null) {
    const x0 = deadFrom * W, x1 = deadTo * W;
    out += `<rect x="${x0}" y="${barY}" width="${Math.max(2, x1 - x0)}" height="${barH}" fill="none" stroke="${C.gold}" stroke-width="2"/>`;
    out += `<line x1="${(x0 + x1) / 2}" y1="${barY + barH}" x2="${(x0 + x1) / 2}" y2="${barY + barH + 12}" stroke="${C.gold}"/>`;
    out += `<text x="${(x0 + x1) / 2}" y="${barY + barH + 26}" font-family="var(--mono)" font-size="9" fill="${C.goldDeep}" text-anchor="middle">CROSSOVER · keep type off this band</text>`;
  } else {
    out += `<text x="${W / 2}" y="${barY + barH + 22}" font-family="var(--mono)" font-size="9" fill="${C.ink600}" text-anchor="middle">no dead band — an ink is legible across the whole ramp</text>`;
  }
  // stop swatches with hexes
  stops.forEach((s, i) => {
    const x = (i / (stops.length - 1)) * W;
    const anchor = i === 0 ? 'start' : i === stops.length - 1 ? 'end' : 'middle';
    out += `<text x="${x}" y="${barY - 6}" font-family="var(--mono)" font-size="9" fill="${C.ink600}" text-anchor="${anchor}">${s}</text>`;
  });
  out += `</svg>`;
  return out;
}

/* ═══ INFOGRAPHIC 4 · The lanyard, in line ═════════════════════════════════ */
function figLanyard() {
  const W = 820, H = 150, strapW = 70;
  const x0 = 40;
  let out = `<svg viewBox="0 0 ${W} ${H}">`;
  // the strap
  out += `<rect x="${x0}" y="10" width="${strapW}" height="${H - 20}" fill="${C.coal}"/>`;
  out += `<line x1="${x0 + 5}" y1="10" x2="${x0 + 5}" y2="${H - 10}" stroke="${C.gold}" stroke-width="1.2"/>`;
  out += `<line x1="${x0 + strapW - 5}" y1="10" x2="${x0 + strapW - 5}" y2="${H - 10}" stroke="${C.gold}" stroke-width="1.2"/>`;
  // the lockup rotated 90° reading up the strap
  const cap = 12;
  const cx = x0 + strapW / 2;
  const marks = ['group', 'neoortho', 'kerimedical'];
  let along = 30;
  out += `<g transform="translate(${cx}, ${H - 20}) rotate(-90)">`;
  marks.forEach((key) => {
    const h = key === 'group' ? cap * (window.MARKS[key].glyph.h / 14.26)
            : key === 'kerimedical' ? cap * (window.MARKS[key].glyph.h / 41.45) : cap;
    const w = markWidth(key, h);
    out += `<g transform="translate(${along}, ${-h / 2})">${markSVG(key, { color: 'white', h })}</g>`;
    along += w + cap * 2.6;
  });
  out += `</g>`;
  // annotation
  out += `<text x="${x0 + strapW + 30}" y="34" font-family="var(--mono)" font-size="11" fill="${C.coal}" font-weight="600">~20 mm of webbing</text>`;
  out += `<text x="${x0 + strapW + 30}" y="54" font-family="var(--display)" font-size="14" fill="${C.ink600}">Stacked across it, three marks get 6 mm each and none survive.</text>`;
  out += `<text x="${x0 + strapW + 30}" y="76" font-family="var(--display)" font-size="14" fill="${C.ink600}">In line, they share the strap’s one abundant dimension —</text>`;
  out += `<text x="${x0 + strapW + 30}" y="94" font-family="var(--display)" font-size="14" fill="${C.ink600}">its length. Cap-matched, one baseline, rotated onto the axis.</text>`;
  out += `<text x="${x0 + strapW + 30}" y="122" font-family="var(--mono)" font-size="10" fill="${C.goldDeep}">The byline comes off: under the Group mark it would state the</text>`;
  out += `<text x="${x0 + strapW + 30}" y="136" font-family="var(--mono)" font-size="10" fill="${C.goldDeep}">same relationship twice.</text>`;
  out += `</svg>`;
  return out;
}

/* ═══ INFOGRAPHIC 5 · The derivation rule ══════════════════════════════════ */
function figDerivation() {
  const W = 820, H = 250;
  let out = `<svg viewBox="0 0 ${W} ${H}">`;
  // three source swatches → the group ramp
  const src = [
    { c: C.neoV, l: 'NeoOrtho violet', h: '#582d83' },
    { c: C.neoT, l: 'NeoOrtho teal', h: '#00afb9' },
    { c: C.keriB, l: 'KeriMedical blue', h: '#001a72' },
    { c: C.keriG, l: 'KeriMedical grey', h: '#bbbdbd', excluded: true },
    { c: C.coal, l: 'medartis coal', h: '#131310' },
  ];
  src.forEach((s, i) => {
    const y = 20 + i * 42;
    out += `<rect x="0" y="${y}" width="60" height="30" fill="${s.c}" stroke="${s.excluded ? C.gold : 'none'}" stroke-width="${s.excluded ? 2 : 0}" stroke-dasharray="${s.excluded ? '4 3' : ''}"/>`;
    out += `<text x="70" y="${y + 14}" font-family="var(--mono)" font-size="11" fill="${C.coal}">${s.h}</text>`;
    out += `<text x="70" y="${y + 27}" font-family="var(--display)" font-size="11" fill="${s.excluded ? C.goldDeep : C.ink600}">${s.l}${s.excluded ? ' — excluded as an endpoint (white fails, coal goes muddy)' : ''}</text>`;
  });
  // the rule, boxed on the right
  out += `<rect x="470" y="60" width="350" height="120" fill="${C.bone}" stroke="${C.keriB}" stroke-width="2"/>`;
  out += `<text x="486" y="86" font-family="var(--mono)" font-size="10" letter-spacing="1.5" fill="${C.keriB}">THE RULE</text>`;
  const rule = ['Every gradient endpoint is a colour', 'OWNED by a sub-brand, or a computed', 'shade of one. Nothing is invented, and', 'nothing is blended into existence to', '“bridge” two brand colours — that', 'intermediate belongs to nobody.'];
  rule.forEach((l, i) => out += `<text x="486" y="${108 + i * 15}" font-family="var(--display)" font-size="12.5" fill="${C.ink}">${l}</text>`);
  out += `</svg>`;
  return out;
}

/* ═══ INFOGRAPHIC 6 · The check suite ══════════════════════════════════════ */
function figChecks() {
  const checks = [
    ['check_artwork', 'every mark IS the supplied SVG, byte-for-byte'],
    ['check_group', 'every gradient endpoint traces to a brand'],
    ['check_layouts', 'every layout honours the brand contract'],
    ['test_baselinerow', 'one cap height, one baseline, fits everywhere'],
    ['test_pdfpaths', 'the PDF converter draws what the canvas draws'],
    ['test_gradient', 'two stops or four, the ramp is the ramp'],
    ['test_groupband', 'the lockup band terminates and is reserved'],
    ['check_hook_deps', 'every hook dep is declared before it is named'],
  ];
  const W = 820, rowH = 34;
  let out = `<svg viewBox="0 0 ${W} ${checks.length * rowH + 30}">`;
  checks.forEach(([name, why], i) => {
    const y = 20 + i * rowH;
    out += `<rect x="0" y="${y}" width="${W}" height="${rowH - 6}" fill="${i % 2 ? C.bone : C.paper}" stroke="${C.ink100}"/>`;
    out += `<circle cx="18" cy="${y + (rowH - 6) / 2}" r="5" fill="${C.neoT}"/>`;
    out += `<text x="36" y="${y + 18}" font-family="var(--mono)" font-size="11.5" fill="${C.coal}" font-weight="600">${name}</text>`;
    out += `<text x="240" y="${y + 18}" font-family="var(--display)" font-size="12.5" fill="${C.ink600}">${why}</text>`;
  });
  out += `</svg>`;
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Content is assembled in content-text.js (loaded after this) to keep figures and
// prose in separate, legible files.
// ─────────────────────────────────────────────────────────────────────────────
window.DOC_FIGURES = { figHierarchy, figCapMatch, figGradient, figLanyard, figDerivation, figChecks, markSVG, markWidth, C };
