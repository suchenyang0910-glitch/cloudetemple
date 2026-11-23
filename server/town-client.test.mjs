import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { createTownClient } from '../town-client.js';
import { migrateTown } from './town-migrate.mjs';
import { openTownStore } from './town-store.mjs';
import { createTownApi, townPrefix } from './town-api.mjs';
import { createTownSocketServer } from './town-ws.mjs';
import { loadTownScenes } from './town-scenes.mjs';
import { hash } from './security.mjs';

const require = createRequire(import.meta.url);
const Database = require(process.env.TOWN_TEST_SQLITE_MODULE || 'better-sqlite3');
const { WebSocket, WebSocketServer } = await import(process.env.TOWN_TEST_WS_MODULE
  ? pathToFileURL(process.env.TOWN_TEST_WS_MODULE).href : './town-realtime/ws.mjs');
const origin = 'https://staging.chuamay.org';
const scenes = loadTownScenes(new URL('./town-seats.TEST.json', import.meta.url), { allowTest: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, timeout = 3000) {
  const end = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() >= end) assert.fail('Timed out waiting for client/server evidence');
    await delay(10);
  }
}

async function fixture(t, { loggedIn = false } = {}) {
  const db = new Database(':memory:');
  db.exec("CREATE TABLE users(id TEXT PRIMARY KEY, deleted_at TEXT); INSERT INTO users VALUES('synthetic-user',NULL)");
  migrateTown(db, 'staging');
  const store = openTownStore(db, 'staging');
  const settings = { environment: 'staging', origins: new Set([origin]), hashSecret: 'synthetic-only-test-secret', trustLocal: false };
  const api = createTownApi(settings, store, { family: {
    sessionUser(token) { return token === hash(settings.hashSecret, 'synthetic-session') ? { user_id: 'synthetic-user', csrf_hash: 'synthetic-csrf' } : undefined; },
  } });
  let requests = 0, mode = 'normal', connections = [], postedCsrf = [];
  const http = createServer(async (req, res) => {
    requests++;
    try {
      if (mode === 'refuse') { res.writeHead(403); res.end('{}'); return; }
      if (mode === 'bad-ticket' && req.method === 'POST') { res.end(JSON.stringify({ ticket: 'x'.repeat(43) })); return; }
      if (req.method === 'POST') postedCsrf.push(req.headers['x-csrf-token']);
      if (!await api(req, res, new URL(req.url, 'http://local').pathname)) { res.writeHead(404); res.end(); }
    } catch { res.writeHead(500); res.end(); }
  });
  http.listen(0, '127.0.0.1'); await once(http, 'listening');
  const service = createTownSocketServer({ WebSocketServer, store, scenes, origins: new Set([origin]), environment: 'staging', memory: () => 20e6 });
  service.server.listen(0, '127.0.0.1'); await once(service.server, 'listening');
  const wsUrl = `ws://127.0.0.1:${service.server.address().port}/town-ws`;
  const ticketUrl = `http://127.0.0.1:${http.address().port}${townPrefix}/ticket`;
  const nativeFetch = globalThis.fetch, cookies = new Map(), sockets = [], clients = [];
  // Node has no browser cookie jar or automatic Origin. Only the test adapter supplies them.
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const key = new URL(url).searchParams.get('client');
    const headers = new Headers(options.headers);
    headers.set('Origin', origin);
    const cookie = loggedIn ? 'ct_pet_session=synthetic-session' : cookies.get(key);
    if (cookie) headers.set('Cookie', cookie);
    const response = await nativeFetch(url, { ...options, headers });
    const updated = response.headers.get('set-cookie');
    if (updated) cookies.set(key, updated.split(';')[0]);
    return response;
  });
  t.mock.method(globalThis, 'WebSocket', function (url) {
    const socket = new WebSocket(url, { origin });
    connections.push(Date.now()); sockets.push(socket);
    socket.on('error', () => {}); // ws emits EventEmitter errors as well as browser events.
    return socket;
  });
  let stopped = false;
  const stopServer = async () => { if (!stopped) { stopped = true; await service.close(); } };
  t.after(async () => {
    clients.forEach(client => client.close()); sockets.forEach(socket => socket.terminate());
    await stopServer();
    http.closeAllConnections(); await new Promise(resolve => http.close(resolve)); db.close();
  });
  function client(id, extra = {}) {
    const events = [];
    const callbacks = Object.fromEntries(['Snapshot', 'Join', 'Gone', 'Move', 'State', 'Release', 'ClaimResult', 'Disconnect', 'Offline']
      .map(name => ['on' + name, value => events.push({ type: name, value })]));
    const instance = createTownClient({ enabled: true, ticketUrl: ticketUrl + '?client=' + id, wsUrl, scene: 'chuamay', ...callbacks, ...extra });
    clients.push(instance);
    return { instance, events, all: type => events.filter(event => event.type === type).map(event => event.value), last: type => events.findLast(event => event.type === type)?.value };
  }
  return { client, sockets, connections, stopServer, service, store, db, postedCsrf, requests: () => requests, setMode: value => mode = value };
}

test('two clients share snapshots, server names, joins, destination moves and explicit leave', async t => {
  const f = await fixture(t), a = f.client('a'), b = f.client('b');
  assert.equal(a.instance.enter(), true); await until(() => a.last('Snapshot'));
  b.instance.enter(); await until(() => b.last('Snapshot') && a.last('Join'));
  assert.equal(a.last('Snapshot').room, b.last('Snapshot').room);
  assert.equal(b.last('Snapshot').members.length, 2);
  assert.equal(a.last('Join').name, b.last('Snapshot').members.find(m => m.actor === b.last('Snapshot').self).name);
  assert.equal(a.all('Join').length, 1, 'self join is not a remote visitor');
  await delay(150);
  assert.equal(a.instance.reportPosition({ from: [0, 10.5], target: [0, 10.4] }), true);
  await until(() => b.last('Move'));
  assert.deepEqual(b.last('Move').target, [0, 10.4]);
  assert.equal(b.last('Move').actor, a.last('Snapshot').self);
  a.instance.close(); await until(() => b.last('Gone'));
  assert.equal(b.last('Gone').actor, a.last('Snapshot').self);
});

test('same seat has one winner, arrival becomes sitting and release reaches the other client', async t => {
  const f = await fixture(t), a = f.client('a'), b = f.client('b');
  a.instance.enter(); b.instance.enter(); await until(() => a.last('Snapshot') && b.last('Snapshot'));
  a.instance.claimSeat('hall-1'); b.instance.claimSeat('hall-1');
  await until(() => a.last('ClaimResult') && b.last('ClaimResult'));
  const results = [a.last('ClaimResult'), b.last('ClaimResult')];
  assert.equal(results.filter(result => result.ok).length, 1);
  assert.equal(results.find(result => !result.ok).code, 'seat_busy');
  assert.equal(results.find(result => !result.ok).nearest, 'hall-2');
  const winner = a.last('ClaimResult').ok ? a : b, other = winner === a ? b : a;
  await delay(650);
  assert(winner.instance.reportPosition({ from: [0, 10.5], target: [0, 8] }));
  await delay(900);
  assert(winner.instance.setState('sit', 60));
  await until(() => other.all('State').some(value => value.state === 'sit'));
  winner.instance.releaseSeat('hall-1'); await until(() => other.last('Release'));
  assert.equal(other.last('Release').seat, 'hall-1');
  assert.equal(other.last('Release').reason, 'stand');
  assert.equal(a.all('Disconnect').length + b.all('Disconnect').length, 0, 'business refusal is not connection refusal');
});

test('unexpected disconnect delivers one gone promptly and reconnects with a fresh snapshot', async t => {
  const f = await fixture(t), a = f.client('a'), b = f.client('b');
  a.instance.enter(); await until(() => a.last('Snapshot'));
  b.instance.enter(); await until(() => b.last('Snapshot') && a.last('Join'));
  const oldActor = a.last('Snapshot').self, started = Date.now();
  f.sockets[0].terminate();
  await until(() => b.last('Gone'));
  assert(Date.now() - started < 1000);
  assert.equal(b.last('Gone').actor, oldActor);
  await until(() => a.all('Snapshot').length === 2);
  assert.notEqual(a.last('Snapshot').self, oldActor);
  assert.equal(b.all('Gone').filter(m => m.actor === oldActor).length, 1, 'duplicate server gone is idempotent');
  assert.equal(a.all('Offline').length, 0);
});

test('movement obeys 2/s server limit, repeated/stationary targets emit nothing, hidden pages pause', async t => {
  const f = await fixture(t), a = f.client('a'); a.instance.enter(); await until(() => a.last('Snapshot'));
  await delay(100);
  assert.equal(a.instance.reportPosition(null), false);
  assert.equal(a.instance.reportPosition({ from: [0, 10.5], target: [0, 10.5] }), false);
  assert.equal(a.instance.reportPosition({ from: [0, 10.5], target: [0, 10.4] }), true);
  for (let i = 0; i < 20; i++) assert.equal(a.instance.reportPosition({ from: [0, 10.5], target: [0, 10.3] }), false);
  await delay(520);
  assert.equal(a.instance.reportPosition({ from: [0, 10.4], target: [0, 10.4] }), false);
  assert.equal(a.instance.reportPosition({ from: [0, 10.4], target: [0, 10.3] }), true);
  a.instance.setVisible(false);
  await delay(520);
  assert.equal(a.instance.reportPosition({ from: [0, 10.3], target: [0, 10.2] }), false);
  const oldSelf = a.last('Snapshot').self;
  a.instance.setVisible(true); await until(() => a.all('Snapshot').length === 2);
  assert.notEqual(a.last('Snapshot').self, oldSelf);
  assert.equal(a.last('Snapshot').scene, 'chuamay');
});

test('scene change obtains a fresh ticket/snapshot and leaves the old room', async t => {
  const f = await fixture(t), a = f.client('a'), b = f.client('b');
  a.instance.enter(); b.instance.enter(); await until(() => a.last('Snapshot') && b.last('Snapshot'));
  a.instance.enter('suoi'); await until(() => a.all('Snapshot').length === 2 && b.last('Gone'));
  assert.equal(a.last('Snapshot').scene, 'suoi');
  assert.notEqual(a.last('Snapshot').room, b.last('Snapshot').room);
});

test('default-off and explicit false never fetch or open sockets, close is terminal', async t => {
  const f = await fixture(t);
  for (const enabled of [undefined, false, 'true']) {
    const a = f.client('disabled', { enabled });
    assert.equal(a.instance.enter(), false);
    a.instance.setVisible(false); a.instance.setVisible(true);
    a.instance.claimSeat('hall-1'); a.instance.releaseSeat(); a.instance.close();
  }
  const closed = f.client('closed'); closed.instance.close();
  assert.equal(closed.instance.enter(), false);
  await delay(50);
  assert.equal(f.requests(), 0); assert.equal(f.connections.length, 0);
});

test('logged-in ticket request uses existing CSRF route without exposing account identity', async t => {
  const f = await fixture(t, { loggedIn: true }), a = f.client('account');
  a.instance.enter(); await until(() => a.last('Snapshot'));
  assert.equal(typeof f.postedCsrf[0], 'string');
  assert.equal(f.db.prepare('SELECT count(*) n FROM town_names WHERE user_id=?').get('synthetic-user').n, 1);
  assert(!JSON.stringify(a.last('Snapshot')).includes('synthetic-user'));
});

test('throwing or rejected UI callbacks do not leak exceptions or break multiplayer', async t => {
  const f = await fixture(t);
  const a = f.client('a', { onSnapshot() { throw Error('synthetic callback failure'); }, onState: async () => { throw Error('synthetic rejection'); } });
  a.instance.enter(); await until(() => f.service.core.counts().connections === 1);
  await delay(50); assert.equal(a.instance.setState('incense'), true);
  await delay(30); assert.equal(f.service.core.counts().connections, 1);
  a.instance.close();
});

test('ticket HTTP refusal retries and recovers without throwing', async t => {
  const f = await fixture(t), a = f.client('refused');
  f.setMode('refuse'); a.instance.enter(); await until(() => a.last('Disconnect'));
  assert.equal(f.connections.length, 0);
  f.setMode('normal'); await until(() => a.last('Snapshot'));
  assert.equal(a.all('Offline').length, 0);
});

test('server ticket refusal retries with a new ticket rather than treating state as ready', async t => {
  const f = await fixture(t), a = f.client('refused');
  f.setMode('bad-ticket'); a.instance.enter(); await until(() => a.last('Disconnect'));
  assert.equal(a.all('Snapshot').length, 0);
  f.setMode('normal'); await until(() => a.last('Snapshot'));
  assert.equal(f.connections.length, 2);
});

test('close during ticket work cancels late results and prevents retry/connection', async t => {
  const f = await fixture(t), a = f.client('cancel');
  a.instance.enter(); a.instance.close(); await delay(1100);
  assert.equal(f.connections.length, 0); assert.equal(a.events.length, 0);
});

test('malformed and out-of-order incoming messages fail safely and obtain new snapshots', async t => {
  const f = await fixture(t), a = f.client('invalid-frame');
  a.instance.enter(); await until(() => a.last('Snapshot'));
  assert.doesNotThrow(() => f.sockets[0].onmessage({ data: '{invalid' }));
  await until(() => a.all('Snapshot').length === 2);
  assert.doesNotThrow(() => f.sockets[1].onmessage({ data: JSON.stringify({ v: 1, seq: 999, type: 'ping' }) }));
  await until(() => a.all('Snapshot').length === 3);
  assert.equal(a.all('Disconnect').length, 2);
});

test('ticket timeout aborts stalled fetch; closing cancels its pending retry', async t => {
  const f = await fixture(t), a = f.client('timeout');
  let aborted = false, requests = 0;
  t.mock.method(globalThis, 'fetch', (_url, { signal }) => {
    requests++;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
      aborted = true; reject(Error('synthetic abort'));
    }, { once: true }));
  });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  assert.doesNotThrow(() => a.instance.enter());
  t.mock.timers.tick(10000);
  assert(aborted); assert.equal(a.last('Disconnect').retry, 1);
  a.instance.close(); t.mock.timers.tick(60000);
  await Promise.resolve();
  assert.equal(requests, 1); assert.equal(f.connections.length, 0);
  assert.equal(a.all('Offline').length, 0);
  t.mock.timers.reset();
});

test('server absent: five real-time retries at 1/2/5/10/10 seconds, one offline notice, then silence', { timeout: 40000 }, async t => {
  const f = await fixture(t), a = f.client('offline'); await f.stopServer();
  assert.doesNotThrow(() => a.instance.enter());
  await until(() => a.last('Offline'), 34000);
  assert.equal(f.connections.length, 6, 'one initial connection plus five retries');
  const expected = [1000, 2000, 5000, 10000, 10000];
  for (let i = 0; i < expected.length; i++) assert(f.connections[i + 1] - f.connections[i] >= expected[i] - 50);
  assert.deepEqual(a.all('Offline'), ['已离线']);
  const requests = f.requests();
  a.instance.setVisible(false); a.instance.setVisible(true); await delay(1100);
  assert.equal(f.requests(), requests); assert.equal(f.connections.length, 6);
  assert.equal(a.all('Offline').length, 1);
});
