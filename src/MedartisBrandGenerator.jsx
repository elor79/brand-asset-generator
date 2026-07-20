import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import { BROCHURE_TYPES, BROCHURE_TYPE_KEYS, defaultBrochurePages, makeBrochurePage } from './brochure';
import { buildLogoSvg, svgToPdf, buildBrandKit } from './logoVector';
import { templateSwitchImpact, describeImpact } from './templateSwitch';
import {
  readTemplatePref, writeTemplatePref, TEMPLATE_PREF_LABEL,
  snapshotContent, snapshotDiffers, snapshotLostWork,
} from './templatePref';
import {
  CUSTOM_GROUP, DPI_CHOICES, TYPE_CATEGORY_KEYS, TYPE_CATEGORY_LABELS,
  makeCustomFormat, readCustomFormats, writeCustomFormats,
  duplicateAsCustom, validateSize, ratioLabel,
  // NOT pxToMm/mmToPx — the engine already defines pxToMm with identical
  // semantics further down. Importing a second name for one conversion is how
  // two copies of the same maths quietly drift apart.
} from './customFormats';
import { makeZip } from './zip';
import {
  DEFAULT_GRADIENT, ANGLE_PRESETS, axisFor, tAt, gradientStops, colorAt,
  applyCanvasGradient, gradientToSvgDefs, describeGradient,
} from './gradient';
import {
  GROUP_MARK, NEOORTHO_MARK, KERIMEDICAL_MARK, CO_BRANDS, markGeometry, SUB_BRANDS,
  GROUP_GRADIENTS, GROUP_RULE_COLOR, markPaths, markMetrics, clearSpaceFor, legibleInkAt, deadZones,
} from './groupBrands';
import { familyRow, baselineRow, endorsedLockup, MARK_BY_KEY, subBrandLabel } from './groupLockup';
import QRCodeStyling from 'qr-code-styling';
import { readPsd, initializeCanvas } from 'ag-psd';
import { BRAND, Section, imgToDataUrl } from './uiKit.jsx';
import GenerateSection from './GenerateSection.jsx';

// ag-psd uses a canvas factory we have to provide once at module load
initializeCanvas((w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
});

// ──────────────────────────────────────────────────────────────────────
// MEDARTIS BRAND ASSET GENERATOR — Edition Three v1.2
// Token-aligned with 01-brand-guide/brand-tokens.json
// ──────────────────────────────────────────────────────────────────────

// ── BRAND TOKENS ── moved to uiKit.jsx (shared with GenerateSection.jsx)

// ── FORMATS ──────────────────────────────────────────────────────────
// `group` orders them in the sidebar.  `wmPct` is the wordmark width as a
// fraction of the short side — Brand Guide §logo_placement: 0.27 paged /
// 0.30 poster / 0.10 sensible digital default.
const FORMATS = {
  // ─── SOCIAL ───────────────────────────────────────────────
  // Grouped by PLATFORM, not by shape. The old groups were named for shape
  // ("square", "wide") but sorted by platform, so LinkedIn Post — a 1:1 — sat
  // under "wide", and Instagram Story — a 9:16 — sat under "square". Two axes
  // wearing one label: whichever you believed, the list lied to you.
  //
  // Platform is the axis people actually choose along ("I need a LinkedIn ad"),
  // and the shape is never hidden — the ratio is printed on every row.
  'ig-post':         { label: 'Instagram Post',        w: 1080, h: 1080, ratio: '1:1',    group: 'Social · Instagram', wmPct: 0.10 },
  'ig-story':        { label: 'Instagram Story',       w: 1080, h: 1920, ratio: '9:16',   group: 'Social · Instagram', wmPct: 0.10 },
  'ig-reel':         { label: 'Instagram Reel cover',  w: 1080, h: 1920, ratio: '9:16',   group: 'Social · Instagram', wmPct: 0.10 },
  'ig-carousel':     { label: 'Instagram Carousel',    w: 1080, h: 1080, ratio: '1:1',    group: 'Social · Instagram', wmPct: 0.10, multi: true },

  'li-post':         { label: 'LinkedIn Post',         w: 1200, h: 1200, ratio: '1:1',    group: 'Social · LinkedIn',  wmPct: 0.10 },
  'li-ad':           { label: 'LinkedIn Ad',           w: 1200, h: 628,  ratio: '1.91:1', group: 'Social · LinkedIn',  wmPct: 0.09 },
  'li-carousel':     { label: 'LinkedIn Carousel',     w: 1080, h: 1080, ratio: '1:1',    group: 'Social · LinkedIn',  wmPct: 0.10, multi: true },
  'li-banner':       { label: 'LinkedIn Page Banner',  w: 1584, h: 396,  ratio: '4:1',    group: 'Social · LinkedIn',  wmPct: 0.09 },

  'fb-post':         { label: 'Facebook Post',         w: 1200, h: 630,  ratio: '1.91:1', group: 'Social · Facebook & X', wmPct: 0.09 },
  'fb-cover':        { label: 'Facebook Cover',        w: 851,  h: 315,  ratio: '2.7:1',  group: 'Social · Facebook & X', wmPct: 0.09 },
  'x-post':          { label: 'X / Twitter Post',      w: 1200, h: 675,  ratio: '16:9',   group: 'Social · Facebook & X', wmPct: 0.10 },
  'x-header':        { label: 'X / Twitter Header',    w: 1500, h: 500,  ratio: '3:1',    group: 'Social · Facebook & X', wmPct: 0.09 },

  'yt-thumb':        { label: 'YouTube Thumbnail',     w: 1280, h: 720,  ratio: '16:9',   group: 'Social · Video & discovery', wmPct: 0.10 },
  'yt-banner':       { label: 'YouTube Banner',        w: 2560, h: 1440, ratio: '16:9',   group: 'Social · Video & discovery', wmPct: 0.08 },
  'tiktok':          { label: 'TikTok',                w: 1080, h: 1920, ratio: '9:16',   group: 'Social · Video & discovery', wmPct: 0.10 },
  'pinterest-pin':   { label: 'Pinterest Pin',         w: 1000, h: 1500, ratio: '2:3',    group: 'Social · Video & discovery', wmPct: 0.10 },

  // ── PRINT · wearables ─────────────────────────────────────
  // Lanyard straps: printed FLAT, then folded into the neck loop. 900 mm flat is
  // the industry standard (≈450 mm hanging drop) and 150 dpi is the usual dye-
  // sublimation resolution for webbing — so the canvas is a real strap, not a
  // decorative long rectangle.
  // NOTE: no wmPct. The strap does not draw a brand bar — its mark is composed by
  // the lanyard layout itself, at cfg.markSize (46% of the strap's width). A wmPct
  // here would be a number that looks authoritative and is never read, and the
  // BRAND CHECK would measure it and report a failure that is not real.
  'lanyard-20':      { label: 'Lanyard 20 × 900 mm',   w: 118,  h: 5315, ratio: '20×900', group: 'Print · wearables', printable: true, printDpi: 150 },
  'lanyard-25':      { label: 'Lanyard 25 × 900 mm',   w: 148,  h: 5315, ratio: '25×900', group: 'Print · wearables', printable: true, printDpi: 150 },

  // ── DIGITAL SURFACE ───────────────────────────────────────
  'screensaver':     { label: '16:9 Screensaver',      w: 1920, h: 1080, ratio: '16:9',   group: 'Digital surface', wmPct: 0.10 },
  'screensaver-4k':  { label: '4K Screensaver',        w: 3840, h: 2160, ratio: '16:9',   group: 'Digital surface', wmPct: 0.10 },
  'email-header':    { label: 'Email Header',          w: 1200, h: 400,  ratio: '3:1',    group: 'Digital surface', wmPct: 0.12 },
  'email-footer':    { label: 'Email Footer',          w: 1200, h: 300,  ratio: '4:1',    group: 'Digital surface', wmPct: 0.12 },
  'web-hero':        { label: 'Web Hero · desktop',    w: 1920, h: 800,  ratio: '12:5',   group: 'Digital surface', wmPct: 0.09 },

  // ── PRINT · paged ─────────────────────────────────────────
  // printable + printDpi enable PDF export with bleed + crop marks.
  'a3-portrait':     { label: 'A3 Portrait · 300 dpi', w: 3508, h: 4961, ratio: 'A3',     group: 'Print · paged',   wmPct: 0.27, printable: true, printDpi: 300 },
  'brochure-a4':     { label: 'Brochure A4 · 300 dpi', w: 2480, h: 3508, ratio: 'A4',    group: 'Print · brochure', wmPct: 0.22, printable: true, printDpi: 300, brochure: true },
  'brochure-a5':     { label: 'Brochure A5 · 300 dpi', w: 1748, h: 2480, ratio: 'A5',    group: 'Print · brochure', wmPct: 0.22, printable: true, printDpi: 300, brochure: true },
  'a4-portrait':     { label: 'A4 Portrait · 300 dpi', w: 2480, h: 3508, ratio: 'A4',     group: 'Print · paged',   wmPct: 0.27, printable: true, printDpi: 300 },
  'a4-landscape':    { label: 'A4 Landscape · 300 dpi',w: 3508, h: 2480, ratio: 'A4',     group: 'Print · paged',   wmPct: 0.27, printable: true, printDpi: 300 },
  'a5-portrait':     { label: 'A5 Portrait · 300 dpi', w: 1748, h: 2480, ratio: 'A5',     group: 'Print · paged',   wmPct: 0.27, printable: true, printDpi: 300 },
  'postcard-a6':     { label: 'Postcard A6 · 300 dpi', w: 1240, h: 1748, ratio: 'A6',     group: 'Print · paged',   wmPct: 0.27, printable: true, printDpi: 300 },
  // 85 × 55 mm at 300 dpi = 1004 × 650 px. It said 1050 × 600 — which is
  // 88.9 × 50.8 mm: 3.9 mm too wide and 4.2 mm too short. A card that does not
  // fit a wallet, discovered at the printer. The label was right and the pixels
  // were not; every other ISO format checks out exactly, which is what made this
  // one worth measuring rather than trusting.
  // No wmPct: it carried 0.27 (the paged value) which on a 55 mm short side is
  // 14.9 mm — under the guide's own 16 mm minimum, so the shipped default failed
  // the check the app itself runs. formatCategory already calls this 'card', and
  // the card scale (0.30) gives 16.5 mm. Deleting the override IS the fix.
  'business-card':   { label: 'Business Card · 300 dpi', w: 1004, h: 650,  ratio: '85×55', group: 'Print · paged',   printable: true, printDpi: 300 },

  // ── PRINT · poster / banner ───────────────────────────────
  'poster-a3':       { label: 'Event Poster A3',       w: 1191, h: 1684, ratio: 'A3',     group: 'Print · poster',  wmPct: 0.30, printable: true, printDpi: 100 },
  'poster-a2':       { label: 'Poster A2 · 150 dpi',   w: 2480, h: 3508, ratio: 'A2',     group: 'Print · poster',  wmPct: 0.30, printable: true, printDpi: 150 },
  'rollup-banner':   { label: 'Roll-up Banner 85×200', w: 1004, h: 2362, ratio: '85×200', group: 'Print · poster',  wmPct: 0.30, printable: true, printDpi: 30 },
  'expo-banner':     { label: 'Expo Banner 200×100',   w: 2362, h: 1181, ratio: '2:1',    group: 'Print · poster',  wmPct: 0.30, printable: true, printDpi: 30 },
};

// ── CONTENT TEMPLATES ────────────────────────────────────────────────
// `fields` are the default per-slide content (single-slide formats).
// `carouselSlides` + `carouselContent` (if present) auto-populate a carousel
// when the user switches to a multi-slide format with that template selected.
const TEMPLATES = {
  // ── WEARABLES ───────────────────────────────────────────────────
  // A strap can carry a name and a URL. Nothing else fits, so nothing else is
  // offered — a template with fields the format cannot render is a trap.
  'lanyard': {
    label: 'Lanyard strap',
    desc: 'Congress lanyards · repeating mark, mirrored halves',
    fields: [
      // The MARK already says "medartis" — one repeat block is wordmark · event ·
      // strap line, so putting the brand in the event name too makes the strap read
      // "medartis · MEDARTIS CONGRESS · medartis.com". The event name is for the
      // EVENT; the mark carries the brand.
      { key: 'headline', label: 'Event name (repeats along the strap)', default: 'HAND & WRIST CONGRESS MMXXVII' },
      { key: 'subline',  label: 'Strap line · URL or claim', default: 'medartis.com' },
    ],
  },

  // ── SINGLE-SHOT TEMPLATES ───────────────────────────────────────
  'product-launch': {
    label: 'Product Launch',
    desc: 'APTUS, MODUS 2, surgical systems',
    fields: [
      { key: 'eyebrow',  label: 'Eyebrow', default: '§ 01 — NEW SYSTEM' },
      { key: 'headline', label: 'Product name', default: 'APTUS Hand 2.0' },
      { key: 'subline',  label: 'Meta-message',  default: 'Precision at hand.' },
      { key: 'body',     label: 'Body copy', default: 'Anatomical fixation for the distal radius. Engineered with the surgeon, for the patient.', multiline: true },
      { key: 'cta',      label: 'Catalog reference', default: 'R_HAND-01000001_v0' },
    ],
  },
  'congress': {
    label: 'Congress / Event',
    desc: 'Hand & wrist congresses, symposiums',
    fields: [
      { key: 'eyebrow',  label: 'Event tag', default: '§ 02 — CONGRESS MMXXVI' },
      { key: 'headline', label: 'Event name', default: 'FESSH Annual Meeting' },
      { key: 'subline',  label: 'Location', default: 'Basel, Switzerland' },
      { key: 'body',     label: 'Dates / context', default: '12 — 15 June 2026 · Visit Medartis at Booth 42', multiline: true },
      { key: 'cta',      label: 'Footer', default: 'events / MMXXVI' },
    ],
  },
  'surgeon-recognition': {
    label: 'Surgeon Recognition',
    desc: 'Masters / Quickminds laurels',
    fields: [
      { key: 'eyebrow',  label: 'Tier', default: '§ 03 — MASTERS MMXXVI' },
      { key: 'headline', label: 'Surname, Country', default: 'Quadlbauer, AT' },
      { key: 'subline',  label: 'Institution', default: 'AUVA Trauma Hospital Vienna' },
      { key: 'body',     label: 'Citation', default: 'For sustained contribution to the science of upper extremity osteosynthesis.', multiline: true },
      { key: 'cta',      label: 'Footer', default: 'Medartis Masters Network' },
    ],
  },
  'quote-card': {
    label: 'Thought Leadership',
    desc: 'Calm, exact, peer-to-peer voice',
    fields: [
      { key: 'eyebrow',  label: 'Series', default: '§ 04 — PERSPECTIVE 01' },
      { key: 'headline', label: 'Principle', default: 'The art of fixation is restraint.', multiline: true },
      { key: 'subline',  label: 'Attribution', default: '— Medartis design principle' },
      { key: 'body',     label: 'Context', default: '', multiline: true },
      { key: 'cta',      label: 'Footer', default: 'PERSPECTIVE · MMXXVI' },
    ],
  },
  'internal-comms': {
    label: 'Internal Milestone',
    desc: 'Anniversaries, achievements',
    fields: [
      { key: 'eyebrow',  label: 'Department', default: '§ 05 — INTERNAL' },
      { key: 'headline', label: 'Message', default: 'Five million implants placed.' },
      { key: 'subline',  label: 'Subline', default: 'Thank you, Medartis team.' },
      { key: 'body',     label: 'Body', default: 'A milestone built one precise placement at a time.', multiline: true },
      { key: 'cta',      label: 'Footer', default: 'Medartis · MMXXVI' },
    ],
  },

  // ── EVENT COLLATERAL (Cadence-briefed: invitations, STD, programmes) ──
  // ONE sanctioned treatment per kind — these exist to end the drift the
  // 2023–26 design review documented (five Save-the-Date styles, ad-hoc
  // fact-block labels, wandering QR codes). Cadence pre-fills them from the
  // structured request intake via the ?preset= deep link.
  'event-invitation': {
    label: 'Event Invitation',
    desc: 'Symposium / course / dinner — standard fact block',
    fields: [
      { key: 'eyebrow',  label: 'Occasion (eyebrow)', default: 'MEDARTIS SYMPOSIUM' },
      { key: 'headline', label: 'Event title', default: 'Advanced Solutions for Fractures and Beyond', multiline: true },
      { key: 'subline',  label: 'Speakers / faculty', default: 'PD Dr. med. F. Früh · Dr. med. P. Honigmann' },
      { key: 'body',     label: 'Fact block · Date / Time / Venue', default: 'Date Friday, November 29, 2026\nTime 11.45 – 12.30\nVenue Saal A, Palazzo dei Congressi', multiline: true },
      { key: 'cta',      label: 'Registration / booth', default: 'Registration: events@medartis.com · Booth #14' },
    ],
  },
  'save-the-date': {
    label: 'Save the Date',
    desc: 'The one sanctioned STD treatment',
    fields: [
      { key: 'eyebrow',  label: 'Fixed tag', default: 'SAVE THE DATE' },
      { key: 'headline', label: 'Event title', default: 'OP Connect — Praxis · Dialog · Perspektiven', multiline: true },
      { key: 'subline',  label: 'City / venue', default: 'Basel, Switzerland' },
      { key: 'body',     label: 'Date & time', default: 'Date March 5 – 6, 2027\nDetails to follow.', multiline: true },
      { key: 'cta',      label: 'Contact', default: 'medartis.com' },
    ],
  },
  'programme-cover': {
    label: 'Programme Cover',
    desc: 'Course / event programme title page',
    fields: [
      { key: 'eyebrow',  label: 'Fixed tag', default: 'PROGRAMME' },
      { key: 'headline', label: 'Course / event title', default: 'Lower Extremity Course', multiline: true },
      { key: 'subline',  label: 'Dates · venue', default: '26 – 27 Nov 2026 · Medartis HQ, Basel' },
      { key: 'body',     label: 'Faculty', default: 'Faculty Pedro Caba · Jordi Teixidor · Eva Gil', multiline: true },
      { key: 'cta',      label: 'Organiser line', default: 'Medartis AG · Basel · medartis.com' },
    ],
  },
  'thank-you-card': {
    label: 'Thank You Card',
    desc: 'Personal thanks — visit, course, collaboration',
    fields: [
      { key: 'eyebrow',  label: 'Fixed tag', default: 'THANK YOU' },
      { key: 'headline', label: 'Message headline', default: 'Danke f\u00fcr Ihren Besuch.', multiline: true },
      { key: 'subline',  label: 'Recipient / occasion', default: 'AO Davos Courses 2026' },
      { key: 'body',     label: 'Personal message', default: 'Wir freuen uns auf die weitere Zusammenarbeit \u2014 bis bald in Basel.', multiline: true },
      { key: 'cta',      label: 'Sender', default: 'Ihr Medartis Team \u00b7 medartis.com' },
    ],
  },
  'celebration-card': {
    label: 'Celebration Card',
    desc: 'Birthday, anniversary, congratulations',
    fields: [
      { key: 'eyebrow',  label: 'Fixed tag', default: 'CONGRATULATIONS' },
      { key: 'headline', label: 'Occasion headline', default: 'Herzlichen Gl\u00fcckwunsch!', multiline: true },
      { key: 'subline',  label: 'Recipient / milestone', default: '10 Jahre Medartis \u00b7 Prof. R. Arora' },
      { key: 'body',     label: 'Personal message', default: 'Danke f\u00fcr zehn Jahre Partnerschaft und Vertrauen.', multiline: true },
      { key: 'cta',      label: 'Sender', default: 'Ihr Medartis Team \u00b7 medartis.com' },
    ],
  },
  'agenda-flyer': {
    label: 'Programme / Agenda',
    desc: 'Session list with times — one line per session',
    fields: [
      { key: 'eyebrow',  label: 'Fixed tag', default: 'PROGRAMME' },
      { key: 'headline', label: 'Event title', default: 'Distale Handgelenksfrakturen', multiline: true },
      { key: 'subline',  label: 'Date · venue', default: 'Monday, 23 September 2026 · Medizinische Universität Innsbruck' },
      { key: 'body',     label: 'Agenda (one session per line: time — title — faculty)', default: '09.15  Begrüssungskaffee in der Anatomie\n09.30  Indikationen und Fallbesprechung — Prof. R. Arora\n10.15  Versorgungskonzepte komplexer Frakturen (D.R.F.)\n11.00  Kaffeepause\n11.15  CMX — PSI: Wohin geht der Weg?\n13.00  Praktischer Teil — Versorgung Ö.R.F.', multiline: true },
      { key: 'cta',      label: 'Registration / organiser', default: 'Anmeldung: events@medartis.com · medartis.com' },
    ],
  },

  // ── CAROUSEL STORYTELLING TEMPLATES ─────────────────────────────
  'product-tour': {
    label: 'Product Tour · 4 slides',
    desc: 'Hero → Anatomy → Engineering → CTA',
    carouselSlides: 4,
    fields: [
      { key: 'eyebrow',  label: 'Eyebrow', default: '§ — NEW SYSTEM' },
      { key: 'headline', label: 'Product', default: 'APTUS Hand 2.0' },
      { key: 'subline',  label: 'Meta', default: 'Precision at hand.' },
      { key: 'body',     label: 'Body', default: '', multiline: true },
      { key: 'cta',      label: 'CTA', default: 'SWIPE →' },
    ],
    carouselContent: [
      { eyebrow: '§ — NEW SYSTEM',       headline: 'APTUS Hand 2.0',          subline: 'Precision at hand.',           body: 'Engineered with the surgeon, for the patient.', cta: 'SWIPE TO EXPLORE →' },
      { eyebrow: '§ 01 — ANATOMY',       headline: 'Pre-contoured.',          subline: 'Distal radius geometry.',      body: 'Plates that match anatomy out of the box — reducing intra-operative shaping.', cta: 'NEXT →' },
      { eyebrow: '§ 02 — ENGINEERING',   headline: 'TriLock locking.',        subline: 'Polyaxial · ±15°.',            body: 'Angular freedom without compromise to fixation strength.', cta: 'NEXT →' },
      { eyebrow: '§ 03 — START',         headline: 'Available now.',          subline: 'Speak to your rep.',           body: 'R_HAND-01000001_v0 — full system documentation in the catalogue.', cta: 'medartis.com / aptus' },
    ],
  },
  'surgical-technique': {
    label: 'Surgical Technique · 5 slides',
    desc: 'Clinical → Approach → Fixation → Closure → Recovery',
    carouselSlides: 5,
    fields: [
      { key: 'eyebrow',  label: 'Eyebrow', default: '§ — TECHNIQUE' },
      { key: 'headline', label: 'Step',    default: 'Distal radius fracture' },
      { key: 'subline',  label: 'Subline', default: '' },
      { key: 'body',     label: 'Body',    default: '', multiline: true },
      { key: 'cta',      label: 'Footer',  default: 'medartis.com / technique' },
    ],
    carouselContent: [
      { eyebrow: '§ — CLINICAL',      headline: 'Distal radius fracture.', subline: 'AO 23-A3, displaced.',         body: 'A peer-to-peer walk-through of the volar approach with APTUS plating.', cta: 'SWIPE THROUGH →' },
      { eyebrow: '§ 01 — APPROACH',   headline: 'Volar exposure.',         subline: 'Modified Henry.',              body: 'Pronator quadratus released and reflected ulnarly to expose the volar surface.', cta: 'NEXT →' },
      { eyebrow: '§ 02 — REDUCTION',  headline: 'Anatomical reduction.',   subline: 'Fluoroscopic confirmation.',   body: 'Length, angulation, rotation, and articular surface congruity assessed.', cta: 'NEXT →' },
      { eyebrow: '§ 03 — FIXATION',   headline: 'Plate + screws.',         subline: 'APTUS 2.5 mm TriLock.',        body: 'Variable-angle locking accommodates fragment-specific fixation.', cta: 'NEXT →' },
      { eyebrow: '§ 04 — RECOVERY',   headline: 'Early mobilisation.',     subline: 'Day 1 ROM allowed.',           body: 'Stable construct supports immediate functional rehabilitation.', cta: 'medartis.com / technique' },
    ],
  },
  'case-study': {
    label: 'Case Study · 3 slides',
    desc: 'Presentation → Treatment → Outcome',
    carouselSlides: 3,
    fields: [
      { key: 'eyebrow',  label: 'Eyebrow', default: '§ — CASE STUDY' },
      { key: 'headline', label: 'Case',    default: 'Case 142 · F · 54y' },
      { key: 'subline',  label: 'Subline', default: '' },
      { key: 'body',     label: 'Body',    default: '', multiline: true },
      { key: 'cta',      label: 'Footer',  default: 'Medartis Masters Network' },
    ],
    carouselContent: [
      { eyebrow: '§ 01 — PRESENTATION', headline: 'Case 142 · F · 54y',  subline: 'Comminuted distal radius.',  body: 'Low-energy fall, dominant hand, AO 23-C2 fracture pattern.',                                cta: 'SWIPE →' },
      { eyebrow: '§ 02 — TREATMENT',    headline: 'Volar plating.',      subline: 'APTUS 2.5 mm.',              body: 'Anatomical reduction achieved with fragment-specific locking, intra-op fluoroscopy confirmed.', cta: 'NEXT →' },
      { eyebrow: '§ 03 — OUTCOME',      headline: 'Full ROM at 6 weeks.', subline: 'DASH score 8.5.',           body: 'Patient returned to clerical work at 4 weeks, full activities at 12 weeks.',                cta: 'Quadlbauer, AT' },
    ],
  },
  'launch-countdown': {
    label: 'Launch Countdown · 4 slides',
    desc: '3 days → 2 → 1 → Today',
    carouselSlides: 4,
    fields: [
      { key: 'eyebrow',  label: 'Eyebrow', default: '§ — COUNTDOWN' },
      { key: 'headline', label: 'Day',     default: '3 DAYS' },
      { key: 'subline',  label: 'Subline', default: 'APTUS Hand 2.0' },
      { key: 'body',     label: 'Body',    default: '', multiline: true },
      { key: 'cta',      label: 'CTA',     default: 'medartis.com / aptus' },
    ],
    carouselContent: [
      { eyebrow: '§ — COUNTDOWN', headline: 'In 3 days.',     subline: 'APTUS Hand 2.0',         body: 'Something precise is coming.',                          cta: 'SWIPE →' },
      { eyebrow: '§ — COUNTDOWN', headline: 'In 2 days.',     subline: 'APTUS Hand 2.0',         body: 'Engineered with the surgeon, for the patient.',         cta: 'SWIPE →' },
      { eyebrow: '§ — COUNTDOWN', headline: 'Tomorrow.',      subline: 'APTUS Hand 2.0',         body: 'The next chapter in distal radius fixation.',           cta: 'SWIPE →' },
      { eyebrow: '§ — LAUNCH',    headline: 'Available now.', subline: 'APTUS Hand 2.0',         body: 'Speak to your rep — full catalogue documentation ready.', cta: 'medartis.com / aptus' },
    ],
  },
  'anniversary': {
    label: 'Anniversary · 3 slides',
    desc: 'Then → Now → Future',
    carouselSlides: 3,
    fields: [
      { key: 'eyebrow',  label: 'Eyebrow', default: '§ — ANNIVERSARY' },
      { key: 'headline', label: 'Era',     default: 'MMXVI — MMXXVI' },
      { key: 'subline',  label: 'Subline', default: 'Ten years of APTUS' },
      { key: 'body',     label: 'Body',    default: '', multiline: true },
      { key: 'cta',      label: 'Footer',  default: 'Medartis · MMXXVI' },
    ],
    carouselContent: [
      { eyebrow: '§ — THEN',   headline: 'MMXVI.',         subline: 'One system. One geometry.',   body: 'APTUS launched with a single plate platform serving the distal radius.', cta: 'SWIPE →' },
      { eyebrow: '§ — NOW',    headline: 'MMXXVI.',        subline: 'Five regions. One philosophy.', body: 'Hand, wrist, forearm, elbow, shoulder, foot. Five million implants placed.', cta: 'SWIPE →' },
      { eyebrow: '§ — NEXT',   headline: 'The next ten.',  subline: 'Toward total upper extremity.', body: 'Continued precision, restraint, and partnership with the surgeon.',     cta: 'medartis.com' },
    ],
  },
  'did-you-know': {
    label: 'Did You Know · 5 slides',
    desc: 'Hook → 3 facts → CTA',
    carouselSlides: 5,
    fields: [
      { key: 'eyebrow',  label: 'Eyebrow', default: '§ — DID YOU KNOW' },
      { key: 'headline', label: 'Fact',    default: 'A distal radius fracture happens every 90 seconds.' },
      { key: 'subline',  label: 'Subline', default: 'Worldwide incidence.' },
      { key: 'body',     label: 'Body',    default: '', multiline: true },
      { key: 'cta',      label: 'Footer',  default: 'Source · WHO Global Burden of Disease, MMXXIV' },
    ],
    carouselContent: [
      { eyebrow: '§ — DID YOU KNOW', headline: 'A fracture every 90 seconds.', subline: 'Worldwide distal radius incidence.', body: 'Three quick facts about the most common upper-extremity fracture.', cta: 'SWIPE →' },
      { eyebrow: '§ 01 — INCIDENCE', headline: '1 in 6.',                     subline: 'Lifetime risk for women >50.',     body: 'Postmenopausal fragility makes the distal radius the canary fracture.', cta: 'NEXT →' },
      { eyebrow: '§ 02 — ANATOMY',   headline: '7 carpals.',                  subline: '24 articular surfaces.',           body: 'Articular congruity matters — a 2 mm step doubles the risk of post-traumatic arthritis.', cta: 'NEXT →' },
      { eyebrow: '§ 03 — RETURN',    headline: '4 weeks.',                    subline: 'To desk work after volar plating.', body: 'Early mobilisation, supported by stable fixation, halves disability days.', cta: 'NEXT →' },
      { eyebrow: '§ — SOURCES',      headline: 'Build on evidence.',          subline: 'Medartis · MMXXVI',                body: 'Sources: WHO Global Burden of Disease MMXXIV · JBJS MMXXIII · BMJ MMXXII.', cta: 'medartis.com / evidence' },
    ],
  },
  'before-after': {
    label: 'Before / After · 2 slides',
    desc: 'Pre-op → Post-op',
    carouselSlides: 2,
    fields: [
      { key: 'eyebrow',  label: 'Eyebrow', default: '§ — RADIOGRAPHIC' },
      { key: 'headline', label: 'Phase',   default: 'BEFORE' },
      { key: 'subline',  label: 'Subline', default: '' },
      { key: 'body',     label: 'Body',    default: '', multiline: true },
      { key: 'cta',      label: 'Footer',  default: 'Anonymised case · with patient consent' },
    ],
    carouselContent: [
      { eyebrow: '§ — RADIOGRAPHIC', headline: 'BEFORE',                  subline: 'AO 23-C2 · displaced.',           body: 'Pre-operative imaging at presentation.',                            cta: 'SWIPE →' },
      { eyebrow: '§ — RADIOGRAPHIC', headline: 'AFTER · 12 weeks.',       subline: 'APTUS 2.5 mm · union confirmed.', body: 'Full radio-carpal congruity restored, no implant migration.',       cta: 'Anonymised case · with patient consent' },
    ],
  },
  'conference-recap': {
    label: 'Conference Recap · 5 slides',
    desc: 'Opening → Sessions → Highlights → Booth → Thank you',
    carouselSlides: 5,
    fields: [
      { key: 'eyebrow',  label: 'Eyebrow', default: '§ — RECAP' },
      { key: 'headline', label: 'Event',   default: 'FESSH MMXXVI' },
      { key: 'subline',  label: 'Subline', default: 'Basel, Switzerland' },
      { key: 'body',     label: 'Body',    default: '', multiline: true },
      { key: 'cta',      label: 'Footer',  default: 'events / MMXXVI' },
    ],
    carouselContent: [
      { eyebrow: '§ — RECAP',       headline: 'FESSH MMXXVI.',           subline: 'Basel, 12 — 15 June.',           body: 'Four days of hand surgery science, gathered in five slides.',    cta: 'SWIPE →' },
      { eyebrow: '§ 01 — OPENING',  headline: '1 200 surgeons.',         subline: '42 countries.',                  body: 'Largest European hand congress in five years.',                  cta: 'NEXT →' },
      { eyebrow: '§ 02 — SESSIONS', headline: '8 invited talks.',        subline: 'On distal radius management.',   body: 'Variable-angle locking debated alongside conservative protocols.', cta: 'NEXT →' },
      { eyebrow: '§ 03 — BOOTH',    headline: 'Hands-on with APTUS.',    subline: 'Booth 42.',                      body: 'Cadaveric stations supported deep dives on plate selection.',    cta: 'NEXT →' },
      { eyebrow: '§ — THANK YOU',   headline: 'See you in MMXXVII.',     subline: 'Vienna.',                        body: 'Save the date — FESSH returns 11 — 14 June MMXXVII.',           cta: 'medartis.com / events' },
    ],
  },
  'product-family': {
    label: 'Product Family Overview · 5 slides',
    desc: 'APTUS Hand · Wrist · Forearm · Elbow · Shoulder',
    carouselSlides: 5,
    fields: [
      { key: 'eyebrow',  label: 'Eyebrow', default: '§ — APTUS FAMILY' },
      { key: 'headline', label: 'System',  default: 'APTUS Hand' },
      { key: 'subline',  label: 'Meta',    default: 'Precision at hand.' },
      { key: 'body',     label: 'Body',    default: '', multiline: true },
      { key: 'cta',      label: 'Footer',  default: 'medartis.com / aptus' },
    ],
    carouselContent: [
      { eyebrow: '§ — APTUS FAMILY',   headline: 'APTUS Hand',     subline: 'Precision at hand.',         body: 'Plate and screw systems for the metacarpals and phalanges.',     cta: 'SWIPE FAMILY →' },
      { eyebrow: '§ — APTUS FAMILY',   headline: 'APTUS Wrist',    subline: 'Tuned for performance.',     body: 'Variable-angle locking for the distal radius and ulna.',         cta: 'NEXT →' },
      { eyebrow: '§ — APTUS FAMILY',   headline: 'APTUS Forearm',  subline: 'In shape for control.',      body: 'Diaphyseal and meta-diaphyseal plating for radius and ulna.',    cta: 'NEXT →' },
      { eyebrow: '§ — APTUS FAMILY',   headline: 'APTUS Elbow',    subline: 'Hidden expertise.',          body: 'Anatomical fixation for distal humerus and olecranon fractures.', cta: 'NEXT →' },
      { eyebrow: '§ — APTUS FAMILY',   headline: 'APTUS Shoulder', subline: 'Made for support.',          body: 'Clavicle, scapula, and proximal humerus systems.',                cta: 'medartis.com / aptus' },
    ],
  },
};

// ── LAYOUTS ──────────────────────────────────────────────────────────
const LAYOUTS = {
  'image-bottom': { label: 'Image · Text top', draw: (ctx, frame, content, image, opts) => drawImageTextSplit(ctx, frame, content, image, opts, 'top') },
  'image-top':    { label: 'Text · Image bottom', draw: (ctx, frame, content, image, opts) => drawImageTextSplit(ctx, frame, content, image, opts, 'bottom') },
  'overlay':      { label: 'Full-bleed overlay', draw: (ctx, frame, content, image, opts) => drawFullBleedOverlay(ctx, frame, content, image, opts) },
  'split-right':  { label: 'Image right · Text left', draw: (ctx, frame, content, image, opts) => drawSideBySide(ctx, frame, content, image, opts, 'right') },
  'split-left':   { label: 'Image left · Text right', draw: (ctx, frame, content, image, opts) => drawSideBySide(ctx, frame, content, image, opts, 'left') },
  'type-only':    { label: 'Type only · no image', draw: (ctx, frame, content, image, opts) => drawTypeOnly(ctx, frame, content, image, opts) },
  'table':        { label: 'Table · agenda & facts', draw: (ctx, frame, content, image, opts) => drawTable(ctx, frame, content, image, opts) },
  'stat':         { label: 'Statistic · one number', draw: (ctx, frame, content, image, opts) => drawStat(ctx, frame, content, image, opts) },
  'duo':          { label: 'Duo · two images compared', draw: (ctx, frame, content, image, opts) => drawDuo(ctx, frame, content, image, opts) },
  'lanyard':      { label: 'Lanyard · repeating mark', draw: (ctx, frame, content, image, opts) => drawLanyardStrip(ctx, frame, content, image, opts) },
};

// ─── WHICH LAYOUT IS A TEMPLATE FOR? ─────────────────────────────────
// A story has a shape. "Did you know" is a statistic; an agenda is a table; a
// quote is type on a surface with nothing else in the way. Until now every
// template landed on whatever layout happened to be selected, so the layouts and
// the templates — the two halves of the same decision — knew nothing about each
// other.
//
// This is a SUGGESTION, not a rule: it is applied when you pick a template and
// have not overridden the layout yourself, and it is offered as a one-click hint
// when you have. The system should have an opinion and lose the argument.
const TEMPLATE_LAYOUT = {
  'quote-card':          'type-only',    // a pull quote wants nothing else on the page
  'save-the-date':       'table',        // date · time · venue IS the content
  'event-invitation':    'table',
  'programme-cover':     'table',
  'agenda-flyer':        'table',
  'did-you-know':        'stat',         // the number is the message
  'anniversary':         'stat',
  'launch-countdown':    'stat',
  'before-after':        'duo',          // a comparison must be seen together
  'internal-comms':      'type-only',
  'celebration-card':    'type-only',
  'thank-you-card':      'type-only',
  'surgeon-recognition': 'split-right',  // a portrait beside the words
  'lanyard':             'lanyard',
};

// ─── CUSTOM FORMATS ──────────────────────────────────────────────────
// Registered INTO FORMATS, not kept beside it. FORMATS is read by module-level
// functions (computeTypeScale, formatCategory, generateProjectName) that cannot
// see React state — so a custom format that lived in a parallel map would work in
// the picker and then be invisible to the type engine, which is worse than not
// having it. One registry, one truth.
function registerCustomFormats() {
  for (const k of Object.keys(FORMATS)) if (FORMATS[k].custom) delete FORMATS[k];
  for (const f of readCustomFormats()) FORMATS[f.id] = f;
}
registerCustomFormats();

// Default to all 3 layouts; explicit overrides for formats where one doesn't make sense.
// The order IS the menu. Image-led first (the common case), then the composed
// ones, then type-only — which is the right answer more often than its position
// suggests, but should not be the first thing offered.
const ALL_LAYOUTS = ['image-bottom', 'image-top', 'overlay', 'split-right', 'split-left', 'duo', 'stat', 'table', 'type-only'];
// What a format can HOLD, not what we happen to have written. A 4:1 banner has no
// room for a stat's figure or a table's rows — offering them would be offering a
// broken result. A strap has exactly one layout, and that is not a limitation.
const FORMAT_LAYOUTS_OVERRIDES = {
  'lanyard-20':    ['lanyard'],
  'lanyard-25':    ['lanyard'],
  // Carousels: one message per slide, so duo (which wants two pictures at once)
  // and table (which wants a page) are the wrong tools.
  'ig-carousel':   ['image-bottom', 'overlay', 'split-right', 'split-left', 'stat', 'type-only'],
  'li-carousel':   ['image-bottom', 'overlay', 'split-right', 'split-left', 'stat', 'type-only'],
  // Wide + shallow: side-by-side is the natural move, a table is not.
  'li-ad':         ['image-bottom', 'overlay', 'split-right', 'split-left', 'type-only'],
  'li-banner':     ['image-bottom', 'overlay', 'split-right', 'split-left', 'type-only'],
  'fb-cover':      ['image-bottom', 'overlay', 'split-right', 'split-left', 'type-only'],
  'x-header':      ['image-bottom', 'overlay', 'split-right', 'split-left', 'type-only'],
  'yt-banner':     ['image-bottom', 'overlay', 'split-right', 'split-left', 'type-only'],
  'email-header':  ['image-bottom', 'overlay', 'split-right', 'split-left', 'type-only'],
  'email-footer':  ['image-bottom', 'overlay', 'split-right', 'split-left', 'type-only'],
  'web-hero':      ['overlay', 'image-bottom', 'split-right', 'split-left', 'type-only'],
  'screensaver':   ['overlay', 'image-bottom', 'split-right', 'split-left', 'stat', 'type-only'],
  'screensaver-4k':['overlay', 'image-bottom', 'split-right', 'split-left', 'stat', 'type-only'],
  // A business card is 85 mm wide. A table on it would be a joke.
  'business-card': ['type-only', 'split-right', 'split-left', 'image-bottom'],
};
const FORMAT_LAYOUTS = new Proxy({}, {
  get(_, k) { return FORMAT_LAYOUTS_OVERRIDES[k] || ALL_LAYOUTS; }
});

// Full image transform model:
//   mode      'cover' | 'contain'  — base scale strategy
//   focalX,Y  0..1 — point on the SOURCE image that anchors to the destination center
//   scale     0.1..5.0 — zoom multiplier on top of base mode
//   offsetX,Y -200..200 — pan in % of destination width/height
//   rotation  -180..180 — degrees, around the anchor point
const DEFAULT_FIT = {
  mode: 'cover',
  focalX: 0.5, focalY: 0.5,
  scale: 1.0,
  offsetX: 0, offsetY: 0,
  rotation: 0,
  // Frame ratio = how much of the canvas the IMAGE occupies in split layouts.
  // null  → use layout default (0.55 tall, 0.5 wide).
  // 0..1  → custom (0.2 = small image / lots of text, 0.85 = big image / little text)
  frameRatio: null,
  // Edge fade — gradient mask per edge with two stops:
  //   start = 0..1, where the SOLID bg color band ends (gradient begins)
  //   end   = 0..1, where the gradient reaches fully transparent (image shows through)
  // start == end → no fade
  // start = 0, end = 0.3 → equivalent to a 30%-deep gradient fade from the edge
  // start = 0.1, end = 0.4 → 10% solid bg, then fade over the next 30%
  edgeFade: {
    top:    { start: 0, end: 0 },
    right:  { start: 0, end: 0 },
    bottom: { start: 0, end: 0 },
    left:   { start: 0, end: 0 },
  },
  // Frame EDGES — move an edge of the image frame inward (or slightly outward).
  // The image re-fits into the smaller rect and the palette background fills the
  // freed space. Per-edge, as a fraction of the frame.
  frameInset: { top: 0, right: 0, bottom: 0, left: 0 },
  // Frame TILT — diagonal cuts on any edge (poster treatment). The cut only ever
  // moves INTO the image, so surrounding content is never covered; the background
  // shows through the wedge.
  frameTilt: { top: 0, right: 0, bottom: 0, left: 0 },
};

// ── FRAME EDGES & TILT ───────────────────────────────────────────────
const TILT_MAX = 30;
const INSET_MIN = -0.1, INSET_MAX = 0.4;
const normalizeFrameInset = (v) => {
  const o = { top: 0, right: 0, bottom: 0, left: 0 };
  if (!v || typeof v !== 'object') return o;
  for (const k of ['top', 'right', 'bottom', 'left']) o[k] = clamp(v[k] || 0, INSET_MIN, INSET_MAX);
  return o;
};
const normalizeFrameTilt = (v) => {
  const o = { top: 0, right: 0, bottom: 0, left: 0 };
  if (!v || typeof v !== 'object') return o;
  for (const k of ['top', 'right', 'bottom', 'left']) o[k] = clamp(v[k] || 0, -TILT_MAX, TILT_MAX);
  return o;
};
// Move the frame edges: returns the inset rect (never smaller than 10%).
function applyFrameInset(rect, ins) {
  if (!rect || !(ins.top || ins.right || ins.bottom || ins.left)) return rect;
  return {
    x: rect.x + ins.left * rect.w,
    y: rect.y + ins.top * rect.h,
    w: Math.max(rect.w * 0.1, rect.w * (1 - ins.left - ins.right)),
    h: Math.max(rect.h * 0.1, rect.h * (1 - ins.top - ins.bottom)),
  };
}
// Clip whatever `fn` draws to a quad with the requested edge tilts.
function withFrameTiltClip(ctx, rect, tilts, fn) {
  if (!rect || !(tilts.top || tilts.right || tilts.bottom || tilts.left)) { fn(); return; }
  const tan = (deg) => Math.tan(deg * Math.PI / 180);
  const { x, y, w: rw, h: rh } = rect;
  const TL = [x, y], TR = [x + rw, y], BR = [x + rw, y + rh], BL = [x, y + rh];
  { const d = tan(tilts.top) * rw;    if (d >= 0) TL[1] += d; else TR[1] -= d; }
  { const d = tan(tilts.bottom) * rw; if (d >= 0) BR[1] -= d; else BL[1] += d; }
  { const d = tan(tilts.left) * rh;   if (d >= 0) TL[0] += d; else BL[0] -= d; }
  { const d = tan(tilts.right) * rh;  if (d >= 0) BR[0] -= d; else TR[0] += d; }
  ctx.save();
  ctx.beginPath();
  [TL, TR, BR, BL].forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.clip();
  fn();
  ctx.restore();
}

// hex (#RRGGBB) → rgba(r,g,b,a) string
const hexToRgba = (hex, a) => {
  if (!hex) return `rgba(0,0,0,${a})`;
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

// ── REAL MEDARTIS LIBRARY (02-assets/visuals) ────────────────────────
const LIBRARY = [
  { id: 'plates-bone',      label: 'Compression plates · bone',  src: '/library/plates-bone.jpg',      category: 'btl' },
  { id: 'instruments-bone', label: 'Specific instrumentation',   src: '/library/instruments-bone.jpg', category: 'btl' },
  { id: 'plates-coal',      label: 'Plates · coal',              src: '/library/plates-coal.jpg',      category: 'btl-coal' },
  { id: 'tray-coal',        label: 'Tool tray · coal',           src: '/library/tray-coal.jpg',        category: 'btl-coal' },
  { id: 'fracture',         label: 'Fracture visual',            src: '/library/fracture-visual.jpg',  category: 'low-key' },
  { id: 'distal-ulna',      label: 'Distal ulna plate',          src: '/library/distal-ulna.jpg',      category: 'low-key' },
  { id: 'xray-sizer',       label: 'X-ray sizer',                src: '/library/xray-sizer.jpg',       category: 'xray' },
  { id: 'people-lab',       label: 'Manufacturing · lab',        src: '/library/people-lab.jpg',       category: 'atl' },
  { id: 'people-02',        label: 'People · 02',                src: '/library/people-02.jpg',        category: 'atl' },
  { id: 'people-03',        label: 'People · 03',                src: '/library/people-03.jpg',        category: 'atl' },
  { id: 'ibra-lab-01',      label: 'IBRA cadaver lab · 01',      src: '/library/ibra-lab-01.jpg',      category: 'atl' },
  { id: 'ibra-lab-02',      label: 'IBRA cadaver lab · 02',      src: '/library/ibra-lab-02.jpg',      category: 'atl' },
];

// ── HELPERS ──────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── PROJECT NAMING ───────────────────────────────────────────────────
// Short tags per content template — chosen for one-glance scanability in
// the gallery (LAUNCH / EVENT / MASTERS / THOUGHT / INTERNAL).
const TEMPLATE_TAGS = {
  'product-launch':       'LAUNCH',
  'congress':             'EVENT',
  'surgeon-recognition':  'MASTERS',
  'quote-card':           'THOUGHT',
  'internal-comms':       'INTERNAL',
  'event-invitation':     'INVITATION',
  'save-the-date':        'STD',
  'programme-cover':      'PROGRAMME',
  'agenda-flyer':         'AGENDA',
  'thank-you-card':       'THANKS',
  'celebration-card':     'CELEBRATE',
  // Carousel storytelling templates
  'product-tour':         'TOUR',
  'surgical-technique':   'TECHNIQUE',
  'case-study':           'CASE',
  'launch-countdown':     'COUNTDOWN',
  'anniversary':          'ANNIV',
  'did-you-know':         'FACTS',
  'before-after':         'BEFORE-AFTER',
  'conference-recap':     'RECAP',
  'product-family':       'FAMILY',
};

// Format code: uppercase, hyphenated; carousel suffixes get the slide count
function formatTag(formatKey, multi, slides) {
  const k = (formatKey || '').toUpperCase();
  return multi && slides > 1 ? `${k}-${slides}` : k;
}

// Slugify a free-text headline → ASCII-safe, hyphenated, 32-char max
function slugify(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function yymmdd(d = new Date()) {
  const y = (d.getFullYear() % 100).toString().padStart(2, '0');
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return y + m + day;
}

// Build the auto-generated project name from current state. Components are
// joined with " · " (mid-dot) and uppercase tags read at a glance.
function generateProjectName({ templateKey, formatKey, content, carouselSlides }) {
  const tmplTag = TEMPLATE_TAGS[templateKey] || 'PROJ';
  const fmt = FORMATS[formatKey] || {};
  const fmtTag = formatTag(formatKey, !!fmt.multi, carouselSlides);
  const headline = content?.headline || content?.eyebrow || '';
  const slug = slugify(headline) || 'untitled';
  return `${tmplTag} · ${fmtTag} · ${slug} · ${yymmdd()}`;
}

// Unified file→image loader. Handles PSD via ag-psd (returns the composite
// flattened image) and any normal raster format via FileReader+Image.
// Returns a Promise<string> resolving to a data URL.
async function fileToImageDataUrl(file) {
  const name = (file.name || '').toLowerCase();
  const isPsd = name.endsWith('.psd') || name.endsWith('.psb') || file.type === 'image/vnd.adobe.photoshop';
  if (isPsd) {
    const buf = await file.arrayBuffer();
    // Parse with composite rendering — gives us psd.canvas as the flattened image
    const psd = readPsd(buf, { skipLayerImageData: true, useImageData: false });
    if (!psd.canvas) throw new Error('PSD has no composite — re-save in Photoshop with "Maximize Compatibility" enabled.');
    return psd.canvas.toDataURL('image/png');
  }
  // Default raster path
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (ev) => resolve(ev.target.result);
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}

// QR code defaults + async image factory.
const DEFAULT_QR = {
  enabled: false,
  url: 'https://medartis.com',
  pos: 'br',          // 'tl' | 'tr' | 'bl' | 'br'
  size: 0.16,         // 16% of short side
  style: 'rounded',   // 'rounded' | 'dots' | 'classy' | 'extra-rounded' | 'square'
  color: 'auto',      // 'auto' | 'ink' | 'bone'
  backdrop: true,     // soft pill behind the QR for legibility on busy images
};
const QR_CACHE = new Map();  // key → Image
async function makeQrImage(url, style, colorHex, pxSize) {
  const key = `${url}|${style}|${colorHex}|${pxSize}`;
  if (QR_CACHE.has(key)) return QR_CACHE.get(key);
  const qr = new QRCodeStyling({
    width: pxSize, height: pxSize,
    data: url, margin: 0,
    qrOptions: { errorCorrectionLevel: 'M' },
    dotsOptions:         { type: style, color: colorHex },
    cornersSquareOptions:{ type: 'extra-rounded', color: colorHex },
    cornersDotOptions:   { type: 'dot', color: colorHex },
    backgroundOptions:   { color: 'transparent' },
  });
  const blob = await qr.getRawData('png');
  const objUrl = URL.createObjectURL(blob);
  const img = await new Promise((resolve) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.src = objUrl;
  });
  QR_CACHE.set(key, img);
  return img;
}

// Draw a QR image onto the canvas at the configured corner. The image
// must be pre-generated (makeQrImage) and passed in.
function drawQrOverlay(ctx, frame, qr, qrImg, palette) {
  if (!qr?.enabled || !qrImg) return;
  const { w, h, padX, padY } = frame;
  const base = Math.min(w, h);
  const sz = base * clamp(qr.size, 0.06, 0.5);
  const margin = Math.min(padX, padY);
  let x, y;
  if (qr.pos === 'tl') { x = margin;          y = margin; }
  if (qr.pos === 'tr') { x = w - sz - margin; y = margin; }
  if (qr.pos === 'bl') { x = margin;          y = h - sz - margin; }
  if (qr.pos === 'br') { x = w - sz - margin; y = h - sz - margin; }

  // Optional rounded backdrop so the QR is readable over busy imagery
  if (qr.backdrop) {
    const pad = sz * 0.08;
    const r = sz * 0.08;
    const bx = x - pad, by = y - pad, bw = sz + pad * 2, bh = sz + pad * 2;
    ctx.fillStyle = palette.mode === 'dark'
      ? 'rgba(250,248,240,0.92)'
      : 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
    ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
    ctx.arcTo(bx, by + bh, bx, by, r);
    ctx.arcTo(bx, by, bx + bw, by, r);
    ctx.closePath();
    ctx.fill();
  }
  ctx.drawImage(qrImg, x, y, sz, sz);
}
const pxToPt = (px, dpi) => px * 72 / dpi;
const pxToMm = (px, dpi) => px * 25.4 / dpi;
const hexRgb = (hex) => {
  const h = (hex || '#000').replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
};
// ── WCAG 2.1 contrast (used by the live BRAND CHECK panel) ──────────
// Relative luminance and contrast ratio per WCAG. AA wants 4.5:1 for normal
// text, 3:1 for large/bold text and non-text elements (rules, icons).
const relLuminance = (hex) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrastRatio = (a, b) => {
  const la = relLuminance(a), lb = relLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

// Sample the canvas's average luminance over a rect (0..255 scale). Uses a
// downsampled getImageData of just that rect — cheap enough for the small
// rects we care about (wordmark / sender / QR).
function sampleCanvasLuminance(ctx, x, y, w, h) {
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const sw = Math.max(1, Math.min(Math.floor(w), cw - sx));
  const sh = Math.max(1, Math.min(Math.floor(h), ch - sy));
  if (sw <= 0 || sh <= 0) return 128;
  let img;
  try { img = ctx.getImageData(sx, sy, sw, sh); } catch { return 128; }
  const d = img.data;
  // Sample every Nth pixel to keep it fast for huge canvases
  const stride = Math.max(4, Math.floor(d.length / 4 / 1024)) * 4;
  let sum = 0, n = 0;
  for (let i = 0; i < d.length; i += stride) {
    sum += 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
    n++;
  }
  return n ? sum / n : 128;
}

// ── LOGO LEGIBILITY OVER IMAGERY ────────────────────────────────────
// Auto-contrast alone CANNOT guarantee a readable logo: on a mid-tone or busy
// photo neither ink nor bone reaches AA, and a high-variance background (edges
// running straight through the letterforms) shreds the mark even when the mean
// contrast looks fine. So we measure, and when the measurement fails we lay a
// backdrop down first — then re-measure against that backdrop to pick the ink.
// The result is guaranteed, not hoped for.

// Mean + standard deviation of luminance over a rect (0..255).
function sampleCanvasStats(ctx, x, y, w, h) {
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  const sx = Math.max(0, Math.floor(x)), sy = Math.max(0, Math.floor(y));
  const sw = Math.max(1, Math.min(Math.floor(w), cw - sx));
  const sh = Math.max(1, Math.min(Math.floor(h), ch - sy));
  if (sw <= 0 || sh <= 0) return { mean: 128, std: 0 };
  let img;
  try { img = ctx.getImageData(sx, sy, sw, sh); } catch { return { mean: 128, std: 0 }; }
  const d = img.data;
  const stride = Math.max(4, Math.floor(d.length / 4 / 1024)) * 4;
  let sum = 0, sumSq = 0, n = 0;
  for (let i = 0; i < d.length; i += stride) {
    const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    sum += l; sumSq += l * l; n++;
  }
  if (!n) return { mean: 128, std: 0 };
  const mean = sum / n;
  return { mean, std: Math.sqrt(Math.max(0, sumSq / n - mean * mean)) };
}

// Contrast of a hex colour against a sampled 0..255 grey level.
const contrastVsLevel = (hex, level) => {
  const v = level / 255;
  const lin = v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  const la = relLuminance(hex), lb = lin;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

// The best contrast either brand ink can manage against this background, and how
// busy that background is. `std` above ~46 means detail is running through the mark.
const LOGO_MIN_CR = 4.5;   // WCAG AA for the wordmark
const LOGO_MAX_STD = 46;   // above this the background is too busy to trust
function logoLegibility(ctx, box, pad) {
  const { mean, std } = sampleCanvasStats(ctx, box.x - pad, box.y - pad, box.w + pad * 2, box.h + pad * 2);
  const best = Math.max(contrastVsLevel(BRAND.ink, mean), contrastVsLevel(BRAND.bone00, mean));
  return { mean, std, best, safe: best >= LOGO_MIN_CR && std <= LOGO_MAX_STD };
}

// Lay a backdrop behind the mark so it is readable no matter what is underneath.
//   plate   — solid palette panel: absolute guarantee, most visible
//   frosted — blurred glass: protects while keeping the photo present
//   scrim   — soft directional wash: lightest touch
function drawLogoBackdrop(ctx, box, mode, palette) {
  if (!mode || mode === 'off' || !box) return;
  const pad = Math.max(10, box.h * 0.55);
  const x = box.x - pad, y = box.y - pad;
  const w = box.w + pad * 2, h = box.h + pad * 2;
  const dark = palette.mode === 'dark';
  const r = Math.min(w, h) * 0.22;

  if (mode === 'frosted') {
    drawFrostedGlass(ctx, x, y, w, h, {
      blur: Math.max(8, box.h * 0.5),
      tint: dark ? 'rgba(19,19,16,0.42)' : 'rgba(250,248,240,0.46)',
      radius: r,
    });
    return;
  }
  if (mode === 'scrim') {
    // Soft wash that fades out away from the mark — no hard edge.
    const g = ctx.createLinearGradient(x, y, x, y + h);
    const c = dark ? '19,19,16' : '250,248,240';
    g.addColorStop(0, `rgba(${c},0.80)`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(x, y, w, h * 1.6); ctx.restore();
    return;
  }
  // plate (default): a solid, rounded panel in the surface colour.
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  ctx.fillStyle = dark ? 'rgba(19,19,16,0.88)' : 'rgba(250,248,240,0.92)';
  ctx.fill();
  ctx.restore();
}

// Resolve 'auto' contrast colour: sample canvas luminance and pick ink or bone
// based on what's actually behind the element. Returns hex string.
function resolveAutoContrast(ctx, x, y, w, h, fallbackDark) {
  const lum = sampleCanvasLuminance(ctx, x, y, w, h);
  // Threshold ~140 (slightly brighter than mid-grey) gives nicer behaviour
  // because we'd rather pick dark ink on slightly-grey backgrounds than light.
  if (lum > 140) return BRAND.ink;
  if (lum < 70)  return BRAND.bone00;
  // Mid-grey: fall back to whatever the palette prefers
  return fallbackDark ? BRAND.bone00 : BRAND.ink;
}

// Crop-mark colour resolution: 'auto' picks a near-black or near-white that
// contrasts with the palette background. 'ink' or 'bone' force it.
const resolveCropMarkRgb = (palette, override) => {
  if (override === 'ink')  return hexRgb(BRAND.ink);
  if (override === 'bone') return hexRgb(BRAND.bone00);
  return palette?.mode === 'dark' ? hexRgb(BRAND.bone00) : hexRgb(BRAND.ink);
};

// ── PDF font loading (one-time fetch + register) ────────────────────
const PDF_FONT_SPECS = [
  { file: 'Inter-Light.ttf',         family: 'Inter',          style: 'normal', weight: 300 },
  { file: 'Inter-Regular.ttf',       family: 'Inter',          style: 'normal', weight: 400 },
  { file: 'Inter-Medium.ttf',        family: 'Inter',          style: 'normal', weight: 500 },
  { file: 'Inter-SemiBold.ttf',      family: 'Inter',          style: 'normal', weight: 600 },
  { file: 'Inter-Bold.ttf',          family: 'Inter',          style: 'normal', weight: 700 },
  { file: 'JetBrainsMono-Medium.ttf',family: 'JetBrainsMono',  style: 'normal', weight: 500 },
];
const PDF_FONT_CACHE = { loaded: false, b64: {} };
async function ensurePdfFontsLoaded() {
  if (PDF_FONT_CACHE.loaded) return;
  for (const f of PDF_FONT_SPECS) {
    const res = await fetch('/fonts/' + f.file);
    if (!res.ok) throw new Error(`Font fetch failed: ${f.file}`);
    const buf = await res.arrayBuffer();
    // base64 encode without spread (avoid stack overflow on big arrays)
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    PDF_FONT_CACHE.b64[f.file] = btoa(bin);
  }
  PDF_FONT_CACHE.loaded = true;
}
function registerPdfFonts(pdf) {
  for (const f of PDF_FONT_SPECS) {
    pdf.addFileToVFS(f.file, PDF_FONT_CACHE.b64[f.file]);
    pdf.addFont(f.file, f.family, f.style, f.weight);
  }
}

// ── SVG path parser → jsPDF line/curve commands ─────────────────────
// Handles M/L/C/Z (absolute) and m/l/c/v/h/s (relative) — covers the
// wordmark.svg subset used by Medartis.
// SMOOTH CURVES REFLECT THE PREVIOUS CONTROL POINT — BUT ONLY IF THERE WAS ONE.
//
// The SVG spec: for S/s, if the preceding command was not C/c/S/s, the first
// control point is COINCIDENT WITH THE CURRENT POINT. `lastCx/lastCy` were only
// ever written by the cubic cases and never reset by a line, so `v29.257s7.619,0,
// 7.619,0` reflected a control point from some earlier curve — often far away —
// and flung the curve across the artwork.
//
// It was invisible for as long as the only artwork here was the medartis wordmark.
// KeriMedical uses exactly that pattern, and it printed 63% too wide, bursting out
// of a 20mm strap, while the canvas (whose Path2D implements the spec) drew it
// perfectly. Two renderers, one right.
//
// The fix is to set lastC = current on every non-cubic command: the existing
// reflection `2*cx - lastCx` then collapses to `cx`, which IS the spec, with no
// extra flag to keep in sync.
function svgPathToPdfOps(d) {
  const ops = [];
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[+-]?\d+)?/g) || [];
  let i = 0, cmd = '', cx = 0, cy = 0, startX = 0, startY = 0, lastCx = 0, lastCy = 0;
  let firstOfCmd = true;
  const nextNum = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) {
      cmd = tokens[i]; i++; firstOfCmd = true; continue;
    }
    // After the first numeric set for an M/m, subsequent pairs are implicit L/l
    let c = cmd;
    if (!firstOfCmd) {
      if (c === 'M') c = 'L';
      else if (c === 'm') c = 'l';
    }
    firstOfCmd = false;
    switch (c) {
      case 'M': { const x = nextNum(), y = nextNum(); cx = x; cy = y; startX = x; startY = y; lastCx = cx; lastCy = cy; ops.push({ op: 'M', x, y }); break; }
      case 'm': { const dx = nextNum(), dy = nextNum(); cx += dx; cy += dy; startX = cx; startY = cy; lastCx = cx; lastCy = cy; ops.push({ op: 'M', x: cx, y: cy }); break; }
      case 'L': { const x = nextNum(), y = nextNum(); cx = x; cy = y; lastCx = cx; lastCy = cy; ops.push({ op: 'L', x, y }); break; }
      case 'l': { const dx = nextNum(), dy = nextNum(); cx += dx; cy += dy; lastCx = cx; lastCy = cy; ops.push({ op: 'L', x: cx, y: cy }); break; }
      case 'H': { const x = nextNum(); cx = x; lastCx = cx; lastCy = cy; ops.push({ op: 'L', x, y: cy }); break; }
      case 'h': { const dx = nextNum(); cx += dx; lastCx = cx; lastCy = cy; ops.push({ op: 'L', x: cx, y: cy }); break; }
      case 'V': { const y = nextNum(); cy = y; lastCx = cx; lastCy = cy; ops.push({ op: 'L', x: cx, y }); break; }
      case 'v': { const dy = nextNum(); cy += dy; lastCx = cx; lastCy = cy; ops.push({ op: 'L', x: cx, y: cy }); break; }
      case 'C': {
        const x1 = nextNum(), y1 = nextNum(), x2 = nextNum(), y2 = nextNum(), x = nextNum(), y = nextNum();
        ops.push({ op: 'C', x1, y1, x2, y2, x, y });
        lastCx = x2; lastCy = y2; cx = x; cy = y;
        break;
      }
      case 'c': {
        const x1 = cx + nextNum(), y1 = cy + nextNum();
        const x2 = cx + nextNum(), y2 = cy + nextNum();
        const x  = cx + nextNum(), y  = cy + nextNum();
        ops.push({ op: 'C', x1, y1, x2, y2, x, y });
        lastCx = x2; lastCy = y2; cx = x; cy = y;
        break;
      }
      case 'S': {
        const x1 = 2*cx - lastCx, y1 = 2*cy - lastCy;
        const x2 = nextNum(), y2 = nextNum(), x = nextNum(), y = nextNum();
        ops.push({ op: 'C', x1, y1, x2, y2, x, y });
        lastCx = x2; lastCy = y2; cx = x; cy = y;
        break;
      }
      case 's': {
        const x1 = 2*cx - lastCx, y1 = 2*cy - lastCy;
        const x2 = cx + nextNum(), y2 = cy + nextNum();
        const x  = cx + nextNum(), y  = cy + nextNum();
        ops.push({ op: 'C', x1, y1, x2, y2, x, y });
        lastCx = x2; lastCy = y2; cx = x; cy = y;
        break;
      }
      case 'Z': case 'z': { ops.push({ op: 'Z' }); cx = startX; cy = startY; break; }
      default: i++; // unknown — skip
    }
  }
  return ops;
}


// ═══ PRINTER MARKS ═══════════════════════════════════════════════════
// One function, called from BOTH pdf paths. The crop marks were previously
// written out twice — once in the raster path and once in the vector path — which
// is a guarantee that they eventually disagree.
//
// What each mark is FOR, since the panel is otherwise just a row of checkboxes:
//   crop         where to cut. The only mark most jobs need.
//   bleed        where the artwork must reach. Useful when the printer wants to
//                see that the bleed is real rather than take your word for it.
//   registration cross-hairs printed in EVERY plate — if the plates are misaligned
//                the crosses fan out, so they are the press's own alignment check.
//   colourBar    a strip of known patches, for ink density on press.
//   pageInfo     filename, date, page number in the margin. Answers "which file is
//                this?" at the exact moment nobody can remember.
//
// All of it lives OUTSIDE the trim, so it exists only when there is bleed to hold
// it — a mark inside the trim is a mark that gets printed on the finished piece.
const PDF_MARK_DEFAULTS = {
  crop: true,
  bleed: false,
  registration: false,
  colourBar: false,
  pageInfo: false,
  offsetMm: 2.117,        // InDesign's default: 6pt
  weightPt: 0.25,
};

function pdfDrawMarks(pdf, {
  trimWmm, trimHmm, bleedMm, marks, rgb, pageLabel,
}) {
  if (!(bleedMm > 0)) return;   // nowhere to put them without bleed
  const m = { ...PDF_MARK_DEFAULTS, ...(marks || {}) };
  const [r, g, b] = rgb;
  pdf.setDrawColor(r, g, b);
  pdf.setLineWidth(Math.max(0.05, (m.weightPt || 0.25) / 72 * 25.4));

  const T = bleedMm, B = bleedMm + trimHmm;
  const L = bleedMm, R = bleedMm + trimWmm;

  // ── THE SPACE THAT EXISTS ─────────────────────────────────────────────────
  // The page is trim + 2 × bleed, so the room outside the trim is EXACTLY bleedMm.
  // A crop mark occupies off + len of it. I previously capped only the OFFSET and
  // left `len` free — the term that actually overflows. At a 3mm bleed that put
  // the mark 2.42mm off the page.
  //
  // This bug is invisible on screen: content outside the MediaBox is CLIPPED, so
  // the export looks perfect and the print is wrong. You find out from the printer.
  //
  // So: derive from the space, never from a wish. off + len === bleedMm, exactly,
  // at any bleed, for any offset.
  // NOTE the absence of a minimum length. My first fix wrote Math.max(0.6, …) —
  // a floor that protects the MARK at the page's expense, which is the same
  // mistake one size down: at a 1mm bleed it overflowed again. On a tiny bleed a
  // tiny mark is the correct answer. The page always wins.
  const offWanted = Math.max(0, m.offsetMm ?? 2.117);
  const off = Math.min(offWanted, bleedMm * 0.55);   // the mark keeps at least 45%
  const len = bleedMm - off;                          // …and gets exactly the rest

  if (m.crop) {
    pdf.line(L - len - off, T, L - off, T);  pdf.line(L, T - len - off, L, T - off);
    pdf.line(R + off, T, R + len + off, T);  pdf.line(R, T - len - off, R, T - off);
    pdf.line(L - len - off, B, L - off, B);  pdf.line(L, B + off, L, B + len + off);
    pdf.line(R + off, B, R + len + off, B);  pdf.line(R, B + off, R, B + len + off);
  }

  // Bleed marks sit AT the bleed edge — that is the whole point of them.
  if (m.bleed) {
    const bl = Math.min(3, bleedMm * 0.8);
    const bT = 0, bB = bleedMm * 2 + trimHmm, bL = 0, bR = bleedMm * 2 + trimWmm;
    pdf.line(bL, bT, bL + bl, bT);  pdf.line(bL, bT, bL, bT + bl);
    pdf.line(bR - bl, bT, bR, bT);  pdf.line(bR, bT, bR, bT + bl);
    pdf.line(bL, bB, bL + bl, bB);  pdf.line(bL, bB - bl, bL, bB);
    pdf.line(bR - bl, bB, bR, bB);  pdf.line(bR, bB - bl, bR, bB);
  }

  if (m.registration) {
    // The cross's ARMS reach rad × 1.7 from a centre at bleed × 0.5 — so the arms,
    // not the circle, are what must fit. rad = (0.5 / 1.7) × bleed puts the arm tip
    // exactly on the page edge; 0.28 keeps a hair inside it. Sizing this from the
    // circle (bleed × 0.5) put the tip 1.05mm off the page at EVERY bleed the
    // 2.5mm threshold below admits.
    const rad = Math.min(1.8, bleedMm * 0.28);
    const cross = (cx, cy) => {
      pdf.circle(cx, cy, rad, 'S');
      pdf.line(cx - rad * 1.7, cy, cx + rad * 1.7, cy);
      pdf.line(cx, cy - rad * 1.7, cx, cy + rad * 1.7);
    };
    if (bleedMm >= 2.5) {
      cross(bleedMm + trimWmm / 2, bleedMm * 0.5);
      cross(bleedMm + trimWmm / 2, bleedMm * 1.5 + trimHmm);
      cross(bleedMm * 0.5, bleedMm + trimHmm / 2);
      cross(bleedMm * 1.5 + trimWmm, bleedMm + trimHmm / 2);
    }
  }

  if (m.colourBar && bleedMm >= 2.5) {
    // A real density strip: process solids, then a grey ramp.
    const patches = [
      [0, 0, 0], [255, 255, 255], [128, 128, 128], [190, 190, 190],
      [0, 174, 239], [236, 0, 140], [255, 241, 0],
    ];
    const pw = Math.min(4, trimWmm / 14);
    const ph = Math.min(bleedMm * 0.6, 3);
    let x = bleedMm;
    const y = bleedMm * 1.5 + trimHmm - ph / 2;
    for (const p of patches) {
      pdf.setFillColor(p[0], p[1], p[2]);
      pdf.rect(x, y, pw, ph, 'F');
      x += pw;
    }
    pdf.setDrawColor(r, g, b);
  }

  if (m.pageInfo) {
    pdf.setFontSize(5);
    pdf.setTextColor(r, g, b);
    try { pdf.setFont('Inter', 'normal', 400); } catch { /* fonts not registered — use the default */ }
    const label = pageLabel || '';
    if (label && bleedMm >= 2) pdf.text(label, bleedMm, bleedMm * 0.55);
  }
}

// ═══ LANYARD · VECTOR PDF ════════════════════════════════════════════
// The strap must print as VECTOR like every other format. Rasterising it at
// 150 dpi would soften the very thing a lanyard is judged on — crisp type on
// woven webbing — so the repeat is composed a second time here, in millimetres,
// mirroring drawLanyardStrip exactly.
//
// Two jsPDF traps are handled explicitly, because both produce output that looks
// almost right and is quietly wrong:
//
//   1 · setFontSize wants POINTS. charSpace wants DOCUMENT UNITS (mm) and jsPDF
//       converts to points itself — so passing mmToPt() to charSpace applies the
//       72/25.4 factor TWICE. The tracking comes out 2.83× too wide, the type
//       overruns its measured length, and it collides with the mark.
//   2 · jsPDF rotates text COUNTER-clockwise: +90 reads UP the page, −90 reads
//       DOWN. Our cursor advances DOWN for an un-flipped block and UP for a
//       flipped one, so the angle must follow the cursor or the type runs
//       backwards through the mark it is supposed to follow.
const LANYARD_CAP_RATIO = 0.727;   // Inter cap height ÷ font size

function pdfDrawLanyard(pdf, { wMm, hMm, content, cfg, palette, accent, bleedMm = 0, group }) {
  const ink   = palette.mode === 'dark' ? BRAND.bone00 : BRAND.ink;
  const muted = palette.mode === 'dark' ? BRAND.cream100 : BRAND.ink600;
  const off = bleedMm;                        // page origin → trim origin
  const mmToPt = (mm) => mm / 25.4 * 72;
  const CAP = LANYARD_CAP_RATIO;

  if (cfg.edges) {
    const [r, g, b] = hexRgb(accent || BRAND.gold);
    pdf.setFillColor(r, g, b);
    const hair = Math.max(0.2, wMm * 0.018);
    pdf.rect(off + wMm * 0.06, off - bleedMm, hair, hMm + bleedMm * 2, 'F');
    pdf.rect(off + wMm - wMm * 0.06 - hair, off - bleedMm, hair, hMm + bleedMm * 2, 'F');
  }

  const label = (content?.headline || '').trim().toUpperCase();
  const strap = cfg.strapLineOn ? (content?.subline || content?.cta || '').trim().toUpperCase() : '';
  const txtCap   = wMm * clamp(cfg.textSize, 0.12, 0.55);
  const strapCap = txtCap * 0.62;

  // Measure with the SAME engine the canvas uses, so the vector block and the
  // preview agree. Anything else and the print quietly differs from the screen.
  const meas = document.createElement('canvas').getContext('2d');
  const measure = (text, capMm, weight, family) => {
    const px = 100, scale = capMm / (px * CAP);
    meas.font = `${weight} ${px}px ${family}`;
    const ls = px * 0.16;
    const w = [...text].reduce((sum, ch) => sum + meas.measureText(ch).width + ls, -ls);
    return w * scale;
  };

  const items = [];
  if (cfg.mark !== 'none') {
    if (group?.enabled) {
      // THE SAME LOCKUP THE CANVAS DRAWS, in the same order, by the same rule —
      // cap-matched marks on a shared baseline. The two implementations of this
      // strap are why the Group lanyard printed a medartis wordmark on top of a
      // Group lockup: the canvas knew about the Group and this did not.
      const marks = [{ mark: GROUP_MARK, withByline: false }];
      if (group.coBrands?.medartis)    marks.push({ mark: MEDARTIS_WORDMARK_MARK, withByline: false });
      if (group.coBrands?.neoortho)    marks.push({ mark: NEOORTHO_MARK, withByline: false });
      if (group.coBrands?.kerimedical) marks.push({ mark: KERIMEDICAL_MARK, withByline: false });
      const ms = marks.map((m) => markMetrics(m.mark, m.withByline)).filter((q) => q.paths.length);
      if (ms.length) {
        const budget = clamp(cfg.markSize, 0.15, 0.75);
        const A = Math.max(...ms.map((q) => q.above / q.cap));
        const B = Math.max(...ms.map((q) => q.below / q.cap));
        const capMm = (wMm * budget) / (A + B);
        const gapMm = (group.gap ?? 2.6) * capMm;
        const widths = ms.map((q) => q.widthPerCap * capMm);
        const len = widths.reduce((a, b) => a + b, 0) + gapMm * (ms.length - 1);
        const baseAcross = ((A - B) / 2) * capMm;
        const variant = group.variant && group.variant !== 'auto'
          ? group.variant
          : (palette.mode === 'dark' ? 'white' : 'color');
        items.push({ len, kind: 'group', ms, widths, gapMm, capMm, baseAcross, variant });
      }
    } else {
      const markH = wMm * clamp(cfg.markSize, 0.15, 0.75);
      const markL = markH * (WM_GLYPH.w / WM_GLYPH.h);
      items.push({ len: markL, kind: 'mark', h: markH });
    }
  }
  if (label) items.push({ len: measure(label, txtCap, 700, BRAND.display), kind: 'label' });
  if (strap) items.push({ len: measure(strap, strapCap, 500, BRAND.mono), kind: 'strap' });
  if (!items.length) return;

  const itemGap   = wMm * 1.1;
  const blockLen  = items.reduce((n, it) => n + it.len, 0) + itemGap * (items.length - 1);
  const repeatGap = Math.max(wMm * 1.2, blockLen * clamp(cfg.spacing, 0.2, 3));
  const period    = blockLen + repeatGap;
  const reps      = Math.ceil((hMm + period) / period);

  for (let i = 0; i < reps; i++) {
    const blockStart = repeatGap / 2 + i * period;
    if (blockStart > hMm || blockStart + blockLen > hMm) break;
    const blockCenter = blockStart + blockLen / 2;
    const flip = cfg.mirror && blockCenter > hMm / 2;
    const textAngle = flip ? 90 : -90;        // see trap 2 above

    let cursor = -blockLen / 2;
    for (const it of items) {
      const along = cursor;
      // local (along, across) → page (x, y). jsPDF has no transform stack, so
      // every item's rotated origin is placed directly.
      const toPage = (a, across) => flip
        ? [off + wMm / 2 - across, off + blockCenter - a]
        : [off + wMm / 2 + across, off + blockCenter + a];

      if (it.kind === 'group') {
        let a = along;
        it.ms.forEach((q, k) => {
          const across = it.baseAcross - q.above * (it.capMm / q.cap);
          const [px, py] = toPage(a, across);
          pdfDrawMarkRotated(pdf, { paths: markPaths({ paths: q.paths }, it.variant, ink), glyph: q.glyph },
                             px, py, it.capMm, q.cap, ink, textAngle);
          a += it.widths[k] + it.gapMm;
        });
      } else if (it.kind === 'mark') {
        // The Medartis mark IS the wordmark — no signet, so the vector paths can
        // be laid down directly. pdfDrawWordmark cannot rotate, so a rotated
        // strap mark is drawn as tracked text would be: via the path API, with
        // the block's own rotation applied around its centre.
        const capH = it.h;
        const [px, py] = toPage(along, -capH / 2);
        pdfDrawWordmarkRotated(pdf, px, py, capH, ink, textAngle);
      } else {
        const isLabel = it.kind === 'label';
        const cap  = isLabel ? txtCap : strapCap;
        const text = isLabel ? label : strap;
        // across = -cap/2: at these angles jsPDF grows the glyphs to one side of
        // the baseline, so the baseline sits half a cap-height off-centre.
        const [px, py] = toPage(along, -cap / 2);
        pdf.setFont(isLabel ? 'Inter' : 'JetBrainsMono', 'normal', isLabel ? 700 : 500);
        pdf.setFontSize(mmToPt(cap / CAP));
        pdf.setTextColor(...hexRgb(isLabel ? ink : muted));
        pdf.text(text, px, py, {
          angle: textAngle,
          charSpace: 0.16 * cap / CAP,        // mm — NOT mmToPt(). See trap 1.
        });
      }
      cursor += it.len + itemGap;
    }
  }
}

// Stroke a parsed-path through jsPDF's low-level path API as filled shapes.
// (x, y, scale) places + scales the source coords into PDF mm.
/**
 * The wordmark, rotated, as real PDF vector.
 *
 * jsPDF has no transform stack, so pdfDrawWordmark cannot simply be wrapped in a
 * rotation the way a canvas call could. But the mark is already drawn from path
 * data — so rotating it is a coordinate transform on those same points, and the
 * output stays true vector rather than a rasterised sprite pasted at an angle.
 *
 * (x, y) is where the mark's top-left would sit UNROTATED; the rotation is applied
 * about that point, matching how jsPDF anchors rotated text.
 *
 * @param angleDeg counter-clockwise, as jsPDF measures it: +90 reads up the page.
 */
/**
 * ANY mark, rotated, as real PDF vector — the generalisation of
 * pdfDrawWordmarkRotated, which hardcodes the medartis wordmark's own geometry
 * (srcH 61, offsets 92/92) and can therefore draw exactly one logo.
 *
 * That limit is why the Group lanyard printed wrong: the PDF lanyard is a SECOND
 * implementation of the strap, and the only mark it could draw was the wordmark —
 * the one mark a Group lanyard must NOT show.
 *
 * `paths` carry their own fills, because the sub-brands are not monochrome.
 */
function pdfDrawMarkRotated(pdf, { paths, glyph }, xMm, yMm, capMm, capSrc, inkColor, angleDeg) {
  const scale = capMm / capSrc;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  // Same transform as pdfDrawWordmarkRotated: PDF's y grows DOWNWARD, which flips
  // the sine signs against the textbook formula. Get it wrong and the mark is
  // mirrored, not turned — a brand incident, not a rendering nit.
  const map = (sx, sy) => {
    const dx = (sx - glyph.x) * scale;
    const dy = (sy - glyph.y) * scale;
    return [xMm + dx * cos + dy * sin, yMm - dx * sin + dy * cos];
  };
  for (const pth of paths) {
    const [r, g, b] = hexRgb(pth.fill || inkColor);
    pdf.setFillColor(r, g, b);
    const pdfOps = [];
    for (const o of svgPathToPdfOps(pth.d)) {
      if (o.op === 'M')      pdfOps.push({ op: 'm', c: map(o.x, o.y) });
      else if (o.op === 'L') pdfOps.push({ op: 'l', c: map(o.x, o.y) });
      else if (o.op === 'C') pdfOps.push({ op: 'c', c: [...map(o.x1, o.y1), ...map(o.x2, o.y2), ...map(o.x, o.y)] });
      else if (o.op === 'Z') pdfOps.push({ op: 'h', c: [] });
    }
    pdf.path(pdfOps).fill();
  }
}

function pdfDrawWordmarkRotated(pdf, xMm, yMm, heightMm, color, angleDeg) {
  const srcH = 61, offsetX = 92, offsetY = 92;
  const scale = heightMm / srcH;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  // Source point → unrotated mm offset from the anchor → rotated → placed.
  // PDF's y axis grows DOWNWARD, which flips the sign of the sine terms relative
  // to the textbook formula; getting this wrong mirrors the mark instead of
  // turning it, and a mirrored logo is a brand incident, not a rendering nit.
  const map = (sx, sy) => {
    const dx = (sx - offsetX) * scale;
    const dy = (sy - offsetY) * scale;
    return [xMm + dx * cos + dy * sin, yMm - dx * sin + dy * cos];
  };
  const [r, g, b] = hexRgb(color);
  pdf.setFillColor(r, g, b);
  for (const dStr of WORDMARK_PATHS) {
    const pdfOps = [];
    for (const o of svgPathToPdfOps(dStr)) {
      if (o.op === 'M')      pdfOps.push({ op: 'm', c: map(o.x, o.y) });
      else if (o.op === 'L') pdfOps.push({ op: 'l', c: map(o.x, o.y) });
      else if (o.op === 'C') pdfOps.push({ op: 'c', c: [...map(o.x1, o.y1), ...map(o.x2, o.y2), ...map(o.x, o.y)] });
      else if (o.op === 'Z') pdfOps.push({ op: 'h', c: [] });
    }
    pdf.path(pdfOps).fill();
  }
}

function pdfDrawWordmark(pdf, xMm, yMm, heightMm, color) {
  const srcH = 61, offsetX = 92, offsetY = 92;
  const scale = heightMm / srcH;
  const tx = xMm - offsetX * scale;
  const ty = yMm - offsetY * scale;
  const [r, g, b] = hexRgb(color);
  pdf.setFillColor(r, g, b);

  // jsPDF v4 path() API: pass a list of {op, c} entries.
  // c = ['m'|'l'|'c'|'h', ...numbers] in PDF native ops (lowercase relative not supported,
  //     all numbers are absolute in the PDF coordinate space we pass).
  for (const dStr of WORDMARK_PATHS) {
    const ops = svgPathToPdfOps(dStr);
    const pdfOps = [];
    for (const o of ops) {
      if (o.op === 'M')      pdfOps.push({ op: 'm', c: [tx + o.x * scale, ty + o.y * scale] });
      else if (o.op === 'L') pdfOps.push({ op: 'l', c: [tx + o.x * scale, ty + o.y * scale] });
      else if (o.op === 'C') pdfOps.push({ op: 'c', c: [
        tx + o.x1 * scale, ty + o.y1 * scale,
        tx + o.x2 * scale, ty + o.y2 * scale,
        tx + o.x  * scale, ty + o.y  * scale,
      ] });
      else if (o.op === 'Z') pdfOps.push({ op: 'h', c: [] });
    }
    pdf.path(pdfOps).fill();
  }
}

// Draw the precomputed text tokens (from layoutTextElements) into the PDF
// at the correct millimetre positions using registered Inter / JetBrains Mono.
function pdfDrawTextTokens(pdf, tokens, dpi, bleedMm) {
  // Build a temporary canvas context just for letter-width measurement
  const measCanvas = document.createElement('canvas');
  const measCtx = measCanvas.getContext('2d');
  for (const t of tokens) {
    const xMm = pxToMm(t.x, dpi) + bleedMm;
    const yMm = pxToMm(t.y, dpi) + bleedMm;
    const sizePt = pxToPt(t.size, dpi);
    pdf.setFont(t.family, 'normal', t.weight);
    pdf.setFontSize(sizePt);
    const [r, g, b] = hexRgb(t.color);
    pdf.setTextColor(r, g, b);
    if (t.type === 'tracked') {
      // For tracked text, use the canvas font (must match px sizes) to compute
      // per-glyph offsets and place each character individually in mm.
      const family = t.family === 'JetBrainsMono' ? BRAND.mono : BRAND.display;
      measCtx.font = `${t.weight} ${t.size}px ${family}`;
      let cxPx = t.x;
      for (const ch of t.text) {
        const cxMm = pxToMm(cxPx, dpi) + bleedMm;
        pdf.text(ch, cxMm, yMm);
        cxPx += measCtx.measureText(ch).width + t.letterSpacing;
      }
    } else {
      pdf.text(t.text, xMm, yMm);
    }
  }
}

// Vector wordmark + folio for PDF (mirrors drawBrandBar geometry)
// Render the QR code as native PDF vector via svg2pdf. The QR is generated by
// qr-code-styling as SVG (which has crisp paths for dots/rounded styles), then
// converted to PDF path commands by svg2pdf.
async function pdfDrawQrVector(pdf, frame, palette, qr, qrInk, dpi, bleedMm) {
  if (!qr?.enabled || !qr.url) return;
  const { w, h, padX, padY } = frame;
  const base = Math.min(w, h);
  const sz = base * clamp(qr.size, 0.06, 0.5);
  const margin = Math.min(padX, padY);
  let xPx, yPx;
  if (qr.pos === 'tl') { xPx = margin;          yPx = margin; }
  if (qr.pos === 'tr') { xPx = w - sz - margin; yPx = margin; }
  if (qr.pos === 'bl') { xPx = margin;          yPx = h - sz - margin; }
  if (qr.pos === 'br') { xPx = w - sz - margin; yPx = h - sz - margin; }

  const sizeMm = pxToMm(sz, dpi);
  const xMm = pxToMm(xPx, dpi) + bleedMm;
  const yMm = pxToMm(yPx, dpi) + bleedMm;

  // Backdrop pill behind the QR (rounded rect via path operators)
  if (qr.backdrop) {
    const padMm = sizeMm * 0.08;
    const r = sizeMm * 0.08;
    const bx = xMm - padMm, by = yMm - padMm, bw = sizeMm + padMm * 2, bh = sizeMm + padMm * 2;
    const c = palette.mode === 'dark' ? [250, 248, 240] : [255, 255, 255];
    pdf.setFillColor(c[0], c[1], c[2]);
    pdf.roundedRect(bx, by, bw, bh, r, r, 'F');
  }

  // Generate the QR as SVG, parse into a DOM element, render with svg2pdf
  const qrStyling = new QRCodeStyling({
    width: 400, height: 400, type: 'svg',
    data: qr.url, margin: 0,
    qrOptions: { errorCorrectionLevel: 'M' },
    dotsOptions:         { type: qr.style, color: qrInk },
    cornersSquareOptions:{ type: 'extra-rounded', color: qrInk },
    cornersDotOptions:   { type: 'dot', color: qrInk },
    backgroundOptions:   { color: 'transparent' },
  });
  const blob = await qrStyling.getRawData('svg');
  const svgText = await blob.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svgEl = doc.documentElement;
  // svg2pdf requires the element to be attached to the DOM with a measurable size
  svgEl.setAttribute('width', '400');
  svgEl.setAttribute('height', '400');
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:400px;height:400px;';
  host.appendChild(svgEl);
  document.body.appendChild(host);
  try {
    await svg2pdf(svgEl, pdf, { x: xMm, y: yMm, width: sizeMm, height: sizeMm });
  } finally {
    document.body.removeChild(host);
  }
}

function pdfDrawBrandBar(pdf, frame, palette, formatKey, opts, dpi, bleedMm) {
  const baseInk = palette.mode === 'dark' ? BRAND.bone00 : BRAND.ink;
  const resolveColor = (override) =>
    override === 'ink' ? BRAND.ink
    : override === 'bone' ? BRAND.bone00
    : baseInk;
  // Pre-computed auto-contrast colours from caller (sampled from bitmap canvas)
  const wmColor = opts.wordmarkResolvedColor || resolveColor(opts.wordmarkColor);
  const wmPos = opts.wordmarkPos ?? 'tr';
  const flPos = opts.folioPos ?? 'bl';
  const fullCanvas = { x: 0, y: 0, w: frame.w, h: frame.h };
  const wmArea = opts.wordmarkOverImage ? fullCanvas : opts.safeArea;
  const flArea = opts.folioOverImage    ? fullCanvas : opts.safeArea;

  // Wordmark
  if (wmPos !== 'hidden') {
    const { padX, padY } = frame;
    const sa = wmArea || fullCanvas;
    let wm = wordmarkSizeFor(frame, formatKey, opts.wordmarkPctOverride);
    const maxW = Math.max(40, sa.w - padX * 1.4);
    if (wm.w > maxW) { const r = maxW / wm.w; wm = { w: wm.w * r, h: wm.h * r }; }
    const top = sa.y + padY * 0.95;
    const bottom = sa.y + sa.h - padY * 0.55;
    const left = sa.x + padX * 0.6;
    const right = sa.x + sa.w - padX * 0.6 - wm.w;
    let xPx, yPx;
    if (wmPos === 'tl') { xPx = left;  yPx = top; }
    if (wmPos === 'tr') { xPx = right; yPx = top; }
    if (wmPos === 'bl') { xPx = left;  yPx = bottom; }
    if (wmPos === 'br') { xPx = right; yPx = bottom; }
    pdfDrawWordmark(pdf,
      pxToMm(xPx, dpi) + bleedMm,
      pxToMm(yPx, dpi) + bleedMm,
      pxToMm(wm.h, dpi),
      wmColor
    );
  }

  // Folio — vector text in JetBrains Mono uppercase with tracking
  if (flPos !== 'hidden') {
    const { w, h, padX, padY } = frame;
    const sa = flArea || fullCanvas;
    const baseSize = Math.min(w, h);
    const folioSize = Math.max(10, baseSize * 0.013);
    const folio = opts.folioText || 'medartis.com';
    const ls = folioSize * 0.12;

    // Measure with canvas to compute total width
    const measCanvas = document.createElement('canvas');
    const measCtx = measCanvas.getContext('2d');
    measCtx.font = `500 ${folioSize}px ${BRAND.mono}`;
    let tw = 0;
    for (const ch of folio) tw += measCtx.measureText(ch).width + ls;

    const top = sa.y + padY * 0.85;
    const bottom = sa.y + sa.h - padY * 0.4;
    const left = sa.x + padX * 0.6;
    const right = sa.x + sa.w - padX * 0.6 - tw + ls;
    let xPx, yPx;
    if (flPos === 'tl') { xPx = left;  yPx = top; }
    if (flPos === 'tr') { xPx = right; yPx = top; }
    if (flPos === 'bl') { xPx = left;  yPx = bottom; }
    if (flPos === 'br') { xPx = right; yPx = bottom; }

    // Folio uses dim variants of the resolved colour
    const dimDark  = BRAND.cream300; // dim against dark bg
    const dimLight = BRAND.ink600;   // dim against light bg
    const color = opts.folioColor === 'ink'  ? dimLight
                : opts.folioColor === 'bone' ? dimDark
                : (palette.mode === 'dark' ? dimDark : dimLight);
    const [r, g, b] = hexRgb(color);
    pdf.setFont('JetBrainsMono', 'normal', 500);
    pdf.setFontSize(pxToPt(folioSize, dpi));
    pdf.setTextColor(r, g, b);
    const yMm = pxToMm(yPx, dpi) + bleedMm;
    let cxPx = xPx;
    for (const ch of folio) {
      pdf.text(ch, pxToMm(cxPx, dpi) + bleedMm, yMm);
      cxPx += measCtx.measureText(ch).width + ls;
    }
  }
}

// ── DRAW HELPERS ─────────────────────────────────────────────────────
const fitFont = (ctx, text, maxWidth, maxFontSize, minFontSize, weight = 700, family = BRAND.display) => {
  let size = maxFontSize;
  while (size > minFontSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
};

const wrapText = (ctx, text, maxWidth) => {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
};

// Normalise an edge value — supports the new {start,end} shape AND legacy
// numeric strength values (for old presets). Returns {start, end}.
const normEdge = (v) => {
  if (typeof v === 'number') return { start: 0, end: v };
  if (!v) return { start: 0, end: 0 };
  return { start: v.start || 0, end: v.end || 0 };
};

// Paint a fade-to-bg gradient on selected edges of a clipped rect.
// Each edge has {start, end} where start is the inner end of the SOLID band
// and end is the inner end of the FULLY-TRANSPARENT point.
const drawEdgeFades = (ctx, x, y, w, h, bg, edgeFade) => {
  if (!bg || !edgeFade) return;

  const fillEdge = (start, end, dim, dir) => {
    if (end <= 0 || end <= start) return; // off
    const ext = dim * end;
    const solidUntil = dim * start;
    // Gradient runs from canvas-edge (offset 0) to inner edge (offset = ext)
    let gradStart, gradEnd, rectX, rectY, rectW, rectH;
    if (dir === 'top') {
      gradStart = [x, y]; gradEnd = [x, y + ext];
      rectX = x; rectY = y; rectW = w; rectH = ext;
    } else if (dir === 'bottom') {
      gradStart = [x, y + h]; gradEnd = [x, y + h - ext];
      rectX = x; rectY = y + h - ext; rectW = w; rectH = ext;
    } else if (dir === 'left') {
      gradStart = [x, y]; gradEnd = [x + ext, y];
      rectX = x; rectY = y; rectW = ext; rectH = h;
    } else { // right
      gradStart = [x + w, y]; gradEnd = [x + w - ext, y];
      rectX = x + w - ext; rectY = y; rectW = ext; rectH = h;
    }
    const g = ctx.createLinearGradient(gradStart[0], gradStart[1], gradEnd[0], gradEnd[1]);
    g.addColorStop(0, hexToRgba(bg, 1));
    // Hold solid bg up to start/end of the gradient
    if (solidUntil > 0 && solidUntil < ext) {
      g.addColorStop(solidUntil / ext, hexToRgba(bg, 1));
    }
    g.addColorStop(1, hexToRgba(bg, 0));
    ctx.fillStyle = g;
    ctx.fillRect(rectX, rectY, rectW, rectH);
  };

  const top    = normEdge(edgeFade.top);
  const bottom = normEdge(edgeFade.bottom);
  const left   = normEdge(edgeFade.left);
  const right  = normEdge(edgeFade.right);

  fillEdge(top.start,    top.end,    h, 'top');
  fillEdge(bottom.start, bottom.end, h, 'bottom');
  fillEdge(left.start,   left.end,   w, 'left');
  fillEdge(right.start,  right.end,  w, 'right');
};

// Frosted-glass backdrop: clip to a rounded rect, blur the canvas content
// underneath into that clip, then add a soft tint. Designed to sit BEHIND
// text that overlays an image so the text stays readable.
//   blur     — px (default 20)
//   tint     — rgba string for the tint overlay
//   rounding — corner radius in px (default = ~3% of short edge)
const drawFrostedGlass = (ctx, x, y, w, h, opts = {}) => {
  if (w <= 0 || h <= 0) return;
  const blur = opts.blur ?? Math.max(12, Math.min(w, h) * 0.04);
  const tint = opts.tint || 'rgba(19,19,16,0.18)';
  const radius = opts.radius ?? Math.min(w, h) * 0.03;
  const canvas = ctx.canvas;
  // Snapshot the current pixels — only the rect we'll blur, plus blur padding
  const pad = Math.ceil(blur * 2);
  const sx = Math.max(0, Math.floor(x - pad));
  const sy = Math.max(0, Math.floor(y - pad));
  const sw = Math.min(canvas.width - sx, Math.ceil(w + pad * 2));
  const sh = Math.min(canvas.height - sy, Math.ceil(h + pad * 2));
  if (sw <= 0 || sh <= 0) return;
  const temp = document.createElement('canvas');
  temp.width = sw; temp.height = sh;
  temp.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, radius);
  else { ctx.rect(x, y, w, h); }
  ctx.clip();
  ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(temp, sx, sy, sw, sh);
  ctx.filter = 'none';
  ctx.fillStyle = tint;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
};

// Draw one slice of a spanning carousel background image into a target rect.
// The source image is conceptually divided into `totalSlides` equal vertical
// strips; this slide gets the strip at `slideIdx`. The strip is cover-fit
// into the target rect so the photo flows seamlessly across slides.
const drawCarouselBackground = (ctx, dx, dy, dw, dh, image, slideIdx, totalSlides, fit) => {
  if (!image || totalSlides < 1 || dw <= 0 || dh <= 0) return;
  const f = fit || { offsetX: 0, offsetY: 0, scale: 1 };
  const srcSliceW = image.width / totalSlides;
  const srcStripeX = slideIdx * srcSliceW;
  const targetAspect = dw / dh;
  const stripAspect = srcSliceW / image.height;
  let sw, sh, sx, sy;
  if (stripAspect > targetAspect) {
    sh = image.height;
    sw = sh * targetAspect;
    sx = srcStripeX + (srcSliceW - sw) / 2;
    sy = 0;
  } else {
    sw = srcSliceW;
    sh = sw / targetAspect;
    sx = srcStripeX;
    sy = (image.height - sh) / 2;
  }
  sy += (image.height - sh) * 0.5 * ((f.offsetY || 0) / 100);
  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, dw, dh);
  ctx.clip();
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();
};

// Full transform image drawer
// fit = { mode, focalX, focalY, scale, offsetX, offsetY, rotation, edgeFade }
const drawImageFit = (ctx, img, x, y, w, h, fit, bg) => {
  // FRAME EDGES / TILT — the single choke point every layout goes through, so
  // moving an edge or cutting it on the diagonal works everywhere at once. The
  // image re-fits into the reduced rect; the palette background (already painted
  // by the layout) fills whatever the frame gives back.
  const ins = normalizeFrameInset(fit?.frameInset);
  const tilts = normalizeFrameTilt(fit?.frameTilt);
  if (ins.top || ins.right || ins.bottom || ins.left) {
    const r = applyFrameInset({ x, y, w, h }, ins);
    x = r.x; y = r.y; w = r.w; h = r.h;
  }
  if (tilts.top || tilts.right || tilts.bottom || tilts.left) {
    const inner = { x, y, w, h };
    withFrameTiltClip(ctx, inner, tilts, () => drawImageFitInner(ctx, img, x, y, w, h, fit, bg));
    return;
  }
  drawImageFitInner(ctx, img, x, y, w, h, fit, bg);
};

const drawImageFitInner = (ctx, img, x, y, w, h, fit, bg) => {
  ctx.save();
  // outer clip — keeps everything (image + fades) inside the frame rect
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  if (bg) { ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); }

  if (!img) {
    ctx.fillStyle = BRAND.cream100;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = BRAND.cream300;
    ctx.font = `500 14px ${BRAND.mono}`;
    ctx.textAlign = 'center';
    ctx.fillText('NO IMAGE', x + w / 2, y + h / 2);
    ctx.textAlign = 'left';
    ctx.restore();
    return;
  }

  const f = { ...DEFAULT_FIT, ...(fit || {}) };

  const sX = w / img.width;
  const sY = h / img.height;
  const baseScale = f.mode === 'contain' ? Math.min(sX, sY) : Math.max(sX, sY);
  const finalScale = baseScale * f.scale;

  const anchorSrcX = img.width  * f.focalX;
  const anchorSrcY = img.height * f.focalY;
  const anchorDstX = x + w / 2 + (f.offsetX * w / 100);
  const anchorDstY = y + h / 2 + (f.offsetY * h / 100);

  // Inner save so the rotation/translation doesn't leak into edge-fade fills
  ctx.save();
  ctx.translate(anchorDstX, anchorDstY);
  if (f.rotation) ctx.rotate(f.rotation * Math.PI / 180);
  ctx.drawImage(
    img,
    -anchorSrcX * finalScale,
    -anchorSrcY * finalScale,
    img.width  * finalScale,
    img.height * finalScale
  );
  ctx.restore();

  // Edge fades on top — drawn in destination coords, still inside outer clip
  drawEdgeFades(ctx, x, y, w, h, bg || BRAND.bone, f.edgeFade);

  ctx.restore();
};

// ─── Wordmark drawer ────────────────────────────────────────────────
const WORDMARK_PATHS = [
  'M143.885,152.495v-25.393c0-7.649,0-12.258-9.392-12.258-11.911,0-11.563,10.173-11.563,18.953v18.697h-5.043v-25.393c0-7.649,0-12.258-9.389-12.258-11.913,0-11.566,10.346-11.566,19.13v18.521h-5.042v-41.738h4.869v4.869c2.174-3.215,6.085-5.563,12.52-5.563,6.26,0,10.521,2.173,12.347,6.693,2.956-4.52,7.304-6.693,13.563-6.693s10.783,2.173,12.606,6.608c1.304,3.216,1.132,6.434,1.132,10.606v25.218h-5.043Z',
  'M178.744,114.67c-9.739,0-12.694,4.26-12.694,13.565h25.563c0-10.087-2.783-13.565-12.869-13.565M165.961,132.842c0,10.522,1.392,15.651,13.129,15.651,5.654,0,12.086-.87,12.086-7.826h4.694c0,10.085-8.083,12.521-16.866,12.521-15.997,0-18.084-7.913-18.084-21.388,0-13.739,2.346-21.739,17.824-21.739,16.955,0,17.737,8.868,17.737,22.78h-30.52Z',
  'M224.56,114.844c-10.347,0-11.653,5.999-11.653,16.868s1.306,16.608,11.653,16.608c10.695,0,14.259-3.392,14.259-16.608s-3.563-16.868-14.259-16.868M238.907,152.495v-5.046c-2.695,3.741-7.391,5.739-13.913,5.739-15.736,0-17.128-9.041-17.128-21.649,0-11.477.87-21.476,17.128-21.476,6.608,0,10.957,1.825,13.739,5.39v-23.562h5.04v60.605h-4.866Z',
  'M271.854,131.973c-7.043,0-11.128,1.043-11.128,8.523,0,5.736,2.692,8.17,10.782,8.17,13.648,0,14.693-5.563,14.693-16.693h-14.347ZM286.547,152.495v-4.697c-2.432,3.653-7.824,5.391-14.779,5.391-10.87,0-16.172-3.65-16.172-12.606,0-11.477,7.39-13.129,16.606-13.129h13.999v-1.392c0-2.958.346-6.522-2-8.781-1.651-1.652-4.259-2.434-10.174-2.434s-12.606.259-12.606,7.737h-4.695c0-9.825,7.13-12.52,17.999-12.52,7.998,0,14.956,1.999,16.258,10.173.437,2.26.348,5.303.348,8.259v24h-4.783Z',
  'M330.366,122.235c0-5.737-2.434-7.391-9.041-7.391-12.262,0-11.564,11.131-11.564,19.564v18.086h-5.043v-41.736h4.867v4.869c2.959-4.001,7.219-5.565,12.695-5.565,8.348,0,12.781,3.826,12.781,12.172h-4.695Z',
  'M359.489,153.189c-9.129,0-13.564-3.739-13.564-12.434v-25.475h-7.043v-4.524h7.043v-18.867h5.043v18.867h19.041v4.524h-19.041v25.475c0,6,2.609,7.913,8.697,7.913,6.608,0,9.127-2.348,9.127-8.001h4.697c0,9.131-5.393,12.521-14,12.521',
  'M383.309,110.757h5.045v41.738h-5.045v-41.738ZM385.83,98.588c-2.174,0-3.303-1.306-3.303-3.393,0-2.173,1.129-3.306,3.303-3.306s3.393,1.132,3.393,3.306c0,2.086-1.219,3.393-3.393,3.393',
  'M417.303,153.189c-11.301,0-16.693-3.218-16.693-12.521h4.695c0,5.739,2.867,7.653,11.912,7.653,9.389,0,12.607-2.09,12.607-7.131,0-7.304-2.176-7.041-11.742-7.391-8.865-.262-16.779.261-16.779-11.477,0-9.477,6.09-12.259,17.564-12.259,10.088,0,15.998,2.87,15.998,12.52h-4.695c0-5.564-2.693-7.827-11.217-7.827-9.477,0-12.605,1.916-12.605,6.869,0,7.565,2.957,6.869,11.041,7.217,8.955.435,17.477-.609,17.477,11.739,0,9.477-5.998,12.607-17.562,12.607',
];

// The OFFICIAL logo ships with the app at /brand/wordmark.svg (dark) and
// /brand/wordmark-white.svg (light). Its 526.755 × 245.078 viewBox frames the
// "medartis" glyphs inside a uniform clear-space border. WM_GLYPH is the glyph
// bounding box within that viewBox — we align it to the layout so sizing stays
// consistent while the asset's clear space is respected automatically.
const WM_VIEW  = { w: 526.755, h: 245.078 };
const WM_GLYPH = { x: 91.89, y: 91.89, w: 342.98, h: 61.30 };

// The medartis wordmark as a MARK, so the Group row can lay it out beside the
// sub-brands. medartis is one of the three brands UNDER the Group — it is not the
// Group. Those are two different pieces of artwork, and the family row was drawing
// the Group mark in the medartis slot: a lockup that names the house three times
// and the main brand not at all. It rendered perfectly.
const markAsFull  = (m) => ({ ...m, ...markGeometry(m, true) });
const markAsBrand = (m) => ({ ...m, ...markGeometry(m, false) });

const MEDARTIS_WORDMARK_MARK = {
  view: WM_VIEW,
  glyph: WM_GLYPH,
  // "medartis" has no descenders, so its baseline IS the glyph bottom, and the
  // tallest thing standing on it is the "d" — which makes cap === the very height
  // the 1.5x-d clear-space rule is written against. The row measurement and the
  // brand guide arrive at the same number independently.
  baseline: WM_GLYPH.y + WM_GLYPH.h,   // 153.19
  cap: WM_GLYPH.h,                     // 61.30 — the "d"
  fullGlyph: WM_GLYPH,
  paths: WORDMARK_PATHS.map((d) => ({ fill: null, d })),   // null = takes the ink colour
};

// ─── CLEAR SPACE — 1.5 × THE HEIGHT OF THE "d" ───────────────────────────
// The brand rule, and it is not negotiable: nothing — no type, no image edge,
// no canvas edge — may come closer to the mark than 1.5 × the height of the
// letter "d" on ANY side.
//
// Measured from the shipped artwork rather than assumed: in "medartis" the
// ascenders (d, t) ARE the tallest glyphs, so the d is exactly the glyph-box
// height, 61.30. And the SVG's own transparent border is 91.89 on every side —
// 91.89 / 61.30 = 1.4999. The asset already encodes the rule; the code was only
// enforcing a third of it (wm.h * 0.5), which is why the mark sat too close to
// the edge.
//
// So: clear space = 1.5 × the glyph height, and drawing the full WM_VIEW box is
// exactly equivalent to drawing the glyphs plus their clear space.
const WM_CLEAR_RATIO = 1.5;                       // × the height of the "d"
const wmClear = (glyphHeight) => glyphHeight * WM_CLEAR_RATIO;
/** The keep-clear rectangle around a placed mark: the box plus its clear space. */
const wmClearBox = (box) => {
  const c = wmClear(box.h);
  return { x: box.x - c, y: box.y - c, w: box.w + c * 2, h: box.h + c * 2 };
};
const WORDMARK_ASSETS = { dark: null, light: null };
const isLightColor = (hex) => {
  if (!hex || hex[0] !== '#' || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 140;
};

const drawWordmark = (ctx, x, y, height, color) => {
  // (x, y) = top-left of the VISIBLE glyphs; `height` = their height.
  const scale = height / WM_GLYPH.h;
  const img = isLightColor(color) ? WORDMARK_ASSETS.light : WORDMARK_ASSETS.dark;
  if (img && img.complete && img.naturalWidth) {
    // Draw the shipped asset, aligned so the glyphs land exactly where the
    // layout placed them. The clear-space border is transparent, so any part
    // that spills past the canvas edge is invisible — never a visible crop.
    ctx.drawImage(img, x - WM_GLYPH.x * scale, y - WM_GLYPH.y * scale, WM_VIEW.w * scale, WM_VIEW.h * scale);
    return;
  }
  // Fallback until the asset image has loaded: the identical vector paths.
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-WM_GLYPH.x, -WM_GLYPH.y);
  ctx.fillStyle = color;
  for (const d of WORDMARK_PATHS) ctx.fill(new Path2D(d));
  ctx.restore();
};

// Compute layout geometry for a split-image layout. Returned object describes
// where the image sits and where the text block goes — used by both the
// canvas drawer and the PDF vector renderer so they stay perfectly in sync.
function computeSplitGeom(frame, opts, textPos) {
  const { w, h, padX, padY } = frame;
  const { fit } = opts;
  const isWide = w / h > 1.4;
  const defaultRatio = isWide ? 0.5 : 0.55;
  const imageRatio = clamp(fit?.frameRatio ?? defaultRatio, 0.15, 0.9);
  if (isWide) {
    const imgW = w * imageRatio;
    return {
      isWide: true, imageRatio,
      imageRect: { x: w - imgW, y: 0, w: imgW, h },
      textRect:  { x: padX,     y: padY, w: w - imgW - padX * 2, h: h - padY * 2 },
      textAreaY: padY,
      safeArea:  { x: 0, y: 0, w: w - imgW, h },
    };
  }
  const imageH = h * imageRatio;
  const textHeight = h - imageH;
  if (textPos === 'top') {
    return {
      isWide: false, imageRatio,
      imageRect: { x: 0, y: textHeight, w, h: imageH },
      textRect:  { x: padX, y: padY, w: w - padX * 2, h: textHeight - padY },
      textAreaY: padY,
      safeArea:  { x: 0, y: 0, w, h: textHeight },
    };
  }
  return {
    isWide: false, imageRatio,
    imageRect: { x: 0, y: 0, w, h: imageH },
    textRect:  { x: padX, y: imageH + padY * 0.6, w: w - padX * 2, h: textHeight - padY * 0.6 },
    textAreaY: imageH + padY * 0.6,
    safeArea:  { x: 0, y: imageH, w, h: h - imageH },
  };
}

// ═══ THE LAYOUT AS AN INPUT DEVICE ═══════════════════════════════════
// Normally the pipeline runs one way: generate a photo, then crop it and hope the
// headline lands somewhere survivable. This inverts it. The layout — where the
// type sits, where the mark sits, how the frame is inset and tilted — is turned
// into a CONTROL MAP, and the model is asked to compose AROUND it.
//
// The map is derived, not guessed: we render the live layout with NO photograph,
// so what remains on the canvas is exactly the type and the mark. Those pixels
// become KEEP-CLEAR cells. The largest rectangle free of them is the SUBJECT
// REGION — the only place the picture is allowed to carry its content.
//
// One rule this must never break: the map contains NO LETTERFORMS. Feeding the
// actual glyph edges to a scribble/canny ControlNet would ask the model to draw
// text-shaped objects — the exact opposite of leaving room for type. So we work
// from coarse occupancy cells and emit boxes, gradients and guides only.

// imgToDataUrl moved to uiKit.jsx (shared with GenerateSection.jsx)

const CTRL_COLS = 48;   // occupancy grid on the long edge

/** Coarse occupancy of ink (type + mark) over a photograph-free layout render. */
function layoutOccupancy(src, bgHex) {
  const ratio = src.width / src.height;
  const cols = ratio >= 1 ? CTRL_COLS : Math.max(12, Math.round(CTRL_COLS * ratio));
  const rows = ratio >= 1 ? Math.max(12, Math.round(CTRL_COLS / ratio)) : CTRL_COLS;
  const small = document.createElement('canvas');
  small.width = cols; small.height = rows;
  const sc = small.getContext('2d', { willReadFrequently: true });
  sc.drawImage(src, 0, 0, cols, rows);
  const d = sc.getImageData(0, 0, cols, rows).data;
  const bg = [1, 3, 5].map((i) => parseInt(bgHex.slice(i, i + 2), 16));
  const grid = [];
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const diff = Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]);
      row.push(diff > 34 ? 1 : 0);   // 1 = occupied by type/mark → keep clear
    }
    grid.push(row);
  }
  return { grid, cols, rows };
}

/** Maximal all-zero rectangle (classic histogram sweep) — the subject region. */
function largestFreeRect({ grid, cols, rows }) {
  const heights = new Array(cols).fill(0);
  let best = { x: 0, y: 0, w: cols, h: rows, area: 0 };
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) heights[x] = grid[y][x] ? 0 : heights[x] + 1;
    const stack = [];
    for (let x = 0; x <= cols; x++) {
      const h = x === cols ? 0 : heights[x];
      let start = x;
      while (stack.length && stack[stack.length - 1].h >= h) {
        const top = stack.pop();
        const area = top.h * (x - top.x);
        if (area > best.area) best = { x: top.x, y: y - top.h + 1, w: x - top.x, h: top.h, area };
        start = top.x;
      }
      stack.push({ x: start, h });
    }
  }
  return best;
}

/**
 * Build a DEPTH control map from the live layout.
 *
 * Depth, and only depth — this is a correction to my own first attempt, which
 * also emitted canny/scribble maps and made the output measurably WORSE.
 *
 * A canny net reproduces the edge structure it is handed. A bare layout has
 * almost no edges in it, so the net reads "no structure anywhere" and returns a
 * flat, empty, distant scene; and the subject rectangle I drew into the map came
 * back as a literal rectangle in the picture. Edges must come from something that
 * HAS edges — a photograph, or a hand sketch.
 *
 * What a layout genuinely knows is spatial: "type is going HERE, so this region
 * must stay empty and far; the picture belongs THERE." That is a depth statement.
 *
 * @param src   a photograph-free render of the current layout (type + mark only)
 * @param bgHex the palette background it was rendered on
 * Returns a PNG data URL sized for the model, or null when there is no room.
 */
function buildLayoutControlMapFrom(src, bgHex) {
  const occ = layoutOccupancy(src, bgHex);
  const rect = largestFreeRect(occ);
  if (rect.area < occ.cols * occ.rows * 0.06) return null;  // no room to compose in

  const long = 1024;
  const ar = src.width / src.height;
  const W = Math.round(ar >= 1 ? long : long * ar);
  const H = Math.round(ar >= 1 ? long / ar : long);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  const cw = W / occ.cols, ch = H / occ.rows;
  const R = { x: rect.x * cw, y: rect.y * ch, w: rect.w * cw, h: rect.h * ch };
  const horizon = R.y + R.h * 0.60;

  // WHITE = NEAR, BLACK = FAR.
  //
  // The base is mid-dark, not black: black means "infinitely far", and a subject
  // floating in a void is exactly the empty, lifeless frame we are trying not to
  // produce. Mid-dark says "a real room continues here, at a distance".
  ctx.fillStyle = '#2E2E2E';
  ctx.fillRect(0, 0, W, H);

  // The subject region carries the near field. Elliptical rather than a hard box:
  // a rectangle in a depth map is a rectangular object.
  const g = ctx.createRadialGradient(
    R.x + R.w / 2, horizon, Math.min(R.w, R.h) * 0.04,
    R.x + R.w / 2, horizon, Math.max(R.w, R.h) * 0.62
  );
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(0.45, '#C4C4C4');
  g.addColorStop(0.80, '#6E6E6E');
  g.addColorStop(1, '#2E2E2E');
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(R.x + R.w / 2, horizon, R.w * 0.60, R.h * 0.62, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = g;
  ctx.fillRect(R.x - R.w, R.y - R.h, R.w * 3, R.h * 3);
  ctx.restore();

  // Where the type and the mark actually sit: push it AWAY. Not to pure black —
  // just clearly behind the subject, so the model puts recessive background under
  // the headline instead of a face.
  ctx.fillStyle = '#141414';
  for (let y = 0; y < occ.rows; y++) {
    for (let x = 0; x < occ.cols; x++) {
      if (occ.grid[y][x]) ctx.fillRect(x * cw - 1, y * ch - 1, cw + 2, ch + 2);
    }
  }

  // Soften hard — a blocky depth map produces blocky geometry, and the occupancy
  // grid is coarse by design (it must never leak letterforms into the map).
  const blur = document.createElement('canvas');
  blur.width = W; blur.height = H;
  const bc = blur.getContext('2d');
  bc.filter = `blur(${Math.round(long * 0.018)}px)`;
  bc.drawImage(c, 0, 0);
  return blur.toDataURL('image/png');
}

// ─── BROCHURE PANEL (§ 03) ───────────────────────────────────────────
// The page list IS the document outline. Reorder here, and the folios, the
// running heads and the PDF all follow — there is no second source of truth.
function BrochurePanel({
  pages, idx, title, onTitle, onGoTo, onAdd, onDelete, onMove, onType, onField, hasImg,
  partners = [], onAddPartner, onRemovePartner, secNo = {},
}) {
  const page = pages[idx];
  if (!page) return null;
  const def = BROCHURE_TYPES[page.type] || {};
  const fld = {
    width: '100%', padding: '9px 10px', border: `1px solid ${BRAND.ink100}`,
    background: BRAND.paper, color: BRAND.ink, fontSize: 12,
    fontFamily: BRAND.display, borderRadius: 0, boxSizing: 'border-box',
  };
  const lab = {
    display: 'block', fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: BRAND.ink600, marginBottom: 4,
  };
  const mini = (active) => ({
    padding: '4px 7px', fontFamily: BRAND.mono, fontSize: 9.5, cursor: 'pointer',
    background: active ? BRAND.ink : 'transparent',
    color: active ? BRAND.bone00 : BRAND.ink600,
    border: `1px solid ${active ? BRAND.ink : BRAND.ink100}`, borderRadius: 0,
    letterSpacing: '0.06em',
  });

  return (
    <div>
      <label style={lab}>Running head (appears on every inner page)</label>
      <input style={{ ...fld, marginBottom: 12 }} value={title} onChange={(e) => onTitle(e.target.value)} />

      {/* OUTLINE ─ the document, in order */}
      <div style={lab}>Pages · {pages.length}</div>
      <div style={{
        border: `1px solid ${BRAND.ink100}`, background: BRAND.paper,
        maxHeight: 190, overflowY: 'auto', marginBottom: 8,
      }}>
        {pages.map((p, i) => (
          <div key={p.id} onClick={() => onGoTo(i)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', cursor: 'pointer',
              background: i === idx ? BRAND.bone : 'transparent',
              borderLeft: `3px solid ${i === idx ? BRAND.goldDeep : 'transparent'}`,
              borderBottom: `1px solid ${BRAND.ink100}`,
            }}>
            <span style={{ fontFamily: BRAND.mono, fontSize: 10, color: BRAND.ink300, minWidth: 18 }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span style={{ flex: 1, fontSize: 11.5, color: BRAND.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {BROCHURE_TYPES[p.type]?.label || p.type}
              <span style={{ color: BRAND.ink300 }}>{p.f?.headline ? ` · ${p.f.headline}` : ''}</span>
            </span>
            {hasImg(i) && <span title="has an image" style={{ fontSize: 9, color: BRAND.goldDeep }}>◗</span>}
            <button title="Move up"   onClick={(e) => { e.stopPropagation(); onMove(i, -1); }} style={mini(false)}>↑</button>
            <button title="Move down" onClick={(e) => { e.stopPropagation(); onMove(i, 1); }}  style={mini(false)}>↓</button>
            <button title="Delete page" onClick={(e) => { e.stopPropagation(); onDelete(i); }} style={mini(false)}>×</button>
          </div>
        ))}
      </div>

      <div style={lab}>Add a page</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
        {BROCHURE_TYPE_KEYS.map((k) => (
          <button key={k} onClick={() => onAdd(k)} title={BROCHURE_TYPES[k].hint} style={mini(false)}>
            + {BROCHURE_TYPES[k].label}
          </button>
        ))}
      </div>

      {/* THIS PAGE */}
      <div style={{ borderTop: `1px solid ${BRAND.ink100}`, paddingTop: 12 }}>
        <label style={lab}>Page {idx + 1} · type</label>
        <select style={{ ...fld, marginBottom: 6 }} value={page.type} onChange={(e) => onType(idx, e.target.value)}>
          {BROCHURE_TYPE_KEYS.map((k) => <option key={k} value={k}>{BROCHURE_TYPES[k].label}</option>)}
        </select>
        <div style={{ fontFamily: BRAND.mono, fontSize: 9.5, color: BRAND.ink300, marginBottom: 12, letterSpacing: '0.04em' }}>
          {def.hint}{def.image ? ` · § ${secNo.IMAGE} sets this page’s image` : ' · no image on this type'}
        </div>

        {(def.fields || []).map((fd) => (
          <div key={fd.key} style={{ marginBottom: 10 }}>
            <label style={lab}>{fd.label}</label>
            {fd.multiline
              ? <textarea style={{ ...fld, resize: 'vertical', lineHeight: 1.5 }} rows={fd.key === 'body' ? 6 : 3}
                          value={page.f[fd.key] ?? ''} placeholder={fd.default}
                          onChange={(e) => onField(idx, fd.key, e.target.value)} />
              : <input style={fld} value={page.f[fd.key] ?? ''} placeholder={fd.default}
                       onChange={(e) => onField(idx, fd.key, e.target.value)} />}
          </div>
        ))}

        {page.type === 'partners' && (
          <div style={{ borderTop: `1px solid ${BRAND.ink100}`, paddingTop: 10, marginTop: 4 }}>
            <label style={lab}>Partner logos · {partners.length}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {partners.map((l) => (
                <div key={l.id} title={l.name} style={{
                  position: 'relative', width: 74, height: 44, border: `1px solid ${BRAND.ink100}`,
                  background: BRAND.paper, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <img src={l.src} alt={l.name} style={{ maxWidth: '82%', maxHeight: '70%', objectFit: 'contain' }} />
                  <button onClick={() => onRemovePartner(l.id)} title="Remove" style={{
                    position: 'absolute', top: -1, right: -1, width: 15, height: 15, lineHeight: '13px',
                    padding: 0, fontSize: 10, cursor: 'pointer', background: BRAND.ink,
                    color: BRAND.bone00, border: 'none', borderRadius: 0,
                  }}>×</button>
                </div>
              ))}
            </div>
            <label style={{
              display: 'block', padding: '9px', background: BRAND.paper, textAlign: 'center',
              border: `1px dashed ${BRAND.ink300}`, cursor: 'pointer',
              fontFamily: BRAND.mono, fontSize: 9.5, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: BRAND.ink600,
            }}>
              + ADD PARTNER LOGO · PNG / SVG
              <input type="file" accept="image/*" style={{ display: 'none' }}
                     onChange={(e) => { const f = e.target.files?.[0]; if (f) onAddPartner(f); e.target.value = ''; }} />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ BROCHURE ENGINE ═════════════════════════════════════════════════
// Page TYPES carry the layout, so a 40-page document stays on-grid without
// anyone re-inventing a spread. Pure canvas draws, so the live preview and the
// print PDF are the same code path. See src/brochure.js for the type model.
const BR = {
  margin: 0.085,   // page margin, × page width
  gutter: 0.042,   // column gutter, × page width
};

// Word-wrapped paragraph flow. Returns the y AFTER the block, plus any lines that
// did not fit — which is what lets a letter run from column one into column two.
function brFlow(ctx, text, x, y, w, size, o = {}) {
  const {
    color = BRAND.ink800, weight = 400, family = BRAND.display,
    italic = false, lh = 1.5, paraGap = 0.55, maxY = Infinity, align = 'left',
  } = o;
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`;
  ctx.fillStyle = color;
  let cy = y;
  const paras = (text || '').split('\n');
  const rest = [];
  let stopped = false;
  for (let pi = 0; pi < paras.length; pi++) {
    const p = paras[pi].trim();
    if (!p) { cy += size * paraGap; continue; }
    const lines = wrapText(ctx, p, w);
    for (const line of lines) {
      if (cy + size > maxY) stopped = true;
      if (stopped) { rest.push(line); continue; }
      const lx = align === 'center' ? x + (w - ctx.measureText(line).width) / 2 : x;
      ctx.fillText(line, lx, cy + size);
      cy += size * lh;
    }
    if (!stopped && pi < paras.length - 1) cy += size * paraGap;
  }
  return { y: cy, rest: rest.join(' ') };
}

// Tracked, uppercase label (mono voice) — section marks, kickers, folios.
function brLabel(ctx, text, x, y, size, color, o = {}) {
  const { family = BRAND.mono, weight = 500, tracking = 0.14, align = 'left', maxX = null } = o;
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = color;
  const t = (text || '').toUpperCase();
  const ls = size * tracking;
  const total = [...t].reduce((s, ch) => s + ctx.measureText(ch).width + ls, -ls);
  let cx = align === 'right' ? (maxX ?? x) - total : x;
  for (const ch of t) { ctx.fillText(ch, cx, y + size); cx += ctx.measureText(ch).width + ls; }
  return y + size;
}

// The gold INITIATOR rule: kicker → rule → headline. Never decoration afterwards.
function brRule(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

// Running head + folio. Alternates like a real spread (recto/verso).
function brFurniture(ctx, frame, page, opts, dark) {
  const { w, h } = frame;
  const m = w * BR.margin;
  const n = opts.pageNumber ?? 1;
  const recto = n % 2 === 1;
  const muted = dark ? 'rgba(250,248,240,0.55)' : BRAND.ink600;
  const size = w * 0.0095;
  const section = (page.f?.eyebrow || opts.brochureTitle || 'MEDARTIS').toString();
  brLabel(ctx, section, m, h * 0.045, size, muted, { tracking: 0.16 });
  ctx.fillStyle = dark ? 'rgba(250,248,240,0.18)' : BRAND.ink100;
  ctx.fillRect(m, h * 0.045 + size * 2.1, w - m * 2, Math.max(1, w * 0.0008));
  brLabel(ctx, String(n), recto ? w - m : m, h - h * 0.055, size * 1.05, muted,
    { align: recto ? 'right' : 'left', maxX: w - m, family: BRAND.display, weight: 600, tracking: 0.06 });
  brLabel(ctx, 'medartis.com', recto ? m : w - m, h - h * 0.055, size, muted,
    { align: recto ? 'left' : 'right', maxX: w - m });
}

function brPartnerWall(ctx, frame, partners, x, y, w, maxH) {
  const logos = (partners?.logos || []).filter((l) => l && l.img);
  if (!logos.length) return y;
  const cols = Math.min(3, logos.length);
  const cellW = w / cols;
  const cellH = Math.min(maxH / Math.ceil(logos.length / cols), frame.h * 0.11);
  logos.forEach((l, i) => {
    const cx = x + (i % cols) * cellW;
    const cy = y + Math.floor(i / cols) * cellH;
    const ar = (l.img.naturalWidth || l.img.width) / (l.img.naturalHeight || l.img.height || 1);
    let dh = cellH * 0.6, dw = dh * ar;
    if (dw > cellW * 0.78) { dw = cellW * 0.78; dh = dw / ar; }
    ctx.drawImage(l.img, cx + (cellW - dw) / 2, cy + (cellH - dh) / 2, dw, dh);
  });
  return y + Math.ceil(logos.length / cols) * cellH;
}

function drawBrochurePage(ctx, frame, image, opts) {
  const page = opts.brochurePage;
  if (!page) return;
  const { w, h } = frame;
  const bleed = frame.bleedPx || 0;
  const f = page.f || {};
  const type = page.type;
  const fit = opts.fit;
  const m = w * BR.margin;
  const gut = w * BR.gutter;
  const colW = (w - m * 2 - gut) / 2;

  // Dark pages carry the moments; light pages carry the reading.
  const DARK = ['cover', 'quote', 'stats', 'backCover'].includes(type);
  const pal = DARK
    ? { bg: BRAND.coal,  ink: BRAND.bone00, muted: BRAND.cream100, mode: 'dark' }
    : { bg: BRAND.paper, ink: BRAND.ink,    muted: BRAND.ink600,   mode: 'light' };
  // The brand gold is only ~2:1 on paper — it FAILS WCAG as a light-surface
  // accent (see BRAND CHECK). Use the accessible deep gold on light pages.
  const accent = DARK ? BRAND.gold : BRAND.goldDeep;

  paintSurface(ctx, frame, pal, opts.surface);

  const body = w * 0.0125;
  const h1 = w * 0.052;
  const h2 = w * 0.030;
  const RULE_H = Math.max(3, w * 0.004);
  const RULE_W = w * 0.075;

  // kicker → rule → (caller draws the headline). The house sequence, in one place.
  const initiator = (y, kicker, kickSize = w * 0.010) => {
    if (!kicker) return y;
    brLabel(ctx, kicker, m, y, kickSize, accent, { tracking: 0.18 });
    y += w * 0.030;
    brRule(ctx, m, y, RULE_W, RULE_H, accent);
    return y + w * 0.036;
  };

  if (type === 'cover') {
    const imgH = h * 0.56;
    if (image) drawImageFit(ctx, image, -bleed, -bleed, w + bleed * 2, imgH + bleed, fit, pal.bg);
    else { ctx.fillStyle = BRAND.coal800; ctx.fillRect(-bleed, -bleed, w + bleed * 2, imgH + bleed); }
    // Scrim so the wordmark always reads, whatever the photo does.
    const g = ctx.createLinearGradient(0, 0, 0, imgH);
    g.addColorStop(0, 'rgba(19,19,16,0.60)');
    g.addColorStop(1, 'rgba(19,19,16,0.15)');
    ctx.fillStyle = g;
    ctx.fillRect(-bleed, -bleed, w + bleed * 2, imgH + bleed);
    drawWordmark(ctx, m, h * 0.055, w * 0.055, BRAND.bone00);

    let y = imgH + h * 0.055;
    y = initiator(y, f.eyebrow, w * 0.011);
    ctx.font = `700 ${h1 * 1.35}px ${BRAND.display}`;
    ctx.fillStyle = pal.ink;
    for (const line of wrapText(ctx, f.headline || '', w - m * 2)) {
      ctx.fillText(line, m, y + h1 * 1.35);
      y += h1 * 1.48;
    }
    y += h * 0.012;
    if (f.subline) y = brFlow(ctx, f.subline, m, y, w - m * 2.6, h2 * 0.72, { color: pal.muted, weight: 300, lh: 1.35 }).y;
    if (f.cta) brLabel(ctx, f.cta, m, h - h * 0.075, w * 0.0105, pal.muted, { tracking: 0.12 });
    return;
  }

  if (type === 'backCover') {
    drawWordmark(ctx, m, h * 0.14, w * 0.075, BRAND.bone00);
    let y = h * 0.42;
    ctx.font = `italic 300 ${h2 * 1.15}px ${BRAND.display}`;
    ctx.fillStyle = BRAND.bone00;
    for (const line of wrapText(ctx, f.headline || '', w - m * 2)) { ctx.fillText(line, m, y); y += h2 * 1.55; }
    brRule(ctx, m, y + h * 0.02, RULE_W, RULE_H, accent);
    y += h * 0.075;
    brFlow(ctx, f.body || '', m, y, w * 0.5, body * 1.05, { color: pal.muted, lh: 1.7 });
    if (f.cta) brLabel(ctx, f.cta, m, h - h * 0.085, w * 0.013, BRAND.bone00, { tracking: 0.14 });
    return;
  }

  if (type === 'quote') {
    brRule(ctx, m, h * 0.30, RULE_W, RULE_H, accent);
    let y = h * 0.36;
    ctx.font = `italic 300 ${h1 * 0.92}px ${BRAND.display}`;
    ctx.fillStyle = BRAND.bone00;
    for (const line of wrapText(ctx, `“${(f.headline || '').trim()}”`, w - m * 2)) {
      ctx.fillText(line, m, y + h1 * 0.92);
      y += h1 * 1.25;
    }
    if (f.subline) brLabel(ctx, f.subline, m, y + h * 0.035, w * 0.011, BRAND.cream300, { tracking: 0.14 });
    brFurniture(ctx, frame, page, opts, true);
    return;
  }

  if (type === 'stats') {
    let y = initiator(h * 0.13, f.eyebrow, w * 0.011);
    ctx.font = `700 ${h2 * 1.3}px ${BRAND.display}`;
    ctx.fillStyle = BRAND.bone00;
    for (const line of wrapText(ctx, f.headline || '', w - m * 2)) { ctx.fillText(line, m, y + h2 * 1.3); y += h2 * 1.6; }
    y += h * 0.03;
    const rows = (f.body || '').split('\n').map((l) => l.split('|').map((p) => p.trim())).filter((r) => r[0]);
    const rowH = Math.min((h * 0.78 - y) / Math.max(1, rows.length), h * 0.14);
    for (const [value, label] of rows) {
      ctx.font = `700 ${rowH * 0.52}px ${BRAND.display}`;
      ctx.fillStyle = accent;
      ctx.fillText(value, m, y + rowH * 0.52);
      ctx.font = `300 ${rowH * 0.22}px ${BRAND.display}`;
      ctx.fillStyle = BRAND.cream100;
      ctx.fillText(label || '', m + w * 0.30, y + rowH * 0.45);
      ctx.fillStyle = 'rgba(250,248,240,0.16)';
      ctx.fillRect(m, y + rowH * 0.78, w - m * 2, Math.max(1, w * 0.0006));
      y += rowH;
    }
    brFurniture(ctx, frame, page, opts, true);
    return;
  }

  if (type === 'toc') {
    let y = h * 0.13;
    ctx.font = `700 ${h1 * 0.72}px ${BRAND.display}`;
    ctx.fillStyle = pal.ink;
    ctx.fillText(f.headline || 'Contents', m, y + h1 * 0.72);
    y += h1 * 1.0;
    brRule(ctx, m, y, RULE_W, RULE_H, accent);
    y += h * 0.045;
    const entries = (f.body || '').split('\n').map((l) => l.split('|').map((p) => p.trim())).filter((r) => r[0]);
    for (const [title, pageNo] of entries) {
      ctx.font = `500 ${body * 1.25}px ${BRAND.display}`;
      ctx.fillStyle = pal.ink;
      const tw = ctx.measureText(title).width;
      ctx.fillText(title, m, y + body * 1.25);
      const pgTxt = pageNo || '';
      ctx.font = `600 ${body * 1.2}px ${BRAND.mono}`;
      const pw = ctx.measureText(pgTxt).width;
      ctx.fillStyle = BRAND.ink100;                       // dotted leader
      for (let dx = m + tw + body; dx < w - m - pw - body * 0.6; dx += body * 0.7) {
        ctx.fillRect(dx, y + body * 0.9, Math.max(1, w * 0.0009), Math.max(1, w * 0.0009));
      }
      ctx.fillStyle = accent;
      ctx.fillText(pgTxt, w - m - pw, y + body * 1.25);
      y += body * 2.3;
    }
    brFurniture(ctx, frame, page, opts, false);
    return;
  }

  if (type === 'editorial') {
    let y = initiator(h * 0.13, f.eyebrow);
    ctx.font = `700 ${h1 * 0.75}px ${BRAND.display}`;
    ctx.fillStyle = pal.ink;
    ctx.fillText(f.headline || '', m, y + h1 * 0.75);
    y += h1 * 1.15;
    if (f.salutation) {
      ctx.font = `italic 300 ${h2 * 0.62}px ${BRAND.display}`;
      ctx.fillStyle = pal.ink;
      ctx.fillText(f.salutation, m, y + h2 * 0.62);
      y += h2 * 1.15;
    }
    const maxY = h * 0.82;
    const left = brFlow(ctx, f.body || '', m, y, colW, body, { color: BRAND.ink800, lh: 1.62, maxY });
    if (left.rest) brFlow(ctx, left.rest, m + colW + gut, y, colW, body, { color: BRAND.ink800, lh: 1.62, maxY });
    if (f.signature) {
      ctx.font = `italic 300 ${body * 1.15}px ${BRAND.display}`;
      ctx.fillStyle = pal.ink;
      ctx.fillText(f.signature, m, h * 0.875);
    }
    brFurniture(ctx, frame, page, opts, false);
    return;
  }

  if (type === 'feature') {
    const imgH = image ? h * 0.30 : 0;
    if (image) {
      drawImageFit(ctx, image, -bleed, h * 0.10, w + bleed * 2, imgH, fit, pal.bg);
      if (f.caption) brLabel(ctx, f.caption, m, h * 0.10 + imgH + w * 0.010, w * 0.0088, BRAND.ink600, { tracking: 0.08 });
    }
    let y = initiator(image ? h * 0.10 + imgH + h * 0.045 : h * 0.13, f.eyebrow);
    ctx.font = `700 ${h1 * 0.66}px ${BRAND.display}`;
    ctx.fillStyle = pal.ink;
    for (const line of wrapText(ctx, f.headline || '', w - m * 2)) { ctx.fillText(line, m, y + h1 * 0.66); y += h1 * 0.82; }
    y += h * 0.012;
    if (f.subline) y = brFlow(ctx, f.subline, m, y, w - m * 2, body * 1.5, { color: BRAND.ink600, weight: 300, lh: 1.38 }).y + h * 0.022;
    const maxY = h * 0.90;
    const left = brFlow(ctx, f.body || '', m, y, colW, body, { color: BRAND.ink800, lh: 1.6, maxY });
    if (left.rest) brFlow(ctx, left.rest, m + colW + gut, y, colW, body, { color: BRAND.ink800, lh: 1.6, maxY });
    brFurniture(ctx, frame, page, opts, false);
    return;
  }

  if (type === 'interview') {
    let y = initiator(h * 0.13, f.eyebrow);
    ctx.font = `700 ${h1 * 0.62}px ${BRAND.display}`;
    ctx.fillStyle = pal.ink;
    for (const line of wrapText(ctx, f.headline || '', image ? w * 0.52 : w - m * 2)) {
      ctx.fillText(line, m, y + h1 * 0.62);
      y += h1 * 0.80;
    }
    if (image) drawImageFit(ctx, image, w - m - w * 0.30, h * 0.13, w * 0.30, h * 0.26, fit, pal.bg);
    if (f.subline) { y += h * 0.008; brLabel(ctx, f.subline, m, y, w * 0.0095, BRAND.ink600, { tracking: 0.10 }); y += h * 0.030; }
    y = Math.max(y, image ? h * 0.42 : y) + h * 0.01;
    const maxY = h * 0.90;
    for (const raw of (f.body || '').split('\n')) {
      const line = raw.trim();
      if (!line || y > maxY) continue;
      const isQ = /^q\s*[:.]/i.test(line);
      const text = line.replace(/^[qa]\s*[:.]\s*/i, '');
      const r = brFlow(ctx, text, m, y, w - m * 2, body * (isQ ? 1.12 : 1),
        { color: isQ ? accent : BRAND.ink800, weight: isQ ? 600 : 400, lh: 1.55, maxY });
      y = r.y + body * (isQ ? 0.45 : 0.9);
    }
    brFurniture(ctx, frame, page, opts, false);
    return;
  }

  if (type === 'technique') {
    let y = initiator(h * 0.13, f.eyebrow);
    ctx.font = `700 ${h1 * 0.60}px ${BRAND.display}`;
    ctx.fillStyle = pal.ink;
    for (const line of wrapText(ctx, f.headline || '', w - m * 2)) { ctx.fillText(line, m, y + h1 * 0.60); y += h1 * 0.76; }
    if (f.subline) { y += h * 0.006; brLabel(ctx, f.subline, m, y, w * 0.0095, BRAND.ink600, { tracking: 0.08 }); y += h * 0.030; }
    if (f.abstract) {
      // Abstract sits in a tinted well — it is the "read this if nothing else".
      const pad = w * 0.018;
      const probe = brFlow(ctx, f.abstract, -9999, 0, w - m * 2 - pad * 2, body * 1.02, { lh: 1.5 });
      const boxH = (probe.y - 0) + pad * 2;
      ctx.fillStyle = BRAND.bone;
      ctx.fillRect(m, y, w - m * 2, boxH);
      brRule(ctx, m, y, Math.max(3, w * 0.0035), boxH, accent);
      brFlow(ctx, f.abstract, m + pad, y + pad, w - m * 2 - pad * 2, body * 1.02, { color: BRAND.ink800, lh: 1.5 });
      y += boxH + h * 0.030;
    }
    if (image) {
      const ih = h * 0.22;
      drawImageFit(ctx, image, m, y, w - m * 2, ih, fit, pal.bg);
      if (f.caption) brLabel(ctx, f.caption, m, y + ih + w * 0.008, w * 0.0088, BRAND.ink600, { tracking: 0.08 });
      y += ih + h * 0.040;
    }
    const maxY = h * 0.90;
    const left = brFlow(ctx, f.body || '', m, y, colW, body, { color: BRAND.ink800, lh: 1.6, maxY });
    if (left.rest) brFlow(ctx, left.rest, m + colW + gut, y, colW, body, { color: BRAND.ink800, lh: 1.6, maxY });
    brFurniture(ctx, frame, page, opts, false);
    return;
  }

  if (type === 'figures') {
    let y = h * 0.10;
    if (f.eyebrow) { brLabel(ctx, f.eyebrow, m, h * 0.045, w * 0.0095, BRAND.ink600, { tracking: 0.16 }); }
    const ih = h * 0.62;
    if (image) drawImageFit(ctx, image, -bleed, y, w + bleed * 2, ih, fit, pal.bg);
    y += ih + h * 0.030;
    brRule(ctx, m, y, RULE_W, RULE_H, accent);
    y += h * 0.025;
    for (const cap of (f.caption || '').split('\n').map((s) => s.trim()).filter(Boolean)) {
      const r = brFlow(ctx, cap, m, y, w - m * 2, body * 0.95, { color: BRAND.ink600, lh: 1.5 });
      y = r.y + body * 0.5;
    }
    brFurniture(ctx, frame, page, opts, false);
    return;
  }

  if (type === 'courses') {
    let y = initiator(h * 0.13, f.eyebrow);
    ctx.font = `700 ${h1 * 0.66}px ${BRAND.display}`;
    ctx.fillStyle = pal.ink;
    ctx.fillText(f.headline || '', m, y + h1 * 0.66);
    y += h1 * 1.05;
    const rows = (f.body || '').split('\n').map((l) => l.split('|').map((p) => p.trim())).filter((r) => r[0]);
    for (const [date, course, place] of rows) {
      ctx.font = `500 ${body * 1.0}px ${BRAND.mono}`;
      ctx.fillStyle = accent;
      ctx.fillText(date || '', m, y + body);
      ctx.font = `500 ${body * 1.15}px ${BRAND.display}`;
      ctx.fillStyle = pal.ink;
      ctx.fillText(course || '', m + w * 0.20, y + body);
      ctx.font = `300 ${body * 1.0}px ${BRAND.display}`;
      ctx.fillStyle = BRAND.ink600;
      const pw = ctx.measureText(place || '').width;
      ctx.fillText(place || '', w - m - pw, y + body);
      ctx.fillStyle = BRAND.ink100;
      ctx.fillRect(m, y + body * 1.8, w - m * 2, Math.max(1, w * 0.0006));
      y += body * 3.0;
    }
    if (f.cta) brLabel(ctx, f.cta, m, h - h * 0.10, w * 0.011, accent, { tracking: 0.14 });
    brFurniture(ctx, frame, page, opts, false);
    return;
  }

  if (type === 'partners') {
    let y = initiator(h * 0.13, f.eyebrow);
    ctx.font = `700 ${h1 * 0.66}px ${BRAND.display}`;
    ctx.fillStyle = pal.ink;
    ctx.fillText(f.headline || '', m, y + h1 * 0.66);
    y += h1 * 1.05;
    if (f.body) y = brFlow(ctx, f.body, m, y, w - m * 2, body, { color: BRAND.ink600, lh: 1.6 }).y + h * 0.04;
    const wallEnd = brPartnerWall(ctx, frame, opts.partners, m, y, w - m * 2, h * 0.55);
    if (wallEnd === y) {
      brLabel(ctx, 'Upload partner logos in the Brand system panel', m, y, w * 0.0095, BRAND.ink300, { tracking: 0.08 });
    }
    brFurniture(ctx, frame, page, opts, false);
    return;
  }
}


// ═══ PARTNER LOGOS ═══════════════════════════════════════════════════
// Third-party marks are not ours to restyle: a partner's logo has its own brand
// guide, and "make it match ours" is the one thing we may not do. So the choices
// here are about LEGIBILITY, not taste — a white plate keeps their colours intact
// on a coal surface, and the greyscale knock-out is the fallback when a plate
// would be too loud.
//
// Painted in the IMAGE layer, deliberately: partner logos are raster (uploaded
// PNG/JPG), so drawing them here keeps them in the bitmap that the print PDF
// composites, rather than being dropped by the vector text pass.
function drawPartnerLogos(ctx, frame, partners, palette) {
  const logos = (partners?.logos || []).filter((l) => l && l.img);
  if (!partners?.enabled || !logos.length) return;
  const { w, h, padX, padY } = frame;
  const base = Math.min(w, h);
  const rowH = base * clamp(partners.size ?? 0.055, 0.02, 0.2);   // logo height
  const gap  = rowH * 0.7;
  const dims = logos.map((l) => {
    const ar = (l.img.naturalWidth || l.img.width) / (l.img.naturalHeight || l.img.height || 1);
    return { img: l.img, w: rowH * (isFinite(ar) && ar > 0 ? ar : 1), h: rowH };
  });
  const rowW = dims.reduce((s, d) => s + d.w, 0) + gap * (dims.length - 1);
  const caption = (partners.label || '').trim();
  const capSize = Math.max(9, rowH * 0.26);
  const capGap  = caption ? capSize * 1.5 : 0;

  const align = partners.align || 'center';                 // left | center | right
  const atTop = (partners.pos || 'bottom') === 'top';
  let x = align === 'left'  ? padX
        : align === 'right' ? w - padX - rowW
        : (w - rowW) / 2;
  let y = atTop ? padY * 1.1 + capGap : h - padY * 0.9 - rowH;

  // Optional white plate — keeps third-party logos legible (and their own brand
  // colours intact) on navy / photographic backgrounds.
  if (partners.plate) {
    const pad = rowH * 0.45;
    const px = x - pad, py = y - pad - capGap;
    const pw = rowW + pad * 2, ph = rowH + capGap + pad * 2;
    const r = Math.min(pad, rowH * 0.35);
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(px + r, py);
    ctx.arcTo(px + pw, py, px + pw, py + ph, r);
    ctx.arcTo(px + pw, py + ph, px, py + ph, r);
    ctx.arcTo(px, py + ph, px, py, r);
    ctx.arcTo(px, py, px + pw, py, r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  if (caption) {
    const onPlate = !!partners.plate;
    ctx.save();
    ctx.fillStyle = onPlate ? BRAND.ink600
      : (palette.mode === 'dark' ? 'rgba(255,255,255,0.66)' : BRAND.ink600);
    ctx.font = `500 ${capSize}px ${BRAND.mono}`;
    ctx.textAlign = align === 'right' ? 'right' : align === 'left' ? 'left' : 'center';
    const cx = align === 'right' ? x + rowW : align === 'left' ? x : x + rowW / 2;
    const ls = capSize * 0.14;
    // letter-spaced caption (mono, uppercase) — matches the sender/folio voice
    const text = caption.toUpperCase();
    const totalLs = ls * Math.max(0, text.length - 1);
    let cursor = ctx.textAlign === 'center' ? cx - (ctx.measureText(text).width + totalLs) / 2
               : ctx.textAlign === 'right'  ? cx - (ctx.measureText(text).width + totalLs)
               : cx;
    ctx.textAlign = 'left';
    for (const ch of text) {
      ctx.fillText(ch, cursor, y - capGap * 0.35);
      cursor += ctx.measureText(ch).width + ls;
    }
    ctx.restore();
  }

  // Greyscale/knock-out option for dark surfaces without a plate
  ctx.save();
  if (partners.mono && !partners.plate) ctx.filter = 'grayscale(1) brightness(2.2)';
  for (const d of dims) {
    ctx.drawImage(d.img, x, y, d.w, d.h);
    x += d.w + gap;
  }
  ctx.restore();
}


// ═══ MEDARTIS GROUP LOCKUP ═══════════════════════════════════════════
// The house marks on the canvas. Three things here are deliberate.
//
// SIZE IS OFF THE SHORT EDGE, NOT THE CANVAS. `Math.min(w, h)` — because a
// fraction of the long edge on a 43:1 lanyard is a lockup taller than the strap.
// IBRA's sponsor strip takes its default as a fraction of the canvas
// (`size: partners.size ?? 0.78`) and that is exactly why it draws its wordmark at
// the wrong scale. The bug is not in the drawing, it is in what the fraction is OF.
//
// VARIANT IS RESOLVED AGAINST THE SURFACE UNDERNEATH, not the palette. On a
// gradient the palette's mode says "dark" while the spot under the lockup may be
// bright teal. So the actual ramp position is sampled and asked.
//
// CLEAR SPACE IS RESERVED, NOT ASSUMED. Each mark reserves 1.5x its own height,
// per groupBrands.js — the medartis 1.5x-d rule generalised honestly rather than
// pretended to apply to marks that have no "d".
/**
 * The band the Group lockup occupies, clear space included.
 *
 * This exists because drawGroupLockup was RETURNING this band and every caller was
 * throwing it away, while a comment above it claimed "so text keeps out". Text did
 * not keep out. brandBarClearance had never heard of the Group, so the lockup and
 * the headline were laying claim to the same strip and whichever drew second won.
 *
 * Geometry that two functions must agree on lives in one function. The draw cannot
 * drift from the reservation if they are the same arithmetic.
 */
function groupLockupBand(frame, group) {
  if (!group?.enabled) return null;
  const { w, h, padX, padY } = frame;
  // Off the SHORT edge, never the canvas: a fraction of the long edge on a 43:1
  // lanyard is a lockup taller than the strap.
  const short = Math.min(w, h);
  const boxH = short * clamp(group.size ?? 0.14, 0.03, 0.4);
  const boxW = w - padX * 2;
  if (boxH <= 0 || boxW <= 0) return null;
  const y = (group.pos ?? 'top') === 'top' ? padY : h - padY - boxH;
  // The mark's own clear space. GROUP_CLEAR_RATIO x its drawn height, per
  // groupBrands.js — the 1.5x-d rule generalised rather than pretended at.
  const clear = clearSpaceFor(GROUP_MARK, boxH) * 0.5;
  return { x: padX, y, w: boxW, h: boxH, top: y - clear, bottom: y + boxH + clear, clear };
}

function drawGroupLockup(ctx, frame, group, palette, surface) {
  const band = groupLockupBand(frame, group);
  if (!band) return null;
  const { w, h, padX, padY } = frame;
  const boxH = band.h, boxW = band.w;

  // THE HIERARCHY, which the artwork must not misstate:
  //
  //     Medartis Group          <- the house
  //       |-- medartis          <- the main brand
  //       |-- KeriMedical
  //       +-- NeoOrtho
  //
  // The Group mark stands IN PLACE OF the medartis wordmark (drawBrandBar
  // suppresses it), because the house and the main brand are not two senders.
  // The co-brands are optional, and when present they sit BENEATH the Group — they
  // are its brands, not its peers, and a single row of equals would say otherwise.
  const y = group.pos === 'top' ? padY : h - padY - boxH;
  //
  // AND THE CO-BRANDS LOSE THEIR BYLINE.
  //
  // BOTH of them. KeriMedical says so in its file (<g id="medartis_group">, and a
  // shipped build that hides it with display:none). NeoOrtho carries the same byline
  // as bare outlines with no group and no text to grep for — which is exactly why it
  // was still rendering "NeoOrtho / medartis group" directly beneath the Medartis
  // Group mark, saying the same thing twice, in opposite directions.
  //
  // Under the Group mark the byline comes off. Standing alone it stays: away from
  // the house mark it is the only thing naming the parent.
  const withByline = !group.enabled;
  const cobs = [
    group.coBrands?.medartis && MEDARTIS_WORDMARK_MARK,
    group.coBrands?.neoortho && NEOORTHO_MARK,
    group.coBrands?.kerimedical && KERIMEDICAL_MARK,
  ].filter(Boolean);

  let rects;
  if (!cobs.length) {
    rects = familyRow([GROUP_MARK], { x: padX, y, w: boxW, h: boxH, align: group.align ?? 'center' });
  } else {
    const gapY = boxH * clamp(group.rowGap ?? 0.16, 0, 0.5);
    const headH = boxH * clamp(group.headShare ?? 0.38, 0.15, 0.7);   // the house reads first
    const rowH = Math.max(1, boxH - headH - gapY);
    const align = group.align ?? 'center';
    rects = [
      ...familyRow([GROUP_MARK], { x: padX, y, w: boxW, h: headH, align }),
      // baselineRow, not familyRow: these are WORDMARKS. Matched by area they stand
      // at three different heights, because a bounding box does not know where the
      // letters are.
      ...baselineRow(cobs, { x: padX, y: y + headH + gapY, w: boxW, h: rowH,
                             align, gapRatio: group.gap ?? 2.6, withByline }),
    ];
  }
  if (!rects?.length) return null;

  // Which ink? Ask the surface at the lockup's own position, not the palette.
  let variant = group.variant;
  if (variant === 'auto') {
    if (surface?.enabled && surface.gradient) {
      // Where along the ramp does the lockup actually sit? tAt() is the inverse of
      // the renderer's own axis, so this asks the SAME question the paint answered
      // — including for a radial, where a hand-rolled linear projection would be
      // confidently wrong.
      const bleed = frame.bleedPx || 0;
      const t = tAt(surface.gradient, padX + boxW / 2, y + boxH / 2,
                    -bleed, -bleed, w + bleed * 2, h + bleed * 2);
      const best = legibleInkAt(surface.gradient, t, colorAt);
      // A sub-brand's own colours only survive on a light, quiet surface. Anywhere
      // else the mark goes single-colour, which is what its negative artwork is for.
      variant = best.ink === 'paper' ? 'white' : 'mono';
    } else {
      variant = palette.mode === 'dark' ? 'white' : 'color';
    }
  }
  const ink = palette.mode === 'dark' ? BRAND.bone00 : BRAND.ink;

  for (const r of rects) {
    ctx.save();
    ctx.translate(r.x, r.y);
    // Scale against the glyph the ROW measured, not the mark's default one — with
    // the byline on they are different boxes, and using the wrong one squashes the
    // artwork while every number still looks uniform.
    const gl = r.glyph || r.mark.glyph;
    const sx = r.w / gl.w, sy = r.h / gl.h;
    ctx.scale(sx, sy);
    ctx.translate(-gl.x, -gl.y);
    for (const pth of markPaths(r.paths ? { paths: r.paths } : r.mark, variant, ink)) {
      ctx.fillStyle = pth.fill;
      ctx.fill(new Path2D(pth.d));
    }
    ctx.restore();
  }

  return band;
}

// ═══ LAYOUT · TYPE ONLY ══════════════════════════════════════════════
// No photograph. Not a fallback — a choice.
//
// A quote card, a save-the-date, an internal note: forcing an image onto these
// weakens them, and the app was doing exactly that by showing a "NO IMAGE" plate
// where the picture was supposed to be. Restraint is in the brand definition; this
// is the layout that lets you practise it.
//
// The type is set on the surface with generous air and anchored to the OPTICAL
// centre — a block centred by arithmetic sits low, because the eye reads the

// ═══ THE SURFACE ═════════════════════════════════════════════════════
// Every layout used to open with these exact two lines:
//
//     ctx.fillStyle = palette.bg;
//     ctx.fillRect(-bleed, -bleed, w + bleed * 2, h + bleed * 2);
//
// Nine copies. Which is fine for a flat colour and fatal for anything else: a
// gradient cannot be expressed as a fillStyle STRING, so the moment the surface
// became more than a colour, every one of those nine sites would quietly paint a
// flat rectangle over it. The control would be in the panel, the swatch would
// update, and the canvas would not change. IBRA shipped exactly that bug and
// spent a commit undoing it (429f60a — "gradient unappliable: five layouts
// painted over it"). It had five. We have nine.
//
// So there is now ONE place that paints the surface, and check_layouts fails any
// layout that paints its own. A gradient is a property of the surface, not a
// favour each layout must remember to do.
function paintSurface(ctx, frame, palette, surface) {
  const { w, h } = frame;
  const bleed = frame.bleedPx || 0;
  const x = -bleed, y = -bleed, ww = w + bleed * 2, hh = h + bleed * 2;

  if (surface?.enabled && surface.gradient) {
    // The ramp is painted across the BLED rect, not the trim box. A gradient that
    // starts at the trim edge leaves the bleed a flat slab of the end colour —
    // invisible on screen, a visible band after the guillotine.
    //
    // applyCanvasGradient is the SHARED renderer (it handles radial too). Rolling
    // the axis by hand here is how the canvas and the SVG export drift apart — and
    // my hand-rolled version destructured axisFor's return as an array when it
    // returns an object, which would have thrown the instant anyone ticked the box.
    applyCanvasGradient(ctx, surface.gradient, x, y, ww, hh);
    ctx.fillRect(x, y, ww, hh);
    return;
  }
  ctx.fillStyle = palette.bg;
  ctx.fillRect(x, y, ww, hh);
}

// mass, not the box.
function drawTypeOnly(ctx, frame, content, image, opts) {
  const { w, h, padX, padY } = frame;
  const { palette, accent } = opts;
  const bleed = frame.bleedPx || 0;

  paintSurface(ctx, frame, palette, opts.surface);

  const safeArea = { x: 0, y: 0, w, h };
  const clearance = brandBarClearance(ctx, frame, { ...opts, safeArea });
  const top = Math.max(padY * 1.4, clearance.topY);
  const bottom = Math.min(h - padY * 1.4, clearance.bottomY);

  // Optical centre: 46% rather than 50%. The difference is small and the effect
  // is not — a block on the mathematical centre reads as having slipped.
  const band = bottom - top;
  const anchorY = top + band * 0.46;
  const tFrame = { ...frame, textMaxH: Math.max(80, band), fitOut: opts.fitOut, textOverflow: opts.textOverflow };

  // Measure first so the block can be centred on its own height rather than
  // hung from an arbitrary line.
  const probe = layoutTextElements(ctx, content, padX, 0, w - padX * 2, palette, accent, tFrame, 'top');
  const blockH = probe.length
    ? Math.max(...probe.map((t) => t.y + (t.size || 0))) - Math.min(...probe.map((t) => t.y - (t.size || 0)))
    : 0;
  const y = Math.max(top, anchorY - blockH / 2);

  drawTextBackdropOnly(ctx, content, padX, y, w - padX * 2, palette, accent, tFrame, 'top', opts.textBackdrop);
  if (!opts.skipOverlays) drawTextBlock(ctx, content, padX, y, w - padX * 2, palette, accent, tFrame, 'top', null);
  if (!opts.skipOverlays) drawBrandBar(ctx, frame, palette, accent, false, { ...opts, safeArea });
  if (!opts.skipOverlays) drawQrOverlay(ctx, frame, opts.qr, opts.qrImage, palette);
  drawPartnerLogos(ctx, frame, opts.partners, palette);
  drawGroupLockup(ctx, frame, opts.group, palette, opts.surface);
}

// ═══ LAYOUT · SIDE BY SIDE ═══════════════════════════════════════════
// Image on one side, type on the other — on ANY format.
//
// The existing split already does this, but only when the canvas is wider than
// 1.4:1; on a square or a portrait it silently becomes top/bottom. That is a good
// default and a bad rule: a 1:1 post with the image left and the type right is a
// perfectly ordinary editorial move, and there was no way to ask for it.
function drawSideBySide(ctx, frame, content, image, opts, imageSide = 'right') {
  const { w, h, padX, padY } = frame;
  const { palette, accent, fit } = opts;
  const bleed = frame.bleedPx || 0;

  paintSurface(ctx, frame, palette, opts.surface);

  const ratio = clamp(fit?.frameRatio ?? 0.5, 0.25, 0.75);
  const imgW = w * ratio;
  const imgX = imageSide === 'left' ? 0 : w - imgW;
  const textX = imageSide === 'left' ? imgW + padX : padX;

  // The image bleeds off its own three edges — the split is a hard meeting of two
  // fields, not a picture floating in a margin.
  const ix = imageSide === 'left' ? -bleed : imgX;
  const iw = imgW + bleed;
  if (image) drawImageFit(ctx, image, ix, -bleed, iw, h + bleed * 2, fit, palette.bg);
  else {
    ctx.fillStyle = palette.mode === 'dark' ? BRAND.coal800 : BRAND.bone;
    ctx.fillRect(ix, -bleed, iw, h + bleed * 2);
  }

  const safeArea = imageSide === 'left'
    ? { x: imgW, y: 0, w: w - imgW, h }
    : { x: 0, y: 0, w: w - imgW, h };
  const clearance = brandBarClearance(ctx, frame, { ...opts, safeArea });
  const top = Math.max(padY * 1.3, clearance.topY);
  const bottom = Math.min(h - padY * 1.3, clearance.bottomY);
  const textW = w - imgW - padX * 2;
  const tFrame = { ...frame, textMaxH: Math.max(80, bottom - top), fitOut: opts.fitOut, textOverflow: opts.textOverflow };

  const probe = layoutTextElements(ctx, content, textX, 0, textW, palette, accent, tFrame, 'top');
  const blockH = probe.length
    ? Math.max(...probe.map((t) => t.y + (t.size || 0))) - Math.min(...probe.map((t) => t.y - (t.size || 0)))
    : 0;
  const y = Math.max(top, top + ((bottom - top) * 0.46) - blockH / 2);

  drawTextBackdropOnly(ctx, content, textX, y, textW, palette, accent, tFrame, 'top', opts.textBackdrop);
  if (!opts.skipOverlays) drawTextBlock(ctx, content, textX, y, textW, palette, accent, tFrame, 'top', null);
  if (!opts.skipOverlays) drawBrandBar(ctx, frame, palette, accent, false, { ...opts, safeArea });
  if (!opts.skipOverlays) drawQrOverlay(ctx, frame, opts.qr, opts.qrImage, palette);
  drawPartnerLogos(ctx, frame, opts.partners, palette);
  drawGroupLockup(ctx, frame, opts.group, palette, opts.surface);
}

// ═══ LAYOUT · TABLE ══════════════════════════════════════════════════
// The agenda and fact rows already exist in the body — "09.15⇥Session — Faculty",
// "DATE⇥Friday, 29 Nov". Until now they were set inside the running text block,
// which is fine for three rows and falls apart at twelve: the columns are only as
// aligned as the paragraph happens to allow.
//
// This gives them the page. One measured label column, hairline rules between
// rows, and the gold reserved for the head rule — the INITIATOR, as everywhere
// else in the system. Rows never wrap into each other because the row height is
// derived from the wrapped content, not assumed.
function drawTable(ctx, frame, content, image, opts) {
  const { w, h, padX, padY } = frame;
  const { palette, accent } = opts;
  const bleed = frame.bleedPx || 0;

  paintSurface(ctx, frame, palette, opts.surface);

  const safeArea = { x: 0, y: 0, w, h };
  const clearance = brandBarClearance(ctx, frame, { ...opts, safeArea });
  const ts = computeTypeScale(frame);
  const ink = palette.ink;
  const muted = palette.muted;
  const rule = palette.mode === 'dark' ? 'rgba(250,248,240,0.16)' : BRAND.ink100;

  let y = Math.max(padY * 1.2, clearance.topY);
  const x = padX;
  const tw = w - padX * 2;

  // ── head: kicker → rule → headline. The house sequence, unchanged.
  if (content.eyebrow) {
    // drawTrackedFit, not a bare per-char loop: this column is full width TODAY,
    // which is the only reason the overflow was invisible here. Latent is not fixed.
    const r = drawTrackedFit(ctx, content.eyebrow.toUpperCase(), x, y + ts.eyebrowSize,
      tw, ts.eyebrowSize, 500, BRAND.mono, 0.14, accent);
    y += ts.eyebrowSize * 2.4 + r.extra;
  }
  if (content.headline) {
    const size = fitFont(ctx, content.headline.split('\n')[0], tw, ts.headlineMax * 0.72, ts.headlineMin, 700);
    ctx.font = `700 ${size}px ${BRAND.display}`;
    ctx.fillStyle = ink;
    for (const line of wrapText(ctx, content.headline, tw)) {
      ctx.fillText(line, x, y + size);
      y += size * 1.16;
    }
    y += size * 0.35;
  }
  if (content.subline) {
    ctx.font = `300 ${ts.sublineSize * 0.8}px ${BRAND.display}`;
    ctx.fillStyle = muted;
    for (const line of wrapText(ctx, content.subline, tw)) {
      ctx.fillText(line, x, y + ts.sublineSize * 0.8);
      y += ts.sublineSize * 1.05;
    }
    y += ts.sublineSize * 0.4;
  }

  // The head rule — gold, full measure. The only gold on the page besides the kicker.
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, tw, Math.max(2, w * 0.0035));
  y += Math.max(2, w * 0.0035) + ts.bodySize * 1.1;

  // ── rows
  const rawLines = (content.body || '').split('\n').map((l) => l.trim()).filter((l) => l && l !== PAGE_BREAK);
  const rows = parseStructuredRows(rawLines);
  const bottom = Math.min(h - padY * 1.1, clearance.bottomY);

  if (!rows || !rows.length) {
    ctx.font = `400 ${ts.bodySize}px ${BRAND.display}`;
    ctx.fillStyle = muted;
    // Say what this layout EATS. An empty table that just sits there is a puzzle.
    for (const line of wrapText(ctx, content.body || 'Add rows in § CONTENT — “09.15  Session title — Faculty”, or a label and a value.', tw)) {
      if (y + ts.bodySize > bottom) break;
      ctx.fillText(line, x, y + ts.bodySize);
      y += ts.bodySize * 1.5;
    }
  } else {
    // Measure the label column ONCE, from the widest label, and cap it: one long
    // label must not starve every other row of its content column.
    let size = ts.bodySize;
    const measureCol = (sz) => {
      ctx.font = `500 ${sz}px ${BRAND.mono}`;
      return Math.min(tw * 0.34, Math.max(...rows.map((r) => ctx.measureText(r.col || '').width)) + sz * 1.6);
    };
    // Shrink to fit, like the type engine: rows give way before the page does.
    const heightAt = (sz) => {
      const colW = measureCol(sz);
      ctx.font = `400 ${sz}px ${BRAND.display}`;
      return rows.reduce((sum, r) => {
        const lines = wrapText(ctx, r.main || '', tw - colW) .length || 1;
        return sum + Math.max(sz * 1.5, lines * sz * 1.28) + (r.note ? sz * 1.05 : 0) + sz * 0.85;
      }, 0);
    };
    let guard = 0;
    while (y + heightAt(size) > bottom && size > ts.bodySize * 0.55 && guard++ < 24) size *= 0.94;

    const colW = measureCol(size);
    for (const r of rows) {
      if (y > bottom) break;
      const rowTop = y;
      // label / time column — mono, tracked, gold. It is a signpost, not content.
      if (r.col) {
        ctx.font = `500 ${size * 0.92}px ${BRAND.mono}`;
        ctx.fillStyle = accent;
        const ls = size * 0.06;
        let cx = x;
        for (const ch of r.col) { ctx.fillText(ch, cx, y + size); cx += ctx.measureText(ch).width + ls; }
      }
      ctx.font = `400 ${size}px ${BRAND.display}`;
      ctx.fillStyle = ink;
      let ly = y;
      for (const line of wrapText(ctx, r.main || '', tw - colW)) {
        ctx.fillText(line, x + colW, ly + size);
        ly += size * 1.28;
      }
      if (r.note) {
        ctx.font = `300 ${size * 0.86}px ${BRAND.display}`;
        ctx.fillStyle = muted;
        ctx.fillText(r.note, x + colW, ly + size * 0.86);
        ly += size * 1.05;
      }
      y = Math.max(ly, rowTop + size * 1.5) + size * 0.85;
      // hairline between rows — never after the last, which would read as a cut
      if (r !== rows[rows.length - 1] && y < bottom) {
        ctx.fillStyle = rule;
        ctx.fillRect(x, y - size * 0.42, tw, Math.max(1, w * 0.0006));
      }
    }
  }

  if (content.cta) {
    drawTrackedFit(ctx, content.cta.toUpperCase(), x, Math.min(bottom, h - padY * 0.7),
      tw, ts.ctaSize, 500, BRAND.mono, 0.12, accent);
  }

  if (!opts.skipOverlays) drawBrandBar(ctx, frame, palette, accent, false, { ...opts, safeArea });
  if (!opts.skipOverlays) drawQrOverlay(ctx, frame, opts.qr, opts.qrImage, palette);
  drawPartnerLogos(ctx, frame, opts.partners, palette);
  drawGroupLockup(ctx, frame, opts.group, palette, opts.surface);
}

// ═══ LAYOUT · STAT ═══════════════════════════════════════════════════
// One number, given the room a number deserves.
//
// "1 in 6." "+18%." "5M implants." These already exist in the templates and were
// being set at headline size in a paragraph, where a statistic reads as a
// sentence. Here the figure IS the composition: it takes the optical centre, and
// everything else defers to it.
//
// The number comes from the HEADLINE — no new field. A layout that demands its own
// content model is a layout nobody uses.
function drawStat(ctx, frame, content, image, opts) {
  const { w, h, padX, padY } = frame;
  const { palette, accent, fit } = opts;
  const bleed = frame.bleedPx || 0;

  paintSurface(ctx, frame, palette, opts.surface);

  // An optional image sits BEHIND, heavily scrimmed: the figure must win.
  if (image) {
    drawImageFit(ctx, image, -bleed, -bleed, w + bleed * 2, h + bleed * 2, fit, palette.bg);
    const dark = palette.mode === 'dark';
    ctx.fillStyle = dark ? 'rgba(19,19,16,0.72)' : 'rgba(255,255,255,0.78)';
    ctx.fillRect(-bleed, -bleed, w + bleed * 2, h + bleed * 2);
  }

  const safeArea = { x: 0, y: 0, w, h };
  const clearance = brandBarClearance(ctx, frame, { ...opts, safeArea });
  const ts = computeTypeScale(frame);
  const top = Math.max(padY * 1.3, clearance.topY);
  const bottom = Math.min(h - padY * 1.3, clearance.bottomY);
  const tw = w - padX * 2;

  const figure = (content.headline || '').split('\n')[0].trim();
  const blocks = [];
  if (content.eyebrow) blocks.push({ k: 'eyebrow', size: ts.eyebrowSize });
  // The figure is deliberately allowed far past the headline cap — it is not a
  // headline. Fitted to the measure, floored so it never becomes ordinary.
  const figMax = Math.min(w * 0.30, h * 0.34);
  const figSize = figure ? fitFont(ctx, figure, tw, figMax, figMax * 0.34, 700) : 0;
  if (figure) blocks.push({ k: 'figure', size: figSize });
  if (content.subline) blocks.push({ k: 'subline', size: ts.sublineSize });
  if (content.body) blocks.push({ k: 'body', size: ts.bodySize });

  // Height first, so the stack can be optically centred rather than hung.
  let totalH = 0;
  const gap = { eyebrow: 1.6, figure: 0.5, subline: 0.9, body: 0 };
  for (const b of blocks) {
    if (b.k === 'body') {
      ctx.font = `400 ${b.size}px ${BRAND.display}`;
      b.lines = wrapText(ctx, content.body, tw * 0.8);
      totalH += b.lines.length * b.size * 1.5;
    } else if (b.k === 'subline') {
      ctx.font = `300 ${b.size}px ${BRAND.display}`;
      b.lines = wrapText(ctx, content.subline, tw * 0.9);
      totalH += b.lines.length * b.size * 1.25;
    } else {
      totalH += b.size * (b.k === 'figure' ? 1.0 : 1.2);
    }
    totalH += b.size * (gap[b.k] ?? 0.8);
  }
  let y = Math.max(top, top + (bottom - top) * 0.46 - totalH / 2);

  for (const b of blocks) {
    if (b.k === 'eyebrow') {
      const r = drawTrackedFit(ctx, content.eyebrow.toUpperCase(), padX, y + b.size,
        tw, b.size, 500, BRAND.mono, 0.14, accent);
      y += b.size * (1.2 + gap.eyebrow) + r.extra;
    } else if (b.k === 'figure') {
      ctx.font = `700 ${b.size}px ${BRAND.display}`;
      ctx.fillStyle = palette.ink;
      ctx.fillText(figure, padX, y + b.size * 0.86);
      y += b.size * (1.0 + gap.figure);
      // The initiator rule, under the figure: gold, short, exact.
      ctx.fillStyle = accent;
      ctx.fillRect(padX, y - b.size * 0.25, Math.min(w * 0.12, tw), Math.max(2, w * 0.004));
      y += Math.max(2, w * 0.004) + b.size * 0.30;
    } else if (b.k === 'subline') {
      ctx.font = `300 ${b.size}px ${BRAND.display}`;
      ctx.fillStyle = palette.ink;
      for (const line of b.lines) { ctx.fillText(line, padX, y + b.size); y += b.size * 1.25; }
      y += b.size * gap.subline;
    } else {
      ctx.font = `400 ${b.size}px ${BRAND.display}`;
      ctx.fillStyle = palette.muted;
      for (const line of b.lines) { ctx.fillText(line, padX, y + b.size); y += b.size * 1.5; }
    }
  }

  if (content.cta) {
    drawTrackedFit(ctx, content.cta.toUpperCase(), padX, Math.min(bottom, h - padY * 0.7),
      tw, ts.ctaSize, 500, BRAND.mono, 0.12, accent);
  }

  if (!opts.skipOverlays) drawBrandBar(ctx, frame, palette, accent, false, { ...opts, safeArea });
  if (!opts.skipOverlays) drawQrOverlay(ctx, frame, opts.qr, opts.qrImage, palette);
  drawPartnerLogos(ctx, frame, opts.partners, palette);
  drawGroupLockup(ctx, frame, opts.group, palette, opts.surface);
}

// ═══ LAYOUT · DUO ════════════════════════════════════════════════════
// Two images, side by side, with a caption under each.
//
// This exists because "before-after" already existed as a template and there was
// no layout that could show both at once — it was two carousel slides you had to
// swipe between, which is precisely the wrong way to present a comparison. A
// comparison is a comparison because you see both things TOGETHER.
//
// The second image is the CAROUSEL's second slide image when there is one, so the
// content model does not grow a new field; on a single-frame format it falls back
// to the same picture, which is honest — you can see immediately that you have not
// given it a second one.
//
// Captions come from the body: one line each, split on the newline you already
// type. Nothing new to learn.
function drawDuo(ctx, frame, content, image, opts) {
  const { w, h, padX, padY } = frame;
  const { palette, accent, fit } = opts;
  const bleed = frame.bleedPx || 0;

  paintSurface(ctx, frame, palette, opts.surface);

  const safeArea = { x: 0, y: 0, w, h };
  const clearance = brandBarClearance(ctx, frame, { ...opts, safeArea });
  const ts = computeTypeScale(frame);
  const ink = palette.ink;
  const muted = palette.muted;

  let y = Math.max(padY * 1.2, clearance.topY);
  const x = padX;
  const tw = w - padX * 2;

  if (content.eyebrow) {
    const r = drawTrackedFit(ctx, content.eyebrow.toUpperCase(), x, y + ts.eyebrowSize,
      tw, ts.eyebrowSize, 500, BRAND.mono, 0.14, accent);
    y += ts.eyebrowSize * 2.2 + r.extra;
  }
  if (content.headline) {
    const size = fitFont(ctx, content.headline.split('\n')[0], tw, ts.headlineMax * 0.62, ts.headlineMin, 700);
    ctx.font = `700 ${size}px ${BRAND.display}`;
    ctx.fillStyle = ink;
    for (const line of wrapText(ctx, content.headline, tw)) { ctx.fillText(line, x, y + size); y += size * 1.14; }
    y += size * 0.4;
  }

  // Captions are measured BEFORE the images, so the pictures take the room that
  // is genuinely left rather than pushing the captions off the page.
  const caps = (content.body || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2);
  const capSize = ts.bodySize * 0.88;
  const gutter = w * 0.028;
  const cellW = (tw - gutter) / 2;
  ctx.font = `400 ${capSize}px ${BRAND.display}`;
  const capLines = caps.map((c) => wrapText(ctx, c, cellW));
  const capH = capLines.length
    ? Math.max(...capLines.map((l) => l.length)) * capSize * 1.35 + capSize * 0.9
    : 0;

  const ctaH = content.cta ? ts.ctaSize * 2.4 : 0;
  const bottom = Math.min(h - padY * 1.0, clearance.bottomY);
  const cellH = Math.max(40, bottom - y - capH - ctaH);

  // The second picture: slide 2's image, or this one again.
  const imgB = (opts.duoImage ?? image) || image;
  const cells = [
    { x, img: image, cap: capLines[0] },
    { x: x + cellW + gutter, img: imgB, cap: capLines[1] },
  ];
  for (const c of cells) {
    if (c.img) drawImageFit(ctx, c.img, c.x, y, cellW, cellH, fit, palette.bg);
    else {
      ctx.fillStyle = palette.mode === 'dark' ? BRAND.coal800 : BRAND.bone;
      ctx.fillRect(c.x, y, cellW, cellH);
    }
  }
  let capY = y + cellH + capSize * 0.9;
  for (const c of cells) {
    if (!c.cap) continue;
    // A gold tick above each caption — the initiator, at caption scale.
    ctx.fillStyle = accent;
    ctx.fillRect(c.x, capY - capSize * 0.7, Math.min(cellW * 0.18, w * 0.05), Math.max(1.5, w * 0.0022));
    ctx.font = `400 ${capSize}px ${BRAND.display}`;
    ctx.fillStyle = muted;
    let ly = capY;
    for (const line of c.cap) { ctx.fillText(line, c.x, ly + capSize); ly += capSize * 1.35; }
  }

  if (content.cta) {
    drawTrackedFit(ctx, content.cta.toUpperCase(), x, Math.min(bottom, h - padY * 0.6),
      tw, ts.ctaSize, 500, BRAND.mono, 0.12, accent);
  }

  if (!opts.skipOverlays) drawBrandBar(ctx, frame, palette, accent, false, { ...opts, safeArea });
  if (!opts.skipOverlays) drawQrOverlay(ctx, frame, opts.qr, opts.qrImage, palette);
  drawPartnerLogos(ctx, frame, opts.partners, palette);
  drawGroupLockup(ctx, frame, opts.group, palette, opts.surface);
}

// ═══ LANYARD ═════════════════════════════════════════════════════════
// A congress lanyard is printed FLAT and then folded into a neck loop, so the
// artwork has two jobs an ordinary layout does not:
//
//   · it REPEATS along the strap, because you cannot know where the printer's
//     cut lands or how the wearer's loop hangs;
//   · it MIRRORS at the fold, so both halves of the worn loop read upright
//     instead of one side being upside-down on every visitor's chest.
//
// Everything is measured before it is drawn — the mark, the event name and the
// strap line each report their length along the strap, so the repeat block is
// composed from real widths and the items can never collide or be cut in half.
const LANYARD_DEFAULTS = {
  mark: 'wordmark',   // wordmark | none  (Medartis has no separate signet)
  markSize: 0.46,     // × strap width, measured ACROSS the webbing
  textSize: 0.34,     // × strap width — cap height of the event line
  spacing: 1.0,       // × block length — the gap between repeats
  mirror: true,       // flip the halves at the fold
  edges: true,        // accent selvedge hairlines
  strapLineOn: true,
};


// ═══ THE GROUP, IN LINE ═══════════════════════════════════════════════
// A lanyard is not a canvas you compose once. It is a loop that twists on a neck,
// so any 10cm of it might be the part facing out — which is why the strap repeats,
// and why everything on it has to work as a fragment.
//
// It is also about 20mm wide. That single fact decides the whole design:
//
//   IN LINE, NEVER STACKED. Three marks stacked across the webbing get ~6mm each
//   and none of them survive. In line they share the full width and the strap's
//   only abundant dimension — its length — pays for them.
//
// So the Group and its brands are ONE item on the strap: a single lockup with
// cap-matched marks on a shared baseline, internally spaced by the same § GROUP gap
// control that spaces the row on a poster. One control, one meaning. The text that
// follows is a separate item, separated by the strap's own item gap — because the
// marks are a lockup and the text is a different thought.
//
// KERIMEDICAL SETS THE CAP FOR EVERYONE, and this is worth knowing before you
// wonder why the letters went small: its mark is 3.13 cap-heights tall (bars above
// the caps, a stroke hanging below) where NeoOrtho is 1.00. It is the tallest thing
// per unit of letter, so it eats the webbing budget. On a 20mm strap at the default
// 46% budget that puts the row at a ~2.9mm cap — legible, but it is the reason.
function inlineGroupLockup(ctx, marks, strapW, budget, gapRatio, ink, variant) {
  const ms = marks.map((m) => markMetrics(m.mark, m.withByline)).filter((q) => q.paths.length);
  if (!ms.length) return null;

  // Cross-webbing extent is measured from the SHARED baseline, not by summing each
  // mark's own box: the row is one line of type, so it is as tall as the highest
  // ascender plus the deepest descender, and no taller.
  const A = Math.max(...ms.map((q) => q.above / q.cap));
  const B = Math.max(...ms.map((q) => q.below / q.cap));
  const cap = (strapW * budget) / (A + B);
  if (!(cap > 0)) return null;

  const gap = gapRatio * cap;
  const widths = ms.map((q) => q.widthPerCap * cap);
  const len = widths.reduce((a, b) => a + b, 0) + gap * (ms.length - 1);
  // Centre the row across the webbing on its optical middle, not its baseline —
  // the baseline sits low when something descends.
  const baseY = ((A - B) / 2) * cap;

  return {
    len,
    cap,
    draw: (x0) => {
      let x = x0;
      ms.forEach((q, i) => {
        const sc = cap / q.cap;
        ctx.save();
        ctx.translate(x, baseY - q.above * sc);
        ctx.scale(sc, sc);
        ctx.translate(-q.glyph.x, -q.glyph.y);
        for (const p of markPaths({ paths: q.paths }, variant, ink)) {
          ctx.fillStyle = p.fill;
          ctx.fill(new Path2D(p.d));
        }
        ctx.restore();
        x += widths[i] + gap;
      });
    },
  };
}

function drawLanyardStrip(ctx, frame, content, image, opts) {
  const { w, h } = frame;
  const { palette, accent } = opts;
  const bleed = frame.bleedPx || 0;
  const cfg = { ...LANYARD_DEFAULTS, ...(opts.lanyard || {}) };

  paintSurface(ctx, frame, palette, opts.surface);
  const ink   = palette.mode === 'dark' ? BRAND.bone00 : BRAND.ink;
  const muted = palette.mode === 'dark' ? BRAND.cream100 : BRAND.ink600;

  // Selvedge hairlines — reads as a woven edge on the finished strap.
  if (cfg.edges) {
    ctx.save();
    ctx.fillStyle = accent || BRAND.gold;
    const hair = Math.max(1, w * 0.018);
    ctx.globalAlpha = 0.9;
    ctx.fillRect(w * 0.06, -bleed, hair, h + bleed * 2);
    ctx.fillRect(w - w * 0.06 - hair, -bleed, hair, h + bleed * 2);
    ctx.restore();
  }

  const label = (content?.headline || '').trim().toUpperCase();
  const strap = cfg.strapLineOn ? (content?.subline || content?.cta || '').trim().toUpperCase() : '';

  const txtSize   = w * clamp(cfg.textSize, 0.12, 0.55);
  const strapSize = txtSize * 0.62;
  const trackOf   = (size) => size * 0.16;

  const measure = (text, size, weight, family) => {
    ctx.font = `${weight} ${size}px ${family}`;
    const ls = trackOf(size);
    return [...text].reduce((sum, ch) => sum + ctx.measureText(ch).width + ls, -ls);
  };
  const paint = (text, size, weight, family, color) => {
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.fillStyle = color;
    const ls = trackOf(size);
    let cx = 0;
    for (const ch of text) {
      ctx.fillText(ch, cx, size * 0.36);   // centred on the strap's mid-axis
      cx += ctx.measureText(ch).width + ls;
    }
  };

  // ── Compose one repeat block ───────────────────────────────────────
  const items = [];
  const grp = opts.group;
  if (cfg.mark !== 'none') {
    if (grp?.enabled) {
      // Same rule as everywhere else: the Group mark REPLACES the medartis
      // wordmark, and medartis joins its siblings as an optional co-brand. The
      // bylines come off — under the Group mark they would say "a medartis group
      // company" beside "medartis group", twice, on a 20mm strap.
      const marks = [{ mark: GROUP_MARK, withByline: false }];
      if (grp.coBrands?.medartis)    marks.push({ mark: MEDARTIS_WORDMARK_MARK, withByline: false });
      if (grp.coBrands?.neoortho)    marks.push({ mark: NEOORTHO_MARK, withByline: false });
      if (grp.coBrands?.kerimedical) marks.push({ mark: KERIMEDICAL_MARK, withByline: false });
      const variant = grp.variant && grp.variant !== 'auto'
        ? grp.variant
        : (palette.mode === 'dark' ? 'white' : 'color');
      const lock = inlineGroupLockup(ctx, marks, w, clamp(cfg.markSize, 0.15, 0.75),
                                     grp.gap ?? 2.6, ink, variant);
      if (lock) items.push(lock);
    } else {
      const markH = w * clamp(cfg.markSize, 0.15, 0.75);
      const markL = markH * (WM_GLYPH.w / WM_GLYPH.h);   // true artwork aspect
      items.push({ len: markL, draw: (x) => drawWordmark(ctx, x, -markH / 2, markH, ink) });
    }
  }
  if (label) {
    items.push({
      len: measure(label, txtSize, 700, BRAND.display),
      draw: (x) => { ctx.save(); ctx.translate(x, 0); paint(label, txtSize, 700, BRAND.display, ink); ctx.restore(); },
    });
  }
  if (strap) {
    items.push({
      len: measure(strap, strapSize, 500, BRAND.mono),
      draw: (x) => { ctx.save(); ctx.translate(x, 0); paint(strap, strapSize, 500, BRAND.mono, muted); ctx.restore(); },
    });
  }
  if (!items.length) return;

  // THE STRAP MUST HONOUR skipOverlays FOR ITS OWN MARK AND TEXT.
  //
  // It only ever honoured it for the QR. In vector-PDF mode the canvas is rendered
  // as a text-free bitmap and the type is laid down again as real vector — so
  // everything the strap drew got drawn TWICE, once raster and once vector, very
  // slightly apart. That is the doubled "HELLO BRANDING" on the proof.
  //
  // check_layouts said this layout honoured skipOverlays. It greps for the token,
  // and the token was present — on the QR line. A check that looks for a WORD
  // cannot tell you the word is doing anything.
  if (opts.skipOverlays) {
    // The QR is deliberately NOT drawn here: it is vectorised separately too.
    // Partner logos ARE — they are raster artwork the user uploaded, so there is no
    // vector pass to duplicate them.
    drawPartnerLogos(ctx, frame, opts.partners, palette);
    return;
  }

  const itemGap   = w * 1.1;                                   // between items in a block
  const blockLen  = items.reduce((s, it) => s + it.len, 0) + itemGap * (items.length - 1);
  const repeatGap = Math.max(w * 1.2, blockLen * clamp(cfg.spacing, 0.2, 3));
  const period    = blockLen + repeatGap;

  // Start half a gap in, so the strap's ends never cut a mark in half.
  const reps = Math.ceil((h + period) / period);
  for (let i = 0; i < reps; i++) {
    const blockStart  = repeatGap / 2 + i * period;
    const blockCenter = blockStart + blockLen / 2;
    if (blockStart > h) break;
    if (blockStart + blockLen > h) break;   // never print half a block

    // Mirror at the fold: past the midpoint the block reads the other way, so
    // both sides of the worn loop are upright.
    const flip = cfg.mirror && blockCenter > h / 2;

    ctx.save();
    ctx.translate(w / 2, blockCenter);
    ctx.rotate(flip ? Math.PI / 2 : -Math.PI / 2);
    let x = -blockLen / 2;                  // local axis: x runs ALONG the strap
    for (const it of items) {
      it.draw(x);
      x += it.len + itemGap;
    }
    ctx.restore();
  }

  if (!opts.skipOverlays) drawQrOverlay(ctx, frame, opts.qr, opts.qrImage, palette);
  // Co-branded congresses put a partner mark on the strap too — raster, so it
  // goes in the image layer like everywhere else.
  drawPartnerLogos(ctx, frame, opts.partners, palette);
  // NO drawGroupLockup here — deliberately, and check_layouts knows.
  //
  // That function reserves a full-width horizontal band at the top or bottom of the
  // canvas. On a 118 x 5315 strap "full width" is 118px ACROSS the webbing, and the
  // band would land sideways to everything else on the strap, at a size where none
  // of it reads. The strap composes the Group into its own repeat block above,
  // rotated onto the strap's axis, which is the only orientation that exists here.
}

// ─── LAYOUT 1: Image · Text split ────────────────────────────────────
function drawImageTextSplit(ctx, frame, content, image, opts, textPos) {
  const { w, h, padX, padY } = frame;
  const bleed = frame.bleedPx || 0;
  const { palette, accent, fit } = opts;
  const isWide = w / h > 1.4;

  // Bg fill — extended into bleed area so cut never reveals canvas background
  paintSurface(ctx, frame, palette, opts.surface);

  // Spanning bg placement defaults to 'full'. When set to 'image' it replaces
  // the per-slide image; 'text' fills only the text band; 'full' bleeds.
  const spanBg = opts.carouselBg?.image && opts.totalSlides > 1 ? opts.carouselBg : null;
  const spanPlacement = spanBg?.placement || 'full';
  const drawSpan = (x, y, ww, hh) => drawCarouselBackground(ctx, x, y, ww, hh,
    spanBg.image, opts.slideIdx || 0, opts.totalSlides, spanBg.fit);

  if (spanBg && spanPlacement === 'full') {
    // Spanning bg bleeds out on all sides
    drawSpan(-bleed, -bleed, w + bleed * 2, h + bleed * 2);
  }

  // Image ratio = how much of the canvas (tall: height, wide: width) the image gets.
  // Default 0.55 tall / 0.5 wide. User can override via fit.frameRatio.
  const defaultRatio = isWide ? 0.5 : 0.55;
  const imageRatio = clamp(fit?.frameRatio ?? defaultRatio, 0.15, 0.9);

  let safeArea, textRectX, textRectY, textRectW;
  let imageRect; // for spanning-bg placement='image'
  let textBandRect; // for spanning-bg placement='text'

  // When full-bleed spanning bg is on, the image area is already covered;
  // skip drawing the per-slide image (and skip the NO IMAGE placeholder)
  const skipImageRect = spanBg && spanPlacement === 'full';

  // Bleed-extended rect helper: extends an image rect outward on whichever
  // canvas edges it touches, so the image cover-fits into the bleed area too.
  const bleedExtend = (r) => {
    const x = r.x === 0       ? -bleed : r.x;
    const y = r.y === 0       ? -bleed : r.y;
    const rgt = r.x + r.w === w ? r.x + r.w + bleed : r.x + r.w;
    const bot = r.y + r.h === h ? r.y + r.h + bleed : r.y + r.h;
    return { x, y, w: rgt - x, h: bot - y };
  };

  if (isWide) {
    const imgW = w * imageRatio;
    imageRect = { x: w - imgW, y: 0, w: imgW, h };
    textBandRect = { x: 0, y: 0, w: w - imgW, h };
    const bRect = bleed > 0 ? bleedExtend(imageRect) : imageRect;
    if (spanBg && spanPlacement === 'image') {
      drawSpan(bRect.x, bRect.y, bRect.w, bRect.h);
    } else if (!skipImageRect) {
      drawImageFit(ctx, image, bRect.x, bRect.y, bRect.w, bRect.h, fit, palette.bg);
    }
    safeArea = { x: 0, y: 0, w: w - imgW, h };
    textRectX = padX; textRectY = padY; textRectW = w - imgW - padX * 2;
  } else {
    const imageH = h * imageRatio;
    const textHeight = h - imageH;
    let imgY;
    if (textPos === 'top') {
      imgY = textHeight;
      safeArea = { x: 0, y: 0, w, h: imgY };
      textRectX = padX; textRectY = padY; textRectW = w - padX * 2;
      textBandRect = { x: 0, y: 0, w, h: textHeight };
    } else {
      imgY = 0;
      safeArea = { x: 0, y: imageH, w, h: h - imageH };
      textRectX = padX; textRectY = imageH + padY * 0.6; textRectW = w - padX * 2;
      textBandRect = { x: 0, y: imageH, w, h: h - imageH };
    }
    imageRect = { x: 0, y: imgY, w, h: imageH };
    const bRect = bleed > 0 ? bleedExtend(imageRect) : imageRect;
    if (spanBg && spanPlacement === 'image') {
      drawSpan(bRect.x, bRect.y, bRect.w, bRect.h);
    } else if (!skipImageRect) {
      drawImageFit(ctx, image, bRect.x, bRect.y, bRect.w, bRect.h, fit, palette.bg);
    }
  }

  // Spanning bg in text band placement — draw after image area so it covers
  // the text region's bg (but stays under text + brand bar)
  if (spanBg && spanPlacement === 'text') {
    drawSpan(textBandRect.x, textBandRect.y, textBandRect.w, textBandRect.h);
  }

  // Reserve vertical clearance so wordmark/folio inside the safe area never
  // overlap the text block.
  const clearance = brandBarClearance(ctx, frame, { ...opts, safeArea });
  const adjTextY = Math.max(textRectY, clearance.topY);
  // How much height the text band ACTUALLY has. Hand this to the type engine and
  // it shrinks the block to fit, instead of running on under the image — which is
  // precisely what the starting layout was doing on a square canvas.
  const bandBottom = textBandRect ? textBandRect.y + textBandRect.h : safeArea.y + safeArea.h;
  const tFrame = {
    ...frame,
    textMaxH: Math.max(80, Math.min(bandBottom, clearance.bottomY) - adjTextY - padY * 0.5),
    fitOut: opts.fitOut,
    textOverflow: opts.textOverflow,
  };
  // Backdrop ALWAYS draws (image-composition layer) — even in PDF skipOverlays mode
  drawTextBackdropOnly(ctx, content, textRectX, adjTextY, textRectW, palette, accent, tFrame, 'top', opts.textBackdrop);
  if (!opts.skipOverlays) drawTextBlock(ctx, content, textRectX, adjTextY, textRectW, palette, accent, tFrame, 'top', null);
  if (!opts.skipOverlays) drawBrandBar(ctx, frame, palette, accent, false, { ...opts, safeArea });
  if (!opts.skipOverlays) drawQrOverlay(ctx, frame, opts.qr, opts.qrImage, palette);
  // Raster, so it belongs in the image layer — see drawPartnerLogos.
  drawPartnerLogos(ctx, frame, opts.partners, palette);
  drawGroupLockup(ctx, frame, opts.group, palette, opts.surface);
}

// ─── LAYOUT 2: Full-bleed overlay ────────────────────────────────────
function drawFullBleedOverlay(ctx, frame, content, image, opts) {
  const { w, h, padX, padY } = frame;
  const { palette, accent, fit } = opts;

  // Overlay layout — full bleed. Spanning bg can replace the image (placement
  // 'full' or 'image') or sit only behind the text band (placement 'text').
  // ALL drawing extends into bleed since the entire canvas bleeds.
  const bleed = frame.bleedPx || 0;
  const spanBg = opts.carouselBg?.image && opts.totalSlides > 1 ? opts.carouselBg : null;
  const spanPlacement = spanBg?.placement || 'full';
  paintSurface(ctx, frame, palette, opts.surface);
  if (image && !(spanBg && (spanPlacement === 'full' || spanPlacement === 'image'))) {
    drawImageFit(ctx, image, -bleed, -bleed, w + bleed * 2, h + bleed * 2, fit, palette.bg);
  } else if (spanBg && (spanPlacement === 'full' || spanPlacement === 'image')) {
    drawCarouselBackground(ctx, -bleed, -bleed, w + bleed * 2, h + bleed * 2,
      spanBg.image, opts.slideIdx || 0, opts.totalSlides, spanBg.fit);
  } else if (image) {
    drawImageFit(ctx, image, -bleed, -bleed, w + bleed * 2, h + bleed * 2, fit, palette.bg);
  }
  // 'text' placement: spanning bg strip behind the bottom text band — bleeds bottom
  if (spanBg && spanPlacement === 'text') {
    const bandTop = h * 0.55;
    drawCarouselBackground(ctx, -bleed, bandTop, w + bleed * 2, h - bandTop + bleed,
      spanBg.image, opts.slideIdx || 0, opts.totalSlides, spanBg.fit);
  }

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(19,19,16,0.05)');
  grad.addColorStop(0.45, 'rgba(19,19,16,0.15)');
  grad.addColorStop(1, 'rgba(19,19,16,0.78)');
  ctx.fillStyle = grad;
  ctx.fillRect(-bleed, -bleed, w + bleed * 2, h + bleed * 2);

  const overlayPalette = { bg: BRAND.coal, ink: BRAND.bone00, muted: BRAND.cream100, accent, mode: 'dark' };
  const overlaySafeArea = { x: 0, y: 0, w, h };
  const clearance = brandBarClearance(ctx, frame, { ...opts, safeArea: overlaySafeArea });
  const textBottomY = Math.min(h - padY * 1.7, clearance.bottomY);
  // Intelligent text colour — same idea as the wordmark auto-contrast. The
  // image + darkening gradient are already painted, so sample the actual pixels
  // behind the lower text band and flip the whole text block to ink or bone for
  // legibility. A user-set backdrop already guarantees contrast, so skip then.
  if (!opts.textBackdrop?.enabled) {
    const bandTop = Math.min(textBottomY, h * 0.5);
    const lum = sampleCanvasLuminance(ctx, padX, bandTop, w - padX * 2, Math.max(1, textBottomY - bandTop));
    if (lum > 145) { overlayPalette.ink = BRAND.ink; overlayPalette.muted = BRAND.ink600; overlayPalette.mode = 'light'; }
    else           { overlayPalette.ink = BRAND.bone00; overlayPalette.muted = BRAND.cream100; overlayPalette.mode = 'dark'; }
  }
  // Bottom-anchored: the block grows UPWARD from textBottomY, so its budget is the
  // distance back up to the top clearance.
  const oFrame = { ...frame, textMaxH: Math.max(80, textBottomY - clearance.topY - padY * 1.2), fitOut: opts.fitOut, textOverflow: opts.textOverflow };
  drawTextBackdropOnly(ctx, content, padX, textBottomY, w - padX * 2, overlayPalette, accent, oFrame, 'bottom', opts.textBackdrop);
  if (!opts.skipOverlays) drawTextBlock(ctx, content, padX, textBottomY, w - padX * 2, overlayPalette, accent, oFrame, 'bottom', null);
  if (!opts.skipOverlays) drawBrandBar(ctx, frame, overlayPalette, accent, true, opts);
  if (!opts.skipOverlays) drawQrOverlay(ctx, frame, opts.qr, opts.qrImage, overlayPalette);
  drawPartnerLogos(ctx, frame, opts.partners, overlayPalette);
  drawGroupLockup(ctx, frame, opts.group, overlayPalette, opts.surface);
}

// Build the list of drawable text "tokens" for a content block. Each token
// includes its baseline x/y in canvas pixels, font family, weight, size,
// colour, letter-spacing, and (for tracked/uppercased lines) the rendered
// character sequence. Used by BOTH canvas and PDF renderers so they're
// pixel-identical.
// ─── Structured body rows (agendas & fact blocks) ────────────────────────────
// "09.15  Session title — Faculty" or "Date Friday, Nov 29" lines render as a
// two-column row grid (mono time/label column + hanging-indent content) instead
// of reflowed prose. Detection: most lines start with a time or a known label.
const ROW_PARTIAL_TIME_RE = /^\d{1,2}[.:]?\d{0,2}$/; // a time still being typed
const ROW_TIME_RE = /^(\d{1,2}[.:]\d{2}(?:\s*[\u2013\u2014-]\s*\d{1,2}[.:]\d{2})?)(?:\s+(.+))?$/;
const ROW_LABEL_RE = /^(date|time|venue|room|location|faculty|datum|zeit|ort|raum|fakult\u00e4t|fecha|hora|sala|lugar)\s*:?\s+(.+)$/i;
function parseStructuredRows(lines) {
  const rows = lines.map((l) => {
    // Explicit "LABEL\tvalue" from the fact-block editor — supports ANY custom
    // label (not just the known set below), rendered as the gold label column.
    if (l.includes('\t')) {
      const ti = l.indexOf('\t');
      const lab = l.slice(0, ti).trim();
      const val = l.slice(ti + 1).trim();
      if (lab) return { col: lab.toUpperCase(), main: val, note: null };
    }
    // A lone (possibly partial) time — a row still being typed, or an end
    // marker — keeps the time-column treatment from the first keystroke.
    if (ROW_PARTIAL_TIME_RE.test(l)) return { col: l, main: '', note: null };
    let m = l.match(ROW_TIME_RE);
    if (m) {
      if (!m[2]) return { col: m[1], main: '', note: null };
      // Only treat the trailing em-dash segment as faculty when it clearly
      // names a person (Prof./PD/Dr./initials) — titles may contain dashes too.
      const parts = m[2].split(/\s+\u2014\s+|\s+\u2013\s+/);
      const last = parts[parts.length - 1];
      const isPerson = parts.length > 1 && (/^(prof|pd|dr|univ|mr|ms|mrs)\b/i.test(last) || /^[A-Z\u00c4\u00d6\u00dc]\.\s*[A-Z\u00c4\u00d6\u00dc]/.test(last));
      return isPerson
        ? { col: m[1], main: parts.slice(0, -1).join(' \u2014 '), note: last }
        : { col: m[1], main: m[2], note: null };
    }
    m = l.match(ROW_LABEL_RE);
    if (m) return { col: m[1].toUpperCase(), main: m[2], note: null };
    return null;
  });
  const matched = rows.filter(Boolean).length;
  if (matched >= 2 && matched >= lines.length * 0.6) {
    return lines.map((l, i) => rows[i] ?? { col: '', main: l, note: null });
  }
  return null;
}

// ─── Agenda row editor ────────────────────────────────────────────────────────
// Structured editing for the agenda-flyer body (like Cadence's intake tables):
// time / title / faculty columns with add/remove/reorder. The body STRING stays
// the source of truth (presets, deep links and PDF export are untouched) — this
// is just a friendlier way to write it than a raw textarea.
// A steerable page break: a marker line in the body. The user inserts/moves/removes
// these in the agenda editor to control exactly where each printed page ends.
const PAGE_BREAK = '<<<PAGEBREAK>>>';

// Split a content object into pages at PAGE_BREAK markers. Page 1 keeps the header
// (eyebrow/headline/subline); later pages are body-only; the CTA lands on the last.
// Returns null when there are no breaks (single page).
function splitAgendaPages(content) {
  const raw = (content && content.body) || '';
  if (!raw.includes(PAGE_BREAK)) return null;
  const chunks = raw.split(PAGE_BREAK).map((s) => s.replace(/^\n+|\n+$/g, '').trim()).filter(Boolean);
  if (chunks.length < 2) return null;
  return chunks.map((body, i) => i === 0
    ? { ...content, body, cta: chunks.length === 1 ? content.cta : '' }
    : { eyebrow: '', headline: '', subline: '', body, cta: i === chunks.length - 1 ? (content.cta || '') : '' });
}

function parseAgendaBody(body) {
  return (body || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    if (l === PAGE_BREAK) return { pagebreak: true };
    if (ROW_PARTIAL_TIME_RE.test(l)) return { time: l, title: '', faculty: '' };
    const m = l.match(ROW_TIME_RE);
    // A no-time ALL-CAPS line is a section divider ("HALLUX VALGUS 1").
    if (!m) return { time: '', title: l, faculty: '', section: l === l.toUpperCase() && /[A-ZÀ-Ý]/.test(l) };
    if (!m[2]) return { time: m[1], title: '', faculty: '' };
    const parts = m[2].split(/\s+\u2014\s+|\s+\u2013\s+/);
    const last = parts[parts.length - 1];
    const isPerson = parts.length > 1 && (/^(prof|pd|dr|univ|mr|ms|mrs)\b/i.test(last) || /^[A-Z\u00c4\u00d6\u00dc]\.\s*[A-Z\u00c4\u00d6\u00dc]/.test(last));
    return isPerson
      ? { time: m[1], title: parts.slice(0, -1).join(' \u2014 '), faculty: last }
      : { time: m[1], title: m[2], faculty: '' };
  });
}
function serializeAgendaRows(rows) {
  return rows
    .filter((r) => r.pagebreak || r.time || r.title || r.faculty)
    .map((r) => r.pagebreak ? PAGE_BREAK : `${r.time ? r.time + '  ' : ''}${r.title}${r.faculty ? ' \u2014 ' + r.faculty : ''}`)
    .join('\n');
}
// House time format: always HH.MM with a DOT (Swiss convention — matches the
// existing collateral). Accepts ".", ":" or bare digits; empty becomes 00.00;
// ranges ("12.30 - 13.30") normalize part-wise with an en dash.
function normalizeTimeToken(tok) {
  let h, m;
  const divided = tok.match(/^\s*(\d{1,2})\s*[.:]\s*(\d{0,2})\s*$/);
  if (divided) {
    // Explicit divider wins: "14:3" was heading for 14.30, "14:03" stays 14.03.
    h = divided[1];
    m = (divided[2] || '').padEnd(2, '0') || '00';
  } else {
    const digits = tok.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.length <= 2) { h = digits; m = '00'; }
    else if (digits.length === 3) { h = digits.slice(0, 1); m = digits.slice(1); }
    else { h = digits.slice(0, 2); m = digits.slice(2, 4); }
  }
  const hh = Math.min(23, parseInt(h, 10) || 0);
  const mm = Math.min(59, parseInt(m, 10) || 0);
  return String(hh).padStart(2, '0') + '.' + String(mm).padStart(2, '0');
}
function normalizeTime(raw) {
  const t = (raw || '').trim();
  if (!t) return '00.00';
  const parts = t.split(/\s*[\u2013\u2014-]\s*/).map(normalizeTimeToken).filter(Boolean);
  return parts.length ? parts.join(' \u2013 ') : '00.00';
}

function AgendaEditor({ value, onChange }) {
  // Local row state — the serialized string round-trip TRIMS lines, so deriving
  // rows from `value` on every render ate trailing spaces while typing. Rows
  // re-seed only when the value changes externally (preset load / deep link).
  const [rows, setRows] = useState(() => {
    const parsed = parseAgendaBody(value);
    return parsed.length ? parsed : [{ time: '', title: '', faculty: '' }];
  });
  const lastEmitted = useRef(value);
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      const parsed = parseAgendaBody(value);
      setRows(parsed.length ? parsed : [{ time: '', title: '', faculty: '' }]);
    }
  }, [value]);
  const commit = (next) => {
    setRows(next);
    const serialized = serializeAgendaRows(next);
    lastEmitted.current = serialized;
    onChange(serialized);
  };
  const update = (i, key, v) => commit(rows.map((r, ri) => (ri === i ? { ...r, [key]: v } : r)));
  const remove = (i) => commit(rows.filter((_, ri) => ri !== i));
  // "Pin times": an agenda's time grid is usually fixed — reordering should move
  // the CONTENT between slots, not drag the times out of chronological order.
  // Off = the whole row (incl. its time) moves.
  const [pinTimes, setPinTimes] = useState(true);
  const [hoverGap, setHoverGap] = useState(-1);
  const move = (i, d) => {
    const to = i + d;
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    // Section/break rows always move whole (content-swap only makes sense for sessions).
    const special = next[i].section || next[i].pagebreak || next[to].section || next[to].pagebreak;
    if (pinTimes && !special) {
      const a = next[i], b = next[to];
      next[i] = { ...a, title: b.title, faculty: b.faculty };
      next[to] = { ...b, title: a.title, faculty: a.faculty };
    } else {
      [next[i], next[to]] = [next[to], next[i]];
    }
    commit(next);
  };
  // Row factories + insert-anywhere: a session, section or page break can be added
  // before or after any row via the thin bar between rows (and at the ends).
  const sessionRow = () => ({ time: '', title: '', faculty: '' });
  const sectionRow = () => ({ time: '', title: '', faculty: '', section: true });
  const breakRow = () => ({ pagebreak: true });
  const insertAt = (i, row) => commit([...rows.slice(0, i), row, ...rows.slice(i)]);
  // Time small, SESSION biggest (the content), faculty medium, controls tight.
  const GRID = 'minmax(44px,52px) minmax(0,1fr) minmax(0,0.62fr) 44px';
  const cell = { fontSize: 12, padding: '5px 7px', border: `1px solid ${BRAND.ink100}`, background: '#fff', width: '100%', boxSizing: 'border-box', minWidth: 0 };
  const iconBtn = { border: 'none', background: 'transparent', cursor: 'pointer', color: BRAND.ink300, fontSize: 12, padding: '1px 3px' };
  const insBtn = { border: `1px solid ${BRAND.ink100}`, background: '#fff', cursor: 'pointer', fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.05em', color: BRAND.ink600, padding: '2px 8px', borderRadius: 3, lineHeight: 1.6 };
  // A quiet hairline between rows; hovering it reveals the insert options — so the list
  // stays scannable instead of being interrupted by three buttons on every gap.
  const renderInsert = (at) => (
    <div
      onMouseEnter={() => setHoverGap(at)}
      onMouseLeave={() => setHoverGap((g) => (g === at ? -1 : g))}
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: hoverGap === at ? 26 : 11, cursor: 'pointer' }}
    >
      {hoverGap === at ? (
        <div style={{ display: 'flex', gap: 5 }}>
          <button style={insBtn} title="Insert session here" onClick={() => insertAt(at, sessionRow())}>+ row</button>
          <button style={{ ...insBtn, color: BRAND.gold, borderColor: BRAND.gold }} title="Insert section title here" onClick={() => insertAt(at, sectionRow())}>+ section</button>
          <button style={{ ...insBtn, color: BRAND.gold, borderColor: BRAND.gold }} title="Insert page break here" onClick={() => insertAt(at, breakRow())}>+ break</button>
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%', borderTop: `1px solid ${BRAND.ink100}`, opacity: 0.45 }}>
          <span style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', background: BRAND.bone00, color: BRAND.ink300, fontSize: 12, lineHeight: '16px', padding: '0 6px' }}>+</span>
        </div>
      )}
    </div>
  );
  const rowEl = (r, i) => {
    const controls = (
      <span style={{ whiteSpace: 'nowrap' }}>
        <button style={iconBtn} title="Move up" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
        <button style={iconBtn} title="Move down" onClick={() => move(i, 1)} disabled={i === rows.length - 1}>↓</button>
        <button style={{ ...iconBtn, color: '#e11d48' }} title="Remove" onClick={() => remove(i)}>✕</button>
      </span>
    );
    if (r.pagebreak) return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px', gap: 4, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: `1px dashed ${BRAND.gold}`, paddingTop: 6, fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.14em', color: BRAND.gold }}>⎯⎯ PAGE BREAK ⎯⎯</div>
        {controls}
      </div>
    );
    if (r.section) return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px', gap: 4, alignItems: 'center' }}>
        <input style={{ ...cell, fontFamily: BRAND.display, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: BRAND.gold }} value={r.title} placeholder="SECTION (e.g. HALLUX VALGUS 1)" onChange={(e) => update(i, 'title', e.target.value)} />
        {controls}
      </div>
    );
    return (
      <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 4, alignItems: 'center' }}>
        <input style={{ ...cell, fontFamily: BRAND.mono }} value={r.time} placeholder="09.15" onChange={(e) => update(i, 'time', e.target.value)} onBlur={() => update(i, 'time', normalizeTime(r.time))} />
        <input style={cell} value={r.title} placeholder="Session title" onChange={(e) => update(i, 'title', e.target.value)} />
        <input style={cell} value={r.faculty} placeholder="Faculty" onChange={(e) => update(i, 'faculty', e.target.value)} />
        {controls}
      </div>
    );
  };
  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.1em', color: BRAND.ink600, cursor: 'pointer' }}
             title="On: moving a session up/down swaps the content between time slots — the time grid stays chronological. Off: the whole row moves, time included.">
        <input type="checkbox" checked={pinTimes} onChange={(e) => setPinTimes(e.target.checked)} />
        KEEP TIMES IN PLACE WHEN REORDERING
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 4, marginBottom: 2, fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.1em', color: BRAND.ink300 }}>
        <span>TIME</span><span>SESSION</span><span>FACULTY</span><span />
      </div>
      {rows.map((r, i) => (
        <div key={i}>
          {renderInsert(i)}
          {rowEl(r, i)}
        </div>
      ))}
      {renderInsert(rows.length)}
    </div>
  );
}

// ─── Fact-block editor (invitation / save-the-date) ──────────────────────────
// The fact block renders as "LABEL  value" rows (Date / Time / Venue …). Editing
// it as one textarea where every line must be prefixed with its label is a trap —
// people retype the label into the value ("Date Date and time to be confirmed").
// This gives each row an explicit LABEL field and VALUE field, so the value holds
// ONLY the value. The body STRING stays the source of truth (presets/PDF untouched).
const FACT_LABELS = ['Date', 'Time', 'Venue', 'Location', 'Room', 'Faculty', 'Registration', 'Contact'];
const FACT_SEP = '\t'; // label/value separator in the body — lets ANY custom label render as a label
function parseFactRows(value) {
  const lines = (value || '').split('\n');
  const rows = lines.map((l) => {
    if (l.includes(FACT_SEP)) {
      const i = l.indexOf(FACT_SEP);
      return { label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() };
    }
    const t = l.trim();
    if (!t) return null;
    const m = t.match(ROW_LABEL_RE); // legacy: known label + space (Cadence / older presets)
    if (m) {
      const label = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
      return { label, value: m[2] };
    }
    return { label: '', value: t };
  }).filter(Boolean);
  return rows.length ? rows : [{ label: 'Date', value: '' }];
}
function serializeFactRows(rows) {
  return rows
    .map((r) => {
      const v = (r.value || '').trim();
      const lab = (r.label || '').trim();
      // Tab-separate label from value so a custom label is unambiguous to the
      // renderer; an unlabelled row is just the value.
      return lab ? `${lab}${FACT_SEP}${v}` : v;
    })
    .filter((l) => l.replace(FACT_SEP, '').length) // drop fully-empty rows
    .join('\n');
}
let FACT_ROW_SEQ = 0;
const withRowIds = (rows) => rows.map((r) => ({ id: r.id ?? ++FACT_ROW_SEQ, label: r.label || '', value: r.value || '' }));
function FactBlockEditor({ value, onChange }) {
  // Rows live in LOCAL state so each field is preserved verbatim while typing.
  // The body string round-trip is lossy for empty/partial rows (a labelled row
  // with a blank value would collapse and its label would leak into the field
  // next to it) — so we serialise OUTWARD only, and re-parse the incoming value
  // just for EXTERNAL changes (template switch / preset load), ignoring our echo.
  const [rows, setRows] = useState(() => withRowIds(parseFactRows(value)));
  const lastEmit = useRef(null);
  useEffect(() => {
    if (value === lastEmit.current) return;
    setRows(withRowIds(parseFactRows(value)));
  }, [value]);
  const commit = (next) => {
    setRows(next);
    const s = serializeFactRows(next);
    lastEmit.current = s;
    onChange(s);
  };
  const cell = { fontSize: 12, padding: '6px 8px', border: `1px solid ${BRAND.ink100}`, background: '#fff', width: '100%', boxSizing: 'border-box', minWidth: 0 };
  const iconBtn = { border: 'none', background: 'transparent', cursor: 'pointer', color: BRAND.ink300, fontSize: 12, padding: '1px 3px' };
  const update = (i, key, v) => { const a = rows.map((r) => ({ ...r })); a[i][key] = v; commit(a); };
  const move = (i, d) => { const a = rows.map((r) => ({ ...r })); const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; commit(a); };
  const remove = (i) => commit(rows.filter((_, k) => k !== i));
  const add = () => commit(withRowIds([...rows, { label: FACT_LABELS.find((l) => !rows.some((r) => r.label === l)) || '', value: '' }]));
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(84px,0.5fr) minmax(0,1fr) 44px', gap: 4, marginBottom: 3, fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.1em', color: BRAND.ink300 }}>
        <span>LABEL</span><span>VALUE</span><span />
      </div>
      {rows.map((r, i) => (
        <div key={r.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(84px,0.5fr) minmax(0,1fr) 44px', gap: 4, alignItems: 'center', marginBottom: 4 }}>
          <input list="factlabels" style={{ ...cell, fontFamily: BRAND.mono, textTransform: 'uppercase', color: BRAND.gold, letterSpacing: '0.04em' }}
                 value={r.label} placeholder="Type custom or pick…" title="Type any custom label, or pick a common one from the list"
                 onChange={(e) => update(i, 'label', e.target.value)} />
          <input style={cell} value={r.value} placeholder="e.g. Friday, 29 Nov 2026" onChange={(e) => update(i, 'value', e.target.value)} />
          <span style={{ whiteSpace: 'nowrap' }}>
            <button style={iconBtn} title="Move up" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
            <button style={{ ...iconBtn, color: '#e11d48' }} title="Remove" onClick={() => remove(i)}>✕</button>
          </span>
        </div>
      ))}
      <datalist id="factlabels">{FACT_LABELS.map((l) => <option key={l} value={l} />)}</datalist>
      <button onClick={add} style={{ marginTop: 2, border: `1px solid ${BRAND.ink100}`, background: '#fff', cursor: 'pointer', fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.08em', color: BRAND.ink600, padding: '4px 10px', borderRadius: 3, textTransform: 'uppercase' }}>+ Add row</button>
      <div style={{ fontSize: 9.5, color: BRAND.ink300, fontFamily: BRAND.mono, marginTop: 6, lineHeight: 1.5 }}>
        Label shows in gold — type any custom label or pick one, or leave it blank for an unlabelled line. The value holds only the value; don't repeat the label.
      </div>
    </div>
  );
}

// ── TYPE SYSTEM — one modular scale for every text role ──────────────
// Sizes are a fraction of the canvas short side (`base`), so a role scales
// with the canvas. A format's CATEGORY tunes two knobs — the body size (the
// anchor the other roles step off) and the modular `ratio` — plus a headline
// cap/floor. Tuning is driven by physical read distance:
//   poster  — read across a room → big type, big steps
//   card    — read in the hand   → proportionally big type, gentle steps
//   paged   — dense A4/A5 flyers & programmes → smaller type so many lines fit
//   social  — phone feed         → generous type
//   digital — screens / email    → middle ground
// The px floors keep tiny canvases legible; the headline stays dominant because
// it is capped near the short-side fraction, not derived from the body step.
const TYPE_CATEGORIES = {
  poster:  { body: 0.0230, ratio: 1.33, headlineCap: 0.115, headlineFloor: 0.060 },
  paged:   { body: 0.0175, ratio: 1.26, headlineCap: 0.082, headlineFloor: 0.042 },
  card:    { body: 0.0320, ratio: 1.20, headlineCap: 0.110, headlineFloor: 0.058 },
  social:  { body: 0.0280, ratio: 1.25, headlineCap: 0.100, headlineFloor: 0.052 },
  digital: { body: 0.0220, ratio: 1.25, headlineCap: 0.082, headlineFloor: 0.044 },
};

function formatCategory(formatKey) {
  const fmt = FORMATS[formatKey] || {};
  // A custom format carries its category explicitly — geometry alone cannot tell
  // a 90x50 business card from a 90x50 badge, and the two want different type.
  if (fmt.typeCategory) return fmt.typeCategory;
  const g = fmt.group || '';
  // A6 postcard & business card are held close — treat them as "card" scale.
  if (formatKey === 'business-card' || formatKey === 'postcard-a6') return 'card';
  if (g.startsWith('Print · poster')) return 'poster';
  if (g.startsWith('Print · paged')) return 'paged';
  if (g.startsWith('Print · brochure')) return 'paged';     // an A4 brochure IS a page
  if (g.startsWith('Print · wearables')) return 'poster';   // a strap is read at distance
  if (g.startsWith('Digital')) return 'digital';
  // EVERY PRINT GROUP MUST BE NAMED ABOVE.
  // This catch-all used to swallow 'Print · brochure' and 'Print · wearables',
  // and the cost was not a slightly-off type scale: LOGO_SHORT_PCT has no
  // `social` key, so defaultWordmarkShortFrac took its ELSE branch and DISCARDED
  // the format's declared wmPct entirely —
  //
  //     brochure-a4   asked 46.2 mm  →  rendered 27.3 mm
  //     lanyard-20    asked 11.0 mm  →  rendered  2.6 mm   (a quarter of it)
  //
  // Every brochure and strap shipped with the mark under the guide's minimum. No
  // error, no warning: a fall-through that is correct for the case you were
  // thinking about and silently wrong for the two you were not.
  //
  // The guard is below — a print format that reaches this line is a bug.
  if (import.meta.env?.DEV && g.startsWith('Print')) {
    console.warn(`[format] "${formatKey}" (${g}) fell through to 'social'. Print groups must be named in formatCategory — the declared wmPct is otherwise discarded.`);
  }
  return 'social';
}

function computeTypeScale(frame) {
  const base = Math.min(frame.w, frame.h);
  const cat = TYPE_CATEGORIES[formatCategory(frame.formatKey)] || TYPE_CATEGORIES.social;
  const B = base * cat.body;            // body size — the modular anchor
  const step = (n) => B * Math.pow(cat.ratio, n);
  return {
    gridUnit:     Math.max(4, Math.round(base * 0.008)),
    eyebrowSize:  Math.max(11, step(-1)),
    ctaSize:      Math.max(11, step(-1)),
    bodySize:     Math.max(12, step(0)),
    sublineSize:  Math.max(14, step(1)),
    headlineMax:  Math.max(34, base * cat.headlineCap),
    headlineMin:  Math.max(20, base * cat.headlineFloor),
  };
}

// ═══ TRACKED LABELS MUST FIT THEIR COLUMN ════════════════════════════
// The headline, subline and body are wrapped to the measure by wrapText. The
// eyebrow and the CTA were not: they were emitted as ONE tracked token that
// ignored the column width entirely — no wrap, no fit, no clamp. And the
// shrink-to-fit that exists governs HEIGHT, so nothing ever looked at their width.
//
// Measured on a 1080 square, my own defaults:
//
//     column                       label                          width
//     full width      929 px       "MEDARTIS FELLOWSHIP · …"      538 px   fits
//     split-left/right 389 px      the same label                 538 px   +38%
//     duo cell        449 px       the same label                 538 px   +20%
//
// That is why it survived: it is invisible on whatever format you happen to be
// testing, and it throws nothing. IBRA hit it from both sides — the label running
// under the photograph on one, and clipped mid-word at the canvas edge on the other.
//
// THE FIX IS NOT TO WRAP FIRST. An eyebrow is a LABEL; a label that wraps reads as
// a sentence that has gone wrong. So shrink to the measure — tracking included —
// and wrap only when even the floor cannot fit, because a two-line label still
// beats one running under a photograph. It breaks on the middot first: "APPLY NOW ·
// MEDARTIS.COM/…" is two thoughts, and that is the break a designer would choose.

function trackedWidth(ctx, text, size, weight, family, trackFrac) {
  ctx.font = `${weight} ${size}px ${family}`;
  const ls = size * trackFrac;
  let x = 0;
  for (const ch of text) x += ctx.measureText(ch).width + ls;
  // The tracking after the LAST glyph is not part of the drawn width — including
  // it is the classic off-by-one that makes a tracked string measure too wide.
  return Math.max(0, x - ls);
}

/**
 * Fit a tracked label to `maxW`. Returns { size, lines } — usually one line.
 * `floor` is a fraction of the label's own size, not an absolute: an eyebrow that
 * has already been shrunk by the block-level scale should not be shrunk twice as
 * hard.
 */
function fitTracked(ctx, text, maxW, size, weight, family, trackFrac, floor = 0.62) {
  const minSize = Math.max(8, size * floor);
  let s = size;
  while (s > minSize && trackedWidth(ctx, text, s, weight, family, trackFrac) > maxW) {
    s *= 0.94;
  }
  // The loop tests the floor BEFORE it multiplies, so the last step overshoots it:
  // at 20px with a 0.62 floor it stops at 12.18, not 12.40. Small, and it is the
  // difference between a floor that holds and a floor that is a suggestion — the
  // whole point of the floor is that below it a label is no longer readable.
  // (Found by the test, in code I had just ported. A guard that does not guard is
  // worse than no guard: you stop looking.)
  s = Math.max(s, minSize);
  if (trackedWidth(ctx, text, s, weight, family, trackFrac) <= maxW) return { size: s, lines: [text] };

  // Still too wide at the floor. Wrap on the separators a label actually has —
  // the middot first, because "APPLY NOW · MEDARTIS.COM/FELLOWSHIP" is two thoughts
  // and breaking it there is the break a designer would choose.
  const parts = text.includes(' · ') ? text.split(' · ') : text.split(' ');
  const joiner = text.includes(' · ') ? ' · ' : ' ';
  const lines = [];
  let cur = '';
  for (const word of parts) {
    const next = cur ? cur + joiner + word : word;
    if (cur && trackedWidth(ctx, next, s, weight, family, trackFrac) > maxW) {
      lines.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return { size: s, lines };
}

/**
 * Draw a tracked label, fitted to `maxW`. Returns the height it used, because the
 * caller's cursor has to know when a label wrapped to two lines.
 *
 * The table/stat/duo layouts each drew their own labels with a bare per-char
 * loop and no measure — the same bug the split layouts had, just not yet
 * triggered because their columns are full-width. Latent is not fixed.
 */
function drawTrackedFit(ctx, text, x, baselineY, maxW, size, weight, family, trackFrac, color) {
  const fit = fitTracked(ctx, text, maxW, size, weight, family, trackFrac);
  ctx.font = `${weight} ${fit.size}px ${family}`;
  ctx.fillStyle = color;
  const ls = fit.size * trackFrac;
  let ly = baselineY;
  for (const line of fit.lines) {
    let cx = x;
    for (const ch of line) { ctx.fillText(ch, cx, ly); cx += ctx.measureText(ch).width + ls; }
    ly += fit.size * 1.34;
  }
  return { size: fit.size, lines: fit.lines.length, extra: (fit.lines.length - 1) * fit.size * 1.34 };
}

function layoutTextElements(ctx, content, x, y, w, palette, accent, frame, anchor = 'top', scale = 1) {
  const ts0 = computeTypeScale(frame);
  // SHRINK-TO-FIT. The type scale says how big the type WANTS to be; the band says
  // how much room it HAS. Without this the block simply overflows — on a square
  // format the body runs straight under the image, which is exactly the bug in the
  // starting layout. The scale gives way, never the layout.
  const ts = {
    ...ts0,
    eyebrowSize:  ts0.eyebrowSize * scale,
    headlineMax:  ts0.headlineMax * scale,
    headlineMin:  ts0.headlineMin * scale,
    sublineSize:  ts0.sublineSize * scale,
    bodySize:     ts0.bodySize * scale,
    ctaSize:      ts0.ctaSize * scale,
  };
  const baseSize = Math.min(frame.w, frame.h);
  // Baseline grid: every element baseline snaps to a multiple of `gridUnit` so
  // vertical rhythm is identical across templates/formats. (From the type scale.)
  const gridUnit = ts.gridUnit;
  const snap = (v) => Math.round(v / gridUnit) * gridUnit;

  // Text roles come from ONE modular scale, tuned per format category — see
  // computeTypeScale / TYPE_CATEGORIES. Supporting roles (eyebrow/body/subline/
  // cta) step off the body size by a fixed ratio; the headline is governed by a
  // category cap+floor and then shrunk-to-fit by fitFont below.
  const eyebrowSize = ts.eyebrowSize;
  const headlineMax = ts.headlineMax;
  const headlineMin = ts.headlineMin;
  const sublineSize = ts.sublineSize;
  const bodySize    = ts.bodySize;
  const ctaSize     = ts.ctaSize;

  const blocks = [];
  if (content.eyebrow) {
    // Fitted HERE, not at draw time: a label measured as one line and drawn as two
    // puts every block beneath it in the wrong place.
    const fit = fitTracked(ctx, content.eyebrow.toUpperCase(), w, eyebrowSize, 500, BRAND.mono, 0.16);
    blocks.push({ type: 'eyebrow', text: content.eyebrow, size: fit.size, lines: fit.lines });
  }
  if (content.headline) {
    ctx.font = `700 ${headlineMax}px ${BRAND.display}`;
    const fitSize = fitFont(ctx, content.headline.split('\n')[0], w, headlineMax, headlineMin, 700);
    ctx.font = `700 ${fitSize}px ${BRAND.display}`;
    const lines = content.headline.split('\n').flatMap(l => wrapText(ctx, l, w));
    blocks.push({ type: 'headline', lines, size: fitSize });
  }
  if (content.subline) {
    ctx.font = `300 ${sublineSize}px ${BRAND.display}`;
    blocks.push({ type: 'subline', lines: wrapText(ctx, content.subline, w), size: sublineSize });
  }
  if (content.body) {
    // Never render a PAGE_BREAK marker as text (defensive — pages are split upstream).
    const rawLines = content.body.split('\n').map((l) => l.trim()).filter((l) => l && l !== PAGE_BREAK);
    const structured = parseStructuredRows(rawLines);
    if (structured) {
      // Column width from the widest mono col text (time or label) + gutter.
      const colSize = bodySize * 0.92;
      ctx.font = `500 ${colSize}px ${BRAND.mono}`;
      const colW = Math.max(...structured.map((r) => ctx.measureText(r.col).width), 0) + bodySize * 1.4;
      const textW = Math.max(60, w - colW);
      ctx.font = `500 ${bodySize}px ${BRAND.display}`;
      // A row with no time column whose text is ALL-CAPS is a SECTION divider
      // (e.g. "HALLUX VALGUS 1") — rendered gold, spaced, not as a session line.
      const rows = structured.map((r) => {
        const section = !r.col && !!r.main && r.main === r.main.toUpperCase() && /[A-ZÀ-Ý]/.test(r.main);
        return { ...r, section, titleLines: wrapText(ctx, r.main, section ? w : textW) };
      });
      const lineCount = rows.reduce((n, r) => n + r.titleLines.length, 0);
      const sectionCount = rows.filter((r) => r.section).length;
      const estH = lineCount * bodySize * 1.18 + rows.length * bodySize * 0.6 + sectionCount * bodySize * 0.9;
      blocks.push({ type: 'rows', rows, colW, colSize, size: bodySize, estH });
    } else {
      ctx.font = `400 ${bodySize}px ${BRAND.display}`;
      blocks.push({ type: 'body', lines: rawLines.flatMap((l) => wrapText(ctx, l, w)), size: bodySize });
    }
  }
  if (content.cta) {
    const fit = fitTracked(ctx, content.cta.toUpperCase(), w, ctaSize, 500, BRAND.mono, 0.08);
    blocks.push({ type: 'cta', text: content.cta, size: fit.size, lines: fit.lines });
  }

  const gaps = { eyebrow: 0.9, headline: 0.55, subline: 0.65, body: 0.85, cta: 1.0 };
  let totalH = 0;
  blocks.forEach((el, i) => {
    if (el.estH) totalH += el.estH;
    // A tracked label that wrapped is two lines tall; before the fit it was always
    // counted as one, so the block beneath it landed on top of the second line.
    else if (el.type === 'eyebrow' || el.type === 'cta') totalH += el.lines.length * el.size * 1.34;
    else if (el.lines) totalH += el.lines.length * el.size * 1.18;
    else totalH += el.size * 1.2;
    if (i < blocks.length - 1) totalH += el.size * (gaps[el.type] ?? gaps.body);
  });
  // ── WHAT HAPPENS AT THE FLOOR ────────────────────────────────────────────
  // The block re-lays 7% smaller until it fits, which is right. But the loop used
  // to stop at 55% and then simply LET GO: past that floor the copy spilled over
  // the image, through the mark's clear space, off the canvas. Silently.
  //
  //      9 words → fits @100%    144 words → fits @52%
  //     36 words → fits @86%     288 words → OVERFLOWED by ~325px, unannounced
  //
  // Nobody chose that. It is just where the loop gave up. So the floor now has
  // three named outcomes and you pick one — see TEXT_OVERFLOW in § 05.
  const maxH = frame.textMaxH;
  const mode = frame.textOverflow ?? 'trim';
  const floor = mode === 'shrink' ? 0.28 : 0.55;

  if (maxH && totalH > maxH && scale > floor) {
    return layoutTextElements(ctx, content, x, y, w, palette, accent, frame, anchor, scale * 0.93);
  }

  // At the floor and still too tall. `trim` is the only mode that acts.
  let trimmed = false;
  if (maxH && totalH > maxH && mode === 'trim') {
    // Drop trailing BODY lines first — the body is the only block written to be
    // shortened. Losing a headline or a CTA to make room is not trimming, it is
    // deleting the message, so those are never touched.
    const bodyEl = [...blocks].reverse().find((b) => b.type === 'body' && b.lines?.length > 1);
    if (bodyEl) {
      while (totalH > maxH && bodyEl.lines.length > 1) {
        bodyEl.lines.pop();
        totalH -= bodyEl.size * 1.18;
        trimmed = true;
      }
      if (trimmed) {
        const last = bodyEl.lines[bodyEl.lines.length - 1].replace(/[\s,;:.\u2014-]+$/, '');
        bodyEl.lines[bodyEl.lines.length - 1] = last + '\u2026';
      }
    }
  }
  // Report what actually happened. Hitting the floor and STILL not fitting is not
  // something to swallow: the copy is too long for the band, and the only honest
  // move is to say so rather than quietly run the text under the image.
  if (frame.fitOut) {
    frame.fitOut.scale = scale;
    frame.fitOut.overflow = maxH ? Math.max(0, totalH - maxH) : 0;
    frame.fitOut.bandH = maxH || 0;
    frame.fitOut.trimmed = trimmed;   // so the panel can say "your copy was cut"
    frame.fitOut.mode = mode;
  }

  let cursorY = anchor === 'bottom' ? y - totalH : y;
  cursorY = snap(cursorY); // snap the starting point to the grid

  const tokens = [];
  const setMeasureFont = (weight, size, family) => { ctx.font = `${weight} ${size}px ${family}`; };
  // Advance cursor by a logical amount, then snap to baseline. Ensures every
  // element baseline sits on a multiple of gridUnit no matter how it's reached.
  const advance = (px) => { cursorY = snap(cursorY + px); };

  for (const el of blocks) {
    if (el.type === 'eyebrow') {
      const color = palette.mode === 'dark' ? BRAND.gold : BRAND.ink600;
      setMeasureFont(500, el.size, BRAND.mono);
      advance(el.size);
      // el.lines comes from fitTracked: one line almost always, two only when even
      // the floor could not hold it.
      el.lines.forEach((line, i) => {
        if (i) advance(el.size * 1.34);
        tokens.push({ type: 'tracked', text: line, x, y: cursorY, family: 'JetBrainsMono', weight: 500, size: el.size, color, letterSpacing: el.size * 0.16 });
      });
      advance(el.size * gaps.eyebrow);
    } else if (el.type === 'headline') {
      setMeasureFont(700, el.size, BRAND.display);
      for (const line of el.lines) {
        advance(el.size);
        tokens.push({ type: 'plain', text: line, x, y: cursorY, family: 'Inter', weight: 700, size: el.size, color: palette.ink });
        advance(el.size * 0.18);
      }
      advance(el.size * gaps.headline);
    } else if (el.type === 'subline') {
      setMeasureFont(300, el.size, BRAND.display);
      for (const line of el.lines) {
        advance(el.size);
        tokens.push({ type: 'plain', text: line, x, y: cursorY, family: 'Inter', weight: 300, size: el.size, color: palette.ink });
        advance(el.size * 0.2);
      }
      advance(el.size * gaps.subline);
    } else if (el.type === 'body') {
      setMeasureFont(400, el.size, BRAND.display);
      for (const line of el.lines) {
        advance(el.size);
        tokens.push({ type: 'plain', text: line, x, y: cursorY, family: 'Inter', weight: 400, size: el.size, color: palette.muted });
        advance(el.size * 0.35);
      }
      advance(el.size * gaps.body);
    } else if (el.type === 'rows') {
      const colColor = palette.mode === 'dark' ? BRAND.gold : BRAND.ink600;
      const sectionColor = palette.mode === 'dark' ? BRAND.gold : BRAND.ink600;
      for (const r of el.rows) {
        if (r.section) {
          // Section divider: extra breathing room above, gold, tracked caps.
          advance(el.size * 1.5);
          tokens.push({ type: 'tracked', text: r.main.toUpperCase(), x, y: cursorY, family: 'Inter', weight: 800, size: el.size * 0.92, color: sectionColor, letterSpacing: el.size * 0.05 });
          advance(el.size * 0.55);
          continue;
        }
        advance(el.size);
        if (r.col) tokens.push({ type: 'plain', text: r.col, x, y: cursorY, family: 'JetBrainsMono', weight: 500, size: el.colSize, color: colColor });
        r.titleLines.forEach((line, i) => {
          if (i > 0) advance(el.size * 1.18);
          tokens.push({ type: 'plain', text: line, x: x + el.colW, y: cursorY, family: 'Inter', weight: 500, size: el.size, color: palette.ink });
        });
        if (r.note) {
          // Faculty on the same line when it fits, otherwise its own muted line.
          setMeasureFont(500, el.size, BRAND.display);
          const lastLine = r.titleLines[r.titleLines.length - 1] ?? '';
          const lastW = ctx.measureText(lastLine).width;
          const noteSize = el.size * 0.95;
          setMeasureFont(400, noteSize, BRAND.display);
          const noteText = '\u2014 ' + r.note;
          const noteW = ctx.measureText(noteText).width;
          if (el.colW + lastW + el.size * 0.55 + noteW <= w) {
            tokens.push({ type: 'plain', text: noteText, x: x + el.colW + lastW + el.size * 0.55, y: cursorY, family: 'Inter', weight: 400, size: noteSize, color: palette.muted });
          } else {
            advance(el.size * 1.12);
            tokens.push({ type: 'plain', text: noteText, x: x + el.colW, y: cursorY, family: 'Inter', weight: 400, size: noteSize, color: palette.muted });
          }
        }
        advance(el.size * 0.6);
      }
      advance(el.size * (gaps.body - 0.6 > 0 ? gaps.body - 0.6 : 0.2));
    } else if (el.type === 'cta') {
      const color = palette.mode === 'dark' ? BRAND.cream100 : BRAND.ink600;
      setMeasureFont(500, el.size, BRAND.mono);
      advance(el.size);
      el.lines.forEach((line, i) => {
        if (i) advance(el.size * 1.34);
        tokens.push({ type: 'tracked', text: line, x, y: cursorY, family: 'JetBrainsMono', weight: 500, size: el.size, color, letterSpacing: el.size * 0.08 });
      });
      advance(el.size * gaps.cta);
    }
  }
  return tokens;
}

// Bounding rect that encloses all the layouted text tokens — used to size a
// frosted-glass / solid backdrop behind the text.
function textTokensBounds(ctx, tokens, padX, padY) {
  if (!tokens.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const t of tokens) {
    const family = t.family === 'JetBrainsMono' ? BRAND.mono : BRAND.display;
    ctx.font = `${t.weight} ${t.size}px ${family}`;
    let w;
    if (t.type === 'tracked') {
      w = 0;
      for (const ch of t.text) w += ctx.measureText(ch).width + (t.letterSpacing || 0);
    } else {
      w = ctx.measureText(t.text).width;
    }
    // baseline at t.y; approximate ascent ~ size * 0.85, descent ~ size * 0.18
    const top = t.y - t.size * 0.85;
    const bot = t.y + t.size * 0.18;
    if (t.x < minX) minX = t.x;
    if (top   < minY) minY = top;
    if (t.x + w > maxX) maxX = t.x + w;
    if (bot > maxY) maxY = bot;
  }
  return {
    x: minX - padX,
    y: minY - padY,
    w: (maxX - minX) + padX * 2,
    h: (maxY - minY) + padY * 2,
  };
}

// Draw just the backdrop (frosted/solid) for the text block, NOT the text itself.
// Called separately from drawTextBlock so that PDF vector mode (which skips the
// text canvas pass) can still get the backdrop composited into the image bitmap.
function drawTextBackdropOnly(ctx, content, x, y, w, palette, accent, frame, anchor, backdrop) {
  if (!backdrop || !backdrop.enabled) return;
  const tokens = layoutTextElements(ctx, content, x, y, w, palette, accent, frame, anchor);
  if (!tokens.length) return;
  const baseUnit = Math.min(frame.w, frame.h);
  const padInner = baseUnit * 0.025;
  const bounds = textTokensBounds(ctx, tokens, padInner, padInner * 0.6);
  if (!bounds) return;
  if (backdrop.type === 'solid') {
    ctx.save();
    ctx.fillStyle = backdrop.tint || (palette.mode === 'dark' ? 'rgba(19,19,16,0.6)' : 'rgba(255,255,255,0.7)');
    const r = Math.min(bounds.w, bounds.h) * 0.03;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(bounds.x, bounds.y, bounds.w, bounds.h, r);
      ctx.fill();
    } else {
      ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    }
    ctx.restore();
  } else {
    drawFrostedGlass(ctx, bounds.x, bounds.y, bounds.w, bounds.h, {
      blur: backdrop.blur ?? baseUnit * 0.025,
      tint: backdrop.tint || (palette.mode === 'dark' ? 'rgba(19,19,16,0.32)' : 'rgba(255,255,255,0.32)'),
      radius: Math.min(bounds.w, bounds.h) * 0.03,
    });
  }
}

function drawTextBlock(ctx, content, x, y, w, palette, accent, frame, anchor = 'top', backdrop = null) {
  const tokens = layoutTextElements(ctx, content, x, y, w, palette, accent, frame, anchor);
  // Backdrop is now drawn separately via drawTextBackdropOnly — kept here too
  // for backwards-compat when callers pass it and the canvas is the final dest.
  if (backdrop && backdrop.enabled && tokens.length) {
    drawTextBackdropOnly(ctx, content, x, y, w, palette, accent, frame, anchor, backdrop);
  }

  for (const t of tokens) {
    ctx.fillStyle = t.color;
    const family = t.family === 'JetBrainsMono' ? BRAND.mono : BRAND.display;
    ctx.font = `${t.weight} ${t.size}px ${family}`;
    if (t.type === 'tracked') {
      let cx = t.x;
      for (const ch of t.text) {
        ctx.fillText(ch, cx, t.y);
        cx += ctx.measureText(ch).width + t.letterSpacing;
      }
    } else {
      ctx.fillText(t.text, t.x, t.y);
    }
  }
}

// ─── Wordmark + folio placement per brand guide §logo_placement ──────
// Guide: "Logo top-right · sender bottom-left · diagonal from BL to TR"
// Sizes: 27% of short side (paged) / 30% (poster/banner)
// Margins: 7% horizontal / 6.5% vertical of short side
const POS_KEYS = ['tl', 'tr', 'bl', 'br', 'hidden'];

// Wordmark width = fraction of the canvas short side. Sizing is a coherent
// per-category concept, resolved in this priority order:
//   1. user override (opts.wordmarkPctOverride)
//   2. the format's explicit wmPct — the BRAND-GUIDE print values (0.27 paged /
//      0.30 poster) live here and must be honoured exactly
//   3. the category default below — the single source of truth for every other
//      surface, so the logo reads at a consistent relative size within a category
// Category defaults mirror the guide intent: the logo is a corner signature, not
// a hero — prominent on held print, restrained on screens and feeds.
// Wordmark height derives from the source aspect ratio. WORDMARK_AR is the
// MEASURED width/height of the vector paths (bbox 342.98 × 61.30), so the width
// we reserve for layout equals the width actually drawn — no right-edge cut-off.
const WORDMARK_AR = 342.98 / 61.30; // visible glyph aspect (width / height)
// The wordmark is a HORIZONTAL mark, so its logical size depends on orientation:
//   • Print (poster / paged / card) follows the brand guide — a fraction of the
//     SHORT side (0.27 paged · 0.30 poster). Honoured exactly.
//   • Screens (social / digital) size to the canvas WIDTH, giving a consistent
//     corner presence across square, tall (9:16 — TikTok/Story) and wide formats.
//     "% of short side" made the mark look tiny on tall canvases.
const LOGO_SHORT_PCT = { poster: 0.30, paged: 0.27, card: 0.30 }; // fraction of short side (print, brand guide)
const LOGO_WIDTH_PCT = { social: 0.13, digital: 0.13 };           // fraction of width (screens)
const LOGO_MIN_WIDTH_FRAC  = 0.055; // legibility floor (of canvas width)
const LOGO_MAX_WIDTH_FRAC  = 0.32;  // never dominate / overflow (of canvas width)
const LOGO_MAX_HEIGHT_FRAC = 0.14;  // never oversized on very short/wide banners (of canvas height)

// The default wordmark width expressed as a fraction of the SHORT side, so the
// size-override slider (which works in short-side terms) stays consistent with
// what actually renders. Applies the orientation rule + proportional guards.
function defaultWordmarkShortFrac(formatKey, w, h) {
  const cat = formatCategory(formatKey);
  const fmt = FORMATS[formatKey] || {};
  const shortSide = Math.min(w, h);
  // A DECLARED wmPct IS AN INSTRUCTION, and it is expressed in short-side terms.
  // It used to be honoured only when the category happened to have a
  // LOGO_SHORT_PCT entry — so a format could state its size and be ignored purely
  // because of how its group string was spelled. If a format says what it wants,
  // that is the answer; the category is only the DEFAULT.
  let targetW = (fmt.wmPct != null)
    ? shortSide * fmt.wmPct
    : (LOGO_SHORT_PCT[cat] != null)
      ? shortSide * LOGO_SHORT_PCT[cat]
      : w * (LOGO_WIDTH_PCT[cat] ?? 0.13);
  targetW = clamp(targetW, w * LOGO_MIN_WIDTH_FRAC, w * LOGO_MAX_WIDTH_FRAC);
  targetW = Math.min(targetW, h * LOGO_MAX_HEIGHT_FRAC * WORDMARK_AR);
  return targetW / shortSide;
}

function wordmarkSizeFor(frame, formatKey, pctOverride) {
  const shortSide = Math.min(frame.w, frame.h);
  const pct = (pctOverride != null && pctOverride > 0)
    ? pctOverride
    : defaultWordmarkShortFrac(formatKey, frame.w, frame.h);
  const targetW = shortSide * pct;
  const h = Math.max(18, targetW / WORDMARK_AR);
  return { w: targetW, h };
}

// safeArea = { x, y, w, h } — the region the brand bar may occupy.
// Layouts compute this so the wordmark never lands on top of the image.
// Compute wordmark final size + position WITHOUT drawing. Used by both the
// canvas drawer and the text-clearance calculator so they stay in sync.
function computeWordmarkBox(frame, pos, formatKey, safeArea, pctOverride) {
  if (pos === 'hidden') return null;
  const { padX, padY } = frame;
  const sa = safeArea || { x: 0, y: 0, w: frame.w, h: frame.h };
  let wm = wordmarkSizeFor(frame, formatKey, pctOverride);

  // The mark plus its clear space must FIT. If the safe area is too narrow for
  // both, the mark shrinks — the clear space is never the thing that gives way.
  // (Solved rather than iterated: cs is proportional to h, and h to w.)
  const aspect = wm.h / wm.w;                       // h = aspect · w
  const shrinkToFit = (avail) => {
    // w + 2·1.5·(aspect·w) ≤ avail   →   w ≤ avail / (1 + 3·aspect)
    const maxW = avail / (1 + 2 * WM_CLEAR_RATIO * aspect);
    if (wm.w > maxW && maxW > 0) wm = { w: maxW, h: maxW * aspect };
  };
  shrinkToFit(Math.min(sa.w, frame.w));
  const csFit = wmClear(wm.h);
  if (wm.h + csFit * 2 > Math.min(sa.h, frame.h)) {
    const maxH = Math.min(sa.h, frame.h) / (1 + 2 * WM_CLEAR_RATIO);
    if (maxH > 0 && maxH < wm.h) wm = { w: maxH / aspect, h: maxH };
  }

  const cs = wmClear(wm.h);                          // 1.5 × the height of the "d"
  // Corner anchors sit AT the clear-space boundary — the rule is the margin, so
  // padX/padY only apply when they are LARGER than it.
  const insetX = Math.max(cs, padX * 0.6);
  const insetY = Math.max(cs, padY * 0.75);
  const top    = sa.y + insetY;
  const bottom = sa.y + sa.h - insetY - wm.h;
  const left   = sa.x + insetX;
  const right  = sa.x + sa.w - insetX - wm.w;
  let x, y;
  if (pos === 'tl') { x = left;  y = top; }
  if (pos === 'tr') { x = right; y = top; }
  if (pos === 'bl') { x = left;  y = bottom; }
  if (pos === 'br') { x = right; y = bottom; }

  // THE HARD CLAMP. Whatever the intent, whatever the aspect ratio: the mark
  // keeps 1.5 × d of clear space from every canvas edge. Nothing overrides this.
  x = clamp(x, cs, Math.max(cs, frame.w - wm.w - cs));
  y = clamp(y, cs, Math.max(cs, frame.h - wm.h - cs));
  return { x, y, w: wm.w, h: wm.h, pos, clear: cs };
}

function drawWordmarkAt(ctx, frame, pos, inkColor, formatKey, safeArea, pctOverride) {
  const box = computeWordmarkBox(frame, pos, formatKey, safeArea, pctOverride);
  if (!box) return;
  drawWordmark(ctx, box.x, box.y, box.h, inkColor);
}

function computeFolioBox(ctx, frame, pos, formatKey, safeArea, folioText) {
  if (pos === 'hidden' || !folioText) return null;
  const { w, h, padX, padY } = frame;
  const sa = safeArea || { x: 0, y: 0, w, h };
  const baseSize = Math.min(w, h);
  const folioSize = Math.max(10, baseSize * 0.013);
  ctx.font = `500 ${folioSize}px ${BRAND.mono}`;
  const ls = folioSize * 0.12;
  let tw = 0;
  for (const ch of folioText) tw += ctx.measureText(ch).width + ls;

  const top = sa.y + padY * 0.85;
  const bottom = sa.y + sa.h - padY * 0.4;
  const left = sa.x + padX * 0.6;
  const right = sa.x + sa.w - padX * 0.6 - tw + ls;
  let x, y;
  if (pos === 'tl') { x = left;  y = top; }
  if (pos === 'tr') { x = right; y = top; }
  if (pos === 'bl') { x = left;  y = bottom; }
  if (pos === 'br') { x = right; y = bottom; }
  // Keep the sender fully on-canvas (baseline y, so allow a line above/below).
  const cs = Math.max(padX * 0.5, folioSize * 0.6);
  x = clamp(x, cs, Math.max(cs, frame.w - tw - cs));
  y = clamp(y, cs + folioSize, Math.max(cs + folioSize, frame.h - cs));
  return { x, y, w: tw, h: folioSize, pos, fontSize: folioSize, letterSpacing: ls, text: folioText };
}

function drawFolioAt(ctx, frame, pos, palette, formatKey, safeArea, folioText) {
  const box = computeFolioBox(ctx, frame, pos, formatKey, safeArea, folioText);
  if (!box) return;
  ctx.fillStyle = palette.mode === 'dark' ? BRAND.cream300 : BRAND.ink600;
  ctx.font = `500 ${box.fontSize}px ${BRAND.mono}`;
  let cx = box.x;
  for (const ch of box.text) {
    ctx.fillText(ch, cx, box.y);
    cx += ctx.measureText(ch).width + box.letterSpacing;
  }
}

// Returns the y-padding needed at top and bottom of the safe-area so text
// doesn't overlap the brand bar elements.
function brandBarClearance(ctx, frame, opts) {
  // Only elements that sit IN the safe area count — over-image ones are out
  const wmPos  = opts.wordmarkOverImage ? 'hidden' : (opts.wordmarkPos ?? 'tr');
  const flPos  = opts.folioOverImage    ? 'hidden' : (opts.folioPos ?? 'bl');
  const wmBox  = computeWordmarkBox(frame, wmPos, opts.formatKey, opts.safeArea, opts.wordmarkPctOverride);
  const flBox  = computeFolioBox(ctx, frame, flPos, opts.formatKey, opts.safeArea, opts.folioText);
  const gap    = frame.padY * 0.5;
  const sa     = opts.safeArea || { x: 0, y: 0, w: frame.w, h: frame.h };

  // ABSOLUTE canvas Y, not a delta. Returning "distance from the safe-area top"
  // and then having the caller ADD it to textRectY (which already contains the
  // padding) counted the padding twice and shoved the whole text block down —
  // far enough to overrun the folio. Boundaries are positions; keep them
  // positions, and let the caller take the max/min.
  let topY = sa.y;                      // text may not start above this
  let bottomY = sa.y + sa.h;            // text may not run below this

  // The mark's clear space is part of the mark. Type entering it breaks the rule
  // just as surely as a canvas edge does — and type is what crowds it in practice.
  if (wmBox) {
    const cb = wmClearBox(wmBox);
    if (wmBox.pos === 'tl' || wmBox.pos === 'tr') topY    = Math.max(topY,    cb.y + cb.h);
    if (wmBox.pos === 'bl' || wmBox.pos === 'br') bottomY = Math.min(bottomY, cb.y);
  }
  if (flBox) {
    // computeFolioBox returns a BASELINE, not a top edge: the glyphs occupy
    // (y - h) … y. Treating y as the top would misplace the boundary by a whole
    // line — which is precisely how "medartis.com" ended up sitting under the
    // subline instead of clear of it.
    const flTop = flBox.y - flBox.h;
    if (flBox.pos === 'tl' || flBox.pos === 'tr') topY    = Math.max(topY,    flBox.y + gap);
    if (flBox.pos === 'bl' || flBox.pos === 'br') bottomY = Math.min(bottomY, flTop - gap);
  }
  // THE GROUP LOCKUP IS FURNITURE TOO.
  //
  // It replaces the wordmark, so the wordmark's own reservation above no longer
  // covers the space actually occupied — the Group mark sits in a full-width band
  // at the top or bottom, not in a corner. Without this the headline and the
  // lockup both claim the strip and the later draw wins, silently.
  const gb = groupLockupBand(frame, opts.group);
  if (gb) {
    if ((opts.group.pos ?? 'top') === 'top') topY = Math.max(topY, gb.bottom);
    else bottomY = Math.min(bottomY, gb.top);
  }

  return {
    topY, bottomY,
    // Legacy deltas, still measured from the safe area — kept so nothing silently
    // reads a field that no longer exists.
    top: Math.max(0, topY - sa.y),
    bottom: Math.max(0, (sa.y + sa.h) - bottomY),
  };
}

function drawBrandBar(ctx, frame, palette, accent, overlay, opts = {}) {
  const baseInk = palette.mode === 'dark' ? BRAND.bone00 : BRAND.ink;
  const resolveColor = (override) => {
    if (override === 'ink')  return BRAND.ink;
    if (override === 'bone') return BRAND.bone00;
    return baseInk;
  };
  const wm = opts.wordmarkPos ?? 'tr';
  const fl = opts.folioPos ?? 'bl';
  const fullCanvas = { x: 0, y: 0, w: frame.w, h: frame.h };
  const wmArea = opts.wordmarkOverImage ? fullCanvas : opts.safeArea;
  const flArea = opts.folioOverImage    ? fullCanvas : opts.safeArea;

  // Auto-contrast: when wordmark/sender is over an image, sample what's
  // actually behind it and pick a contrasting colour for legibility.
  // Brand guide says wordmark top-right; this keeps it readable on busy photos.
  let wmColor = resolveColor(opts.wordmarkColor);
  const wmOverImage = opts.wordmarkOverImage || overlay;
  if (wmOverImage) {
    const box = computeWordmarkBox(frame, wm, opts.formatKey, wmArea, opts.wordmarkPctOverride);
    if (box) {
      const pad = Math.max(8, box.h * 0.4);
      // 1 · MEASURE what's actually under the mark (contrast + how busy it is).
      let leg = logoLegibility(ctx, box, pad);
      const mode = opts.logoPlate || 'auto';
      // 2 · PROTECT. In 'auto' we only intervene when the measurement fails —
      //     so a clean dark photo keeps its bare, confident logo.
      const needs = mode === 'auto' ? !leg.safe : mode !== 'off';
      if (needs) {
        drawLogoBackdrop(ctx, box, mode === 'auto' ? 'plate' : mode, palette);
        leg = logoLegibility(ctx, box, pad); // 3 · RE-MEASURE against the backdrop
      }
      // Report upward so the BRAND CHECK panel can state the real number.
      if (opts.legibilityOut) Object.assign(opts.legibilityOut, { ...leg, protected: needs, mode });
      // 4 · Pick the ink against whatever now sits behind the mark.
      if (opts.wordmarkColor === 'auto') {
        wmColor = resolveAutoContrast(ctx, box.x - pad, box.y - pad,
                                      box.w + pad * 2, box.h + pad * 2,
                                      palette.mode === 'dark');
      }
    }
  } else if (opts.legibilityOut) {
    Object.assign(opts.legibilityOut, { best: 21, std: 0, safe: true, protected: false, mode: 'off' });
  }
  // THE GROUP MARK REPLACES THE MEDARTIS WORDMARK — it does not join it.
  //
  // "Medartis Group" and "medartis" are the house and the main brand under it.
  // Showing both on one asset says the sender is two organisations. So when the
  // Group is on, the wordmark slot is ITS slot, and drawGroupLockup fills it.
  //
  // This is a suppression, so it is done HERE, at the single place the wordmark is
  // drawn, rather than by asking each layout to remember. A layout that forgot
  // would double the mark and still look plausible.
  if (!opts.group?.enabled) {
    drawWordmarkAt(ctx, frame, wm, wmColor, opts.formatKey, wmArea, opts.wordmarkPctOverride);
  }

  // Folio palette resolution — dim variants of the colour
  let folioPalette = opts.folioColor
    ? { ...palette, mode: opts.folioColor === 'bone' ? 'dark' : 'light' }
    : palette;
  if (opts.folioColor === 'auto' && (opts.folioOverImage || overlay)) {
    const fBox = computeFolioBox(ctx, frame, fl, opts.formatKey, flArea, opts.folioText || 'medartis.com');
    if (fBox) {
      const pad = Math.max(6, fBox.h * 0.5);
      const c = resolveAutoContrast(ctx, fBox.x - pad, fBox.y - pad,
                                    fBox.w + pad * 2, fBox.h + pad * 2,
                                    palette.mode === 'dark');
      folioPalette = { ...palette, mode: c === BRAND.bone00 ? 'dark' : 'light' };
    }
  }
  drawFolioAt(ctx, frame, fl, folioPalette, opts.formatKey, flArea, opts.folioText || 'medartis.com');
}

// ──────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────────
export default function MedartisBrandGenerator() {
  const [view, setView] = useState('templates');
  const [formatKey, setFormatKey] = useState('ig-post');
  const [layoutKey, setLayoutKey] = useState('image-bottom');
  const [templateKey, setTemplateKey] = useState('product-launch');
  const [carouselSlide, setCarouselSlide] = useState(0);
  // Start as a SINGLE frame. Slides appear only when the user adds one (+ under
  // the canvas), or when a carousel format/template asks for them.
  const [carouselSlides, setCarouselSlides] = useState(1);
  // True once the user has typed real copy or imported a preset/manuscript.
  // Gates whether switching the content template carries that copy forward
  // (fixing a wrong template must NOT wipe content) vs. loads sample defaults
  // (a pristine canvas should still show each template's example).
  const contentEdited = useRef(false);
  // Set for exactly one template application, then cleared by the effect itself.
  const sampleOnceRef = useRef(false);

  const initialContent = useMemo(() => {
    const t = TEMPLATES[templateKey];
    const obj = {};
    t.fields.forEach(f => obj[f.key] = f.default);
    return obj;
  }, [templateKey]);

  // Per-slide state (carousel) + single-slide fallback
  const [content, setContent] = useState(initialContent);
  // Remembered answer to the template-switch question: 'keep' | 'sample' | null.
  const [tmplPref, setTmplPref] = useState(() => readTemplatePref());
  const [undo, setUndo] = useState(null);        // { snap, lostWork, label }
  // What happens when copy is longer than its band. See layoutTextElements.
  const [textOverflow, setTextOverflow] = useState('trim');   // trim | shrink | allow

  // Live mirrors, for reading state from a setTimeout that would otherwise close
  // over the render that scheduled it.
  const contentRef = useRef(initialContent);
  const carouselContentRef = useRef([]);
  const layoutRef = useRef('image-bottom');
  const slidesRef = useRef(1);
  // Set while an undo is being applied, so the template effect leaves the restored
  // copy alone instead of helpfully overwriting it with the template's defaults —
  // which would make the undo button do nothing and look broken.
  const undoingRef = useRef(false);
  const [carouselContent, setCarouselContent] = useState(() => [initialContent, initialContent, initialContent]);
  // Print PAGES: a long agenda splits onto extra A4 pages at steerable PAGE_BREAK
  // markers in the body (edited in the agenda editor). `pages` is DERIVED from the
  // body, so moving a break instantly re-flows the pages. Distinct from carousel slides.
  const [pageIdx, setPageIdx] = useState(0);
  const [pageImages, setPageImages] = useState([]); // optional per-page background image
  const [pageFits, setPageFits] = useState([]);     // per-page image transform (size/pos/rotation/fade)
  const [image, setImage] = useState(null);
  const [carouselImages, setCarouselImages] = useState([null, null, null]);
  const [imageFit, setImageFit] = useState({ ...DEFAULT_FIT });
  const [carouselFits, setCarouselFits] = useState([{...DEFAULT_FIT}, {...DEFAULT_FIT}, {...DEFAULT_FIT}]);

  useEffect(() => {
    // An undo restores the copy AND the templateKey, which re-fires this effect.
    // Without this guard it would immediately re-apply the template's defaults over
    // the restored words — the undo button would appear to do nothing, which is the
    // worst possible outcome for a button whose whole job is trust.
    if (undoingRef.current) { undoingRef.current = false; return; }
    const t = TEMPLATES[templateKey];
    setCarouselSlide(0);
    // Carry the user's copy across a template switch. Every template shares the
    // {eyebrow,headline,subline,body,cta} field shape, so once content has been
    // edited/imported we keep each value and only fall back to the new
    // template's default for keys that are still empty. A pristine canvas
    // (nothing edited yet) still loads the template's sample content, so simply
    // browsing templates behaves as before.
    // `forceSample` is the escape hatch for "the template does nothing": normally
    // your copy is carried, which is why a switch looks like a no-op once you have
    // typed anything. Asking for the sample explicitly overrides that, once.
    const keep = contentEdited.current && !sampleOnceRef.current;
    sampleOnceRef.current = false;
    const carry = (prev) => {
      const next = {};
      t.fields.forEach((f) => {
        const existing = prev ? prev[f.key] : undefined;
        next[f.key] = (keep && existing != null && existing !== '') ? existing : f.default;
      });
      return next;
    };
    setContent((prev) => carry(prev));
    // If the template provides per-slide content, use it (and auto-set slide count).
    // Otherwise fall back to filling every slide with the single-content defaults.
    if (t?.carouselContent && t.carouselContent.length) {
      const slides = t.carouselSlides || t.carouselContent.length;
      setCarouselSlides(slides);
      const next = [];
      for (let i = 0; i < slides; i++) {
        next.push({ ...initialContent, ...(t.carouselContent[i] || {}) });
      }
      setCarouselContent(next);
      // Keep per-slide overrides + fits arrays in sync with the new slide count
      setCarouselQrPer(p => { const a = [...p]; while (a.length < slides) a.push(true); return a.slice(0, slides); });
      setCarouselFolioPer(p => { const a = [...p]; while (a.length < slides) a.push(true); return a.slice(0, slides); });
      setCarouselFits(p => { const a = [...p]; while (a.length < slides) a.push({ ...DEFAULT_FIT }); return a.slice(0, slides); });
      setCarouselImages(p => { const a = [...p]; while (a.length < slides) a.push(null); return a.slice(0, slides); });
    } else {
      setCarouselContent(prev => prev.map((c) => carry(c)));
    }
  }, [templateKey, initialContent]);

  // Mirror the live state for armUndo's setTimeout, which would otherwise read the
  // render that scheduled it — i.e. the state from BEFORE the switch it is measuring.
  useEffect(() => { contentRef.current = content; }, [content]);
  useEffect(() => { carouselContentRef.current = carouselContent; }, [carouselContent]);
  useEffect(() => { layoutRef.current = layoutKey; }, [layoutKey]);
  useEffect(() => { slidesRef.current = carouselSlides; }, [carouselSlides]);

  // Palettes
  const [paletteName, setPaletteName] = useState('coal');
  const [mutedBoost, setMutedBoost] = useState(false);
  const [accentSafe, setAccentSafe] = useState(false);
  // Logo protection over imagery: 'auto' intervenes only when the measurement
  // fails; the others force a specific backdrop; 'off' trusts auto-contrast alone.
  const [logoPlate, setLogoPlate] = useState('auto'); // auto | plate | frosted | scrim | off
  // Filled by drawBrandBar on every render with the REAL measured legibility.
  const legibRef = useRef({ best: 21, std: 0, safe: true, protected: false, mode: 'off' });
  const [logoLegib, setLogoLegib] = useState({ best: 21, std: 0, safe: true, protected: false, mode: 'off' });
  // Brand bar — per brand guide §logo_placement: wordmark top-right, sender bottom-left
  const [wordmarkPos, setWordmarkPos] = useState('tr');
  const [folioPos, setFolioPos] = useState('bl');
  // Place-over-image overrides
  const [wordmarkOverImage, setWordmarkOverImage] = useState(false);
  const [folioOverImage, setFolioOverImage] = useState(false);
  // Sender / folio text — editable
  const [folioText, setFolioText] = useState('medartis.com');
  // Per-element colour override: 'auto' | 'ink' | 'bone'
  const [wordmarkColor, setWordmarkColor] = useState('auto');
  const [folioColor, setFolioColor] = useState('auto');
  // Optional override of the wordmark width (fraction of short side).
  // null = use the format's brand-guide default (e.g. 0.27 paged / 0.30 poster).
  const [wordmarkPctOverride, setWordmarkPctOverride] = useState(null);

  // Step-by-step assistant
  const [assistantOpen, setAssistantOpen] = useState(false);

  // QR code overlay (global, persisted in presets) — palette resolution
  // happens later because `palette` isn't yet in scope here.
  const [qrConfig, setQrConfig] = useState({ ...DEFAULT_QR });
  const [qrImage, setQrImage] = useState(null);

  // Frosted-glass / solid backdrop behind text (helps text-over-image legibility)
  const [textBackdrop, setTextBackdrop] = useState({
    enabled: false,
    type: 'frosted',     // 'frosted' | 'solid'
    tint: 'auto',        // 'auto' | 'ink' | 'bone'
    blur: 24,            // px
  });

  // Per-slide overrides: each slide can hide the global QR or sender.
  // Default = all-true (everything enabled on every slide).
  const [carouselQrPer, setCarouselQrPer] = useState([true, true, true]);
  const [carouselFolioPer, setCarouselFolioPer] = useState([true, true, true]);
  // Use functional updates and grow the array if needed — otherwise toggling
  // a slide whose index is beyond the current array length silently no-ops.
  const toggleSlideQr = (i) => setCarouselQrPer(prev => {
    const arr = [...prev];
    while (arr.length <= i) arr.push(true);
    arr[i] = !arr[i];
    return arr;
  });
  const toggleSlideFolio = (i) => setCarouselFolioPer(prev => {
    const arr = [...prev];
    while (arr.length <= i) arr.push(true);
    arr[i] = !arr[i];
    return arr;
  });

  // Carousel spanning background — one image sliced across all slides.
  // placement: 'full' = full bleed | 'image' = only image area | 'text' = only text band
  const [carouselBg, setCarouselBg] = useState({
    enabled: false,
    imageSrc: null,
    placement: 'full',
    fit: { offsetY: 0 },
  });
  const [carouselBgImage, setCarouselBgImage] = useState(null);
  useEffect(() => {
    if (!carouselBg.enabled || !carouselBg.imageSrc) { setCarouselBgImage(null); return; }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { if (!cancelled) setCarouselBgImage(img); };
    img.onerror = () => { if (!cancelled) setCarouselBgImage(null); };
    img.src = carouselBg.imageSrc;
    return () => { cancelled = true; };
  }, [carouselBg.enabled, carouselBg.imageSrc]);

  // Collapsible sidebar groups — persisted to localStorage. Format-category
  // groups (keys starting with 'fmt:') behave as an ACCORDION: opening one
  // closes the others. Default: all format groups COLLAPSED (clean sidebar).
  // v4: the format groups were renamed (shape → platform), so the stored
// collapse state keys no longer match. Bumping the key resets them to the
// intended default (all format groups collapsed) instead of leaving every
// group hanging open because none of the old keys resolve.
const COLLAPSE_KEY = 'medartis-bag-collapsed-v4';
  const ACCORDION_KEY = 'medartis-bag-accordion-v1';
  // Derived from FORMATS so the two can never drift apart.
  const FMT_GROUPS = [...new Set(Object.values(FORMATS).map(f => f.group || 'Other'))];
  const ALL_FMT_KEYS = FMT_GROUPS.map(g => 'fmt:' + g);
  // Every collapsible <Section> id — keep in sync with the sp('…') calls below.
  // Collapse/Solo operate on the SAME list the numbers come from — a second,
  // hand-maintained copy is how the two drift apart.
  const SECTION_KEYS = SECTION_ORDER;
  const ALL_SEC_KEYS = SECTION_KEYS.map(k => 'sec:' + k);
  const ALL_KEYS = [...ALL_SEC_KEYS, ...ALL_FMT_KEYS];
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || 'null');
      if (Array.isArray(stored)) return new Set(stored);
    } catch {}
    // First visit → format groups + advanced panels collapsed, so the sidebar
    // reads as a short, scannable list of the essentials.
    return new Set([...ALL_FMT_KEYS, 'sec:TEXTBG', 'sec:QR', 'sec:CAROUSEL_BG', 'sec:CANTO', 'sec:GENERATE']);
  });
  // Solo (accordion) mode: only one sidebar panel open at a time.
  const [accordion, setAccordion] = useState(() => {
    try { return localStorage.getItem(ACCORDION_KEY) === '1'; } catch { return false; }
  });
  const persistCollapsed = (next) => {
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next])); } catch {}
    return next;
  };
  const toggleCollapsed = (k) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      // Accordion for format groups (always) and for sections (opt-in via Solo)
      if (k.startsWith('fmt:')) {
        const isOpen = !next.has(k);
        if (isOpen) next.add(k);
        else { for (const f of ALL_FMT_KEYS) next.add(f); next.delete(k); }
      } else if (accordion && k.startsWith('sec:')) {
        const isOpen = !next.has(k);
        if (isOpen) next.add(k);
        else { for (const s of ALL_SEC_KEYS) next.add(s); next.delete(k); }
      } else {
        next.has(k) ? next.delete(k) : next.add(k);
      }
      return persistCollapsed(next);
    });
  };
  // Expand / collapse everything at once.
  const allSectionsCollapsed = ALL_SEC_KEYS.every(k => collapsed.has(k));
  const setAllCollapsed = (shouldCollapse) => {
    setCollapsed(() => persistCollapsed(shouldCollapse ? new Set(ALL_KEYS) : new Set(ALL_FMT_KEYS)));
  };
  const toggleAccordion = () => {
    setAccordion(prev => {
      const next = !prev;
      try { localStorage.setItem(ACCORDION_KEY, next ? '1' : '0'); } catch {}
      // Switching Solo ON → keep at most one section open.
      if (next) {
        setCollapsed(cur => {
          const open = ALL_SEC_KEYS.filter(k => !cur.has(k));
          const keep = open[0];
          const n = new Set(cur);
          for (const s of ALL_SEC_KEYS) n.add(s);
          if (keep) n.delete(keep);
          return persistCollapsed(n);
        });
      }
      return next;
    });
  };
  // Shorthand: pass to a <Section> to make it collapsible by id
  const sp = (k, label) => ({
    collapsed: collapsed.has('sec:' + k),
    onToggle: () => toggleCollapsed('sec:' + k),
    ...(label ? { label: SEC(k, label) } : {}),
  });
  const palettes = {
    bone:  { bg: BRAND.bone,    ink: BRAND.ink,    muted: BRAND.ink600,   mode: 'light' },
    paper: { bg: BRAND.paper,   ink: BRAND.ink,    muted: BRAND.ink600,   mode: 'light' },
    cream: { bg: BRAND.cream50, ink: BRAND.ink,    muted: BRAND.ink600,   mode: 'light' },
    coal:  { bg: BRAND.coal,    ink: BRAND.bone00, muted: BRAND.cream100, mode: 'dark'  },
    ink:   { bg: BRAND.ink,     ink: BRAND.bone00, muted: BRAND.cream100, mode: 'dark'  },
    // Deep black — pure RGB #000 on screen, four-channel composite CMYK in print
    // per brand guide §deep_black (C50 M40 Y40 K100, 230% total ink limit).
    // Use for BTL implant photography backgrounds, annual report covers, etc.
    'deep-black': {
      bg: '#000000', ink: BRAND.bone00, muted: BRAND.cream100, mode: 'dark',
      cmyk: [50, 40, 40, 100],
      label: 'D·BLK',
    },
  };
  // Accessibility remedies offered by the BRAND CHECK panel. `mutedBoost` lifts
  // body/muted text to a high-contrast ink; `accentSafe` swaps the brand gold for
  // the deepened gold that clears AA on light surfaces.
  const basePalette = palettes[paletteName];
  const palette = mutedBoost
    ? { ...basePalette, muted: basePalette.mode === 'dark' ? BRAND.bone00 : BRAND.ink800 }
    : basePalette;
  const accentColor = (accentSafe && palette.mode !== 'dark') ? BRAND.goldDeep : BRAND.gold;

  // QR ink — resolved AFTER palette is known.
  // When backdrop is on, the QR sits on a light pill, so it must be DARK
  // regardless of palette mode — otherwise light-on-light = invisible.
  const qrInk = qrConfig.color === 'ink' ? BRAND.ink
              : qrConfig.color === 'bone' ? BRAND.bone00
              : (qrConfig.backdrop ? BRAND.ink
                 : palette.mode === 'dark' ? BRAND.bone00 : BRAND.ink);
  useEffect(() => {
    if (!qrConfig.enabled || !qrConfig.url) { setQrImage(null); return; }
    let cancelled = false;
    makeQrImage(qrConfig.url, qrConfig.style, qrInk, 600)
      .then((img) => { if (!cancelled) setQrImage(img); })
      .catch(() => { if (!cancelled) setQrImage(null); });
    return () => { cancelled = true; };
  }, [qrConfig.enabled, qrConfig.url, qrConfig.style, qrInk]);

  // Library load
  const [libraryImages, setLibraryImages] = useState({});
  useEffect(() => {
    LIBRARY.forEach(asset => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setLibraryImages(prev => ({ ...prev, [asset.id]: img }));
      img.src = asset.src;
    });
  }, []);

  // Load the official wordmark assets once; bump wmReady so the canvas repaints
  // from the SVG the moment it's available (paths render meanwhile).
  const [wmReady, setWmReady] = useState(false);
  useEffect(() => {
    const done = () => { if (WORDMARK_ASSETS.dark?.complete && WORDMARK_ASSETS.light?.complete) setWmReady(v => !v); };
    if (!WORDMARK_ASSETS.dark)  { const d = new Image(); d.onload = done; d.src = '/brand/wordmark.svg';       WORDMARK_ASSETS.dark = d; }
    if (!WORDMARK_ASSETS.light) { const l = new Image(); l.onload = done; l.src = '/brand/wordmark-white.svg'; WORDMARK_ASSETS.light = l; }
    done();
  }, []);

  // ── SAVED LIBRARY ─────────────────────────────────────────────────
  // User-curated images (Canto picks, AI results) that join the standard
  // library across sessions. Stored in INDEXEDDB, not localStorage: the whole
  // origin shares one ~5 MB localStorage quota, so a dozen compressed images
  // plus the presets filled it and the failure arrived as a quota exception at
  // the worst possible moment. IndexedDB holds hundreds of megabytes without
  // complaint. A legacy localStorage library migrates over once, and clearing
  // the old key gives the presets their room back.
  const SAVED_LIB_KEY = 'medartis-saved-library-v1';
  const idbLib = (mode, run) => new Promise((resolve, reject) => {
    const rq = indexedDB.open('medartis-bag', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('saved-library', { keyPath: 'id' });
    rq.onerror = () => reject(rq.error);
    rq.onsuccess = () => {
      const tx = rq.result.transaction('saved-library', mode);
      const req = run(tx.objectStore('saved-library'));
      tx.oncomplete = () => { resolve(req?.result); rq.result.close(); };
      tx.onerror = () => { reject(tx.error); rq.result.close(); };
    };
  });

  const [savedLibrary, setSavedLibrary] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const legacy = localStorage.getItem(SAVED_LIB_KEY);
        if (legacy) {
          for (const e of JSON.parse(legacy)) await idbLib('readwrite', (st) => st.put({ savedAt: 0, ...e }));
          localStorage.removeItem(SAVED_LIB_KEY);
        }
        const all = (await idbLib('readonly', (st) => st.getAll())) || [];
        all.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
        setSavedLibrary(all);
      } catch { /* e.g. private browsing without IDB: the library is session-only */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    savedLibrary.forEach(asset => {
      if (libraryImages[asset.id]) return;
      const img = new Image();
      img.onload = () => setLibraryImages(prev => ({ ...prev, [asset.id]: img }));
      img.src = asset.src;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedLibrary]);

  // Compress + persist an image element into the saved library. Returns true on success.
  // Dedupe by CONTENT, never by label: every AI variant of one prompt carries the
  // same "AI · <prompt>" label, so a label check silently kept only the FIRST
  // variant and dropped every later save ("saves always the same one").
  const libSourceKey = (src) => (src ? `${src.length}:${src.slice(-96)}` : '');
  const saveImageToLibrary = (img, label = 'Saved image', category = 'saved') => {
    if (!img) return false;
    const srcKey = libSourceKey(img.src);
    if (srcKey && savedLibrary.some(a => a.sourceKey === srcKey)) return true; // this exact image is already saved
    try {
      const src = compressDataUrl(img, 1600, 0.82);
      const id = 'saved-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
      const entry = { id, label: (label || 'Saved image').slice(0, 48), category, src, sourceKey: srcKey, saved: true, savedAt: Date.now() };
      setLibraryImages(prev => ({ ...prev, [id]: img }));
      setSavedLibrary((cur) => [entry, ...cur]);
      idbLib('readwrite', (st) => st.put(entry)).catch((e) => {
        askConfirm({ title: 'Could not save to the library', body: `Storage refused the write: ${e?.message || e}. The image stays available for this session.`, notice: true, tone: 'error' });
      });
      return true;
    } catch (e) {
      askConfirm({ title: 'Could not save the image', body: e.message, notice: true, tone: 'error' });
      return false;
    }
  };

  const removeFromLibrary = (id) => {
    setSavedLibrary((cur) => cur.filter(a => a.id !== id));
    idbLib('readwrite', (st) => st.delete(id)).catch(() => {});
    setLibraryImages(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const canvasRef = useRef(null);
  const previewWrapRef = useRef(null);
  const [previewSize, setPreviewSize] = useState({ w: 500, h: 500 });
  // A 118 × 5315 lanyard is 1:45. Fitted to the window it is a hair-thin line —
  // you cannot judge a repeat you cannot see. Zoom and a 90° turn are not polish
  // here, they are what makes the format usable at all.
  // How the type engine coped with the band on the last draw — measured, not guessed.
  const fitRef = useRef({ scale: 1, overflow: 0, bandH: 0 });
  const [typeFit, setTypeFit] = useState({ scale: 1, overflow: 0, bandH: 0 });

  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewRotate, setPreviewRotate] = useState(false);
  // ── ONE MENTAL MODEL: every canvas can have several "frames" ──────────
  // Screen formats → SLIDES (manual + / − under the canvas; 1 = a single post).
  // Print formats  → PAGES  (manual + / −, which insert/remove PAGE_BREAK markers
  //                          in the body, so a long agenda still re-flows itself).
  // `multi` stays the internal flag the render/export paths already understand:
  // it simply means "this canvas currently has more than one slide".
  // ── BROCHURE ───────────────────────────────────────────────────────
  // A brochure is a SEQUENCE OF TYPED PAGES, not a pile of free canvases. The
  // type carries the layout, so a 40-page document stays on-grid. Pages live in
  // their own state (not in the PAGE_BREAK body) because each page has its own
  // fields, its own image and its own crop.
  // Branded confirm/notice, replacing window.confirm / window.alert. Promise-based
  // so call sites stay linear: if (!(await askConfirm({ … }))) return;
  const [confirmDlg, setConfirmDlg] = useState(null);
  const askConfirm = (o) => new Promise((resolve) => setConfirmDlg({ ...o, resolve }));
  const closeConfirm = (answer) => setConfirmDlg((d) => { d?.resolve?.(answer); return null; });

  // Custom formats. `fmtVersion` exists because FORMATS is a mutable registry
  // (module-level functions read it), so React cannot see a change to it — the
  // counter is what tells the tree to re-read.
  // Set when the USER picks a layout. A suggestion may fill an empty seat; it may
  // never take one that is occupied.
  const layoutChosen = useRef(false);

  const [fmtEditor, setFmtEditor] = useState(null);   // null | { …seed }
  const [fmtVersion, setFmtVersion] = useState(0);

  // FORMATS is a mutable registry, so React cannot see a custom format appear in
  // it. fmtVersion is the explicit signal to re-read — depending on the registry
  // object itself would never re-run, because its identity never changes.
  const formatGroups = useMemo(() => {
    const acc = {};
    for (const [key, fmt] of Object.entries(FORMATS)) {
      const g = fmt.group || 'Other';
      (acc[g] = acc[g] || []).push([key, fmt]);
    }
    // Custom formats last: they are yours, and they should not push the built-ins
    // you use every day further down the list.
    const order = (g) => (g === CUSTOM_GROUP ? 1 : 0);
    return Object.fromEntries(Object.entries(acc).sort((a, b) => order(a[0]) - order(b[0])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fmtVersion]);

  const saveCustomFormat = (fmt) => {
    const list = readCustomFormats();
    const i = list.findIndex((f) => f.id === fmt.id);
    // An edit keeps the id, so presets pointing at it keep working.
    if (i >= 0) list[i] = fmt; else list.push(fmt);
    writeCustomFormats(list);
    registerCustomFormats();
    setFmtVersion((v) => v + 1);
    setFmtEditor(null);
    setFormatKey(fmt.id);
  };

  const deleteCustomFormat = async (id) => {
    const fmt = FORMATS[id];
    if (!(await askConfirm({
      title: `Delete "${fmt?.label}"?`,
      body: 'Any preset saved with this format will fall back to A4 when opened. The preset itself is kept.',
    }))) return;
    writeCustomFormats(readCustomFormats().filter((f) => f.id !== id));
    registerCustomFormats();
    setFmtVersion((v) => v + 1);
    setFmtEditor(null);
    if (formatKey === id) setFormatKey('a4-portrait');
  };

  // Logo files — the mark, handed out as real vector.
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoColorKey, setLogoColorKey] = useState('ink');
  const [logoClearSpace, setLogoClearSpace] = useState(true);
  const [kitProgress, setKitProgress] = useState(null);
  const [kitPdfs, setKitPdfs] = useState(true);
  const LOGO_COLORS = {
    ink:  { hex: BRAND.ink,    label: 'Ink · for light surfaces' },
    bone: { hex: BRAND.bone00, label: 'Bone · for dark surfaces' },
  };

  const downloadLogo = async (fmt) => {
    setLogoBusy(true);
    try {
      const svg = buildLogoSvg({
        paths: WORDMARK_PATHS, glyph: WM_GLYPH, view: WM_VIEW,
        color: LOGO_COLORS[logoColorKey].hex,
        clearSpace: logoClearSpace,
        height: 1000,                     // vector — this only sets the viewBox
      });
      const base = `medartis_wordmark_${logoColorKey}${logoClearSpace ? '' : '_tight'}`;
      if (fmt === 'svg') {
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        const a = document.createElement('a');
        a.href = url; a.download = `${base}.svg`; a.click();
        URL.revokeObjectURL(url);
      } else {
        const pdf = await svgToPdf(svg, { jsPDF, svg2pdf });
        pdf.save(`${base}.pdf`);
      }
    } catch (e) {
      await askConfirm({ title: 'Could not build the logo file', body: e.message, notice: true, tone: 'error' });
    } finally {
      setLogoBusy(false);
    }
  };

  const downloadBrandKit = async () => {
    setKitProgress({ done: 0, total: 1, label: 'starting' });
    try {
      const files = await buildBrandKit({
        paths: WORDMARK_PATHS, glyph: WM_GLYPH, view: WM_VIEW,
        colors: LOGO_COLORS,
        brand: BRAND,
        formats: kitPdfs ? ['svg', 'pdf'] : ['svg'],
        clearSpace: logoClearSpace,
        pdfTools: { jsPDF, svg2pdf },
        // The house and its brands. Colour + white for the ones that HAVE colours;
        // the Group mark is monochrome, so offering it a "colour" variant would be
        // a menu entry that produces the same file twice under different names.
        groupMarks: [
          { key: 'medartis_group', label: 'Medartis Group', mark: GROUP_MARK, variants: ['mono', 'white'] },
          // Both builds of BOTH co-brands ship: with the "medartis group" byline for
          // standing alone, without it for use under the Group mark. The choice is a
          // judgement about the asset, not a preference — and getting it wrong is
          // silent. The README says which is which.
          { key: 'neoortho', label: 'NeoOrtho', mark: markAsFull(NEOORTHO_MARK), variants: ['color', 'white', 'mono'] },
          { key: 'neoortho_no-byline', label: 'NeoOrtho', mark: markAsBrand(NEOORTHO_MARK), variants: ['color', 'white', 'mono'] },
          { key: 'kerimedical', label: 'KeriMedical', mark: markAsFull(KERIMEDICAL_MARK), variants: ['color', 'white', 'mono'] },
          { key: 'kerimedical_no-byline', label: 'KeriMedical', mark: markAsBrand(KERIMEDICAL_MARK), variants: ['color', 'white', 'mono'] },
        ],
        gradients: GROUP_GRADIENTS,
        onProgress: (done, total, label) => setKitProgress({ done, total, label }),
      });
      const url = URL.createObjectURL(makeZip(files));
      const a = document.createElement('a');
      a.href = url;
      a.download = `medartis_logo_kit_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      await askConfirm({
        title: 'Brand kit ready',
        body: `${files.length} files — the wordmark in SVG${kitPdfs ? ' and PDF' : ''}, the palette, and a README covering clear space and minimum sizes.`,
        notice: true, tone: 'success',
      });
    } catch (e) {
      await askConfirm({ title: 'Could not build the brand kit', body: e.message, notice: true, tone: 'error' });
    } finally {
      setKitProgress(null);
    }
  };

  // Lanyard strap settings — only used by the lanyard layout.
  const [lanyard, setLanyard] = useState({ ...LANYARD_DEFAULTS });

  const [brochurePages, setBrochurePages] = useState(defaultBrochurePages);
  const [brochureIdx, setBrochureIdx]     = useState(0);
  const [brochureTitle, setBrochureTitle] = useState('MEDARTIS');
  const [brochureImgs, setBrochureImgs]   = useState({});  // pageId → HTMLImageElement
  const [partnerLogos, setPartnerLogos]   = useState([]);  // [{ id, name, src, img }]
  // How the partner wall is PLACED. Separate from the logos themselves, because
  // the same set gets laid out differently on a poster and on a strap.
  const [partners, setPartners] = useState({
    enabled: true, size: 0.055, align: 'center', pos: 'bottom',
    plate: false, mono: false, label: 'IN COOPERATION WITH',
  });

  // MEDARTIS GROUP — the house, not a partnership.
  //
  // Kept separate from `partners` on purpose. Partners are strangers whose
  // relationship must be spelled out ("IN COOPERATION WITH"); the sub-brands are
  // owned, and saying that about KeriMedical would be a factual error. Sharing the
  // state would make the two indistinguishable at the point where it matters.
  const [group, setGroup] = useState({
    enabled: false,
    // Which co-brands ride along. OPTIONAL by definition — a Medartis Group asset
    // is complete with the Group mark alone; naming KeriMedical and NeoOrtho is a
    // choice about THIS asset, not a rule of the house.
    // medartis is in here too. Once the Group mark leads, medartis is no longer the
    // sender — it is one of the three brands under the house, exactly like the other
    // two, and it appears (or not) on the same terms.
    coBrands: { medartis: false, neoortho: false, kerimedical: false },
    // TOP by default. The Group mark is the SENDER — it says who is speaking, and a
    // sender reads before the message, not after it. The medartis wordmark defaults
    // to a top corner for the same reason; the Group inherits the logic, not a
    // different taste.
    pos: 'top',                // top | bottom
    variant: 'auto',           // auto | color | white | mono
    size: 0.14,                // fraction of the SHORT EDGE — never of the canvas
    // The space between co-brands, as a fraction of their own drawn height — not of
    // the canvas and not of the box, so it holds its proportion at every format.
    gap: 2.6,        // between co-brands: multiples of the CAP height
    align: 'center', // left | center | right
    // How much of the lockup's height the GROUP mark takes, against the co-brand
    // row beneath it. It was hardcoded at 0.38 — a number I picked, which is fine
    // until the day it is not, and then it is unreachable.
    headShare: 0.38,
    // The air between the Group mark and its brands, as a fraction of the lockup.
    rowGap: 0.16,
  });

  // The surface: flat palette colour, or a Group gradient.
  const [surface, setSurface] = useState({
    enabled: false,
    key: 'group',
    gradient: { ...DEFAULT_GRADIENT, ...GROUP_GRADIENTS.group },
  });

  const baseFormat = FORMATS[formatKey];
  const isBrochure = !!baseFormat.brochure;
  const isLanyard = layoutKey === 'lanyard';
  const supportsSlides = !baseFormat.printable && !baseFormat.brochure;
  const supportsPages = !!baseFormat.printable && !baseFormat.brochure;
  const format = useMemo(
    () => ({ ...baseFormat, multi: supportsSlides && carouselSlides > 1, supportsSlides, supportsPages, isBrochure }),
    [formatKey, carouselSlides] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // The numbering counts only the sections ACTUALLY RENDERED for this canvas — a
  // poster has no carousel panels, so it must not have a § 08-shaped hole where
  // they would have been.
  //
  // This sits BELOW `isBrochure` and `format` on purpose: a hook's dependency
  // array is evaluated at RENDER time, so it cannot name a const declared further
  // down the component. Putting it up with the other sidebar plumbing threw
  // "can't access 'isBrochure' before initialization" on the first paint.
  const secNo = useMemo(
    () => sectionNumbers(visibleSections({ isBrochure, isCarousel: !!format.multi, isLanyard })),
    [isBrochure, format.multi, isLanyard]
  );
  /** "§ 07 — CANTO DAM" — never typed by hand, never counts a panel you can't see. */
  const SEC = (key, label) => `§ ${secNo[key] || '--'} — ${label}`;

  const curBrochure = Math.min(brochureIdx, Math.max(0, brochurePages.length - 1));
  const brochurePage = brochurePages[curBrochure] || null;
  useEffect(() => {
    if (brochureIdx > brochurePages.length - 1) setBrochureIdx(Math.max(0, brochurePages.length - 1));
  }, [brochurePages, brochureIdx]);

  const patchBrochure = (i, patch) =>
    setBrochurePages((ps) => ps.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const patchBrochureField = (i, key, v) =>
    setBrochurePages((ps) => ps.map((p, k) => (k === i ? { ...p, f: { ...p.f, [key]: v } } : p)));
  const addBrochurePage = (type = 'feature', at = null) => {
    const page = makeBrochurePage(type);
    setBrochurePages((ps) => {
      const next = [...ps];
      // New pages land BEFORE the back cover — that is almost always the intent.
      const idx = at != null ? at
        : (next[next.length - 1]?.type === 'backCover' ? next.length - 1 : next.length);
      next.splice(idx, 0, page);
      setBrochureIdx(idx);
      return next;
    });
  };
  const deleteBrochurePage = async (i) => {
    if (brochurePages.length <= 1) return;
    const p = brochurePages[i];
    if (!(await askConfirm({
      title: `Delete page ${i + 1}?`,
      body: `${BROCHURE_TYPES[p.type]?.label} — its fields, image and crop go with it. The other pages renumber.`,
    }))) return;
    setBrochurePages((ps) => ps.filter((_, k) => k !== i));
    setBrochureImgs((m) => { const n = { ...m }; delete n[p.id]; return n; });
    setBrochureIdx((idx) => Math.max(0, Math.min(idx, brochurePages.length - 2)));
  };
  const moveBrochurePage = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= brochurePages.length) return;
    setBrochurePages((ps) => { const n = [...ps]; [n[i], n[j]] = [n[j], n[i]]; return n; });
    setBrochureIdx(j);
  };
  const addPartnerLogo = async (file) => {
    const dataUrl = await fileToImageDataUrl(file);
    const img = new Image();
    img.onload = () => setPartnerLogos((p) => [
      ...p, { id: `pl-${Date.now()}-${p.length}`, name: file.name.replace(/\.[^.]+$/, ''), src: dataUrl, img },
    ]);
    img.src = dataUrl;
  };
  const removePartnerLogo = (id) => setPartnerLogos((p) => p.filter((l) => l.id !== id));

  const brochureOpts = () => ({
    palette, accent: accentColor,
    fit: brochurePage?.fit || DEFAULT_FIT,
    brochurePage, pageNumber: curBrochure + 1, brochureTitle,
    partners: { ...partners, logos: partnerLogos }, surface, group,
  });

  useEffect(() => {
    const update = () => {
      if (!previewWrapRef.current) return;
      const rect = previewWrapRef.current.getBoundingClientRect();
      const pad = 80;
      // Reserve room at the bottom for the FRAME BAR (slides / pages) and at the
      // top for the format caption, so the canvas never sits flush against either
      // — the bar gets to breathe instead of crowding the artwork.
      const FRAME_BAR = 110;
      const CAPTION = 40;
      const maxW = rect.width - pad;
      const maxH = rect.height - pad - CAPTION - FRAME_BAR;
      const ratio = previewRotate ? format.h / format.w : format.w / format.h;
      let w = maxW, h = w / ratio;
      if (h > maxH) { h = maxH; w = h * ratio; }

      // NEVER CLAMP THE AXES INDEPENDENTLY.
      // A 118 × 5315 strap fits to about 13 × 600. The old `Math.max(80, w)` then
      // forced the width to 80 and left the height at 600 — an aspect of 0.133
      // where the artwork is 0.022, a 6× horizontal stretch. That is what was
      // "distorting" the lanyard: not the drawing code, a floor meant to stop a
      // canvas from vanishing that instead made it lie about its own shape.
      //
      // A minimum size is still worth having — a 13px-wide preview is useless — but
      // it has to be applied as a UNIFORM scale-up, and the viewport scrolls. The
      // aspect ratio is not negotiable; the size is.
      const MIN_EDGE = 60;
      const k = Math.max(1, MIN_EDGE / Math.max(1, Math.min(w, h)));
      w *= k; h *= k;

      // previewSize is always the UNROTATED canvas box; the wrapper below takes
      // the rotated footprint, because a CSS transform does not change layout size.
      setPreviewSize(previewRotate ? { w: h, h: w } : { w, h });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [format, previewRotate]);

  // Leaving a format zoomed 4× into a strap and then switching to an A4 is a
  // small betrayal — reset the view when the canvas changes shape.
  useEffect(() => { setPreviewZoom(1); setPreviewRotate(false); }, [formatKey]);

  useEffect(() => {
    if (!FORMAT_LAYOUTS[formatKey].includes(layoutKey)) {
      setLayoutKey(FORMAT_LAYOUTS[formatKey][0]);
    }
  }, [formatKey, layoutKey]);

  // A strap can only carry a name and a URL. Switching to one should therefore
  // switch the template too — but never over content the user has already typed.
  useEffect(() => {
    if (FORMATS[formatKey]?.group === 'Print · wearables' && !contentEdited.current) {
      setTemplateKey('lanyard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatKey]);

  // A carousel format opens with 3 slides; every other screen format starts as a
  // single post and the user adds slides with + under the canvas.
  useEffect(() => {
    if (FORMATS[formatKey]?.multi && carouselSlides === 1) setSlideCount(3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatKey]);

  // Pages are DERIVED from the body's PAGE_BREAK markers — edit a break, re-flow.
  const pages = useMemo(() => splitAgendaPages(content), [content]);
  const curPage = pages ? Math.min(pageIdx, pages.length - 1) : 0;
  // Keep the page index valid when a break is removed and the page count drops.
  useEffect(() => { if (pages && pageIdx > pages.length - 1) setPageIdx(Math.max(0, pages.length - 1)); }, [pages, pageIdx]);
  // Pages are just PAGE_BREAK markers in the body, so adding/removing one is a
  // body edit — the existing re-flow, per-page images and fits all keep working.
  const pageCount = pages ? pages.length : 1;
  const bodyChunks = () => (content.body || '').split(PAGE_BREAK).map((s) => s.replace(/^\n+|\n+$/g, ''));
  const addPage = () => {
    const raw = (content.body || '').replace(/\s+$/, '');
    updateField('body', `${raw}\n${PAGE_BREAK}\n`);
    setPageIdx(pageCount); // jump to the page we just created
  };
  const deletePage = async (i) => {
    const chunks = bodyChunks();
    if (chunks.length <= 1) return;
    const hasWork = (chunks[i] || '').trim().length > 0;
    if (hasWork && !(await askConfirm({
      title: `Delete page ${i + 1}?`,
      body: 'Its lines, image and crop will be removed.',
    }))) return;
    chunks.splice(i, 1);
    updateField('body', chunks.join(`\n${PAGE_BREAK}\n`).replace(/\n{3,}/g, '\n\n'));
    setPageImages((p) => p.filter((_, k) => k !== i));
    setPageFits((p) => p.filter((_, k) => k !== i));
    setPageIdx((idx) => Math.max(0, Math.min(idx, chunks.length - 2)));
  };

  // Active values (per-slide for carousels; per-page for a paginated agenda)
  const activeContent = pages
    ? (pages[curPage] || content)
    : (format.multi ? (carouselContent[carouselSlide] || initialContent) : content);
  const activeImage   = isBrochure ? (brochureImgs[brochurePage?.id] || null)
                      : pages ? (pageImages[curPage] || image) : (format.multi ? carouselImages[carouselSlide]   : image);
  const activeFit     = isBrochure ? (brochurePage?.fit || DEFAULT_FIT)
                      : pages ? (pageFits[curPage] || DEFAULT_FIT) : (format.multi ? (carouselFits[carouselSlide] || DEFAULT_FIT) : imageFit);
  // Per-slide image picker is redundant when a spanning bg is covering the image area
  const perSlideImageDisabled = format.multi
    && carouselBg.enabled
    && !!carouselBgImage
    && (carouselBg.placement === 'full' || carouselBg.placement === 'image');

  // ── PDF export (optional bleed + crop marks) ────────────────────
  // Declared up here because the BRAND CHECK below reads pdfBleed.
  const [pdfBleed, setPdfBleed] = useState(true);
  const [pdfCropMarks, setPdfCropMarks] = useState(true);
  const [pdfVector, setPdfVector] = useState(true);    // vectorise text + wordmark
  const [pdfCropColor, setPdfCropColor] = useState('auto'); // 'auto' | 'ink' | 'bone'
  const [pdfMarks, setPdfMarks] = useState({ ...PDF_MARK_DEFAULTS });
  // IMAGE COMPRESSION. The image layer was always PNG — lossless, and a 300 dpi A4
  // of a photograph lands around 30 MB, which bounces off mail servers. JPEG at 92
  // is visually identical on press and roughly a tenth of the size. PNG stays
  // available because flat colour and hard type edges are exactly where JPEG's
  // ringing shows.
  const [pdfImageFormat, setPdfImageFormat] = useState('jpeg');   // 'jpeg' | 'png'
  const [pdfJpegQuality, setPdfJpegQuality] = useState(0.92);
  const [pdfDownsample, setPdfDownsample] = useState(0);          // 0 = off, else target ppi
  const [pdfPageRange, setPdfPageRange] = useState('');           // '' = all, else "1,3-5"
  const [pdfSeparateFiles, setPdfSeparateFiles] = useState(false);

  const pdfPageLabel = () => {
    const d = new Date().toISOString().slice(0, 10);
    return `${(autoName || 'medartis').slice(0, 60)} · ${formatKey} · ${d}`;
  };

  /**
   * Which pages to export. "" → all. "1,3-5" → those.
   * Invalid input yields ALL rather than nothing: exporting everything when the
   * range is unparseable is recoverable; exporting an empty PDF looks like a crash.
   */
  const parsePageRange = (spec, count) => {
    const t = (spec || '').trim();
    if (!t) return Array.from({ length: count }, (_, i) => i);
    const out = new Set();
    for (const part of t.split(',')) {
      const m = part.trim().match(/^(\d+)\s*(?:-\s*(\d+))?$/);
      if (!m) continue;
      const a = Math.max(1, parseInt(m[1], 10));
      const b = m[2] ? Math.min(count, parseInt(m[2], 10)) : a;
      for (let i = a; i <= b && i <= count; i++) out.add(i - 1);
    }
    return out.size ? [...out].sort((x, y) => x - y) : Array.from({ length: count }, (_, i) => i);
  };

  // ── LIVE BRAND CHECK (guide-derived, recomputed on every change) ────
  // Every check states WHY it passed/failed with the real number, and — where a
  // machine can safely resolve it — carries a one-click `fix`.
  const brandChecks = useMemo(() => {
    const checks = [];
    const fmt = FORMATS[formatKey] || {};
    const isPrint = !!fmt.printable;
    const dpi = fmt.printDpi || 300;

    // 0 · CLEAR SPACE — 1.5 × the height of the "d", on every side.
    // Enforced in computeWordmarkBox, so this reports the measurement rather than
    // policing it. A check that can only ever say "pass" still earns its place:
    // it shows the number, so the rule is inspectable instead of merely asserted.
    if (wordmarkPos !== 'hidden') {
      const fmt0 = FORMATS[formatKey] || {};
      const fr = { w: fmt0.w, h: fmt0.h, padX: Math.min(fmt0.w, fmt0.h) * 0.07, padY: Math.min(fmt0.w, fmt0.h) * 0.07 };
      const box = computeWordmarkBox(fr, wordmarkPos, formatKey, null, wordmarkPctOverride);
      if (box) {
        const gaps = [box.x, box.y, fr.w - (box.x + box.w), fr.h - (box.y + box.h)];
        const worst = Math.min(...gaps) / box.h;      // in units of the "d"
        const ok = worst >= WM_CLEAR_RATIO - 0.01;
        checks.push({
          ok: ok ? 'pass' : 'fail',
          label: 'Logo clear space',
          note: `${worst.toFixed(2)} × d on the tightest side · rule ${WM_CLEAR_RATIO} × d`
            + (ok ? '' : ' — the mark is being crowded'),
          fix: null,
        });
      }
    }

    // 0a · LONG COPY — what happens at the legibility floor.
    // STATED, not measured: the text band is per-layout, and the geometry that
    // knows it is declared BELOW this useMemo — calling it from here would be a TDZ
    // error, the exact bug class that has bitten this file twice. So the check says
    // which policy is in force rather than pretending to have measured it.
    checks.push({
      ok: textOverflow === 'allow' ? 'warn' : 'pass',
      label: `Long copy · ${textOverflow}`,
      note: textOverflow === 'trim'
        ? 'the body is cut at the 55% floor and marked with an ellipsis — always fits'
        : textOverflow === 'shrink'
          ? 'every word kept, type may go to 28% — below what the guide calls legible'
          : 'copy may run past its band, over the image and off the canvas — nothing will say so',
      fix: textOverflow === 'allow' ? { label: 'Trim instead', apply: () => setTextOverflow('trim') } : null,
    });

    // 0b · TYPE FITS THE BAND. Measured on the last draw, not estimated: the type
    // engine shrinks to fit (down to 55%), and if it is STILL too tall the copy is
    // simply too long for this band. Saying so beats letting the text run under the
    // image — which is what it used to do, and what nobody could see was deliberate.
    if (typeFit.bandH > 0) {
      const over = typeFit.overflow;
      checks.push({
        ok: (over > 1 || typeFit.trimmed) ? 'warn' : 'pass',
        label: 'Copy fits the text band',
        note: typeFit.trimmed
          ? `your copy was CUT to fit — the body ends in an ellipsis. Shorten it, or pick a layout with a deeper band`
          : over > 1
            ? `${Math.round(over)} px too long even at the ${Math.round(typeFit.scale * 100)}% floor — shorten the copy, or pick a layout with a deeper band`
            : `fits at ${Math.round(typeFit.scale * 100)}% of the type scale`,
        fix: null,
      });
    }

    // 1 · Logo minimum size — below this the wordmark stops being legible.
    // The strap is exempt because it does not HAVE a brand bar: its mark is
    // composed by the lanyard layout at 46% of the strap width. Measuring the
    // brand-bar wordmark on a lanyard reports a failure about a thing that is not
    // on the canvas — a false alarm teaches people to ignore the panel.
    if (wordmarkPos !== 'hidden' && layoutKey !== 'lanyard') {
      const wmBox = wordmarkSizeFor({ w: fmt.w, h: fmt.h }, formatKey, wordmarkPctOverride);
      const min = { px: 60, mm: 16 };
      const val = isPrint ? (wmBox.w / dpi) * 25.4 : wmBox.w;
      const ok = isPrint ? val >= min.mm : val >= min.px;
      checks.push({
        ok: ok ? 'pass' : 'warn',
        label: 'Logo minimum size',
        note: isPrint
          ? `${val.toFixed(0)} mm · min ${min.mm} mm${ok ? '' : ' — enlarge it'}`
          : `${val.toFixed(0)} px · min ${min.px} px${ok ? '' : ' — enlarge it'}`,
        fix: ok ? null : {
          label: 'Enlarge to minimum',
          apply: () => {
            const shortSide = Math.min(fmt.w, fmt.h);
            const targetPx = isPrint ? (min.mm / 25.4) * dpi : min.px;
            setWordmarkPctOverride(clamp((targetPx * 1.05) / shortSide, 0.04, 0.45));
          },
        },
      });
      checks.push({ ok: 'pass', label: 'Clear space', note: 'the mark keeps its clear space on all four sides — it can never be cropped' });
    } else {
      checks.push({
        ok: 'warn',
        label: 'No logo on this canvas',
        note: 'only for carrier pieces already inside a branded context — the sender line must still identify Medartis',
        fix: { label: 'Put the logo back (top right)', apply: () => setWordmarkPos('tr') },
      });
    }

    // 2 · Headline ink vs surface (WCAG AA: 4.5:1 normal, 3:1 large/bold).
    const inkCr = contrastRatio(palette.ink, palette.bg);
    checks.push({
      ok: inkCr >= 4.5 ? 'pass' : inkCr >= 3 ? 'warn' : 'fail',
      label: 'Headline contrast (WCAG AA)',
      note: `${inkCr.toFixed(1)}:1${inkCr >= 4.5 ? '' : inkCr >= 3 ? ' — large/bold text only (18pt+ / 14pt+ bold)' : ' — fails AA, change the surface'}`,
      fix: inkCr >= 4.5 ? null : {
        label: palette.mode === 'dark' ? 'Switch surface → Bone' : 'Switch surface → Coal',
        apply: () => setPaletteName(palette.mode === 'dark' ? 'bone' : 'coal'),
      },
    });

    // 3 · Body / muted text vs surface.
    const mutedCr = contrastRatio(palette.muted, palette.bg);
    checks.push({
      ok: mutedCr >= 4.5 ? 'pass' : mutedCr >= 3 ? 'warn' : 'fail',
      label: 'Body text contrast',
      note: `${mutedCr.toFixed(1)}:1${mutedBoost ? ' · boosted' : ''}`,
      fix: mutedCr >= 4.5 ? null : (!mutedBoost
        ? { label: 'Boost body text', apply: () => setMutedBoost(true) }
        : { label: palette.mode === 'dark' ? 'Switch surface → Bone' : 'Switch surface → Coal',
            apply: () => setPaletteName(palette.mode === 'dark' ? 'bone' : 'coal') }),
    });

    // 4 · The gold accent (eyebrow · rule · CTA). The brand gold is only ~2:1 on
    //     light surfaces — a real accessibility trap the guide doesn't call out.
    const accCr = contrastRatio(accentColor, palette.bg);
    checks.push({
      ok: accCr >= 4.5 ? 'pass' : accCr >= 3 ? 'warn' : 'fail',
      label: 'Gold accent contrast',
      note: `${accCr.toFixed(1)}:1${accentSafe && palette.mode !== 'dark' ? ' · deep gold' : ''}${accCr >= 4.5 ? '' : ' — the brand gold is low-contrast on light surfaces'}`,
      fix: accCr >= 4.5 ? null : (!accentSafe
        ? { label: 'Use the accessible deep gold', apply: () => setAccentSafe(true) }
        : { label: 'Switch surface → Coal', apply: () => setPaletteName('coal') }),
    });

    // 4b · Logo legibility OVER IMAGERY — the real, measured number. This is the
    //      one that actually decides whether the mark survives on a photo.
    if ((wordmarkOverImage || layoutKey === 'overlay') && activeImage && wordmarkPos !== 'hidden') {
      const L = logoLegib;
      const busy = L.std > LOGO_MAX_STD;
      checks.push({
        ok: L.safe ? 'pass' : 'warn',
        label: 'Logo legibility over the image',
        note: L.protected
          ? `${L.best.toFixed(1)}:1 · protected by a ${L.mode === 'auto' ? 'plate' : L.mode}`
          : `${L.best.toFixed(1)}:1${busy ? ' · busy background under the mark' : ''}${L.safe ? ' · clean enough to go bare' : ' — the mark will not hold'}`,
        fix: L.safe ? null : { label: 'Protect the logo', apply: () => setLogoPlate('plate') },
      });
    }

    // 5 · Gold discipline (guide) — stated, not measurable.
    checks.push({ ok: 'pass', label: 'Gold discipline', note: 'gold only as eyebrow, rule, CTA & accents — never a background or body text' });

    // 6 · Photography protection.
    if (layoutKey === 'overlay' && activeImage) {
      checks.push({ ok: 'pass', label: 'Photo overlay', note: 'darkening scrim + auto-contrast logo/text protection active' });
    }

    // 7 · Print readiness.
    if (isPrint) {
      checks.push({
        ok: pdfBleed ? 'pass' : 'warn',
        label: 'Print bleed',
        note: pdfBleed ? '3 mm bleed + crop marks on PDF export' : 'no bleed — the printer needs 3 mm to trim into',
        fix: pdfBleed ? null : { label: 'Turn bleed on', apply: () => setPdfBleed(true) },
      });
    }

    return checks;
  }, [formatKey, wordmarkPos, wordmarkPctOverride, palette, accentColor, mutedBoost, accentSafe, layoutKey, activeImage, pdfBleed, wordmarkOverImage, logoLegib, typeFit, textOverflow]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = format.w;
    canvas.height = format.h;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic';

    const pad = Math.min(format.w, format.h) * 0.07;
    const frame = { w: format.w, h: format.h, padX: pad, padY: pad, formatKey };

    // A brochure page draws itself from its TYPE — none of the poster layouts,
    // wordmark placement or carousel chrome applies here.
    if (isBrochure) {
      drawBrochurePage(ctx, frame, brochureImgs[brochurePage?.id] || null, brochureOpts());
      return;
    }

    const layout = LAYOUTS[layoutKey];
    if (layout) {
      // Per-slide overrides for carousel mode
      const slideShowsFolio = format.multi ? (carouselFolioPer[carouselSlide] ?? true) : true;
      const slideShowsQr    = format.multi ? (carouselQrPer[carouselSlide]    ?? true) : true;
      // Resolve textBackdrop tint based on palette + override
      const tintFor = (mode) => {
        if (textBackdrop.tint === 'ink')  return 'rgba(19,19,16,0.6)';
        if (textBackdrop.tint === 'bone') return 'rgba(250,248,240,0.55)';
        return mode === 'dark' ? 'rgba(19,19,16,0.32)' : 'rgba(255,255,255,0.32)';
      };
      const backdropOpt = textBackdrop.enabled
        ? { ...textBackdrop, tint: tintFor(palette.mode) }
        : null;
      layout.draw(ctx, frame, activeContent, activeImage, {
        palette, accent: accentColor, fit: activeFit,
        lanyard, fitOut: fitRef.current, textOverflow,
        partners: { ...partners, logos: partnerLogos }, surface, group,
      // Duo compares TWO pictures: the next carousel slide's image is the second
      // one. No new field — a layout that demands its own content model is a
      // layout nobody reaches for.
      duoImage: format.multi ? (carouselImages[(carouselSlide + 1) % carouselSlides] || null) : null,
        wordmarkPos,
        folioPos: slideShowsFolio ? folioPos : 'hidden',
        formatKey,
        wordmarkOverImage, folioOverImage,
        wordmarkColor, folioColor, folioText, wordmarkPctOverride,
        logoPlate, legibilityOut: legibRef.current,
        qr: slideShowsQr ? qrConfig : { ...qrConfig, enabled: false },
        qrImage: slideShowsQr ? qrImage : null,
        carouselBg: { ...carouselBg, image: carouselBgImage },
        slideIdx: format.multi ? carouselSlide : 0,
        totalSlides: format.multi ? carouselSlides : 1,
        textBackdrop: backdropOpt,
      });
      // Surface the measured legibility to the BRAND CHECK panel. Identity is
      // preserved when nothing material changed, so this can't loop.
      const F = fitRef.current;
      setTypeFit((prev) => (
        Math.abs(prev.scale - F.scale) < 0.005 && Math.abs(prev.overflow - F.overflow) < 0.5
          ? prev : { ...F }
      ));

      const L = legibRef.current;
      setLogoLegib((prev) => (
        prev.safe === L.safe && prev.protected === L.protected && prev.mode === L.mode
        && Math.abs(prev.best - L.best) < 0.05 && Math.abs(prev.std - L.std) < 0.5
          ? prev : { ...L }
      ));
    }

    if (format.multi) {
      const dotY = format.h - pad * 0.22;
      const dotR = format.w * 0.005;
      const gap = dotR * 4;
      const totalW = (carouselSlides - 1) * gap;
      const startX = format.w / 2 - totalW / 2;
      for (let i = 0; i < carouselSlides; i++) {
        ctx.fillStyle = i === carouselSlide ? BRAND.gold : (palette.mode === 'dark' ? 'rgba(230,227,213,0.35)' : 'rgba(85,85,80,0.35)');
        ctx.beginPath();
        ctx.arc(startX + i * gap, dotY, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [format, layoutKey, activeContent, activeImage, activeFit, palette, carouselSlides, carouselSlide, wordmarkPos, folioPos, formatKey, wordmarkOverImage, folioOverImage, wordmarkColor, folioColor, folioText, qrConfig, qrImage, carouselBg, carouselBgImage, carouselQrPer, carouselFolioPer, textBackdrop, wordmarkPctOverride, wmReady, logoPlate, accentColor, isBrochure, brochurePage, brochureImgs, brochureTitle, curBrochure, partnerLogos, partners, lanyard, textOverflow, surface, group]);

  useEffect(() => { draw(); }, [draw]);

  // Non-passive wheel listener so we can preventDefault to stop the page scrolling
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!activeImage) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      updateFit({ scale: clamp(activeFit.scale * factor, 0.1, 5) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [activeImage, activeFit.scale, format.multi, carouselSlide]);

  // ── Per-slide mutators ───────────────────────────────────────────
  const updateField = (key, value) => {
    contentEdited.current = true; // real copy now exists — protect it on template switches
    // The moment you type, the undo's snapshot describes a state you have moved on
    // from. Restoring it would silently discard the edit you just made — an undo
    // that destroys work is the exact opposite of an undo. So it retires.
    setUndo(null);
    if (format.multi) {
      const next = [...carouselContent];
      next[carouselSlide] = { ...(next[carouselSlide] || initialContent), [key]: value };
      setCarouselContent(next);
    } else {
      setContent({ ...content, [key]: value });
    }
  };

  const updateFit = (patch) => {
    if (isBrochure) {
      // Each brochure page owns its crop, so § 08 IMAGE FIT edits THIS page.
      const id = brochurePage?.id;
      if (id) setBrochurePages((ps) => ps.map((pg) => (pg.id === id ? { ...pg, fit: { ...(pg.fit || DEFAULT_FIT), ...patch } } : pg)));
    } else if (pages) {
      // Per-page image transform (size/position/rotation/fade) — keyed to this page.
      setPageFits((p) => { const a = [...p]; while (a.length < pages.length) a.push({ ...DEFAULT_FIT }); a[curPage] = { ...(a[curPage] || DEFAULT_FIT), ...patch }; return a; });
    } else if (format.multi) {
      const next = [...carouselFits];
      next[carouselSlide] = { ...(next[carouselSlide] || DEFAULT_FIT), ...patch };
      setCarouselFits(next);
    } else {
      setImageFit({ ...imageFit, ...patch });
    }
  };

  const setSlideCount = (n) => {
    const newCount = Math.max(1, Math.min(10, n));
    setCarouselSlides(newCount);
    const grow = (arr, fill) => {
      const out = [...arr];
      while (out.length < newCount) out.push(typeof fill === 'function' ? fill() : fill);
      return out.slice(0, newCount);
    };
    setCarouselContent(c => grow(c, () => ({ ...initialContent })));
    setCarouselImages(c => grow(c, null));
    setCarouselFits(c => grow(c, () => ({ ...DEFAULT_FIT })));
    setCarouselQrPer(c => grow(c, true));
    setCarouselFolioPer(c => grow(c, true));
    if (carouselSlide >= newCount) setCarouselSlide(newCount - 1);
  };

  const applyImage = (imgOrSrc) => {
    const assign = (img) => {
      if (isBrochure) {
        const id = brochurePage?.id;
        if (id) setBrochureImgs((m) => ({ ...m, [id]: img }));
      } else if (pages) {
        // Per-page image: set just this page's background, leave the others.
        setPageImages((p) => { const a = [...p]; while (a.length < pages.length) a.push(null); a[curPage] = img; return a; });
      } else if (format.multi) {
        const next = [...carouselImages];
        next[carouselSlide] = img;
        setCarouselImages(next);
      } else {
        setImage(img);
      }
      // reset fit to default when changing image
      updateFit({ ...DEFAULT_FIT });
    };
    if (typeof imgOrSrc === 'string') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => assign(img);
      img.src = imgOrSrc;
    } else {
      assign(imgOrSrc);
    }
  };

  const download = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `medartis-${formatKey}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const downloadAllSlides = async () => {
    for (let i = 0; i < carouselSlides; i++) {
      setCarouselSlide(i);
      await new Promise(r => setTimeout(r, 200));
      const canvas = canvasRef.current;
      const link = document.createElement('a');
      link.download = `medartis-${formatKey}-slide-${i + 1}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      await new Promise(r => setTimeout(r, 250));
    }
  };

  // A paginated agenda: export one PNG per content page. Rendered off-screen
  // with each page's own content, image and fit, so we don't flicker the live
  // preview and every page keeps its own crop/rotation/fades.
  const downloadAllBrochurePages = async () => {
    for (let i = 0; i < brochurePages.length; i++) {
      const pg = brochurePages[i];
      const c = renderOffscreenCanvas(false, pg, brochureImgs[pg.id] || null, pg.fit || DEFAULT_FIT, 1, 0, 0);
      const link = document.createElement('a');
      link.download = `medartis-brochure-${String(i + 1).padStart(2, '0')}-${pg.type}.png`;
      link.href = c.toDataURL('image/png');
      link.click();
      await new Promise((r) => setTimeout(r, 250));
    }
  };

  const downloadAllPages = async () => {
    if (!pages) return;
    for (let i = 0; i < pages.length; i++) {
      const c = renderOffscreenCanvas(false, pages[i], pageImages[i] || image, pageFits[i] || DEFAULT_FIT, 1, 0, 0);
      const link = document.createElement('a');
      link.download = `medartis-${formatKey}-page-${i + 1}.png`;
      link.href = c.toDataURL('image/png');
      link.click();
      await new Promise(r => setTimeout(r, 250));
    }
  };


  // Render the current state to an OFFSCREEN canvas with the same pipeline
  // as the live preview, optionally skipping overlays. Used to produce a
  // text-free bitmap layer when the PDF text/wordmark are being vectorised.
  const renderOffscreenCanvas = (skipOverlays, contentOverride, imageOverride, fitOverride, scale = 1, slideIdxOverride, bleedPxIn = 0) => {
    const c = document.createElement('canvas');
    const trimW = Math.round(format.w * scale);
    const trimH = Math.round(format.h * scale);
    const bleedPx = Math.round(bleedPxIn * scale);
    c.width  = trimW + bleedPx * 2;
    c.height = trimH + bleedPx * 2;
    const ctx = c.getContext('2d');
    ctx.textBaseline = 'alphabetic';
    ctx.imageSmoothingQuality = 'high';
    // Shift so the layout's (0,0) lands inside the trim area
    if (bleedPx) ctx.translate(bleedPx, bleedPx);
    const pad = Math.min(trimW, trimH) * 0.07;
    const frame = { w: trimW, h: trimH, padX: pad, padY: pad, bleedPx, formatKey };
    if (isBrochure) {
      // contentOverride carries the brochure PAGE when exporting a whole document.
      const page = (contentOverride && contentOverride.type) ? contentOverride : brochurePage;
      const pageNo = 1 + brochurePages.findIndex((p) => p.id === page?.id);
      drawBrochurePage(ctx, frame, imageOverride === 'none' ? null : (imageOverride ?? brochureImgs[page?.id] ?? null), {
        palette, accent: accentColor,
        fit: fitOverride ?? page?.fit ?? DEFAULT_FIT,
        brochurePage: page, pageNumber: pageNo || 1, brochureTitle,
        partners: { ...partners, logos: partnerLogos }, surface, group,
      });
      return c;
    }
    const layout = LAYOUTS[layoutKey];
    const idx = slideIdxOverride ?? (format.multi ? carouselSlide : 0);
    const slideShowsFolio = format.multi ? (carouselFolioPer[idx] ?? true) : true;
    const slideShowsQr    = format.multi ? (carouselQrPer[idx]    ?? true) : true;
    layout.draw(ctx, frame, contentOverride ?? activeContent,
      // 'none' means DELIBERATELY no photograph — that is how the control map is
      // derived: render the layout bare, and what is left is type and mark.
      imageOverride === 'none' ? null : (imageOverride ?? activeImage), {
      palette, accent: accentColor,
      lanyard, textOverflow, partners: { ...partners, logos: partnerLogos }, surface, group,
      // Duo compares TWO pictures: the next carousel slide's image is the second
      // one. No new field — a layout that demands its own content model is a
      // layout nobody reaches for.
      duoImage: format.multi ? (carouselImages[(carouselSlide + 1) % carouselSlides] || null) : null,
      fit: fitOverride ?? activeFit,
      wordmarkPos,
      folioPos: slideShowsFolio ? folioPos : 'hidden',
      formatKey,
      wordmarkOverImage, folioOverImage,
      wordmarkColor, folioColor, folioText,
      logoPlate,
      skipOverlays,
      carouselBg: { ...carouselBg, image: carouselBgImage },
      slideIdx: idx,
      totalSlides: format.multi ? carouselSlides : 1,
      qr: slideShowsQr ? qrConfig : { ...qrConfig, enabled: false },
      qrImage: slideShowsQr ? qrImage : null,
      textBackdrop: textBackdrop.enabled ? {
        ...textBackdrop,
        tint: textBackdrop.tint === 'ink'  ? 'rgba(19,19,16,0.6)'
            : textBackdrop.tint === 'bone' ? 'rgba(250,248,240,0.55)'
            : (palette.mode === 'dark' ? 'rgba(19,19,16,0.32)' : 'rgba(255,255,255,0.32)'),
      } : null,
    });
    return c;
  };

  // The layout, turned into a conditioning signal. § 08 calls this; the model
  // then composes AROUND the type instead of us cropping a photo afterwards.
  const makeControlMap = useCallback((kind = 'depth') => {
    try {
      const bare = renderOffscreenCanvas(false, undefined, 'none', undefined, 1, undefined, 0);
      return buildLayoutControlMapFrom(bare, palette.bg);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, layoutKey, activeContent, palette, wordmarkPos, folioPos, isBrochure, brochurePage, curBrochure]);

  // For PDF print export: compute a canvas multiplier that captures the source
  // image at its full native resolution. Capped so very large images don't
  // blow up memory.
  const computePdfBitmapScale = (slideImage, slideFit) => {
    if (!slideImage) return 1;
    const isWide = format.w / format.h > 1.4;
    const isOverlay = layoutKey === 'overlay';
    const defaultRatio = isWide ? 0.5 : 0.55;
    const ratio = clamp(slideFit?.frameRatio ?? defaultRatio, 0.15, 0.9);
    // Effective image rect (in canvas pixels at scale=1)
    let rectW, rectH;
    if (isOverlay)      { rectW = format.w;            rectH = format.h; }
    else if (isWide)    { rectW = format.w * ratio;    rectH = format.h; }
    else                { rectW = format.w;            rectH = format.h * ratio; }
    // How many src px per dst px in cover mode?
    const sX = slideImage.width  / rectW;
    const sY = slideImage.height / rectH;
    const ratioPx = Math.max(sX, sY);
    // Also factor in user scale (zoom in → don't need higher canvas res)
    const userScale = slideFit?.scale || 1;
    const needed = ratioPx / Math.max(0.5, userScale);
    return clamp(Math.ceil(needed * 10) / 10, 1, 4);
  };

  // Compute the text tokens and brand bar geometry for the CURRENT slide.
  // Used by the vector PDF path so we can emit vector text/wordmark.
  const computeSlideVectorParts = (slideContent, slideFit) => {
    const pad = Math.min(format.w, format.h) * 0.07;
    const frame = { w: format.w, h: format.h, padX: pad, padY: pad, formatKey };

    // We need a measurement canvas context so layoutTextElements can measure widths
    const measCanvas = document.createElement('canvas');
    measCanvas.width = format.w;
    measCanvas.height = format.h;
    const measCtx = measCanvas.getContext('2d');

    const opts = {
      palette, accent: accentColor,
      fit: slideFit, wordmarkPos, folioPos, formatKey,
      wordmarkOverImage, folioOverImage,
      wordmarkColor, folioColor, folioText, wordmarkPctOverride,
      logoPlate,
      qr: qrConfig,
    };

    let textTokens = [];
    let safeArea;
    let effectivePalette = palette;

    // The PDF lays the text out AGAIN, on its own. It must therefore apply the SAME
    // clearance and the SAME height budget as the canvas — otherwise the vector
    // print and the on-screen preview quietly disagree, which is the worst kind of
    // export bug: you only find it on paper.
    if (layoutKey === 'overlay') {
      // Overlay: image fills, text bottom-anchored, scrim coal palette
      effectivePalette = { bg: BRAND.coal, ink: BRAND.bone00, muted: BRAND.cream100, mode: 'dark' };
      safeArea = { x: 0, y: 0, w: frame.w, h: frame.h };
      const clearance = brandBarClearance(measCtx, frame, { ...opts, safeArea });
      const textBottomY = Math.min(frame.h - frame.padY * 1.7, clearance.bottomY);
      const oFrame = { ...frame, textMaxH: Math.max(80, textBottomY - clearance.topY - frame.padY * 1.2), textOverflow };
      textTokens = layoutTextElements(measCtx, slideContent, frame.padX, textBottomY, frame.w - frame.padX * 2, effectivePalette, BRAND.gold, oFrame, 'bottom');
    } else {
      const textPos = layoutKey === 'image-bottom' ? 'top' : 'bottom';
      const geom = computeSplitGeom(frame, opts, textPos);
      safeArea = geom.safeArea;
      const clearance = brandBarClearance(measCtx, frame, { ...opts, safeArea });
      const textRectX = frame.padX;
      const textW = geom.isWide ? (frame.w * 0.5 - frame.padX * 2) : (frame.w - frame.padX * 2);
      const textAreaY = Math.max(geom.textAreaY, clearance.topY);
      const tFrame = {
        ...frame,
        textMaxH: Math.max(80, Math.min(geom.textRect.y + geom.textRect.h, clearance.bottomY) - textAreaY - frame.padY * 0.5),
        textOverflow,   // the PDF re-lays the text: same policy, or print != preview
      };
      textTokens = layoutTextElements(measCtx, slideContent, textRectX, textAreaY, textW, palette, BRAND.gold, tFrame);
    }

    return { frame, palette: effectivePalette, opts: { ...opts, safeArea }, textTokens };
  };

  // Push the current canvas (or every slide for a carousel) into a PDF.
  // Page size = trim + bleed (mm) computed from format pixels / printDpi.
  // For non-printable formats we fall back to 72dpi and no bleed/marks.
  /**
   * The canvas → the bytes that go in the PDF.
   * Downsampling happens HERE, not in jsPDF: jsPDF would embed the full-resolution
   * image and merely scale it on the page, so the file stays enormous while
   * claiming to be 150 ppi.
   */
  const canvasToPdfImage = (canvas, widthMm) => {
    let src = canvas;
    if (pdfDownsample > 0 && widthMm > 0) {
      const targetPx = Math.round((widthMm / 25.4) * pdfDownsample);
      if (targetPx > 0 && targetPx < canvas.width) {
        const k = targetPx / canvas.width;
        const c = document.createElement('canvas');
        c.width = targetPx;
        c.height = Math.max(1, Math.round(canvas.height * k));
        const cx = c.getContext('2d');
        cx.imageSmoothingEnabled = true;
        cx.imageSmoothingQuality = 'high';   // the closest a canvas gets to bicubic
        cx.drawImage(canvas, 0, 0, c.width, c.height);
        src = c;
      }
    }
    return pdfImageFormat === 'jpeg'
      // JPEG has no alpha. Every layout paints its own background first, so this is
      // safe — but if a transparent canvas ever reaches here it would come out
      // black, hence the explicit note rather than a silent surprise.
      ? { data: src.toDataURL('image/jpeg', pdfJpegQuality), fmt: 'JPEG' }
      : { data: src.toDataURL('image/png'), fmt: 'PNG' };
  };

  const renderCanvasToPdf = (pdf, canvas, formatDef, bleedMm) => {
    const dpi = formatDef.printDpi || 72;
    const trimWmm = formatDef.w / dpi * 25.4;
    const trimHmm = formatDef.h / dpi * 25.4;
    const totalWmm = trimWmm + bleedMm * 2;
    const totalHmm = trimHmm + bleedMm * 2;

    // For bleed, re-render the canvas with the bleed extension so the image
    // actually bleeds beyond the trim. Fallback: solid colour fill for pages
    // that aren't printable (no DPI defined) so they still get the legacy look.
    if (bleedMm > 0) {
      const bleedPx = bleedMm * dpi / 25.4;
      const bleedCanvas = renderOffscreenCanvas(false, undefined, undefined, undefined, 1, undefined, bleedPx);
      const bi = canvasToPdfImage(bleedCanvas, totalWmm);
      pdf.addImage(bi.data, bi.fmt, 0, 0, totalWmm, totalHmm, undefined, 'FAST');
    } else {
      const dataUrl = canvas.toDataURL('image/png');
      const ti = canvasToPdfImage(canvas, trimWmm);
      pdf.addImage(ti.data, ti.fmt, 0, 0, trimWmm, trimHmm, undefined, 'FAST');
    }

    // Crop marks — drawn outside the trim, inside the bleed margin.
    // Colour adapts: auto picks white-ish for dark bg, near-black for light bg.
    if (formatDef.printable && bleedMm > 0) {
      pdfDrawMarks(pdf, {
        trimWmm, trimHmm, bleedMm,
        marks: { ...pdfMarks, crop: pdfCropMarks },
        rgb: resolveCropMarkRgb(palette, pdfCropColor),
        pageLabel: pdfPageLabel(),
      });
    }
    return { totalWmm, totalHmm };
  };

  const newPdfPage = (pdf, totalWmm, totalHmm) => {
    pdf.addPage([totalWmm, totalHmm], totalWmm > totalHmm ? 'landscape' : 'portrait');
  };

  // Render ONE PDF page in vector mode: bitmap-only canvas (no text/wordmark)
  // + vector text + vector wordmark + crop marks.
  const renderVectorPdfPage = async (pdf, slideContent, slideImage, slideFit, formatDef, bleedMm, slideIdx = 0) => {
    const dpi = formatDef.printDpi || 72;
    const trimWmm = formatDef.w / dpi * 25.4;
    const trimHmm = formatDef.h / dpi * 25.4;
    const totalWmm = trimWmm + bleedMm * 2;
    const totalHmm = trimHmm + bleedMm * 2;

    // Bleed background fill
    if (bleedMm > 0) {
      if (palette.cmyk) {
        pdf.setFillColor(palette.cmyk[0], palette.cmyk[1], palette.cmyk[2], palette.cmyk[3]);
      } else {
        const [r, g, b] = hexRgb(palette.bg);
        pdf.setFillColor(r, g, b);
      }
      pdf.rect(0, 0, totalWmm, totalHmm, 'F');
    }

    // Image-only canvas (skipOverlays) at full source resolution. The canvas
    // is allocated trim + bleed in size so images can bleed; the PNG covers
    // the FULL page area (trim + bleed).
    const bitmapScale = computePdfBitmapScale(slideImage, slideFit);
    const bleedPx = bleedMm * dpi / 25.4;
    const bitmap = renderOffscreenCanvas(true, slideContent, slideImage, slideFit, bitmapScale, slideIdx, bleedPx);
    const vi = canvasToPdfImage(bitmap, totalWmm);
    pdf.addImage(vi.data, vi.fmt, 0, 0, totalWmm, totalHmm, undefined, 'FAST');

    // Vector text + brand bar on top
    const pad = Math.min(formatDef.w, formatDef.h) * 0.07;
    const frame = { w: formatDef.w, h: formatDef.h, padX: pad, padY: pad, formatKey };
    const { textTokens, opts: vecOpts, palette: vecPalette } = computeSlideVectorParts(slideContent, slideFit);

    // Auto-contrast: sample the bitmap canvas under the wordmark / sender
    // so we pick a colour that actually contrasts with what's behind them.
    const bitmapCtx = bitmap.getContext('2d');
    const bitmapScaleX = bitmap.width  / (formatDef.w + (bleedMm * dpi / 25.4) * 2);
    const bitmapScaleY = bitmap.height / (formatDef.h + (bleedMm * dpi / 25.4) * 2);
    const sampleAt = (boxPx) => {
      if (!boxPx) return null;
      // Translate trim-coord box into bitmap coords (bitmap origin = bleed corner)
      const bpx = bleedMm * dpi / 25.4;
      const sx = (boxPx.x + bpx) * bitmapScaleX;
      const sy = (boxPx.y + bpx) * bitmapScaleY;
      const sw = boxPx.w * bitmapScaleX;
      const sh = boxPx.h * bitmapScaleY;
      return resolveAutoContrast(bitmapCtx, sx - sw * 0.2, sy - sh * 0.2,
                                 sw * 1.4, sh * 1.4,
                                 vecPalette.mode === 'dark');
    };
    const wmArea = vecOpts.wordmarkOverImage ? { x: 0, y: 0, w: formatDef.w, h: formatDef.h } : vecOpts.safeArea;
    const flArea = vecOpts.folioOverImage    ? { x: 0, y: 0, w: formatDef.w, h: formatDef.h } : vecOpts.safeArea;
    const wmBox = computeWordmarkBox(frame, vecOpts.wordmarkPos ?? 'tr', formatKey, wmArea);
    const fBox  = computeFolioBox(bitmapCtx, frame, vecOpts.folioPos ?? 'bl', formatKey, flArea, vecOpts.folioText || 'medartis.com');
    const wmAuto = vecOpts.wordmarkColor === 'auto' && (vecOpts.wordmarkOverImage || layoutKey === 'overlay');
    const flAuto = vecOpts.folioColor    === 'auto' && (vecOpts.folioOverImage    || layoutKey === 'overlay');
    const wmResolvedColor = wmAuto ? sampleAt(wmBox) : null;
    const flResolvedColor = flAuto ? sampleAt(fBox)  : null;

    // Intelligent text colour (overlay): sample the bitmap behind the text band
    // and flip the whole text block to ink on a light background — mirrors the
    // live-canvas logic so the PDF matches the preview.
    if (layoutKey === 'overlay' && !textBackdrop.enabled) {
      const bpx = bleedMm * dpi / 25.4;
      const bandTop = formatDef.h * 0.5;
      const bandH = Math.max(1, (formatDef.h - pad * 1.7) - bandTop);
      const lum = sampleCanvasLuminance(bitmapCtx,
        (pad + bpx) * bitmapScaleX, (bandTop + bpx) * bitmapScaleY,
        (formatDef.w - pad * 2) * bitmapScaleX, bandH * bitmapScaleY);
      if (lum > 145) {
        for (const t of textTokens) {
          if (t.color === BRAND.bone00) t.color = BRAND.ink;
          else if (t.color === BRAND.cream100) t.color = BRAND.ink600;
        }
      }
    }

    if (layoutKey === 'lanyard') {
      // The strap composes its own ROTATED repeat, so it cannot use the shared
      // text-token engine — but it still gets REAL vector: the wordmark's own
      // paths, rotated, and the embedded fonts for the type. Without this branch
      // the strap would survive only as the bitmap underneath, and a file named
      // "vector" would contain one image and zero text operators.
      pdfDrawLanyard(pdf, {
        wMm: formatDef.w / dpi * 25.4,
        hMm: formatDef.h / dpi * 25.4,
        content: slideContent,
        cfg: { ...LANYARD_DEFAULTS, ...lanyard },
        palette: vecPalette,
        accent: accentColor,
        bleedMm,
        group,
      });
    } else {
      pdfDrawTextTokens(pdf, textTokens, dpi, bleedMm);
      pdfDrawBrandBar(pdf, frame, vecPalette, formatKey, {
        ...vecOpts,
        wordmarkResolvedColor: wmResolvedColor,
        folioResolvedColor:    flResolvedColor,
      }, dpi, bleedMm);
    }

    // Vector QR code via svg2pdf
    if (qrConfig.enabled && qrConfig.url) {
      await pdfDrawQrVector(pdf, frame, vecPalette, qrConfig, qrInk, dpi, bleedMm);
    }

    // Crop marks (adaptive colour)
    if (formatDef.printable && bleedMm > 0) {
      pdfDrawMarks(pdf, {
        trimWmm, trimHmm, bleedMm,
        marks: { ...pdfMarks, crop: pdfCropMarks },
        rgb: resolveCropMarkRgb(palette, pdfCropColor),
        pageLabel: pdfPageLabel(),
      });
    }
    return { totalWmm, totalHmm };
  };

  const downloadPdf = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const formatDef = format;
    const bleedMm = (formatDef.printable && pdfBleed) ? 3 : 0;

    const dpi = formatDef.printDpi || 72;
    const trimWmm = canvas.width  / dpi * 25.4;
    const trimHmm = canvas.height / dpi * 25.4;
    const totalWmm = trimWmm + bleedMm * 2;
    const totalHmm = trimHmm + bleedMm * 2;

    // The file name says what the file IS — bleed, marks, vector. Someone opening
    // a folder of proofs a week later has only this to go on.
    const pdfBaseName = () => {
      const tags = [];
      if (bleedMm > 0) tags.push('print');
      if (pdfCropMarks && bleedMm > 0) tags.push('marks');
      if (pdfVector && PDF_FONT_CACHE.loaded) tags.push('vector');
      return `medartis-${formatKey}${tags.length ? '_' + tags.join('-') : ''}`;
    };

    // One constructor, so a separate-files export produces documents identical to
    // the combined one — including the registered fonts, without which the vector
    // path silently falls back to raster on file 2 onwards.
    const newPdfDoc = () => {
      const d = new jsPDF({
        orientation: totalWmm > totalHmm ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [totalWmm, totalHmm],
        compress: true,
      });
      if (pdfVector && PDF_FONT_CACHE.loaded) registerPdfFonts(d);
      return d;
    };

    const pdf = new jsPDF({
      orientation: totalWmm > totalHmm ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [totalWmm, totalHmm],
      compress: true,
    });

    if (pdfVector) {
      // Lazy-load + register Inter/JetBrainsMono once
      try { await ensurePdfFontsLoaded(); } catch (e) {
        alert('Could not load PDF fonts (' + e.message + '). Falling back to raster.');
      }
      if (PDF_FONT_CACHE.loaded) registerPdfFonts(pdf);
    }

    const renderSlide = async (slideIdx, doc = pdf) => {
      const slideContent = format.multi ? (carouselContent[slideIdx] || initialContent) : content;
      const slideImage   = format.multi ? carouselImages[slideIdx] : image;
      const slideFit     = format.multi ? (carouselFits[slideIdx] || DEFAULT_FIT) : imageFit;

      if (pdfVector && PDF_FONT_CACHE.loaded) {
        await renderVectorPdfPage(doc, slideContent, slideImage, slideFit, formatDef, bleedMm, slideIdx);
      } else {
        // Legacy raster path
        if (format.multi) {
          setCarouselSlide(slideIdx);
          await new Promise(r => setTimeout(r, 220));
        }
        renderCanvasToPdf(doc, canvasRef.current, formatDef, bleedMm);
      }
    };

    // A paginated agenda: one PDF page per content page (mirrors the carousel loop),
    // each with its own optional background image.
    const renderPage = async (idx, doc = pdf) => {
      const pageContent = pages[idx] || content;
      const pageImage = pageImages[idx] || image;
      const pageFit = pageFits[idx] || DEFAULT_FIT;
      if (pdfVector && PDF_FONT_CACHE.loaded) {
        await renderVectorPdfPage(doc, pageContent, pageImage, pageFit, formatDef, bleedMm, 0);
      } else {
        setPageIdx(idx);
        await new Promise(r => setTimeout(r, 220));
        renderCanvasToPdf(doc, canvasRef.current, formatDef, bleedMm);
      }
    };

    // How many frames does this document have, and which were asked for?
    const frameCount = isBrochure ? brochurePages.length
      : pages ? pages.length
      : format.multi ? carouselSlides : 1;
    const wanted = parsePageRange(pdfPageRange, frameCount);

    // Render ONE frame into the pdf it is handed. Separate-files mode calls this
    // with a fresh document each time; otherwise every frame lands in one.
    const renderFrame = async (i, doc, firstInDoc) => {
      if (!firstInDoc) newPdfPage(doc, totalWmm, totalHmm);
      if (isBrochure) {
        const bleedPx = Math.round((bleedMm / 25.4) * dpi);
        const pg = brochurePages[i];
        const c = renderOffscreenCanvas(false, pg, brochureImgs[pg.id] || null, pg.fit || DEFAULT_FIT, 1, 0, bleedPx);
        renderCanvasToPdf(doc, c, formatDef, bleedMm);
      } else if (pages) {
        await renderPage(i, doc);
      } else {
        await renderSlide(i, doc);
      }
    };

    if (pdfSeparateFiles && wanted.length > 1) {
      // A printer asking for "one PDF per page" is not being difficult — their
      // imposition software often takes single-page files. Each is numbered by its
      // REAL frame number, so page 3 is _03 even when the range started at 3.
      for (const i of wanted) {
        const doc = newPdfDoc();
        await renderFrame(i, doc, true);
        doc.save(`${pdfBaseName()}_${String(i + 1).padStart(2, '0')}.pdf`);
        await new Promise((r) => setTimeout(r, 150));   // browsers throttle rapid saves
      }
      if (pages) setPageIdx(pageIdx);
      return;
    }

    const restore = pageIdx;
    for (let n = 0; n < wanted.length; n++) {
      await renderFrame(wanted[n], pdf, n === 0);
    }
    if (pages) setPageIdx(restore);

    pdf.save(`${pdfBaseName()}-${Date.now()}.pdf`);
  };

  // ── Presets (localStorage + JSON import/export) ─────────────────
  const PRESET_KEY = 'medartis-bag-presets-v1';

  // Compress a data URL by downsampling to maxEdge px and re-encoding as JPEG.
  // Keeps storage size reasonable so localStorage doesn't blow its quota.
  const compressDataUrl = (img, maxEdge = 1600, quality = 0.82) => {
    const w = img.width, h = img.height;
    const longest = Math.max(w, h);
    if (longest <= maxEdge) {
      // Already small — still re-encode as JPEG for size
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/jpeg', quality);
    }
    const scale = maxEdge / longest;
    const tw = Math.round(w * scale), th = Math.round(h * scale);
    const c = document.createElement('canvas');
    c.width = tw; c.height = th;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, tw, th);
    return c.toDataURL('image/jpeg', quality);
  };

  // HTMLImageElement → serializable reference
  const imageToRef = (img) => {
    if (!img || !img.src) return null;
    const s = img.src;
    if (s.startsWith('data:')) {
      // Compress before storing so we don't blow localStorage's quota
      try { return { kind: 'data', src: compressDataUrl(img) }; }
      catch { return { kind: 'data', src: s }; }
    }
    try {
      const url = new URL(s, window.location.origin);
      if (url.origin === window.location.origin && url.pathname.startsWith('/library/')) {
        return { kind: 'library', src: url.pathname };
      }
      return { kind: 'remote', src: s };
    } catch {
      return { kind: 'remote', src: s };
    }
  };
  const refToImage = (ref) => new Promise((resolve) => {
    if (!ref || !ref.src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = ref.src;
  });

  /**
   * Picking a template. The whole point of this function is that it does NOT warn
   * on every switch: it computes what would actually differ, and only asks when
   * there are two real outcomes. A dialog that fires every time is a dialog nobody
   * reads by Thursday.
   */
  const chooseTemplate = async (key) => {
    if (key === templateKey) return;
    const impact = templateSwitchImpact({
      from: TEMPLATES[templateKey],
      to: TEMPLATES[key],
      content,
      carouselContent,
      isCarousel: !!format.multi,
      contentEdited: contentEdited.current,
    });

    // Snapshot BEFORE anything moves. This is what the undo restores, and it is
    // taken unconditionally: cheap, and the alternative is discovering you needed
    // it after the state is gone.
    const before = snapshotContent({ content, carouselContent, templateKey, layoutKey, carouselSlides });

    // Nothing typed, or the sample matches what you have → just switch. Silence is
    // the correct UI here.
    if (!impact.differs) {
      setTemplateKey(key);
      applySuggestedLayout(key);
      armUndo(before, key);
      return;
    }

    // A remembered answer skips the dialog — but never the undo. That is the deal:
    // you may silence the question, you may not lose the way back.
    let answer = tmplPref;
    if (!answer) {
      const res = await askTemplateChoice({
        title: `Switch to "${TEMPLATES[key].label}"?`,
        body: describeImpact(impact, TEMPLATES[key].label),
        dropped: impact.dropped,
        slides: impact.slidesReplaced,
      });
      if (res.answer === 'cancel') return;
      answer = res.answer;
      if (res.remember) {
        setTmplPref(answer);
        writeTemplatePref(answer);
      }
    }
    // "sample" is the answer to "the template does nothing" — it loads the copy
    // the template was written to show off, once.
    sampleOnceRef.current = answer === 'sample';
    setTemplateKey(key);
    applySuggestedLayout(key);
    armUndo(before, key);
  };

  // ── UNDO ──────────────────────────────────────────────────────────
  // The template effect runs asynchronously (it reacts to templateKey), so the
  // "after" state does not exist yet. Wait a tick, compare, and offer the undo
  // only when something actually changed — an undo bar that appears after a no-op
  // is noise, and noise is how a real one gets ignored.
  const armUndo = (before, key) => {
    setTimeout(() => {
      const after = snapshotContent({
        content: contentRef.current,
        carouselContent: carouselContentRef.current,
        templateKey: key,
        layoutKey: layoutRef.current,
        carouselSlides: slidesRef.current,
      });
      if (!snapshotDiffers(before, after)) return;
      setUndo({
        snap: before,
        lostWork: snapshotLostWork(before, after),
        label: TEMPLATES[key]?.label || key,
      });
    }, 0);
  };

  const applyUndo = () => {
    if (!undo) return;
    const s = undo.snap;
    // Restore in one go. contentEdited stays true: undoing does not make the
    // canvas pristine — it makes it what it was, which was edited.
    sampleOnceRef.current = false;
    undoingRef.current = true;      // the template effect must not re-apply defaults
    setTemplateKey(s.templateKey);
    setLayoutKey(s.layoutKey);
    setCarouselSlides(s.carouselSlides);
    setContent(s.content);
    setCarouselContent(s.carouselContent);
    setUndo(null);
  };

  // Three answers, and dismissal means CANCEL — the same rule as everywhere else:
  // the safe reading of a question nobody answered is "no".
  const [tmplAsk, setTmplAsk] = useState(null);
  // Unticked every time the dialog opens. A remember-box that stays ticked from
  // the last visit is how a standing instruction gets set by accident.
  const [tmplRemember, setTmplRemember] = useState(false);
  useEffect(() => { if (tmplAsk) setTmplRemember(false); }, [tmplAsk]);
  const askTemplateChoice = (o) => new Promise((resolve) => setTmplAsk({ ...o, resolve }));
  const closeTemplateAsk = (answer, remember = false) =>
    setTmplAsk((d) => { d?.resolve?.({ answer: answer ?? 'cancel', remember }); return null; });

  /** The template's own shape — but only into an empty seat. */
  const applySuggestedLayout = (key) => {
    if (layoutChosen.current) return;             // you chose; we defer
    const want = TEMPLATE_LAYOUT[key];
    if (want && FORMAT_LAYOUTS[formatKey].includes(want)) setLayoutKey(want);
  };

  const snapshotState = () => ({
    v: 2,
    savedAt: new Date().toISOString(),
    formatKey, layoutKey, templateKey, paletteName,
    wordmarkPos, folioPos,
    wordmarkOverImage, folioOverImage,
    wordmarkColor, folioColor, folioText, wordmarkPctOverride,
    logoPlate,
    qrConfig,
    carouselBg: carouselBg.imageSrc?.startsWith('data:')
      ? { ...carouselBg, imageSrc: null }   // skip giant data URLs in preset
      : carouselBg,
    // A BROCHURE **IS** ITS PAGES. Without this, saving a 12-page publication
    // stored the format and threw the document away — the preset would hand back
    // an empty brochure and look like the save had silently failed.
    //
    // Full-resolution data URLs are stripped on the way out: two embedded pages
    // blow the ~5 MB localStorage cap, and then NOTHING saves. A library ref
    // (public/library/…) is a path, so it re-attaches on load; an uploaded image
    // is the one thing that cannot survive, which is why the panel says so.
    brochurePages: brochurePages.map((pg) => ({
      ...pg,
      imageSrc: pg.imageSrc && pg.imageSrc.startsWith('data:') ? null : pg.imageSrc,
    })),
    brochureIdx: curBrochure,
    brochureTitle,
    lanyard,
    textOverflow,
    partners,
    partnerLogos: partnerLogos.map(({ img, src, ...rest }) => ({
      ...rest,
      src: src && src.startsWith('data:') ? null : src,
    })),
    carouselQrPer, carouselFolioPer,
    textBackdrop,
    content,
    carouselSlides, carouselSlide,
    carouselContent,
    imageFit,
    carouselFits,
    pageFits,
    imageRef: imageToRef(image),
    carouselImageRefs: carouselImages.map(imageToRef),
    pageImageRefs: pageImages.map(imageToRef),
  });

  const restoreState = async (preset) => {
    if (!preset || (preset.v !== 1 && preset.v !== 2)) return;
    // template change resets content/carousel, so set it first then wait one tick
    setTemplateKey(preset.templateKey);
    setFormatKey(preset.formatKey);
    setLayoutKey(preset.layoutKey);
    setPaletteName(preset.paletteName);
    setWordmarkPos(preset.wordmarkPos);
    setFolioPos(preset.folioPos);

    // The other half of the fix: saved is worthless without restored.
    if (Array.isArray(preset.brochurePages) && preset.brochurePages.length) {
      setBrochurePages(preset.brochurePages);
      setBrochureIdx(Math.min(preset.brochureIdx || 0, preset.brochurePages.length - 1));
    }
    if (typeof preset.brochureTitle === 'string') setBrochureTitle(preset.brochureTitle);
    if (preset.lanyard) setLanyard({ ...LANYARD_DEFAULTS, ...preset.lanyard });
    // Old presets restore as 'allow', because that WAS their behaviour. Restoring
    // them as 'trim' would silently start cutting copy in files that were saved
    // when nothing ever did — a migration that edits your work is not a migration.
    setTextOverflow(preset.textOverflow ?? 'allow');
    if (preset.partners) setPartners((p) => ({ ...p, ...preset.partners }));
    if (Array.isArray(preset.partnerLogos)) {
      // Only the ones whose src survived (a library path, not a stripped data URL).
      const keep = preset.partnerLogos.filter((l) => l && l.src);
      Promise.all(keep.map((l) => new Promise((res) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => res({ ...l, img });
        img.onerror = () => res(null);
        img.src = l.src;
      }))).then((loaded) => setPartnerLogos(loaded.filter(Boolean)));
    }
    setWordmarkOverImage(!!preset.wordmarkOverImage);
    setFolioOverImage(!!preset.folioOverImage);
    if (preset.wordmarkColor) setWordmarkColor(preset.wordmarkColor);
    if (preset.folioColor)    setFolioColor(preset.folioColor);
    if (typeof preset.folioText === 'string') setFolioText(preset.folioText);
    if (preset.wordmarkPctOverride !== undefined) setWordmarkPctOverride(preset.wordmarkPctOverride);
    if (preset.logoPlate) setLogoPlate(preset.logoPlate);
    if (preset.qrConfig) setQrConfig({ ...DEFAULT_QR, ...preset.qrConfig });
    if (preset.carouselBg) setCarouselBg(preset.carouselBg);
    if (Array.isArray(preset.carouselQrPer))    setCarouselQrPer(preset.carouselQrPer);
    if (Array.isArray(preset.carouselFolioPer)) setCarouselFolioPer(preset.carouselFolioPer);
    if (preset.textBackdrop) setTextBackdrop(preset.textBackdrop);
    await new Promise(r => setTimeout(r, 60));
    // Pages are steered by PAGE_BREAK markers IN the body. A Cadence deep-link sends
    // a pre-split `pages` array (clean body) — rebuild the marked body from it so the
    // breaks become editable. A generator-saved preset already carries markers in
    // content.body, so it round-trips as-is.
    const baseContent = preset.content || {};
    const markedBody = (Array.isArray(preset.pages) && preset.pages.length > 1)
      ? preset.pages.map((p) => (p && p.body) || '').filter(Boolean).join('\n' + PAGE_BREAK + '\n')
      : (baseContent.body ?? '');
    setContent({ ...baseContent, body: markedBody });
    setPageIdx(0);
    setCarouselSlides(preset.carouselSlides || 3);
    setCarouselSlide(preset.carouselSlide || 0);
    setCarouselContent(preset.carouselContent || []);
    setImageFit({ ...DEFAULT_FIT, ...(preset.imageFit || {}) });
    setCarouselFits((preset.carouselFits || []).map(f => ({ ...DEFAULT_FIT, ...(f || {}) })));
    // Images
    setImage(await refToImage(preset.imageRef));
    const imgs = await Promise.all((preset.carouselImageRefs || []).map(refToImage));
    setCarouselImages(imgs);
    const pageImgs = await Promise.all((preset.pageImageRefs || []).map(refToImage));
    setPageImages(pageImgs);
    setPageFits((preset.pageFits || []).map(f => ({ ...DEFAULT_FIT, ...(f || {}) })));
    // Imported content is real content — a later template correction must keep it.
    contentEdited.current = true;
  };

  const readPresets = () => {
    try { return JSON.parse(localStorage.getItem(PRESET_KEY) || '{}'); }
    catch { return {}; }
  };

  // ── DEEP-LINK PRESET (?preset=<base64url JSON>) ───────────────────
  // Cadence (the team planner) builds a pre-filled preset from a structured
  // request briefing and opens the generator with it — the designer starts
  // from an on-brand 80% draft instead of a blank canvas. Accepts base64url
  // (UTF-8 safe) or plain URL-encoded JSON. Runs once on mount.
  const presetParamLoaded = useRef(false);
  useEffect(() => {
    if (presetParamLoaded.current) return;
    presetParamLoaded.current = true;
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('preset');
      if (!raw) return;
      let json = null;
      try {
        json = JSON.parse(decodeURIComponent(raw));
      } catch {
        const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
        const bin = atob(b64);
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        json = JSON.parse(new TextDecoder().decode(bytes));
      }
      if (json && typeof json === 'object') {
        // Fill unspecified slots with the template's own defaults so a partial
        // preset (just content) still lands on a complete, valid state.
        const tplKey = TEMPLATES[json.templateKey] ? json.templateKey : 'congress';
        const tpl = TEMPLATES[tplKey];
        const defaults = {};
        (tpl.fields || []).forEach((f) => { defaults[f.key] = f.default ?? ''; });
        restoreState({
          v: 2,
          templateKey: tplKey,
          formatKey: FORMATS[json.formatKey] ? json.formatKey : 'a4-portrait',
          layoutKey: json.layoutKey || 'overlay',
          paletteName: json.paletteName || 'coal',
          wordmarkPos: json.wordmarkPos || 'tr',
          folioPos: json.folioPos || 'bl',
          ...json,
          content: { ...defaults, ...(json.content || {}) },
        });
      }
    } catch (e) {
      console.warn('Ignoring invalid ?preset= parameter:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── DEMO GALLERY SEED ────────────────────────────────────────────
  // Each recipe is a minimal description — the seeder builds a full preset
  // object from the template's carouselContent + library image references.
  const DEMO_RECIPES = [
    // Carousel storytelling — coal palette, library imagery from 02-assets
    { templateKey: 'product-tour',       formatKey: 'ig-carousel',  paletteName: 'coal',
      imageRefs: ['plates-coal', 'instruments-bone', 'plates-bone', 'tray-coal'] },
    { templateKey: 'surgical-technique', formatKey: 'ig-carousel',  paletteName: 'coal',
      imageRefs: ['ibra-lab-01', 'fracture', 'plates-bone', 'distal-ulna', 'ibra-lab-02'] },
    { templateKey: 'case-study',         formatKey: 'li-carousel',  paletteName: 'bone',
      imageRefs: ['xray-sizer', 'plates-bone', 'people-03'] },
    { templateKey: 'launch-countdown',   formatKey: 'ig-carousel',  paletteName: 'coal',
      imageRefs: ['tray-coal', 'plates-coal', 'instruments-bone', 'plates-bone'] },
    { templateKey: 'anniversary',        formatKey: 'li-carousel',  paletteName: 'coal',
      imageRefs: ['people-lab', 'people-02', 'people-03'] },
    { templateKey: 'did-you-know',       formatKey: 'ig-carousel',  paletteName: 'cream',
      imageRefs: ['fracture', 'xray-sizer', 'plates-bone', 'distal-ulna', 'instruments-bone'] },
    { templateKey: 'before-after',       formatKey: 'ig-carousel',  paletteName: 'coal',
      imageRefs: ['fracture', 'plates-bone'], carouselSlides: 2 },
    { templateKey: 'conference-recap',   formatKey: 'li-carousel',  paletteName: 'bone',
      imageRefs: ['people-lab', 'people-02', 'ibra-lab-01', 'ibra-lab-02', 'people-03'] },
    { templateKey: 'product-family',     formatKey: 'ig-carousel',  paletteName: 'coal',
      imageRefs: ['plates-bone', 'distal-ulna', 'instruments-bone', 'tray-coal', 'plates-coal'] },
    // Single-shot variety pack
    { templateKey: 'product-launch',     formatKey: 'a3-portrait',  paletteName: 'bone',
      imageRefs: ['plates-bone'] },
    { templateKey: 'congress',           formatKey: 'poster-a3',    paletteName: 'coal',
      imageRefs: ['people-lab'] },
    { templateKey: 'surgeon-recognition',formatKey: 'ig-story',     paletteName: 'coal',
      imageRefs: ['people-03'] },
    { templateKey: 'quote-card',         formatKey: 'screensaver',  paletteName: 'coal',
      imageRefs: ['ibra-lab-01'] },
    { templateKey: 'internal-comms',     formatKey: 'email-header', paletteName: 'bone',
      imageRefs: ['plates-bone'] },

    // ── Full-bleed overlay carousels (text floats over the image) ─
    { templateKey: 'product-tour',       formatKey: 'ig-carousel', paletteName: 'coal',
      layoutKey: 'overlay',
      imageRefs: ['plates-coal', 'tray-coal', 'plates-bone', 'instruments-bone'],
      qr: { enabled: true, url: 'https://medartis.com/aptus' },
      qrPer: [false, false, false, true],    // QR only on the last (CTA) slide
      textBackdrop: { enabled: true, type: 'frosted', tint: 'auto', blur: 24 } },

    { templateKey: 'surgical-technique', formatKey: 'ig-carousel', paletteName: 'coal',
      layoutKey: 'overlay',
      imageRefs: ['ibra-lab-01', 'fracture', 'plates-bone', 'plates-coal', 'ibra-lab-02'],
      qr: { enabled: true, url: 'https://medartis.com/technique' },
      qrPer: [false, false, false, false, true],
      textBackdrop: { enabled: true, type: 'frosted', tint: 'auto', blur: 24 } },

    { templateKey: 'case-study',         formatKey: 'li-carousel', paletteName: 'coal',
      layoutKey: 'overlay',
      imageRefs: ['xray-sizer', 'plates-coal', 'people-03'],
      qr: { enabled: true, url: 'https://medartis.com/cases' },
      qrPer: [false, false, true],
      textBackdrop: { enabled: true, type: 'solid', tint: 'auto' } },

    // ── Spanning background carousels (one image across all slides) ─
    { templateKey: 'product-tour',       formatKey: 'ig-carousel', paletteName: 'coal',
      layoutKey: 'overlay',
      spanningBg: { src: 'tray-coal', placement: 'full' },
      qr: { enabled: true, url: 'https://medartis.com/aptus' },
      qrPer: [false, false, false, true],
      textBackdrop: { enabled: true, type: 'frosted', tint: 'auto', blur: 28 } },

    { templateKey: 'anniversary',        formatKey: 'li-carousel', paletteName: 'coal',
      layoutKey: 'overlay',
      spanningBg: { src: 'plates-coal', placement: 'full' },
      qr: { enabled: true, url: 'https://medartis.com/anniversary' },
      qrPer: [false, false, true],
      textBackdrop: { enabled: true, type: 'frosted', tint: 'auto', blur: 32 } },

    { templateKey: 'product-family',     formatKey: 'ig-carousel', paletteName: 'bone',
      layoutKey: 'image-bottom',
      spanningBg: { src: 'fracture', placement: 'image' },
      qr: { enabled: true, url: 'https://medartis.com/aptus' },
      qrPer: [false, false, false, false, true] },

    { templateKey: 'did-you-know',       formatKey: 'ig-carousel', paletteName: 'cream',
      layoutKey: 'image-bottom',
      spanningBg: { src: 'xray-sizer', placement: 'text' } },
  ];

  const seedDemoGallery = () => {
    const existing = readPresets();
    let nAdded = 0;
    const now = new Date();
    DEMO_RECIPES.forEach((r, i) => {
      const tmpl = TEMPLATES[r.templateKey] || {};
      const fmt  = FORMATS[r.formatKey] || {};
      const isCarousel = !!fmt.multi;
      // Slide count: explicit override, then template carouselSlides, then images, then 3
      const slides = r.carouselSlides
        || tmpl.carouselSlides
        || (tmpl.carouselContent?.length)
        || (r.imageRefs?.length)
        || 3;

      // Build per-slide content from template defaults
      const baseContent = {};
      (tmpl.fields || []).forEach(f => baseContent[f.key] = f.default);
      const carouselContent = [];
      for (let s = 0; s < slides; s++) {
        const override = (tmpl.carouselContent || [])[s] || {};
        carouselContent.push({ ...baseContent, ...override });
      }

      // Build image refs
      const imgs = r.imageRefs || [];
      const toRef = (id) => id ? { kind: 'library', src: `/library/${id}.jpg` } : null;
      const carouselImageRefs = [];
      for (let s = 0; s < slides; s++) {
        carouselImageRefs.push(toRef(imgs[s] || imgs[imgs.length - 1]));
      }
      const imageRef = toRef(imgs[0]);

      // Thumbnail: use the first library image directly (browser loads it).
      // Not a fully-composited preview, but visual + small + zero generation cost.
      const thumbnail = imgs[0] ? `/library/${imgs[0]}.jpg` : null;

      // Auto-name with a unique tag so we don't clash with existing user projects
      const name = generateProjectName({
        templateKey: r.templateKey,
        formatKey:   r.formatKey,
        content:     carouselContent[0],
        carouselSlides: isCarousel ? slides : 1,
      }) + ' · demo';

      if (existing[name]) return; // don't duplicate

      // Optional overrides from recipe
      const layoutKey = r.layoutKey
        || (isCarousel ? 'image-bottom'
            : (r.formatKey === 'screensaver' || r.formatKey === 'email-header' ? 'overlay' : 'image-bottom'));
      const carouselBg = r.spanningBg
        ? { enabled: true, imageSrc: `/library/${r.spanningBg.src}.jpg`,
            placement: r.spanningBg.placement || 'full', fit: { offsetY: 0 } }
        : { enabled: false, imageSrc: null, placement: 'full', fit: { offsetY: 0 } };
      const qrConfig = r.qr
        ? { ...DEFAULT_QR, ...r.qr }
        : { ...DEFAULT_QR };
      const carouselQrPer = r.qrPer && r.qrPer.length
        ? Array.from({ length: slides }, (_, k) => r.qrPer[k] ?? true)
        : Array(slides).fill(true);
      const carouselFolioPer = r.folioPer && r.folioPer.length
        ? Array.from({ length: slides }, (_, k) => r.folioPer[k] ?? true)
        : Array(slides).fill(true);
      const textBackdrop = r.textBackdrop
        ? { ...{ enabled: false, type: 'frosted', tint: 'auto', blur: 24 }, ...r.textBackdrop }
        : { enabled: false, type: 'frosted', tint: 'auto', blur: 24 };

      const preset = {
        v: 2,
        savedAt: new Date(now.getTime() - i * 60_000).toISOString(),
        formatKey:   r.formatKey,
        templateKey: r.templateKey,
        layoutKey,
        paletteName: r.paletteName || 'coal',
        wordmarkPos: 'tr', folioPos: 'bl',
        wordmarkOverImage: false, folioOverImage: false,
        wordmarkColor: 'auto', folioColor: 'auto',
        folioText: 'medartis.com',
        wordmarkPctOverride: null,
        content: carouselContent[0],
        carouselSlides: isCarousel ? slides : 1,
        carouselSlide: 0,
        carouselContent,
        imageFit: { ...DEFAULT_FIT },
        carouselFits: Array.from({ length: slides }, () => ({ ...DEFAULT_FIT })),
        imageRef: isCarousel ? null : imageRef,
        carouselImageRefs: isCarousel ? carouselImageRefs : [],
        qrConfig,
        carouselBg,
        carouselQrPer,
        carouselFolioPer,
        textBackdrop,
        thumbnail,
      };
      existing[name] = preset;
      nAdded++;
    });
    writePresets(existing);
    setPresets(existing);
    return nAdded;
  };
  const writePresets = (obj) => {
    try { localStorage.setItem(PRESET_KEY, JSON.stringify(obj)); return true; }
    catch (e) {
      const isQuota = /quota/i.test(e.message) || e.name === 'QuotaExceededError';
      if (isQuota) {
        const totalKB = Math.round(JSON.stringify(obj).length / 1024);
        alert(
          'Browser storage is full.\n\n' +
          `Your saved projects total ~${totalKB} KB; the browser caps localStorage at about 5 MB per site.\n\n` +
          'Quick fixes:\n' +
          '• Use Export JSON in the Projects gallery to back projects up to disk, then delete a few to free space.\n' +
          '• Picking images from the Medartis library or Canto DAM uses almost no storage — uploads use the most because they embed the full bytes.'
        );
      } else {
        alert('Could not save preset: ' + e.message);
      }
      return false;
    }
  };

  const [presets, setPresets] = useState({});
  const [presetName, setPresetName] = useState('');
  const [presetFilter, setPresetFilter] = useState('');
  const [showDemos, setShowDemos] = useState(false);
  useEffect(() => { setPresets(readPresets()); }, []);

  // Render a small thumbnail of the current canvas (max ~360px on long edge)
  const captureThumbnail = () => {
    const src = canvasRef.current;
    if (!src) return null;
    const maxEdge = 360;
    const ratio = src.width / src.height;
    let tw, th;
    if (ratio >= 1) { tw = maxEdge; th = Math.round(maxEdge / ratio); }
    else            { th = maxEdge; tw = Math.round(maxEdge * ratio); }
    const c = document.createElement('canvas');
    c.width = tw; c.height = th;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, tw, th);
    return c.toDataURL('image/jpeg', 0.78);
  };

  // Auto-name reflects current state — recomputed live so the input's
  // placeholder always shows what you'd save right now.
  const autoName = useMemo(
    () => generateProjectName({
      templateKey, formatKey, content: activeContent, carouselSlides,
    }),
    [templateKey, formatKey, activeContent, carouselSlides]
  );

  const savePreset = () => {
    const typed = (presetName || '').trim();
    const name = typed || autoName;
    if (!name) return;
    const snap = { ...snapshotState(), thumbnail: captureThumbnail() };
    const next = { ...readPresets(), [name]: snap };
    if (writePresets(next)) {
      setPresets(next);
      setPresetName('');
    }
  };
  const loadPreset = (name) => {
    const p = readPresets()[name];
    if (p) restoreState(p);
  };
  const deletePreset = (name) => {
    const next = { ...readPresets() };
    delete next[name];
    writePresets(next);
    setPresets(next);
  };

  const exportPresetFile = () => {
    const blob = new Blob([JSON.stringify(snapshotState(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `medartis-preset-${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };
  const importPresetFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { restoreState(JSON.parse(ev.target.result)); }
      catch (err) { alert('Could not read preset: ' + err.message); }
    };
    reader.readAsText(f);
  };

  // The preset LIBRARY lives only in this browser's localStorage — one profile
  // wipe deletes every saved layout. These two round-trip the whole library
  // (thumbnails included) as one JSON file. Import MERGES: a name that already
  // exists gets " (imported)" appended, so nothing is silently overwritten.
  const exportPresetLibrary = () => {
    const blob = new Blob([JSON.stringify({ kind: 'medartis-bag-preset-library', version: 1, presets: readPresets() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `medartis-preset-library-${new Date().toISOString().slice(0, 10)}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };
  const importPresetLibrary = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const doc = JSON.parse(ev.target.result);
        const incoming = doc?.kind === 'medartis-bag-preset-library' ? doc.presets : null;
        if (!incoming || typeof incoming !== 'object') throw new Error('not a preset-library file (export one with EXPORT LIBRARY)');
        const next = { ...readPresets() };
        for (const [name, p] of Object.entries(incoming)) {
          let n = name;
          while (n in next) n = `${n} (imported)`;
          next[n] = p;
        }
        if (writePresets(next)) setPresets(next);
      } catch (err) { alert('Could not read preset library: ' + err.message); }
    };
    reader.readAsText(f);
  };

  const template = TEMPLATES[templateKey];

  if (view === 'playground') {
    return <PlaygroundView onBack={() => setView('templates')} />;
  }
  if (view === 'projects') {
    return (
      <ProjectsView
        presets={presets}
        onBack={() => setView('templates')}
        onPick={(name) => {
          loadPreset(name);
          setView('templates');
        }}
        onDelete={(name) => {
          if (confirm(`Delete project "${name}"?`)) deletePreset(name);
        }}
        onExport={exportPresetFile}
        onImport={importPresetFile}
        onSeedDemos={() => {
          const n = seedDemoGallery();
          if (n) alert(`Added ${n} demo project${n === 1 ? '' : 's'} to your gallery.`);
          else   alert('Demo projects are already in your gallery.');
        }}
      />
    );
  }

  return (
    <div style={{
      width: '100%', height: '100vh', display: 'flex',
      fontFamily: BRAND.display,
      background: BRAND.coal, color: BRAND.ink, overflow: 'hidden'
    }}>
      {/* Template switch — three answers, because there are three real intentions:
          keep my words, show me what this template is for, or I misclicked. */}
      {tmplAsk && (
        <div onMouseDown={(e) => { if (e.target === e.currentTarget) closeTemplateAsk('cancel'); }}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(19,19,16,0.55)',
                   backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 'min(460px, calc(100vw - 48px))', background: BRAND.paper,
                        border: `1px solid ${BRAND.ink100}`, boxShadow: '0 40px 90px rgba(0,0,0,0.45)' }}>
            <div style={{ background: BRAND.coal, padding: '18px 22px 16px' }}>
              <div style={{ fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.18em',
                            textTransform: 'uppercase', color: BRAND.gold, marginBottom: 6 }}>Content template</div>
              <div style={{ fontFamily: BRAND.display, fontSize: 17, fontWeight: 600, color: BRAND.bone00 }}>
                {tmplAsk.title}
              </div>
            </div>
            <div style={{ padding: '16px 22px 20px' }}>
              <div style={{ fontFamily: BRAND.display, fontSize: 13, lineHeight: 1.6, color: BRAND.ink600 }}>
                {tmplAsk.body}
              </div>
              {tmplAsk.slides > 0 && (
                <div style={{ marginTop: 8, padding: '8px 9px', background: '#FDF2F0',
                              border: '1px solid #C8200A', color: '#C8200A',
                              fontSize: 11.5, lineHeight: 1.55 }}>
                  ⚠ Carousel slides cannot be carried across — they would be replaced outright,
                  not merged. Keeping your copy leaves every slide exactly as it is.
                </div>
              )}
              {tmplAsk.dropped?.length > 0 && (
                <div style={{ marginTop: 8, fontFamily: BRAND.mono, fontSize: 9,
                              color: BRAND.ink300, letterSpacing: '0.04em', lineHeight: 1.6 }}>
                  EITHER WAY, THIS TEMPLATE HAS NO {tmplAsk.dropped.join(', ').toUpperCase()} FIELD —
                  THAT TEXT IS DROPPED.
                </div>
              )}
              {/* REMEMBER — and be honest that the two answers are not equally safe.
                  "keep" is a standing instruction to lose nothing. "sample" is a
                  standing instruction to REPLACE YOUR WRITING on every future
                  switch. Both are legitimate; only one needs a warning, and the
                  undo is what makes the risky one acceptable to offer at all. */}
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 16,
                padding: '9px 10px', background: BRAND.bone, border: `1px solid ${BRAND.ink100}`,
                fontSize: 11.5, color: BRAND.ink600, cursor: 'pointer', lineHeight: 1.5,
              }}>
                <input type="checkbox" checked={tmplRemember} style={{ marginTop: 2 }}
                       onChange={(e) => setTmplRemember(e.target.checked)} />
                <span>
                  Remember my answer — stop asking
                  <div style={{ fontSize: 10.5, color: BRAND.ink300, marginTop: 2 }}>
                    Whichever button you press next becomes the standing answer. You can
                    change it in § 03 at any time, and every switch still offers an undo.
                  </div>
                </span>
              </label>

              <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                <button onClick={() => closeTemplateAsk('keep', tmplRemember)} style={{
                  padding: '11px 16px', background: BRAND.ink, color: BRAND.bone00,
                  border: 'none', borderRadius: 0, cursor: 'pointer', textAlign: 'left',
                  fontFamily: BRAND.mono, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>
                  Keep my copy
                  <div style={{ fontFamily: BRAND.display, fontSize: 11, letterSpacing: 0,
                                textTransform: 'none', opacity: 0.7, marginTop: 3 }}>
                    Your words move into the new template's structure. Nothing is lost.
                  </div>
                </button>
                <button onClick={() => closeTemplateAsk('sample', tmplRemember)} style={{
                  padding: '11px 16px', background: BRAND.paper, color: BRAND.ink,
                  border: `1px solid ${BRAND.ink100}`, borderRadius: 0, cursor: 'pointer', textAlign: 'left',
                  fontFamily: BRAND.mono, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>
                  Load the sample copy
                  <div style={{ fontFamily: BRAND.display, fontSize: 11, letterSpacing: 0,
                                textTransform: 'none', color: BRAND.ink600, marginTop: 3 }}>
                    Shows what this template is FOR — and replaces what you have written.
                  </div>
                  {tmplRemember && (
                    <div style={{ fontFamily: BRAND.display, fontSize: 10.5, letterSpacing: 0,
                                  textTransform: 'none', color: '#C8200A', marginTop: 5 }}>
                      ⚠ Remembering this one means every future switch replaces your copy
                      without asking. Recoverable — the undo appears each time — but it will
                      not stop to check.
                    </div>
                  )}
                </button>
                <button onClick={() => closeTemplateAsk('cancel')} style={{
                  padding: '9px 16px', background: 'transparent', color: BRAND.ink600,
                  border: `1px solid ${BRAND.ink100}`, borderRadius: 0, cursor: 'pointer',
                  fontFamily: BRAND.mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {fmtEditor && (
        <FormatEditor
          initial={fmtEditor}
          onSave={saveCustomFormat}
          onCancel={() => setFmtEditor(null)}
          onDelete={fmtEditor.id ? () => deleteCustomFormat(fmtEditor.id) : null}
        />
      )}

      {/* Branded confirm — mounted at the top of the app so it overlays everything. */}
      {confirmDlg && (
        <ConfirmDialog
          {...confirmDlg}
          onConfirm={() => closeConfirm(true)}
          onCancel={() => closeConfirm(false)}
        />
      )}

      {assistantOpen && (
        <ChatAssistant
          onClose={() => setAssistantOpen(false)}
          state={{
            templateKey, formatKey, layoutKey, paletteName,
            carouselSlides, carouselSlide, content,
            wordmarkPos, folioPos, folioText, qrConfig,
          }}
          actions={{
            setTemplateKey, setFormatKey, setLayoutKey, setPaletteName,
            setContent, setCarouselContent, setCarouselSlides, setCarouselSlide,
            setFolioText, setQrConfig,
            updateField, applyImage,
            savePreset, setPresetName,
            libraryImages, autoName,
          }}
        />
      )}
      <style>{`
        * { box-sizing: border-box; }
        input[type="text"], textarea, select {
          font-family: ${BRAND.display}; font-size: 13px; padding: 10px 12px;
          border: 1px solid ${BRAND.ink100}; background: ${BRAND.paper}; width: 100%;
          border-radius: 0; outline: none; color: ${BRAND.ink};
          transition: border-color 0.15s;
        }
        input[type="text"]:focus, textarea:focus, select:focus { border-color: ${BRAND.ink}; }
        textarea { resize: vertical; min-height: 64px; line-height: 1.45; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${BRAND.cream100}; border-radius: 0; }
        ::-webkit-scrollbar-thumb:hover { background: ${BRAND.cream300}; }
      `}</style>

      {/* LEFT SIDEBAR */}
      <div style={{
        width: 280, background: BRAND.bone, padding: '24px 20px',
        overflowY: 'auto', borderRight: `1px solid ${BRAND.ink100}`,
        display: 'flex', flexDirection: 'column', gap: 26
      }}>
        <div>
          <div style={{
            fontSize: 10.5, letterSpacing: '0.16em', fontWeight: 500,
            color: BRAND.ink600, marginBottom: 10, fontFamily: BRAND.mono,
            textTransform: 'uppercase'
          }}>§ 00 — BRAND ASSET GENERATOR</div>
          <svg viewBox="92 92 344 61" width="120" height="22" fill={BRAND.ink}>
            {WORDMARK_PATHS.map((d, i) => <path key={i} d={d} />)}
          </svg>
          <div style={{
            fontSize: 12, fontWeight: 300, color: BRAND.ink600,
            marginTop: 8, letterSpacing: '-0.01em'
          }}>Edition Three · v1.2 · MMXXVI</div>

          {/* Panel controls: collapse/expand all + Solo (one panel open at a time) */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 14,
            paddingTop: 12, borderTop: `1px solid ${BRAND.ink100}`,
          }}>
            <button
              onClick={() => setAllCollapsed(!allSectionsCollapsed)}
              title={allSectionsCollapsed ? 'Expand all panels' : 'Collapse all panels'}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 8px', fontSize: 10, letterSpacing: '0.08em',
                fontFamily: BRAND.mono, textTransform: 'uppercase',
                color: BRAND.ink, background: BRAND.paper,
                border: `1px solid ${BRAND.ink100}`, borderRadius: 5, cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 9 }}>{allSectionsCollapsed ? '▸' : '▾'}</span>
              {allSectionsCollapsed ? 'Expand all' : 'Collapse all'}
            </button>
            <button
              onClick={toggleAccordion}
              title="Solo: keep only one panel open at a time"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 8px', fontSize: 10, letterSpacing: '0.08em',
                fontFamily: BRAND.mono, textTransform: 'uppercase',
                color: accordion ? BRAND.bone00 : BRAND.ink600,
                background: accordion ? BRAND.ink : BRAND.paper,
                border: `1px solid ${accordion ? BRAND.ink : BRAND.ink100}`,
                borderRadius: 5, cursor: 'pointer',
              }}
            >
              <span style={{
                width: 18, height: 10, borderRadius: 5, position: 'relative',
                background: accordion ? BRAND.gold : BRAND.ink100,
                display: 'inline-block', transition: 'background 0.12s',
              }}>
                <span style={{
                  position: 'absolute', top: 1, left: accordion ? 9 : 1,
                  width: 8, height: 8, borderRadius: '50%', background: BRAND.paper,
                  transition: 'left 0.12s',
                }} />
              </span>
              Solo
            </button>
          </div>
        </div>

        <SideGroup n="1" label="Canvas" />

        <Section label={SEC('FORMAT', 'FORMAT')} {...sp('FORMAT')}>
          {Object.entries(formatGroups).map(([group, entries]) => {
            const key = 'fmt:' + group;
            const isCollapsed = collapsed.has(key);
            const activeInGroup = entries.some(([k]) => k === formatKey);
            return (
              <div key={group} style={{ marginBottom: 8 }}>
                <button
                  onClick={() => toggleCollapsed(key)}
                  style={{
                    display: 'flex', width: '100%', alignItems: 'center', gap: 6,
                    fontSize: 9.5, letterSpacing: '0.1em', fontWeight: 500,
                    color: activeInGroup ? BRAND.ink : BRAND.ink600,
                    background: 'transparent', border: 'none',
                    padding: '8px 12px 4px', fontFamily: BRAND.mono,
                    textTransform: 'uppercase', cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  <span style={{
                    display: 'inline-block', width: 8,
                    transition: 'transform 0.12s',
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'
                  }}>▾</span>
                  <span style={{ flex: 1 }}>{group}</span>
                  <span style={{
                    fontSize: 9, color: BRAND.ink600, opacity: 0.6
                  }}>{entries.length}</span>
                </button>
                {!isCollapsed && entries.map(([k, fmt]) => (
                  <div key={k} style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <SidebarBtn active={formatKey === k} onClick={() => setFormatKey(k)}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmt.label}</span>
                        <span style={{ fontSize: 10, opacity: 0.55, fontFamily: BRAND.mono, letterSpacing: '0.04em' }}>{fmt.ratio}</span>
                      </SidebarBtn>
                    </div>
                    {/* CUSTOM → edit. BUILT-IN → duplicate.
                        Deliberately not an unlock: "Instagram Post" is 1080×1080
                        because Instagram says so. Editing it in place would leave a
                        format LABELLED Instagram Post that is not one, and every
                        preset and caption built on it would quietly lie. Duplicating
                        gives you the size in one click and keeps the name honest. */}
                    <button
                      title={fmt.custom ? 'Edit this format' : `Duplicate "${fmt.label}" as a custom format you can resize`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFmtEditor(fmt.custom
                          ? { id: fmt.id, label: fmt.label, unit: fmt.srcUnit ?? 'px',
                              w: fmt.srcW ?? fmt.w, h: fmt.srcH ?? fmt.h,
                              dpi: fmt.printDpi ?? 300, printable: !!fmt.printable,
                              typeCategory: fmt.typeCategory }
                          : duplicateAsCustom(k, fmt));
                      }}
                      style={{
                        width: 26, flexShrink: 0, marginLeft: 2, cursor: 'pointer',
                        background: 'transparent', border: `1px solid ${BRAND.ink100}`,
                        color: BRAND.ink300, fontSize: 11, borderRadius: 0, lineHeight: 1,
                      }}>{fmt.custom ? '✎' : '⧉'}</button>
                  </div>
                ))}
              </div>
            );
          })}

          <button onClick={() => setFmtEditor({ label: '', unit: 'px', w: 1080, h: 1080, dpi: 300, printable: false })}
            style={{
              width: '100%', marginTop: 6, padding: '10px', cursor: 'pointer',
              background: 'transparent', color: BRAND.ink600,
              border: `1px dashed ${BRAND.ink300}`, borderRadius: 0,
              fontFamily: BRAND.mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>+ New format</button>
        </Section>

        {!isBrochure && (
        <Section label={SEC('LAYOUT', 'LAYOUT')} {...sp('LAYOUT')}>
          {FORMAT_LAYOUTS[formatKey].map((lk) => (
            <SidebarBtn key={lk} active={layoutKey === lk}
              onClick={() => { layoutChosen.current = true; setLayoutKey(lk); }}>
              {LAYOUTS[lk].label}
              {TEMPLATE_LAYOUT[templateKey] === lk && (
                <span style={{ fontSize: 9, fontFamily: BRAND.mono, color: BRAND.goldDeep,
                               letterSpacing: '0.06em' }}>SUITED</span>
              )}
            </SidebarBtn>
          ))}
          {/* The system has an opinion, and loses the argument. Once you have picked
              a layout it stops re-deciding for you — but it still says what the
              template was written for, because that is information you cannot get
              from the names alone. */}
          {layoutChosen.current
            && TEMPLATE_LAYOUT[templateKey]
            && TEMPLATE_LAYOUT[templateKey] !== layoutKey
            && FORMAT_LAYOUTS[formatKey].includes(TEMPLATE_LAYOUT[templateKey]) && (
            <button
              onClick={() => setLayoutKey(TEMPLATE_LAYOUT[templateKey])}
              style={{
                width: '100%', marginTop: 6, padding: '8px 9px', cursor: 'pointer', textAlign: 'left',
                background: BRAND.bone, border: `1px solid ${BRAND.ink100}`, borderLeft: `3px solid ${BRAND.goldDeep}`,
                fontFamily: BRAND.mono, fontSize: 9, color: BRAND.ink600,
                letterSpacing: '0.04em', lineHeight: 1.6, borderRadius: 0,
              }}>
              “{TEMPLATES[templateKey]?.label}” WAS WRITTEN FOR
              “{LAYOUTS[TEMPLATE_LAYOUT[templateKey]]?.label}” — USE IT?
            </button>
          )}
        </Section>
        )}

        <SideGroup n="2" label="Story" />

        {isBrochure && (
        <Section label={SEC('BROCHURE', `BROCHURE · PAGE ${curBrochure + 1} / ${brochurePages.length}`)} {...sp('BROCHURE')}>
          <BrochurePanel
            pages={brochurePages}
            idx={curBrochure}
            title={brochureTitle}
            onTitle={setBrochureTitle}
            onGoTo={setBrochureIdx}
            onAdd={addBrochurePage}
            onDelete={deleteBrochurePage}
            onMove={moveBrochurePage}
            onType={(i, type) => setBrochurePages((ps) => ps.map((pg, k) => (
              // Changing a page's TYPE keeps every field it shares with the new type —
              // switching Feature → Interview must never throw the headline away.
              k !== i ? pg : {
                ...pg, type,
                f: Object.fromEntries(BROCHURE_TYPES[type].fields.map((fd) => [
                  fd.key, pg.f[fd.key] ?? fd.default,
                ])),
              }
            )))}
            onField={patchBrochureField}
            hasImg={(i) => !!brochureImgs[brochurePages[i]?.id]}
            partners={partnerLogos}
            onAddPartner={addPartnerLogo}
            onRemovePartner={removePartnerLogo}
            secNo={secNo}
          />
        </Section>
        )}

        {!isBrochure && (
        <Section label={SEC('TEMPLATE', 'CONTENT TEMPLATE')} {...sp('TEMPLATE')}>
          {contentEdited.current && (
            <div style={{
              fontSize: 10, fontFamily: BRAND.mono, color: BRAND.ink600,
              letterSpacing: '0.04em', lineHeight: 1.5, marginBottom: 8,
              padding: '7px 9px', background: BRAND.bone, border: `1px solid ${BRAND.ink100}`,
            }}>
              Your copy is kept when you switch — which is why a template can look like it
              did nothing. Pick one and choose <b>Load the sample copy</b> to see what it is for.
            </div>
          )}
          {/* A remembered answer must be visible and revocable HERE, where the
              decision lives. A setting you cannot find is a setting you cannot
              revoke — and this one silently governs whether your writing survives. */}
          {tmplPref && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
              padding: '8px 9px', background: BRAND.bone,
              border: `1px solid ${BRAND.ink100}`,
              borderLeft: `3px solid ${tmplPref === 'sample' ? '#C8200A' : BRAND.goldDeep}`,
            }}>
              <div style={{ flex: 1, fontFamily: BRAND.mono, fontSize: 9, color: BRAND.ink600,
                            letterSpacing: '0.04em', lineHeight: 1.55 }}>
                {TEMPLATE_PREF_LABEL[tmplPref].toUpperCase()} · NOT ASKING
                {tmplPref === 'sample' && (
                  <div style={{ color: '#C8200A', marginTop: 2 }}>
                    EVERY SWITCH REPLACES YOUR COPY. THE UNDO STILL APPEARS.
                  </div>
                )}
              </div>
              <button onClick={() => { setTmplPref(null); writeTemplatePref(null); }}
                style={{
                  flexShrink: 0, padding: '5px 9px', cursor: 'pointer', borderRadius: 0,
                  background: BRAND.paper, color: BRAND.ink, border: `1px solid ${BRAND.ink100}`,
                  fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>Ask again</button>
            </div>
          )}
          {(() => {
            const entries = Object.entries(TEMPLATES);
            const single = entries.filter(([, t]) => !t.carouselContent);
            const multi  = entries.filter(([,  t]) => !!t.carouselContent);
            const renderBtn = ([key, t]) => (
              <SidebarBtn key={key} active={templateKey === key} onClick={() => chooseTemplate(key)} column>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{t.label}</span>
                  {t.carouselContent && (
                    <span style={{
                      fontSize: 8.5, padding: '1px 5px', background: BRAND.gold, color: BRAND.ink,
                      fontFamily: BRAND.mono, letterSpacing: '0.08em'
                    }}>×{t.carouselContent.length}</span>
                  )}
                </div>
                <div style={{ fontSize: 10.5, opacity: templateKey === key ? 0.7 : 0.5, marginTop: 2, fontWeight: 300 }}>
                  {t.desc}
                </div>
              </SidebarBtn>
            );
            return (
              <>
                <div style={{
                  fontSize: 9, letterSpacing: '0.1em', fontWeight: 500,
                  color: BRAND.ink600, padding: '4px 12px', fontFamily: BRAND.mono,
                  textTransform: 'uppercase'
                }}>SINGLE-SHOT</div>
                {single.map(renderBtn)}
                <div style={{
                  fontSize: 9, letterSpacing: '0.1em', fontWeight: 500,
                  color: BRAND.ink600, padding: '8px 12px 4px', fontFamily: BRAND.mono,
                  textTransform: 'uppercase'
                }}>CAROUSEL STORYTELLING</div>
                {multi.map(renderBtn)}
              </>
            );
          })()}
        </Section>
        )}

        <div style={{ flex: 1 }} />
        <button onClick={() => setAssistantOpen(true)} style={{
          padding: '12px', fontSize: 11, fontWeight: 500,
          background: BRAND.gold, color: BRAND.ink,
          border: 'none', borderRadius: 0,
          cursor: 'pointer', fontFamily: BRAND.mono,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <span>✦ GUIDED SETUP</span>
          <span style={{ fontSize: 10, opacity: 0.7 }}>STEP-BY-STEP</span>
        </button>
        <button onClick={() => setView('projects')} style={{
          padding: '10px 12px', fontSize: 10.5, fontWeight: 500,
          background: BRAND.ink, color: BRAND.bone00,
          border: 'none', borderRadius: 0,
          cursor: 'pointer', fontFamily: BRAND.mono,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          marginBottom: 6, display: 'flex', justifyContent: 'space-between'
        }}>
          <span>◐ PROJECTS</span>
          <span style={{ color: BRAND.gold, fontSize: 10 }}>{Object.keys(presets).length}</span>
        </button>
        <button onClick={() => setView('playground')} style={{
          padding: '10px 12px', fontSize: 10.5, fontWeight: 500,
          background: 'transparent', color: BRAND.ink600,
          border: `1px solid ${BRAND.ink100}`, borderRadius: 0,
          cursor: 'pointer', fontFamily: BRAND.mono,
          letterSpacing: '0.1em', textTransform: 'uppercase'
        }}>§ 99 — GEOMETRIC PLAYGROUND</button>
      </div>

      {/* CENTER: Preview */}
      <div ref={previewWrapRef} style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: BRAND.coal, position: 'relative', minWidth: 0
      }}>
        <div style={{
          position: 'absolute', top: 20, left: 0, right: 0,
          textAlign: 'center', color: BRAND.cream300, fontSize: 10.5,
          letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: BRAND.mono
        }}>
          {format.label} · {format.w} × {format.h} · {LAYOUTS[layoutKey]?.label}
        </div>

        {/* ZOOM · FIT · 90° */}
        {(() => {
          const pill = (on) => ({
            minWidth: 34, height: 30, borderRadius: 15, cursor: 'pointer',
            background: on ? BRAND.gold : 'rgba(250,248,240,0.08)',
            color: on ? BRAND.coal : 'rgba(250,248,240,0.85)',
            border: `1px solid ${on ? BRAND.gold : 'rgba(250,248,240,0.22)'}`,
            fontFamily: BRAND.mono, fontSize: 10.5, letterSpacing: '0.06em',
            padding: '0 9px',
          });
          const step = (f) => setPreviewZoom((z) => clamp(Number((z * f).toFixed(2)), 0.5, 8));
          return (
            <div style={{ position: 'absolute', top: 16, right: 20, display: 'flex', gap: 5, zIndex: 2 }}>
              <button style={pill(false)} onClick={() => step(1 / 1.25)} title="Zoom out">−</button>
              <button style={pill(false)} onClick={() => step(1.25)} title="Zoom in">+</button>
              <button style={pill(previewZoom !== 1)} onClick={() => setPreviewZoom(1)}
                title="Fit the canvas to the window">
                {previewZoom === 1 ? 'FIT' : `${Math.round(previewZoom * 100)}%`}
              </button>
              {/* A 1:45 strap read sideways is legible; read upright it is a line. */}
              {format.h / format.w > 3 || format.w / format.h > 3 ? (
                <button style={pill(previewRotate)} onClick={() => setPreviewRotate((v) => !v)}
                  title="Turn the preview 90° — the artwork is unchanged">⟳ 90°</button>
              ) : null}
            </div>
          );
        })()}

        {/* Viewport — scrolls once the canvas is larger than the window */}
        <div style={{
          maxWidth: '100%', maxHeight: '100%',
          overflow: 'auto',   // a min-scaled strap can exceed the window even at 100%
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            // A CSS rotation does not change layout size, so the wrapper must take
            // the rotated footprint explicitly or the flex box reserves the wrong room.
            width:  (previewRotate ? previewSize.h : previewSize.w) * previewZoom,
            height: (previewRotate ? previewSize.w : previewSize.h) * previewZoom,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <canvas
              ref={canvasRef}
              onMouseDown={(e) => {
                if (!activeImage || previewRotate) return;   // drag-to-pan is axis-aligned
                e.preventDefault();
                const startX = e.clientX, startY = e.clientY;
                const startOX = activeFit.offsetX, startOY = activeFit.offsetY;
                const dispW = previewSize.w * previewZoom, dispH = previewSize.h * previewZoom;
                const move = (ev) => {
                  const dx = (ev.clientX - startX) / dispW * 100;
                  const dy = (ev.clientY - startY) / dispH * 100;
                  updateFit({ offsetX: clamp(startOX + dx, -200, 200), offsetY: clamp(startOY + dy, -200, 200) });
                };
                const up = () => {
                  window.removeEventListener('mousemove', move);
                  window.removeEventListener('mouseup', up);
                };
                window.addEventListener('mousemove', move);
                window.addEventListener('mouseup', up);
              }}
              style={{
                width: previewSize.w * previewZoom, height: previewSize.h * previewZoom,
                transform: previewRotate ? 'rotate(90deg)' : 'none',
                boxShadow: '0 32px 80px rgba(0,0,0,0.55)', background: BRAND.paper,
                cursor: activeImage && !previewRotate ? 'grab' : 'default',
                touchAction: 'none',
                // flexShrink: 0 — WITHOUT THIS THE PREVIEW LIES.
                // A rotated element keeps its ORIGINAL layout box, so a 1:45 strap
                // turned 90° is still a tall box inside a flex row with maxWidth:100%.
                // Flex then shrinks its WIDTH to fit and leaves the height alone —
                // and the canvas is drawn at the wrong aspect: the artwork looks
                // squashed, and you go hunting for a bug in the drawing code that
                // isn't there. The canvas must never be resized by the layout.
                flexShrink: 0,
                maxWidth: 'none', maxHeight: 'none',
              }} />
          </div>
        </div>

        {/* UNDO — over the canvas, because that is where the change you are undoing
            just happened. It does not auto-dismiss on a timer: a 5-second window is
            fine for "archived" and wrong for "your headline is gone", and the one
            time you look away is the one time you needed it. It clears when you act
            or when you switch again. */}
        {undo && (
          <div style={{
            position: 'absolute', top: 58, left: '50%', transform: 'translateX(-50%)',
            zIndex: 3, display: 'flex', alignItems: 'center', gap: 12,
            padding: '9px 12px 9px 14px',
            background: undo.lostWork ? '#3A1410' : 'rgba(19,19,16,0.92)',
            border: `1px solid ${undo.lostWork ? '#C8200A' : 'rgba(250,248,240,0.22)'}`,
            backdropFilter: 'blur(6px)', maxWidth: 'min(560px, 90%)',
          }}>
            <div style={{ fontFamily: BRAND.mono, fontSize: 9.5, color: 'rgba(250,248,240,0.85)',
                          letterSpacing: '0.04em', lineHeight: 1.5 }}>
              {undo.lostWork
                ? <>SWITCHED TO “{undo.label.toUpperCase()}” — <span style={{ color: '#FF6B57' }}>YOUR COPY WAS REPLACED</span></>
                : <>SWITCHED TO “{undo.label.toUpperCase()}”</>}
            </div>
            <button onClick={applyUndo} style={{
              flexShrink: 0, padding: '6px 12px', cursor: 'pointer', borderRadius: 0,
              background: BRAND.gold, color: BRAND.coal, border: 'none',
              fontFamily: BRAND.mono, fontSize: 10, fontWeight: 600,
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>↩ Undo</button>
            <button onClick={() => setUndo(null)} title="Dismiss" style={{
              flexShrink: 0, width: 22, height: 22, padding: 0, cursor: 'pointer',
              background: 'transparent', color: 'rgba(250,248,240,0.5)',
              border: 'none', fontSize: 13, lineHeight: 1,
            }}>×</button>
          </div>
        )}

        {/* FRAME BAR — one control for both models: slides (screen) / pages (print).
            Always visible, so adding a second frame is always one click away. */}
        {(() => {
          const isPages = format.supportsPages;
          const count   = isBrochure ? brochurePages.length : isPages ? pageCount : carouselSlides;
          const idx     = isBrochure ? curBrochure : isPages ? curPage : carouselSlide;
          const goTo    = isBrochure ? setBrochureIdx : isPages ? setPageIdx : setCarouselSlide;
          const add     = isBrochure ? () => addBrochurePage('feature')
                        : isPages ? addPage : () => setSlideCount(carouselSlides + 1);
          const remove  = isBrochure ? () => deleteBrochurePage(curBrochure)
                        : isPages ? () => deletePage(pageCount - 1) : () => setSlideCount(carouselSlides - 1);
          const noun    = isBrochure ? 'PAGE' : isPages ? 'PAGE' : 'SLIDE';
          const hasImg  = (i) => (isBrochure ? !!brochureImgs[brochurePages[i]?.id]
                                : isPages ? !!pageImages[i] : !!carouselImages[i]);
          const canAdd  = isBrochure ? brochurePages.length < 60 : isPages ? true : carouselSlides < 10;
          const label   = (i) => (isBrochure ? (BROCHURE_TYPES[brochurePages[i]?.type]?.label || '') : '');
          const hint = isBrochure
            ? `PAGE ${idx + 1} / ${count} · ${(BROCHURE_TYPES[brochurePage?.type]?.label || '').toUpperCase()} · § ${secNo.BROCHURE} EDITS THIS PAGE`
            : count > 1
              ? `${noun} ${idx + 1} / ${count} · CONTENT & IMAGE PANELS EDIT THIS ${noun}`
              : `SINGLE ${noun} · + ADDS ${isPages ? 'A PAGE' : 'A SLIDE'}`;
          return (
            <div style={{
              position: 'absolute', bottom: 22, left: 0, right: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7
            }}>
              <div style={{
                color: 'rgba(250,248,240,0.55)', fontSize: 9.5, fontFamily: BRAND.mono,
                letterSpacing: '0.16em', textTransform: 'uppercase'
              }}>{hint}</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center' }}>
                <CarouselNav onClick={() => goTo(Math.max(0, idx - 1))} disabled={idx === 0}>←</CarouselNav>
                {Array.from({ length: count }).map((_, i) => (
                  <button key={i} onClick={() => goTo(i)}
                    title={`${noun} ${i + 1}${label(i) ? ` · ${label(i)}` : ''}${hasImg(i) ? ' · has image' : ''}`}
                    style={{
                      minWidth: 32, height: 32, borderRadius: 16, cursor: 'pointer',
                      background: i === idx ? BRAND.gold : 'rgba(250,248,240,0.10)',
                      color: i === idx ? BRAND.coal : 'rgba(250,248,240,0.85)',
                      border: `1px solid ${i === idx ? BRAND.gold : (hasImg(i) ? 'rgba(207,171,92,0.7)' : 'rgba(250,248,240,0.28)')}`,
                      fontFamily: BRAND.display, fontSize: 12.5, fontWeight: 700,
                    }}>{i + 1}</button>
                ))}
                <button onClick={add} disabled={!canAdd}
                  title={isBrochure ? `Add a page (choose its type in § ${secNo.BROCHURE})`
                       : isPages ? 'Add a page (inserts a page break in the body)' : 'Add a slide'}
                  style={{
                    minWidth: 32, height: 32, borderRadius: 16, cursor: canAdd ? 'pointer' : 'not-allowed',
                    background: 'transparent', color: 'rgba(250,248,240,0.85)',
                    border: '1px dashed rgba(250,248,240,0.45)', fontSize: 15, lineHeight: 1,
                  }}>+</button>
                <button onClick={remove} disabled={count <= 1}
                  title={isBrochure ? 'Delete this page'
                       : isPages ? 'Delete the last page' : 'Remove the last slide'}
                  style={{
                    minWidth: 32, height: 32, borderRadius: 16,
                    cursor: count > 1 ? 'pointer' : 'not-allowed',
                    background: 'transparent', color: 'rgba(250,248,240,0.55)',
                    border: '1px dashed rgba(250,248,240,0.3)', fontSize: 15, lineHeight: 1,
                  }}>−</button>
                <CarouselNav onClick={() => goTo(Math.min(count - 1, idx + 1))} disabled={idx === count - 1}>→</CarouselNav>
              </div>
            </div>
          );
        })()}
      </div>

      {/* RIGHT SIDEBAR — widened so the agenda editor has room to breathe */}
      <div style={{
        width: 'clamp(380px, 30vw, 560px)', flexShrink: 0, background: BRAND.bone00, padding: '24px 22px',
        overflowY: 'auto', borderLeft: `1px solid ${BRAND.ink100}`
      }}>
        <SideGroup n="3" label="Brand system" />

        {isLanyard && (
        <Section label={SEC('LANYARD', 'LANYARD STRAP')} {...sp('LANYARD')}>
          {(() => {
            const row = { marginBottom: 10 };
            const lab = { display: 'block', fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.1em',
                          textTransform: 'uppercase', color: BRAND.ink600, marginBottom: 4 };
            const set = (patch) => setLanyard((l) => ({ ...l, ...patch }));
            const slider = (key, label, min, max, fmt) => (
              <label style={{ ...lab, marginBottom: 10 }}>
                {label} · {fmt(lanyard[key])}
                <input type="range" min={min} max={max} step="0.01" value={lanyard[key]}
                       onChange={(e) => set({ [key]: Number(e.target.value) })}
                       style={{ width: '100%', marginTop: 3 }} />
              </label>
            );
            return (
              <>
                <div style={row}>
                  <label style={lab}>Mark</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    <SidebarBtn active={lanyard.mark === 'wordmark'} onClick={() => set({ mark: 'wordmark' })}>Wordmark</SidebarBtn>
                    <SidebarBtn active={lanyard.mark === 'none'} onClick={() => set({ mark: 'none' })}>No mark</SidebarBtn>
                  </div>
                </div>
                {slider('markSize', 'Mark size', 0.15, 0.75, (v) => `${Math.round(v * 100)}% of strap width`)}
                {slider('textSize', 'Text size', 0.12, 0.55, (v) => `${Math.round(v * 100)}% of strap width`)}
                {slider('spacing', 'Repeat spacing', 0.2, 3, (v) => `${v.toFixed(2)}×`)}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
                  <SidebarBtn active={lanyard.mirror} onClick={() => set({ mirror: !lanyard.mirror })}>Mirror halves</SidebarBtn>
                  <SidebarBtn active={lanyard.edges} onClick={() => set({ edges: !lanyard.edges })}>Edge lines</SidebarBtn>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 11, color: BRAND.ink600 }}>
                  <input type="checkbox" checked={lanyard.strapLineOn}
                         onChange={(e) => set({ strapLineOn: e.target.checked })} />
                  Show strap line
                </label>
                <div style={{ fontFamily: BRAND.mono, fontSize: 8.5, color: BRAND.ink300, lineHeight: 1.6, letterSpacing: '0.03em' }}>
                  ONE REPEAT = MARK · EVENT NAME · STRAP LINE. LENGTHS ARE MEASURED, SO THE
                  ITEMS NEVER COLLIDE AND A BLOCK IS NEVER CUT IN HALF BY THE STRAP END.
                  USE THE ZOOM AND ⟳ 90° BUTTONS ABOVE THE CANVAS TO CHECK THE REPEAT AND THE FOLD.
                </div>
              </>
            );
          })()}
        </Section>
        )}


        <Section label={SEC('SURFACE', 'SURFACE')} {...sp('SURFACE')}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
            {Object.entries(palettes).map(([name, p]) => (
              <button key={name} onClick={() => setPaletteName(name)}
                      title={p.cmyk ? `${name} · CMYK ${p.cmyk.join('/')}` : name}
                      style={{
                padding: 0, height: 40, background: p.bg,
                border: paletteName === name ? `2px solid ${BRAND.gold}` : `1px solid ${BRAND.ink100}`,
                cursor: 'pointer', borderRadius: 0, fontFamily: BRAND.mono, fontSize: 9,
                color: p.ink, textTransform: 'uppercase', letterSpacing: '0.06em',
                position: 'relative'
              }}>
                {p.label || name}
                {p.cmyk && (
                  <span style={{
                    position: 'absolute', top: 2, right: 3,
                    fontSize: 7, color: BRAND.gold, letterSpacing: 0
                  }}>CMYK</span>
                )}
              </button>
            ))}
          </div>
          {palettes[paletteName].cmyk && (
            <div style={{
              fontSize: 9.5, color: BRAND.ink600, marginTop: 8,
              fontFamily: BRAND.mono, letterSpacing: '0.05em', lineHeight: 1.5
            }}>
              DEEP BLACK · C{palettes[paletteName].cmyk[0]}/M{palettes[paletteName].cmyk[1]}/Y{palettes[paletteName].cmyk[2]}/K{palettes[paletteName].cmyk[3]} · 4-CHANNEL COMPOSITE FOR PRINT
            </div>
          )}

          {(() => {
            const setSurf = (patch) => setSurface((v) => ({ ...v, ...patch }));
            const lab = { display: 'block', fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.1em',
                          textTransform: 'uppercase', color: BRAND.ink600, marginBottom: 4 };
            const pickGradient = (key) => {
              const def = GROUP_GRADIENTS[key];
              // A stops-preset must not inherit DEFAULT_GRADIENT's from/to. They would
              // sit there unused but not unread: the swatch and the swap button both
              // look at from/to, and they would happily describe the wrong ramp.
              const base = { ...DEFAULT_GRADIENT };
              if (def.stops?.length) { delete base.from; delete base.to; }
              setSurf({ key, gradient: { ...base, ...def } });
            };
            // One CSS preview for either shape. Multi-stop ramps are evenly spaced,
            // which is what colorAt() does, so the swatch and the canvas agree.
            const cssRamp = (d) => `linear-gradient(90deg, ${(d.stops?.length ? d.stops : [d.from, d.to]).join(', ')})`;
            const g = surface.gradient;
            // The band of the ramp where NO ink is legible. Shown, not hidden: type
            // centred there fails whichever colour the sampler picks, and it fails
            // without complaining.
            const dead = surface.enabled ? deadZones(g, colorAt) : [];
            return (
              <>
              <div style={{ borderTop: `1px solid ${BRAND.ink100}`, paddingTop: 10, marginTop: 4 }}>
                {/* Two explicit choices, not one toggle whose label could read as
                    either the current state or the action. Both are always
                    visible; the active one is marked. */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <SidebarBtn active={!surface.enabled} onClick={() => setSurf({ enabled: false })}>
                    Flat colour
                  </SidebarBtn>
                  <SidebarBtn active={surface.enabled} onClick={() => setSurf({ enabled: true })}>
                    Gradient
                  </SidebarBtn>
                </div>

                {surface.enabled && (
                  <>
                    <div style={{ height: 8 }} />
                    <label style={lab}>Gradient · derived from the sub-brands</label>
                    {Object.entries(GROUP_GRADIENTS).map(([k, def]) => (
                      <button key={k} onClick={() => pickGradient(k)} title={def.derivation}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 8, width: '100%', marginBottom: 4,
                                padding: '5px 6px', cursor: 'pointer', textAlign: 'left',
                                border: `1px solid ${surface.key === k ? BRAND.ink : BRAND.ink100}`,
                                background: surface.key === k ? BRAND.bone : BRAND.paper,
                              }}>
                        <span style={{ width: 34, height: 16, flexShrink: 0,
                                       background: cssRamp(def) }} />
                        <span style={{ fontFamily: BRAND.mono, fontSize: 8.5, letterSpacing: '0.04em',
                                       color: BRAND.ink600, lineHeight: 1.4 }}>{def.label}</span>
                      </button>
                    ))}

                    <label style={{ ...lab, marginTop: 8 }}>Shape</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
                      {[['linear', 'Linear'], ['radial', 'Radial']].map(([k, l]) => (
                        <SidebarBtn key={k} active={(g.type ?? 'linear') === k}
                                    onClick={() => setSurf({ gradient: { ...g, type: k } })}>{l}</SidebarBtn>
                      ))}
                    </div>

                    {(g.type ?? 'linear') === 'linear' ? (
                      <>
                        <label style={lab}>Angle · {g.angle}°</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 4 }}>
                          {Object.entries(ANGLE_PRESETS).map(([k, a]) => (
                            <SidebarBtn key={k} active={g.angle === a.angle}
                                        onClick={() => setSurf({ gradient: { ...g, angle: a.angle } })}>{a.label}</SidebarBtn>
                          ))}
                        </div>
                        <input type="range" min="0" max="359" value={g.angle}
                               onChange={(e) => setSurf({ gradient: { ...g, angle: +e.target.value } })}
                               style={{ width: '100%', marginBottom: 6 }} />
                      </>
                    ) : (
                      <>
                        <label style={lab}>Centre · {((g.cx ?? 0.5) * 100).toFixed(0)}% / {((g.cy ?? 0.5) * 100).toFixed(0)}%</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
                          <input type="range" min="0" max="100" value={Math.round((g.cx ?? 0.5) * 100)}
                                 onChange={(e) => setSurf({ gradient: { ...g, cx: +e.target.value / 100 } })} />
                          <input type="range" min="0" max="100" value={Math.round((g.cy ?? 0.5) * 100)}
                                 onChange={(e) => setSurf({ gradient: { ...g, cy: +e.target.value / 100 } })} />
                        </div>
                        <label style={lab}>Radius · {((g.r ?? 0.7) * 100).toFixed(0)}%</label>
                        <input type="range" min="10" max="150" value={Math.round((g.r ?? 0.7) * 100)}
                               onChange={(e) => setSurf({ gradient: { ...g, r: +e.target.value / 100 } })}
                               style={{ width: '100%', marginBottom: 6 }} />
                      </>
                    )}

                    <label style={lab}>Band · {Math.round((g.start ?? 0) * 100)}–{Math.round((g.end ?? 1) * 100)}%</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 2 }}>
                      <input type="range" min="0" max="100" value={Math.round((g.start ?? 0) * 100)}
                             onChange={(e) => setSurf({ gradient: { ...g, start: Math.min(+e.target.value / 100, (g.end ?? 1) - 0.02) } })} />
                      <input type="range" min="0" max="100" value={Math.round((g.end ?? 1) * 100)}
                             onChange={(e) => setSurf({ gradient: { ...g, end: Math.max(+e.target.value / 100, (g.start ?? 0) + 0.02) } })} />
                    </div>
                    <div style={{ fontFamily: BRAND.mono, fontSize: 8, color: BRAND.ink300,
                                  letterSpacing: '0.03em', marginBottom: 8 }}>
                      OUTSIDE THE BAND THE COLOUR IS FLAT — THAT IS WHAT IT IS FOR.
                    </div>

                    <label style={lab}>Midpoint · {(g.midpoint ?? 0.5).toFixed(2)}</label>
                    <input type="range" min="5" max="95" value={Math.round((g.midpoint ?? 0.5) * 100)}
                           onChange={(e) => setSurf({ gradient: { ...g, midpoint: +e.target.value / 100 } })}
                           style={{ width: '100%', marginBottom: 6 }} />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
                      {[['smooth', 'Smooth'], ['linear', 'Linear']].map(([k, l]) => (
                        <SidebarBtn key={k} active={(g.easing ?? 'smooth') === k}
                                    onClick={() => setSurf({ gradient: { ...g, easing: k } })}>{l}</SidebarBtn>
                      ))}
                    </div>

                    {/* The live ramp, sampled through colorAt() — so it shows the
                        MIDPOINT and EASING you actually set. A CSS linear-gradient
                        expresses neither, so a CSS preview would quietly disagree
                        with the canvas, and the swatch is the one thing that must
                        not lie about the ramp. */}
                    <div style={{ display: 'flex', height: 22, marginTop: 6, marginBottom: 4,
                                  border: `1px solid ${BRAND.ink100}` }}>
                      {gradientStops(g, 40).map((st, i) => (
                        <span key={i} style={{ flex: 1, background: st.color }} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  gap: 6, marginTop: 4, marginBottom: 6 }}>
                      <span style={{ fontFamily: BRAND.mono, fontSize: 8.5, letterSpacing: '0.04em',
                                     color: BRAND.ink600 }}>{describeGradient(g).toUpperCase()}</span>
                      <span style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setSurf({ gradient: g.stops?.length
                                  ? { ...g, stops: [...g.stops].reverse() }
                                  : { ...g, from: g.to, to: g.from } })}
                                title="Reverse the ramp"
                                style={{ fontFamily: BRAND.mono, fontSize: 8.5, letterSpacing: '0.06em',
                                         padding: '3px 6px', cursor: 'pointer', border: `1px solid ${BRAND.ink100}`,
                                         background: BRAND.paper, color: BRAND.ink600 }}>⇄ SWAP</button>
                        <button onClick={() => pickGradient(surface.key)}
                                style={{ fontFamily: BRAND.mono, fontSize: 8.5, letterSpacing: '0.06em',
                                         padding: '3px 6px', cursor: 'pointer', border: `1px solid ${BRAND.ink100}`,
                                         background: BRAND.paper, color: BRAND.ink600 }}>RESET</button>
                      </span>
                    </div>

                    {dead.length > 0 && (
                      <div style={{ fontFamily: BRAND.mono, fontSize: 8.5, lineHeight: 1.6,
                                    letterSpacing: '0.03em', color: BRAND.goldDeep,
                                    borderLeft: `2px solid ${BRAND.gold}`, paddingLeft: 6, marginTop: 6 }}>
                        {`CROSSOVER AT ${(dead[0].from * 100).toFixed(0)}–${(dead[0].to * 100).toFixed(0)}% OF THE RAMP: WHITE AND COAL BOTH FALL UNDER 4.5:1 THERE. IT IS ${((dead.reduce((m, z) => Math.max(m, z.to - z.from), 0)) * 100).toFixed(0)}% WIDE — KEEP TYPE OFF IT, OR PUT A BACKDROP UNDER THE TEXT.`}
                      </div>
                    )}
                    <div style={{ fontFamily: BRAND.mono, fontSize: 8.5, color: BRAND.ink300, lineHeight: 1.6,
                                  letterSpacing: '0.03em', marginTop: 8 }}>
                      {(GROUP_GRADIENTS[surface.key]?.derivation || '').toUpperCase()}
                    </div>
                  </>
                )}
              </div>

              </>
            );
          })()}

        </Section>

        {/* Brand bar placement — per brand guide §logo_placement */}
        <Section label={SEC('BRANDBAR', 'BRAND BAR')} {...sp('BRANDBAR')}>
          <div style={{
            fontSize: 10, color: BRAND.ink600, marginBottom: 8,
            fontFamily: BRAND.mono, letterSpacing: '0.06em', lineHeight: 1.5
          }}>
            GUIDE · WORDMARK TR · SENDER BL · BL→TR DIAGONAL
          </div>
          {/* Logo protection over imagery — measured, not guessed. */}
          <div style={{
            fontSize: 9.5, color: BRAND.ink600, marginBottom: 6,
            fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase',
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          }}>
            <span>LOGO ON IMAGE · PROTECTION</span>
            <span style={{ color: logoLegib.safe ? '#0A7D3E' : '#C8200A', letterSpacing: 0 }}>
              {logoLegib.best.toFixed(1)}:1{logoLegib.protected ? ' ✓' : ''}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3, marginBottom: 4 }}>
            {[
              ['auto', 'Auto', 'Measure what is under the mark and only add a backdrop when it actually fails'],
              ['plate', 'Plate', 'Solid panel in the surface colour — absolute guarantee'],
              ['frosted', 'Frost', 'Blurred glass — protects while keeping the photo present'],
              ['scrim', 'Scrim', 'Soft directional wash — lightest touch'],
              ['off', 'Off', 'Trust auto-contrast alone (can fail on busy photos)'],
            ].map(([k, label, hint]) => (
              <button key={k} onClick={() => setLogoPlate(k)} title={hint} style={{
                padding: '6px 2px', cursor: 'pointer', borderRadius: 0,
                background: logoPlate === k ? BRAND.ink : BRAND.paper,
                color: logoPlate === k ? BRAND.bone00 : BRAND.ink600,
                border: `1px solid ${logoPlate === k ? BRAND.ink : BRAND.ink100}`,
                fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>{label}</button>
            ))}
          </div>
          <div style={{
            fontSize: 9, color: BRAND.ink300, marginBottom: 10,
            fontFamily: BRAND.mono, letterSpacing: '0.04em', lineHeight: 1.5,
          }}>
            {logoPlate === 'auto'
              ? 'AUTO · BARE ON A CLEAN PHOTO · BACKDROP THE MOMENT CONTRAST OR BUSYNESS FAILS'
              : logoPlate === 'off'
                ? 'OFF · AUTO-CONTRAST ONLY — NOT GUARANTEED ON A BUSY PHOTO'
                : 'ALWAYS ON · THE MARK IS PROTECTED REGARDLESS OF THE PHOTO'}
          </div>

          <div style={{
            fontSize: 9.5, color: BRAND.ink600, marginBottom: 6,
            fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase'
          }}>WORDMARK · POSITION</div>
          <CornerPicker value={wordmarkPos} onChange={setWordmarkPos} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 6, flex: 1,
              fontFamily: BRAND.mono, fontSize: 10, color: BRAND.ink600,
              cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase'
            }}>
              <input type="checkbox" checked={wordmarkOverImage}
                     onChange={(e) => setWordmarkOverImage(e.target.checked)} />
              OVER IMAGE
            </label>
            <ColorTriToggle value={wordmarkColor} onChange={setWordmarkColor} />
          </div>

          {/* Wordmark size override — defaults to format wmPct per brand guide */}
          {(() => {
            const formatDefault = defaultWordmarkShortFrac(formatKey, format.w, format.h);
            const effective = wordmarkPctOverride ?? formatDefault;
            return (
              <div style={{ marginTop: 10 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  fontSize: 10, fontFamily: BRAND.mono, letterSpacing: '0.08em',
                  color: BRAND.ink600, marginBottom: 4, textTransform: 'uppercase'
                }}>
                  <span>SIZE · {(formatDefault * 100).toFixed(0)}% GUIDE</span>
                  <span style={{ color: BRAND.ink }}>
                    {(effective * 100).toFixed(1)}%
                    {wordmarkPctOverride != null && <span style={{ color: BRAND.gold }}> ·</span>}
                  </span>
                </div>
                <input
                  type="range" min="0.04" max="0.45" step="0.005"
                  value={effective}
                  onChange={(e) => setWordmarkPctOverride(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: BRAND.ink, display: 'block' }}
                />
                {wordmarkPctOverride != null && (
                  <button onClick={() => setWordmarkPctOverride(null)} style={{
                    marginTop: 4, background: 'transparent', border: 'none', cursor: 'pointer',
                    color: BRAND.ink600, fontFamily: BRAND.mono, fontSize: 9.5,
                    letterSpacing: '0.06em', textDecoration: 'underline', padding: 0
                  }}>USE GUIDE DEFAULT ({(formatDefault * 100).toFixed(0)}%)</button>
                )}
              </div>
            );
          })()}

          <div style={{
            fontSize: 9.5, color: BRAND.ink600, margin: '14px 0 6px',
            fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase'
          }}>SENDER · POSITION</div>
          <CornerPicker value={folioPos} onChange={setFolioPos} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 6, flex: 1,
              fontFamily: BRAND.mono, fontSize: 10, color: BRAND.ink600,
              cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase'
            }}>
              <input type="checkbox" checked={folioOverImage}
                     onChange={(e) => setFolioOverImage(e.target.checked)} />
              OVER IMAGE
            </label>
            <ColorTriToggle value={folioColor} onChange={setFolioColor} />
          </div>

          <div style={{
            fontSize: 9.5, color: BRAND.ink600, margin: '10px 0 6px',
            fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase'
          }}>SENDER · TEXT</div>
          <input type="text" value={folioText}
                 placeholder="medartis.com"
                 onChange={(e) => setFolioText(e.target.value)} />

          <button
            onClick={() => {
              setWordmarkPos('tr'); setFolioPos('bl');
              setWordmarkOverImage(false); setFolioOverImage(false);
              setWordmarkColor('auto'); setFolioColor('auto');
              setFolioText('medartis.com');
              setWordmarkPctOverride(null);
            }}
            style={{
              marginTop: 12, background: 'transparent', border: 'none', cursor: 'pointer',
              color: BRAND.ink, fontFamily: BRAND.mono, fontSize: 10,
              letterSpacing: '0.08em', textDecoration: 'underline', padding: 0
            }}
          >RESET TO GUIDE DEFAULTS</button>
        </Section>

        {/* Frosted-glass / solid backdrop behind text */}
        <Section label={SEC('LOGOFILES', 'LOGO FILES')} {...sp('LOGOFILES')}>
          {(() => {
            const lab = { display: 'block', fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.1em',
                          textTransform: 'uppercase', color: BRAND.ink600, marginBottom: 4 };
            const b = (active) => ({
              padding: '9px 4px', cursor: logoBusy ? 'wait' : 'pointer', borderRadius: 0,
              background: active ? BRAND.ink : BRAND.paper, color: active ? BRAND.bone00 : BRAND.ink600,
              border: `1px solid ${active ? BRAND.ink : BRAND.ink100}`,
              fontFamily: BRAND.mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
            });
            return (
              <>
                <label style={lab}>Colour</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
                  {Object.entries(LOGO_COLORS).map(([k, c]) => (
                    <SidebarBtn key={k} active={logoColorKey === k} onClick={() => setLogoColorKey(k)} title={c.label}>
                      {k === 'ink' ? 'Ink' : 'Bone'}
                    </SidebarBtn>
                  ))}
                </div>
                <SidebarBtn active={logoClearSpace} onClick={() => setLogoClearSpace((v) => !v)}>
                  {logoClearSpace ? 'Clear space included' : 'Cropped tight to the glyphs'}
                </SidebarBtn>
                <div style={{ fontFamily: BRAND.mono, fontSize: 8.5, color: BRAND.ink300, lineHeight: 1.6,
                              letterSpacing: '0.03em', margin: '6px 0 10px' }}>
                  {logoClearSpace
                    ? 'THE FILE CARRIES ITS OWN 1.5 × d MARGIN, SO PLACING IT EDGE-TO-EDGE IS CORRECT.'
                    : '⚠ NO MARGIN IN THE FILE — WHOEVER PLACES IT MUST ADD 1.5 × d THEMSELVES.'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 12 }}>
                  <button onClick={() => downloadLogo('svg')} disabled={logoBusy} style={b(false)}>↓ SVG</button>
                  <button onClick={() => downloadLogo('pdf')} disabled={logoBusy} style={b(false)}>↓ PDF</button>
                </div>

                <div style={{ borderTop: `1px solid ${BRAND.ink100}`, paddingTop: 10 }}>
                  <label style={lab}>Brand kit · one zip for an agency</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 11, color: BRAND.ink600 }}>
                    <input type="checkbox" checked={kitPdfs} onChange={(e) => setKitPdfs(e.target.checked)} />
                    Include print PDFs (slower)
                  </label>
                  <button onClick={downloadBrandKit} disabled={!!kitProgress} style={{ ...b(true), width: '100%' }}>
                    {kitProgress ? `Building… ${kitProgress.done}/${kitProgress.total}` : '↓ Brand kit (.zip)'}
                  </button>
                  <div style={{ fontFamily: BRAND.mono, fontSize: 8.5, color: BRAND.ink300, lineHeight: 1.6,
                                letterSpacing: '0.03em', marginTop: 8 }}>
                    EVERY COLOUR × FORMAT, THE PALETTE, AND A README ANSWERING WHAT AN AGENCY WOULD
                    OTHERWISE EMAIL YOU A WEEK BEFORE PRINT. THE WORDMARK IS OUTLINES, NOT LIVE TEXT —
                    IT CANNOT FALL BACK TO THE WRONG TYPEFACE ON A MACHINE WITHOUT INTER.
                  </div>
                </div>
              </>
            );
          })()}
        </Section>

        <Section label={SEC('GROUP', 'MEDARTIS GROUP')} {...sp('GROUP')}>
          {(() => {
            const set = (patch) => setGroup((g) => ({ ...g, ...patch }));
            const lab = { display: 'block', fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.1em',
                          textTransform: 'uppercase', color: BRAND.ink600, marginBottom: 4 };
            return (
              <>
                <SidebarBtn active={group.enabled} onClick={() => set({ enabled: !group.enabled })}>
                  {group.enabled ? 'Medartis Group branding' : 'medartis (main brand)'}
                </SidebarBtn>
                <div style={{ fontFamily: BRAND.mono, fontSize: 8.5, color: BRAND.ink300,
                              lineHeight: 1.6, letterSpacing: '0.03em', margin: '6px 0 10px' }}>
                  {group.enabled
                    ? 'THE GROUP MARK STANDS IN PLACE OF THE MEDARTIS WORDMARK — THE HOUSE AND THE MAIN BRAND ARE NOT TWO SENDERS. MEDARTIS BECOMES ONE OF THE THREE CO-BRANDS BELOW, ON THE SAME TERMS AS THE OTHERS.'
                    : 'THE MEDARTIS WORDMARK, AS USUAL. SWITCH ON FOR ASSETS SENT BY THE GROUP RATHER THAN BY MEDARTIS.'}
                </div>

                {group.enabled && (
                  <>
                    <label style={lab}>Co-brands · optional</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 4 }}>
                      {['medartis', 'neoortho', 'kerimedical'].map((k) => (
                        <SidebarBtn key={k} active={!!group.coBrands?.[k]}
                                    onClick={() => set({ coBrands: { ...group.coBrands, [k]: !group.coBrands?.[k] } })}>
                          {subBrandLabel(k)}
                        </SidebarBtn>
                      ))}
                    </div>
                    <div style={{ fontFamily: BRAND.mono, fontSize: 8.5, color: BRAND.ink300,
                                  lineHeight: 1.6, letterSpacing: '0.03em', marginBottom: 10 }}>
                      {(group.coBrands?.medartis || group.coBrands?.neoortho || group.coBrands?.kerimedical)
                        ? `THEY SIT BENEATH THE GROUP — ITS BRANDS, NOT ITS PEERS. SET LIKE TYPE: ONE CAP HEIGHT, ONE BASELINE. KERIMEDICAL'S BOX IS 130 TALL AND ITS LETTERS ARE 41, SO MATCHING BOXES WOULD SHRINK IT AND FLOAT IT.${group.coBrands?.kerimedical ? ' KERIMEDICAL DROPS ITS "MEDARTIS GROUP" BYLINE HERE — UNDER THE GROUP MARK IT WOULD STATE THE SAME RELATIONSHIP TWICE.' : ''}`
                        : 'A GROUP ASSET IS COMPLETE WITH THE GROUP MARK ALONE. ADD A CO-BRAND ONLY WHEN THIS PIECE IS ACTUALLY ABOUT IT.'}
                    </div>

                    <label style={lab}>Space between co-brands · {(group.gap ?? 2.6).toFixed(2)}×</label>
                    <input type="range" min="40" max="500" value={Math.round((group.gap ?? 2.6) * 100)}
                           onChange={(e) => set({ gap: +e.target.value / 100 })}
                           style={{ width: '100%', marginBottom: 2 }} />
                    <div style={{ fontFamily: BRAND.mono, fontSize: 8, color: BRAND.ink300,
                                  letterSpacing: '0.03em', marginBottom: 10 }}>
                      A MULTIPLE OF THE CAP HEIGHT — THE SIZE OF THE LETTERS, WHICH IS WHAT THE SPACE BETWEEN THEM SHOULD RELATE TO.
                    </div>

                    <label style={lab}>Position</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
                      {[['top', 'Top'], ['bottom', 'Bottom']].map(([k, l]) => (
                        <SidebarBtn key={k} active={(group.pos ?? 'top') === k} onClick={() => set({ pos: k })}>{l}</SidebarBtn>
                      ))}
                    </div>

                    <label style={lab}>Align</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 10 }}>
                      {[['left', 'Left'], ['center', 'Centre'], ['right', 'Right']].map(([k, l]) => (
                        <SidebarBtn key={k} active={(group.align ?? 'center') === k} onClick={() => set({ align: k })}>{l}</SidebarBtn>
                      ))}
                    </div>

                    {(group.coBrands?.medartis || group.coBrands?.neoortho || group.coBrands?.kerimedical) && (
                      <>
                        <label style={lab}>Group mark · {((group.headShare ?? 0.38) * 100).toFixed(0)}% of the lockup</label>
                        <input type="range" min="15" max="70" value={Math.round((group.headShare ?? 0.38) * 100)}
                               onChange={(e) => set({ headShare: +e.target.value / 100 })}
                               style={{ width: '100%', marginBottom: 2 }} />
                        <div style={{ fontFamily: BRAND.mono, fontSize: 8, color: BRAND.ink300,
                                      letterSpacing: '0.03em', marginBottom: 8 }}>
                          HOW MUCH TALLER THE HOUSE READS THAN ITS BRANDS. THE REST IS THE ROW.
                        </div>

                        <label style={lab}>Air below the Group mark · {((group.rowGap ?? 0.16) * 100).toFixed(0)}%</label>
                        <input type="range" min="0" max="50" value={Math.round((group.rowGap ?? 0.16) * 100)}
                               onChange={(e) => set({ rowGap: +e.target.value / 100 })}
                               style={{ width: '100%', marginBottom: 10 }} />
                      </>
                    )}

                    <label style={lab}>Size · {(group.size * 100).toFixed(0)}% of the short edge</label>
                    <input type="range" min="3" max="40" value={Math.round(group.size * 100)}
                           onChange={(e) => set({ size: +e.target.value / 100 })}
                           style={{ width: '100%', marginBottom: 10 }} />

                    <label style={lab}>Colour</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, marginBottom: 10 }}>
                      {[['auto', 'Auto'], ['color', 'Brand'], ['white', 'White'], ['mono', 'Mono']].map(([k, l]) => (
                        <SidebarBtn key={k} active={group.variant === k} onClick={() => set({ variant: k })}>{l}</SidebarBtn>
                      ))}
                    </div>
                  </>
                )}

              </>
            );
          })()}
        </Section>

        <Section label={SEC('PARTNERS', 'PARTNER LOGOS')} {...sp('PARTNERS')}>
          {(() => {
            const set = (patch) => setPartners((p) => ({ ...p, ...patch }));
            const lab = { display: 'block', fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.1em',
                          textTransform: 'uppercase', color: BRAND.ink600, marginBottom: 4 };
            return (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {partnerLogos.map((l) => (
                    <div key={l.id} title={l.name} style={{
                      position: 'relative', width: 74, height: 44, border: `1px solid ${BRAND.ink100}`,
                      background: BRAND.paper, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <img src={l.src} alt={l.name} style={{ maxWidth: '82%', maxHeight: '70%', objectFit: 'contain' }} />
                      <button onClick={() => removePartnerLogo(l.id)} title="Remove" style={{
                        position: 'absolute', top: -1, right: -1, width: 15, height: 15, lineHeight: '13px',
                        padding: 0, fontSize: 10, cursor: 'pointer', background: BRAND.ink,
                        color: BRAND.bone00, border: 'none', borderRadius: 0,
                      }}>×</button>
                    </div>
                  ))}
                </div>
                <label style={{
                  display: 'block', padding: '9px', background: BRAND.paper, textAlign: 'center',
                  border: `1px dashed ${BRAND.ink300}`, cursor: 'pointer', marginBottom: 10,
                  fontFamily: BRAND.mono, fontSize: 9.5, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: BRAND.ink600,
                }}>
                  + ADD PARTNER LOGO · PNG / SVG
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                         onChange={(e) => { const f = e.target.files?.[0]; if (f) addPartnerLogo(f); e.target.value = ''; }} />
                </label>

                {partnerLogos.length > 0 && (
                  <>
                    <SidebarBtn active={partners.enabled} onClick={() => set({ enabled: !partners.enabled })}>
                      {partners.enabled ? 'Shown on the canvas' : 'Hidden'}
                    </SidebarBtn>
                    <div style={{ height: 8 }} />
                    <label style={lab}>Caption
                      <input type="text" value={partners.label} placeholder="e.g. IN COOPERATION WITH"
                             onChange={(e) => set({ label: e.target.value })}
                             style={{ width: '100%', boxSizing: 'border-box', marginTop: 3 }} />
                    </label>
                    <label style={{ ...lab, marginBottom: 10 }}>
                      Size · {Math.round(partners.size * 1000) / 10}% of the short edge
                      <input type="range" min="0.02" max="0.2" step="0.005" value={partners.size}
                             onChange={(e) => set({ size: Number(e.target.value) })}
                             style={{ width: '100%', marginTop: 3 }} />
                    </label>
                    <label style={lab}>Position</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
                      <SidebarBtn active={partners.pos === 'bottom'} onClick={() => set({ pos: 'bottom' })}>Bottom</SidebarBtn>
                      <SidebarBtn active={partners.pos === 'top'} onClick={() => set({ pos: 'top' })}>Top</SidebarBtn>
                    </div>
                    <label style={lab}>Align</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 8 }}>
                      {['left', 'center', 'right'].map((a) => (
                        <SidebarBtn key={a} active={partners.align === a} onClick={() => set({ align: a })}>{a}</SidebarBtn>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
                      <SidebarBtn active={partners.plate} onClick={() => set({ plate: !partners.plate, mono: false })}>White plate</SidebarBtn>
                      <SidebarBtn active={partners.mono} onClick={() => set({ mono: !partners.mono, plate: false })}>Knock out</SidebarBtn>
                    </div>
                    <div style={{ fontFamily: BRAND.mono, fontSize: 8.5, color: BRAND.ink300, lineHeight: 1.6, letterSpacing: '0.03em' }}>
                      A PARTNER'S LOGO HAS ITS OWN BRAND GUIDE — RECOLOURING IT TO MATCH OURS IS THE
                      ONE THING WE MAY NOT DO. THE PLATE KEEPS THEIR COLOURS INTACT ON A DARK SURFACE;
                      KNOCK OUT IS THE FALLBACK WHEN A PLATE WOULD BE TOO LOUD.
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </Section>

        <Section label={SEC('TEXTBG', 'TEXT BACKDROP')} {...sp('TEXTBG')}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
            fontFamily: BRAND.mono, fontSize: 11, color: BRAND.ink, cursor: 'pointer',
            letterSpacing: '0.08em', textTransform: 'uppercase'
          }}>
            <input type="checkbox" checked={textBackdrop.enabled}
                   onChange={(e) => setTextBackdrop({ ...textBackdrop, enabled: e.target.checked })} />
            ENABLE BACKDROP BEHIND TEXT
          </label>
          <div style={{
            fontSize: 9.5, color: BRAND.ink600, marginBottom: 8,
            fontFamily: BRAND.mono, letterSpacing: '0.04em', lineHeight: 1.55
          }}>
            Improves text readability when copy sits over photography or busy patterns.
          </div>

          <div style={{
            fontSize: 9.5, color: BRAND.ink600, marginBottom: 6,
            fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase'
          }}>STYLE</div>
          <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
            {[
              { k: 'frosted', label: 'FROSTED' },
              { k: 'solid',   label: 'SOLID' },
            ].map(({ k, label }) => (
              <button key={k} onClick={() => setTextBackdrop({ ...textBackdrop, type: k })}
                      disabled={!textBackdrop.enabled}
                      style={{
                        flex: 1, padding: '8px', fontSize: 10.5, fontWeight: 500,
                        background: textBackdrop.type === k ? BRAND.ink : BRAND.paper,
                        color: textBackdrop.type === k ? BRAND.bone00 : BRAND.ink,
                        border: `1px solid ${textBackdrop.type === k ? BRAND.ink : BRAND.ink100}`,
                        borderRadius: 0, cursor: textBackdrop.enabled ? 'pointer' : 'default',
                        opacity: textBackdrop.enabled ? 1 : 0.45,
                        fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase'
                      }}>{label}</button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', opacity: textBackdrop.enabled ? 1 : 0.45 }}>
            <span style={{
              flex: 1, fontFamily: BRAND.mono, fontSize: 10, color: BRAND.ink600,
              letterSpacing: '0.08em', textTransform: 'uppercase'
            }}>TINT</span>
            <ColorTriToggle value={textBackdrop.tint}
                            onChange={(c) => setTextBackdrop({ ...textBackdrop, tint: c })} />
          </div>

          {textBackdrop.type === 'frosted' && (
            <div style={{ marginTop: 10, opacity: textBackdrop.enabled ? 1 : 0.45 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                fontSize: 10, fontFamily: BRAND.mono, letterSpacing: '0.08em',
                color: BRAND.ink600, marginBottom: 4, textTransform: 'uppercase'
              }}>
                <span>BLUR</span><span style={{ color: BRAND.ink }}>{textBackdrop.blur}px</span>
              </div>
              <input type="range" min="4" max="80" step="1" value={textBackdrop.blur}
                     disabled={!textBackdrop.enabled}
                     onChange={(e) => setTextBackdrop({ ...textBackdrop, blur: parseInt(e.target.value, 10) })}
                     style={{ width: '100%', accentColor: BRAND.ink, display: 'block' }} />
            </div>
          )}
        </Section>

        {/* QR code overlay */}
        <Section label={SEC('QR', 'QR CODE')} {...sp('QR')}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
            fontFamily: BRAND.mono, fontSize: 11, color: BRAND.ink, cursor: 'pointer',
            letterSpacing: '0.08em', textTransform: 'uppercase'
          }}>
            <input type="checkbox" checked={qrConfig.enabled}
                   onChange={(e) => setQrConfig({ ...qrConfig, enabled: e.target.checked })} />
            ENABLE QR
          </label>

          <div style={{
            fontSize: 9.5, color: BRAND.ink600, marginBottom: 6,
            fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase'
          }}>LINK / URL</div>
          <input type="text" value={qrConfig.url}
                 placeholder="https://medartis.com"
                 onChange={(e) => setQrConfig({ ...qrConfig, url: e.target.value })} />

          <div style={{
            fontSize: 9.5, color: BRAND.ink600, margin: '12px 0 6px',
            fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase'
          }}>POSITION</div>
          <CornerPicker
            value={qrConfig.enabled ? qrConfig.pos : 'hidden'}
            onChange={(p) => p === 'hidden'
              ? setQrConfig({ ...qrConfig, enabled: false })
              : setQrConfig({ ...qrConfig, pos: p, enabled: true })} />

          <div style={{ marginTop: 12 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              fontSize: 10, fontFamily: BRAND.mono, letterSpacing: '0.08em',
              color: BRAND.ink600, marginBottom: 4, textTransform: 'uppercase'
            }}>
              <span>SIZE</span><span style={{ color: BRAND.ink }}>{(qrConfig.size*100).toFixed(0)}%</span>
            </div>
            <input type="range" min="0.06" max="0.45" step="0.01" value={qrConfig.size}
                   onChange={(e) => setQrConfig({ ...qrConfig, size: parseFloat(e.target.value) })}
                   style={{ width: '100%', accentColor: BRAND.ink, display: 'block' }} />
          </div>

          <div style={{
            fontSize: 9.5, color: BRAND.ink600, margin: '12px 0 6px',
            fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase'
          }}>STYLE</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
            {[
              { k: 'dots', label: 'DOTS' },
              { k: 'rounded', label: 'ROUNDED' },
              { k: 'classy', label: 'CLASSY' },
              { k: 'extra-rounded', label: 'EXTRA' },
              { k: 'square', label: 'SQUARE' },
              { k: 'classy-rounded', label: 'CLASSY-R' },
            ].map(({ k, label }) => (
              <button key={k} onClick={() => setQrConfig({ ...qrConfig, style: k })} style={{
                padding: '7px 4px', fontSize: 9.5,
                background: qrConfig.style === k ? BRAND.ink : BRAND.paper,
                color: qrConfig.style === k ? BRAND.bone00 : BRAND.ink,
                border: `1px solid ${qrConfig.style === k ? BRAND.ink : BRAND.ink100}`,
                borderRadius: 0, cursor: 'pointer',
                fontFamily: BRAND.mono, letterSpacing: '0.06em'
              }}>{label}</button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center' }}>
            <label style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: BRAND.mono, fontSize: 10, color: BRAND.ink600,
              cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase'
            }}>
              <input type="checkbox" checked={qrConfig.backdrop}
                     onChange={(e) => setQrConfig({ ...qrConfig, backdrop: e.target.checked })} />
              BACKDROP
            </label>
            <ColorTriToggle value={qrConfig.color}
                            onChange={(c) => setQrConfig({ ...qrConfig, color: c })} />
          </div>
        </Section>

        {/* Carousel slide count + tabs */}
        {format.multi && (
          <Section label={SEC('CAROUSEL', 'CAROUSEL')} {...sp('CAROUSEL')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{
                fontSize: 10, fontFamily: BRAND.mono, color: BRAND.ink600,
                letterSpacing: '0.12em', textTransform: 'uppercase'
              }}>SLIDES</span>
              <button onClick={() => setSlideCount(carouselSlides - 1)} style={miniBtnStyle}>−</button>
              <div style={{ width: 36, textAlign: 'center', fontWeight: 500, fontSize: 14, fontFamily: BRAND.mono }}>
                {carouselSlides}
              </div>
              <button onClick={() => setSlideCount(carouselSlides + 1)} style={miniBtnStyle}>+</button>
            </div>
            <SlideTabs
              count={carouselSlides}
              active={carouselSlide}
              onPick={setCarouselSlide}
              filled={carouselImages}
            />

            {/* Per-slide brand-bar overrides */}
            <div style={{
              marginTop: 12, padding: '10px 10px 8px', background: BRAND.bone,
              border: `1px solid ${BRAND.ink100}`
            }}>
              <div style={{
                fontSize: 9.5, fontFamily: BRAND.mono, color: BRAND.ink600,
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8
              }}>PER-SLIDE OVERRIDES</div>
              {Array.from({ length: carouselSlides }).map((_, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4
                }}>
                  <div style={{
                    width: 36, fontFamily: BRAND.mono, fontSize: 10.5,
                    color: i === carouselSlide ? BRAND.ink : BRAND.ink600,
                    letterSpacing: '0.06em'
                  }}>{(i+1).toString().padStart(2, '0')}</div>
                  <button onClick={() => toggleSlideFolio(i)}
                          title={carouselFolioPer[i] ? 'Sender shown' : 'Sender hidden'}
                          style={pillToggleStyle(carouselFolioPer[i])}>
                    SENDER
                  </button>
                  <button onClick={() => toggleSlideQr(i)}
                          title={carouselQrPer[i] ? 'QR shown' : 'QR hidden'}
                          style={pillToggleStyle(carouselQrPer[i])}>
                    QR
                  </button>
                </div>
              ))}
              <div style={{
                fontSize: 9, color: BRAND.ink600, marginTop: 8,
                fontFamily: BRAND.mono, letterSpacing: '0.04em', lineHeight: 1.55
              }}>
                WORDMARK STAYS ON EVERY SLIDE · BRAND-GUIDE CONSISTENCY
                {!qrConfig.enabled && (
                  <>
                    <br/>
                    <span style={{ color: BRAND.gold }}>QR PER-SLIDE TOGGLE NEEDS GLOBAL QR ON IN § {secNo.QR}</span>
                  </>
                )}
              </div>
            </div>
          </Section>
        )}

        {/* Carousel spanning background — only for multi-slide formats */}
        {format.multi && (
          <Section label={SEC('CAROUSEL_BG', 'SPANNING BG')} {...sp('CAROUSEL_BG')}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
              fontFamily: BRAND.mono, fontSize: 11, color: BRAND.ink, cursor: 'pointer',
              letterSpacing: '0.08em', textTransform: 'uppercase'
            }}>
              <input type="checkbox" checked={carouselBg.enabled}
                     onChange={(e) => setCarouselBg({ ...carouselBg, enabled: e.target.checked })} />
              ONE IMAGE ACROSS ALL SLIDES
            </label>

            <div style={{
              fontSize: 9.5, color: BRAND.ink600, marginBottom: 8,
              fontFamily: BRAND.mono, letterSpacing: '0.04em', lineHeight: 1.55
            }}>
              Source image is sliced into {carouselSlides} equal strips — each carousel slide gets one strip, so the photo flows seamlessly when the viewer swipes.
            </div>

            <label style={{
              display: 'block', padding: '11px', background: BRAND.ink,
              color: BRAND.bone00, textAlign: 'center', fontSize: 11, fontWeight: 500,
              borderRadius: 0, cursor: 'pointer', marginBottom: 10,
              letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: BRAND.mono
            }}>
              UPLOAD SOURCE IMAGE · JPG / PNG / PSD
              <input type="file" accept="image/*,.psd,.psb" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const dataUrl = await fileToImageDataUrl(f);
                  setCarouselBg({ ...carouselBg, enabled: true, imageSrc: dataUrl });
                } catch (err) {
                  alert('Could not load image: ' + err.message);
                }
              }} style={{ display: 'none' }} />
            </label>

            <div style={{
              fontSize: 9.5, color: BRAND.ink600, marginBottom: 8,
              fontFamily: BRAND.mono, letterSpacing: '0.08em', textTransform: 'uppercase'
            }}>OR · MEDARTIS LIBRARY</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {[...LIBRARY, ...savedLibrary].map(asset => (
                <button key={asset.id} title={asset.label}
                        onClick={() => setCarouselBg({
                          ...carouselBg, enabled: true, imageSrc: asset.src
                        })}
                        style={{
                          aspectRatio: '1', background: BRAND.bone,
                          border: carouselBg.imageSrc === asset.src
                            ? `2px solid ${BRAND.gold}` : `1px solid ${BRAND.ink100}`,
                          borderRadius: 0, cursor: 'pointer', padding: 0, overflow: 'hidden'
                        }}>
                  <img src={asset.src} alt={asset.label}
                       style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </div>

            {carouselBgImage && (
              <>
                <div style={{
                  fontSize: 9.5, color: BRAND.ink600, margin: '12px 0 6px',
                  fontFamily: BRAND.mono, letterSpacing: '0.08em', textTransform: 'uppercase'
                }}>PLACEMENT</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
                  {[
                    { k: 'full', label: 'FULL BLEED', hint: 'underneath everything' },
                    { k: 'image', label: 'IMAGE AREA', hint: 'replaces image' },
                    { k: 'text',  label: 'TEXT AREA',  hint: 'behind text band' },
                  ].map(({ k, label, hint }) => (
                    <button key={k} title={hint}
                      onClick={() => setCarouselBg({ ...carouselBg, placement: k })}
                      style={{
                        padding: '8px 4px', fontSize: 9.5,
                        background: carouselBg.placement === k ? BRAND.ink : BRAND.paper,
                        color: carouselBg.placement === k ? BRAND.bone00 : BRAND.ink,
                        border: `1px solid ${carouselBg.placement === k ? BRAND.ink : BRAND.ink100}`,
                        borderRadius: 0, cursor: 'pointer',
                        fontFamily: BRAND.mono, letterSpacing: '0.06em', textTransform: 'uppercase'
                      }}>{label}</button>
                  ))}
                </div>

                <div style={{
                  fontSize: 9.5, color: BRAND.ink600, margin: '14px 0 6px',
                  fontFamily: BRAND.mono, letterSpacing: '0.08em', textTransform: 'uppercase'
                }}>SLICE PREVIEW · {carouselSlides} STRIPS</div>
                <div style={{
                  position: 'relative', width: '100%', aspectRatio: carouselBgImage.width / carouselBgImage.height,
                  background: BRAND.bone, border: `1px solid ${BRAND.ink100}`
                }}>
                  <img src={carouselBg.imageSrc} alt=""
                       style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  {/* Slice dividers */}
                  {Array.from({ length: carouselSlides - 1 }).map((_, i) => (
                    <div key={i} style={{
                      position: 'absolute', top: 0, bottom: 0,
                      left: `${((i+1) / carouselSlides) * 100}%`,
                      width: 1, background: BRAND.gold, opacity: 0.7
                    }} />
                  ))}
                  {/* Highlight active slide's strip */}
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `${(carouselSlide / carouselSlides) * 100}%`,
                    width: `${(1 / carouselSlides) * 100}%`,
                    border: `2px solid ${BRAND.gold}`, pointerEvents: 'none'
                  }} />
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', marginTop: 6,
                  fontSize: 10, color: BRAND.ink600, fontFamily: BRAND.mono,
                  letterSpacing: '0.06em'
                }}>
                  <span>{carouselBgImage.width} × {carouselBgImage.height} px</span>
                  <span>STRIP: {Math.round(carouselBgImage.width / carouselSlides)} × {carouselBgImage.height}</span>
                </div>

                <button onClick={() => setCarouselBg({ enabled: false, imageSrc: null, fit: { offsetY: 0 } })}
                        style={{
                          marginTop: 10, background: 'transparent', border: 'none', cursor: 'pointer',
                          color: BRAND.ink, fontFamily: BRAND.mono, fontSize: 10,
                          letterSpacing: '0.08em', textDecoration: 'underline', padding: 0
                        }}>CLEAR</button>
              </>
            )}
          </Section>
        )}

        {/* Content fields — a brochure page carries its own fields (§ 03 BROCHURE) */}
        {!isBrochure && (
        <Section label={SEC('CONTENT', `CONTENT${format.multi ? ` · SLIDE ${carouselSlide + 1}` : ''}`)} {...sp('CONTENT')}>
          {/* LONG COPY — the floor used to be a cliff. Three named outcomes now. */}
          <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${BRAND.ink100}` }}>
            <div style={{ fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.1em',
                          textTransform: 'uppercase', color: BRAND.ink600, marginBottom: 5 }}>
              If the copy is too long
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {[['trim', 'Trim'], ['shrink', 'Shrink'], ['allow', 'Let it run']].map(([k, label]) => (
                <SidebarBtn key={k} active={textOverflow === k} onClick={() => setTextOverflow(k)}>{label}</SidebarBtn>
              ))}
            </div>
            <div style={{ fontFamily: BRAND.mono, fontSize: 8.5, color: BRAND.ink300,
                          lineHeight: 1.6, letterSpacing: '0.03em', marginTop: 6 }}>
              {textOverflow === 'trim'
                ? 'THE TYPE SHRINKS TO THE 55% FLOOR, THEN THE BODY IS CUT AND MARKED WITH AN ELLIPSIS. THE HEADLINE AND CTA ARE NEVER TOUCHED — LOSING THOSE IS NOT TRIMMING, IT IS DELETING THE MESSAGE. ALWAYS FITS.'
                : textOverflow === 'shrink'
                  ? '⚠ EVERY WORD KEPT, TYPE DOWN TO 28% TO DO IT — BELOW WHAT THE GUIDE CALLS LEGIBLE. PAST ~500 WORDS EVEN THIS OVERFLOWS.'
                  : '⚠ COPY RUNS PAST ITS BAND: OVER THE IMAGE, THROUGH THE MARK\u2019S CLEAR SPACE, OFF THE CANVAS. A DELIBERATE BLEED IS A REAL DESIGN MOVE — THIS IS THAT, ON PURPOSE.'}
            </div>
          </div>

          {template.fields.map(field => (
            <div key={field.key} style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block', fontSize: 10, fontWeight: 500,
                color: BRAND.ink600, marginBottom: 6,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                fontFamily: BRAND.mono
              }}>{field.label}</label>
              {templateKey === 'agenda-flyer' && field.key === 'body' ? (
                // Edit the FULL body (all pages + PAGE_BREAK markers), not just the
                // current page — otherwise editing collapses the pagination.
                <AgendaEditor value={(format.multi ? activeContent.body : content.body) || ''} onChange={(v) => updateField('body', v)} />
              ) : (['event-invitation', 'save-the-date', 'programme-cover'].includes(templateKey) && field.key === 'body') ? (
                // Structured Date/Time/Venue rows — no more "Date Date …" duplication.
                <FactBlockEditor value={activeContent.body || ''} onChange={(v) => updateField('body', v)} />
              ) : field.multiline ? (
                <textarea value={activeContent[field.key] || ''} placeholder={field.default || ''}
                          onChange={(e) => updateField(field.key, e.target.value)} rows={3} />
              ) : (
                <input type="text" value={activeContent[field.key] || ''} placeholder={field.default || ''}
                       onChange={(e) => updateField(field.key, e.target.value)} />
              )}
            </div>
          ))}
        </Section>
        )}

        {/* Image library + upload — disabled when spanning bg replaces the image area */}
        {(() => null)()}
        <SideGroup n="4" label="Imagery" />

        <Section label={SEC('IMAGE', `IMAGE${format.multi ? ` · SLIDE ${carouselSlide + 1}` : ''}`)} {...sp('IMAGE')}>
        {perSlideImageDisabled && (
          <div style={{
            padding: '10px 12px', background: BRAND.bone, border: `1px solid ${BRAND.ink100}`,
            marginBottom: 10, fontFamily: BRAND.mono, fontSize: 10, color: BRAND.ink600,
            letterSpacing: '0.05em', lineHeight: 1.55
          }}>
            DISABLED · SPANNING BG IS COVERING THE {carouselBg.placement === 'full' ? 'WHOLE CANVAS' : 'IMAGE AREA'}.
            <button onClick={() => setCarouselBg({ ...carouselBg, enabled: false })} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: BRAND.ink, fontFamily: BRAND.mono, fontSize: 10,
              letterSpacing: '0.08em', textDecoration: 'underline', padding: 0, marginLeft: 4
            }}>TURN OFF SPANNING BG</button>
          </div>
        )}
        <div style={{ opacity: perSlideImageDisabled ? 0.4 : 1, pointerEvents: perSlideImageDisabled ? 'none' : 'auto' }}>
          <label style={{
            display: 'block', padding: '12px', background: BRAND.ink,
            color: BRAND.bone00, textAlign: 'center', fontSize: 11, fontWeight: 500,
            borderRadius: 0, cursor: 'pointer', marginBottom: 12,
            letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: BRAND.mono
          }}>
            UPLOAD IMAGE · JPG / PNG / PSD
            <input type="file" accept="image/*,.psd,.psb" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const dataUrl = await fileToImageDataUrl(f);
                applyImage(dataUrl);
              } catch (err) {
                alert('Could not load image: ' + err.message);
              }
            }} style={{ display: 'none' }} />
          </label>

          <div style={{
            fontSize: 10, color: BRAND.ink600, marginBottom: 10,
            fontFamily: BRAND.mono, letterSpacing: '0.08em', textTransform: 'uppercase'
          }}>MEDARTIS LIBRARY · 02-ASSETS / VISUALS</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
            {[...LIBRARY, ...savedLibrary].map(asset => (
              <button key={asset.id} title={asset.label}
                      onClick={() => libraryImages[asset.id] && applyImage(libraryImages[asset.id])}
                      style={{
                        aspectRatio: '1', background: BRAND.bone,
                        border: `1px solid ${asset.saved ? BRAND.gold : BRAND.ink100}`, borderRadius: 0,
                        cursor: 'pointer', padding: 0, overflow: 'hidden', position: 'relative'
                      }}>
                {libraryImages[asset.id] && (
                  <img src={asset.src} alt={asset.label}
                       style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                )}
                {asset.saved && (
                  <span onClick={(e) => { e.stopPropagation(); removeFromLibrary(asset.id); }}
                        title="Remove from library"
                        style={{
                          position: 'absolute', top: 2, right: 2, width: 16, height: 16,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(19,19,16,0.72)', color: BRAND.bone00, fontSize: 11,
                          lineHeight: '16px', fontFamily: BRAND.mono, cursor: 'pointer', borderRadius: 2,
                        }}>×</span>
                )}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(transparent, rgba(19,19,16,0.85))',
                  color: asset.saved ? BRAND.gold : BRAND.bone00, fontSize: 8.5, padding: '10px 4px 4px',
                  textAlign: 'left', fontWeight: 500, fontFamily: BRAND.mono,
                  letterSpacing: '0.04em', textTransform: 'uppercase'
                }}>{asset.category}</div>
              </button>
            ))}
          </div>
        </div>
        </Section>

        {/* Generative AI (local ComfyUI) */}
        <div style={{ opacity: perSlideImageDisabled ? 0.4 : 1, pointerEvents: perSlideImageDisabled ? 'none' : 'auto' }}>
          <GenerateSection
            format={format}
            surface={palette.mode === 'dark' ? 'dark' : (layoutKey === 'overlay' ? 'overlay' : 'light')}
            onPickImage={applyImage}
            onSaveToLibrary={saveImageToLibrary}
            makeControlMap={makeControlMap}
            library={savedLibrary}
            currentImage={activeImage}
            secNo={secNo}
            sectionProps={sp('GENERATE', 'GENERATE · AI')}
          />
        </div>

        {/* Canto search */}
        <div style={{ opacity: perSlideImageDisabled ? 0.4 : 1, pointerEvents: perSlideImageDisabled ? 'none' : 'auto' }}>
          <CantoSection onPickImage={applyImage} onSaveToLibrary={saveImageToLibrary} sectionProps={sp('CANTO', 'CANTO DAM')} />
        </div>

        {/* Image fit controls */}
        <Section label={SEC('IMAGEFIT', 'IMAGE FIT')} {...sp('IMAGEFIT')}>
        {perSlideImageDisabled ? (
          <div style={{
            padding: '10px 12px', background: BRAND.bone, border: `1px solid ${BRAND.ink100}`,
            fontFamily: BRAND.mono, fontSize: 10, color: BRAND.ink600,
            letterSpacing: '0.05em', lineHeight: 1.55
          }}>
            DISABLED · IMAGE FIT APPLIES TO PER-SLIDE IMAGES — DISABLED WHILE SPANNING BG COVERS THIS AREA.
          </div>
        ) : (
          <ImageFitControls
            image={activeImage}
            fit={activeFit}
            onChange={updateFit}
            showFrameRatio={layoutKey !== 'overlay'}
            isWide={format.w / format.h > 1.4}
            defaultRatio={format.w / format.h > 1.4 ? 0.5 : 0.55}
          />
        )}
        </Section>

        {/* Live brand compliance — derived from the guide, recomputed on every change.
            Each row states the real measurement and, where a machine can safely
            resolve it, offers a one-click fix. */}
        <SideGroup n="5" label="Output" />

        <Section label={SEC('CHECK', 'BRAND CHECK')} {...sp('CHECK')}>
          {(() => {
            const fails = brandChecks.filter((c) => c.ok !== 'pass');
            const fixable = fails.filter((c) => c.fix);
            return (
              <>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
                  fontFamily: BRAND.mono, fontSize: 10, letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: fails.length === 0 ? '#0A7D3E' : BRAND.ink600,
                }}>
                  {fails.length === 0
                    ? '✓ On brand · all checks pass'
                    : `${fails.length} issue${fails.length === 1 ? '' : 's'} to review`}
                </div>

                {fixable.length > 0 && (
                  <button
                    onClick={() => fixable.forEach((c) => c.fix.apply())}
                    style={{
                      width: '100%', padding: '9px 12px', marginBottom: 8, cursor: 'pointer',
                      background: BRAND.ink, color: BRAND.bone00, border: 'none', borderRadius: 0,
                      fontFamily: BRAND.mono, fontSize: 10.5, fontWeight: 500,
                      letterSpacing: '0.12em', textTransform: 'uppercase',
                    }}
                  >⚡ Auto-fix {fixable.length} issue{fixable.length === 1 ? '' : 's'}</button>
                )}

                {brandChecks.map((c, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                    padding: '7px 0', borderBottom: `1px solid ${BRAND.ink100}`,
                  }}>
                    <span style={{
                      fontSize: 11, lineHeight: '15px', flexShrink: 0, fontWeight: 700,
                      color: c.ok === 'pass' ? '#0A7D3E' : c.ok === 'warn' ? BRAND.gold500 : '#C8200A',
                    }}>{c.ok === 'pass' ? '✓' : c.ok === 'warn' ? '△' : '✗'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: BRAND.ink800, lineHeight: 1.35 }}>{c.label}</div>
                      <div style={{ fontSize: 10, color: BRAND.ink600, lineHeight: 1.45 }}>{c.note}</div>
                      {c.fix && c.ok !== 'pass' && (
                        <button onClick={() => c.fix.apply()} style={{
                          marginTop: 5, padding: '4px 9px', cursor: 'pointer',
                          background: 'transparent', color: BRAND.ink,
                          border: `1px solid ${BRAND.gold500}`, borderRadius: 0,
                          fontFamily: BRAND.mono, fontSize: 9.5, fontWeight: 500,
                          letterSpacing: '0.1em', textTransform: 'uppercase',
                        }}>⚡ {c.fix.label}</button>
                      )}
                    </div>
                  </div>
                ))}

                {(mutedBoost || accentSafe) && (
                  <button
                    onClick={() => { setMutedBoost(false); setAccentSafe(false); }}
                    style={{
                      marginTop: 8, padding: 0, cursor: 'pointer', background: 'transparent',
                      color: BRAND.ink600, border: 'none', fontFamily: BRAND.mono,
                      fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase',
                      textDecoration: 'underline',
                    }}
                  >↺ Drop accessibility overrides</button>
                )}
              </>
            );
          })()}
        </Section>

        {/* Export */}
        <Section label={SEC('EXPORT', 'EXPORT')} {...sp('EXPORT')}>
          <button onClick={download} style={{
            width: '100%', padding: '14px', background: BRAND.ink,
            color: BRAND.bone00, border: 'none', borderRadius: 0,
            fontSize: 11, fontWeight: 500, cursor: 'pointer',
            fontFamily: BRAND.mono, marginBottom: 6,
            letterSpacing: '0.16em', textTransform: 'uppercase'
          }}>DOWNLOAD PNG{isBrochure ? ` · PAGE ${curBrochure + 1}` : pages ? ` · PAGE ${curPage + 1}` : ''}</button>
          {isBrochure && brochurePages.length > 1 && (
            <button onClick={downloadAllBrochurePages} style={{
              width: '100%', padding: '12px', background: BRAND.paper,
              color: BRAND.ink, border: `1px solid ${BRAND.ink}`, borderRadius: 0,
              fontSize: 10.5, fontWeight: 500, cursor: 'pointer',
              fontFamily: BRAND.mono, letterSpacing: '0.16em', textTransform: 'uppercase',
              marginBottom: 6
            }}>DOWNLOAD ALL {brochurePages.length} PAGES PNG</button>
          )}
          {format.multi && (
            <button onClick={downloadAllSlides} style={{
              width: '100%', padding: '12px', background: BRAND.paper,
              color: BRAND.ink, border: `1px solid ${BRAND.ink}`, borderRadius: 0,
              fontSize: 10.5, fontWeight: 500, cursor: 'pointer',
              fontFamily: BRAND.mono, letterSpacing: '0.16em', textTransform: 'uppercase',
              marginBottom: 6
            }}>DOWNLOAD ALL {carouselSlides} SLIDES PNG</button>
          )}
          {pages && pages.length > 1 && (
            <button onClick={downloadAllPages} style={{
              width: '100%', padding: '12px', background: BRAND.paper,
              color: BRAND.ink, border: `1px solid ${BRAND.ink}`, borderRadius: 0,
              fontSize: 10.5, fontWeight: 500, cursor: 'pointer',
              fontFamily: BRAND.mono, letterSpacing: '0.16em', textTransform: 'uppercase',
              marginBottom: 6
            }}>DOWNLOAD ALL {pages.length} PAGES PNG</button>
          )}

          {/* PDF options panel */}
          <div style={{
            background: BRAND.bone, border: `1px solid ${BRAND.ink100}`,
            padding: '10px 12px', marginTop: 8, marginBottom: 6
          }}>
            <div style={{
              fontSize: 9.5, fontFamily: BRAND.mono, color: BRAND.ink600,
              letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8
            }}>PDF OPTIONS</div>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
              fontFamily: BRAND.mono, fontSize: 11, color: BRAND.ink, cursor: 'pointer'
            }}>
              <input type="checkbox" checked={pdfVector}
                     onChange={(e) => setPdfVector(e.target.checked)} />
              VECTORISE TEXT + WORDMARK
            </label>
            <div style={{
              fontSize: 9, color: BRAND.ink600, marginLeft: 24, marginBottom: 8,
              fontFamily: BRAND.mono, letterSpacing: '0.04em', lineHeight: 1.5
            }}>
              Inter + JetBrains Mono native PDF fonts · wordmark as paths · selectable + infinitely scalable
            </div>
            {format.printable && (
              <>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
                  fontFamily: BRAND.mono, fontSize: 11, color: BRAND.ink, cursor: 'pointer'
                }}>
                  <input type="checkbox" checked={pdfBleed}
                         onChange={(e) => setPdfBleed(e.target.checked)} />
                  ADD 3 MM BLEED
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: pdfBleed ? 1 : 0.5 }}>
                  <label style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                    fontFamily: BRAND.mono, fontSize: 11, color: BRAND.ink, cursor: 'pointer'
                  }}>
                    <input type="checkbox" checked={pdfCropMarks}
                           onChange={(e) => setPdfCropMarks(e.target.checked)}
                           disabled={!pdfBleed} />
                    CROP MARKS
                  </label>
                  <ColorTriToggle value={pdfCropColor} onChange={setPdfCropColor} />
                </div>

                {/* The rest of the printer's marks. Each sits OUTSIDE the trim, so
                    they need bleed to exist in — hence the whole block folds away
                    without it, rather than offering checkboxes that do nothing. */}
                {pdfBleed && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${BRAND.ink100}` }}>
                    {[
                      ['bleed', 'Bleed marks', 'Shows the printer where the artwork must reach — proof that the bleed is real'],
                      ['registration', 'Registration marks', 'Printed in every plate: if they fan out, the plates are misaligned'],
                      ['colourBar', 'Colour bar', 'Known patches for checking ink density on press'],
                      ['pageInfo', 'Page information', 'Filename and date in the margin — answers "which file is this?"'],
                    ].map(([k, label, why]) => (
                      <label key={k} title={why} style={{
                        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5,
                        fontFamily: BRAND.mono, fontSize: 10, color: BRAND.ink600, cursor: 'pointer',
                      }}>
                        <input type="checkbox" checked={!!pdfMarks[k]}
                               onChange={(e) => setPdfMarks((m) => ({ ...m, [k]: e.target.checked }))} />
                        {label.toUpperCase()}
                      </label>
                    ))}
                    {/* The trade-off is real and it is arithmetic, so show it rather
                        than let a printer explain it. off + len === bleed, always. */}
                    <div style={{ fontFamily: BRAND.mono, fontSize: 8.5, color: BRAND.ink300,
                                  lineHeight: 1.6, letterSpacing: '0.03em', marginTop: 6 }}>
                      {(() => {
                        const bleed = 3;
                        const off = Math.min(pdfMarks.offsetMm, bleed * 0.55);
                        return `AT ${bleed} MM BLEED THE MARKS GET ${(bleed - off).toFixed(1)} MM: OFFSET ${off.toFixed(1)} + LENGTH ${(bleed - off).toFixed(1)} = THE ${bleed} MM THAT EXISTS OUTSIDE THE TRIM. INDESIGN GETS LONGER MARKS BY GROWING THE PAGE PAST THE BLEED; THIS PAGE IS TRIM + BLEED BY CONTRACT, SO THE MARKS LIVE INSIDE IT.`;
                      })()}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                      <label style={{ fontFamily: BRAND.mono, fontSize: 9, color: BRAND.ink600, letterSpacing: '0.06em' }}>
                        OFFSET · {pdfMarks.offsetMm.toFixed(2)} MM
                        <input type="range" min="0" max="1.6" step="0.1" value={pdfMarks.offsetMm}
                               onChange={(e) => setPdfMarks((m) => ({ ...m, offsetMm: Number(e.target.value) }))}
                               style={{ width: '100%' }} />
                      </label>
                      <label style={{ fontFamily: BRAND.mono, fontSize: 9, color: BRAND.ink600, letterSpacing: '0.06em' }}>
                        WEIGHT · {pdfMarks.weightPt.toFixed(2)} PT
                        <input type="range" min="0.1" max="1" step="0.05" value={pdfMarks.weightPt}
                               onChange={(e) => setPdfMarks((m) => ({ ...m, weightPt: Number(e.target.value) }))}
                               style={{ width: '100%' }} />
                      </label>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── IMAGE COMPRESSION ─────────────────────────────────── */}
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${BRAND.ink100}` }}>
              <div style={{ fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.1em',
                            textTransform: 'uppercase', color: BRAND.ink600, marginBottom: 5 }}>Images</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
                <SidebarBtn active={pdfImageFormat === 'jpeg'} onClick={() => setPdfImageFormat('jpeg')}>JPEG</SidebarBtn>
                <SidebarBtn active={pdfImageFormat === 'png'} onClick={() => setPdfImageFormat('png')}>PNG · lossless</SidebarBtn>
              </div>
              {pdfImageFormat === 'jpeg' && (
                <label style={{ display: 'block', fontFamily: BRAND.mono, fontSize: 9,
                                color: BRAND.ink600, letterSpacing: '0.06em', marginBottom: 6 }}>
                  QUALITY · {Math.round(pdfJpegQuality * 100)}
                  <input type="range" min="0.5" max="1" step="0.01" value={pdfJpegQuality}
                         onChange={(e) => setPdfJpegQuality(Number(e.target.value))} style={{ width: '100%' }} />
                </label>
              )}
              <label style={{ display: 'block', fontFamily: BRAND.mono, fontSize: 9,
                              color: BRAND.ink600, letterSpacing: '0.06em', marginBottom: 4 }}>
                RESAMPLE · {pdfDownsample === 0 ? 'OFF — FULL RESOLUTION' : `${pdfDownsample} PPI`}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 6 }}>
                {[0, 150, 220, 300].map((d) => (
                  <SidebarBtn key={d} active={pdfDownsample === d} onClick={() => setPdfDownsample(d)}>
                    {d === 0 ? 'Off' : d}
                  </SidebarBtn>
                ))}
              </div>
              <div style={{ fontFamily: BRAND.mono, fontSize: 8.5, color: BRAND.ink300,
                            lineHeight: 1.6, letterSpacing: '0.03em' }}>
                {pdfImageFormat === 'png'
                  ? 'PNG IS LOSSLESS — RIGHT FOR FLAT COLOUR AND HARD TYPE EDGES, WHERE JPEG RINGS. A 300 DPI A4 PHOTO LANDS AROUND 30 MB.'
                  : 'JPEG AT 90+ IS VISUALLY IDENTICAL ON PRESS AND ROUGHLY A TENTH OF THE SIZE. RESAMPLING HAPPENS BEFORE EMBEDDING, SO THE FILE REALLY IS SMALLER.'}
              </div>
            </div>

            {/* ── PAGES ─────────────────────────────────────────────── */}
            {(isBrochure || pages || format.multi) && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${BRAND.ink100}` }}>
                <div style={{ fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.1em',
                              textTransform: 'uppercase', color: BRAND.ink600, marginBottom: 5 }}>Pages</div>
                <input type="text" value={pdfPageRange} onChange={(e) => setPdfPageRange(e.target.value)}
                       placeholder="All · or 1,3-5"
                       style={{ width: '100%', boxSizing: 'border-box', marginBottom: 6 }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8,
                                fontFamily: BRAND.mono, fontSize: 10, color: BRAND.ink600, cursor: 'pointer' }}>
                  <input type="checkbox" checked={pdfSeparateFiles}
                         onChange={(e) => setPdfSeparateFiles(e.target.checked)} />
                  ONE FILE PER PAGE
                </label>
              </div>
            )}

            {/* ── WHAT THIS EXPORT CANNOT DO ────────────────────────── */}
            {pdfBleed && (
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: 'pointer', fontFamily: BRAND.mono, fontSize: 8.5,
                                  color: BRAND.ink300, letterSpacing: '0.06em' }}>
                  NO PDF/X OR CMYK — WHY?
                </summary>
                <div style={{ marginTop: 5, padding: '8px 9px', background: BRAND.paper,
                              border: `1px solid ${BRAND.ink100}`, fontFamily: BRAND.display,
                              fontSize: 10.5, color: BRAND.ink600, lineHeight: 1.6 }}>
                  These files are <b>RGB</b>. A PDF/X-3 file needs an embedded ICC output intent
                  (FOGRA39 and the like), and true CMYK needs profile-based separation — the PDF
                  engine here has neither. A “PDF/X” or “Convert to CMYK” checkbox would produce
                  an RGB file wearing a label that says otherwise, and you would only find out at
                  proof stage.
                  <div style={{ marginTop: 6, color: BRAND.ink300 }}>
                    Send the vector PDF to the printer and let their RIP separate it — that is what
                    their profile is for. For a certified PDF/X, open this file in Acrobat or
                    InDesign and export with your house preset.
                  </div>
                </div>
              </details>
            )}
          </div>
          <button onClick={downloadPdf} style={{
            width: '100%', padding: '12px', background: BRAND.paper,
            color: BRAND.ink, border: `1px solid ${BRAND.ink}`, borderRadius: 0,
            fontSize: 11, fontWeight: 500, cursor: 'pointer',
            fontFamily: BRAND.mono, letterSpacing: '0.16em', textTransform: 'uppercase'
          }}>
            DOWNLOAD PDF{format.multi ? ` · ${carouselSlides} PAGES` : ''}
            {format.printable && pdfBleed ? ' · PRINT-READY' : ''}
          </button>
        </Section>

        {/* Presets — save / load full state */}
        <Section label={SEC('PRESETS', 'PRESETS')} {...sp('PRESETS')}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <input
              type="text"
              placeholder={autoName}
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') savePreset(); }}
            />
            <button onClick={savePreset} style={{
              padding: '0 14px', background: BRAND.ink,
              color: BRAND.bone00, border: 'none', cursor: 'pointer',
              fontFamily: BRAND.mono, fontSize: 11, fontWeight: 500,
              letterSpacing: '0.1em', textTransform: 'uppercase'
            }}>SAVE</button>
          </div>
          <div style={{
            fontSize: 9.5, color: BRAND.ink600, marginBottom: 10,
            fontFamily: BRAND.mono, letterSpacing: '0.04em', lineHeight: 1.5
          }}>
            AUTO-NAMED IF BLANK · {presetName.trim() ? 'CUSTOM' : 'AUTO'}: <span style={{ color: BRAND.ink }}>{presetName.trim() || autoName}</span>
          </div>

          {/* The library is localStorage-only — a file round-trip means a lost
              browser profile can't take every saved preset with it. */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            <button onClick={exportPresetLibrary} style={{
              flex: 1, padding: '5px 0', background: 'none', border: `1px solid ${BRAND.ink100}`,
              cursor: 'pointer', fontFamily: BRAND.mono, fontSize: 9.5, letterSpacing: '0.08em', color: BRAND.ink600,
            }}>
              ↓ EXPORT LIBRARY ({Object.keys(presets).length})
            </button>
            <label style={{
              flex: 1, padding: '5px 0', border: `1px solid ${BRAND.ink100}`, cursor: 'pointer',
              fontFamily: BRAND.mono, fontSize: 9.5, letterSpacing: '0.08em', color: BRAND.ink600, textAlign: 'center',
            }}>
              ↑ IMPORT LIBRARY
              <input type="file" accept="application/json,.json" onChange={importPresetLibrary} style={{ display: 'none' }} />
            </label>
          </div>

          {(() => {
            const isDemo = (name) => /·\s*demo\s*$/i.test(name);
            const q = presetFilter.trim().toLowerCase();
            const all = Object.entries(presets)
              .sort(([, a], [, b]) => (b.savedAt || '').localeCompare(a.savedAt || ''));
            const match = ([name, p]) => !q || name.toLowerCase().includes(q)
              || `${p.formatKey} ${p.templateKey}`.toLowerCase().includes(q);
            const mine  = all.filter(([n]) => !isDemo(n)).filter(match);
            const demos = all.filter(([n]) =>  isDemo(n)).filter(match);

            const Row = ([name, p]) => (
              <div key={name} title={p.savedAt || ''} onClick={() => loadPreset(name)} style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                padding: 5, background: BRAND.paper, border: `1px solid ${BRAND.ink100}`,
              }}>
                <div style={{
                  width: 46, height: 34, flexShrink: 0, background: BRAND.bone,
                  border: `1px solid ${BRAND.ink100}`, overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {p.thumbnail
                    ? <img src={p.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <span style={{ fontSize: 8, color: BRAND.ink300, fontFamily: BRAND.mono }}>—</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: BRAND.display, color: BRAND.ink, fontSize: 12, fontWeight: 500,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{name.replace(/\s*·\s*demo\s*$/i, '')}</div>
                  <div style={{
                    fontSize: 9, color: BRAND.ink600, fontFamily: BRAND.mono, letterSpacing: '0.04em',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1,
                  }}>{p.formatKey} · {p.templateKey}{p.carouselSlides > 1 ? ` · ${p.carouselSlides}×` : ''}</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete preset "${name}"?`)) deletePreset(name); }}
                  title="Delete" style={{
                    width: 20, height: 20, flexShrink: 0, background: 'transparent',
                    border: 'none', cursor: 'pointer', color: BRAND.ink300,
                    fontSize: 15, lineHeight: 1, fontFamily: BRAND.display,
                  }}>×</button>
              </div>
            );

            if (all.length === 0) return (
              <div style={{ fontSize: 10.5, color: BRAND.ink600, fontFamily: BRAND.mono, letterSpacing: '0.06em', padding: '10px 0' }}>
                NO SAVED PRESETS YET
              </div>
            );

            return (
              <div style={{ marginBottom: 10 }}>
                {all.length > 6 && (
                  <input type="text" placeholder="Filter presets…" value={presetFilter}
                    onChange={(e) => setPresetFilter(e.target.value)}
                    style={{ width: '100%', marginBottom: 6, fontSize: 11 }} />
                )}
                {mine.length > 0 && (
                  <>
                    <div style={{ fontSize: 9, fontFamily: BRAND.mono, color: BRAND.ink600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '2px 0 5px' }}>
                      Your presets · {mine.length}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{mine.map(Row)}</div>
                  </>
                )}
                {demos.length > 0 && (
                  <div style={{ marginTop: mine.length ? 12 : 0 }}>
                    <button onClick={() => setShowDemos(v => !v)} style={{
                      display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: 0,
                      background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                      fontSize: 9, fontFamily: BRAND.mono, color: BRAND.ink600, letterSpacing: '0.1em',
                      textTransform: 'uppercase', marginBottom: 5,
                    }}>
                      <span style={{ display: 'inline-block', width: 8, transition: 'transform 0.12s', transform: showDemos ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
                      Demo gallery · {demos.length}
                    </button>
                    {showDemos && <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{demos.map(Row)}</div>}
                  </div>
                )}
                {mine.length === 0 && demos.length === 0 && (
                  <div style={{ fontSize: 10, color: BRAND.ink600, fontFamily: BRAND.mono, padding: '8px 0' }}>
                    No presets match “{presetFilter}”.
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={exportPresetFile} style={{
              flex: 1, padding: '9px', background: BRAND.paper, color: BRAND.ink,
              border: `1px solid ${BRAND.ink100}`, borderRadius: 0, cursor: 'pointer',
              fontFamily: BRAND.mono, fontSize: 10, fontWeight: 500,
              letterSpacing: '0.1em', textTransform: 'uppercase'
            }}>EXPORT JSON</button>
            <label style={{
              flex: 1, padding: '9px', background: BRAND.paper, color: BRAND.ink,
              border: `1px solid ${BRAND.ink100}`, borderRadius: 0, cursor: 'pointer',
              fontFamily: BRAND.mono, fontSize: 10, fontWeight: 500,
              letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'center'
            }}>
              IMPORT JSON
              <input type="file" accept="application/json" onChange={importPresetFile}
                     style={{ display: 'none' }} />
            </label>
          </div>
        </Section>
      </div>
    </div>
  );
}

// ── UI atoms ──────────────────────────────────────────────────────────
// Numbered sidebar group heading — turns a long flat panel list into a handful
// of legible stages (1 Canvas · 2 Story · 3 Brand · 4 Imagery · 5 Output).
const SideGroup = ({ n, label, hint }) => (
  <div style={{ margin: '18px 2px 10px', display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
    <span style={{
      width: 20, height: 20, borderRadius: 10, background: BRAND.ink,
      color: BRAND.bone00, fontSize: 10.5, fontWeight: 700,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: BRAND.display, flexShrink: 0,
    }}>{n}</span>
    <span style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
      textTransform: 'uppercase', color: BRAND.ink, fontFamily: BRAND.display,
    }}>{label}</span>
    <span style={{ flex: 1, height: 2, background: BRAND.gold, opacity: 0.85, borderRadius: 1 }} />
    {hint && <span style={{ fontSize: 9, color: BRAND.ink300, fontFamily: BRAND.mono }}>{hint}</span>}
  </div>
);

// ─── SIDEBAR SECTIONS ────────────────────────────────────────────────
// ONE ordered list. The numbers are DERIVED from it — never typed into a label.
//
// Two bugs, one cause. First the sidebar drifted to 04 · 04B · 04E · 04C · … ·
// 06 · 08 · 07 · 08 · 09 · 10 · 10, because every number was hand-written into
// its own heading and nobody can keep that promise across 7000 lines. Then, once
// numbered from this list, § 08 and § 09 "went missing" — because they are the
// CAROUSEL panels, and on a non-carousel format they do not render at all.
//
// A number that counts sections the reader cannot see is not a number, it is a
// riddle. So the numbering is computed at RENDER time over the sections that are
// actually on screen: change format, and § 01…§ n stays a contiguous sequence.
const SECTION_ORDER = [
  // 1 · Canvas
  'FORMAT', 'LAYOUT',
  // 2 · Story — TEMPLATE and BROCHURE are alternates; exactly one is ever visible
  'TEMPLATE', 'BROCHURE',
  // 3 · Brand system
  'LANYARD', 'SURFACE', 'BRANDBAR', 'LOGOFILES', 'GROUP', 'PARTNERS', 'TEXTBG', 'QR', 'CAROUSEL', 'CAROUSEL_BG', 'CONTENT',
  // 4 · Imagery
  'IMAGE', 'GENERATE', 'CANTO', 'IMAGEFIT',
  // 5 · Output
  'CHECK', 'EXPORT', 'PRESETS',
];

/** Which sections exist for the current canvas? The numbering follows from this. */
function visibleSections({ isBrochure, isCarousel, isLanyard }) {
  return SECTION_ORDER.filter((k) => {
    if (k === 'LANYARD') return isLanyard;
    if (k === 'BROCHURE') return isBrochure;
    if (k === 'LAYOUT' || k === 'TEMPLATE' || k === 'CONTENT') return !isBrochure;
    if (k === 'CAROUSEL' || k === 'CAROUSEL_BG') return isCarousel;
    return true;
  });
}

/** { FORMAT: '01', LAYOUT: '02', … } over the VISIBLE sections only. */
function sectionNumbers(vis) {
  const map = {};
  vis.forEach((k, i) => { map[k] = String(i + 1).padStart(2, '0'); });
  return map;
}

// ═══ FORMAT EDITOR ═══════════════════════════════════════════════════
// A printer says "210 mm", never "2480 px". So the unit toggle is not a
// convenience — typing a millimetre size into a pixel field is how you discover,
// at proof stage, that the job is 8% wrong.
function FormatEditor({ initial, onSave, onCancel, onDelete }) {
  const [label, setLabel] = useState(initial.label ?? '');
  const [unit, setUnit] = useState(initial.unit ?? 'px');
  const [w, setW] = useState(String(initial.w ?? 1080));
  const [h, setH] = useState(String(initial.h ?? 1080));
  const [dpi, setDpi] = useState(initial.dpi ?? 300);
  const [printable, setPrintable] = useState(!!initial.printable);
  const [cat, setCat] = useState(initial.typeCategory ?? '');
  const [err, setErr] = useState(null);
  const nameRef = useRef(null);
  useEffect(() => { nameRef.current?.focus(); nameRef.current?.select(); }, []);

  const nw = parseFloat(w), nh = parseFloat(h);
  const px = unit === 'mm'
    ? { w: Math.round((nw / 25.4) * dpi), h: Math.round((nh / 25.4) * dpi) }
    : { w: Math.round(nw), h: Math.round(nh) };
  const sizeErr = validateSize(px.w, px.h);

  const save = () => {
    try {
      onSave(makeCustomFormat({
        label, w: nw, h: nh, unit, dpi, printable,
        typeCategory: cat || undefined,
      }));
    } catch (e) { setErr(e.message); }
  };

  const lab = { display: 'block', fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: BRAND.ink600, marginBottom: 4 };
  const fld = { width: '100%', boxSizing: 'border-box', padding: '9px 10px',
                border: `1px solid ${BRAND.ink100}`, background: BRAND.paper, color: BRAND.ink,
                fontSize: 12, fontFamily: BRAND.display, borderRadius: 0 };

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(19,19,16,0.55)',
               backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 'min(460px, calc(100vw - 48px))', background: BRAND.paper,
                    border: `1px solid ${BRAND.ink100}`, boxShadow: '0 40px 90px rgba(0,0,0,0.45)' }}>
        <div style={{ background: BRAND.coal, padding: '18px 22px 16px' }}>
          <div style={{ fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.18em',
                        textTransform: 'uppercase', color: BRAND.gold, marginBottom: 6 }}>
            {initial.id ? 'Edit format' : initial.from ? `Duplicated from ${initial.from}` : 'New format'}
          </div>
          <div style={{ fontFamily: BRAND.display, fontSize: 17, fontWeight: 600, color: BRAND.bone00 }}>
            {initial.id ? label || 'Custom format' : 'A format of your own'}
          </div>
        </div>

        <div style={{ padding: '18px 22px' }}>
          <label style={lab}>Name</label>
          <input ref={nameRef} style={{ ...fld, marginBottom: 12 }} value={label}
                 placeholder="e.g. Congress backdrop 3×2 m"
                 onChange={(e) => { setLabel(e.target.value); setErr(null); }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
            <SidebarBtn active={unit === 'px'} onClick={() => setUnit('px')}>Pixels</SidebarBtn>
            <SidebarBtn active={unit === 'mm'} onClick={() => { setUnit('mm'); setPrintable(true); }}>Millimetres</SidebarBtn>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
            <div>
              <label style={lab}>Width · {unit}</label>
              <input style={fld} value={w} inputMode="decimal"
                     onChange={(e) => { setW(e.target.value); setErr(null); }} />
            </div>
            <div>
              <label style={lab}>Height · {unit}</label>
              <input style={fld} value={h} inputMode="decimal"
                     onChange={(e) => { setH(e.target.value); setErr(null); }} />
            </div>
          </div>

          {/* Always show the OTHER unit. The mistake this prevents is silent. */}
          <div style={{ fontFamily: BRAND.mono, fontSize: 9, color: BRAND.ink300,
                        letterSpacing: '0.04em', marginBottom: 12 }}>
            {Number.isFinite(nw) && Number.isFinite(nh) ? (unit === 'mm'
              ? `= ${px.w} × ${px.h} px at ${dpi} dpi · ${ratioLabel(px.w, px.h)}`
              : `= ${pxToMm(px.w, dpi).toFixed(1)} × ${pxToMm(px.h, dpi).toFixed(1)} mm at ${dpi} dpi · ${ratioLabel(px.w, px.h)}`) : ''}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
                          fontSize: 12, color: BRAND.ink600 }}>
            <input type="checkbox" checked={printable} onChange={(e) => setPrintable(e.target.checked)} />
            For print — enables the PDF export with bleed and crop marks
          </label>

          {printable && (
            <>
              <label style={lab}>Resolution</label>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${DPI_CHOICES.length}, 1fr)`, gap: 4, marginBottom: 12 }}>
                {DPI_CHOICES.map((d) => (
                  <SidebarBtn key={d} active={dpi === d} onClick={() => setDpi(d)}>{d}</SidebarBtn>
                ))}
              </div>
            </>
          )}

          <label style={lab}>Typography
            <span style={{ color: BRAND.ink300, letterSpacing: 0, textTransform: 'none' }}> · leave on Auto unless it looks wrong</span>
          </label>
          <select style={{ ...fld, marginBottom: 6 }} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Auto — guess from the size</option>
            {TYPE_CATEGORY_KEYS.map((k) => <option key={k} value={k}>{TYPE_CATEGORY_LABELS[k]}</option>)}
          </select>
          <div style={{ fontFamily: BRAND.mono, fontSize: 8.5, color: BRAND.ink300,
                        lineHeight: 1.6, letterSpacing: '0.03em', marginBottom: 12 }}>
            THE MODULAR SCALE SIZES TYPE BY WHAT A FORMAT IS FOR, NOT BY ITS PIXELS — SO A
            BUSINESS CARD AND A POSTER OF THE SAME RATIO GET DIFFERENT HEADLINES.
          </div>

          {(sizeErr || err) && (
            <div style={{ padding: '9px 10px', background: '#FDF2F0', border: '1px solid #C8200A',
                          color: '#C8200A', fontSize: 11.5, lineHeight: 1.55, marginBottom: 12 }}>
              {err || sizeErr}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
            {initial.id && onDelete && (
              <button onClick={onDelete} style={{
                marginRight: 'auto', padding: '9px 14px', background: 'transparent', color: '#C8200A',
                border: '1px solid #C8200A', borderRadius: 0, cursor: 'pointer',
                fontFamily: BRAND.mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>Delete</button>
            )}
            <button onClick={onCancel} style={{
              padding: '9px 16px', background: BRAND.paper, color: BRAND.ink,
              border: `1px solid ${BRAND.ink100}`, borderRadius: 0, cursor: 'pointer',
              fontFamily: BRAND.mono, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>Cancel</button>
            <button onClick={save} disabled={!!sizeErr || !label.trim()} style={{
              padding: '9px 16px', background: (sizeErr || !label.trim()) ? BRAND.ink300 : BRAND.ink,
              color: BRAND.bone00, border: 'none', borderRadius: 0,
              cursor: (sizeErr || !label.trim()) ? 'not-allowed' : 'pointer',
              fontFamily: BRAND.mono, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>{initial.id ? 'Save' : 'Create'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ CONFIRM / NOTICE DIALOG ═════════════════════════════════════════
// Replaces window.confirm and window.alert. Not for looks: the browser's dialogs
// say "localhost:5174 says" above your brand's name, they cannot be styled, and
// on some platforms they focus the destructive button by default.
//
// Two rules encoded here:
//   · A CONFIRM is destructive → focus CANCEL, so a stray Enter never deletes.
//   · A NOTICE has one safe action → focus it, so Enter dismisses.
function ConfirmDialog({
  title, body, confirmLabel = 'Delete', cancelLabel = 'Cancel',
  onConfirm, onCancel,
  notice = false,          // notice = no destructive choice, just "OK"
  tone = 'confirm',        // confirm | error | success | info
}) {
  const cancelRef = useRef(null);
  const okRef = useRef(null);
  useEffect(() => {
    (notice ? okRef : cancelRef).current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      if (e.key === 'Enter')  { e.preventDefault(); onConfirm(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onConfirm, onCancel, notice]);

  const accent = tone === 'error' ? '#C8200A' : tone === 'success' ? '#0A7D3E' : BRAND.gold;
  const kicker = tone === 'error' ? 'Something went wrong'
    : tone === 'success' ? 'Done'
    : notice ? 'Heads up' : 'Confirm';

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(19,19,16,0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
      <div style={{
        width: 'min(440px, calc(100vw - 48px))',
        background: BRAND.paper, color: BRAND.ink,
        border: `1px solid ${BRAND.ink100}`,
        boxShadow: '0 40px 90px rgba(0,0,0,0.45)',
      }}>
        {/* Coal head with the wordmark — this is Medartis speaking, not the browser. */}
        <div style={{ background: BRAND.coal, padding: '18px 22px 16px' }}>
          <div style={{
            fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: accent, marginBottom: 6,
          }}>{kicker}</div>
          <div style={{ fontFamily: BRAND.display, fontSize: 17, fontWeight: 600, color: BRAND.bone00 }}>
            {title}
          </div>
        </div>
        {body && (
          <div style={{
            padding: '16px 22px 4px', fontFamily: BRAND.display, fontSize: 13,
            lineHeight: 1.6, color: BRAND.ink600,
          }}>{body}</div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '16px 22px 20px' }}>
          {!notice && (
            <button ref={cancelRef} onClick={onCancel} style={{
              padding: '9px 16px', background: BRAND.paper, color: BRAND.ink,
              border: `1px solid ${BRAND.ink100}`, borderRadius: 0, cursor: 'pointer',
              fontFamily: BRAND.mono, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>{cancelLabel}</button>
          )}
          <button ref={okRef} onClick={onConfirm} style={{
            padding: '9px 16px', background: BRAND.ink, color: BRAND.bone00,
            border: `1px solid ${BRAND.ink}`, borderRadius: 0, cursor: 'pointer',
            fontFamily: BRAND.mono, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>{notice ? 'OK' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// Section moved to uiKit.jsx (shared with GenerateSection.jsx)

const SidebarBtn = ({ active, onClick, children, column }) => (
  <button onClick={onClick} style={{
    textAlign: 'left', padding: '10px 12px', fontSize: 12.5,
    background: active ? BRAND.ink : 'transparent',
    color: active ? BRAND.bone00 : BRAND.ink,
    border: 'none', cursor: 'pointer', borderRadius: 0,
    fontFamily: BRAND.display, fontWeight: active ? 500 : 400,
    display: 'flex', flexDirection: column ? 'column' : 'row',
    alignItems: column ? 'flex-start' : 'center',
    justifyContent: 'space-between', transition: 'background 0.12s',
    borderLeft: active ? `2px solid ${BRAND.gold}` : '2px solid transparent',
    width: '100%'
  }}>{children}</button>
);

const pillToggleStyle = (on) => ({
  flex: 1, padding: '6px 8px', fontSize: 10,
  background: on ? BRAND.ink : BRAND.paper,
  color: on ? BRAND.gold : BRAND.ink600,
  border: `1px solid ${on ? BRAND.ink : BRAND.ink100}`,
  borderRadius: 0, cursor: 'pointer',
  fontFamily: BRAND.mono, letterSpacing: '0.08em',
  textTransform: 'uppercase',
});

const miniBtnStyle = {
  width: 32, height: 32, background: BRAND.paper, border: `1px solid ${BRAND.ink100}`,
  borderRadius: 0, cursor: 'pointer', fontSize: 16, fontWeight: 500,
  fontFamily: BRAND.display
};

const CarouselNav = ({ onClick, disabled, children }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width: 38, height: 38, borderRadius: 0,
    background: disabled ? 'rgba(250,248,240,0.08)' : BRAND.bone00,
    color: disabled ? BRAND.ink600 : BRAND.ink,
    border: 'none', cursor: disabled ? 'default' : 'pointer',
    fontSize: 16, fontWeight: 500, fontFamily: BRAND.display
  }}>{children}</button>
);

// ── Slide tabs ────────────────────────────────────────────────────────
// Compact 5-button picker: TL · TR · BL · BR · Hide
const CORNER_OPTIONS = [
  { k: 'tl', label: '↖' },
  { k: 'tr', label: '↗' },
  { k: 'bl', label: '↙' },
  { k: 'br', label: '↘' },
  { k: 'hidden', label: '×' },
];
// Small inline 3-way colour toggle for wordmark/sender: auto · ink · bone
const ColorTriToggle = ({ value, onChange }) => {
  const opts = [
    { k: 'auto', label: '⌬', title: 'AUTO (palette)' },
    { k: 'ink',  label: '■', title: 'INK', color: BRAND.ink },
    { k: 'bone', label: '□', title: 'BONE', color: BRAND.bone00 },
  ];
  return (
    <div style={{ display: 'flex', gap: 2, padding: 2, background: BRAND.bone, border: `1px solid ${BRAND.ink100}` }}>
      {opts.map(o => (
        <button key={o.k} title={o.title}
                onClick={() => onChange(o.k)}
                style={{
                  width: 22, height: 22, padding: 0, border: 'none',
                  background: value === o.k ? BRAND.ink : 'transparent',
                  color: value === o.k ? BRAND.gold : BRAND.ink600,
                  cursor: 'pointer', fontSize: 11, lineHeight: 1,
                  fontFamily: BRAND.mono,
                }}>{o.label}</button>
      ))}
    </div>
  );
};

const CornerPicker = ({ value, onChange }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3 }}>
    {CORNER_OPTIONS.map(({ k, label }) => {
      const on = value === k;
      const hide = k === 'hidden';
      return (
        <button
          key={k}
          onClick={() => onChange(k)}
          title={k.toUpperCase()}
          style={{
            padding: '9px 0', fontSize: 14, fontWeight: 500,
            background: on ? BRAND.ink : BRAND.paper,
            color: on ? (hide ? '#D67C1C' : BRAND.gold) : (hide ? '#946514' : BRAND.ink),
            border: `1px solid ${on ? BRAND.ink : BRAND.ink100}`,
            borderRadius: 0, cursor: 'pointer',
            fontFamily: BRAND.mono, lineHeight: 1
          }}
        >{label}</button>
      );
    })}
  </div>
);

const SlideTabs = ({ count, active, onPick, filled }) => (
  <div style={{ display: 'flex', gap: 3 }}>
    {Array.from({ length: count }).map((_, i) => {
      const isActive = i === active;
      const hasImg = !!filled?.[i];
      return (
        <button key={i} onClick={() => onPick(i)} style={{
          flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 500,
          background: isActive ? BRAND.ink : BRAND.paper,
          color: isActive ? BRAND.bone00 : BRAND.ink,
          border: `1px solid ${isActive ? BRAND.ink : BRAND.ink100}`,
          borderRadius: 0, cursor: 'pointer',
          fontFamily: BRAND.mono, letterSpacing: '0.06em',
          position: 'relative'
        }}>
          {i + 1}
          {hasImg && (
            <span style={{
              position: 'absolute', top: 3, right: 4, width: 5, height: 5,
              background: BRAND.gold, borderRadius: '50%'
            }} />
          )}
        </button>
      );
    })}
  </div>
);

// ── Image fit controls ───────────────────────────────────────────────
const ImageFitControls = ({ image, fit, onChange, showFrameRatio, isWide, defaultRatio }) => {
  const picker = useRef(null);

  if (!image) {
    return (
      <div style={{
        fontSize: 11, color: BRAND.ink600, padding: '14px',
        border: `1px dashed ${BRAND.ink100}`, textAlign: 'center',
        fontFamily: BRAND.mono, letterSpacing: '0.08em', textTransform: 'uppercase'
      }}>NO IMAGE LOADED</div>
    );
  }

  const f = { ...DEFAULT_FIT, ...fit };

  const handlePickerClick = (e) => {
    if (!picker.current) return;
    const r = picker.current.getBoundingClientRect();
    onChange({
      focalX: clamp((e.clientX - r.left) / r.width,  0, 1),
      focalY: clamp((e.clientY - r.top)  / r.height, 0, 1),
    });
  };

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 12 }}>
        {['cover', 'contain'].map(m => (
          <button key={m} onClick={() => onChange({ mode: m })} style={{
            flex: 1, padding: '9px', fontSize: 10.5, fontWeight: 500,
            background: f.mode === m ? BRAND.ink : BRAND.paper,
            color: f.mode === m ? BRAND.bone00 : BRAND.ink,
            border: `1px solid ${f.mode === m ? BRAND.ink : BRAND.ink100}`,
            borderRadius: 0, cursor: 'pointer', fontFamily: BRAND.mono,
            letterSpacing: '0.1em', textTransform: 'uppercase'
          }}>{m}</button>
        ))}
      </div>

      {/* Hint */}
      <div style={{
        fontSize: 9.5, color: BRAND.ink600, marginBottom: 8,
        fontFamily: BRAND.mono, letterSpacing: '0.06em', textTransform: 'uppercase',
        lineHeight: 1.55
      }}>
        TIP · DRAG ON PREVIEW TO PAN · SCROLL TO ZOOM
      </div>

      {/* Focal picker thumbnail */}
      <div style={{
        fontSize: 10, color: BRAND.ink600, marginBottom: 6,
        fontFamily: BRAND.mono, letterSpacing: '0.08em', textTransform: 'uppercase'
      }}>FOCAL ANCHOR · CLICK TO SET</div>
      <div
        ref={picker}
        onClick={handlePickerClick}
        style={{
          position: 'relative', width: '100%', aspectRatio: image.width / image.height,
          background: BRAND.bone, border: `1px solid ${BRAND.ink100}`,
          cursor: 'crosshair', overflow: 'hidden', marginBottom: 14
        }}>
        <img src={image.src} alt="" draggable={false}
             style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }} />
        <Crosshair x={f.focalX} y={f.focalY} />
      </div>

      {/* Numeric grid */}
      {showFrameRatio && (
        <FitSlider
          label={isWide ? 'Frame width' : 'Frame height'}
          value={f.frameRatio ?? defaultRatio}
          min={0.15} max={0.9} step={0.01}
          onChange={(v) => onChange({ frameRatio: v })}
          format={(v) => (v * 100).toFixed(0) + '%'}
        />
      )}
      <FitSlider label="Scale"    value={f.scale}    min={0.1}  max={5}   step={0.01} onChange={(v) => onChange({ scale: v })}    format={(v) => v.toFixed(2) + '×'} />
      <FitSlider label="Pan X"    value={f.offsetX}  min={-200} max={200} step={1}    onChange={(v) => onChange({ offsetX: v })}  format={(v) => v.toFixed(0) + '%'} />
      <FitSlider label="Pan Y"    value={f.offsetY}  min={-200} max={200} step={1}    onChange={(v) => onChange({ offsetY: v })}  format={(v) => v.toFixed(0) + '%'} />
      <FitSlider label="Rotation" value={f.rotation} min={-180} max={180} step={1}    onChange={(v) => onChange({ rotation: v })} format={(v) => v.toFixed(0) + '°'} />

      {/* FRAME EDGES — move each edge; the image re-fits, the background fills. */}
      {(() => {
        const ins = normalizeFrameInset(f.frameInset);
        const set = (k, v) => onChange({ frameInset: { ...ins, [k]: v } });
        return (
          <>
            <div style={{
              display: 'flex', justifyContent: 'space-between', marginTop: 10,
              fontSize: 9.5, color: BRAND.ink600, fontFamily: BRAND.mono,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              <span>Frame edges · move</span>
              <span style={{ color: BRAND.ink300 }}>+ in · − out</span>
            </div>
            {['top', 'right', 'bottom', 'left'].map((k) => (
              <FitSlider key={k} label={`${k[0].toUpperCase()}${k.slice(1)} edge`}
                value={ins[k]} min={INSET_MIN} max={INSET_MAX} step={0.005}
                onChange={(v) => set(k, v)} format={(v) => (v * 100).toFixed(1) + '%'} />
            ))}
            <div style={{
              fontSize: 9, color: BRAND.ink300, fontFamily: BRAND.mono,
              letterSpacing: '0.04em', lineHeight: 1.5, marginTop: 2,
            }}>MOVES THE FRAME EDGE · IMAGE RE-FITS · BACKGROUND FILLS THE FREED SPACE</div>
          </>
        );
      })()}

      {/* FRAME TILT — diagonal cuts; the wedge shows the background through. */}
      {(() => {
        const tl = normalizeFrameTilt(f.frameTilt);
        const set = (k, v) => onChange({ frameTilt: { ...tl, [k]: v } });
        return (
          <>
            <div style={{
              display: 'flex', justifyContent: 'space-between', marginTop: 10,
              fontSize: 9.5, color: BRAND.ink600, fontFamily: BRAND.mono,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              <span>Frame tilt · diagonal edges</span>
              <span style={{ color: BRAND.ink300 }}>±{TILT_MAX}°</span>
            </div>
            {['top', 'right', 'bottom', 'left'].map((k) => (
              <FitSlider key={k} label={`Tilt ${k}`}
                value={tl[k]} min={-TILT_MAX} max={TILT_MAX} step={0.5}
                onChange={(v) => set(k, v)} format={(v) => v.toFixed(1) + '°'} />
            ))}
            <div style={{
              fontSize: 9, color: BRAND.ink300, fontFamily: BRAND.mono,
              letterSpacing: '0.04em', lineHeight: 1.5, marginTop: 2,
            }}>CUTS MOVE INTO THE IMAGE · BACKGROUND SHOWS THROUGH THE WEDGE</div>
          </>
        );
      })()}

      {/* Edge fade — gradient mask per edge */}
      <EdgeFadeBlock fade={f.edgeFade} onChange={(edgeFade) => onChange({ edgeFade })} />

      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: 8,
        fontSize: 10.5, color: BRAND.ink600, fontFamily: BRAND.mono,
        letterSpacing: '0.06em'
      }}>
        <span>FOCAL · {(f.focalX * 100).toFixed(0)}, {(f.focalY * 100).toFixed(0)}</span>
        <button onClick={() => onChange({ ...DEFAULT_FIT })} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: BRAND.ink, fontFamily: BRAND.mono, fontSize: 10.5,
          letterSpacing: '0.06em', textDecoration: 'underline', padding: 0
        }}>RESET ALL</button>
      </div>
    </div>
  );
};

const Crosshair = ({ x, y }) => (
  <div style={{
    position: 'absolute',
    left: `calc(${x * 100}% - 8px)`,
    top:  `calc(${y * 100}% - 8px)`,
    width: 16, height: 16, pointerEvents: 'none',
    border: `1.5px solid ${BRAND.gold}`, borderRadius: '50%',
    boxShadow: '0 0 0 1px rgba(19,19,16,0.5)'
  }}>
    <div style={{ position: 'absolute', left: 6,  top: -10, width: 1.5, height: 8, background: BRAND.gold }} />
    <div style={{ position: 'absolute', left: 6,  top: 16,  width: 1.5, height: 8, background: BRAND.gold }} />
    <div style={{ position: 'absolute', top: 6,   left: -10, height: 1.5, width: 8, background: BRAND.gold }} />
    <div style={{ position: 'absolute', top: 6,   left: 16,  height: 1.5, width: 8, background: BRAND.gold }} />
  </div>
);

const FitSlider = ({ label, value, min, max, step, onChange, format }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      fontSize: 10, fontFamily: BRAND.mono, letterSpacing: '0.08em',
      color: BRAND.ink600, marginBottom: 2, textTransform: 'uppercase'
    }}>
      <span>{label}</span>
      <span style={{ color: BRAND.ink }}>{format ? format(value) : value}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
           onChange={(e) => onChange(parseFloat(e.target.value))}
           onDoubleClick={() => onChange(label === 'Scale' ? 1 : 0)}
           style={{ width: '100%', accentColor: BRAND.ink, display: 'block' }} />
  </div>
);

// Per-edge fade controls. Each edge has a dual-handle slider for {start, end}:
//   start (ink handle)  = where the SOLID bg band ends
//   end   (gold handle) = where the gradient reaches fully transparent
// Sliding both to the same point disables the edge.
const normalizeEdgeForUI = (v) => {
  if (typeof v === 'number') return { start: 0, end: v };
  if (!v) return { start: 0, end: 0 };
  return { start: v.start || 0, end: v.end || 0 };
};
const EMPTY_EDGES = { top: {start:0,end:0}, right: {start:0,end:0}, bottom: {start:0,end:0}, left: {start:0,end:0} };

const EdgeFadeBlock = ({ fade, onChange }) => {
  const f = {
    top:    normalizeEdgeForUI(fade?.top),
    right:  normalizeEdgeForUI(fade?.right),
    bottom: normalizeEdgeForUI(fade?.bottom),
    left:   normalizeEdgeForUI(fade?.left),
  };
  const setEdge = (k, v) => onChange({ ...f, [k]: { start: clamp(v.start, 0, 1), end: clamp(v.end, 0, 1) } });

  // Gradient stops for the live preview rectangle
  const stops = (dir) => {
    const v = f[dir];
    if (v.end <= 0 || v.end <= v.start) return null;
    // start..end → solid ink up to start*100%, then fade
    const startPct = (v.start * 100).toFixed(1);
    const endPct   = (v.end   * 100).toFixed(1);
    return `linear-gradient(to ${dir === 'top' ? 'bottom' : dir === 'bottom' ? 'top' : dir === 'left' ? 'right' : 'left'},
      ${BRAND.ink} 0%, ${BRAND.ink} ${startPct}%, transparent ${endPct}%)`;
  };

  return (
    <div style={{
      marginTop: 14, padding: '12px 12px 10px', background: BRAND.bone,
      border: `1px solid ${BRAND.ink100}`
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        fontSize: 10, fontFamily: BRAND.mono, letterSpacing: '0.12em',
        color: BRAND.ink, marginBottom: 10, textTransform: 'uppercase'
      }}>
        <span>EDGE FADE · RAMP</span>
        <button
          onClick={() => onChange(EMPTY_EDGES)}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: BRAND.ink600, fontFamily: BRAND.mono, fontSize: 9.5,
            letterSpacing: '0.08em', textDecoration: 'underline', padding: 0
          }}
        >CLEAR</button>
      </div>

      {/* Visual preview — gradients honour the start/end stops */}
      <div style={{
        position: 'relative', height: 64, marginBottom: 12,
        background: BRAND.paper, border: `1px solid ${BRAND.ink100}`
      }}>
        {f.top.end > f.top.start && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: `${f.top.end * 100}%`,
            background: stops('top'),
            opacity: 0.6
          }} />
        )}
        {f.bottom.end > f.bottom.start && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: `${f.bottom.end * 100}%`,
            background: stops('bottom'),
            opacity: 0.6
          }} />
        )}
        {f.left.end > f.left.start && (
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: 0,
            width: `${f.left.end * 100}%`,
            background: stops('left'),
            opacity: 0.6
          }} />
        )}
        {f.right.end > f.right.start && (
          <div style={{
            position: 'absolute', top: 0, bottom: 0, right: 0,
            width: `${f.right.end * 100}%`,
            background: stops('right'),
            opacity: 0.6
          }} />
        )}
      </div>

      <EdgeRamp label="↑ TOP"    value={f.top}    onChange={(v) => setEdge('top', v)} />
      <EdgeRamp label="↓ BOTTOM" value={f.bottom} onChange={(v) => setEdge('bottom', v)} />
      <EdgeRamp label="← LEFT"   value={f.left}   onChange={(v) => setEdge('left', v)} />
      <EdgeRamp label="→ RIGHT"  value={f.right}  onChange={(v) => setEdge('right', v)} />

      <div style={{
        marginTop: 4, fontSize: 9.5, color: BRAND.ink600, fontFamily: BRAND.mono,
        letterSpacing: '0.06em', lineHeight: 1.5
      }}>
        INK HANDLE · SOLID UNTIL · GOLD HANDLE · FADE END
      </div>
    </div>
  );
};

// One row per edge: label + dual-handle slider + numeric readout.
const EdgeRamp = ({ label, value, onChange }) => {
  const { start, end } = value;
  const off = end <= start;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        fontSize: 10, fontFamily: BRAND.mono, color: BRAND.ink600,
        letterSpacing: '0.08em', marginBottom: 4, textTransform: 'uppercase'
      }}>
        <span>{label}</span>
        <span style={{ color: off ? BRAND.ink600 : BRAND.ink }}>
          {off ? 'OFF' : `${(start*100).toFixed(0)}% → ${(end*100).toFixed(0)}%`}
        </span>
      </div>
      <DualRangeSlider start={start} end={end} onChange={onChange} />
    </div>
  );
};

// Dual-handle slider: ink thumb = start, gold thumb = end. Drag either, or click
// the track to jump the nearest thumb. Live gradient between them.
const DualRangeSlider = ({ start, end, onChange }) => {
  const ref = useRef(null);
  const [drag, setDrag] = useState(null);

  const fromX = (clientX) => {
    if (!ref.current) return 0;
    const r = ref.current.getBoundingClientRect();
    return clamp((clientX - r.left) / r.width, 0, 1);
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e) => {
      const v = fromX(e.clientX);
      if (drag === 'start') onChange({ start: Math.min(v, end), end });
      else                  onChange({ start, end: Math.max(v, start) });
    };
    const up = () => setDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => window.removeEventListener('pointermove', move);
  }, [drag, start, end, onChange]);

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        const v = fromX(e.clientX);
        // Click track → jump nearest handle there, then start drag
        const which = Math.abs(v - start) < Math.abs(v - end) ? 'start' : 'end';
        if (which === 'start') onChange({ start: Math.min(v, end), end });
        else                   onChange({ start, end: Math.max(v, start) });
        setDrag(which);
      }}
      style={{
        position: 'relative', height: 22, cursor: 'pointer',
        touchAction: 'none', userSelect: 'none'
      }}
    >
      {/* Track */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 10,
        height: 2, background: BRAND.ink100
      }} />
      {/* Gradient between start and end */}
      <div style={{
        position: 'absolute',
        left: `${start * 100}%`,
        width: `${Math.max(0, (end - start) * 100)}%`,
        top: 8, height: 6,
        background: `linear-gradient(to right, ${BRAND.ink}, ${BRAND.bone00})`,
        border: `1px solid ${BRAND.ink600}`, boxSizing: 'border-box'
      }} />
      {/* Start handle (ink) */}
      <div style={{
        position: 'absolute',
        left: `calc(${start * 100}% - 5px)`,
        top: 3, width: 10, height: 16,
        background: BRAND.ink, border: `1px solid ${BRAND.ink}`,
        cursor: 'grab', pointerEvents: 'none'
      }} />
      {/* End handle (gold) */}
      <div style={{
        position: 'absolute',
        left: `calc(${end * 100}% - 5px)`,
        top: 3, width: 10, height: 16,
        background: BRAND.gold, border: `1px solid ${BRAND.gold500}`,
        cursor: 'grab', pointerEvents: 'none'
      }} />
    </div>
  );
};

// ── Canto search section ─────────────────────────────────────────────

const CantoSection = ({ onPickImage, onSaveToLibrary, sectionProps = {} }) => {
  const [status, setStatus] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [savedIds, setSavedIds] = useState({}); // asset.id → true once saved this session

  useEffect(() => {
    fetch('/api/canto/status')
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus({ configured: false, reason: 'Canto plugin not reachable' }));
  }, []);

  const runSearch = async (q) => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/canto/search?q=${encodeURIComponent(q)}&limit=60`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Search failed');
      setResults(data.results || []);
    } catch (e) {
      setError(e.message);
      setResults([]);
    } finally { setLoading(false); }
  };

  const pickAsset = (asset) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => onPickImage(img);
    img.onerror = () => setError('Failed to load Canto image');
    img.src = asset.originalUrl;
  };

  // Save a Canto asset into the standard (saved) library without applying it.
  const saveAsset = (asset) => {
    if (!onSaveToLibrary) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const ok = onSaveToLibrary(img, asset.name || 'Canto image', 'canto');
      if (ok) setSavedIds(prev => ({ ...prev, [asset.id]: true }));
    };
    img.onerror = () => setError('Failed to load Canto image for saving');
    img.src = asset.originalUrl;
  };

  return (
    <Section {...sectionProps}>
      {!status && (
        <div style={{ fontSize: 11, color: BRAND.ink600, fontFamily: BRAND.mono }}>
          checking status…
        </div>
      )}
      {status && !status.configured && (
        <div style={{
          fontSize: 10.5, color: BRAND.ink600, lineHeight: 1.55,
          padding: '12px', background: BRAND.bone, border: `1px solid ${BRAND.ink100}`,
          fontFamily: BRAND.mono, letterSpacing: '0.03em'
        }}>
          NOT CONFIGURED · {status.reason || ''}
          <div style={{ marginTop: 6, fontWeight: 400, color: BRAND.ink600, fontSize: 10 }}>
            Copy <code style={{ background: BRAND.bone00, padding: '0 4px' }}>.env.local.example</code> to
            {' '}<code style={{ background: BRAND.bone00, padding: '0 4px' }}>.env.local</code>,
            add your Canto domain + token, then restart <code>npm run dev</code>.
          </div>
        </div>
      )}
      {status?.configured && (
        <>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            <input
              type="text"
              placeholder="Search Canto…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch(query); }}
            />
            <button onClick={() => runSearch(query)} style={{
              padding: '0 14px', background: BRAND.ink, color: BRAND.bone00,
              border: 'none', cursor: 'pointer', fontFamily: BRAND.mono,
              fontSize: 11, fontWeight: 500, letterSpacing: '0.1em',
              textTransform: 'uppercase'
            }}>GO</button>
          </div>
          <div style={{
            fontSize: 10, color: BRAND.ink600, marginBottom: 8,
            fontFamily: BRAND.mono, letterSpacing: '0.06em'
          }}>
            {status.domain} · {status.mode === 'token' ? 'token auth' : 'OAuth client credentials'}
            {loading && ' · loading…'}
            {!loading && results.length > 0 && ` · ${results.length} result${results.length === 1 ? '' : 's'}`}
          </div>
          {error && (
            <div style={{
              fontSize: 10.5, color: '#6B2424', marginBottom: 10,
              fontFamily: BRAND.mono
            }}>ERROR · {error}</div>
          )}
          {results.length > 0 && (
            <div style={{ fontSize: 9.5, color: BRAND.ink600, marginBottom: 6, fontFamily: BRAND.mono, letterSpacing: '0.04em' }}>
              Click to use · <span style={{ color: BRAND.gold }}>+LIB</span> saves to your standard library
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, maxHeight: expanded ? 'none' : 280, overflow: 'auto' }}>
            {results.map(a => (
              <div key={a.id} title={a.name} onClick={() => pickAsset(a)} style={{
                aspectRatio: '1', background: BRAND.bone,
                border: `1px solid ${BRAND.ink100}`, borderRadius: 0,
                cursor: 'pointer', padding: 0, overflow: 'hidden', position: 'relative'
              }}>
                {a.previewUrl && (
                  <img src={a.previewUrl} alt={a.name} loading="lazy"
                       style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                )}
                {onSaveToLibrary && (
                  <span onClick={(e) => { e.stopPropagation(); saveAsset(a); }}
                        title={savedIds[a.id] ? 'Saved to library' : 'Save to standard library'}
                        style={{
                          position: 'absolute', top: 3, right: 3, padding: '1px 5px',
                          background: savedIds[a.id] ? BRAND.gold : 'rgba(19,19,16,0.72)',
                          color: savedIds[a.id] ? BRAND.ink : BRAND.bone00,
                          fontSize: 8.5, fontFamily: BRAND.mono, letterSpacing: '0.06em',
                          cursor: 'pointer', borderRadius: 2, fontWeight: 500,
                        }}>{savedIds[a.id] ? 'SAVED' : '+LIB'}</span>
                )}
              </div>
            ))}
          </div>
          {results.length > 8 && (
            <button onClick={() => setExpanded(!expanded)} style={{
              marginTop: 8, background: 'transparent', border: 'none', cursor: 'pointer',
              color: BRAND.ink, fontFamily: BRAND.mono, fontSize: 10.5,
              letterSpacing: '0.1em', textTransform: 'uppercase', padding: 0,
              textDecoration: 'underline'
            }}>{expanded ? 'COLLAPSE' : 'EXPAND'}</button>
          )}
        </>
      )}
    </Section>
  );
};

// ──────────────────────────────────────────────────────────────────────
// PLAYGROUND VIEW (unchanged behavior, brand-aligned styling)
// ──────────────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────
// CHAT ASSISTANT — guided step-by-step setup
// ──────────────────────────────────────────────────────────────────────
function ChatAssistant({ onClose, state, actions }) {
  const [history, setHistory] = useState([]); // [{role: 'bot'|'user', text|node}]
  const [stepIdx, setStepIdx] = useState(0);
  const [textInput, setTextInput] = useState('');
  const scrollRef = useRef(null);

  // ── Question definitions ────────────────────────────────────────
  // Each step: id, prompt, type, options/inputType, apply(value, ctx)
  const STEPS = [
    {
      id: 'template',
      prompt: "Hi! Let's build a Medartis asset together. What kind of content is this?",
      type: 'choice',
      options: [
        { value: 'product-launch',      label: 'Product launch (APTUS, MODUS 2, …)' },
        { value: 'congress',            label: 'Event / Congress' },
        { value: 'surgeon-recognition', label: 'Surgeon recognition (Masters)' },
        { value: 'quote-card',          label: 'Thought leadership / principle' },
        { value: 'internal-comms',      label: 'Internal milestone' },
      ],
      apply: (v) => actions.setTemplateKey(v),
      summary: (v) => ({ 'product-launch':'Product launch','congress':'Event','surgeon-recognition':'Surgeon recognition','quote-card':'Thought leadership','internal-comms':'Internal' }[v] || v),
    },
    {
      id: 'format',
      prompt: 'Where will this be published?',
      type: 'choice-grouped',
      groups: [
        { label: 'Social', options: [
          { value: 'ig-post',      label: 'Instagram Post · 1:1' },
          { value: 'ig-story',     label: 'Instagram Story · 9:16' },
          { value: 'ig-carousel',  label: 'Instagram Carousel · 1:1 (multi-slide)' },
          { value: 'li-post',      label: 'LinkedIn Post · 1:1' },
          { value: 'li-carousel',  label: 'LinkedIn Carousel · 1:1 (multi-slide)' },
          { value: 'li-ad',        label: 'LinkedIn Ad · 1.91:1' },
        ]},
        { label: 'Print', options: [
          { value: 'a4-portrait', label: 'A4 Portrait · 300 dpi' },
          { value: 'poster-a3',   label: 'Event Poster A3' },
          { value: 'postcard-a6', label: 'Postcard A6' },
        ]},
        { label: 'Digital', options: [
          { value: 'screensaver',  label: '16:9 Screensaver' },
          { value: 'email-header', label: 'Email Header' },
          { value: 'web-hero',     label: 'Web Hero · desktop' },
        ]},
      ],
      apply: (v) => actions.setFormatKey(v),
      summary: (v) => v,
    },
    {
      id: 'slides',
      prompt: 'How many slides for this carousel?',
      condition: () => (FORMATS[state.formatKey] || {}).multi,
      type: 'number',
      min: 2, max: 10, default: state.carouselSlides || 3,
      apply: (v) => { actions.setCarouselSlides(parseInt(v, 10)); },
      summary: (v) => `${v} slides`,
    },
    {
      id: 'headline',
      prompt: 'Headline?',
      type: 'text',
      placeholder: state.content?.headline || 'APTUS Hand 2.0',
      apply: (v) => actions.updateField('headline', v),
      summary: (v) => v,
    },
    {
      id: 'eyebrow',
      prompt: 'Eyebrow / category label above the headline?',
      type: 'text',
      placeholder: state.content?.eyebrow || '§ 01 — NEW SYSTEM',
      apply: (v) => actions.updateField('eyebrow', v),
      summary: (v) => v,
    },
    {
      id: 'subline',
      prompt: 'Meta-message or subline?',
      type: 'text',
      placeholder: state.content?.subline || 'Precision at hand.',
      apply: (v) => actions.updateField('subline', v),
      summary: (v) => v,
    },
    {
      id: 'body',
      prompt: 'Body copy? (skip if not needed)',
      type: 'textarea',
      placeholder: 'Anatomical fixation for the distal radius. Engineered with the surgeon, for the patient.',
      skippable: true,
      apply: (v) => actions.updateField('body', v),
      summary: (v) => v || '(skipped)',
    },
    {
      id: 'cta',
      prompt: 'Catalog reference / footer? (skip if not needed)',
      type: 'text',
      placeholder: 'R_HAND-01000001_v0',
      skippable: true,
      apply: (v) => actions.updateField('cta', v),
      summary: (v) => v || '(skipped)',
    },
    {
      id: 'palette',
      prompt: 'Surface treatment?',
      type: 'choice',
      options: [
        { value: 'coal',       label: 'Coal — deep dark digital surface (recommended for hero)' },
        { value: 'bone',       label: 'Bone — warm light paper, gentle' },
        { value: 'paper',      label: 'Paper — pure white' },
        { value: 'cream',      label: 'Cream — slightly warmer than bone' },
        { value: 'ink',        label: 'Ink — near-black' },
        { value: 'deep-black', label: 'Deep Black — CMYK 4-channel composite (print only)' },
      ],
      apply: (v) => actions.setPaletteName(v),
      summary: (v) => v,
    },
    {
      id: 'image',
      prompt: 'Add an image?',
      type: 'choice',
      options: [
        { value: 'library', label: 'Pick from Medartis library' },
        { value: 'upload',  label: 'Upload a file (JPG / PNG / PSD)' },
        { value: 'skip',    label: 'Skip — no image yet' },
      ],
      apply: () => {},
      summary: (v) => v,
    },
    {
      id: 'image-picker',
      prompt: 'Pick a library asset:',
      condition: (answers) => answers.image === 'library',
      type: 'library',
      apply: (assetSrc) => {
        const img = (actions.libraryImages || {});
        const match = Object.entries(img).find(([, im]) => im?.src?.endsWith(assetSrc));
        if (match) actions.applyImage(match[1]);
      },
      summary: (v) => v?.split('/').pop() || '(none)',
    },
    {
      id: 'image-upload',
      prompt: 'Upload your file:',
      condition: (answers) => answers.image === 'upload',
      type: 'file',
      apply: async (file) => {
        try {
          const dataUrl = await fileToImageDataUrl(file);
          actions.applyImage(dataUrl);
        } catch (e) { /* ignore */ }
      },
      summary: (file) => file?.name || '(uploaded)',
    },
    {
      id: 'sender',
      prompt: 'Sender / folio text? (default: medartis.com)',
      type: 'text',
      placeholder: state.folioText || 'medartis.com',
      skippable: true,
      apply: (v) => { if (v) actions.setFolioText(v); },
      summary: (v) => v || 'medartis.com',
    },
    {
      id: 'qr',
      prompt: 'Add a QR code with a URL? (skip if not needed)',
      type: 'text',
      placeholder: 'https://medartis.com',
      skippable: true,
      apply: (v) => {
        if (v) actions.setQrConfig({ ...state.qrConfig, enabled: true, url: v });
      },
      summary: (v) => v || '(no QR)',
    },
    {
      id: 'save',
      prompt: 'All set! Want to save this as a project? (you can also tweak more in the sidebar)',
      type: 'choice',
      options: [
        { value: 'save',  label: 'Save as project (auto-name)' },
        { value: 'done',  label: 'Just close — I\'ll keep editing' },
      ],
      apply: (v) => {
        if (v === 'save') {
          actions.setPresetName('');
          actions.savePreset();
        }
      },
      summary: (v) => v === 'save' ? 'Saved to projects' : 'Continued editing',
    },
  ];

  // Filter steps by condition + by answers so far
  const answersRef = useRef({});
  const activeSteps = STEPS.filter(s => !s.condition || s.condition(answersRef.current));
  const current = activeSteps[stepIdx];
  const done = stepIdx >= activeSteps.length;

  useEffect(() => {
    // Push the first bot prompt when assistant opens or when current step changes
    if (current && history.length === 0) {
      setHistory([{ role: 'bot', text: current.prompt, stepId: current.id }]);
    }
  }, []);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history, stepIdx]);

  const advance = (userMsg, value) => {
    const step = current;
    answersRef.current[step.id] = value;
    try { step.apply(value); } catch {}
    const newHistory = [...history, { role: 'user', text: userMsg }];
    const nextIdx = stepIdx + 1;
    // Re-filter by updated answers
    const nextActive = STEPS.filter(s => !s.condition || s.condition(answersRef.current));
    if (nextIdx < nextActive.length) {
      newHistory.push({ role: 'bot', text: nextActive[nextIdx].prompt, stepId: nextActive[nextIdx].id });
    }
    setHistory(newHistory);
    setStepIdx(nextIdx);
    setTextInput('');
  };

  const skip = () => advance('— skipped —', '');

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', justifyContent: 'flex-end', zIndex: 1000
    }}>
      <div style={{
        width: 460, maxWidth: '95vw', height: '100%', background: BRAND.bone00,
        display: 'flex', flexDirection: 'column', boxShadow: '-32px 0 80px rgba(0,0,0,0.4)'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px', borderBottom: `1px solid ${BRAND.ink100}`,
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', background: BRAND.gold,
            color: BRAND.ink, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: BRAND.mono, fontSize: 13, fontWeight: 600
          }}>✦</div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: BRAND.mono, fontSize: 10, color: BRAND.ink600,
              letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 1
            }}>GUIDED SETUP</div>
            <div style={{ fontWeight: 500, fontSize: 14, color: BRAND.ink }}>
              {done ? 'All done' : `Step ${stepIdx + 1} of ~${activeSteps.length}`}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: `1px solid ${BRAND.ink100}`,
            padding: '6px 10px', cursor: 'pointer', fontFamily: BRAND.mono,
            fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase'
          }}>CLOSE</button>
        </div>

        {/* Chat history */}
        <div ref={scrollRef} style={{
          flex: 1, overflowY: 'auto', padding: '18px 22px',
          display: 'flex', flexDirection: 'column', gap: 12
        }}>
          {history.map((msg, i) => (
            <div key={i} style={{
              alignSelf: msg.role === 'bot' ? 'flex-start' : 'flex-end',
              maxWidth: '85%',
              background: msg.role === 'bot' ? BRAND.bone : BRAND.ink,
              color: msg.role === 'bot' ? BRAND.ink : BRAND.bone00,
              padding: '10px 14px', fontSize: 13.5, lineHeight: 1.5,
              border: msg.role === 'bot' ? `1px solid ${BRAND.ink100}` : 'none'
            }}>{msg.text}</div>
          ))}
          {done && (
            <div style={{
              alignSelf: 'flex-start', maxWidth: '85%',
              background: BRAND.gold, color: BRAND.ink,
              padding: '12px 14px', fontSize: 13.5
            }}>
              Your asset is ready in the preview. Tweak any detail in the right sidebar
              or close this panel to continue. 🎉
            </div>
          )}
        </div>

        {/* Input area */}
        {!done && current && (
          <div style={{
            padding: '14px 22px', borderTop: `1px solid ${BRAND.ink100}`,
            background: BRAND.bone
          }}>
            {/* Choice */}
            {current.type === 'choice' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {current.options.map(o => (
                  <button key={o.value}
                    onClick={() => advance(o.label, o.value)}
                    style={chatChoiceStyle}
                  >{o.label}</button>
                ))}
              </div>
            )}
            {current.type === 'choice-grouped' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {current.groups.map(g => (
                  <div key={g.label}>
                    <div style={{
                      fontFamily: BRAND.mono, fontSize: 10, color: BRAND.ink600,
                      letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4
                    }}>{g.label}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {g.options.map(o => (
                        <button key={o.value}
                          onClick={() => advance(o.label, o.value)}
                          style={chatChipStyle}
                        >{o.label}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(current.type === 'text' || current.type === 'textarea') && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                {current.type === 'textarea' ? (
                  <textarea value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder={current.placeholder} rows={2}
                    style={{ flex: 1 }} />
                ) : (
                  <input type="text" value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') advance(textInput || current.placeholder, textInput || current.placeholder); }}
                    placeholder={current.placeholder} style={{ flex: 1 }} />
                )}
                <button onClick={() => advance(textInput || current.placeholder, textInput || current.placeholder)}
                        style={{ ...chatChoiceStyle, padding: '11px 16px', flex: 'none' }}>
                  →
                </button>
                {current.skippable && (
                  <button onClick={skip} style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: BRAND.ink600, fontFamily: BRAND.mono, fontSize: 10,
                    letterSpacing: '0.1em', textTransform: 'uppercase'
                  }}>SKIP</button>
                )}
              </div>
            )}
            {current.type === 'number' && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {Array.from({ length: (current.max - current.min) + 1 }).map((_, i) => {
                  const n = current.min + i;
                  return (
                    <button key={n} onClick={() => advance(String(n), n)} style={{
                      ...chatChipStyle,
                      minWidth: 38,
                    }}>{n}</button>
                  );
                })}
              </div>
            )}
            {current.type === 'library' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                {LIBRARY.map(a => (
                  <button key={a.id} title={a.label}
                    onClick={() => advance(a.label, a.src)}
                    style={{
                      aspectRatio: '1', padding: 0, border: `1px solid ${BRAND.ink100}`,
                      cursor: 'pointer', overflow: 'hidden', background: BRAND.paper
                    }}>
                    <img src={a.src} alt={a.label}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </button>
                ))}
              </div>
            )}
            {current.type === 'file' && (
              <label style={{ ...chatChoiceStyle, display: 'block', textAlign: 'center', cursor: 'pointer' }}>
                CHOOSE FILE · JPG / PNG / PSD
                <input type="file" accept="image/*,.psd,.psb"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    advance(f.name, f);
                  }}
                  style={{ display: 'none' }} />
              </label>
            )}
          </div>
        )}

        {done && (
          <div style={{
            padding: '14px 22px', borderTop: `1px solid ${BRAND.ink100}`,
            background: BRAND.bone, display: 'flex', gap: 8
          }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '12px', background: BRAND.ink, color: BRAND.bone00,
              border: 'none', cursor: 'pointer', fontFamily: BRAND.mono,
              fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase'
            }}>CLOSE</button>
            <button onClick={() => { setHistory([]); setStepIdx(0); answersRef.current = {}; }} style={{
              padding: '12px 16px', background: 'transparent', color: BRAND.ink,
              border: `1px solid ${BRAND.ink}`, cursor: 'pointer', fontFamily: BRAND.mono,
              fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase'
            }}>RESTART</button>
          </div>
        )}
      </div>
    </div>
  );
}

const chatChoiceStyle = {
  padding: '11px 14px', background: BRAND.paper, color: BRAND.ink,
  border: `1px solid ${BRAND.ink100}`, cursor: 'pointer',
  fontFamily: BRAND.display, fontSize: 13, fontWeight: 400,
  textAlign: 'left', borderRadius: 0,
};
const chatChipStyle = {
  padding: '8px 12px', background: BRAND.paper, color: BRAND.ink,
  border: `1px solid ${BRAND.ink100}`, cursor: 'pointer',
  fontFamily: BRAND.mono, fontSize: 11,
  letterSpacing: '0.06em', borderRadius: 0,
};

// ──────────────────────────────────────────────────────────────────────
// PROJECTS VIEW — browse saved presets as starting points
// ──────────────────────────────────────────────────────────────────────
function ProjectsView({ presets, onBack, onPick, onDelete, onExport, onImport, onSeedDemos }) {
  const [query, setQuery] = useState('');
  const [tplFilter, setTplFilter] = useState('all');

  const allEntries = Object.entries(presets || {})
    .sort(([, a], [, b]) => (b.savedAt || '').localeCompare(a.savedAt || ''));

  // Build available template + format facets for filter chips
  const templateCounts = {};
  for (const [, p] of allEntries) {
    const t = p.templateKey || 'unknown';
    templateCounts[t] = (templateCounts[t] || 0) + 1;
  }

  // Search across name + headline + content fields + format + template tags
  const q = query.trim().toLowerCase();
  const matchesQuery = (name, p) => {
    if (!q) return true;
    if (name.toLowerCase().includes(q)) return true;
    const fields = [p.formatKey, p.templateKey, p.layoutKey].filter(Boolean);
    if (fields.some(f => f.toLowerCase().includes(q))) return true;
    // also search the slide content (headline, eyebrow, subline, body, cta)
    const allContent = [
      p.content || {},
      ...(p.carouselContent || []),
    ];
    for (const c of allContent) {
      if (Object.values(c).some(v => typeof v === 'string' && v.toLowerCase().includes(q))) return true;
    }
    return false;
  };
  const matchesTpl = (p) => tplFilter === 'all' || p.templateKey === tplFilter;
  const entries = allEntries.filter(([name, p]) => matchesQuery(name, p) && matchesTpl(p));

  return (
    <div style={{
      width: '100%', height: '100vh', display: 'flex', flexDirection: 'column',
      fontFamily: BRAND.display, background: BRAND.coal, color: BRAND.bone00,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '22px 32px', borderBottom: `1px solid ${BRAND.coal700}`,
        display: 'flex', alignItems: 'center', gap: 24
      }}>
        <button onClick={onBack} style={{
          padding: '10px 14px',
          background: 'transparent', color: BRAND.bone00,
          border: `1px solid ${BRAND.cream300}`, borderRadius: 0,
          cursor: 'pointer', fontSize: 10.5, fontWeight: 500,
          fontFamily: BRAND.mono, letterSpacing: '0.12em', textTransform: 'uppercase'
        }}>← BACK</button>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 10.5, letterSpacing: '0.16em', fontWeight: 500,
            color: BRAND.cream300, marginBottom: 4, fontFamily: BRAND.mono,
            textTransform: 'uppercase'
          }}>§ 11 — PROJECTS GALLERY</div>
          <h1 style={{
            fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-0.02em',
            color: BRAND.bone00
          }}>
            Saved projects <span style={{ color: BRAND.gold }}>· {entries.length}{q || tplFilter !== 'all' ? ` / ${allEntries.length}` : ''}</span>
          </h1>
          <div style={{
            fontSize: 12, color: BRAND.cream300, marginTop: 4, fontWeight: 300
          }}>Pick a project to load it as a starting point for a new asset.</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onSeedDemos} style={{ ...projectViewBtn(true) }}>+ LOAD DEMOS</button>
          <button onClick={onExport} style={projectViewBtn(false)}>EXPORT CURRENT</button>
          <label style={{ ...projectViewBtn(false), cursor: 'pointer' }}>
            IMPORT JSON
            <input type="file" accept="application/json" onChange={onImport}
                   style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Search + template filter */}
      {allEntries.length > 0 && (
        <div style={{
          padding: '14px 32px', background: BRAND.coal,
          borderBottom: `1px solid ${BRAND.coal700}`,
          display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap'
        }}>
          <div style={{ flex: '0 1 360px', minWidth: 240 }}>
            <input
              type="text" value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects (name / headline / format)…"
              style={{
                width: '100%', padding: '10px 12px', fontSize: 13,
                background: BRAND.coal700, color: BRAND.bone00,
                border: `1px solid ${BRAND.coal700}`, borderRadius: 0,
                fontFamily: BRAND.display, outline: 'none'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[
              { k: 'all', label: 'ALL' },
              ...Object.keys(templateCounts).map(t => ({ k: t, label: (TEMPLATE_TAGS[t] || t.toUpperCase()) + ` · ${templateCounts[t]}` })),
            ].map(({ k, label }) => (
              <button key={k} onClick={() => setTplFilter(k)} style={{
                padding: '8px 12px', fontSize: 10.5,
                background: tplFilter === k ? BRAND.gold : 'transparent',
                color: tplFilter === k ? BRAND.ink : BRAND.bone00,
                border: `1px solid ${tplFilter === k ? BRAND.gold : BRAND.cream300}`,
                borderRadius: 0, cursor: 'pointer',
                fontFamily: BRAND.mono, fontWeight: 500,
                letterSpacing: '0.1em', textTransform: 'uppercase'
              }}>{label}</button>
            ))}
          </div>
          {(query || tplFilter !== 'all') && (
            <button onClick={() => { setQuery(''); setTplFilter('all'); }} style={{
              marginLeft: 'auto', padding: '8px 12px', fontSize: 10.5,
              background: 'transparent', color: BRAND.cream300,
              border: 'none', cursor: 'pointer', fontFamily: BRAND.mono,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              textDecoration: 'underline'
            }}>CLEAR FILTERS</button>
          )}
        </div>
      )}

      {/* Grid */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '24px 32px',
        background: BRAND.coal800
      }}>
        {entries.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', textAlign: 'center',
            color: BRAND.cream300
          }}>
            <div style={{
              fontFamily: BRAND.mono, fontSize: 11, letterSpacing: '0.14em',
              textTransform: 'uppercase', marginBottom: 8, color: BRAND.gold
            }}>{allEntries.length === 0 ? 'EMPTY' : 'NO MATCHES'}</div>
            <div style={{ fontSize: 16, fontWeight: 300, maxWidth: 480 }}>
              {allEntries.length === 0 ? (
                <>No saved projects yet. Build something in the editor and hit
                <span style={{ fontFamily: BRAND.mono }}> SAVE </span>
                in <span style={{ fontFamily: BRAND.mono }}>§ 10 — PRESETS</span> —
                project names auto-generate from template, format, and headline.</>
              ) : (
                <>No projects match these filters. Try a different search term or
                clear the filters above.</>
              )}
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 18
          }}>
            {entries.map(([name, p]) => (
              <ProjectCard key={name} name={name} preset={p}
                           onPick={() => onPick(name)}
                           onDelete={() => onDelete(name)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const projectViewBtn = (active) => ({
  padding: '10px 14px',
  background: active ? BRAND.gold : 'transparent',
  color: active ? BRAND.ink : BRAND.bone00,
  border: `1px solid ${active ? BRAND.gold : BRAND.cream300}`,
  borderRadius: 0, cursor: 'pointer', fontSize: 10.5, fontWeight: 500,
  fontFamily: BRAND.mono, letterSpacing: '0.12em', textTransform: 'uppercase'
});

function ProjectCard({ name, preset, onPick, onDelete }) {
  const date = preset.savedAt
    ? new Date(preset.savedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
  // Only mark as carousel when the saved FORMAT is actually multi-slide —
  // slide-count state survives non-multi formats but the badge shouldn't show.
  const isCarousel = preset.carouselSlides > 1 && !!FORMATS[preset.formatKey]?.multi;
  return (
    <div style={{
      background: BRAND.coal, border: `1px solid ${BRAND.coal700}`,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      cursor: 'pointer', transition: 'border-color 0.15s'
    }}
    onClick={onPick}
    onMouseEnter={(e) => e.currentTarget.style.borderColor = BRAND.gold}
    onMouseLeave={(e) => e.currentTarget.style.borderColor = BRAND.coal700}
    >
      {/* Thumbnail */}
      <div style={{
        aspectRatio: '4/3', background: BRAND.coal800,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative'
      }}>
        {preset.thumbnail ? (
          <img src={preset.thumbnail} alt={name}
               style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        ) : (
          <div style={{
            fontFamily: BRAND.mono, fontSize: 10, color: BRAND.cream300,
            letterSpacing: '0.12em', textTransform: 'uppercase'
          }}>NO PREVIEW</div>
        )}
        {isCarousel && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: BRAND.gold, color: BRAND.ink,
            fontSize: 9.5, fontWeight: 500, padding: '3px 7px',
            fontFamily: BRAND.mono, letterSpacing: '0.08em'
          }}>{preset.carouselSlides} SLIDES</div>
        )}
      </div>
      {/* Meta */}
      <div style={{ padding: '14px 14px 12px' }}>
        <div style={{
          fontSize: 14, fontWeight: 500, color: BRAND.bone00,
          marginBottom: 4, letterSpacing: '-0.005em'
        }}>{name}</div>
        <div style={{
          fontSize: 10.5, color: BRAND.cream300, fontFamily: BRAND.mono,
          letterSpacing: '0.06em', display: 'flex',
          justifyContent: 'space-between', alignItems: 'baseline'
        }}>
          <span>{preset.formatKey} · {preset.templateKey}</span>
          <span>{date}</span>
        </div>
      </div>
      <div style={{
        padding: '8px 14px 12px', display: 'flex', gap: 6, alignItems: 'center'
      }}>
        <button onClick={(e) => { e.stopPropagation(); onPick(); }} style={{
          flex: 1, padding: '10px', background: BRAND.gold, color: BRAND.ink,
          border: 'none', cursor: 'pointer', fontFamily: BRAND.mono,
          fontSize: 10.5, fontWeight: 500, letterSpacing: '0.12em',
          textTransform: 'uppercase'
        }}>USE AS STARTING POINT</button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{
          width: 32, height: 32, background: 'transparent',
          border: `1px solid ${BRAND.coal700}`, cursor: 'pointer',
          color: BRAND.cream300, fontSize: 14, lineHeight: 1
        }} title="Delete">×</button>
      </div>
    </div>
  );
}

function PlaygroundView({ onBack }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [shape, setShape] = useState('Square');
  const [blockSize, setBlockSize] = useState(28);
  const [threshold, setThreshold] = useState(44);
  const [maxCircles, setMaxCircles] = useState(180);
  const [minDistance, setMinDistance] = useState(30);
  const [minRadius, setMinRadius] = useState(13);
  const [maxRadius, setMaxRadius] = useState(36);
  const [maxConnDistance, setMaxConnDistance] = useState(230);
  const [lineWeight, setLineWeight] = useState(0.8);
  const [bg, setBg] = useState('coal');

  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const imgRef = useRef(null);
  const [imageData, setImageData] = useState(null);
  const [previewSize, setPreviewSize] = useState({ w: 500, h: 666 });
  const wrapRef = useRef(null);
  const SIZE = { w: 1080, h: 1440 };

  useEffect(() => {
    const update = () => {
      if (!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const pad = 40;
      const r = SIZE.w / SIZE.h;
      let w = rect.width - pad, h = w / r;
      if (h > rect.height - pad) { h = rect.height - pad; w = h * r; }
      setPreviewSize({ w, h });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const loadImage = (src) => {
    setImageSrc(src);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      const ac = document.createElement('canvas');
      const aw = 400, ah = Math.round(aw * (img.height / img.width));
      ac.width = aw; ac.height = ah;
      const ax = ac.getContext('2d');
      ax.drawImage(img, 0, 0, aw, ah);
      try { setImageData(ax.getImageData(0, 0, aw, ah)); } catch (e) {}
    };
    img.src = src;
  };

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const dataUrl = await fileToImageDataUrl(f);
      loadImage(dataUrl);
    } catch (err) {
      alert('Could not load image: ' + err.message);
    }
  };

  const points = useMemo(() => {
    if (!imageData) return [];
    const { data, width, height } = imageData;
    const ab = Math.max(8, Math.round(blockSize * (width / SIZE.w)));
    const raw = [];
    for (let y = 0; y < height; y += ab) {
      for (let x = 0; x < width; x += ab) {
        let lumSum = 0, count = 0, minL = 255, maxL = 0;
        for (let by = 0; by < ab && y + by < height; by += 2) {
          for (let bx = 0; bx < ab && x + bx < width; bx += 2) {
            const idx = ((y + by) * width + (x + bx)) * 4;
            const l = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            lumSum += l; if (l < minL) minL = l; if (l > maxL) maxL = l;
            count++;
          }
        }
        if (count === 0) continue;
        const avg = lumSum / count;
        const contrast = maxL - minL;
        const score = avg * 0.5 + contrast * 0.5;
        raw.push({ x: x + ab / 2, y: y + ab / 2, score });
      }
    }
    const sx = SIZE.w / width, sy = SIZE.h / height;
    const scaled = raw.map(p => ({ x: p.x * sx, y: p.y * sy, score: p.score }));
    const passing = scaled.filter(p => p.score >= threshold).sort((a, b) => b.score - a.score);
    const chosen = [];
    for (const p of passing) {
      if (chosen.length >= maxCircles) break;
      let ok = true;
      for (const q of chosen) {
        const dx = p.x - q.x, dy = p.y - q.y;
        if (dx * dx + dy * dy < minDistance * minDistance) { ok = false; break; }
      }
      if (ok) chosen.push(p);
    }
    const maxScore = Math.max(...chosen.map(p => p.score), 1);
    return chosen.map(p => ({ ...p, r: minRadius + (maxRadius - minRadius) * (p.score / maxScore) }));
  }, [imageData, blockSize, threshold, maxCircles, minDistance, minRadius, maxRadius]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = SIZE.w; canvas.height = SIZE.h;
    const ctx = canvas.getContext('2d');
    const palettes = {
      coal: { bg: BRAND.coal, fg: BRAND.bone00 },
      bone: { bg: BRAND.bone, fg: BRAND.ink },
      ink:  { bg: BRAND.ink,  fg: BRAND.cream100 },
    };
    const p = palettes[bg] || palettes.coal;
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, SIZE.w, SIZE.h);
    if (imgRef.current) {
      ctx.globalAlpha = 0.85;
      const ir = imgRef.current.width / imgRef.current.height;
      const cr = SIZE.w / SIZE.h;
      let dw, dh, dx, dy;
      if (ir > cr) { dw = SIZE.w; dh = dw / ir; dx = 0; dy = (SIZE.h - dh) / 2; }
      else         { dh = SIZE.h; dw = dh * ir; dy = 0; dx = (SIZE.w - dw) / 2; }
      ctx.drawImage(imgRef.current, dx, dy, dw, dh);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = p.fg; ctx.fillStyle = p.fg;
    ctx.lineWidth = lineWeight;
    ctx.globalAlpha = 0.65;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i], b = points[j];
        const d2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
        if (d2 < maxConnDistance ** 2) {
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.font = `500 9px ${BRAND.mono}`;
    for (const pt of points) {
      ctx.beginPath();
      if (shape === 'Circle') ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
      else ctx.rect(pt.x - pt.r, pt.y - pt.r, pt.r * 2, pt.r * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.55;
      ctx.fillText(`${Math.round(pt.x)},${Math.round(pt.y)}`, pt.x + pt.r + 4, pt.y - pt.r - 2);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = BRAND.gold;
    ctx.fillRect(40, 40, 6, 6);
  }, [points, shape, bg, imageSrc, lineWeight, maxConnDistance]);

  const download = () => {
    const link = document.createElement('a');
    link.download = `playground-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div style={{
      width: '100%', height: '100vh', display: 'flex',
      fontFamily: BRAND.display, background: BRAND.coal, color: BRAND.ink
    }}>
      <div ref={wrapRef} style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: BRAND.coal, position: 'relative'
      }}>
        <button onClick={onBack} style={{
          position: 'absolute', top: 22, left: 22, padding: '10px 14px',
          background: 'transparent', color: BRAND.bone00,
          border: `1px solid ${BRAND.cream300}`, borderRadius: 0,
          cursor: 'pointer', fontSize: 10.5, fontWeight: 500,
          fontFamily: BRAND.mono, letterSpacing: '0.12em', textTransform: 'uppercase'
        }}>← BACK TO TEMPLATES</button>
        <canvas ref={canvasRef} style={{
          width: previewSize.w, height: previewSize.h,
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)'
        }} />
      </div>
      <div style={{ width: 340, background: BRAND.bone00, padding: '24px 22px', overflowY: 'auto' }}>
        <div style={{
          fontSize: 10, letterSpacing: '0.16em', fontWeight: 500,
          color: BRAND.ink600, marginBottom: 8, fontFamily: BRAND.mono,
          textTransform: 'uppercase'
        }}>§ 99 — EXPERIMENTAL</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.02em', color: BRAND.ink }}>
          Geometric Playground
        </h2>
        <p style={{ fontSize: 12, color: BRAND.ink600, margin: '0 0 22px', fontWeight: 300, lineHeight: 1.5 }}>
          Topology overlay derived from image luminance. Functional — not decorative.
        </p>
        <input ref={fileRef} type="file" accept="image/*,.psd,.psb" onChange={handleFile} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()} style={{
          width: '100%', padding: '12px', background: BRAND.ink, color: BRAND.bone00,
          border: 'none', borderRadius: 0, fontSize: 11, fontWeight: 500,
          cursor: 'pointer', marginBottom: 22, fontFamily: BRAND.mono,
          letterSpacing: '0.14em', textTransform: 'uppercase'
        }}>{imageSrc ? 'REPLACE IMAGE' : 'UPLOAD IMAGE'}</button>

        <PSlider label="Block Size" value={blockSize} min={8} max={80} onChange={setBlockSize} />
        <PSlider label="Threshold" value={threshold} min={0} max={150} onChange={setThreshold} />
        <PSlider label="Max Shapes" value={maxCircles} min={10} max={500} step={5} onChange={setMaxCircles} />
        <PSlider label="Min Distance" value={minDistance} min={5} max={120} onChange={setMinDistance} />
        <PSlider label="Min Radius" value={minRadius} min={1} max={50} onChange={setMinRadius} />
        <PSlider label="Max Radius" value={maxRadius} min={5} max={150} onChange={setMaxRadius} />
        <PSlider label="Connection" value={maxConnDistance} min={0} max={500} step={5} onChange={setMaxConnDistance} />
        <PSlider label="Line Weight" value={lineWeight} min={0} max={3} step={0.1} onChange={setLineWeight} format={(v) => v.toFixed(1)} />

        <div style={{ marginTop: 16, marginBottom: 14 }}>
          <div style={{
            fontSize: 10, fontWeight: 500, letterSpacing: '0.12em',
            marginBottom: 6, fontFamily: BRAND.mono, textTransform: 'uppercase', color: BRAND.ink600
          }}>SHAPE</div>
          <div style={{ display: 'flex', gap: 3 }}>
            {['Circle', 'Square'].map(s => (
              <button key={s} onClick={() => setShape(s)} style={pillStyle(shape === s)}>{s}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 22 }}>
          <div style={{
            fontSize: 10, fontWeight: 500, letterSpacing: '0.12em',
            marginBottom: 6, fontFamily: BRAND.mono, textTransform: 'uppercase', color: BRAND.ink600
          }}>SURFACE</div>
          <div style={{ display: 'flex', gap: 3 }}>
            {['coal', 'bone', 'ink'].map(b => (
              <button key={b} onClick={() => setBg(b)} style={pillStyle(bg === b)}>{b.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <button onClick={download} style={{
          width: '100%', padding: '13px', background: BRAND.ink, color: BRAND.bone00,
          border: 'none', borderRadius: 0, fontSize: 11, fontWeight: 500,
          cursor: 'pointer', fontFamily: BRAND.mono,
          letterSpacing: '0.16em', textTransform: 'uppercase'
        }}>DOWNLOAD PNG</button>
      </div>
    </div>
  );
}

const pillStyle = (active) => ({
  flex: 1, padding: '9px', fontSize: 10.5, fontWeight: 500,
  background: active ? BRAND.ink : BRAND.paper,
  color: active ? BRAND.bone00 : BRAND.ink,
  border: `1px solid ${active ? BRAND.ink : BRAND.ink100}`,
  borderRadius: 0, cursor: 'pointer',
  fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase'
});

const PSlider = ({ label, value, min, max, step = 1, onChange, format }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
      <span style={{
        fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase',
        fontFamily: BRAND.mono, color: BRAND.ink600, fontSize: 10
      }}>{label}</span>
      <span style={{ fontFamily: BRAND.mono, fontSize: 10.5, color: BRAND.ink }}>{format ? format(value) : value}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
           onChange={(e) => onChange(parseFloat(e.target.value))}
           style={{ width: '100%', accentColor: BRAND.ink }} />
  </div>
);
