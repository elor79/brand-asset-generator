import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
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
      { key: 'body',     label: 'Fact block (Date / Time / Venue — keep the labels)', default: 'Date Friday, November 29, 2026\nTime 11.45 – 12.30\nVenue Saal A, Palazzo dei Congressi', multiline: true },
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
};

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

const drawWordmark = (ctx, x, y, height, color) => {
  const srcH = 61;
  const offsetX = 92;
  const offsetY = 92;
  const scale = height / srcH;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-offsetX, -offsetY);
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
function parseAgendaBody(body) {
  return (body || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    if (ROW_PARTIAL_TIME_RE.test(l)) return { time: l, title: '', faculty: '' };
    const m = l.match(ROW_TIME_RE);
    if (!m) return { time: '', title: l, faculty: '' };
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
    .filter((r) => r.time || r.title || r.faculty)
    .map((r) => `${r.time ? r.time + '  ' : ''}${r.title}${r.faculty ? ' \u2014 ' + r.faculty : ''}`)
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
  const move = (i, d) => {
    const to = i + d;
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    if (pinTimes) {
      const a = next[i], b = next[to];
      next[i] = { ...a, title: b.title, faculty: b.faculty };
      next[to] = { ...b, title: a.title, faculty: a.faculty };
    } else {
      [next[i], next[to]] = [next[to], next[i]];
    }
    commit(next);
  };
  const add = () => commit([...rows, { time: '', title: '', faculty: '' }]);
  const cell = { fontSize: 12, padding: '5px 7px', border: `1px solid ${BRAND.ink100}`, background: '#fff', width: '100%', boxSizing: 'border-box' };
  const iconBtn = { border: 'none', background: 'transparent', cursor: 'pointer', color: BRAND.ink300, fontSize: 12, padding: '2px 4px' };
  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.1em', color: BRAND.ink600, cursor: 'pointer' }}
             title="On: moving a session up/down swaps the content between time slots — the time grid stays chronological. Off: the whole row moves, time included.">
        <input type="checkbox" checked={pinTimes} onChange={(e) => setPinTimes(e.target.checked)} />
        KEEP TIMES IN PLACE WHEN REORDERING
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 130px 60px', gap: 4, marginBottom: 4, fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.1em', color: BRAND.ink300 }}>
        <span>TIME</span><span>SESSION</span><span>FACULTY</span><span />
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 130px 60px', gap: 4, marginBottom: 4, alignItems: 'center' }}>
          <input style={{ ...cell, fontFamily: BRAND.mono }} value={r.time} placeholder="09.15" onChange={(e) => update(i, 'time', e.target.value)} onBlur={() => update(i, 'time', normalizeTime(r.time))} />
          <input style={cell} value={r.title} placeholder="Session title" onChange={(e) => update(i, 'title', e.target.value)} />
          <input style={cell} value={r.faculty} placeholder="Prof. N. N." onChange={(e) => update(i, 'faculty', e.target.value)} />
          <span style={{ whiteSpace: 'nowrap' }}>
            <button style={iconBtn} title="Move up" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
            <button style={iconBtn} title="Move down" onClick={() => move(i, 1)} disabled={i === rows.length - 1}>↓</button>
            <button style={{ ...iconBtn, color: '#e11d48' }} title="Remove" onClick={() => remove(i)}>✕</button>
          </span>
        </div>
      ))}
      <button onClick={add} style={{ marginTop: 2, border: `1px dashed ${BRAND.ink300}`, background: 'transparent', cursor: 'pointer', fontFamily: BRAND.mono, fontSize: 10, letterSpacing: '0.08em', color: BRAND.ink600, padding: '5px 10px' }}>+ SESSION</button>
    </div>
  );
}

function layoutTextElements(ctx, content, x, y, w, palette, accent, frame, anchor = 'top') {
  const baseSize = Math.min(frame.w, frame.h);
  // Stringent baseline grid: every element baseline snaps to a multiple of `gridUnit`
  // so vertical rhythm is mathematically identical across all templates and formats.
  // Per brand guide §grid baseline_px=8 → here we scale: ~0.8% of short side.
  const gridUnit = Math.max(4, Math.round(baseSize * 0.008));
  const snap = (v) => Math.round(v / gridUnit) * gridUnit;

  const eyebrowSize = Math.max(11, baseSize * 0.0135);
  const headlineMax = Math.max(36, baseSize * 0.078);
  const headlineMin = Math.max(22, baseSize * 0.04);
  const sublineSize = Math.max(15, baseSize * 0.024);
  const bodySize    = Math.max(12, baseSize * 0.0165);
  const ctaSize     = Math.max(11, baseSize * 0.014);

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
    const rawLines = content.body.split('\n').map((l) => l.trim()).filter(Boolean);
    const structured = parseStructuredRows(rawLines);
    if (structured) {
      // Column width from the widest mono col text (time or label) + gutter.
      const colSize = bodySize * 0.92;
      ctx.font = `500 ${colSize}px ${BRAND.mono}`;
      const colW = Math.max(...structured.map((r) => ctx.measureText(r.col).width), 0) + bodySize * 1.4;
      const textW = Math.max(60, w - colW);
      ctx.font = `500 ${bodySize}px ${BRAND.display}`;
      const rows = structured.map((r) => ({ ...r, titleLines: wrapText(ctx, r.main, textW) }));
      const lineCount = rows.reduce((n, r) => n + r.titleLines.length, 0);
      const estH = lineCount * bodySize * 1.18 + rows.length * bodySize * 0.6;
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
      for (const r of el.rows) {
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

// Each format declares wmPct = wordmark width as fraction of short side.
// Guide values: 0.27 paged · 0.30 poster · 0.10 sensible digital default.
// User can override via opts.wordmarkPctOverride (0..1) to set their own size.
// Wordmark height derives from the source aspect ratio (~5.64 : 1).
const WORDMARK_AR = 344 / 61;
function wordmarkSizeFor(frame, formatKey, pctOverride) {
  const fmt = FORMATS[formatKey] || {};
  const shortSide = Math.min(frame.w, frame.h);
  const pct = (pctOverride != null && pctOverride > 0) ? pctOverride : (fmt.wmPct ?? 0.10);
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
  const maxW = Math.max(40, sa.w - padX * 1.4);
  if (wm.w > maxW) {
    const r = maxW / wm.w;
    wm = { w: wm.w * r, h: wm.h * r };
  }
  const top = sa.y + padY * 0.95;
  const bottom = sa.y + sa.h - padY * 0.55;
  const left = sa.x + padX * 0.6;
  const right = sa.x + sa.w - padX * 0.6 - wm.w;
  let x, y;
  if (pos === 'tl') { x = left;  y = top; }
  if (pos === 'tr') { x = right; y = top; }
  if (pos === 'bl') { x = left;  y = bottom; }
  if (pos === 'br') { x = right; y = bottom; }
  return { x, y, w: wm.w, h: wm.h, pos };
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
  if (wmBox && (wmBox.pos === 'tl' || wmBox.pos === 'tr')) top    = Math.max(top,    wmBox.h + gap);
  if (wmBox && (wmBox.pos === 'bl' || wmBox.pos === 'br')) bottom = Math.max(bottom, wmBox.h + gap);
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
  if (opts.wordmarkColor === 'auto' && (opts.wordmarkOverImage || overlay)) {
    const box = computeWordmarkBox(frame, wm, opts.formatKey, wmArea, opts.wordmarkPctOverride);
    if (box) {
      // Pad the sample area a little so we catch what surrounds the wordmark
      const pad = Math.max(8, box.h * 0.4);
      wmColor = resolveAutoContrast(ctx, box.x - pad, box.y - pad,
                                    box.w + pad * 2, box.h + pad * 2,
                                    palette.mode === 'dark');
    }
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
  const [carouselSlides, setCarouselSlides] = useState(3);

  const initialContent = useMemo(() => {
    const t = TEMPLATES[templateKey];
    const obj = {};
    t.fields.forEach(f => obj[f.key] = f.default);
    return obj;
  }, [templateKey]);

  // Per-slide state (carousel) + single-slide fallback
  const [content, setContent] = useState(initialContent);
  const [carouselContent, setCarouselContent] = useState(() => [initialContent, initialContent, initialContent]);
  const [image, setImage] = useState(null);
  const [carouselImages, setCarouselImages] = useState([null, null, null]);
  const [imageFit, setImageFit] = useState({ ...DEFAULT_FIT });
  const [carouselFits, setCarouselFits] = useState([{...DEFAULT_FIT}, {...DEFAULT_FIT}, {...DEFAULT_FIT}]);

  useEffect(() => {
    const t = TEMPLATES[templateKey];
    setContent(initialContent);
    setCarouselSlide(0);
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
      setCarouselContent(prev => prev.map(() => ({ ...initialContent })));
    }
  }, [templateKey, initialContent]);

  // Palettes
  const [paletteName, setPaletteName] = useState('coal');
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
  const COLLAPSE_KEY = 'medartis-bag-collapsed-v2';
  const FMT_GROUPS = ['Social · square', 'Social · wide', 'Digital surface', 'Print · paged', 'Print · poster'];
  const ALL_FMT_KEYS = FMT_GROUPS.map(g => 'fmt:' + g);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || 'null');
      if (Array.isArray(stored)) return new Set(stored);
    } catch {}
    // First visit → all format groups collapsed
    return new Set(ALL_FMT_KEYS);
  });
  const toggleCollapsed = (k) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      // Accordion for format groups
      if (k.startsWith('fmt:')) {
        const isOpen = !next.has(k);
        if (isOpen) {
          // currently open → just close it
          next.add(k);
        } else {
          // opening this one → close all other fmt groups, open this
          for (const f of ALL_FMT_KEYS) next.add(f);
          next.delete(k);
        }
      } else {
        next.has(k) ? next.delete(k) : next.add(k);
      }
      try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  };
  // Shorthand: pass to a <Section> to make it collapsible by id
  const sp = (k) => ({
    collapsed: collapsed.has('sec:' + k),
    onToggle: () => toggleCollapsed('sec:' + k),
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
  const palette = palettes[paletteName];

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

  const canvasRef = useRef(null);
  const previewWrapRef = useRef(null);
  const [previewSize, setPreviewSize] = useState({ w: 500, h: 500 });
  const format = FORMATS[formatKey];

  useEffect(() => {
    const update = () => {
      if (!previewWrapRef.current) return;
      const rect = previewWrapRef.current.getBoundingClientRect();
      const pad = 80;
      const maxW = rect.width - pad;
      const maxH = rect.height - pad - 40;
      const ratio = format.w / format.h;
      let w = maxW, h = w / ratio;
      if (h > maxH) { h = maxH; w = h * ratio; }
      setPreviewSize({ w, h });
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

  // Active values (per-slide for carousels)
  const activeContent = format.multi ? (carouselContent[carouselSlide] || initialContent) : content;
  const activeImage   = format.multi ? carouselImages[carouselSlide]   : image;
  const activeFit     = format.multi ? (carouselFits[carouselSlide] || DEFAULT_FIT) : imageFit;
  // Per-slide image picker is redundant when a spanning bg is covering the image area
  const perSlideImageDisabled = format.multi
    && carouselBg.enabled
    && !!carouselBgImage
    && (carouselBg.placement === 'full' || carouselBg.placement === 'image');

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = format.w;
    canvas.height = format.h;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic';

    const pad = Math.min(format.w, format.h) * 0.07;
    const frame = { w: format.w, h: format.h, padX: pad, padY: pad };

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
        palette, accent: BRAND.gold, fit: activeFit,
        wordmarkPos,
        folioPos: slideShowsFolio ? folioPos : 'hidden',
        formatKey,
        wordmarkOverImage, folioOverImage,
        wordmarkColor, folioColor, folioText, wordmarkPctOverride,
        qr: slideShowsQr ? qrConfig : { ...qrConfig, enabled: false },
        qrImage: slideShowsQr ? qrImage : null,
        carouselBg: { ...carouselBg, image: carouselBgImage },
        slideIdx: format.multi ? carouselSlide : 0,
        totalSlides: format.multi ? carouselSlides : 1,
        textBackdrop: backdropOpt,
      });
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
  }, [format, layoutKey, activeContent, activeImage, activeFit, palette, carouselSlides, carouselSlide, wordmarkPos, folioPos, formatKey, wordmarkOverImage, folioOverImage, wordmarkColor, folioColor, folioText, qrConfig, qrImage, carouselBg, carouselBgImage, carouselQrPer, carouselFolioPer, textBackdrop, wordmarkPctOverride]);

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
    if (format.multi) {
      const next = [...carouselContent];
      next[carouselSlide] = { ...(next[carouselSlide] || initialContent), [key]: value };
      setCarouselContent(next);
    } else {
      setContent({ ...content, [key]: value });
    }
  };

  const updateFit = (patch) => {
    if (format.multi) {
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
      if (format.multi) {
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

  // ── PDF export (optional bleed + crop marks) ────────────────────
  const [pdfBleed, setPdfBleed] = useState(true);
  const [pdfCropMarks, setPdfCropMarks] = useState(true);
  const [pdfVector, setPdfVector] = useState(true);    // vectorise text + wordmark
  const [pdfCropColor, setPdfCropColor] = useState('auto'); // 'auto' | 'ink' | 'bone'

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
    const frame = { w: trimW, h: trimH, padX: pad, padY: pad, bleedPx };
    const layout = LAYOUTS[layoutKey];
    const idx = slideIdxOverride ?? (format.multi ? carouselSlide : 0);
    const slideShowsFolio = format.multi ? (carouselFolioPer[idx] ?? true) : true;
    const slideShowsQr    = format.multi ? (carouselQrPer[idx]    ?? true) : true;
    layout.draw(ctx, frame, contentOverride ?? activeContent, imageOverride ?? activeImage, {
      palette, accent: BRAND.gold,
      fit: fitOverride ?? activeFit,
      wordmarkPos,
      folioPos: slideShowsFolio ? folioPos : 'hidden',
      formatKey,
      wordmarkOverImage, folioOverImage,
      wordmarkColor, folioColor, folioText,
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
    const frame = { w: format.w, h: format.h, padX: pad, padY: pad };

    // We need a measurement canvas context so layoutTextElements can measure widths
    const measCanvas = document.createElement('canvas');
    measCanvas.width = format.w;
    measCanvas.height = format.h;
    const measCtx = measCanvas.getContext('2d');

    const opts = {
      palette, accent: BRAND.gold,
      fit: slideFit, wordmarkPos, folioPos, formatKey,
      wordmarkOverImage, folioOverImage,
      wordmarkColor, folioColor, folioText, wordmarkPctOverride,
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
    const frame = { w: formatDef.w, h: formatDef.h, padX: pad, padY: pad };
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

    if (format.multi) {
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
    imageRef: imageToRef(image),
    carouselImageRefs: carouselImages.map(imageToRef),
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
    if (preset.qrConfig) setQrConfig({ ...DEFAULT_QR, ...preset.qrConfig });
    if (preset.carouselBg) setCarouselBg(preset.carouselBg);
    if (Array.isArray(preset.carouselQrPer))    setCarouselQrPer(preset.carouselQrPer);
    if (Array.isArray(preset.carouselFolioPer)) setCarouselFolioPer(preset.carouselFolioPer);
    if (preset.textBackdrop) setTextBackdrop(preset.textBackdrop);
    await new Promise(r => setTimeout(r, 60));
    setContent(preset.content || {});
    setCarouselSlides(preset.carouselSlides || 3);
    setCarouselSlide(preset.carouselSlide || 0);
    setCarouselContent(preset.carouselContent || []);
    setImageFit({ ...DEFAULT_FIT, ...(preset.imageFit || {}) });
    setCarouselFits((preset.carouselFits || []).map(f => ({ ...DEFAULT_FIT, ...(f || {}) })));
    // Images
    setImage(await refToImage(preset.imageRef));
    const imgs = await Promise.all((preset.carouselImageRefs || []).map(refToImage));
    setCarouselImages(imgs);
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
        </div>

        <Section label="§ 01 — FORMAT" {...sp('FORMAT')}>
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

        <Section label="§ 02 — LAYOUT" {...sp('LAYOUT')}>
          {FORMAT_LAYOUTS[formatKey].map((lk) => (
            <SidebarBtn key={lk} active={layoutKey === lk} onClick={() => setLayoutKey(lk)}>
              {LAYOUTS[lk].label}
            </SidebarBtn>
          ))}
        </Section>

        <Section label="§ 03 — CONTENT TEMPLATE" {...sp('TEMPLATE')}>
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

        {format.multi && (
          <div style={{
            position: 'absolute', bottom: 28, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center'
          }}>
            <CarouselNav onClick={() => setCarouselSlide(Math.max(0, carouselSlide - 1))} disabled={carouselSlide === 0}>←</CarouselNav>
            <div style={{
              color: BRAND.bone00, fontSize: 11, padding: '0 12px', minWidth: 100,
              textAlign: 'center', fontFamily: BRAND.mono, letterSpacing: '0.1em'
            }}>SLIDE {carouselSlide + 1} / {carouselSlides}</div>
            <CarouselNav onClick={() => setCarouselSlide(Math.min(carouselSlides - 1, carouselSlide + 1))} disabled={carouselSlide === carouselSlides - 1}>→</CarouselNav>
          </div>
        )}
      </div>

      {/* RIGHT SIDEBAR */}
      <div style={{
        width: 380, background: BRAND.bone00, padding: '24px 22px',
        overflowY: 'auto', borderLeft: `1px solid ${BRAND.ink100}`
      }}>
        <Section label="§ 04 — SURFACE" {...sp('SURFACE')}>
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
        <Section label="§ 04B — BRAND BAR" {...sp('BRANDBAR')}>
          <div style={{
            fontSize: 10, color: BRAND.ink600, marginBottom: 8,
            fontFamily: BRAND.mono, letterSpacing: '0.06em', lineHeight: 1.5
          }}>
            GUIDE · WORDMARK TR · SENDER BL · BL→TR DIAGONAL
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
            const formatDefault = (FORMATS[formatKey]?.wmPct) ?? 0.10;
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
        <Section label="§ 04E — TEXT BACKDROP" {...sp('TEXTBG')}>
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
        <Section label="§ 04C — QR CODE" {...sp('QR')}>
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
          <Section label="§ 04A — CAROUSEL" {...sp('CAROUSEL')}>
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
                    <span style={{ color: BRAND.gold }}>QR PER-SLIDE TOGGLE NEEDS GLOBAL QR ON IN § 04C</span>
                  </>
                )}
              </div>
            </div>
          </Section>
        )}

        {/* Carousel spanning background — only for multi-slide formats */}
        {format.multi && (
          <Section label="§ 04D — SPANNING BG" {...sp('CAROUSEL_BG')}>
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
              {LIBRARY.map(asset => (
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

        {/* Content fields */}
        <Section label={`§ 05 — CONTENT${format.multi ? ` · SLIDE ${carouselSlide + 1}` : ''}`} {...sp('CONTENT')}>
          {template.fields.map(field => (
            <div key={field.key} style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block', fontSize: 10, fontWeight: 500,
                color: BRAND.ink600, marginBottom: 6,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                fontFamily: BRAND.mono
              }}>{field.label}</label>
              {templateKey === 'agenda-flyer' && field.key === 'body' ? (
                <AgendaEditor value={activeContent.body || ''} onChange={(v) => updateField('body', v)} />
              ) : field.multiline ? (
                <textarea value={activeContent[field.key] || ''}
                          onChange={(e) => updateField(field.key, e.target.value)} rows={3} />
              ) : (
                <input type="text" value={activeContent[field.key] || ''}
                       onChange={(e) => updateField(field.key, e.target.value)} />
              )}
            </div>
          ))}
        </Section>

        {/* Image library + upload — disabled when spanning bg replaces the image area */}
        {(() => null)()}
        <Section label={`§ 06 — IMAGE${format.multi ? ` · SLIDE ${carouselSlide + 1}` : ''}`} {...sp('IMAGE')}>
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
            {LIBRARY.map(asset => (
              <button key={asset.id} title={asset.label}
                      onClick={() => libraryImages[asset.id] && applyImage(libraryImages[asset.id])}
                      style={{
                        aspectRatio: '1', background: BRAND.bone,
                        border: `1px solid ${BRAND.ink100}`, borderRadius: 0,
                        cursor: 'pointer', padding: 0, overflow: 'hidden', position: 'relative'
                      }}>
                {libraryImages[asset.id] && (
                  <img src={asset.src} alt={asset.label}
                       style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                )}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(transparent, rgba(19,19,16,0.85))',
                  color: BRAND.bone00, fontSize: 8.5, padding: '10px 4px 4px',
                  textAlign: 'left', fontWeight: 500, fontFamily: BRAND.mono,
                  letterSpacing: '0.04em', textTransform: 'uppercase'
                }}>{asset.category}</div>
              </button>
            ))}
          </div>
        </div>
        </Section>

        {/* Canto search */}
        <div style={{ opacity: perSlideImageDisabled ? 0.4 : 1, pointerEvents: perSlideImageDisabled ? 'none' : 'auto' }}>
          <CantoSection onPickImage={applyImage} sectionProps={sp('CANTO')} />
        </div>

        {/* Image fit controls */}
        <Section label="§ 08 — IMAGE FIT" {...sp('IMAGEFIT')}>
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

        {/* Export */}
        <Section label="§ 09 — EXPORT" {...sp('EXPORT')}>
          <button onClick={download} style={{
            width: '100%', padding: '14px', background: BRAND.ink,
            color: BRAND.bone00, border: 'none', borderRadius: 0,
            fontSize: 11, fontWeight: 500, cursor: 'pointer',
            fontFamily: BRAND.mono, marginBottom: 6,
            letterSpacing: '0.16em', textTransform: 'uppercase'
          }}>DOWNLOAD PNG</button>
          {format.multi && (
            <button onClick={downloadAllSlides} style={{
              width: '100%', padding: '12px', background: BRAND.paper,
              color: BRAND.ink, border: `1px solid ${BRAND.ink}`, borderRadius: 0,
              fontSize: 10.5, fontWeight: 500, cursor: 'pointer',
              fontFamily: BRAND.mono, letterSpacing: '0.16em', textTransform: 'uppercase',
              marginBottom: 6
            }}>DOWNLOAD ALL {carouselSlides} SLIDES PNG</button>
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
        <Section label="§ 10 — PRESETS" {...sp('PRESETS')}>
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

          {Object.keys(presets).length === 0 ? (
            <div style={{
              fontSize: 10.5, color: BRAND.ink600, fontFamily: BRAND.mono,
              letterSpacing: '0.06em', padding: '10px 0'
            }}>NO SAVED PRESETS YET</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
              {Object.entries(presets)
                .sort(([, a], [, b]) => (b.savedAt || '').localeCompare(a.savedAt || ''))
                .map(([name, p]) => (
                  <div key={name} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '8px 10px', background: BRAND.paper,
                    border: `1px solid ${BRAND.ink100}`
                  }}>
                    <button onClick={() => loadPreset(name)} title={p.savedAt || ''} style={{
                      flex: 1, textAlign: 'left', background: 'transparent', border: 'none',
                      cursor: 'pointer', fontFamily: BRAND.display, color: BRAND.ink,
                      fontSize: 12, padding: 0
                    }}>
                      <div style={{ fontWeight: 500 }}>{name}</div>
                      <div style={{
                        fontSize: 9.5, color: BRAND.ink600, fontFamily: BRAND.mono,
                        letterSpacing: '0.05em', marginTop: 1
                      }}>
                        {p.formatKey} · {p.templateKey}{p.carouselSlides > 1 ? ` · ${p.carouselSlides} slides` : ''}
                      </div>
                    </button>
                    <button onClick={() => {
                      if (confirm(`Delete preset "${name}"?`)) deletePreset(name);
                    }} style={{
                      width: 22, height: 22, background: 'transparent',
                      border: 'none', cursor: 'pointer', color: BRAND.ink600,
                      fontSize: 16, lineHeight: 1, fontFamily: BRAND.display
                    }} title="Delete">×</button>
                  </div>
                ))}
            </div>
          )}

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
const CantoSection = ({ onPickImage, sectionProps = {} }) => {
  const [status, setStatus] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

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

  return (
    <Section label="§ 07 — CANTO DAM" {...sectionProps}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, maxHeight: expanded ? 'none' : 280, overflow: 'auto' }}>
            {results.map(a => (
              <button key={a.id} title={a.name} onClick={() => pickAsset(a)} style={{
                aspectRatio: '1', background: BRAND.bone,
                border: `1px solid ${BRAND.ink100}`, borderRadius: 0,
                cursor: 'pointer', padding: 0, overflow: 'hidden', position: 'relative'
              }}>
                {a.previewUrl && (
                  <img src={a.previewUrl} alt={a.name} loading="lazy"
                       style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                )}
              </button>
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
