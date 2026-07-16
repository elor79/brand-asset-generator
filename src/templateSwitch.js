// ─────────────────────────────────────────────────────────────────────────────
// SWITCHING CONTENT TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────
// "Not all of the content templates seem to work."
//
// They all work. The problem is that they all look like they do nothing.
//
// Every template has the SAME five fields (eyebrow, headline, subline, body, cta).
// Once anything has been typed, the switch carries every value forward so your
// copy is never destroyed — which is right, and which also means the new
// template's sample content never appears. You click "Quote card", the canvas does
// not change, and you conclude the template is broken. It was protecting you.
//
// So the honest move is not a warning. A warning that fires on every switch gets
// clicked through in a day, and it would not even be true most of the time. The
// move is a CHOICE, offered only when the two possibilities actually differ:
//
//   KEEP MY COPY      — carry it into the new template's structure (today's behaviour)
//   LOAD THE SAMPLE   — show me what this template is FOR; my copy is replaced
//
// And a real warning where there IS real loss: nine of the templates define their
// own carousel slides, so switching to one REPLACES every slide you have written.
// That is the case worth stopping for.

/** What would actually change if we switched templates? Nothing here mutates. */
export function templateSwitchImpact({ from, to, content, carouselContent, isCarousel, contentEdited }) {
  const impact = {
    /** Fields you have typed that the sample would overwrite. */
    overwrites: [],
    /** Carousel slides that would be thrown away entirely. */
    slidesReplaced: 0,
    /** Fields the target template does not have — these are dropped either way. */
    dropped: [],
    /** Would "keep" and "sample" produce different results? If not, do not ask. */
    differs: false,
    /** Is anything at risk that the user cannot undo? */
    destructive: false,
  };
  if (!to) return impact;

  const toKeys = (to.fields || []).map((f) => f.key);
  const fromKeys = (from?.fields || []).map((f) => f.key);

  // Values you typed that the target ALSO has → these are what the two choices
  // disagree about.
  for (const f of to.fields || []) {
    const cur = content?.[f.key];
    if (contentEdited && cur != null && cur !== '' && cur !== f.default) {
      impact.overwrites.push({ key: f.key, current: cur, sample: f.default });
    }
  }

  // Fields the target does not have are lost whichever button you press — so they
  // belong in the message, not in the choice.
  for (const k of fromKeys) {
    if (!toKeys.includes(k)) {
      const cur = content?.[k];
      if (cur != null && cur !== '') impact.dropped.push(k);
    }
  }

  // The genuinely destructive one: a template with its own slides replaces ALL of
  // them, and unlike the single fields there is no carry-forward for that.
  if (to.carouselContent?.length && isCarousel) {
    const written = (carouselContent || []).filter((c) =>
      c && Object.entries(c).some(([, v]) => typeof v === 'string' && v.trim())
    ).length;
    if (contentEdited && written > 0) impact.slidesReplaced = written;
  }

  impact.differs = impact.overwrites.length > 0 || impact.slidesReplaced > 0;
  impact.destructive = impact.slidesReplaced > 0 || impact.dropped.length > 0;
  return impact;
}

/** The sentence the panel shows. Concrete, because "may affect your content" is not. */
export function describeImpact(impact, toLabel) {
  if (!impact.differs) return null;
  const bits = [];
  if (impact.overwrites.length) {
    bits.push(`${impact.overwrites.length} field${impact.overwrites.length === 1 ? '' : 's'} you have written`);
  }
  if (impact.slidesReplaced) {
    bits.push(`all ${impact.slidesReplaced} carousel slide${impact.slidesReplaced === 1 ? '' : 's'}`);
  }
  const what = bits.join(' and ');
  return `"${toLabel}" has its own sample copy. Loading it would replace ${what}.`;
}
