// ─────────────────────────────────────────────────────────────────────────────
// "DON'T ASK ME AGAIN" — and the undo that makes it safe to say
// ─────────────────────────────────────────────────────────────────────────────
// These two features are not independent, and shipping the first without the
// second would be a mistake.
//
// "Remember: keep my copy" is harmless. Nothing is lost, ever — the worst case is
// that a template looks like it did nothing, which is the state you deliberately
// chose.
//
// "Remember: load the sample" is a standing instruction to REPLACE YOUR WRITING,
// silently, on every future template switch. Without a way back, that is a foot-gun
// with a checkbox on it: you tick it once while browsing, forget, and three weeks
// later a switch eats a headline you spent an afternoon on and never says so.
//
// The undo is what earns the checkbox. So they arrive together, and the dialog
// says which of the two you are about to make standing.
//
// A remembered preference is also not a life sentence: it is shown in § 03 with a
// one-click way out, because a setting you cannot find is a setting you cannot
// revoke.

const KEY = 'medartis-template-pref-v1';

/** 'keep' | 'sample' | null (ask every time) */
export function readTemplatePref() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'keep' || v === 'sample' ? v : null;
  } catch {
    return null;
  }
}

export function writeTemplatePref(pref) {
  try {
    if (pref === 'keep' || pref === 'sample') localStorage.setItem(KEY, pref);
    else localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

export const TEMPLATE_PREF_LABEL = {
  keep: 'Your copy is always kept',
  sample: 'The sample copy is always loaded',
};

/**
 * Everything a template switch can destroy, captured before it happens.
 *
 * Deliberately a deep-ish copy: `content` and each carousel slide are cloned, so
 * the snapshot cannot be mutated by the very edit it exists to undo. `templateKey`
 * and `layoutKey` ride along because the switch changes those too — an undo that
 * restored the words but left the layout would be a half-undo, which is worse than
 * none: you would think you had it back.
 */
export function snapshotContent({ content, carouselContent, templateKey, layoutKey, carouselSlides }) {
  return {
    content: { ...content },
    carouselContent: (carouselContent || []).map((c) => ({ ...c })),
    templateKey,
    layoutKey,
    carouselSlides,
    at: Date.now(),
  };
}

/** Did the switch actually change anything worth offering to undo? */
export function snapshotDiffers(before, after) {
  if (!before || !after) return false;
  if (before.templateKey !== after.templateKey) return true;
  const keys = new Set([...Object.keys(before.content || {}), ...Object.keys(after.content || {})]);
  for (const k of keys) if ((before.content?.[k] ?? '') !== (after.content?.[k] ?? '')) return true;
  const n = Math.max(before.carouselContent?.length || 0, after.carouselContent?.length || 0);
  for (let i = 0; i < n; i++) {
    const a = before.carouselContent?.[i] || {};
    const b = after.carouselContent?.[i] || {};
    const ks = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of ks) if ((a[k] ?? '') !== (b[k] ?? '')) return true;
  }
  return false;
}

/** Did the switch LOSE anything the user had written? (vs merely changing it) */
export function snapshotLostWork(before, after) {
  if (!before || !after) return false;
  const had = (o) => Object.values(o || {}).some((v) => typeof v === 'string' && v.trim());
  for (const [k, v] of Object.entries(before.content || {})) {
    if (typeof v === 'string' && v.trim() && (after.content?.[k] ?? '') !== v) return true;
  }
  for (let i = 0; i < (before.carouselContent?.length || 0); i++) {
    if (had(before.carouselContent[i]) && !snapshotSlideEqual(before.carouselContent[i], after.carouselContent?.[i])) return true;
  }
  return false;
}

function snapshotSlideEqual(a, b) {
  if (!a || !b) return false;
  const ks = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of ks) if ((a[k] ?? '') !== (b[k] ?? '')) return false;
  return true;
}
