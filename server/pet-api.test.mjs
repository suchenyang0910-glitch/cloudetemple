import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import {createPetApi} from './pet-api.mjs';
import {draftRules} from './pet-moderation.mjs';
import {openPetStore} from './pet-store.mjs';
import {config} from './security.mjs';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const now = Date.parse('2026-11-12T01:00:00Z');
const env = {
  HASH_SECRET: 'synthetic-pet-secret-'.repeat(3), TELEGRAM_BOT_TOKEN: 'synthetic-telegram-token',
  TELEGRAM_WEBHOOK_SECRET: 'synthetic_webhook_secret_00000000', CHUAMAY_ENV: 'staging',
  FAMILY_ALLOWLIST: 'allowed@example.invalid', ALLOWED_ORIGINS: 'https://staging.chuamay.org'
};
const data = {petName: 'Miu', speciesCode: 'cat', bornOn: '2013-06-15', diedOn: '2025-09-27', epitaph: 'Luôn nhớ em.'};

function telegram(id) {
  const fields = {auth_date: String(now / 1000), user: JSON.stringify({id, language_code: 'vi'})};
  const key = createHmac('sha256', 'WebAppData').update(env.TELEGRAM_BOT_TOKEN).digest();
  fields.hash = createHmac('sha256', key).update('auth_date=' + fields.auth_date + '\nuser=' + fields.user).digest('hex');
  return 'Telegram ' + new URLSearchParams(fields);
}

async function fixture(t, {rules = draftRules, mountFamily = false, clock = () => now} = {}) {
  const db = new Database(':memory:');
  t.after(() => db.close());
  const pet = openPetStore(db);
  const settings = config(env);
  const app = createPetApi({...settings, adminEnabled: true}, pet, {
    clock, approvedRules: rules, verifyBound: req => req.headers.authorization === 'Bearer verified' ? 'account-1' : null,
    verifyAdmin: req => req.headers.authorization === 'Bearer admin'
  });
  let family;
  if (mountFamily) {
    const {openFamilyStore} = await import('./family-store.mjs');
    const {createFamilyApi} = await import('./family-api.mjs');
    family = createFamilyApi(settings, openFamilyStore(db, {demo: false}));
  }
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (await app(req, res, path) || await family?.(req, res, path)) return;
      res.writeHead(404).end();
    } catch {
      res.writeHead(500).end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const call = async (path, {method = 'GET', body, authorization, cookie, familyRoute = false} = {}) => {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (authorization) headers.Authorization = authorization;
    if (cookie) headers.Cookie = cookie;
    if (familyRoute) headers.Origin = 'https://staging.chuamay.org';
    const r = await fetch('http://127.0.0.1:' + server.address().port + (familyRoute ? '' : '/api/pet-garden') + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await r.text();
    return {status: r.status, body: text ? JSON.parse(text) : null, headers: r.headers};
  };
  return {call, db, pet};
}

const create = (call, authorization = telegram(1), body = data) =>
  call('/memorials', {method: 'POST', body, authorization});
const base = id => '/memorials/' + id;

test('rejects unsigned Telegram credentials and keeps the first memorial free', async t => {
  const {call, db} = await fixture(t);
  assert.equal((await create(call, 'Telegram user=%7B%22id%22%3A1%7D')).status, 401);
  assert.equal((await create(call, null, {...data, initData: ''})).status, 401);
  assert.equal((await create(call)).status, 201);
  const second = await create(call);
  assert.equal(second.status, 409);
  assert.deepEqual(second.body, {code: 'coming_soon', message: 'Sắp mở'});
  assert.equal(db.prepare('SELECT count(*) AS n FROM pet_memorials').get().n, 1);
});

test('public projections hide dates and identities, private access follows invitation and revocation', async t => {
  const {call} = await fixture(t);
  const {body: {id}} = await create(call);
  const publicDetail = await call(base(id));
  assert.equal(publicDetail.status, 200);
  assert.deepEqual(Object.keys(publicDetail.body).sort(),
    ['id', 'petName', 'speciesCode', 'bornYear', 'diedYear', 'epitaph', 'rowNo', 'columnNo', 'flowers', 'lights'].sort());
  const listing = await call('/memorials?district=1');
  assert.deepEqual(listing.body.items.map(x => x.id), [id]);
  assert.equal(listing.body.items[0].bornYear, '2013');
  assert.equal(JSON.stringify(listing.body).includes('2013-06-15'), false);
  assert.equal((await call(base(id) + '/private')).status, 404);
  assert.equal((await call(base(id) + '/private', {authorization: telegram(2)})).status, 404);
  const {body: invite} = await call(base(id) + '/invites', {
    method: 'POST', authorization: telegram(1), body: {maxUses: 1, expiresAt: new Date(now + 60000).toISOString()}
  });
  const accept = '/invites/' + invite.token + '/accept';
  assert.deepEqual((await call(accept, {method: 'POST', authorization: telegram(2), body: {}})).body, {memorialId: id, role: 'invited'});
  assert.equal((await call(accept, {method: 'POST', authorization: telegram(3), body: {}})).status, 404);
  assert.equal((await call(base(id) + '/private', {authorization: telegram(2)})).body.diedOn, data.diedOn);
  assert.equal((await call(base(id) + '/invites/' + invite.inviteId, {method: 'DELETE', authorization: telegram(2)})).status, 404);
  assert.equal((await call(base(id) + '/invites/' + invite.inviteId, {method: 'DELETE', authorization: telegram(1)})).status, 200);
  assert.equal((await call(base(id) + '/private', {authorization: telegram(2)})).status, 404);
});

test('offerings are deduplicated by visitor and day, owner only receives visitor totals, rate limits apply', async t => {
  const {call} = await fixture(t);
  const {body: {id}} = await create(call);
  const offer = kind => call(base(id) + '/offerings', {method: 'POST', body: {kind}});
  const pair = await Promise.all([offer('flower'), offer('flower')]);
  for (const response of pair) assert.deepEqual(response.body, {flowers: 1, lights: 0});
  assert.deepEqual((await offer('light')).body, {flowers: 1, lights: 1});
  assert.equal((await call(base(id) + '/offerings', {method: 'POST', body: {kind: 'flower'}, authorization: telegram(1)})).body.flowers, 1);
  assert.equal((await call('/mine/' + id + '/visits')).status, 404);
  assert.deepEqual((await call('/mine/' + id + '/visits', {authorization: telegram(1)})).body,
    {date: '2026-11-12', uniqueVisitors: 1, flowers: 1, lights: 1});
  let limited;
  for (let i = 0; i < 20; i++) limited = await offer('flower');
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get('retry-after'));
});

test('signed visitor cookies distinguish browsers on one IP and deduplicate each browser', async t => {
  const {call} = await fixture(t);
  const {body: {id}} = await create(call);
  const visitor = async () => (await call(base(id))).headers.get('set-cookie').split(';')[0];
  const [first, second] = await Promise.all([visitor(), visitor()]);
  assert.notEqual(first, second);
  const flower = cookie => call(base(id) + '/offerings', {method: 'POST', cookie, body: {kind: 'flower'}});
  assert.equal((await flower(first)).body.flowers, 1);
  assert.equal((await flower(first)).body.flowers, 1);
  assert.equal((await flower(second)).body.flowers, 2);
});

test('listing returns a stable cursor and omits private memorials', async t => {
  let time = now;
  const {call} = await fixture(t, {clock: () => time});
  for (let user = 1; user <= 32; user++) {
    time += 60000;
    const payload = user === 32 ? {...data, visibility: 'private'} : data;
    assert.equal((await create(call, telegram(user), payload)).status, 201);
  }
  const page = (await call('/memorials')).body;
  assert.equal(page.items.length, 30);
  assert.equal(page.nextCursor, page.items.at(-1).id);
  const tail = (await call('/memorials?cursor=' + page.nextCursor)).body;
  assert.equal(tail.items.length, 1);
  assert.equal(tail.nextCursor, null);
  assert.equal(page.items.some(item => item.id === tail.items[0].id), false);
});

test('blocked text stays out of responses, stored memorials and consent-based analytics', async t => {
  const {call, pet, db} = await fixture(t);
  const epitaph = 'ĐỒ NGU secret-sample';
  const blocked = await create(call, telegram(2), {...data, epitaph});
  assert.equal(blocked.status, 422);
  assert.deepEqual(Object.keys(blocked.body).sort(), ['category', 'error', 'hint']);
  assert.equal(JSON.stringify(blocked.body).includes('secret-sample'), false);
  assert.equal((await call('/memorials')).body.items.length, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM pet_memorials').get().n, 0);
  const event = {visitorRef: 'f'.repeat(32), action: 'open', epitaph, browser: 'safari', source: epitaph};
  assert.equal(pet.recordAnalytics(event, now), false);
  assert.equal(pet.recordAnalytics({...event, consent: true}, now), true);
  assert.equal(db.prepare('SELECT * FROM pet_analytics_events').get().epitaph, undefined);
  assert.deepEqual(db.prepare('SELECT browser,source FROM pet_analytics_events').get(), {browser: 'safari', source: null});
  assert.equal((await call('/analytics')).status, 403);
  assert.deepEqual((await call('/analytics', {authorization: 'Bearer admin'})).body, {items: [{action: 'open', total: 1}]});
});

test('public creation remains closed until the operator supplies approved rules', async t => {
  const {call} = await fixture(t, {rules: null});
  assert.equal((await create(call)).status, 503);
  const result = await create(call, telegram(1), {...data, visibility: 'private'});
  assert.equal(result.status, 201);
  assert.equal((await call(base(result.body.id))).status, 404);
});

test('claim atomically transfers a browser memorial, unauthorized edits and deletes fail, deletion cascades', async t => {
  const {call, db} = await fixture(t);
  const created = await create(call, null);
  assert.equal(created.status, 201);
  const {id, claimToken} = created.body;
  const cookie = created.headers.get('set-cookie').split(';')[0];
  assert.match(claimToken, /^[a-f0-9]{64}$/);
  assert.equal((await call('/mine', {cookie})).body.items[0].id, id);
  assert.equal((await call('/mine', {cookie})).body.items[0].claimToken, undefined);
  assert.equal((await create((path, options) => call(path, {...options, cookie}), null)).status, 409);
  assert.notEqual(db.prepare('SELECT browser_claim_hash FROM pet_memorials').get().browser_claim_hash, claimToken);
  const claim = authorization => call(base(id) + '/claim', {method: 'POST', body: {claimToken}, authorization});
  assert.equal((await claim('Bearer bogus')).status, 401);
  const transfers = await Promise.all([claim('Bearer verified'), claim(telegram(2))]);
  assert.deepEqual(transfers.map(x => x.status).sort(), [200, 409]);
  const winner = transfers[0].status === 200 ? 'Bearer verified' : telegram(2);
  assert.equal((await call('/mine', {cookie})).body.items.length, 0);
  assert.equal((await call(base(id), {method: 'PATCH', body: {petName: 'Edited'}, authorization: telegram(3)})).status, 404);
  assert.equal((await call(base(id), {method: 'DELETE', authorization: telegram(3)})).status, 404);
  assert.equal((await call(base(id))).body.petName, 'Miu');
  assert.equal((await call('/reports', {method: 'POST', body: {memorialId: id, reasonCode: 'privacy'}})).status, 201);
  assert.equal((await call(base(id) + '/offerings', {method: 'POST', body: {kind: 'flower'}})).status, 200);
  assert.equal((await call(base(id), {method: 'DELETE', authorization: winner})).status, 200);
  assert.equal((await call(base(id))).status, 404);
  for (const table of ['pet_members', 'pet_offerings', 'pet_visits', 'pet_reports'])
    assert.equal(db.prepare('SELECT count(*) AS n FROM ' + table).get().n, 0);
});

test('pet Telegram users outside the family allowlist can create while family registration remains restricted', async t => {
  const {call} = await fixture(t, {mountFamily: true});
  assert.equal((await create(call, telegram(1))).status, 201);
  const result = await call('/family/auth/email/start', {
    method: 'POST', familyRoute: true, body: {email: 'outside@example.invalid', language: 'vi'}
  });
  assert.equal(result.status, 404);
  assert.equal(result.body.error, 'not_found');
  const familyTelegram = await call('/family/auth/telegram', {
    method: 'POST', familyRoute: true, body: {initData: telegram(1).slice('Telegram '.length)}
  });
  assert.equal(familyTelegram.status, 404);
});

test('yearly maintenance moves an inactive memorial to the wall without deleting it', async t => {
  const {call, pet} = await fixture(t);
  const {body: {id}} = await create(call);
  pet.maintain(now + 365 * 86400000, now);
  assert.equal((await call('/memorials')).body.items.length, 0);
  assert.equal((await call(base(id))).status, 200);
  assert.equal((await call('/mine', {authorization: telegram(1)})).body.items[0].publicStatus, 'wall');
  assert.equal((await call(base(id) + '/offerings', {method: 'POST', body: {kind: 'light'}})).status, 404);
});
