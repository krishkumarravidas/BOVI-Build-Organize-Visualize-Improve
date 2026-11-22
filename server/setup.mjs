#!/usr/bin/env node
// One-time setup for your BOVI connector: log in to Cloudflare, deploy, create the secret key, and print
// what to paste into the BOVI app and into Claude. Safe to run again (keeps the same key).
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SECRET_FILE = join(here, '.bovi-secret');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(args, { input, capture } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(npx, ['wrangler', ...args], { cwd: here, stdio: [input === undefined ? 'inherit' : 'pipe', capture ? 'pipe' : 'inherit', 'inherit'], shell: process.platform === 'win32' });
    let out = '';
    if (capture) child.stdout.on('data', (d) => { out += d; process.stdout.write(d); });
    if (input !== undefined) { child.stdin.write(input); child.stdin.end(); }
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`wrangler ${args[0]} failed (exit ${code})`))));
  });
}

const step = (n, t) => console.log(`\n\x1b[1m${n}. ${t}\x1b[0m`);

try {
  step(1, 'Cloudflare account');
  const who = spawnSync(npx, ['wrangler', 'whoami'], { cwd: here, encoding: 'utf8', shell: process.platform === 'win32' });
  if (who.status !== 0 || /not authenticated/i.test(`${who.stdout}${who.stderr}`)) {
    console.log('A browser window will open: sign in to Cloudflare (a free account is enough) and allow access.');
    await run(['login']);
  } else console.log('Already signed in.');

  step(2, 'Deploying the connector');
  const out = await run(['deploy'], { capture: true });
  const url = (out.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i) ?? [])[0];
  if (!url) throw new Error('Deployed, but could not find the workers.dev address in the output above. Copy it from there.');

  step(3, 'Secret key');
  let secret = existsSync(SECRET_FILE) ? readFileSync(SECRET_FILE, 'utf8').trim() : '';
  if (secret.length < 32) {
    secret = randomBytes(24).toString('base64url');
    writeFileSync(SECRET_FILE, secret + '\n', { mode: 0o600 });
  }
  await run(['secret', 'put', 'BOVI_SECRET'], { input: secret + '\n' });

  console.log(`
\x1b[1m✓ Your BOVI connector is live.\x1b[0m

\x1b[1mIn the BOVI app\x1b[0m → Settings → Claude connector:
   Server   ${url}
   Key      ${secret}
   then tap "Sync now".

\x1b[1mIn Claude\x1b[0m (claude.ai → Settings → Connectors → Add custom connector):
   Name     BOVI
   URL      ${url}/mcp/${secret}

Keep the key private: anyone with it can read your BOVI data. It's saved in server/.bovi-secret
(not committed). To change it, delete that file and run \`npm run setup\` again, then update both places.
`);
} catch (e) {
  console.error(`\n\x1b[31m${e.message}\x1b[0m`);
  process.exit(1);
}
