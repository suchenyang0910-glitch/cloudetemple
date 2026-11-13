import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import {auditPetOfferings} from './pet-audit-offerings.mjs';
import {migratePetOfferings} from './pet-migrate-offerings.mjs';
import {createPetApi} from './pet-api.mjs';
import {draftRules} from './pet-moderation.mjs';
import {openPetStore} from './pet-store.mjs';
import {openFamilyStore} from './family-store.mjs';
import {listOutbox} from './outbox-staging.mjs';
import {config, hash} from './security.mjs';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const now = Date.parse('2026-11-12T01:00:00Z');
const env = {
  HASH_SECRET: 'synthetic-pet-secret-'.repeat(3), TELEGRAM_BOT_TOKEN: 'synthetic-telegram-token',
  TELEGRAM_WEBHOOK_SECRET: 'synthetic_webhook_secret_00000000', CHUAMAY_ENV: 'staging',
  FAMILY_ALLOWLIST: 'allowed@example.invalid', ALLOWED_ORIGINS: 'https://staging.chuamay.org'
};
const data = {petName: 'Miu', speciesCode: 'cat', bornOn: '2013-06-15', diedOn: '2025-09-27', epitaph: 'Luôn nhớ em.'};
const storedData = {name: data.petName, species: data.speciesCode, born: data.bornOn, died: data.diedOn, epitaph: data.epitaph};

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
  const familyStore = openFamilyStore(db, {demo: false});
  const settings = config(env);
  const app = createPetApi({...settings, adminEnabled: true}, pet, {
    clock, approvedRules: rules, verifyBound: req => req.headers.authorization === 'Bearer verified' ? 'account-1' : null,
    verifyAdmin: req => req.headers.authorization === 'Bearer admin', family: familyStore
  });
  let family;
  if (mountFamily) {
    const {createFamilyApi} = await import('./family-api.mjs');
    family = createFamilyApi(settings, familyStore);
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
  const call = async (path, {method = 'GET', body, authorization, cookie, familyRoute = false, headers: extraHeaders = {}} = {}) => {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (authorization) headers.Authorization = authorization;
    if (cookie) headers.Cookie = cookie;
    if (familyRoute) headers.Origin = 'https://staging.chuamay.org';
    Object.assign(headers, extraHeaders);
    const r = await fetch('http://127.0.0.1:' + server.address().port + (familyRoute ? '' : '/api/pet-garden') + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await r.text();
    return {status: r.status, body: text ? JSON.parse(text) : null, headers: r.headers};
  };
  return {call, db, pet, familyStore};
}

const create = (call, authorization = telegram(1), body = data) =>
  call('/memorials', {method: 'POST', body, authorization});
const base = id => '/memorials/' + id;
const familyRoutes = [
  ['GET', '/family/status'], ['POST', '/family/auth/email/start'], ['POST', '/family/auth/email/verify'], ['POST', '/family/auth/telegram'],
  ['GET', '/family/session'], ['POST', '/family/logout'], ['POST', '/family/invites/info'], ['GET', '/family/calendar.ics'],
  ['GET', '/family/reminders/unsubscribe'], ['GET', '/family/presale/config'], ['POST', '/family/presale/interests'], ['POST', '/family/presale/orders'],
  ['GET', '/family/consent'], ['POST', '/family/consent'], ['POST', '/family/calendar.pdf'], ['GET', '/family/tablets'], ['POST', '/family/tablets'],
  ['PATCH', '/family/tablets/00000000-0000-4000-8000-000000000001'], ['DELETE', '/family/tablets/00000000-0000-4000-8000-000000000001'],
  ['POST', '/family/tablets/00000000-0000-4000-8000-000000000001/invites'], ['POST', '/family/tablets/00000000-0000-4000-8000-000000000001/invites/revoke'],
  ['POST', '/family/invites/accept'], ['DELETE', '/family/tablets/00000000-0000-4000-8000-000000000001/membership'], ['GET', '/family/reminders'],
  ['PUT', '/family/reminders'], ['GET', '/family/account/export'], ['DELETE', '/family/account'], ['POST', '/family/convert']
];
async function expectFamilyRejected(call, cookie) {
  for (const [method, route] of familyRoutes) {
    const result = await call(route, {method, cookie, familyRoute: true, body: method === 'GET' ? undefined : {}});
    assert.equal(result.status, 404, route);
    assert.deepEqual(result.body, {ok: false, error: 'not_found'}, route);
  }
}

test('rejects unsigned Telegram credentials and keeps the first memorial free', async t => {
  const {call, db} = await fixture(t);
  assert.equal((await create(call, 'Telegram user=%7B%22id%22%3A1%7D')).status, 401);
  assert.equal((await create(call, null, {...data, initData: ''})).status, 401);
  const unsigned = await create(call, null);
  assert.deepEqual(unsigned.body, {error: 'pet_login_required'});
  assert.equal((await create(call)).status, 201);
  const second = await create(call);
  assert.equal(second.status, 409);
  assert.deepEqual(second.body, {code: 'coming_soon', message: 'Sắp mở'});
  assert.equal(db.prepare('SELECT count(*) AS n FROM pet_memorials').get().n, 1);
});

test('signed Telegram browsing and status checks do not create an account', async t => {
  const {call, db} = await fixture(t);
  const {body: {id}} = await create(call);
  const before = db.prepare('SELECT count(*) AS n FROM users').get().n;
  assert.equal((await call(base(id), {authorization: telegram(99)})).status, 200);
  assert.deepEqual((await call('/me', {authorization: telegram(99)})).body, {authenticated: false, identityKinds: []});
  assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n, before);
  assert.equal(db.prepare('SELECT count(*) AS n FROM identities WHERE provider=?').get('telegram').n, 1);
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
  const {call, db} = await fixture(t);
  const {body: {id}} = await create(call);
  const offer = kind => call(base(id) + '/offerings', {method: 'POST', body: {kind}});
  const pair = await Promise.all([offer('flower'), offer('flower')]);
  for (const response of pair) assert.deepEqual(response.body, {flowers: 1, lights: 0});
  assert.deepEqual((await offer('light')).body, {flowers: 1, lights: 1});
  assert.equal((await call(base(id) + '/offerings', {method: 'POST', body: {kind: 'flower'}, authorization: telegram(1)})).body.flowers, 1);
  assert.equal((await call('/mine/' + id + '/visits')).status, 404);
  assert.deepEqual((await call('/mine/' + id + '/visits', {authorization: telegram(1)})).body,
    {date: '2026-11-12', uniqueVisitors: 1, flowers: 1, lights: 1});
  assert.equal(db.prepare('SELECT count(*) AS n FROM pet_visits').get().n, 2);
  assert.equal(db.prepare('SELECT count(*) AS n FROM pet_offerings').get().n, 0);
  const exported = await call(base(id) + '/export', {authorization: telegram(1)});
  assert.equal(exported.body.flowers, 1);
  assert.equal(exported.body.lights, 1);
  assert.equal(exported.body.offeringCount, 2);
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
  assert.equal(db.prepare('PRAGMA table_info(pet_analytics_events)').all().some(column => column.name === 'user_id'), false);
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

test('pet email login creates an account-scoped memorial and cannot enter family routes', async t => {
  const {call, familyStore, db} = await fixture(t, {mountFamily: true});
  assert.equal((await call('/auth/email/start', {method: 'POST', body: {email: 'outside@example.invalid'}})).status, 201);
  assert.equal(db.prepare('SELECT count(*) AS n FROM email_codes').get().n, 0);
  const code = listOutbox(familyStore.db)[0].text_body.match(/\b\d{6}\b/)[0];
  const signedIn = await call('/auth/email/verify', {method: 'POST', body: {email: 'outside@example.invalid', code}});
  assert.equal(signedIn.status, 200);
  const session = signedIn.headers.get('set-cookie').split(';')[0], {csrf} = signedIn.body;
  const user = db.prepare("SELECT user_id FROM identities WHERE provider='email'").get();
  const familyRaw = 'd'.repeat(64);
  familyStore.session(hash(env.HASH_SECRET, familyRaw), user.user_id, Date.now() + 600000, hash(env.HASH_SECRET, 'family-csrf'));
  const created = await create(call, null, {...data, visibility: 'private'});
  assert.equal(created.status, 401);
  const emailCreated = await call('/memorials', {method: 'POST', cookie: session, headers: {'X-CSRF-Token': csrf}, body: {...data, visibility: 'private'}});
  assert.equal(emailCreated.status, 201);
  assert.equal(emailCreated.body.claimToken, undefined);
  assert.ok(db.prepare('SELECT owner_user_id FROM pet_memorials WHERE id=?').get(emailCreated.body.id).owner_user_id);
  assert.equal((await call('/mine', {cookie: session})).body.items[0].id, emailCreated.body.id);
  await expectFamilyRejected(call, 'ct_session=' + familyRaw);
  assert.equal((await call('/family/status', {cookie: 'ct_session=' + session.split('=')[1], familyRoute: true})).status, 404);
  assert.equal((await call('/mine', {cookie: 'ct_pet_session=' + familyRaw})).status, 401);
});

test('confirmed cross-identity merge keeps both memorials and a single account', async t => {
  const {call, familyStore, db} = await fixture(t, {mountFamily: true});
  const email = 'merge@example.invalid';
  assert.equal((await call('/auth/email/start', {method: 'POST', body: {email}})).status, 201);
  const code = listOutbox(familyStore.db)[0].text_body.match(/\b\d{6}\b/)[0];
  const signedIn = await call('/auth/email/verify', {method: 'POST', body: {email, code}});
  const emailSession = signedIn.headers.get('set-cookie').split(';')[0];
  const emailMemorial = await call('/memorials', {method: 'POST', cookie: emailSession, headers: {'X-CSRF-Token': signedIn.body.csrf}, body: {...data, visibility: 'private'}});
  assert.equal(emailMemorial.status, 201);
  assert.equal((await create(call, telegram(11), {...data, petName: 'Milo', visibility: 'private'})).status, 201);
  assert.equal((await call('/auth/link/email/start', {method: 'POST', authorization: telegram(11), body: {email}})).status, 201);
  const linkCode = listOutbox(familyStore.db)[0].text_body.match(/\b\d{6}\b/)[0];
  const pending = await call('/auth/link/email/verify', {method: 'POST', authorization: telegram(11), body: {email, code: linkCode}});
  assert.equal(pending.status, 409);
  assert.equal(pending.body.error, 'merge_confirmation_required');
  const merged = await call('/auth/link/confirm', {method: 'POST', authorization: telegram(11), body: {mergeToken: pending.body.mergeToken, confirm: true}});
  assert.equal(merged.status, 200);
  assert.deepEqual(merged.body.identityKinds, ['email', 'telegram']);
  const mergedSession = merged.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('/mine', {cookie: mergedSession})).body.items.length, 2);
  const mergedUser = db.prepare('SELECT user_id FROM identities WHERE email=?').get(email);
  assert.ok(mergedUser?.user_id);
  const familyRaw = 'e'.repeat(64);
  familyStore.session(hash(env.HASH_SECRET, familyRaw), mergedUser.user_id, Date.now() + 600000, hash(env.HASH_SECRET, 'family-csrf'));
  await expectFamilyRejected(call, 'ct_session=' + familyRaw);
  assert.equal((await call(base(emailMemorial.body.id), {method: 'DELETE', authorization: telegram(11), body: {}})).status, 200);
  assert.equal((await call('/mine', {cookie: emailSession})).status, 401);
});

test('account merge moves pet relations and deduplicates account-attributed visits', async t => {
  const {db, familyStore, pet} = await fixture(t);
  const first = familyStore.userFor('telegram', 'telegram-a', '', 'Telegram');
  const second = familyStore.userFor('email', 'email-b', 'second@example.invalid', '');
  const a = '00000000-0000-4000-8000-000000000021', b = '00000000-0000-4000-8000-000000000022';
  assert.equal(pet.create({...storedData, id: a, kind: 'telegram', owner: 'user:' + first.id, userId: first.id, claimHash: null, now, ruleVersion: draftRules.version, status: 'visible'}), true);
  assert.equal(pet.create({...storedData, id: b, kind: 'email', owner: 'user:' + second.id, userId: second.id, claimHash: null, now, ruleVersion: draftRules.version, status: 'visible'}), true);
  pet.offer(a, '2026-11-12', 'visit-a', 'flower', now, 'user:visitor', first.id);
  pet.offer(a, '2026-11-12', 'visit-b', 'flower', now, 'user:visitor', second.id);
  db.prepare('INSERT INTO pet_consents VALUES(?,?)').run(first.id, now - 1);
  db.prepare('INSERT INTO pet_consents VALUES(?,?)').run(second.id, now);
  assert.deepEqual(familyStore.mergeUsers(first.id, second.id), {survivor: first.id});
  assert.equal(pet.mineUser(first.id).length, 2);
  assert.equal(db.prepare('SELECT count(*) AS n FROM pet_visits WHERE user_id=?').get(first.id).n, 1);
  assert.equal(db.prepare('SELECT accepted_at FROM pet_consents WHERE user_id=?').get(first.id).accepted_at, now);
  assert.equal(pet.invite(b, 'user:' + first.id, first.id, {id: '00000000-0000-4000-8000-000000000023', hash: 'c'.repeat(64), expires: now + 60000, maxUses: 1}), true);
});

test('merging two accounts with family data is rejected without changing identities', async t => {
  const {familyStore} = await fixture(t);
  const first = familyStore.userFor('telegram', 'telegram-family-a', '', 'Telegram');
  const second = familyStore.userFor('email', 'email-family-b', 'family@example.invalid', '');
  familyStore.acceptConsent(first.id, 'test');
  familyStore.acceptConsent(second.id, 'test');
  assert.deepEqual(familyStore.mergeUsers(first.id, second.id), {error: 'family_merge_conflict'});
  assert.equal(familyStore.user(first.id).id, first.id);
  assert.equal(familyStore.user(second.id).id, second.id);
});

test('pet email verification limits resend attempts and leaves legacy claim routes transitional', async t => {
  const {call} = await fixture(t);
  assert.equal((await call('/auth/email/start', {method: 'POST', body: {email: 'rate@example.invalid'}})).status, 201);
  const limited = await call('/auth/email/start', {method: 'POST', body: {email: 'rate@example.invalid'}});
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error, 'email_rate_limited');
  assert.deepEqual((await call('/me/claim')).body, {items: []});
});

test('unverified email submitted for Telegram linking is not stored as an identity', async t => {
  const {call, db} = await fixture(t);
  assert.equal((await create(call, telegram(77), {...data, visibility: 'private'})).status, 201);
  const email = 'unverified@example.invalid';
  assert.equal((await call('/auth/link/email/start', {method: 'POST', authorization: telegram(77), body: {email}})).status, 201);
  assert.equal(db.prepare('SELECT count(*) AS n FROM identities WHERE email=?').get(email).n, 0);
});

test('pet Telegram users outside the family allowlist stay rejected by every family route', async t => {
  const {call, familyStore} = await fixture(t, {mountFamily: true});
  assert.equal((await create(call, telegram(1))).status, 201);
  const user = familyStore.db.prepare("SELECT user_id FROM identities WHERE provider='telegram'").get();
  const raw = 'a'.repeat(64);
  familyStore.session(hash(env.HASH_SECRET, raw), user.user_id, Date.now() + 600000, hash(env.HASH_SECRET, 'csrf'));
  await expectFamilyRejected(call, 'ct_session=' + raw);
});

test('legacy browser memorials remain claimable but new memorials do not use claim tokens', async t => {
  const {call, pet} = await fixture(t);
  const browser = 'b'.repeat(64);
  const digest = (scope, value) => hash(env.HASH_SECRET, JSON.stringify(['pet-garden', scope, value]));
  const claimToken = digest('browser-token', browser);
  const claimHash = digest('claim', claimToken);
  const id = '00000000-0000-4000-8000-000000000007';
  assert.equal(pet.create({...storedData, id, kind: 'browser', owner: 'browser:' + claimHash, userId: null, claimHash, now, ruleVersion: draftRules.version, status: 'hidden'}), true);
  const cookie = 'ct_pet_browser=' + browser + '.' + digest('ct_pet_browser', browser);
  assert.deepEqual((await call('/me/claim', {cookie})).body, {items: [{id, claimToken}]});
  assert.deepEqual((await call(base(id) + '/claim', {method: 'POST', authorization: telegram(7), body: {claimToken}})).body, {claimed: true});
  assert.equal((await call('/me/claim', {cookie})).body.items.length, 0);
  assert.equal((await call('/mine', {authorization: telegram(7)})).body.items[0].id, id);
});

test('yearly maintenance moves an inactive memorial to the wall without deleting it', async t => {
  const {call, pet, db} = await fixture(t);
  const {body: {id}} = await create(call);
  const dayMs = 86400000;
  db.prepare('UPDATE pet_memorials SET created_at=? WHERE id=?').run(now - 366 * dayMs, id);
  assert.equal((await call(base(id))).status, 200);
  assert.equal((await call(base(id) + '/offerings', {
    method: 'POST', body: {kind: 'flower'}, authorization: telegram(1)
  })).body.flowers, 0);
  assert.equal(pet.find(id).last_qualifying_visit_at, null);
  pet.limit('test', ['old'], Math.floor(now / 60000) - 1, [1]);
  const activeBucket = Math.floor(now / 60000);
  const result = pet.maintain(now, now - 365 * dayMs);
  assert.deepEqual(result, {movedToWall: 1, clearedRates: 1});
  assert.ok(db.prepare('SELECT 1 FROM pet_rates WHERE bucket=?').get(activeBucket));
  assert.equal((await call('/memorials')).body.items.length, 0);
  assert.equal((await call(base(id))).status, 200);
  assert.equal((await call('/mine', {authorization: telegram(1)})).body.items[0].publicStatus, 'wall');
  assert.equal((await call(base(id) + '/offerings', {method: 'POST', body: {kind: 'light'}})).status, 404);
});

test('only the owner can export a hidden memorial, with no identities or hashes', async t => {
  const {call} = await fixture(t);
  const {body: {id}} = await create(call, telegram(1), {...data, visibility: 'private'});
  const {body: invite} = await call(base(id) + '/invites', {
    method: 'POST', authorization: telegram(1), body: {maxUses: 1, expiresAt: new Date(now + 60000).toISOString()}
  });
  assert.equal((await call('/invites/' + invite.token + '/accept', {
    method: 'POST', authorization: telegram(2), body: {}
  })).status, 200);
  for (const authorization of [undefined, telegram(2), telegram(3)]) {
    assert.equal((await call(base(id) + '/export', {authorization})).status, 404);
  }
  const exported = await call(base(id) + '/export', {authorization: telegram(1)});
  assert.equal(exported.status, 200);
  assert.equal(exported.headers.get('cache-control'), 'no-store');
  assert.deepEqual(exported.body, {
    id, ...data, bornYear: '2013', diedYear: '2025', rowNo: 1, columnNo: 1, districtId: 1,
    publicStatus: 'hidden', createdAt: new Date(now).toISOString(),
    inviteCount: 1, memberCount: 2, flowers: 0, lights: 0, offeringCount: 0
  });
});

test('legacy offering migration preserves counts and wall eligibility, and refuses unmatched facts', async t => {
  const {call, db, pet} = await fixture(t);
  const {body: {id}} = await create(call);
  const {body: {id: inactiveId}} = await create(call, telegram(2));
  const dayMs = 86400000;
  const day = '2026-11-12';
  const insertLegacy = db.prepare('INSERT INTO pet_offerings(memorial_id,day,visitor_ref,kind,demo) VALUES (?,?,?,?,0)');
  const insertVisit = db.prepare('INSERT INTO pet_visits(memorial_id,day,visitor_ref,kind,created_at) VALUES (?,?,?,?,?)');
  db.prepare('UPDATE pet_memorials SET created_at=? WHERE id IN (?,?)').run(now - 366 * dayMs, id, inactiveId);
  db.prepare('UPDATE pet_memorials SET last_qualifying_visit_at=? WHERE id=?').run(now, id);
  for (const [visitor, kind] of [['a', 'flower'], ['a', 'light'], ['b', 'flower']]) {
    insertLegacy.run(id, day, visitor, kind);
    insertVisit.run(id, day, visitor, kind, now);
  }
  insertVisit.run(id, '2026-11-11', 'a', 'flower', now - dayMs);
  const projected = async () => [
    (await call(base(id))).body,
    (await call('/mine/' + id + '/visits', {authorization: telegram(1)})).body,
    (await call(base(id) + '/export', {authorization: telegram(1)})).body,
    pet.find(id).last_qualifying_visit_at
  ];
  const before = await projected();
  assert.equal(before[2].offeringCount, 4);
  insertLegacy.run(id, day, 'unmatched', 'light');
  assert.equal(auditPetOfferings(db, now).unmatchedRows, 1);
  assert.throws(() => migratePetOfferings(db), /audit failed/);
  assert.equal(db.prepare('SELECT count(*) AS n FROM pet_offerings').get().n, 4);
  db.prepare("DELETE FROM pet_offerings WHERE visitor_ref='unmatched'").run();
  assert.deepEqual(auditPetOfferings(db, now), {
    legacyRows: 3, rowsToDelete: 3, unmatchedRows: 0, changedDailyTotals: 0,
    wallEligibleBefore: 1, wallEligibleAfter: 1
  });
  assert.deepEqual(migratePetOfferings(db), {deleted: 3});
  assert.deepEqual(await projected(), before);
  assert.deepEqual(migratePetOfferings(db), {deleted: 0});
  assert.equal(pet.maintain(now, now - 365 * dayMs).movedToWall, 1);
  assert.equal(pet.find(id).public_status, 'visible');
  assert.equal(pet.find(inactiveId).public_status, 'wall');
});
