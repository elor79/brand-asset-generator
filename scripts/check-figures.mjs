// Geometric linter for the documentation figures: flags text clipping the viewBox,
// text overlapping text, and text crossing a bordered/solid box that does not
// enclose it (the class of bug where a subtitle sat on a chip row). Verified against
// that bug by reintroduction. Run: node scripts/check-figures.mjs
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '..');
const arg = 'DOCS=' + path.join(root, 'docs/content.js') + '=' + path.join(root, 'docs/marks.js');
const r = spawnSync('node', [path.join(dir, 'check-figures-core.mjs'), arg], { stdio: 'inherit' });
process.exit(r.status ?? 1);
