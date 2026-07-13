// ─────────────────────────────────────────────────────────────────────────────
// MEDARTIS BROCHURE ENGINE
// ─────────────────────────────────────────────────────────────────────────────
// A brochure is a sequence of PAGES, each with a TYPE — not a pile of free-form
// canvases. That is the whole point: the type carries the layout, so a 40-page
// document stays on-grid without anyone re-inventing a spread each time.
//
// Types are derived from what Medartis actually publishes: a cover, a foreword,
// a contents page, feature articles, interviews, surgical-technique notes with
// figures, key figures, course calendars, a partner wall, pull quotes and a
// contact back cover.
//
// House rules baked in:
//   · Coal is the primary dark surface, bone/paper the light one
//   · Gold is the INITIATOR rule — kicker → rule → headline, never decoration
//     after the fact. On light pages the accessible deep gold is used, because
//     the brand gold is only ~2:1 on paper and fails WCAG (see BRAND CHECK)
//   · A 2-column measure with generous margins; the mark is never crowded
//
// Page types are pure canvas draw functions (drawBrochurePage in the main file)
// so they render identically in the live preview and in the exported print PDF.

export const BROCHURE_TYPES = {
  cover: {
    label: 'Cover',
    hint: 'Full-bleed image, title, edition line',
    image: true,
    fields: [
      { key: 'eyebrow',  label: 'Kicker',       default: 'ANNUAL REVIEW' },
      { key: 'headline', label: 'Title',        default: 'Precision, in practice' },
      { key: 'subline',  label: 'Subtitle',     default: 'Surgical solutions, education and partnership' },
      { key: 'cta',      label: 'Edition line', default: 'Medartis AG · Basel · MMXXVI' },
    ],
  },
  editorial: {
    label: 'Foreword',
    hint: 'Salutation, long letter text, signature',
    image: false,
    fields: [
      { key: 'eyebrow',    label: 'Section',    default: 'FOREWORD' },
      { key: 'headline',   label: 'Title',      default: 'A word from the team' },
      { key: 'salutation', label: 'Salutation', default: 'Dear colleagues,' },
      { key: 'body',       label: 'Letter',     default: 'This edition looks back on a year of close collaboration with the surgeons who use our systems every day.', multiline: true },
      { key: 'signature',  label: 'Signature',  default: 'The Medartis Team' },
    ],
  },
  toc: {
    label: 'Table of contents',
    hint: 'One entry per line: “Title | 4–5”',
    image: false,
    fields: [
      { key: 'headline', label: 'Title', default: 'Contents' },
      { key: 'body', label: 'Entries (Title | pages)', multiline: true,
        default: 'Foreword | 3\nThe year in numbers | 4–5\nAPTUS Hand 2.0 | 6–9\nSurgical technique · Distal radius | 10–17\nCourses & events | 18–19\nPartners | 20' },
    ],
  },
  feature: {
    label: 'Feature article',
    hint: 'Headline, standfirst, two-column body, optional image',
    image: true,
    fields: [
      { key: 'eyebrow',  label: 'Section',    default: 'PRODUCT' },
      { key: 'headline', label: 'Headline',   default: 'APTUS Hand 2.0 — anatomical fixation, refined' },
      { key: 'subline',  label: 'Standfirst', default: 'Engineered with the surgeon, for the patient.' },
      { key: 'body',     label: 'Body copy',  multiline: true,
        default: 'The second generation of the APTUS Hand system refines plate geometry across the distal radius, informed by a decade of clinical feedback.' },
      { key: 'caption',  label: 'Image caption', default: '' },
    ],
  },
  interview: {
    label: 'Interview / Q&A',
    hint: 'Q: … / A: … lines, portrait image',
    image: true,
    fields: [
      { key: 'eyebrow',  label: 'Section',     default: 'IN CONVERSATION' },
      { key: 'headline', label: 'Headline',    default: 'Restraint is the hardest discipline' },
      { key: 'subline',  label: 'Interviewee', default: 'With Prof. R. Arora, Innsbruck' },
      { key: 'body',     label: 'Q&A (prefix questions with “Q:”)', multiline: true,
        default: 'Q: What has changed most in fixation over ten years?\nA: We intervene less, and we plan more. The implant is the last decision, not the first.\nQ: What do you look for in an instrument?\nA: That it disappears in the hand.' },
    ],
  },
  quote: {
    label: 'Pull quote',
    hint: 'Full-page editorial quote',
    image: false,
    fields: [
      { key: 'headline', label: 'Quote', multiline: true,
        default: 'The art of fixation is restraint.' },
      { key: 'subline',  label: 'Attribution', default: 'Medartis design principle' },
    ],
  },
  technique: {
    label: 'Surgical technique',
    hint: 'Title, authors, abstract, two-column body',
    image: true,
    fields: [
      { key: 'eyebrow',  label: 'Segment',  default: 'SURGICAL TECHNIQUE · UPPER EXTREMITY' },
      { key: 'headline', label: 'Title',    default: 'Volar plating of the distal radius' },
      { key: 'subline',  label: 'Authors',  default: 'PD Dr. F. Früh · Dr. P. Honigmann' },
      { key: 'abstract', label: 'Abstract', multiline: true,
        default: 'A step-by-step approach to volar locking plate osteosynthesis, with intra-operative checkpoints.' },
      { key: 'body',     label: 'Body copy', multiline: true,
        default: 'Approach\nThe modified Henry approach exposes the volar surface with minimal soft-tissue disruption.' },
      { key: 'caption',  label: 'Figure caption', default: 'Fig. 1 — Plate positioning.' },
    ],
  },
  figures: {
    label: 'Figure grid',
    hint: 'Full-page image with caption block',
    image: true,
    fields: [
      { key: 'eyebrow', label: 'Segment', default: 'SURGICAL TECHNIQUE · UPPER EXTREMITY' },
      { key: 'caption', label: 'Captions (one per line)', multiline: true,
        default: 'Fig. 2 — Instrumentation on the tray.\nFig. 3 — Final construct.' },
    ],
  },
  stats: {
    label: 'Key figures',
    hint: 'Big numbers — “+25% | Growth” per line',
    image: false,
    fields: [
      { key: 'eyebrow',  label: 'Section',  default: 'THE YEAR IN NUMBERS' },
      { key: 'headline', label: 'Headline', default: 'Growth across every segment' },
      { key: 'body',     label: 'Figures (Value | Label)', multiline: true,
        default: '5M | Implants placed\n+18% | Upper extremity growth\n3 | Clinical segments — CMF, Upper & Lower\n1 | Standard of precision' },
    ],
  },
  courses: {
    label: 'Course calendar',
    hint: 'Date | Course | Location per line',
    image: false,
    fields: [
      { key: 'eyebrow',  label: 'Section',  default: 'EDUCATION' },
      { key: 'headline', label: 'Headline', default: 'Courses & events MMXXVI' },
      { key: 'body',     label: 'Rows (Date | Course | Location)', multiline: true,
        default: '12–14 Mar | Hand & Wrist Injuries | Dubai, UAE\n05–06 May | Foot & Ankle Reconstruction | Basel, CH\n18–20 Sep | CMF Trauma Masterclass | Tokyo, JP' },
      { key: 'cta',      label: 'Call to action', default: 'Register · medartis.com/courses' },
    ],
  },
  partners: {
    label: 'Partners',
    hint: 'Logo wall — uses the partner logos you uploaded',
    image: false,
    fields: [
      { key: 'eyebrow',  label: 'Section',  default: 'IN COOPERATION WITH' },
      { key: 'headline', label: 'Headline', default: 'Our partners' },
      { key: 'body',     label: 'Note', multiline: true,
        default: 'Close collaboration with clinical partners and training centres underpins every system we build.' },
    ],
  },
  backCover: {
    label: 'Back cover',
    hint: 'Wordmark, contact block, claim',
    image: false,
    fields: [
      { key: 'headline', label: 'Claim',   default: 'Artful.' },
      { key: 'body',     label: 'Contact', multiline: true,
        default: 'Medartis AG\nHochbergerstrasse 60E\n4057 Basel, Switzerland' },
      { key: 'cta',      label: 'Web',     default: 'medartis.com' },
    ],
  },
};

export const BROCHURE_TYPE_KEYS = Object.keys(BROCHURE_TYPES);

const mk = (type) => {
  const t = BROCHURE_TYPES[type] || BROCHURE_TYPES.feature;
  return {
    id: `${type}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    f: Object.fromEntries(t.fields.map((fd) => [fd.key, fd.default])),
    imageSrc: null,
    fit: null,     // per-page image crop
  };
};

/** A sensible starting brochure: cover → foreword → contents → feature → back. */
export const defaultBrochurePages = () =>
  ['cover', 'editorial', 'toc', 'feature', 'backCover'].map(mk);

export const makeBrochurePage = mk;
