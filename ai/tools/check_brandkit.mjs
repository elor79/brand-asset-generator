#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// THE BRAND KIT MUST PRODUCE A ZIP THAT ACTUALLY OPENS
// ─────────────────────────────────────────────────────────────────────────────
// This exists because the kit shipped broken: buildBrandKit emitted
// { name, blob } and makeZip consumes { name, data }, so f.data was undefined and
// crc32 died on "bytes is undefined".
//
// My first test PASSED that bug — because it stubbed Blob and asserted on my own
// wrong shape without ever calling the zip writer. A test that mocks the thing
// under test is not a test, it is a second copy of the mistake.
//
// So this one RUNS makeZip and UNPACKS the archive: signature, central directory,
// file contents, and CRCs. If it passes, the file a printer receives opens.
//
//     node ai/tools/check_brandkit.mjs
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(ROOT, 'src/MedartisBrandGenerator.jsx'), 'utf8');
const paths = [...src.match(/const WORDMARK_PATHS = \[([\s\S]*?)\n\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const WM_VIEW  = { w: 526.755, h: 245.078 };
const WM_GLYPH = { x: 91.89, y: 91.89, w: 342.98, h: 61.30 };

// The only browser API involved is Blob (makeZip's return value). Make it real
// enough to read bytes back — never stub buildBrandKit or makeZip themselves.
global.Blob = class {
  constructor(parts) {
    this._buf = Buffer.concat(parts.map((p) => (p instanceof Uint8Array ? Buffer.from(p) : Buffer.from(String(p)))));
    this.size = this._buf.length;
  }
  bytes() { return this._buf; }
};

const { buildBrandKit } = await import(path.join(ROOT, 'src/logoVector.js'));
const { makeZip } = await import(path.join(ROOT, 'src/zip.js'));

let ok = true;
const check = (label, cond) => { console.log(`${cond ? '✓' : '✗'} ${label}`); ok &&= cond; };

const files = await buildBrandKit({
  paths, glyph: WM_GLYPH, view: WM_VIEW,
  colors: { ink: { hex: '#131310' }, bone: { hex: '#FAF8F0' } },
  brand: { ink: '#131310', gold: '#CFAB5C' },
  formats: ['svg'],            // PDF needs a DOM; the zip contract is what matters here
  clearSpace: true,
});

check('every entry is { name, data } — the shape makeZip consumes',
  files.every((f) => typeof f.name === 'string' && (typeof f.data === 'string' || f.data instanceof Uint8Array)));
check('no entry carries a Blob (async bytes vs a sync writer)', files.every((f) => f.blob === undefined));

// A throw here IS the failure — report it as one instead of dumping a stack.
let zip;
try {
  zip = makeZip(files).bytes();
} catch (e) {
  console.log(`✗ makeZip threw: ${e.message}`);
  console.log('\n✗ the brand kit is broken — the zip writer could not read the file bytes.');
  console.log('  buildBrandKit must emit { name, data } where data is a string or Uint8Array.');
  process.exit(1);
}
check('makeZip returns an archive', zip.length > 0);
check('PK local-file signature', zip.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])));

const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
const count = zip.readUInt16LE(eocd + 10);
const entries = {};
let p = zip.readUInt32LE(eocd + 16);
for (let i = 0; i < count; i++) {
  const nameLen = zip.readUInt16LE(p + 28);
  const name = zip.subarray(p + 46, p + 46 + nameLen).toString();
  const size = zip.readUInt32LE(p + 24);
  const crc = zip.readUInt32LE(p + 16);
  const lho = zip.readUInt32LE(p + 42);
  const at = lho + 30 + zip.readUInt16LE(lho + 26) + zip.readUInt16LE(lho + 28);
  entries[name] = { data: zip.subarray(at, at + size), crc };
  p += 46 + nameLen + zip.readUInt16LE(p + 30) + zip.readUInt16LE(p + 32);
}
check(`central directory lists all ${files.length} files`, count === files.length);

const svg = entries['logos/svg/medartis_wordmark_ink.svg']?.data.toString();
check('the unpacked SVG carries every glyph path', !!svg && paths.every((d) => svg.includes(d)));
check('outlines survive the round-trip (no <text>)', !!svg && !/<text/.test(svg));
check('README carries the 1.5 x d rule',
  !!entries['README.txt']?.data.toString().includes('1.5 x the height of the letter "d"'));

if (zlib.crc32) {
  check('every CRC matches — otherwise the zip opens and every file reads as damaged',
    Object.values(entries).every((e) => e.crc === zlib.crc32(e.data)));
}

console.log(ok ? '\n✓ the brand kit opens' : '\n✗ the brand kit is broken');
process.exit(ok ? 0 : 1);
