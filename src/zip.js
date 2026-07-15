// ─────────────────────────────────────────────────────────────────────────────
// ZIP WRITER (store mode, no dependency)
// ─────────────────────────────────────────────────────────────────────────────
// A brand kit is a folder of SVGs, PDFs and a readme — the whole point is to
// hand ONE file to an agency. That needs a ZIP, and pulling in JSZip for what is
// essentially "concatenate with headers" isn't worth a dependency (nor could I
// install one — the registry blocked it).
//
// Store mode (no deflate) is the right call here: SVGs are small, PDFs are
// already compressed internally, and the resulting archive opens natively
// everywhere (Finder, Explorer, Illustrator's Place dialog).

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// MS-DOS date/time — ZIP's original format, still what every unzipper reads.
function dosDateTime(d = new Date()) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2));
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

/**
 * files: [{ name: 'logos/svg/x.svg', data: string | Uint8Array }]
 * → Blob (application/zip)
 */
export function makeZip(files) {
  const enc = new TextEncoder();
  const { time, date } = dosDateTime();
  const chunks = [];
  const central = [];
  let offset = 0;

  const u16 = (v) => [v & 0xFF, (v >>> 8) & 0xFF];
  const u32 = (v) => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);

    const local = new Uint8Array([
      ...u32(0x04034b50),      // local file header signature
      ...u16(20),              // version needed
      ...u16(0),               // flags
      ...u16(0),               // method: 0 = store
      ...u16(time), ...u16(date),
      ...u32(crc),
      ...u32(data.length),     // compressed size == uncompressed (store)
      ...u32(data.length),
      ...u16(nameBytes.length),
      ...u16(0),               // extra field length
      ...nameBytes,
    ]);
    chunks.push(local, data);

    central.push(new Uint8Array([
      ...u32(0x02014b50),      // central directory header signature
      ...u16(20),              // version made by
      ...u16(20),              // version needed
      ...u16(0), ...u16(0),    // flags, method
      ...u16(time), ...u16(date),
      ...u32(crc),
      ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length),
      ...u16(0), ...u16(0),    // extra, comment
      ...u16(0),               // disk number
      ...u16(0),               // internal attrs
      ...u32(0),               // external attrs
      ...u32(offset),          // offset of local header
      ...nameBytes,
    ]));

    offset += local.length + data.length;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array([
    ...u32(0x06054b50),        // end of central directory
    ...u16(0), ...u16(0),      // disk numbers
    ...u16(files.length), ...u16(files.length),
    ...u32(centralSize),
    ...u32(offset),
    ...u16(0),                 // comment length
  ]);

  return new Blob([...chunks, ...central, end], { type: 'application/zip' });
}
