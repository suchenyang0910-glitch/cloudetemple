import assert from 'node:assert/strict';
import {createHmac, generateKeyPairSync, randomUUID, sign} from 'node:crypto';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import {createAccessVerifier} from './access-auth.mjs';
import {createFamilyApi} from './family-api.mjs';
import {openFamilyStore} from './family-store.mjs';
import {listOutbox} from './outbox-staging.mjs';
import {createPetModerationModule} from './pet-admin-api.mjs';
import {candidateRules, checkCandidate} from './pet-admin-moderation-v1.mjs';
import {config} from './security.mjs';

const Database = createRequire(import.meta.url)('better-sqlite3');
const adminOrigin = 'https://admin.example.invalid';
const email = 'reviewer@example.invalid';
const familyEmail = 'pet-owner@example.invalid';
const team = 'test-team.cloudflareaccess.com';
const audience = 'audience_12345678';
const now = Date.now();
const env = {
  HASH_SECRET: 'synthetic-p24-secret-'.repeat(3), TELEGRAM_BOT_TOKEN: 'synthetic-p24-telegram',
  TELEGRAM_WEBHOOK_SECRET: 'synthetic_webhook_secret_00000000', CHUAMAY_ENV: 'staging',
  FAMILY_ENABLED: '1', FAMILY_ALLOWLIST: familyEmail, MAIL_PROVIDER: 'outbox', ALLOWED_ORIGINS: 'https://staging.chuamay.org',
  ADMIN_ENABLED: '1', ADMIN_EMAILS: email, CF_ACCESS_TEAM_DOMAIN: team, CF_ACCESS_AUD: audience
};
const {privateKey, publicKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
const jwk = {...publicKey.export({format: 'jwk'}), kid: 'test-key'};
const encode = v => Buffer.from(JSON.stringify(v)).toString('base64url');
function jwt(patch = {}) {
  const header = encode({alg: 'RS256', kid: jwk.kid});
  const claims = encode({iss: 'https://' + team, aud: [audience], email, type: 'app', exp: now / 1000 + 300, ...patch});
  const input = header + '.' + claims;
  return input + '.' + sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url');
}
const signed = jwt();
const base = '/api/pet-garden';
const panel = '/admin/pet';
const data = {petName: 'Miu', speciesCode: 'cat', diedOn: '2025-09-27', epitaph: 'Luôn nhớ em.'};

function telegram(id) {
  const fields = {auth_date: String(Math.floor(now / 1000)), user: JSON.stringify({id, language_code: 'vi'})};
  const key = createHmac('sha256', 'WebAppData').update(env.TELEGRAM_BOT_TOKEN).digest();
  fields.hash = createHmac('sha256', key).update('auth_date=' + fields.auth_date + '\nuser=' + fields.user).digest('hex');
  return new URLSearchParams(fields).toString();
}

async function fixture(t, {approved = true, enabled = true} = {}) {
  const db = new Database(':memory:');
  const settings = config({...env, ADMIN_ENABLED: enabled ? '1' : '0'});
  const access = createAccessVerifier(settings, async () => Response.json({keys: [jwk]}), () => now);
  const familyStore = openFamilyStore(db, {demo: false});
  const {handleAdmin, handlePublic, pet} = createPetModerationModule(settings, db,
    {access, adminOrigin, approvedRuleVersion: approved ? candidateRules.version : undefined, clock: () => now,
      verifyBound: req => req.headers.authorization === 'Bearer synthetic-bound' ? familyEmail : null, family: familyStore});
  const family = createFamilyApi(settings, familyStore);
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    try {
      if (!await handleAdmin(req, res, path) && !await handlePublic(req, res, path) &&
          !await family(req, res, path)) res.writeHead(404).end();
    } catch { res.writeHead(500).end(); }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
  const request = async (path, {body, headers, method = body === undefined ? 'GET' : 'POST'} = {}) => {
    const r = await fetch('http://127.0.0.1:' + server.address().port + path, {
      method, body: body === undefined ? undefined : JSON.stringify(body),
      headers: {...(body === undefined ? {} : {'Content-Type': 'application/json'}), ...headers}
    });
    const raw = await r.text();
    return {status: r.status, body: raw ? JSON.parse(raw) : null};
  };
  const admin = (path, body, extraHeaders) => request(panel + '/' + path,
    {body, headers: {Origin: adminOrigin, 'Cf-Access-Jwt-Assertion': signed, ...extraHeaders}});
  const write = (action, targetId, patch = {}, headers) =>
    admin(action, {targetId, reason: 'Reviewed against the garden policy.', confirmed: true, requestId: randomUUID(), ...patch}, headers);
  const create = (id = 101, patch = {}) => request(base + '/memorials',
    {body: {...data, ...patch}, headers: {Authorization: 'Telegram ' + telegram(id)}});
  return {db, pet, request, admin, write, create};
}

test('P24 matcher accepts 60 pet names and ordinary memorial text', () => {
  const names = ['Mít','Bơ','Lu','Mực','Kiki','Cún','Miu','Bông','Mèo','Xù','Bánh Bao','Sữa','Mỡ','Nếp','Đậu',
    'Gạo','Vừng','Bắp','Su Su','Sóc','Tí','Tèo','Bé Na','Kem','Bí Đỏ','Cà Rốt','Khoai','Hạt Dẻ','Đốm','Mun',
    'Vàng','Cam','Mè','Nâu','Cốm','Chíp','Mochi','Luna','Coco','Milo','Buddy','Bella','Max','Daisy','Lucy',
    'Charlie','Oliver','Oscar','Poppy','Molly','Oreo','Peanut','Cookie','Panda','Teddy','Pip','Gigi','Sky','Loki','Biscuit'];
  assert.equal(new Set(names).size, 60);
  for (const name of names) for (const variant of [name, name.normalize('NFD'), name.normalize('NFD').replace(/\p{M}/gu, '')]) {
    assert.equal(checkCandidate({name: variant, epitaph: 'Nhớ em. Hẹn gặp lại nơi cầu vồng.'}), null, variant);
  }
  assert.equal(checkCandidate({name: 'Cún', epitaph: '02.09.2025 – Always in our hearts.'}), null);
});

test('P24 matcher covers six bilingual categories, obfuscation and common contact forms', () => {
  const fixtures = {
    abuse: ['đồ ngu', 'd o n g u', 'd.0 n-g.u', 'f-u c_k', 'ＦＵＣＫ', 'b!tch'],
    sexual: ['phim khiêu dâm', 'phim khieu dam', 'p0rn v1d30', 's€x ch@t'],
    advertising: ['mã giảm giá', 'ma giam gia', 'buy now', 'buy n0w'],
    impersonation: ['quản trị viên chính thức', 'quan tri vien chinh thuc', '0fficial @dmin'],
    hate: ['tiêu diệt người do thái', 'tieu diet nguoi do thai', 'wh1te p0wer'],
    contact: ['kết bạn zalo', 'add me on telegram', 'm@example.invalid', 'm (at) example (dot) com',
      't . me / something', 'https://example.invalid/a', '0912 345 678', '+84 (912) 345-678', '@example_user']
  };
  for (const [category, phrases] of Object.entries(fixtures)) for (const epitaph of phrases) {
    assert.equal(checkCandidate({name: 'Cún', epitaph, locale: 'en'})?.category, category, epitaph);
  }
});

test('admin routes fail closed on missing, fake, wrong-audience or non-allowlisted Access identity', async t => {
  const {request, admin} = await fixture(t);
  for (const path of ['reviews', 'reports', 'bans', 'takedowns', 'takedown', 'restore', 'ban', 'unban',
    'resolve-review', 'resolve-report', 'unknown']) {
    assert.equal((await request(panel + '/' + path)).status, 403);
    assert.equal((await request(panel + '/' + path, {body: {}})).status, 403);
  }
  assert.equal((await request(panel + '/reviews', {headers: {'Cf-Access-Authenticated-User-Email': email}})).status, 403);
  const broken = signed.split('.');
  broken[2] = (broken[2][0] === 'A' ? 'B' : 'A') + broken[2].slice(1);
  for (const token of [broken.join('.'), jwt({aud: ['wrong']}), jwt({email: 'other@example.invalid'})]) {
    assert.equal((await admin('reviews', undefined, {'Cf-Access-Jwt-Assertion': token})).status, 403);
  }
  assert.equal((await admin('reviews')).status, 200);
  const disabled = await fixture(t, {enabled: false});
  assert.equal((await disabled.admin('reviews')).status, 403);
});

test('public creation stays closed without approval; only approved public submissions enter review without raw text', async t => {
  const closed = await fixture(t, {approved: false});
  assert.equal((await closed.create()).status, 503);
  assert.equal((await closed.create(102, {epitaph: 'buy now'})).status, 503);
  assert.deepEqual((await closed.admin('reviews')).body.items, []);

  const {db, create, admin, write} = await fixture(t);
  const blocked = await create(101, {epitaph: 'buy n0w'});
  assert.equal(blocked.status, 422);
  assert(!JSON.stringify(blocked.body).includes('buy n0w'));
  assert.equal((await create(102, {visibility: 'private', epitaph: 'buy n0w'})).status, 201);
  assert.equal(db.prepare("SELECT count(*) AS n FROM pet_memorials WHERE public_status='visible'").get().n, 0);
  const {items} = (await admin('reviews')).body;
  assert.equal(items.length, 1);
  assert.deepEqual(Object.keys(items[0]).sort(), ['category', 'createdAt', 'id', 'ruleVersion']);
  assert.equal(items[0].category, 'advertising');
  assert.equal(items[0].ruleVersion, candidateRules.version);
  assert.equal((await write('resolve-review', items[0].id)).status, 200);
  assert.deepEqual((await admin('reviews')).body.items, []);
});

test('reports redact private content; audited takedown hides list, detail and offering immediately and restores prior status', async t => {
  const {db, create, request, admin, write} = await fixture(t);
  const {body: {id}} = await create();
  const {body: {id: privateId}} = await create(102, {visibility: 'private', epitaph: 'private example'});
  const path = base + '/memorials/' + id;
  const report = (await request(base + '/reports', {body: {memorialId: id, reasonCode: 'abuse'}})).body.reportId;
  assert.equal((await request(base + '/reports', {body: {memorialId: privateId, reasonCode: 'privacy'}})).status, 404);
  assert.equal((await admin('reports')).body.items[0].epitaph, data.epitaph);
  assert.equal((await write('restore', privateId)).status, 404);
  for (const action of ['takedown', 'restore', 'ban', 'unban', 'resolve-review', 'resolve-report']) {
    assert.equal((await write(action, id, {reason: undefined})).status, 400);
  }
  assert.equal((await write('takedown', id, {reason: 'person@example.invalid'})).status, 400);
  assert.equal((await write('takedown', id, {confirmed: false})).status, 400);
  assert.equal((await write('takedown', id, {}, {Origin: 'https://wrong.example.invalid'})).status, 403);
  assert.equal((await request(path)).status, 200);

  db.exec("CREATE TRIGGER pet_test_audit_unavailable BEFORE INSERT ON pet_admin_audit WHEN NEW.result='ok' BEGIN SELECT RAISE(ABORT,'test'); END");
  assert.equal((await write('takedown', id)).status, 500);
  assert.equal((await request(path)).status, 200);
  assert.deepEqual((await admin('takedowns')).body.items, []);
  db.exec('DROP TRIGGER pet_test_audit_unavailable');

  const requestId = randomUUID();
  assert.equal((await write('takedown', id, {requestId})).status, 200);
  assert.equal((await write('takedown', id, {requestId})).status, 409);
  assert.equal((await request(path)).status, 404);
  assert.deepEqual((await request(base + '/memorials')).body.items, []);
  assert.equal((await request(path + '/offerings', {body: {kind: 'flower'}})).status, 404);
  assert.equal((await admin('takedowns')).body.items[0].id, id);
  assert.equal((await admin('reports')).body.items[0].epitaph, null);
  assert.equal((await write('resolve-report', report)).status, 200);
  assert.deepEqual((await admin('reports')).body.items, []);
  assert.equal((await write('restore', id)).status, 200);
  assert.equal((await request(path)).status, 200);

  const audit = db.prepare('SELECT * FROM pet_admin_audit ORDER BY rowid').all();
  assert.equal(audit.filter(row => row.result === 'ok').length, 3);
  assert.equal(audit.filter(row => row.result === 'reason' && row.reason === null).length, 7);
  assert(!JSON.stringify(audit).includes(email));
  assert(!JSON.stringify(audit).includes('person@example.invalid'));
  assert.throws(() => db.exec("UPDATE pet_admin_audit SET reason='overwrite'"), /append-only/);
  assert.throws(() => db.exec('DELETE FROM pet_admin_audit'), /append-only/);
  assert.throws(() => db.exec('INSERT OR REPLACE INTO pet_admin_audit SELECT * FROM pet_admin_audit LIMIT 1'), /append-only/);
  assert.throws(() => db.prepare("INSERT OR REPLACE INTO pet_admin_audit SELECT ?,actor_ref,action,target_id,reason,result,request_id,created_at FROM pet_admin_audit WHERE request_id=?")
    .run(randomUUID(), requestId), /append-only/);
});

test('ban prevents new pet memorials after owner deletion; unban restores creation and the same account can still sign into family', async t => {
  const {db, request, admin, write} = await fixture(t);
  const auth = {Authorization: 'Telegram ' + telegram(101)};
  const create = () => request(base + '/memorials', {body: data, headers: auth});
  const {body: {id}} = await create();
  const {body: {banId}} = await write('ban', id);
  assert.equal((await admin('bans')).body.items[0].id, banId);
  assert.equal((await request(base + '/memorials/' + id, {method: 'DELETE', headers: auth})).status, 200);
  const denied = await create();
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error, 'pet_banned');

  const headers = {Origin: 'https://staging.chuamay.org'};
  assert.equal((await request('/family/auth/email/start', {body: {email: familyEmail}, headers})).status, 201);
  const code = listOutbox(db)[0].text_body.match(/\b\d{6}\b/)[0];
  assert.equal((await request('/family/auth/email/verify', {body: {email: familyEmail, code}, headers})).status, 200);
  assert.equal((await request('/family/auth/email/start', {body: {email: 'outside@example.invalid'}, headers})).status, 404);

  assert.equal((await write('unban', banId)).status, 200);
  assert.equal((await create()).status, 201);
});
