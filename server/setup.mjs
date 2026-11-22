#!/usr/bin/env node
// One-time setup for your BOVI connector: log in to Cloudflare, deploy, create the secret key, and print
// what to paste into the BOVI app and into Claude. Safe to run again (keeps the same key).
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SECRET_FILE = join(here, '.bovi-secret');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

// The terminal stays attached so wrangler can ask questions (e.g. registering a workers.dev subdomain).
function run(args, { input, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(npx, ['wrangler', ...args], { cwd: here, stdio: [input === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit'], shell: process.platform === 'win32', env: { ...process.env, ...env } });
    if (input !== undefined) { child.stdin.write(input); child.stdin.end(); }
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`wrangler ${args[0]} failed (exit ${code})`))));
  });
}

/** The workers.dev address from wrangler's machine-readable output file. */
function deployedUrl(file) {
  if (!existsSync(file)) return null;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    try {
      const e = JSON.parse(line);
      const t = (e.targets ?? []).find((u) => /workers\.dev/.test(u)) ?? e.targets?.[0];
      if (e.type === 'deploy' && t) return t.replace(/\/$/, '');
    } catch {
      // not JSON
    }
  }
  return null;
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
  console.log('If Cloudflare asks to register a workers.dev subdomain, answer yes and pick any name (it becomes part of your address).');
  const outFile = join(tmpdir(), `bovi-wrangler-${process.pid}.ndjson`);
  rmSync(outFile, { force: true });
  try {
    await run(['deploy'], { env: { WRANGLER_OUTPUT_FILE_PATH: outFile } });
  } catch (e) {
    console.error(`
If the error above mentions a workers.dev subdomain: open https://dash.cloudflare.com → Workers & Pages,
pick a subdomain there (it's free), then run this setup again.`);
    throw e;
  }
  let url = deployedUrl(outFile);
  rmSync(outFile, { force: true });
  if (!url) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    url = (await rl.question('Paste the https://….workers.dev address printed above: ')).trim().replace(/\/$/, '');
    rl.close();
  }
  if (!/^https:\/\/\S+$/.test(url)) throw new Error('That does not look like an https address. Run the setup again.');

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
