// ─────────────────────────────────────────────────────────────────────────────
// LOGO → VECTOR (SVG / PDF)
// ─────────────────────────────────────────────────────────────────────────────
// A "download the logo" button has to hand out a file that IS the logo on screen
// — not a lookalike. So this builds from the SAME path data the canvas engine
// draws (WORDMARK_PATHS / WM_GLYPH), rather than re-tracing or re-typesetting it.
//
// The Medartis mark is real outline artwork, not generated type. That matters:
// a <text> element would silently fall back to Helvetica on a machine without
// Inter, and the printer would set your logo in the wrong typeface without ever
// knowing something was missing. Outlines cannot do that.
//
// Clear space is the brand rule, baked in: 1.5 × the height of the "d" on every
// side (see WM_CLEAR_RATIO in the engine). The shipped asset already encodes it —
// its transparent border is exactly 1.5 × the glyph height — so "with clear space"
// is simply the artwork's own viewBox, and "tight" is the glyph box.

/** Build the wordmark as a standalone SVG string. */
export function buildLogoSvg({
  paths,                 // WORDMARK_PATHS — the same array the canvas fills
  glyph,                 // WM_GLYPH  { x, y, w, h }
  view,                  // WM_VIEW   { w, h }
  color = '#131310',
  clearSpace = true,
  height = 1000,         // vector: this only sets the viewBox scale
} = {}) {
  if (!paths?.length || !glyph || !view) throw new Error('Logo geometry is missing.');

  // With clear space → the asset's own box. Tight → crop to the glyphs.
  const box = clearSpace
    ? { x: 0, y: 0, w: view.w, h: view.h }
    : { x: glyph.x, y: glyph.y, w: glyph.w, h: glyph.h };
  const scale = height / box.h;
  const wOut = +(box.w * scale).toFixed(2);
  const hOut = +(box.h * scale).toFixed(2);

  const body = paths
    .map((d) => `    <path d="${d}"/>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${wOut}" height="${hOut}"
     viewBox="${box.x} ${box.y} ${box.w} ${box.h}"
     role="img" aria-label="Medartis">
  <title>Medartis</title>
  <g fill="${color}">
${body}
  </g>
</svg>
`;
}


// ─────────────────────────────────────────────────────────────────────────────
// MULTI-COLOUR MARKS (the Group and the sub-brands)
// ─────────────────────────────────────────────────────────────────────────────
// buildLogoSvg above takes `paths` as an array of `d` STRINGS and wraps them in a
// single <g fill="...">, because the medartis wordmark is one colour by definition.
//
// The sub-brands are not. NeoOrtho is violet AND teal; KeriMedical is blue AND
// grey. Pushing them through the single-fill path would silently flatten each to
// one colour — the file would open, look almost right, and be wrong. So they get
// their own builder rather than a hopeful reuse of this one.
export function buildMarkSvg({ mark, label, variant = 'color', inkColor = '#131310', clearSpace = true, height = 1000 }) {
  if (!mark?.paths?.length) throw new Error(`${label}: mark geometry is missing.`);
  const { view, glyph } = mark;
  const box = clearSpace
    ? { x: 0, y: 0, w: view.w, h: view.h }
    : { x: glyph.x, y: glyph.y, w: glyph.w, h: glyph.h };
  const scale = height / box.h;
  const wOut = +(box.w * scale).toFixed(2);
  const hOut = +(box.h * scale).toFixed(2);

  const body = mark.paths.map((p) => {
    const fill = variant === 'white' ? '#FFFFFF'
               : variant === 'mono'  ? inkColor
               : (p.fill || inkColor);
    return `    <path fill="${fill}" d="${p.d}"/>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${wOut}" height="${hOut}"
     viewBox="${box.x} ${box.y} ${box.w} ${box.h}"
     role="img" aria-label="${label}">
  <title>${label}</title>
${body}
</svg>
`;
}

/** SVG string → a jsPDF document sized exactly to the artwork. */
export async function svgToPdf(svg, { jsPDF, svg2pdf }) {
  if (!jsPDF || !svg2pdf) throw new Error('PDF tools were not provided.');
  const el = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  const w = parseFloat(el.getAttribute('width'));
  const h = parseFloat(el.getAttribute('height'));

  // svg2pdf measures through the DOM, so the element has to be attached and have
  // a real size — off-screen, not display:none, which would measure as zero.
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;';
  host.appendChild(el);
  document.body.appendChild(host);
  try {
    const pdf = new jsPDF({
      orientation: w > h ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [w, h],
      compress: true,
    });
    await svg2pdf(el, pdf, { x: 0, y: 0, width: w, height: h });
    return pdf;
  } finally {
    host.remove();
  }
}

/**
 * Every variant × colour × format, plus the palette and a README.
 *
 * Returns [{ name, data }] where data is a string or a Uint8Array — the shape
 * makeZip() consumes. NOT Blobs: a Blob has to be awaited to read its bytes, and
 * the zip writer is synchronous. (It cost me a "bytes is undefined" to learn that
 * the hard way, and a test that stubbed Blob and so never caught it.)
 *
 * The README is not padding: it answers the questions an agency would otherwise
 * email you about a week before print — which file to use on a dark background,
 * how much clear space, what the minimum size is. Answering them in the zip is
 * cheaper than answering them twice.
 */
export async function buildBrandKit({
  paths, glyph, view,
  colors,                    // { key: { hex, label } }
  brand,                     // BRAND tokens, for the palette file
  formats = ['svg', 'pdf'],
  clearSpace = true,
  pdfTools = null,           // { jsPDF, svg2pdf } — required if 'pdf' is asked for
  groupMarks = null,         // [{ key, label, mark, variants: [...] }] — the house
  gradients = null,          // { key: { from, to, label, derivation } }
  onProgress = () => {},
} = {}) {
  const files = [];
  const entries = Object.entries(colors);
  const groupJobs = (groupMarks || []).flatMap((m) =>
    (m.variants || ['color']).map((v) => ({ ...m, variant: v }))
  );
  // The total must count the Group work too, or the progress bar reaches 100% and
  // then keeps going — which reads as a hang.
  const total = entries.length * formats.length
              + groupJobs.length * formats.length
              + 2 + (gradients ? 1 : 0);
  let done = 0;
  const step = (label) => onProgress(++done, total, label);   // positional, as in the IBRA kit

  for (const [key, c] of entries) {
    const svg = buildLogoSvg({ paths, glyph, view, color: c.hex, clearSpace });
    const base = `medartis_wordmark_${key}`;
    if (formats.includes('svg')) {
      files.push({ name: `logos/svg/${base}.svg`, data: svg });
      step(`${base}.svg`);
    }
    if (formats.includes('pdf')) {
      if (!pdfTools) throw new Error('PDF was requested but no PDF tools were provided.');
      const pdf = await svgToPdf(svg, pdfTools);
      // arraybuffer → Uint8Array: the zip writer needs real bytes, synchronously.
      files.push({ name: `logos/pdf/${base}.pdf`, data: new Uint8Array(pdf.output('arraybuffer')) });
      step(`${base}.pdf`);
    }
  }

  // ── The Group and sub-brand marks ──────────────────────────────────────────
  for (const job of groupJobs) {
    const svg = buildMarkSvg({
      mark: job.mark, label: job.label, variant: job.variant,
      inkColor: brand?.ink || '#131310', clearSpace,
    });
    const base = `${job.key}_${job.variant}`;
    if (formats.includes('svg')) {
      files.push({ name: `logos/group/svg/${base}.svg`, data: svg });
      step(`${base}.svg`);
    }
    if (formats.includes('pdf')) {
      if (!pdfTools) throw new Error('PDF was requested but no PDF tools were provided.');
      const pdf = await svgToPdf(svg, pdfTools);
      files.push({ name: `logos/group/pdf/${base}.pdf`, data: new Uint8Array(pdf.output('arraybuffer')) });
      step(`${base}.pdf`);
    }
  }

  if (gradients) {
    // Every gradient, with the RULE that produced it. A hex list without the
    // derivation is how the next person "improves" the teal.
    const lines = Object.entries(gradients).map(([k, g]) =>
      `${k.padEnd(14)} ${g.from.toUpperCase()} -> ${g.to.toUpperCase()}\n${' '.repeat(14)} ${g.label}\n${' '.repeat(14)} ${g.derivation || ''}\n`
    ).join('\n');
    files.push({
      name: 'gradients.txt',
      data: `MEDARTIS GROUP · GRADIENTS\n${'='.repeat(60)}\n\n`
          + `THE RULE\n`
          + `  Every endpoint is a colour OWNED by a sub-brand, or a computed shade\n`
          + `  of one. Nothing is invented, and nothing is blended into existence to\n`
          + `  "bridge" two brand colours -- that intermediate belongs to nobody.\n\n`
          + lines
          + `\nNOT A GRADIENT ENDPOINT\n`
          + `  KeriMedical grey is a real brand colour and a bad ramp end: white type\n`
          + `  fails on it and dark type goes muddy. Use it as a rule line.\n`,
    });
    step('gradients.txt');
  }

  const palette = Object.entries(brand ?? {})
    .filter(([, v]) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v))
    .map(([k, v]) => `${k.padEnd(12)} ${v.toUpperCase()}`)
    .join('\n');
  files.push({ name: 'palette.txt', data: palette });
  step('palette.txt');

  const readme = `MEDARTIS · LOGO FILES
${'='.repeat(60)}

WHICH FILE?
  _ink    dark artwork — for light surfaces (paper, bone, cream)
  _bone   light artwork — for dark surfaces (coal) and over photography
  Never recolour the mark to anything else, and never place the dark mark on a
  dark surface "because it still reads". It does not.

THE GROUP, AND ITS BRANDS  (logos/group/)
  Medartis Group          the house
    |-- medartis          the main brand  (the wordmark above)
    |-- KeriMedical
    +-- NeoOrtho

  The Group mark REPLACES the medartis wordmark. It does not join it: an asset
  showing both says it was sent by two organisations.

  kerimedical              WITH the "medartis group" byline. Use when KeriMedical
                           appears ALONE — the byline is the only thing naming its
                           parent.
  kerimedical_no-byline    WITHOUT it. Use under the Medartis Group mark, where the
                           byline would state the same relationship a second time,
                           in the opposite direction.

  Both ship because choosing wrongly is silent — the file opens, it looks right,
  and it says the same thing twice.

  _color   the brand's own colours (NeoOrtho violet/teal, KeriMedical blue/grey)
  _white   negative artwork, for dark or saturated surfaces
  _mono    single-colour, for gradients and anywhere colour cannot survive

  The Medartis Group mark is monochrome by design; it ships _mono and _white only.

  See gradients.txt for the ramps and the rule that produced them.

CLEAR SPACE
  ${clearSpace ? 'BAKED IN' : 'NOT INCLUDED — these files are cropped tight to the glyphs'}
  The rule: 1.5 x the height of the letter "d" on every side. Nothing — type,
  image edge, page edge, another logo — may enter it.
  ${clearSpace ? 'These files already carry it as transparent margin, so placing the file edge-to-edge is correct.' : 'You must add it yourself.'}

MINIMUM SIZE
  16 mm wide in print, 60 px on screen. Below that the mark stops being legible
  and becomes a grey smudge that people recognise only from context.

FORMAT
  SVG   for screen, web and anything that will be scaled.
  PDF   for print. Both are true vector: the wordmark is OUTLINES, not live text,
        so it cannot fall back to the wrong typeface on a machine without Inter.

PALETTE
  See palette.txt.
`;
  files.push({ name: 'README.txt', data: readme });
  step('README.txt');

  return files;
}
