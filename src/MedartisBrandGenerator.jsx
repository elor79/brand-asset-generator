import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import { BROCHURE_TYPES, BROCHURE_TYPE_KEYS, defaultBrochurePages, makeBrochurePage } from './brochure';
import QRCodeStyling from 'qr-code-styling';
import { readPsd, initializeCanvas } from 'ag-psd';

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

// ── BRAND TOKENS ─────────────────────────────────────────────────────
const BRAND = {
  name: 'medartis',
  claim: 'Artful.',
  ink:     '#1d1d1b',
  ink800:  '#2A2A26',
  ink600:  '#555550',
  ink300:  '#9A9A8E',
  ink100:  '#D8D6CA',
  paper:   '#FFFFFF',
  bone:    '#F4F2EA',
  bone00:  '#FAF8F0',
  coal:    '#131310',
  coal800: '#1C1C17',
  coal700: '#2A2A23',
  cream50:  '#F6F4EC',
  cream100: '#E6E3D5',
  cream300: '#9E9B8B',
  gold:    '#CFAB5C',
  gold500: '#B8923D',
  // Accessible gold — the brand gold is only 1.9–2.2:1 on light surfaces, which
  // fails WCAG. This deepened gold keeps the hue and clears AA (4.6–5.1:1) on
  // paper/bone/cream. Used when "safe accent" is on (see the BRAND CHECK panel).
  goldDeep: '#8A6828',
  plateBlue: '#BBD7F3',
  display: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  mono:    '"JetBrains Mono", "SF Mono", Menlo, monospace',
};

// ── FORMATS ──────────────────────────────────────────────────────────
// `group` orders them in the sidebar.  `wmPct` is the wordmark width as a
// fraction of the short side — Brand Guide §logo_placement: 0.27 paged /
// 0.30 poster / 0.10 sensible digital default.
const FORMATS = {
  // ── SOCIAL · square + tall ────────────────────────────────
  'ig-post':         { label: 'Instagram Post',        w: 1080, h: 1080, ratio: '1:1',    group: 'Social · square', wmPct: 0.10 },
  'ig-story':        { label: 'Instagram Story',       w: 1080, h: 1920, ratio: '9:16',   group: 'Social · square', wmPct: 0.10 },
  'ig-reel':         { label: 'Instagram Reel cover',  w: 1080, h: 1920, ratio: '9:16',   group: 'Social · square', wmPct: 0.10 },
  'ig-carousel':     { label: 'Instagram Carousel',    w: 1080, h: 1080, ratio: '1:1',    group: 'Social · square', wmPct: 0.10, multi: true },
  'tiktok':          { label: 'TikTok',                w: 1080, h: 1920, ratio: '9:16',   group: 'Social · square', wmPct: 0.10 },
  'pinterest-pin':   { label: 'Pinterest Pin',         w: 1000, h: 1500, ratio: '2:3',    group: 'Social · square', wmPct: 0.10 },

  // ── SOCIAL · wide / banner ────────────────────────────────
  'li-post':         { label: 'LinkedIn Post',         w: 1200, h: 1200, ratio: '1:1',    group: 'Social · wide',   wmPct: 0.10 },
  'li-ad':           { label: 'LinkedIn Ad',           w: 1200, h: 628,  ratio: '1.91:1', group: 'Social · wide',   wmPct: 0.09 },
  'li-carousel':     { label: 'LinkedIn Carousel',     w: 1080, h: 1080, ratio: '1:1',    group: 'Social · wide',   wmPct: 0.10, multi: true },
  'li-banner':       { label: 'LinkedIn Page Banner',  w: 1584, h: 396,  ratio: '4:1',    group: 'Social · wide',   wmPct: 0.09 },
  'fb-post':         { label: 'Facebook Post',         w: 1200, h: 630,  ratio: '1.91:1', group: 'Social · wide',   wmPct: 0.09 },
  'fb-cover':        { label: 'Facebook Cover',        w: 851,  h: 315,  ratio: '2.7:1',  group: 'Social · wide',   wmPct: 0.09 },
  'x-post':          { label: 'X / Twitter Post',      w: 1200, h: 675,  ratio: '16:9',   group: 'Social · wide',   wmPct: 0.10 },
  'x-header':        { label: 'X / Twitter Header',    w: 1500, h: 500,  ratio: '3:1',    group: 'Social · wide',   wmPct: 0.09 },
  'yt-thumb':        { label: 'YouTube Thumbnail',     w: 1280, h: 720,  ratio: '16:9',   group: 'Social · wide',   wmPct: 0.10 },
  'yt-banner':       { label: 'YouTube Banner',        w: 2560, h: 1440, ratio: '16:9',   group: 'Social · wide',   wmPct: 0.08 },

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
  'business-card':   { label: 'Business Card · 300 dpi', w: 1050, h: 600, ratio: '85×55', group: 'Print · paged',   wmPct: 0.27, printable: true, printDpi: 300 },

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
};

// Default to all 3 layouts; explicit overrides for formats where one doesn't make sense.
const ALL_LAYOUTS = ['image-bottom', 'image-top', 'overlay'];
const FORMAT_LAYOUTS_OVERRIDES = {
  'ig-carousel':   ['image-bottom', 'overlay'],
  'li-ad':         ['image-bottom', 'overlay'],
  'li-banner':     ['image-bottom', 'overlay'],
  'fb-cover':      ['image-bottom', 'overlay'],
  'x-header':      ['image-bottom', 'overlay'],
  'yt-banner':     ['image-bottom', 'overlay'],
  'screensaver':   ['overlay', 'image-bottom'],
  'screensaver-4k':['overlay', 'image-bottom'],
  'email-header':  ['image-bottom', 'overlay'],
  'email-footer':  ['image-bottom', 'overlay'],
  'web-hero':      ['image-bottom', 'overlay'],
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
      case 'M': { const x = nextNum(), y = nextNum(); cx = x; cy = y; startX = x; startY = y; ops.push({ op: 'M', x, y }); break; }
      case 'm': { const dx = nextNum(), dy = nextNum(); cx += dx; cy += dy; startX = cx; startY = cy; ops.push({ op: 'M', x: cx, y: cy }); break; }
      case 'L': { const x = nextNum(), y = nextNum(); cx = x; cy = y; ops.push({ op: 'L', x, y }); break; }
      case 'l': { const dx = nextNum(), dy = nextNum(); cx += dx; cy += dy; ops.push({ op: 'L', x: cx, y: cy }); break; }
      case 'H': { const x = nextNum(); cx = x; ops.push({ op: 'L', x, y: cy }); break; }
      case 'h': { const dx = nextNum(); cx += dx; ops.push({ op: 'L', x: cx, y: cy }); break; }
      case 'V': { const y = nextNum(); cy = y; ops.push({ op: 'L', x: cx, y }); break; }
      case 'v': { const dy = nextNum(); cy += dy; ops.push({ op: 'L', x: cx, y: cy }); break; }
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

// Stroke a parsed-path through jsPDF's low-level path API as filled shapes.
// (x, y, scale) places + scales the source coords into PDF mm.
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

/** An <img> (upload, Canto, generated) → a PNG data URL we can post to the server. */
function imgToDataUrl(img, maxEdge = 1024) {
  if (!img) return null;
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const k = Math.min(1, maxEdge / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  try { return c.toDataURL('image/png'); }
  catch { return null; }   // a cross-origin image taints the canvas — say nothing, offer upload
}

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

  ctx.fillStyle = pal.bg;
  ctx.fillRect(-bleed, -bleed, w + bleed * 2, h + bleed * 2);

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

// ─── LAYOUT 1: Image · Text split ────────────────────────────────────
function drawImageTextSplit(ctx, frame, content, image, opts, textPos) {
  const { w, h, padX, padY } = frame;
  const bleed = frame.bleedPx || 0;
  const { palette, accent, fit } = opts;
  const isWide = w / h > 1.4;

  // Bg fill — extended into bleed area so cut never reveals canvas background
  ctx.fillStyle = palette.bg;
  ctx.fillRect(-bleed, -bleed, w + bleed * 2, h + bleed * 2);

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
  const adjTextY = textRectY + clearance.top;
  // Backdrop ALWAYS draws (image-composition layer) — even in PDF skipOverlays mode
  drawTextBackdropOnly(ctx, content, textRectX, adjTextY, textRectW, palette, accent, frame, 'top', opts.textBackdrop);
  if (!opts.skipOverlays) drawTextBlock(ctx, content, textRectX, adjTextY, textRectW, palette, accent, frame, 'top', null);
  if (!opts.skipOverlays) drawBrandBar(ctx, frame, palette, accent, false, { ...opts, safeArea });
  if (!opts.skipOverlays) drawQrOverlay(ctx, frame, opts.qr, opts.qrImage, palette);
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
  ctx.fillStyle = palette.bg;
  ctx.fillRect(-bleed, -bleed, w + bleed * 2, h + bleed * 2);
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
  const textBottomY = h - padY * 1.7 - clearance.bottom;
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
  drawTextBackdropOnly(ctx, content, padX, textBottomY, w - padX * 2, overlayPalette, accent, frame, 'bottom', opts.textBackdrop);
  if (!opts.skipOverlays) drawTextBlock(ctx, content, padX, textBottomY, w - padX * 2, overlayPalette, accent, frame, 'bottom', null);
  if (!opts.skipOverlays) drawBrandBar(ctx, frame, overlayPalette, accent, true, opts);
  if (!opts.skipOverlays) drawQrOverlay(ctx, frame, opts.qr, opts.qrImage, overlayPalette);
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
  const g = fmt.group || '';
  // A6 postcard & business card are held close — treat them as "card" scale.
  if (formatKey === 'business-card' || formatKey === 'postcard-a6') return 'card';
  if (g.startsWith('Print · poster')) return 'poster';
  if (g.startsWith('Print · paged')) return 'paged';
  if (g.startsWith('Digital')) return 'digital';
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

function layoutTextElements(ctx, content, x, y, w, palette, accent, frame, anchor = 'top') {
  const ts = computeTypeScale(frame);
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
  if (content.eyebrow) blocks.push({ type: 'eyebrow', text: content.eyebrow, size: eyebrowSize });
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
  if (content.cta) blocks.push({ type: 'cta', text: content.cta, size: ctaSize });

  const gaps = { eyebrow: 0.9, headline: 0.55, subline: 0.65, body: 0.85, cta: 1.0 };
  let totalH = 0;
  blocks.forEach((el, i) => {
    if (el.estH) totalH += el.estH;
    else if (el.lines) totalH += el.lines.length * el.size * 1.18;
    else totalH += el.size * 1.2;
    if (i < blocks.length - 1) totalH += el.size * (gaps[el.type] ?? gaps.body);
  });
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
      const upper = el.text.toUpperCase();
      tokens.push({ type: 'tracked', text: upper, x, y: cursorY, family: 'JetBrainsMono', weight: 500, size: el.size, color, letterSpacing: el.size * 0.16 });
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
      const upper = el.text.toUpperCase();
      tokens.push({ type: 'tracked', text: upper, x, y: cursorY, family: 'JetBrainsMono', weight: 500, size: el.size, color, letterSpacing: el.size * 0.08 });
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
  let targetW = (LOGO_SHORT_PCT[cat] != null)
    ? shortSide * (fmt.wmPct ?? LOGO_SHORT_PCT[cat])
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
  let top = 0, bottom = 0;
  // Reserve the mark's height PLUS its clear space. A gap of padY/2 let the
  // headline sit inside the keep-clear zone — the rule is about every side, not
  // only the canvas edges, and type is the thing most likely to crowd it.
  if (wmBox && (wmBox.pos === 'tl' || wmBox.pos === 'tr')) {
    const cb = wmClearBox(wmBox);
    top = Math.max(top, cb.y + cb.h - (opts.safeArea?.y ?? 0));
  }
  if (wmBox && (wmBox.pos === 'bl' || wmBox.pos === 'br')) {
    const cb = wmClearBox(wmBox);
    const saBottom = (opts.safeArea?.y ?? 0) + (opts.safeArea?.h ?? frame.h);
    bottom = Math.max(bottom, saBottom - cb.y);
  }
  if (flBox && (flBox.pos === 'tl' || flBox.pos === 'tr')) top    = Math.max(top,    flBox.h + gap);
  if (flBox && (flBox.pos === 'bl' || flBox.pos === 'br')) bottom = Math.max(bottom, flBox.h + gap);
  return { top, bottom };
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
  drawWordmarkAt(ctx, frame, wm, wmColor, opts.formatKey, wmArea, opts.wordmarkPctOverride);

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

  const initialContent = useMemo(() => {
    const t = TEMPLATES[templateKey];
    const obj = {};
    t.fields.forEach(f => obj[f.key] = f.default);
    return obj;
  }, [templateKey]);

  // Per-slide state (carousel) + single-slide fallback
  const [content, setContent] = useState(initialContent);
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
    const t = TEMPLATES[templateKey];
    setCarouselSlide(0);
    // Carry the user's copy across a template switch. Every template shares the
    // {eyebrow,headline,subline,body,cta} field shape, so once content has been
    // edited/imported we keep each value and only fall back to the new
    // template's default for keys that are still empty. A pristine canvas
    // (nothing edited yet) still loads the template's sample content, so simply
    // browsing templates behaves as before.
    const keep = contentEdited.current;
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
  const COLLAPSE_KEY = 'medartis-bag-collapsed-v3';
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
  // User-curated images (e.g. picked from Canto) persisted to localStorage so
  // they join the standard Medartis library across sessions. Stored compressed
  // as data URLs; loaded into the same libraryImages map so they apply exactly
  // like built-in assets.
  const SAVED_LIB_KEY = 'medartis-saved-library-v1';
  const [savedLibrary, setSavedLibrary] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SAVED_LIB_KEY) || '[]'); }
    catch { return []; }
  });
  useEffect(() => {
    savedLibrary.forEach(asset => {
      if (libraryImages[asset.id]) return;
      const img = new Image();
      img.onload = () => setLibraryImages(prev => ({ ...prev, [asset.id]: img }));
      img.src = asset.src;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedLibrary]);

  const persistSavedLibrary = (next) => {
    setSavedLibrary(next);
    try { localStorage.setItem(SAVED_LIB_KEY, JSON.stringify(next)); }
    catch { alert('Could not save to the library — browser storage is full. Remove a few saved images and try again.'); }
  };

  // Compress + persist an image element into the saved library. Returns true on success.
  const saveImageToLibrary = (img, label = 'Saved image', category = 'saved') => {
    if (!img) return false;
    if (savedLibrary.some(a => a.label === label && a.category === category)) return true; // already saved
    try {
      const src = compressDataUrl(img, 1600, 0.82);
      const id = 'saved-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
      const entry = { id, label: (label || 'Saved image').slice(0, 48), category, src, saved: true };
      setLibraryImages(prev => ({ ...prev, [id]: img }));
      persistSavedLibrary([entry, ...savedLibrary]);
      return true;
    } catch (e) {
      alert('Could not save image: ' + e.message);
      return false;
    }
  };

  const removeFromLibrary = (id) => {
    persistSavedLibrary(savedLibrary.filter(a => a.id !== id));
    setLibraryImages(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const canvasRef = useRef(null);
  const previewWrapRef = useRef(null);
  const [previewSize, setPreviewSize] = useState({ w: 500, h: 500 });
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
  const [brochurePages, setBrochurePages] = useState(defaultBrochurePages);
  const [brochureIdx, setBrochureIdx]     = useState(0);
  const [brochureTitle, setBrochureTitle] = useState('MEDARTIS');
  const [brochureImgs, setBrochureImgs]   = useState({});  // pageId → HTMLImageElement
  const [partnerLogos, setPartnerLogos]   = useState([]);  // [{ id, name, src, img }]

  const baseFormat = FORMATS[formatKey];
  const isBrochure = !!baseFormat.brochure;
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
    () => sectionNumbers(visibleSections({ isBrochure, isCarousel: !!format.multi })),
    [isBrochure, format.multi]
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
  const deleteBrochurePage = (i) => {
    if (brochurePages.length <= 1) return;
    const p = brochurePages[i];
    if (!window.confirm(`Delete page ${i + 1} (${BROCHURE_TYPES[p.type]?.label})?`)) return;
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
    partners: { logos: partnerLogos },
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
      const ratio = format.w / format.h;
      let w = maxW, h = w / ratio;
      if (h > maxH) { h = maxH; w = h * ratio; }
      setPreviewSize({ w: Math.max(80, w), h: Math.max(80, h) });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [format]);

  useEffect(() => {
    if (!FORMAT_LAYOUTS[formatKey].includes(layoutKey)) {
      setLayoutKey(FORMAT_LAYOUTS[formatKey][0]);
    }
  }, [formatKey, layoutKey]);

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
  const deletePage = (i) => {
    const chunks = bodyChunks();
    if (chunks.length <= 1) return;
    const hasWork = (chunks[i] || '').trim().length > 0;
    if (hasWork && !window.confirm(`Delete page ${i + 1}? Its lines, image and crop will be removed.`)) return;
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

    // 1 · Logo minimum size — below this the wordmark stops being legible.
    if (wordmarkPos !== 'hidden') {
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
  }, [formatKey, wordmarkPos, wordmarkPctOverride, palette, accentColor, mutedBoost, accentSafe, layoutKey, activeImage, pdfBleed, wordmarkOverImage, logoLegib]);

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
  }, [format, layoutKey, activeContent, activeImage, activeFit, palette, carouselSlides, carouselSlide, wordmarkPos, folioPos, formatKey, wordmarkOverImage, folioOverImage, wordmarkColor, folioColor, folioText, qrConfig, qrImage, carouselBg, carouselBgImage, carouselQrPer, carouselFolioPer, textBackdrop, wordmarkPctOverride, wmReady, logoPlate, accentColor, isBrochure, brochurePage, brochureImgs, brochureTitle, curBrochure, partnerLogos]);

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
        partners: { logos: partnerLogos },
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

    if (layoutKey === 'overlay') {
      // Overlay: image fills, text bottom-anchored, scrim coal palette
      effectivePalette = { bg: BRAND.coal, ink: BRAND.bone00, muted: BRAND.cream100, mode: 'dark' };
      const textBottomY = frame.h - frame.padY * 1.7;
      textTokens = layoutTextElements(measCtx, slideContent, frame.padX, textBottomY, frame.w - frame.padX * 2, effectivePalette, BRAND.gold, frame, 'bottom');
      safeArea = { x: 0, y: 0, w: frame.w, h: frame.h };
    } else {
      const textPos = layoutKey === 'image-bottom' ? 'top' : 'bottom';
      const geom = computeSplitGeom(frame, opts, textPos);
      const textRectX = geom.isWide ? frame.padX : frame.padX;
      const textW = geom.isWide ? (frame.w * 0.5 - frame.padX * 2) : (frame.w - frame.padX * 2);
      const textAreaY = geom.textAreaY;
      textTokens = layoutTextElements(measCtx, slideContent, textRectX, textAreaY, textW, palette, BRAND.gold, frame);
      safeArea = geom.safeArea;
    }

    return { frame, palette: effectivePalette, opts: { ...opts, safeArea }, textTokens };
  };

  // Push the current canvas (or every slide for a carousel) into a PDF.
  // Page size = trim + bleed (mm) computed from format pixels / printDpi.
  // For non-printable formats we fall back to 72dpi and no bleed/marks.
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
      pdf.addImage(bleedCanvas.toDataURL('image/png'), 'PNG', 0, 0, totalWmm, totalHmm, undefined, 'FAST');
    } else {
      const dataUrl = canvas.toDataURL('image/png');
      pdf.addImage(dataUrl, 'PNG', 0, 0, trimWmm, trimHmm, undefined, 'FAST');
    }

    // Crop marks — drawn outside the trim, inside the bleed margin.
    // Colour adapts: auto picks white-ish for dark bg, near-black for light bg.
    if (formatDef.printable && pdfCropMarks && bleedMm > 0) {
      const cm = resolveCropMarkRgb(palette, pdfCropColor);
      pdf.setDrawColor(cm[0], cm[1], cm[2]);
      pdf.setLineWidth(0.1);
      const off = Math.min(1, bleedMm * 0.3);    // 1mm offset from trim
      const len = Math.min(4, bleedMm * 1.1);    // 4mm long
      const T = bleedMm, B = bleedMm + trimHmm;
      const L = bleedMm, R = bleedMm + trimWmm;
      // TL
      pdf.line(L - len - off, T, L - off, T);
      pdf.line(L, T - len - off, L, T - off);
      // TR
      pdf.line(R + off, T, R + len + off, T);
      pdf.line(R, T - len - off, R, T - off);
      // BL
      pdf.line(L - len - off, B, L - off, B);
      pdf.line(L, B + off, L, B + len + off);
      // BR
      pdf.line(R + off, B, R + len + off, B);
      pdf.line(R, B + off, R, B + len + off);
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
    pdf.addImage(bitmap.toDataURL('image/png'), 'PNG', 0, 0, totalWmm, totalHmm, undefined, 'FAST');

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

    pdfDrawTextTokens(pdf, textTokens, dpi, bleedMm);
    pdfDrawBrandBar(pdf, frame, vecPalette, formatKey, {
      ...vecOpts,
      wordmarkResolvedColor: wmResolvedColor,
      folioResolvedColor:    flResolvedColor,
    }, dpi, bleedMm);

    // Vector QR code via svg2pdf
    if (qrConfig.enabled && qrConfig.url) {
      await pdfDrawQrVector(pdf, frame, vecPalette, qrConfig, qrInk, dpi, bleedMm);
    }

    // Crop marks (adaptive colour)
    if (formatDef.printable && pdfCropMarks && bleedMm > 0) {
      const cm = resolveCropMarkRgb(palette, pdfCropColor);
      pdf.setDrawColor(cm[0], cm[1], cm[2]);
      pdf.setLineWidth(0.1);
      const off = Math.min(1, bleedMm * 0.3);
      const len = Math.min(4, bleedMm * 1.1);
      const T = bleedMm, B = bleedMm + trimHmm, L = bleedMm, R = bleedMm + trimWmm;
      pdf.line(L - len - off, T, L - off, T); pdf.line(L, T - len - off, L, T - off);
      pdf.line(R + off, T, R + len + off, T); pdf.line(R, T - len - off, R, T - off);
      pdf.line(L - len - off, B, L - off, B); pdf.line(L, B + off, L, B + len + off);
      pdf.line(R + off, B, R + len + off, B); pdf.line(R, B + off, R, B + len + off);
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

    const renderSlide = async (slideIdx) => {
      const slideContent = format.multi ? (carouselContent[slideIdx] || initialContent) : content;
      const slideImage   = format.multi ? carouselImages[slideIdx] : image;
      const slideFit     = format.multi ? (carouselFits[slideIdx] || DEFAULT_FIT) : imageFit;

      if (pdfVector && PDF_FONT_CACHE.loaded) {
        await renderVectorPdfPage(pdf, slideContent, slideImage, slideFit, formatDef, bleedMm, slideIdx);
      } else {
        // Legacy raster path
        if (format.multi) {
          setCarouselSlide(slideIdx);
          await new Promise(r => setTimeout(r, 220));
        }
        renderCanvasToPdf(pdf, canvasRef.current, formatDef, bleedMm);
      }
    };

    // A paginated agenda: one PDF page per content page (mirrors the carousel loop),
    // each with its own optional background image.
    const renderPage = async (idx) => {
      const pageContent = pages[idx] || content;
      const pageImage = pageImages[idx] || image;
      const pageFit = pageFits[idx] || DEFAULT_FIT;
      if (pdfVector && PDF_FONT_CACHE.loaded) {
        await renderVectorPdfPage(pdf, pageContent, pageImage, pageFit, formatDef, bleedMm, 0);
      } else {
        setPageIdx(idx);
        await new Promise(r => setTimeout(r, 220));
        renderCanvasToPdf(pdf, canvasRef.current, formatDef, bleedMm);
      }
    };

    if (isBrochure) {
      // One PDF page per brochure page, rendered off-screen at print size so the
      // live preview never flickers and every page keeps its own image + crop.
      const bleedPx = Math.round((bleedMm / 25.4) * dpi);
      for (let i = 0; i < brochurePages.length; i++) {
        if (i > 0) newPdfPage(pdf, totalWmm, totalHmm);
        const pg = brochurePages[i];
        const c = renderOffscreenCanvas(false, pg, brochureImgs[pg.id] || null, pg.fit || DEFAULT_FIT, 1, 0, bleedPx);
        renderCanvasToPdf(pdf, c, formatDef, bleedMm);
      }
    } else if (pages) {
      const restore = pageIdx;
      for (let i = 0; i < pages.length; i++) {
        if (i > 0) newPdfPage(pdf, totalWmm, totalHmm);
        await renderPage(i);
      }
      setPageIdx(restore);
    } else if (format.multi) {
      for (let i = 0; i < carouselSlides; i++) {
        if (i > 0) newPdfPage(pdf, totalWmm, totalHmm);
        await renderSlide(i);
      }
    } else {
      await renderSlide(0);
    }

    const tags = [];
    if (bleedMm > 0) tags.push('print');
    if (pdfCropMarks && bleedMm > 0) tags.push('marks');
    if (pdfVector && PDF_FONT_CACHE.loaded) tags.push('vector');
    const suffix = tags.length ? '_' + tags.join('-') : '';
    pdf.save(`medartis-${formatKey}${suffix}-${Date.now()}.pdf`);
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
          {Object.entries(
            Object.entries(FORMATS).reduce((acc, [key, fmt]) => {
              const g = fmt.group || 'Other';
              (acc[g] = acc[g] || []).push([key, fmt]);
              return acc;
            }, {})
          ).map(([group, entries]) => {
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
                  <SidebarBtn key={k} active={formatKey === k} onClick={() => setFormatKey(k)}>
                    <span>{fmt.label}</span>
                    <span style={{ fontSize: 10, opacity: 0.55, fontFamily: BRAND.mono, letterSpacing: '0.04em' }}>{fmt.ratio}</span>
                  </SidebarBtn>
                ))}
              </div>
            );
          })}
        </Section>

        {!isBrochure && (
        <Section label={SEC('LAYOUT', 'LAYOUT')} {...sp('LAYOUT')}>
          {FORMAT_LAYOUTS[formatKey].map((lk) => (
            <SidebarBtn key={lk} active={layoutKey === lk} onClick={() => setLayoutKey(lk)}>
              {LAYOUTS[lk].label}
            </SidebarBtn>
          ))}
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
              Wrong type? Pick the right one — your content is kept.
            </div>
          )}
          {(() => {
            const entries = Object.entries(TEMPLATES);
            const single = entries.filter(([, t]) => !t.carouselContent);
            const multi  = entries.filter(([,  t]) => !!t.carouselContent);
            const renderBtn = ([key, t]) => (
              <SidebarBtn key={key} active={templateKey === key} onClick={() => setTemplateKey(key)} column>
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
        <canvas
          ref={canvasRef}
          onMouseDown={(e) => {
            if (!activeImage) return;
            e.preventDefault();
            const startX = e.clientX, startY = e.clientY;
            const startOX = activeFit.offsetX, startOY = activeFit.offsetY;
            const move = (ev) => {
              const dx = (ev.clientX - startX) / previewSize.w * 100;
              const dy = (ev.clientY - startY) / previewSize.h * 100;
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
            width: previewSize.w, height: previewSize.h,
            boxShadow: '0 32px 80px rgba(0,0,0,0.55)', background: BRAND.paper,
            cursor: activeImage ? 'grab' : 'default',
            touchAction: 'none'
          }} />

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
              </>
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
  'SURFACE', 'BRANDBAR', 'TEXTBG', 'QR', 'CAROUSEL', 'CAROUSEL_BG', 'CONTENT',
  // 4 · Imagery
  'IMAGE', 'GENERATE', 'CANTO', 'IMAGEFIT',
  // 5 · Output
  'CHECK', 'EXPORT', 'PRESETS',
];

/** Which sections exist for the current canvas? The numbering follows from this. */
function visibleSections({ isBrochure, isCarousel }) {
  return SECTION_ORDER.filter((k) => {
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

const Section = ({ label, children, collapsed, onToggle }) => {
  const isCollapsible = typeof onToggle === 'function';
  return (
    <div style={{ marginBottom: 24 }}>
      <button
        onClick={isCollapsible ? onToggle : undefined}
        disabled={!isCollapsible}
        style={{
          display: 'flex', width: '100%', alignItems: 'center', gap: 8,
          fontSize: 10, letterSpacing: '0.16em', fontWeight: 500,
          color: BRAND.ink, marginBottom: collapsed ? 0 : 12, fontFamily: BRAND.mono,
          textTransform: 'uppercase', background: 'transparent', border: 'none',
          padding: 0, cursor: isCollapsible ? 'pointer' : 'default', textAlign: 'left'
        }}
      >
        {isCollapsible && (
          <span style={{
            display: 'inline-block', width: 8,
            transition: 'transform 0.12s',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)'
          }}>▾</span>
        )}
        <span style={{ flex: 1 }}>{label}</span>
      </button>
      {!collapsed && children}
    </div>
  );
};

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
// ── Generative AI (local ComfyUI) ────────────────────────────────────
// The user never reaches the model directly: the server compiles the house look,
// the realism block and the negative around the subject. See vite-plugin-genai.js.
//
// The negative-prompt honesty problem, surfaced in the UI:
// FLUX.1 [dev] is guidance-distilled — its graph runs a BasicGuider, which has no
// negative input at all, so a negative prompt is IGNORED, not merely weakened.
// "Strict negatives" swaps in a CFGGuider to give the sampler a real negative
// branch (~2× slower). SDXL / Turbo always honour it. We report what actually
// happened rather than implying the negative did something it didn't.
const GenerateSection = ({
  sectionProps = {}, format, surface, onPickImage, onSaveToLibrary,
  makeControlMap, library = [], currentImage = null, secNo = {},
}) => {
  const [status, setStatus] = useState(null);
  // ── CONDITIONING ────────────────────────────────────────────────
  // refImage  : "look like THIS"    (IP-Adapter → the MODEL branch)
  // ctrlImage : "compose like THIS" (ControlNet → the CONDITIONING branch)
  const [refImage, setRefImage] = useState(null);
  const [refStrength, setRefStrength] = useState(0.65);
  const [ctrlImage, setCtrlImage] = useState(null);
  const [ctrlSource, setCtrlSource] = useState('layout');   // 'layout' | 'photo'
  const [ctrlType, setCtrlType] = useState('depth');
  const [ctrlStrength, setCtrlStrength] = useState(0.55);
  const [prompt, setPrompt] = useState('');
  const [extraNegative, setExtraNegative] = useState('');
  const [realism, setRealism] = useState(true);
  const [strictNegative, setStrictNegative] = useState(false);
  const [engine, setEngine] = useState('flux');
  const [ckpt, setCkpt] = useState('');   // '' = let the server pick
  const [fast, setFast] = useState(false);  // Lightning / LCM LoRA on top of the checkpoint
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const [blockedTerm, setBlockedTerm] = useState(null);
  const [results, setResults] = useState([]);
  const [lastMeta, setLastMeta] = useState(null);

  // Prefer an engine whose output can actually be published.
  useEffect(() => {
    if (status?.engines?.includes('sdxl')) setEngine((e) => (e === 'flux' ? 'sdxl' : e));
  }, [status?.engines?.join(',')]);

  // The checkpoint is the single biggest lever on realism — bigger than any
  // prompt wording. If a photoreal fine-tune is installed, start there rather
  // than on stock SDXL base, which is what the prompt would otherwise be fighting.
  useEffect(() => {
    const list = status?.sdxlCkpts || [];
    if (!list.length) return;
    setCkpt((c) => (c && list.includes(c) ? c : (status?.photorealCkpts?.[0] || '')));
  }, [status?.sdxlCkpts?.join(','), status?.photorealCkpts?.join(',')]);

  // Wall-clock ticker — a bar with no numbers is indistinguishable from a hang.
  useEffect(() => {
    if (!busy) { setElapsed(0); return; }
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 250);
    return () => clearInterval(id);
  }, [busy]);

  const probe = useCallback(() => fetch('/api/gen/status')
    .then((r) => r.json())
    .then(setStatus)
    .catch(() => setStatus({ providers: [], comfyError: 'Generative plugin not reachable.' })), []);
  useEffect(() => { probe(); }, [probe]);

  // ComfyUI may be booted after the app — keep looking instead of latching "absent".
  const local = status?.providers?.includes('local');
  useEffect(() => {
    if (local) return;
    const id = setInterval(probe, 5000);
    return () => clearInterval(id);
  }, [local, probe]);

  const poll = async (id) => {
    for (;;) {
      await new Promise((r) => setTimeout(r, 700));
      const j = await fetch(`/api/gen/job/${id}`).then((r) => r.json()).catch(() => null);
      if (!j) continue;
      setJob(j);
      if (j.status === 'done') return j;
      if (j.status === 'error') throw new Error(j.error || 'Generation failed.');
    }
  };

  const generate = async () => {
    setBusy(true); setError(null); setBlockedTerm(null); setJob({ status: 'queued', progress: 0 });
    try {
      const r = await fetch('/api/gen/image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt, surface, engine, realism, strictNegative, extraNegative,
          ckpt: engine === 'sdxl' ? (ckpt || undefined) : undefined,
          fast: engine === 'sdxl' ? fast : false,
          w: format.w, h: format.h,
          // Conditioning. The server reports back what it could actually honour.
          refImage: canCondition && refImage ? refImage : null,
          refStrength,
          controlImage: canCondition && ctrlImage ? ctrlImage : null,
          controlType: ctrlType,
          controlStrength: ctrlStrength,
          // Hold the composition through the early steps, then LET GO. A control
          // that runs to the end of the denoise doesn't just place the subject —
          // it keeps overruling the detail pass, and the image comes out flat.
          controlEndAt: ctrlSource === 'layout' ? 0.55 : 0.85,
          // A map WE synthesized from the layout is already a control map —
          // running a depth estimator over it would estimate the depth of a
          // diagram. Only a photographic source gets preprocessed.
          controlPreprocess: ctrlSource === 'photo',
        }),
      });
      const sub = await r.json();
      if (!r.ok) {
        // The server names the exact term that tripped the gate. Throwing it away
        // turns a precise refusal into a riddle — the user then has to guess which
        // of twelve innocent-looking words was the problem.
        if (sub.term) setBlockedTerm(sub.term);
        throw new Error(sub.error || 'Request rejected.');
      }
      setJobId(sub.jobId);
      const done = await poll(sub.jobId);
      setLastMeta(done);
      setResults((done.images || []).concat(results).slice(0, 8));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false); setJob(null); setJobId(null);
    }
  };

  const cancel = () => { if (jobId) fetch(`/api/gen/cancel/${jobId}`, { method: 'POST' }).catch(() => {}); };

  // Will the negative actually reach the sampler with the current choices?
  const negWorks = engine !== 'flux' || strictNegative;

  // Conditioning is SDXL-only: Flux ControlNet/IP-Adapter weights are tied to a
  // specific checkpoint, so offering them on Flux would only move the failure
  // into ComfyUI's validator. Say that plainly rather than let the control lie.
  const isSdxl = engine === 'sdxl' || engine === 'sdxl-turbo';
  const canIp      = isSdxl && !!status?.conditioning?.ip;
  const canControl = isSdxl && !!status?.conditioning?.control;
  const canCondition = canIp || canControl;
  const controlTypes = status?.conditioning?.controlTypes || [];
  // A LAYOUT MAP IS A DEPTH STATEMENT, NOT AN EDGE STATEMENT.
  // This is the correction to my own first design. A canny/scribble net expects
  // DENSE edge structure and reproduces what it is given; a map derived from a
  // bare layout has almost no edges in it, so the net reads "no structure
  // anywhere" and returns a flat, empty, distant scene — and any rectangle drawn
  // into the map comes back as a literal rectangle in the picture.
  //
  // What the layout actually knows is: "this region must stay EMPTY and FAR,
  // because type is going on top of it, and the picture belongs over HERE."
  // That is depth. So from-the-layout offers depth only. Edges come from a photo
  // (or, later, from a hand sketch), where there is real structure to trace.
  const layoutKinds = ['depth'].filter((k) => controlTypes.includes(k));
  useEffect(() => {
    if (ctrlSource === 'layout' && layoutKinds.length && !layoutKinds.includes(ctrlType)) {
      setCtrlType(layoutKinds[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctrlSource, layoutKinds.join(',')]);

  useEffect(() => {
    if (controlTypes.length && !controlTypes.includes(ctrlType)) setCtrlType(controlTypes[0]);
  }, [controlTypes.join(','), ctrlType]);

  const refreshLayoutMap = () => {
    const map = makeControlMap?.(ctrlType);
    if (!map) {
      setError('The layout leaves no room to compose in — free up some space, then rebuild the map.');
      return;
    }
    setError(null);
    setCtrlImage(map);
  };
  // Keep the map in step with the type; a depth map fed to a canny net is noise.
  useEffect(() => {
    if (ctrlSource === 'layout' && ctrlImage) refreshLayoutMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctrlType]);

  const readFileAsDataUrl = async (file, set) => {
    try { set(await fileToImageDataUrl(file)); } catch (e) { setError(e.message); }
  };

  const btn = (on) => ({
    padding: '6px 4px', cursor: 'pointer', borderRadius: 0,
    background: on ? BRAND.ink : BRAND.paper, color: on ? BRAND.bone00 : BRAND.ink600,
    border: `1px solid ${on ? BRAND.ink : BRAND.ink100}`,
    fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase',
  });

  return (
    <Section {...sectionProps}>
      <div style={{
        padding: '9px 10px', marginBottom: 10, background: BRAND.bone,
        borderLeft: `3px solid ${BRAND.gold}`,
        fontFamily: BRAND.mono, fontSize: 9, color: BRAND.ink600,
        letterSpacing: '0.04em', lineHeight: 1.6,
      }}>
        FLUX.1 [DEV] · NON-COMMERCIAL — CONCEPTING AND INTERNAL USE ONLY.<br />
        ENVIRONMENT · PRODUCT · TEXTURE · ATMOSPHERE. CLINICAL IMAGERY STAYS REAL PHOTOGRAPHY.
      </div>

      {!status && <div style={{ fontFamily: BRAND.mono, fontSize: 10, color: BRAND.ink300 }}>CHECKING BACKENDS…</div>}

      {status && !local && (
        <div style={{ fontFamily: BRAND.mono, fontSize: 10, color: BRAND.ink600, lineHeight: 1.6 }}>
          {status.comfyError || 'NO LOCAL COMFYUI.'}
          <div style={{ color: BRAND.ink300, marginTop: 6 }}>
            START COMFYUI (DEFAULT http://127.0.0.1:8188) — THIS PANEL WILL PICK IT UP AUTOMATICALLY.
          </div>
        </div>
      )}

      {local && (
        <>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Subject only — e.g. “instrument tray on a brushed-steel bench, morning light”. The house look, realism and negative are added for you."
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
          />

          {/* Engine */}
          <div style={{ fontSize: 9.5, color: BRAND.ink600, marginBottom: 5, fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Engine</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, marginBottom: 10 }}>
            {[
              ['flux', 'Flux', 'Best look · guidance-distilled: IGNORES the negative unless Strict is on · non-commercial'],
              ['sdxl', 'SDXL', 'Licensable output · always honours the negative'],
              ['sdxl-turbo', 'Turbo', '4 steps, seconds · always honours the negative · lower fidelity'],
            ].filter(([k]) => !status.engines || status.engines.includes(k) || k === 'flux')
              .map(([k, label, hint]) => (
                <button key={k} onClick={() => setEngine(k)} title={hint} style={btn(engine === k)}>{label}</button>
              ))}
          </div>

          {/* CHECKPOINT — the biggest lever on realism there is, bigger than any
              wording of the prompt. Stock SDXL base is a general-purpose model;
              a photoreal fine-tune (Juggernaut XL, RealVisXL) is the same
              architecture — same LoRA, same ControlNet, same IP-Adapter — trained
              specifically on photography. Hard-wiring 'sd_xl_base' and quietly
              ignoring a better checkpoint sitting in the same folder was a way of
              losing the single easiest win in the panel. */}
          {engine === 'sdxl' && (status.sdxlCkpts || []).length > 0 && (
            <>
              <div style={{ fontSize: 9.5, color: BRAND.ink600, marginBottom: 5, fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Checkpoint
                <span style={{ color: BRAND.ink300, letterSpacing: 0, textTransform: 'none' }}> · the largest single lever on realism</span>
              </div>
              <select value={ckpt} onChange={(e) => setCkpt(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', marginBottom: 4, padding: '8px 9px',
                  border: `1px solid ${BRAND.ink100}`, background: BRAND.paper, color: BRAND.ink,
                  fontFamily: BRAND.mono, fontSize: 10, borderRadius: 0,
                }}>
                <option value="">Auto · SDXL base 1.0</option>
                {(status.sdxlCkpts || []).map((f) => (
                  <option key={f} value={f}>
                    {(status.photorealCkpts || []).includes(f) ? '★ ' : ''}{f.replace(/\.safetensors$/i, '')}
                  </option>
                ))}
              </select>
              <div style={{ fontFamily: BRAND.mono, fontSize: 8.5, color: BRAND.ink300, lineHeight: 1.5, letterSpacing: '0.03em', marginBottom: 6 }}>
                {(status.photorealCkpts || []).includes(ckpt)
                  ? '★ PHOTOREAL FINE-TUNE. CHECK ITS LICENCE BEFORE COMMERCIAL USE — SDXL BASE IS OPENRAIL++, A CIVITAI FINE-TUNE CARRIES ITS OWN TERMS.'
                  : 'STOCK SDXL BASE IS A GENERAL-PURPOSE MODEL. A PHOTOREAL FINE-TUNE WILL BEAT ANY PROMPT WORDING YOU CAN WRITE.'}
              </div>
              {/* Say what was left out and WHY. A checkpoint that silently vanished
                  from the list is indistinguishable from a bug — and the reason is
                  the useful part: the architecture was read from the file, not
                  guessed from the name. */}
              {(status.excludedCkpts || []).length > 0 && (
                <details style={{ marginBottom: 10 }}>
                  <summary style={{ cursor: 'pointer', fontFamily: BRAND.mono, fontSize: 8.5, color: BRAND.ink300, letterSpacing: '0.06em' }}>
                    {status.excludedCkpts.length} CHECKPOINT{status.excludedCkpts.length === 1 ? '' : 'S'} NOT LISTED — WHY?
                  </summary>
                  <div style={{ marginTop: 5, padding: '7px 8px', background: BRAND.paper, border: `1px solid ${BRAND.ink100}` }}>
                    {status.excludedCkpts.map((x) => (
                      <div key={x.file} style={{ fontFamily: BRAND.mono, fontSize: 8.5, color: BRAND.ink600, lineHeight: 1.6 }}>
                        {String(x.file).replace(/\.safetensors$/i, '')}
                        <span style={{ color: BRAND.ink300 }}> — {x.why}</span>
                      </div>
                    ))}
                    <div style={{ fontFamily: BRAND.display, fontSize: 10, color: BRAND.ink300, marginTop: 6, lineHeight: 1.5 }}>
                      Architecture is read from each file’s safetensors header, not guessed from its
                      name. An SD 1.5 model in this SDXL pipeline does not error — it returns a
                      melted, rainbow-coloured image.
                    </div>
                  </div>
                </details>
              )}
            </>
          )}

          {/* FAST — Lightning/LCM as a LoRA on top of the checkpoint.
              NOT a "fewer steps" switch: these are distilled to run at CFG ~1, and
              4 steps at CFG 6 is the burnt, oversaturated mess people blame on the
              LoRA. The whole recipe (steps + cfg + sampler + scheduler) moves
              together on the server, or not at all. */}
          {engine === 'sdxl' && (status.fastLoras || []).length > 0 && (
            <button onClick={() => setFast((v) => !v)} style={{ ...btn(fast), width: '100%', marginBottom: 6 }}
              title={`Few-step generation via ${status.fastLoras[0]} — keeps the checkpoint (and its text encoder), just gets there faster`}>
              ⚡ Fast · {String(status.fastLoras[0]).replace(/\.safetensors$/i, '')}
            </button>
          )}

          {/* Realism + strict negatives */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginBottom: 6 }}>
            <button onClick={() => setRealism((v) => !v)} style={btn(realism)}
              title="Append the photoreal block: full-frame optics, physically accurate light, real skin texture, sensor grain. This is what actually drives realism on Flux.">
              ✦ Realism
            </button>
            <button onClick={() => setStrictNegative((v) => !v)} style={btn(strictNegative)}
              title="Give Flux a REAL negative branch (CFGGuider, cfg>1). Roughly 2× slower. SDXL/Turbo honour the negative regardless.">
              ⛔ Strict negatives
            </button>
          </div>

          {/* The honesty line — never imply the negative did something it didn't. */}
          <div style={{
            fontSize: 9, fontFamily: BRAND.mono, lineHeight: 1.55, marginBottom: 8,
            letterSpacing: '0.04em',
            color: negWorks ? '#0A7D3E' : '#C8200A',
          }}>
            {negWorks
              ? '✓ THE NEGATIVE PROMPT REACHES THE SAMPLER WITH THESE SETTINGS.'
              : '⚠ FLUX AT CFG 1 IGNORES THE NEGATIVE ENTIRELY. TURN ON STRICT NEGATIVES (SLOWER), OR SWITCH TO SDXL — OTHERWISE REALISM COMES ONLY FROM THE POSITIVE BLOCK.'}
          </div>

          <div style={{ fontSize: 9.5, color: BRAND.ink600, marginBottom: 5, fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Extra negative <span style={{ color: BRAND.ink300, letterSpacing: 0, textTransform: 'none' }}>· appended to the house negative</span>
          </div>
          <input
            value={extraNegative}
            onChange={(e) => setExtraNegative(e.target.value)}
            placeholder="e.g. reflections, fingerprints, blue tint"
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: 10 }}
          />

          {/* ── CONDITIONING ──────────────────────────────────────────
              Text can describe a look. It cannot hold one, and it certainly
              cannot hold a LAYOUT. These two do. */}
          <div style={{
            border: `1px solid ${BRAND.ink100}`, background: BRAND.bone,
            padding: '10px 10px 12px', marginBottom: 10,
          }}>
            <div style={{
              fontFamily: BRAND.mono, fontSize: 9.5, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: BRAND.ink, marginBottom: 8,
            }}>◈ Conditioning</div>

            {!isSdxl && (
              <>
                <div style={{ fontFamily: BRAND.mono, fontSize: 9, color: '#C8200A', lineHeight: 1.55, letterSpacing: '0.04em', marginBottom: 7 }}>
                  ⚠ CONDITIONING IS SDXL-ONLY — FLUX CONTROLNET / IP-ADAPTER WEIGHTS ARE
                  CHECKPOINT-SPECIFIC, SO OFFERING THEM HERE WOULD ONLY FAIL INSIDE COMFYUI.
                </div>
                {/* A warning that tells you what to do but makes you do it elsewhere is
                    half a warning. Fix it from where it is raised. */}
                <button
                  style={{ ...btn(false), width: '100%', padding: '8px' }}
                  disabled={!status?.engines?.includes('sdxl')}
                  onClick={() => setEngine('sdxl')}>
                  {status?.engines?.includes('sdxl')
                    ? '→ Switch the engine to SDXL'
                    : 'SDXL base is not installed — npm run models'}
                </button>
              </>
            )}

            {isSdxl && (
              <>
                {/* 1 · REFERENCE LOOK — IP-Adapter */}
                <div style={{ fontSize: 9.5, color: BRAND.ink600, marginBottom: 5, fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  1 · Reference look
                  <span style={{ color: BRAND.ink300, letterSpacing: 0, textTransform: 'none' }}> · IP-Adapter · steers colour, light, material</span>
                </div>
                {!canIp ? (
                  <div style={{
                    fontFamily: BRAND.mono, fontSize: 9, color: BRAND.ink600, lineHeight: 1.6,
                    marginBottom: 10, letterSpacing: '0.04em',
                    padding: '7px 8px', background: BRAND.paper, border: `1px solid ${BRAND.ink100}`,
                  }}>
                    UNAVAILABLE · MISSING {String(status?.conditioning?.ipMissing || 'IP-ADAPTER').toUpperCase()}
                    <div style={{ color: BRAND.ink300, marginTop: 4, textTransform: 'none', letterSpacing: 0, fontSize: 9 }}>
                      Install once: <code>bash ai/tools/setup_conditioning.sh /path/to/ComfyUI</code> — then restart
                      ComfyUI. It clones ComfyUI_IPAdapter_plus and fetches the SDXL IP-Adapter + CLIP-Vision weights.
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{
                        width: 56, height: 56, flexShrink: 0, border: `1px solid ${BRAND.ink100}`,
                        background: BRAND.paper, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: BRAND.mono, fontSize: 8, color: BRAND.ink300,
                      }}>
                        {refImage
                          ? <img src={refImage} alt="reference" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : 'NONE'}
                      </div>
                      <div style={{ display: 'grid', gap: 4, flex: 1 }}>
                        <button style={btn(false)} disabled={!currentImage}
                          onClick={() => { const d = imgToDataUrl(currentImage); d ? setRefImage(d) : setError('That image is cross-origin and cannot be read back — upload it instead.'); }}>
                          Use the image on the canvas
                        </button>
                        <label style={{ ...btn(false), textAlign: 'center' }}>
                          Upload / pick from the library
                          <input type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) readFileAsDataUrl(f, setRefImage); e.target.value = ''; }} />
                        </label>
                        {refImage && <button style={btn(false)} onClick={() => setRefImage(null)}>Clear reference</button>}
                      </div>
                    </div>
                    {library.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 6, paddingBottom: 2 }}>
                        {library.slice(0, 12).map((it, i) => (
                          <img key={i} src={it.src || it} alt="" onClick={() => setRefImage(it.src || it)}
                            title="Condition on this library image"
                            style={{
                              width: 40, height: 40, objectFit: 'cover', cursor: 'pointer', flexShrink: 0,
                              border: `1px solid ${refImage === (it.src || it) ? BRAND.goldDeep : BRAND.ink100}`,
                            }} />
                        ))}
                      </div>
                    )}
                    {refImage && (
                      <label style={{ display: 'block', fontFamily: BRAND.mono, fontSize: 9, color: BRAND.ink600, marginBottom: 10, letterSpacing: '0.04em' }}>
                        STRENGTH {refStrength.toFixed(2)}
                        <input type="range" min="0" max="1.2" step="0.05" value={refStrength}
                          onChange={(e) => setRefStrength(Number(e.target.value))}
                          style={{ width: '100%' }} />
                      </label>
                    )}
                  </>
                )}

                {/* 2 · COMPOSITION — ControlNet, fed by the layout itself */}
                <div style={{ fontSize: 9.5, color: BRAND.ink600, marginBottom: 5, fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  2 · Composition
                  <span style={{ color: BRAND.ink300, letterSpacing: 0, textTransform: 'none' }}> · ControlNet · the layout becomes the input</span>
                </div>
                {!canControl ? (
                  <div style={{
                    fontFamily: BRAND.mono, fontSize: 9, color: BRAND.ink600, lineHeight: 1.6,
                    letterSpacing: '0.04em',
                    padding: '7px 8px', background: BRAND.paper, border: `1px solid ${BRAND.ink100}`,
                  }}>
                    UNAVAILABLE · MISSING {String(status?.conditioning?.controlMissing || 'CONTROLNET MODELS').toUpperCase()}
                    <div style={{ color: BRAND.ink300, marginTop: 4, textTransform: 'none', letterSpacing: 0, fontSize: 9 }}>
                      Install once: <code>bash ai/tools/setup_conditioning.sh /path/to/ComfyUI</code> — then restart
                      ComfyUI. It fetches the SDXL depth / canny ControlNets into models/controlnet.
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
                      <button style={btn(ctrlSource === 'layout')} onClick={() => { setCtrlSource('layout'); setCtrlImage(null); }}>
                        From the layout
                      </button>
                      <button style={btn(ctrlSource === 'photo')} onClick={() => { setCtrlSource('photo'); setCtrlImage(null); }}>
                        From a photo
                      </button>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${Math.max(1, (ctrlSource === 'layout' ? layoutKinds : controlTypes).length)}, 1fr)`,
                      gap: 4, marginBottom: 6,
                    }}>
                      {(ctrlSource === 'layout' ? layoutKinds : controlTypes).map((k) => (
                        <button key={k} style={btn(ctrlType === k)} onClick={() => setCtrlType(k)}>{k}</button>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gap: 4, marginBottom: 6 }}>
                      {ctrlSource === 'layout' ? (
                        <button style={btn(false)} onClick={refreshLayoutMap}>
                          {ctrlImage ? '↻ Rebuild from the current layout' : '⌗ Build a map from the current layout'}
                        </button>
                      ) : (
                        <label style={{ ...btn(false), textAlign: 'center' }}>
                          Upload a reference photo
                          <input type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) readFileAsDataUrl(f, setCtrlImage); e.target.value = ''; }} />
                        </label>
                      )}
                    </div>
                    {/* Full width, at the canvas's aspect. A 56px chip of a mostly-dark
                        depth map is indistinguishable from a bug — you have to be able
                        to SEE what you are sending the model. */}
                    {ctrlImage && (
                      <>
                        <img src={ctrlImage} alt="control map"
                          title="This is what the model is given. Click to open it full size."
                          onClick={() => { const w = window.open(); if (w) w.document.write(`<img src="${ctrlImage}" style="width:100%">`); }}
                          style={{
                            width: '100%', display: 'block', cursor: 'zoom-in',
                            border: `1px solid ${BRAND.ink100}`, background: '#000', marginBottom: 4,
                            aspectRatio: `${format.w} / ${format.h}`, objectFit: 'contain',
                          }} />
                        <button style={{ ...btn(false), width: '100%', marginBottom: 6 }}
                          onClick={() => setCtrlImage(null)}>Clear map</button>
                      </>
                    )}

                    {ctrlImage && (
                      <label style={{ display: 'block', fontFamily: BRAND.mono, fontSize: 9, color: BRAND.ink600, marginBottom: 6, letterSpacing: '0.04em' }}>
                        STRENGTH {ctrlStrength.toFixed(2)}
                        <input type="range" min="0" max="1.5" step="0.05" value={ctrlStrength}
                          onChange={(e) => setCtrlStrength(Number(e.target.value))}
                          style={{ width: '100%' }} />
                      </label>
                    )}

                    <div style={{ fontFamily: BRAND.mono, fontSize: 8.5, color: BRAND.ink300, lineHeight: 1.55, letterSpacing: '0.03em' }}>
                      {ctrlSource === 'layout'
                        ? 'DEPTH ONLY — WHITE IS NEAR, DARK IS FAR. THE MAP IS DERIVED FROM WHERE THE TYPE AND THE MARK ACTUALLY SIT: THE PICTURE GOES IN THE LIGHT AREA, THE HEADLINE GETS RECESSIVE BACKGROUND. IT NEVER SEES A LETTERFORM. AN EDGE MAP (CANNY/SCRIBBLE) NEEDS SOMETHING WITH REAL EDGES — USE “FROM A PHOTO”.'
                        : 'THE PHOTO IS RUN THROUGH A PREPROCESSOR ON THE SERVER, THEN USED AS THE CONTROL MAP.'}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <button onClick={busy ? cancel : generate} disabled={!busy && !prompt.trim()}
            style={{
              width: '100%', padding: '12px', cursor: (busy || prompt.trim()) ? 'pointer' : 'not-allowed',
              background: busy ? BRAND.paper : BRAND.ink, color: busy ? BRAND.ink : BRAND.bone00,
              border: `1px solid ${BRAND.ink}`, borderRadius: 0,
              fontFamily: BRAND.mono, fontSize: 11, fontWeight: 500,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              opacity: (!busy && !prompt.trim()) ? 0.4 : 1,
            }}>
            {busy ? `✕ Cancel · ${elapsed}s` : '✦ Generate'}
          </button>

          {/* Real steps from ComfyUI's socket — not a fake bar */}
          {busy && job && (
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 4, background: BRAND.ink100, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${Math.round((job.progress || 0) * 100)}%`,
                  background: BRAND.gold, transition: 'width 0.2s',
                }} />
              </div>
              <div style={{ fontSize: 9, fontFamily: BRAND.mono, color: BRAND.ink600, marginTop: 4, letterSpacing: '0.06em' }}>
                {job.steps ? `STEP ${job.step ?? 0} / ${job.steps}` : (job.status || 'QUEUED').toUpperCase()}
                {job.node ? ` · ${String(job.node).toUpperCase()}` : ''}
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 8, fontSize: 10.5, color: '#C8200A', fontFamily: BRAND.mono, lineHeight: 1.5 }}>
              ERROR · {error}
              {/* A refusal that won't say WHICH word it objected to is a riddle.
                  The server knows; show it, and say what to write instead. */}
              {blockedTerm && (
                <div style={{
                  marginTop: 7, padding: '8px 9px', background: BRAND.paper,
                  border: `1px solid ${BRAND.ink100}`, color: BRAND.ink600, fontSize: 9.5, lineHeight: 1.6,
                }}>
                  <div style={{ color: BRAND.ink, letterSpacing: '0.06em' }}>
                    TRIGGERED BY: “{String(blockedTerm).toUpperCase()}”
                  </div>
                  <div style={{ marginTop: 5, fontFamily: BRAND.display, fontSize: 11, color: BRAND.ink600, letterSpacing: 0 }}>
                    This is the Medartis safety gate, not the model. A generated human
                    presented as a surgeon is a regulatory and credibility problem for a
                    medical-device manufacturer — so people-as-clinicians stay real
                    photography (Canto, § {secNo.CANTO}).
                    <div style={{ marginTop: 6 }}>
                      Generate the <b>place</b>, not the person: “an empty, immaculate
                      operating theatre, cool daylight, instruments laid out on a tray”.
                    </div>
                    <div style={{ marginTop: 6, color: BRAND.ink300, fontSize: 10 }}>
                      The rule lives in <code>ai/prompt/house_style.json</code> → <code>blocklist</code>.
                      Changing it is a brand-owner decision, not a prompt-engineering one.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* What the run ACTUALLY did */}
          {lastMeta && !busy && (
            <div style={{ marginTop: 8, fontSize: 9, fontFamily: BRAND.mono, color: BRAND.ink600, letterSpacing: '0.04em', lineHeight: 1.55 }}>
              {String(lastMeta.engine || '').toUpperCase()}
              {lastMeta.ckpt ? ` · ${String(lastMeta.ckpt).replace(/\.safetensors$/i, '')}` : ''}
              {lastMeta.fast ? ` · ⚡ ${String(lastMeta.fast).replace(/\.safetensors$/i, '')}` : ''}
              {lastMeta.lora ? ` · LORA ${lastMeta.lora}` : ' · NO HOUSE LORA'}
              {' · NEGATIVE '}
              <span style={{ color: lastMeta.negativeHonoured ? '#0A7D3E' : '#C8200A' }}>
                {lastMeta.negativeHonoured ? 'APPLIED' : 'IGNORED BY THIS ENGINE'}
              </span>
              {lastMeta.realism ? ' · REALISM ON' : ''}
              {/* Conditioning, reported by the SERVER — never by the checkbox. One
                  line per input, present or absent. Buried in a wrapping sentence
                  you cannot tell "the reference was ignored" from "the text ran off
                  the edge", and those are very different facts. */}
              {lastMeta.conditioning && (
                <div style={{ marginTop: 5, borderTop: `1px solid ${BRAND.ink100}`, paddingTop: 5 }}>
                  <div style={{ color: lastMeta.conditioning.ip ? '#0A7D3E' : BRAND.ink300 }}>
                    {lastMeta.conditioning.ip ? '✓' : '·'} REFERENCE (IP-ADAPTER) {lastMeta.conditioning.ip ? 'APPLIED' : 'NOT USED'}
                  </div>
                  <div style={{ color: lastMeta.conditioning.control ? '#0A7D3E' : BRAND.ink300 }}>
                    {lastMeta.conditioning.control ? '✓' : '·'} COMPOSITION (CONTROLNET){' '}
                    {lastMeta.conditioning.control
                      ? `${String(lastMeta.conditioning.controlType || '').toUpperCase()} · ${lastMeta.conditioning.controlModel || ''}`
                      : 'NOT USED'}
                  </div>
                  {(lastMeta.conditioning.notes || []).map((n, i) => (
                    <div key={i} style={{ color: '#C8200A' }}>⚠ {n.toUpperCase()}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {results.length > 0 && (
            <>
              <div style={{ fontSize: 9, color: BRAND.ink300, margin: '10px 0 6px', fontFamily: BRAND.mono, letterSpacing: '0.06em' }}>
                CLICK TO USE · <span style={{ color: BRAND.gold }}>+LIB</span> SAVES IT
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {results.map((src, i) => (
                  <div key={i} style={{
                    position: 'relative', aspectRatio: '1', overflow: 'hidden',
                    border: `1px solid ${BRAND.ink100}`, cursor: 'pointer', background: BRAND.bone,
                  }}
                    onClick={() => { const im = new Image(); im.onload = () => onPickImage(im); im.src = src; }}>
                    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <span style={{
                      position: 'absolute', top: 3, left: 3, padding: '1px 4px',
                      background: 'rgba(19,19,16,0.72)', color: BRAND.bone00,
                      fontSize: 8, fontFamily: BRAND.mono, letterSpacing: '0.06em',
                    }}>AI</span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        const im = new Image();
                        im.onload = () => onSaveToLibrary(im, `AI · ${prompt.slice(0, 28)}`, 'ai');
                        im.src = src;
                      }}
                      title="Save to the standard library"
                      style={{
                        position: 'absolute', top: 3, right: 3, padding: '1px 5px',
                        background: 'rgba(19,19,16,0.72)', color: BRAND.bone00,
                        fontSize: 8.5, fontFamily: BRAND.mono, cursor: 'pointer', borderRadius: 2,
                      }}>+LIB</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Section>
  );
};

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
