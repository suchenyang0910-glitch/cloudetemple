import {randomBytes, randomUUID} from 'node:crypto';
import {clientIP, equal, hash, validateInitData} from './security.mjs';
import {draftRules, moderatePublicText} from './pet-moderation.mjs';

const prefix = '/api/pet-garden';
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const tokenPattern = /^[a-f0-9]{64}$/;
const species = new Set(['cat', 'dog', 'rabbit', 'bird', 'other']);
const reportReasons = new Set(['abuse', 'advertising', 'impersonation', 'privacy', 'other']);
const dayFormat = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Ho_Chi_Minh'});
const mint = () => randomBytes(32).toString('hex');
const reject = (status, code, details) => { throw Object.assign(new Error(code), {status, details}); };
const requireValue = (condition, status, code) => { if (!condition) reject(status, code); };

function json(res, status, payload) {
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  requireValue(/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? ''), 415, 'content_type');
  const chunks = [];
  let length = 0;
  for await (const chunk of req.iterator({destroyOnReturn: false})) {
    length += chunk.length;
    requireValue(length <= 16384, 413, 'body_size');
    chunks.push(chunk);
  }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks)); } catch { reject(400, 'body'); }
  requireValue(value && typeof value === 'object' && !Array.isArray(value), 400, 'body');
  return value;
}

function isoDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(+parsed) && parsed.toISOString().slice(0, 10) === value;
}

function memorialInput(input, today) {
  const {petName, speciesCode, bornOn = null, diedOn, epitaph = '', visibility = 'public'} = input;
  requireValue(
    typeof petName === 'string' && petName.trim() && [...petName].length <= 60 &&
    species.has(speciesCode) && isoDay(diedOn) && diedOn <= today &&
    (bornOn === null || (isoDay(bornOn) && bornOn <= diedOn)) &&
    typeof epitaph === 'string' && [...epitaph].length <= 160 &&
    ['public', 'private'].includes(visibility), 400, 'memorial_fields'
  );
  return {name: petName.trim(), species: speciesCode, born: bornOn, died: diedOn, epitaph: epitaph.trim(),
    status: visibility === 'public' ? 'visible' : 'hidden'};
}

function publicFields(row) {
  return {id: row.id, petName: row.pet_name, speciesCode: row.species_code, bornYear: row.born_on?.slice(0, 4) ?? null,
    diedYear: row.died_on.slice(0, 4), epitaph: row.epitaph, rowNo: row.row_no, columnNo: row.column_no};
}

function publicCounts({flowers, lights}) {
  return {flowers, lights};
}

function isPublic(row) {
  return row?.demo === 0 && ['visible', 'wall'].includes(row.public_status);
}

function signedCookie(req, name, digest) {
  const value = (req.headers.cookie ?? '').split(/;\s*/).find(part => part.startsWith(name + '='))?.slice(name.length + 1);
  const [id, signature, extra] = value?.split('.') ?? [];
  return !extra && tokenPattern.test(id ?? '') && equal(signature, digest(name, id)) ? id : undefined;
}

function setSignedCookie(res, name, id, digest) {
  const cookie = name + '=' + id + '.' + digest(name, id);
  res.setHeader('Set-Cookie', cookie + '; Path=/api/pet-garden; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000');
}

function identify(req, settings, now, digest, verifyBound, input = {}) {
  const authorization = req.headers.authorization;
  const credential = typeof authorization === 'string' ? /^(Telegram|Claim|Bearer) (.+)$/i.exec(authorization) : null;
  requireValue(!authorization || credential, 401, 'identity');
  const scheme = credential?.[1].toLowerCase();
  const supplied = credential?.[2];
  const initData = scheme === 'telegram' ? supplied : input.initData;
  if (initData !== undefined) {
    requireValue(settings.telegramEnabled !== false && settings.token && (!credential || scheme === 'telegram'), 401, 'init_data');
    try {
      const user = validateInitData(initData, settings.token, now);
      return {ref: digest('telegram', user.id), kind: 'telegram', locale: user.language};
    } catch { reject(401, 'init_data'); }
  }
  if (scheme === 'bearer') {
    return Promise.resolve(verifyBound?.(req)).then(subject => {
      requireValue(typeof subject === 'string' && subject.length > 0 && subject.length <= 256, 401, 'identity');
      return {ref: digest('bound', subject), kind: 'bound'};
    });
  }
  const browser = signedCookie(req, 'ct_pet_browser', digest);
  const claimToken = scheme === 'claim' ? supplied : browser && digest('browser-token', browser);
  requireValue(!claimToken || tokenPattern.test(claimToken), 401, 'identity');
  const claimHash = claimToken && digest('claim', claimToken);
  return {ref: claimHash && 'browser:' + claimHash, kind: 'browser', browser, claimHash, suppliedClaim: scheme === 'claim'};
}

export function createPetApi(settings, pet, {clock = Date.now, verifyBound, verifyAdmin, approvedRules} = {}) {
  const digest = (scope, value) => hash(settings.hashSecret, JSON.stringify(['pet-garden', scope, value]));
  const rules = approvedRules ?? draftRules;
  if (!rules.version || !Object.values(rules.entries).some(entries => entries.length))
    throw Error('Missing pet moderation rules');
  const bound = (identity) => requireValue(identity.ref && identity.kind !== 'browser', 401, 'bound_identity_required');
  const owner = (row, identity) => requireValue(row?.demo === 0 && row.owner_ref === identity.ref, 404, 'memorial');
  const rate = (req, res, scope, identity, now, subjectLimit = 10, ipLimit = 40) => {
    const ip = digest('rate-ip', [Math.floor(now / 60000), clientIP(req, settings.trustLocal)]);
    const actor = identity.ref && digest('rate-actor', [Math.floor(now / 60000), identity.ref]);
    if (!pet.limit(scope, actor ? [ip, actor] : [ip], Math.floor(now / 60000), [ipLimit, subjectLimit])) {
      res.setHeader('Retry-After', String(60 - Math.floor(now / 1000) % 60));
      reject(429, 'rate_limit');
    }
  };

  async function dispatch(req, res, segments, query, now) {
    const [area, id, action, extra] = segments;
    const method = req.method;
    const today = dayFormat.format(now);
    const ok = (payload, status = 200) => json(res, status, payload);
    if (method === 'GET' && area === 'analytics' && segments.length === 1) {
      requireValue(settings.adminEnabled && await verifyAdmin?.(req), 403, 'admin');
      return ok({items: pet.analytics()});
    }
    if (method === 'GET' && area === 'memorials' && segments.length === 1) {
      const district = query.get('district') ?? '1';
      const cursor = query.get('cursor') || '';
      requireValue(/^[1-9]\d{0,8}$/.test(district) && (!cursor || uuid.test(cursor)), 400, 'pagination');
      const rows = pet.list(Number(district), cursor, 31);
      const items = rows.slice(0, 30).map(publicFields);
      return ok({items, nextCursor: rows.length > 30 ? items.at(-1).id : null});
    }
    if (method === 'GET' && area === 'memorials' && segments.length === 2) {
      const row = uuid.test(id) && pet.find(id);
      requireValue(isPublic(row), 404, 'memorial');
      if (!signedCookie(req, 'ct_pet_visitor', digest)) setSignedCookie(res, 'ct_pet_visitor', mint(), digest);
      return ok({...publicFields(row), ...publicCounts(pet.counts(id, today))});
    }

    const input = method === 'POST' ? await readBody(req) : {};
    const identity = await identify(req, settings, now, digest, verifyBound, input);
    if (method === 'GET' && area === 'mine' && segments.length === 1) {
      requireValue(identity.ref, 401, 'identity');
      return ok({items: pet.mine(identity.ref).map(row => ({
        ...publicFields(row), publicStatus: row.public_status, districtId: row.district_id
      }))});
    }
    if (method === 'GET' && area === 'mine' && action === 'visits' && segments.length === 3) {
      owner(uuid.test(id) && pet.find(id), identity);
      const day = query.get('day') ?? today;
      requireValue(isoDay(day) && day <= today, 400, 'day');
      return ok({date: day, ...pet.counts(id, day)});
    }
    if (method === 'GET' && area === 'memorials' && action === 'private' && segments.length === 3) {
      const row = uuid.test(id) && pet.find(id);
      requireValue(row?.demo === 0 && identity.ref && pet.member(id, identity.ref), 404, 'memorial');
      return ok({...publicFields(row), bornOn: row.born_on, diedOn: row.died_on, publicStatus: row.public_status});
    }

    if (method === 'POST' && area === 'memorials' && segments.length === 1) {
      rate(req, res, 'create', identity, now, 4, 12);
      if (identity.ref && pet.mine(identity.ref).length) return ok({code: 'coming_soon', message: 'Sắp mở'}, 409);
      requireValue(!identity.suppliedClaim, 401, 'identity');
      const data = memorialInput(input, today);
      const decision = moderatePublicText(dataWithLocale(data, identity, input), rules);
      if (decision) reject(422, 'moderation', decision);
      requireValue(data.status !== 'visible' || approvedRules, 503, 'public_creation_closed');

      const isBrowser = identity.kind === 'browser';
      const browser = isBrowser && (identity.browser ?? mint());
      const claimToken = isBrowser && !identity.ref && digest('browser-token', browser);
      const claimHash = identity.claimHash || (claimToken ? digest('claim', claimToken) : null);
      const memorialId = randomUUID();
      if (!pet.create({...data, id: memorialId, kind: identity.kind, owner: identity.ref || 'browser:' + claimHash,
        claimHash, now, ruleVersion: rules.version})) return ok({code: 'coming_soon', message: 'Sắp mở'}, 409);
      if (claimToken) setSignedCookie(res, 'ct_pet_browser', browser, digest);
      return ok({id: memorialId, publicStatus: data.status, ...(claimToken ? {claimToken} : {})}, 201);
    }
    if (method === 'POST' && area === 'invites' && action === 'accept' && segments.length === 3) {
      bound(identity);
      rate(req, res, 'accept', identity, now);
      requireValue(tokenPattern.test(id), 404, 'invite');
      const result = pet.accept(digest('invite', id), identity.ref, now);
      requireValue(result, 404, 'invite');
      return ok(result);
    }
    if (method === 'POST' && area === 'reports' && segments.length === 1) {
      rate(req, res, 'report', identity, now, 3, 8);
      const reportId = randomUUID();
      requireValue(uuid.test(input.memorialId) && reportReasons.has(input.reasonCode), 400, 'report_fields');
      requireValue(pet.report(reportId, input.memorialId, input.reasonCode, now), 404, 'memorial');
      return ok({accepted: true, reportId}, 201);
    }

    requireValue(area === 'memorials' && uuid.test(id), 404, 'route');
    if (method === 'POST' && action === 'claim' && segments.length === 3) {
      bound(identity);
      rate(req, res, 'claim', identity, now, 4, 12);
      requireValue(typeof input.claimToken === 'string' && tokenPattern.test(input.claimToken) &&
        pet.claim(id, digest('claim', input.claimToken), identity.ref, identity.kind, now), 409, 'claim_conflict');
      return ok({claimed: true});
    }
    if (method === 'POST' && action === 'invites' && segments.length === 3) {
      rate(req, res, 'invite', identity, now);
      owner(pet.find(id), identity);
      const {maxUses, expiresAt} = input;
      const expires = typeof expiresAt === 'string' ? Date.parse(expiresAt) : NaN;
      requireValue(Number.isInteger(maxUses) && maxUses >= 1 && maxUses <= 20 &&
        expires > now && expires <= now + 30 * 86400000, 400, 'invite_fields');
      const inviteId = randomUUID();
      const token = mint();
      requireValue(pet.invite(id, identity.ref, {id: inviteId, hash: digest('invite', token), expires, maxUses}), 404, 'memorial');
      return ok({inviteId, token, expiresAt: new Date(expires).toISOString()}, 201);
    }
    if (method === 'DELETE' && action === 'invites' && segments.length === 4) {
      rate(req, res, 'revoke', identity, now);
      owner(pet.find(id), identity);
      requireValue(uuid.test(extra) && pet.revoke(id, identity.ref, extra, now), 404, 'invite');
      return ok({revoked: true});
    }
    if (method === 'POST' && action === 'offerings' && segments.length === 3) {
      rate(req, res, 'offer', identity, now, 20, 60);
      rate(req, res, 'offer:' + id, identity, now, 6, 20);
      requireValue(['flower', 'light'].includes(input.kind), 400, 'offering_kind');
      // shortcut: direct clients without cookies share a daily key per IP, read the public detail first to distinguish them.
      const visitor = digest('daily-visitor', [today,
        identity.ref ?? signedCookie(req, 'ct_pet_visitor', digest) ?? clientIP(req, settings.trustLocal)]);
      const counts = pet.offer(id, today, visitor, input.kind, now, identity.ref);
      requireValue(counts, 404, 'memorial');
      return ok(publicCounts(counts));
    }
    if (method === 'DELETE' && segments.length === 2) {
      rate(req, res, 'delete', identity, now);
      owner(pet.find(id), identity);
      requireValue(pet.remove(id, identity.ref), 404, 'memorial');
      return ok({deleted: true});
    }
    reject(404, 'route');
  }

  return async function handlePet(req, res, route) {
    if (route !== prefix && !route.startsWith(prefix + '/')) return false;
    const query = new URL(req.url, 'http://localhost').searchParams;
    const segments = route.slice(prefix.length + 1).split('/');
    try {
      await dispatch(req, res, segments, query, clock());
    } catch (err) {
      if (!err.status) throw err;
      json(res, err.status, {error: err.message, ...err.details});
    }
    return true;
  };
}

function dataWithLocale(data, identity, input) {
  return {name: data.name, epitaph: data.epitaph, locale: identity.locale ?? input.locale};
}
