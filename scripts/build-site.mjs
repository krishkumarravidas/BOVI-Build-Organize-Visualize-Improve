// Builds the GitHub Pages site into out/: fills placeholders in site/index.html and copies assets.
// Usage: node scripts/build-site.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.resolve(process.argv[2] ?? path.join(root, 'out'));
const REPO = 'https://github.com/krishkumarravidas/BOVI-Build-Organize-Visualize-Improve';

const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const version = `v${app.expo.version}`;

const src = fs.readFileSync(path.join(root, 'src/lib/attendanceFormat.ts'), 'utf8');
const m = /export const ATTENDANCE_PROMPT = `([\s\S]*?)`;/.exec(src);
if (!m) throw new Error('ATTENDANCE_PROMPT not found');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const prompt = esc(m[1].replace(/\\`/g, '`').replace(/\\\$/g, '$'));

const css = fs.readFileSync(path.join(root, 'site/styles.css'));
const cssHash = crypto.createHash('sha1').update(css).digest('hex').slice(0, 8);

const html = fs
  .readFileSync(path.join(root, 'site/index.html'), 'utf8')
  .replaceAll('{{REPO}}', REPO)
  .replaceAll('{{APK}}', `${REPO}/releases/latest/download/BOVI.apk`)
  .replaceAll('{{VERSION}}', version)
  .replaceAll('{{PROMPT}}', prompt)
  // Cache-bust the stylesheet so a deploy shows up without a hard refresh.
  .replace('href="styles.css"', `href="styles.css?v=${cssHash}"`);
if (/\{\{\w+\}\}/.test(html)) throw new Error('Unfilled placeholder in index.html');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'screenshots'), { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.copyFileSync(path.join(root, 'site/styles.css'), path.join(out, 'styles.css'));
fs.copyFileSync(path.join(root, 'assets/icon.png'), path.join(out, 'icon.png'));
for (const f of fs.readdirSync(path.join(root, 'docs/screenshots'))) {
  if (f.endsWith('.png')) fs.copyFileSync(path.join(root, 'docs/screenshots', f), path.join(out, 'screenshots', f));
}
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`Site built in ${out} (${version})`);
