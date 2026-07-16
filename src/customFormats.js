// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM FORMATS
// ─────────────────────────────────────────────────────────────────────────────
// "The printer needs 210 × 280" should not require a code change.
//
// WHY THERE IS NO UNLOCK-AND-EDIT ON THE BUILT-INS
// "Instagram Post" is 1080 × 1080 because Instagram says so. It is a FACT, not a
// preference. If it could be edited in place, the app would end up with a format
// LABELLED "Instagram Post" that is not one — and every preset saved against it,
// every "1080 × 1080" caption, every brand-check rule reasoning about screen vs
// print, would quietly be wrong. Six months later nobody remembers it was edited.
// That is the same class of bug as an SD-1.5 checkpoint in an SDXL pipeline: it
// does not error, it just silently isn't what it says.
//
// So the built-ins are read-only, and the escape hatch is DUPLICATE: one click
// gives you a custom format prefilled with those dimensions, which you name. You
// get your size in five seconds, the real Instagram Post stays true, and the name
// tells the truth about what it is.

const KEY = 'medartis-custom-formats-v1';
export const CUSTOM_PREFIX = 'custom:';
export const CUSTOM_GROUP = 'Custom';

/** Bounds that keep the canvas renderable. Not taste — physics. */
export const FORMAT_LIMITS = {
  minPx: 64,
  maxPx: 20000,
  maxPixels: 60e6,     // ~60 MP: beyond this the browser canvas starts failing
  maxRatio: 60,        // a 1:45 lanyard is real; 1:200 is not a canvas, it is a bug
};

export const DPI_CHOICES = [72, 96, 150, 300];

export const mmToPx = (mm, dpi) => Math.round((mm / 25.4) * dpi);
export const pxToMm = (px, dpi) => (px / dpi) * 25.4;

/**
 * Why a size is not usable — or null when it is.
 * Returns a SENTENCE, not a code: the field says what is wrong where you typed it.
 */
export function validateSize(w, h) {
  const { minPx, maxPx, maxPixels, maxRatio } = FORMAT_LIMITS;
  if (!Number.isFinite(w) || !Number.isFinite(h)) return 'Width and height must be numbers.';
  if (w < minPx || h < minPx) return `Too small — the shortest edge must be at least ${minPx} px.`;
  if (w > maxPx || h > maxPx) return `Too large — the longest edge must be at most ${maxPx} px.`;
  if (w * h > maxPixels) {
    return `That is ${(w * h / 1e6).toFixed(0)} megapixels. The browser canvas gives up somewhere above ${maxPixels / 1e6} — lower the DPI, or use a smaller size.`;
  }
  const ratio = Math.max(w / h, h / w);
  if (ratio > maxRatio) {
    return `That is ${ratio.toFixed(0)}:1. Past about ${maxRatio}:1 there is no room to compose in — even the type engine cannot rescue it.`;
  }
  return null;
}

/** "1:1" · "16:9" · "1.91:1" — the same vocabulary the built-ins use. */
export function ratioLabel(w, h) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const g = gcd(Math.round(w), Math.round(h));
  const rw = Math.round(w) / g, rh = Math.round(h) / g;
  if (rw <= 20 && rh <= 20) return `${rw}:${rh}`;
  const r = w / h;
  return r >= 1 ? `${r.toFixed(2)}:1` : `1:${(1 / r).toFixed(2)}`;
}

/**
 * A custom format needs a TYPE CATEGORY or the modular type scale mis-sizes it —
 * a business-card-sized custom would otherwise get poster typography. Guess from
 * the geometry, and let the user override.
 *
 * These keys are NOT free-form: they must exist in TYPE_CATEGORIES in the engine
 * (poster | paged | card | social | digital). Inventing a nicer-sounding name here
 * silently falls back to `social`, which is exactly the kind of wrong-but-quiet
 * behaviour that takes an afternoon to track down.
 */
export const TYPE_CATEGORY_KEYS = ['poster', 'paged', 'card', 'social', 'digital'];

export const TYPE_CATEGORY_LABELS = {
  poster:  'Poster — big type, read across a room',
  paged:   'Paged — A4/A5 document typography',
  card:    'Card — small surface, held close',
  social:  'Social — feed-sized, read on a phone',
  digital: 'Digital — screens, banners, email',
};

export function guessTypeCategory({ w, h, printable, printDpi }) {
  if (printable) {
    const shortMm = pxToMm(Math.min(w, h), printDpi || 300);
    if (shortMm <= 70) return 'card';        // business card, postcard
    if (shortMm <= 320) return 'paged';      // A5 / A4
    return 'poster';
  }
  const ratio = Math.max(w / h, h / w);
  if (ratio >= 2.5) return 'digital';        // banners, headers, email strips
  return 'social';
}

export function makeCustomFormat({
  label, w, h, unit = 'px', dpi = 300, printable = false, typeCategory,
}) {
  const wPx = unit === 'mm' ? mmToPx(w, dpi) : Math.round(w);
  const hPx = unit === 'mm' ? mmToPx(h, dpi) : Math.round(h);
  const err = validateSize(wPx, hPx);
  if (err) throw new Error(err);
  const clean = (label || '').trim();
  if (!clean) throw new Error('Give the format a name — "Custom 3" tells nobody anything in a month.');
  return {
    id: `${CUSTOM_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    label: clean,
    w: wPx,
    h: hPx,
    ratio: ratioLabel(wPx, hPx),
    group: CUSTOM_GROUP,
    wmPct: printable ? 0.27 : 0.10,
    printable,
    printDpi: printable ? dpi : undefined,
    custom: true,
    // Remembered so the editor can reopen in the unit you actually think in.
    srcUnit: unit,
    srcW: w,
    srcH: h,
    typeCategory: TYPE_CATEGORY_KEYS.includes(typeCategory)
      ? typeCategory
      : guessTypeCategory({ w: wPx, h: hPx, printable, printDpi: dpi }),
  };
}

export function readCustomFormats() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    // Never trust storage: a hand-edited or half-written entry must not take the
    // whole format picker down with it.
    return Array.isArray(raw)
      ? raw.filter((f) => f && typeof f.id === 'string' && !validateSize(f.w, f.h))
      : [];
  } catch {
    return [];
  }
}

export function writeCustomFormats(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** Built-in → a custom seeded from it. The escape hatch, not an edit. */
export function duplicateAsCustom(key, fmt) {
  const printable = !!fmt.printable;
  const dpi = fmt.printDpi || 300;
  return {
    label: `${fmt.label} copy`,
    unit: printable ? 'mm' : 'px',
    w: printable ? +pxToMm(fmt.w, dpi).toFixed(1) : fmt.w,
    h: printable ? +pxToMm(fmt.h, dpi).toFixed(1) : fmt.h,
    dpi,
    printable,
    from: key,
  };
}
