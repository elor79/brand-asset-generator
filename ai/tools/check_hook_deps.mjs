#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// CATCH THE TEMPORAL-DEAD-ZONE BUG THAT THE BUILD CANNOT SEE
// ─────────────────────────────────────────────────────────────────────────────
// A hook's dependency array is evaluated at RENDER time, not when the callback
// runs. So this is fine:
//
//     const f = useCallback(() => usesLater(), []);   // body runs later
//     const later = 1;
//
// …and this throws on the first paint:
//
//     const f = useCallback(() => {}, [later]);       // ARRAY is built NOW
//     const later = 1;                                // ReferenceError
//
// Bundlers do not model temporal dead zones, so `vite build` passes happily and
// the browser is the first thing to notice. This has now bitten twice —
// makeControlMap naming `activeContent`, and secNo naming `isBrochure`. Once is
// a mistake; twice is a missing check.
//
// This walks every useMemo/useCallback/useEffect dependency array and asserts
// that each identifier it names is declared ABOVE it in the same file.
//
//     node ai/tools/check_hook_deps.mjs src/MedartisBrandGenerator.jsx
import fs from 'node:fs';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node ai/tools/check_hook_deps.mjs <file.jsx> [...]');
  process.exit(2);
}

let failures = 0;

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');

  // Where is each top-level-ish `const NAME =` / `let NAME =` declared?
  // (First declaration wins; that is the one a TDZ would trip over.)
  const declaredAt = new Map();
  lines.forEach((line, i) => {
    const m = line.match(/^\s*(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/);
    if (m && !declaredAt.has(m[1])) declaredAt.set(m[1], i);
    // destructured: const { a, b } = … / const [a, b] = …
    const d = line.match(/^\s*(?:const|let|var)\s*[[{]([^\]}]+)[\]}]\s*=/);
    if (d) {
      for (const raw of d[1].split(',')) {
        const name = raw.split(':').pop().trim().replace(/^\.\.\./, '');
        if (/^[A-Za-z_$][\w$]*$/.test(name) && !declaredAt.has(name)) declaredAt.set(name, i);
      }
    }
  });

  // A dependency array shows up in two shapes, and missing the second is exactly
  // how a checker gives you a false ✓:
  //     }, [a, b]);            ← closes on the same line
  //     [a, b]                 ← alone on its own line, `);` follows
  lines.forEach((line, i) => {
    const m = line.match(/^\s*\}?\s*,?\s*\[([^\]]*)\]\s*\)?\s*;?\s*$/);
    if (!m) return;
    // Only treat it as a dep array if a hook opened above it.
    const before = lines.slice(Math.max(0, i - 60), i + 1).join('\n');
    if (!/use(Memo|Callback|Effect)\s*\(/.test(before)) return;

    for (const raw of m[1].split(',')) {
      // `format.multi` depends on `format`; `a?.b` on `a`.
      const name = raw.trim().split(/[.?[(]/)[0].trim();
      if (!name || !/^[A-Za-z_$][\w$]*$/.test(name)) continue;
      const at = declaredAt.get(name);
      if (at === undefined) continue;         // import, global, or a prop — fine
      if (at > i) {
        failures++;
        console.error(
          `${file}:${i + 1}  dependency "${name}" is declared BELOW this hook ` +
          `(line ${at + 1}).\n` +
          `    The array is built at render time — this throws ` +
          `"can't access '${name}' before initialization" on first paint.\n` +
          `    Move the hook below line ${at + 1}.`
        );
      }
    }
  });
}

if (failures) {
  console.error(`\n✗ ${failures} hook dependenc${failures === 1 ? 'y' : 'ies'} would throw at render.`);
  process.exit(1);
}
console.log('✓ every hook dependency is declared before the hook that names it');
