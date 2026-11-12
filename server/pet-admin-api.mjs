import {createPetApi} from './pet-api.mjs';
import {openPetStore} from './pet-store.mjs';
import {openPetAdminStore} from './pet-admin-store.mjs';
import {candidateRules, checkCandidate, contactMatch} from './pet-admin-moderation-v1.mjs';
import {hash} from './security.mjs';

const prefix = '/admin/pet';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const actions = new Set(['takedown', 'restore', 'ban', 'unban', 'resolve-review', 'resolve-report']);
const json = (res, status, payload) => {
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
  res.end(JSON.stringify(payload));
  return true;
};

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({destroyOnReturn: false})) {
    size += chunk.length;
    if (size > 4096) return null;
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks)); } catch { return null; }
}

export function createPetAdminApi(settings, admin, {access, adminOrigin, clock = Date.now} = {}) {
  if (settings.adminEnabled && (!access || !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/.test(adminOrigin ?? ''))) {
    throw Error('Pet moderation requires the existing Access verifier and HTTPS admin origin');
  }
  const reads = new Map([['reviews', admin.reviews], ['reports', admin.reports],
    ['bans', admin.bans], ['takedowns', admin.takedowns]]);
  return async function handle(req, res, route) {
    if (route !== prefix && !route.startsWith(prefix + '/')) return false;
    let email;
    if (settings.adminEnabled) {
      try { email = await access.validate(req.headers['cf-access-jwt-assertion']); } catch { /* fail closed */ }
    }
    if (!email) return json(res, 403, {error: 'forbidden'});

    const path = route.slice(prefix.length + 1);
    if (req.method === 'GET' && reads.has(path)) {
      const after = new URL(req.url, 'http://localhost').searchParams.get('after') ?? '0';
      if (!/^\d{1,15}$/.test(after)) return json(res, 400, {error: 'cursor'});
      const rows = reads.get(path)(Number(after));
      return json(res, 200, {items: rows.slice(0, 50).map(({seq, ...item}) => item),
        nextCursor: rows.length > 50 ? String(rows[49].seq) : null});
    }
    if (req.method !== 'POST' || !actions.has(path)) return json(res, 404, {error: 'route'});

    const op = {actor: hash(settings.hashSecret, 'pet-admin:' + email), action: path, target: null,
      reason: null, requestId: null, now: clock()};
    const reject = (status, result) => {
      admin.audit(op, result);
      return json(res, status, {error: result});
    };
    if (req.headers.origin !== adminOrigin ||
      (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')) return reject(403, 'origin');
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) return reject(415, 'content_type');
    const input = await body(req);
    if (!input || Array.isArray(input) || typeof input !== 'object' ||
        typeof input.targetId !== 'string' || !uuid.test(input.targetId)) return reject(400, 'target');
    op.target = input.targetId.toLowerCase();
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (!reason || [...reason].length > 240 || /[\p{Cc}\p{Cf}]|\b\d{1,3}(?:\.\d{1,3}){3}\b|(?:\b[0-9a-f]{1,4}:){2,}|\beyJ[\w-]+\.[\w-]+\.[\w-]+/iu.test(reason) ||
        contactMatch(reason)) return reject(400, 'reason');
    op.reason = reason;
    if (input.confirmed !== true) return reject(400, 'confirmation');
    if (typeof input.requestId !== 'string' || !uuid.test(input.requestId)) return reject(400, 'request_id');
    op.requestId = input.requestId.toLowerCase();
    const {result, banId} = admin.change(op);
    if (result === 'ok') return json(res, 200, {ok: true, ...(banId ? {banId} : {})});
    return json(res, result === 'not_found' ? 404 : 409, {error: result});
  };
}

export function createPetModerationModule(settings, db, {access, adminOrigin, approvedRuleVersion, verifyBound, clock = Date.now} = {}) {
  if (approvedRuleVersion !== undefined && approvedRuleVersion !== candidateRules.version) {
    throw Error('Unknown approved pet moderation rule version');
  }
  const pet = openPetStore(db);
  const admin = openPetAdminStore(db);
  const handleAdmin = createPetAdminApi(settings, admin, {access, adminOrigin, clock});
  const handlePublic = createPetApi(settings, pet, {
    clock, verifyBound, approvedRules: approvedRuleVersion ? candidateRules : undefined,
    verifyAdmin: async req => {
      try { return await access.validate(req.headers['cf-access-jwt-assertion']); } catch { return false; }
    },
    moderation: {rules: candidateRules, check: checkCandidate, hold: admin.hold, isBanned: admin.isBanned}
  });
  return {pet, handleAdmin, handlePublic};
}
