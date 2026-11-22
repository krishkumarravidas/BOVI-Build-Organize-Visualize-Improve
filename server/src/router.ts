/**
 * HTTP routes:
 *   GET  /                 health check
 *   POST /sync             the BOVI app (Authorization: Bearer <secret>): store snapshot, get Claude's additions
 *   POST /mcp/<secret>     Claude's connector (MCP Streamable HTTP, stateless JSON responses)
 */
import { MAX_SNAPSHOT_BYTES, type StoreLogic } from './store.ts';
import { callTool, listTools } from './tools.ts';

export const SERVER_INFO = { name: 'bovi', title: 'BOVI planner', version: '1.0.0' };
const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const INSTRUCTIONS =
  "Tools for the user's BOVI planner (college timetable, attendance, exams, assignments, tasks, habits and side projects). " +
  'Read tools answer from the latest data the BOVI app synced; each answer says when that was. Dates are YYYY-MM-DD and times 24-hour HH:mm in the user\'s time zone. ' +
  'Add tools queue new items that appear in BOVI the next time the app syncs; nothing can be deleted or edited through this connector.';

type Json = Record<string, unknown>;

export interface Deps {
  secret: string | undefined;
  store: () => StoreLogic;
  now?: () => number;
  newId?: () => string;
}

const enc = new TextEncoder();
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'authorization, content-type', 'access-control-max-age': '86400' };

/** Constant-time comparison so the secret can't be guessed byte by byte from response timing. */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

export async function route(req: Request, deps: Deps): Promise<Response> {
  const url = new URL(req.url);
  const now = deps.now ?? Date.now;
  const newId = deps.newId ?? (() => crypto.randomUUID());

  if (url.pathname === '/' && req.method === 'GET') {
    return new Response(deps.secret ? 'BOVI connector is running.\n' : 'BOVI connector is running, but BOVI_SECRET is not set yet. Run `npm run setup` again.\n', { headers: { 'content-type': 'text/plain' } });
  }
  if (!deps.secret || deps.secret.length < 16) return json({ error: 'Server not set up: BOVI_SECRET is missing.' }, 503);

  // ----- app sync -----
  if (url.pathname === '/sync') {
    // CORS only matters for BOVI's web build; access still needs the key header (no cookies involved).
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (req.method !== 'POST') return json({ error: 'Use POST' }, 405, { allow: 'POST', ...CORS });
    const auth = req.headers.get('authorization') ?? '';
    if (!safeEqual(auth, `Bearer ${deps.secret}`)) return json({ error: 'Wrong key' }, 401, CORS);
    const raw = await req.text();
    if (raw.length > MAX_SNAPSHOT_BYTES) return json({ error: 'Snapshot too large' }, 413);
    let body: Json;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: 'Body must be JSON' }, 400);
    }
    if (!body.snapshot || typeof body.snapshot !== 'object' || Array.isArray(body.snapshot)) return json({ error: 'Missing snapshot' }, 400);
    const handled = Array.isArray(body.handled) ? body.handled.filter((x): x is string => typeof x === 'string') : [];
    const inbox = await deps.store().sync(body.snapshot as Json, handled, now());
    return json({ inbox, serverTime: now() }, 200, CORS);
  }

  // ----- MCP -----
  const m = /^\/mcp\/([^/]+)\/?$/.exec(url.pathname);
  if (m) {
    if (!safeEqual(decodeURIComponent(m[1]), deps.secret)) return json({ error: 'Not found' }, 404);
    if (req.method === 'GET' || req.method === 'DELETE') return new Response(null, { status: 405, headers: { allow: 'POST' } });
    if (req.method !== 'POST') return json({ error: 'Use POST' }, 405, { allow: 'POST' });
    let msg: unknown;
    try {
      msg = await req.json();
    } catch {
      return json(rpcError(null, -32700, 'Parse error'), 400);
    }
    const ctx = { store: deps.store(), now: now(), newId };
    if (Array.isArray(msg)) {
      const out = (await Promise.all(msg.map((x) => handleRpc(x, ctx)))).filter((x) => x !== null);
      return out.length ? json(out) : new Response(null, { status: 202 });
    }
    const out = await handleRpc(msg, ctx);
    return out === null ? new Response(null, { status: 202 }) : json(out);
  }

  return json({ error: 'Not found' }, 404);
}

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

async function handleRpc(msg: unknown, ctx: Parameters<typeof callTool>[2]): Promise<Json | null> {
  if (!msg || typeof msg !== 'object') return rpcError(null, -32600, 'Invalid request');
  const { id, method, params } = msg as { id?: unknown; method?: unknown; params?: Json };
  const isNotification = id === undefined;
  if (typeof method !== 'string') return isNotification ? null : rpcError(id, -32600, 'Invalid request');
  if (isNotification) return null; // notifications/initialized, cancelled, ...

  const ok = (result: unknown) => ({ jsonrpc: '2.0', id, result });
  switch (method) {
    case 'initialize': {
      const asked = typeof params?.protocolVersion === 'string' ? params.protocolVersion : '';
      return ok({
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({ tools: listTools() });
    case 'tools/call': {
      const name = typeof params?.name === 'string' ? params.name : '';
      const result = await callTool(name, params?.arguments, ctx);
      return result ? ok(result) : rpcError(id, -32602, `Unknown tool: ${name}`);
    }
    case 'resources/list':
      return ok({ resources: [] });
    case 'prompts/list':
      return ok({ prompts: [] });
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}
