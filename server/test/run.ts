// Runs with: node --experimental-strip-types test/run.ts  (no test framework needed)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { route, safeEqual } from '../src/router.ts';
import { MapKV, StoreLogic } from '../src/store.ts';
import { isRealDate, normTime } from '../src/tools.ts';

const SECRET = 'test-secret-0123456789abcdef';
const snapshot = JSON.parse(readFileSync(new URL('./snapshot.json', import.meta.url), 'utf8'));

let passed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.log(`  ✕ ${name}`);
    throw e;
  }
}

function server(secret: string | undefined = SECRET) {
  const store = new StoreLogic(new MapKV());
  let n = 0;
  let clock = Date.UTC(2026, 10, 16, 5, 0);
  const deps = { secret, store: () => store, now: () => clock, newId: () => `id${++n}` };
  const req = (path: string, init?: RequestInit) => route(new Request(`https://bovi.example.workers.dev${path}`, init), deps);
  const rpc = async (method: string, params?: unknown, id: number | null = 1) => {
    const res = await req(`/mcp/${SECRET}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', ...(id !== null ? { id } : {}), method, ...(params ? { params } : {}) }) });
    return { status: res.status, body: res.status === 202 ? null : await res.json() };
  };
  const call = async (name: string, args: unknown = {}) => {
    const r = await rpc('tools/call', { name, arguments: args });
    const result = r.body.result;
    return { error: !!result?.isError, text: result?.content?.[0]?.text as string, raw: r.body };
  };
  const sync = (body: unknown, key = SECRET) => req('/sync', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { req, rpc, call, sync, advance: (ms: number) => (clock += ms) };
}

console.log('server');

await test('helpers', () => {
  assert.equal(isRealDate('2026-11-23'), true);
  assert.equal(isRealDate('2026-02-30'), false);
  assert.equal(normTime('9:05'), '09:05');
  assert.equal(normTime('24:00'), null);
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
});

await test('health check, and refuses to work without a secret', async () => {
  const s = server('');
  assert.equal((await s.req('/')).status, 200);
  assert.equal((await s.req(`/mcp/${SECRET}`, { method: 'POST', body: '{}' })).status, 503);
});

await test('sync needs the key', async () => {
  const s = server();
  assert.equal((await s.sync({ snapshot }, 'wrong')).status, 401);
  assert.equal((await s.req('/sync', { method: 'GET' })).status, 405);
  assert.equal((await s.sync({ nope: 1 })).status, 400);
  const ok = await s.sync({ snapshot, handled: [] });
  assert.equal(ok.status, 200);
  assert.deepEqual((await ok.json()).inbox, []);
});

await test('MCP path needs the secret', async () => {
  const s = server();
  const res = await s.req('/mcp/not-the-secret', { method: 'POST', body: '{}' });
  assert.equal(res.status, 404);
  assert.equal((await s.req(`/mcp/${SECRET}`, { method: 'GET' })).status, 405);
});

await test('initialize negotiates the protocol version; notifications get 202', async () => {
  const s = server();
  const r = await s.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  assert.equal(r.body.result.protocolVersion, '2025-06-18');
  assert.equal(r.body.result.serverInfo.name, 'bovi');
  assert.ok(r.body.result.capabilities.tools);
  const unknown = await s.rpc('initialize', { protocolVersion: '1999-01-01' });
  assert.equal(unknown.body.result.protocolVersion, '2025-11-25');
  assert.equal((await s.rpc('notifications/initialized', undefined, null)).status, 202);
  assert.deepEqual((await s.rpc('ping')).body.result, {});
  assert.equal((await s.rpc('nope/nope')).body.error.code, -32601);
});

await test('lists 12 tools with schemas and read/add hints', async () => {
  const s = server();
  const tools = (await s.rpc('tools/list')).body.result.tools;
  assert.equal(tools.length, 12);
  for (const t of tools) {
    assert.match(t.name, /^bovi_[a-z_]+$/);
    assert.equal(t.inputSchema.type, 'object');
    assert.ok(t.description.length > 20);
  }
  assert.equal(tools.find((t: { name: string }) => t.name === 'bovi_attendance').annotations.readOnlyHint, true);
  assert.equal(tools.find((t: { name: string }) => t.name === 'bovi_add_task').annotations.readOnlyHint, false);
  assert.equal(tools.every((t: { annotations: { destructiveHint: boolean } }) => t.annotations.destructiveHint === false), true);
});

await test('read tools explain what to do before the first sync', async () => {
  const s = server();
  const r = await s.call('bovi_overview');
  assert.equal(r.error, true);
  assert.match(r.text, /Claude connector/);
});

await test('read tools answer from the synced snapshot', async () => {
  const s = server();
  await s.sync({ snapshot });
  const o = await s.call('bovi_overview');
  assert.equal(o.error, false);
  assert.match(o.text, /last synced just now/);
  const data = JSON.parse(o.text.slice(o.text.indexOf('{')));
  assert.equal(data.today, '2026-11-16');
  assert.ok(data.classesToday.length > 0);
  assert.ok(data.classesToday.every((c: { date: string }) => c.date === '2026-11-16'));
  assert.ok(data.tasks.some((t: { title: string }) => t.title === 'Return library book'));

  const att = await s.call('bovi_attendance', { subject: 'dsa' });
  const a = JSON.parse(att.text.slice(att.text.indexOf('{')));
  assert.equal(a.subjects.length, 1);
  assert.ok('canMissNow' in a.subjects[0]);
  assert.equal((await s.call('bovi_attendance', { subject: 'Basket weaving' })).error, true);

  const tt = await s.call('bovi_timetable', { from: '2026-11-17', to: '2026-11-17' });
  const t = JSON.parse(tt.text.slice(tt.text.indexOf('{')));
  assert.ok(t.classes.every((c: { date: string }) => c.date === '2026-11-17'));
  assert.equal((await s.call('bovi_timetable', { from: 'tomorrow' })).error, true);

  for (const name of ['bovi_exams', 'bovi_tasks', 'bovi_projects', 'bovi_snapshot']) assert.equal((await s.call(name)).error, false, name);
});

await test('warns when the data is old', async () => {
  const s = server();
  await s.sync({ snapshot });
  s.advance(20 * 3600_000);
  assert.match((await s.call('bovi_tasks')).text, /out of date/);
});

await test('add tools validate input', async () => {
  const s = server();
  await s.sync({ snapshot });
  assert.equal((await s.call('bovi_add_task', {})).error, true);
  assert.equal((await s.call('bovi_add_task', { title: 'x', date: '2026-13-01' })).error, true);
  assert.equal((await s.call('bovi_add_task', { title: 'x', time: '5pm' })).error, true);
  const unknown = await s.call('bovi_add_assignment', { title: 'Essay', due: '2026-11-20', subject: 'Philosophy' });
  assert.equal(unknown.error, true);
  assert.match(unknown.text, /Data Structures/);
  assert.equal((await s.call('bovi_add_exam', { series: 'IA2', date: '2026-12-01', subject: 'DSA', start: '11:00', end: '10:00' })).error, true);
  assert.equal((await s.call('bovi_add_idea', { text: '  ' })).error, true);
  assert.match((await s.call('bovi_pending')).text, /Nothing waiting/);
});

await test('additions queue up, reach the app on sync, and clear once handled', async () => {
  const s = server();
  await s.sync({ snapshot });
  assert.match((await s.call('bovi_add_task', { title: 'Viva prep', date: '2026-11-18', time: '7:30' })).text, /Queued: task "Viva prep" on 2026-11-18 at 07:30/);
  assert.equal((await s.call('bovi_add_assignment', { title: 'Lab record', due: '2026-11-20', subject: 'dsa' })).error, false);
  assert.equal((await s.call('bovi_add_exam', { series: 'IA2', date: '2026-12-01', subject: 'CS305', start: '09:30' })).error, false);
  assert.equal((await s.call('bovi_add_idea', { text: 'Train rhythm game' })).error, false);
  assert.match((await s.call('bovi_pending')).text, /4 item\(s\) waiting/);

  const first = await (await s.sync({ snapshot, handled: [] })).json();
  assert.deepEqual(first.inbox.map((i: { kind: string }) => i.kind), ['task', 'assignment', 'exam', 'idea']);
  assert.equal(first.inbox[0].time, '07:30');
  // Subject names are normalised to BOVI's own names.
  assert.equal(first.inbox[1].subject, 'Data Structures & Algorithms');
  assert.equal(first.inbox[2].subject, 'Data Structures & Algorithms');

  const second = await (await s.sync({ snapshot, handled: [first.inbox[0].id, first.inbox[1].id] })).json();
  assert.equal(second.inbox.length, 2);
  const third = await (await s.sync({ snapshot, handled: second.inbox.map((i: { id: string }) => i.id) })).json();
  assert.equal(third.inbox.length, 0);
});

await test('batch requests and unknown tools', async () => {
  const s = server();
  const res = await s.req(`/mcp/${SECRET}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify([
      { jsonrpc: '2.0', id: 1, method: 'ping' },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'bovi_nope', arguments: {} } },
    ]),
  });
  const out = await res.json();
  assert.equal(out.length, 2);
  assert.equal(out[1].error.code, -32602);
  const bad = await s.req(`/mcp/${SECRET}`, { method: 'POST', body: '{oops' });
  assert.equal(bad.status, 400);
});

console.log(`\n${passed} passed`);
