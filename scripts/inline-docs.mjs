// Inline marks.js + content.js + content-text.js into index.html, producing a
// single self-contained docs.html that opens offline with no dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs');
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
for (const f of ['marks.js', 'content.js', 'content-text.js']) {
  const js = fs.readFileSync(path.join(dir, f), 'utf8');
  html = html.replace(`<script src="${f}"></script>`, `<script>\n${js}\n</script>`);
}
fs.writeFileSync(path.join(dir, 'docs.html'), html);
console.log('docs.html', (fs.statSync(path.join(dir, 'docs.html')).size / 1024).toFixed(0) + 'KB');
