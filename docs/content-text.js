// ─────────────────────────────────────────────────────────────────────────────
// THE PROSE — user guide and technical guide
// ─────────────────────────────────────────────────────────────────────────────
// Kept separate from the figure code so each reads cleanly. The figures are called
// by name from window.DOC_FIGURES; the section wrappers carry data-nav so the
// sticky side-navigation builds itself.

const F = window.DOC_FIGURES;

function fig(svg, capHTML) {
  return `<div class="fig">${svg}${capHTML ? `<div class="cap">${capHTML}</div>` : ''}</div>`;
}
function sec(id, nav, group, html) {
  const g = group ? ` data-group="${group}"` : '';
  return `<section id="${id}" data-nav="${nav}"${g}>${html}</section>`;
}

/* ═══════════════════════════ USER GUIDE ═══════════════════════════════════ */
document.getElementById('guide-user').innerHTML = [

  sec('u-intro', 'Overview', 'Getting started', `
    <div class="eyebrow">User guide</div>
    <h1>The Medartis Brand Asset Generator</h1>
    <p class="lede">A studio in the browser. Pick a format, tell a story, and the tool
      lays out on-brand artwork — posters, cards, social, brochures, lanyards — with
      the logo, type, colour and spacing already correct. This guide is task-first:
      what each control does, and when to reach for it.</p>
    <div class="callout"><span class="k">The one idea worth having first</span>
      The tool does not draw pictures for you to fix. It enforces the brand — clear
      space, contrast, type scale, trim and bleed — so that what you export is
      already right. When it stops you, it is protecting the mark.</div>`),

  sec('u-formats', 'Formats & layouts', 'Getting started', `
    <h2>Formats &amp; layouts</h2>
    <p>Start in <b>§ 01 Format</b>. Every format carries its own type scale, safe
      area and — for print — trim and bleed, so an A4 flyer and an Instagram post are
      typeset differently on purpose. Built-ins are read-only because “Instagram Post”
      is <i>1080×1080 by definition</i>; to bend a size, use <b>Duplicate as custom</b>,
      which hands you an editable copy that tells the truth about what it is.</p>
    <p><b>§ 02 Layout</b> chooses how image and text share the canvas — image-top,
      split, overlay, table, stat, duo, type-only, and more. Each one honours the same
      contract, so switching layout never breaks the brand furniture.</p>
    <div class="cards">
      <div class="card"><div class="n">Print</div><h4>Trim + bleed</h4><p>The page is trim plus two bleeds; content outside the trim is the bleed, and crop marks sit in it.</p></div>
      <div class="card"><div class="n">Screen</div><h4>Modular type</h4><p>Type sizes follow the format’s category — poster, paged, card, social, digital — so text is read at the right distance.</p></div>
      <div class="card"><div class="n">Custom</div><h4>Duplicate, don’t unlock</h4><p>A built-in stays true; your copy carries your size and a name that says what it is.</p></div>
    </div>`),

  sec('u-group', 'Medartis Group', 'The Group system', `
    <h2>Medartis Group branding</h2>
    <p class="lede">Medartis Group is a <b>house of brands</b>, not a partnership.
      medartis, NeoOrtho and KeriMedical are owned — so the tool never says “in
      cooperation with”. It says who the family is.</p>
    ${fig(F.figHierarchy(), 'The hierarchy the artwork must not misstate. <b>The Group mark sits above the three brands</b>, medartis included — the house and the main brand are different artwork, and using one where the other belongs names the house twice and the main brand never.')}
    <p>Turn it on in <b>§ Medartis Group</b>. When it is on, the Group mark <b>replaces</b>
      the medartis wordmark — an asset showing both would read as sent by two
      organisations. medartis then becomes one of the optional co-brands, on the same
      terms as the others.</p>
    <div class="callout"><span class="k">When does the Group show up?</span>
      The Group speaks to investors, regulators and employees; the brands speak to
      surgeons. Use Group branding for annual reports, investor decks, careers and
      corporate comms, trade-fair architecture and group stationery. <b>Not</b> on
      product packaging, IFUs or surgical technique guides — there the legal
      manufacturer is the entity, and that is an MDR matter, not a style choice.</div>`),

  sec('u-cobrands', 'Co-brands & baseline', 'The Group system', `
    <h2>Co-brands, set like type</h2>
    <p>Add NeoOrtho, KeriMedical or medartis as co-brands and they sit beneath the
      Group as a row of equals. “Equal” is the hard part: the three wordmarks are
      different shapes, so the tool matches them by <b>cap height</b> and stands them
      on <b>one baseline</b> — not by bounding box, which would shrink KeriMedical and
      float it.</p>
    ${fig(F.figCapMatch(), 'KeriMedical’s bounding box is <b>3.13× its cap height</b> — bars above the letters, a stroke below the baseline. Matched by box it looks tiny; matched by cap, the letters agree and the extra strokes simply extend past the shared line, as they should.')}
    <p>The <b>space between co-brands</b>, the <b>Group mark’s share</b> of the height,
      and the <b>alignment</b> are all yours in the panel — every distance is a
      multiple of the letters’ own size, so it holds its proportion at any format.</p>
    <div class="callout rule"><span class="k">The byline rule</span>
      KeriMedical and NeoOrtho each carry a small “medartis group” byline for when
      they appear alone. Under the Group mark the tool removes it automatically —
      otherwise the asset would state the same relationship twice.</div>`),

  sec('u-gradients', 'Gradients', 'The Group system', `
    <h2>Gradients — a palette that is already yours</h2>
    <p>In <b>§ Surface</b>, switch from a flat colour to a gradient. The presets are
      not decoration: every one is <b>derived from the sub-brands’ own colours</b>.
      The Group ramp runs KeriMedical blue → NeoOrtho teal — one endpoint per brand,
      the whole Group in one sweep.</p>
    ${fig(F.figGradient(['#001a72', '#00afb9'], 'GROUP · KeriMedical blue → NeoOrtho teal', 0.64, 0.66), 'The live ramp, sampled the way the canvas paints it — so the swatch shows the midpoint and easing you actually set. The gold box marks the <b>crossover</b>: a 2% sliver where both white and dark type dip below the legibility line. The tool shows it rather than hiding it; keep headlines off that band.')}
    ${fig(F.figGradient(['#000000', '#582d83', '#00afb9', '#001a72'], 'DEEP · black → violet → teal → blue', null), 'A four-stop ramp. The order is not arbitrary — violet and teal belong to NeoOrtho, blue to KeriMedical, black to medartis. Every stop is owned; nothing is invented to bridge them.')}
    <p>Linear or radial, angle, band, midpoint, easing, centre and radius — the full
      set of controls, with a <b>⇄ swap</b> and a live description. The dark-to-colour
      “deep” ramps read heavier and are made for covers and photography backgrounds.</p>`),

  sec('u-export', 'Export', 'Delivering', `
    <h2>Export &amp; the brand kit</h2>
    <p>Export to PNG for screen, or <b>vector PDF</b> for print — the wordmark and the
      Group marks go down as real outlines, not a rasterised sprite, so they stay crisp
      at any size and cannot fall back to the wrong typeface on a machine without Inter.</p>
    <p>The <b>brand kit</b> is one zip for an agency: every mark in colour, white and
      mono; both byline builds of each co-brand; the gradients with the rule that
      produced them; the palette; and a README that answers what a printer would
      otherwise email you the week before press.</p>
    <div class="callout"><span class="k">Two builds of each co-brand, on purpose</span>
      <code>kerimedical</code> keeps the “medartis group” byline for standing alone;
      <code>kerimedical_no-byline</code> drops it for use under the Group mark. Both
      ship because choosing wrong is silent — the file opens and looks right.</div>`),

].join('');

/* ═══════════════════════════ TECHNICAL GUIDE ══════════════════════════════ */
document.getElementById('guide-tech').innerHTML = [

  sec('t-intro', 'Overview', 'Architecture', `
    <div class="eyebrow">Technical guide</div>
    <h1>How it works, and why it will pass review</h1>
    <p class="lede">The generator is a React application that renders every asset to a
      canvas and re-renders it as vector for PDF. This guide covers the parts that a
      deep code review would probe: the single sources of truth, the geometry, and the
      check suite that keeps them honest.</p>
    <div class="callout rule"><span class="k">The governing principle</span>
      Silent wrongness is worse than a crash. A logo that is <i>almost</i> right ships;
      a crash gets fixed. So the risky invariants — artwork fidelity, colour
      provenance, contrast, canvas/PDF parity — are enforced mechanically, and a test
      that mocks its own subject is treated as a second copy of the bug.</div>`),

  sec('t-derivation', 'The derivation rule', 'Single sources of truth', `
    <h2>Colour provenance is a checked property</h2>
    <p>Every Group gradient endpoint must trace to a colour a sub-brand owns, or a
      computed shade of one. This is not a comment — <code>check_group.mjs</code> walks
      every stop of every ramp and fails the build on a colour that belongs to nobody.</p>
    ${fig(F.figDerivation(), 'The sub-brand colours are the single source. <code>shade()</code> darkens by scaling channels, which holds hue <b>exactly</b> (226.316° → 226.316°) rather than drifting through an HSL round-trip. The grey is a real brand colour and a deliberate non-endpoint.')}
    <p>The same discipline runs through the codebase: the sub-brand hexes live in one
      place (<code>SUB_BRANDS</code>), the mark artwork is measured from the paths
      rather than typed, and the deep-black gradient anchor is admitted only because it
      is a sanctioned four-channel brand colour — <code>#000</code> is in the guide;
      <code>#0a0a0a</code> would still fail.</p>`),

  sec('t-geometry', 'Cap-height geometry', 'Single sources of truth', `
    <h2>The lockup is set like type</h2>
    <p>Marks in a row are matched on cap height and aligned on one baseline, both
      measured from the real path data. Baseline detection is robust because
      descenders are the minority by construction — “medartis group” puts 11 of 13
      elements on its baseline, NeoOrtho 9 of 11, KeriMedical 2 of 4.</p>
    ${fig(F.figCapMatch(), 'Area- or box-matching (top) is the wrong rule for wordmarks and produces visibly unequal letters. Cap-matching (bottom) is what a designer does. <code>test_baselinerow.mjs</code> asserts both properties and that the row fits every format from a business card to a 43:1 lanyard.')}
    <p>Sizes are always a fraction of the <b>short edge</b>, never the canvas — a
      fraction of the long edge on a lanyard is a lockup taller than the strap, which
      is exactly the sponsor-strip bug the tool declines to inherit.</p>`),

  sec('t-parity', 'Canvas / PDF parity', 'Two renderers, one drawing', `
    <h2>Two renderers must draw the same thing</h2>
    <p>The canvas (browser <code>Path2D</code>) and the PDF (a hand-written SVG-path →
      jsPDF converter) are two implementations of one drawing. When they diverge, the
      screen is right and the proof is wrong — the worst split, because you approve one
      and print the other.</p>
    <div class="callout"><span class="k">A real bug this caught</span>
      The PDF converter never reset the smooth-curve reflection point on a line
      command, so <code>v29.257s7.619,0,7.619,0</code> reflected a stale control point
      and flung the curve across the artwork. KeriMedical printed 63% too wide and
      burst out of a 20 mm strap while the canvas drew it perfectly.
      <code>test_pdfpaths.mjs</code> now converts every path of every mark and compares
      the result against the canvas flattener — shape, not just “does it parse”.</div>`),

  sec('t-checks', 'The check suite', 'Keeping it honest', `
    <h2>The check suite</h2>
    <p>Everything ships behind <code>npm run check</code>. Each tool drives the real
      code and states <i>why</i> in its failure message, because a check that only
      names a missing token teaches nobody anything.</p>
    ${fig(F.figChecks(), 'Every tool is verified against the bug it names by reintroducing that bug — a check that cannot fail is decoration. Three times this session a test that re-implemented its subject passed a live bug; each was rewritten to drive the shipped code.')}
    <div class="callout rule"><span class="k">The lesson the suite encodes</span>
      Structural checks (does the word appear?) are not behavioural checks (does the
      code do it?). A function whose body was a call to itself, an undeclared variable,
      a doubled draw pass — all parsed cleanly and all took the app down. The suite now
      <i>runs</i> the geometry it checks, and loads the app to confirm it mounts.</div>`),

  sec('t-lanyard', 'Case study: the lanyard', 'Keeping it honest', `
    <h2>Case study — the Group lanyard</h2>
    <p>A lanyard is ~20 mm wide and twists on a neck, so it repeats and everything on
      it must work as a fragment. Stacked across the webbing, three marks get 6 mm each
      and none survive; in line they share the strap’s length.</p>
    ${fig(F.figLanyard(), 'The Group and its brands compose into one repeat block, cap-matched and rotated onto the strap axis — the same lockup the poster draws, at strap scale. KeriMedical is 3.13 cap-heights tall, so it sets the cap for the whole row; that is arithmetic, and <code>markSize</code> is the dial.')}
    <p>The lanyard exists twice — a canvas renderer and a PDF renderer — and the
      contract now checks that the PDF strap composes the Group via the same geometry,
      so the two cannot drift into printing different lanyards.</p>`),

].join('');

// Build the side-nav for the initially visible guide.
buildNav('user');
