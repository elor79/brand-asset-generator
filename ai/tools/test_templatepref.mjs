#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// "REMEMBER MY ANSWER" AND THE UNDO THAT EARNS IT
// ─────────────────────────────────────────────────────────────────────────────
//     node ai/tools/test_templatepref.mjs
//
// These two features are one feature. "Remember: keep my copy" is harmless.
// "Remember: load the sample" is a STANDING INSTRUCTION TO REPLACE YOUR WRITING on
// every future switch — a foot-gun with a checkbox on it, unless there is a way
// back. So the undo is not a nicety here; it is the thing that makes the checkbox
// safe to offer at all, and both are tested together.
//
// The properties that matter:
//   · a remembered answer survives, and a corrupt one is IGNORED rather than obeyed
//   · a blocked localStorage does not take the app down
//   · the snapshot is a real copy — it cannot be mutated by the edit it undoes
//   · the bar appears only when something CHANGED (noise is how a real undo gets
//     ignored), and turns red only when WORK was actually lost
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const M = await import(path.join(ROOT, 'src/templatePref.js'));

let fail = 0;
const t = (label, ok) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) fail++; };

console.log('the remembered answer\n');
M.writeTemplatePref('keep');   t('  keep round-trips', M.readTemplatePref() === 'keep');
M.writeTemplatePref('sample'); t('  sample round-trips', M.readTemplatePref() === 'sample');
M.writeTemplatePref(null);     t('  null clears it — "ask again" really does', M.readTemplatePref() === null);
store['medartis-template-pref-v1'] = 'nonsense';
t('  a hand-edited value is IGNORED, not obeyed', M.readTemplatePref() === null);
const good = global.localStorage;
global.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
t('  a blocked localStorage does not take the app down',
  M.readTemplatePref() === null && M.writeTemplatePref('keep') === false);
global.localStorage = good;
store = {};

console.log('\nthe snapshot — it must survive the edit it exists to undo\n');
t('  content is cloned, not referenced', (() => {
  const src = { headline: 'original' };
  const s = M.snapshotContent({ content: src, carouselContent: [], templateKey: 'a', layoutKey: 'b', carouselSlides: 1 });
  src.headline = 'mutated';
  return s.content.headline === 'original';
})());
t('  carousel slides are cloned too', (() => {
  const slides = [{ headline: 'one' }];
  const s = M.snapshotContent({ content: {}, carouselContent: slides, templateKey: 'a', layoutKey: 'b', carouselSlides: 1 });
  slides[0].headline = 'mutated';
  return s.carouselContent[0].headline === 'one';
})());

const A = M.snapshotContent({
  content: { headline: 'APTUS Hand 2.0', body: 'my copy' },
  carouselContent: [{ headline: 'slide 1' }],
  templateKey: 'product-launch', layoutKey: 'image-bottom', carouselSlides: 1,
});

console.log('\nwhen to OFFER the undo\n');
t('  nothing changed → no bar', !M.snapshotDiffers(A, { ...A }));
t('  template changed → offer it', M.snapshotDiffers(A, { ...A, templateKey: 'quote-card' }));

const wiped = M.snapshotContent({
  content: { headline: 'Sample headline', body: '' },
  carouselContent: [{ headline: 'slide 1' }],
  templateKey: 'quote-card', layoutKey: 'type-only', carouselSlides: 1,
});
t('  copy replaced → offer it', M.snapshotDiffers(A, wiped));

console.log('\nwas WORK lost? — this drives the red bar\n');
t('  the sample overwrote written copy → lost', M.snapshotLostWork(A, wiped));
t('  template changed but copy kept → NOT lost', !M.snapshotLostWork(A, { ...A, templateKey: 'quote-card' }));
const slideGone = M.snapshotContent({
  content: { headline: 'APTUS Hand 2.0', body: 'my copy' },
  carouselContent: [{ headline: 'REPLACED' }],
  templateKey: 'product-tour', layoutKey: 'image-bottom', carouselSlides: 1,
});
t('  a written slide was replaced → lost', M.snapshotLostWork(A, slideGone));
const empty = M.snapshotContent({ content: {}, carouselContent: [{}], templateKey: 'x', layoutKey: 'y', carouselSlides: 1 });
t('  replacing an EMPTY slide is not lost work', !M.snapshotLostWork(empty, slideGone));

console.log(fail ? `\n✗ ${fail} failed` : '\n✓ remember and undo behave');
process.exit(fail ? 1 : 0);
