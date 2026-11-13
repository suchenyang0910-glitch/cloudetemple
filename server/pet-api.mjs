import {randomBytes, randomInt, randomUUID} from 'node:crypto';
import {clientIP, equal, hash, validateInitData} from './security.mjs';
import {draftRules, moderatePublicText} from './pet-moderation.mjs';
import {sendMail} from './mail.mjs';

const prefix = '/api/pet-garden';
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const tokenPattern = /^[a-f0-9]{64}$/;
const species = new Set(['cat', 'dog', 'rabbit', 'bird', 'other']);
const reportReasons = new Set(['abuse', 'advertising', 'impersonation', 'privacy', 'other']);
const dayFormat = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Ho_Chi_Minh'});
const mint = () => randomBytes(32).toString('hex');
const validEmail = value => /^[^\s@<>]+@[^\s@<>.]+(?:\.[^\s@<>.]+)+$/.test(value);
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

function cookie(req, name) {
  return (req.headers.cookie ?? '').split(/;\s*/).find(part => part.startsWith(name + '='))?.slice(name.length + 1);
}

function setSignedCookie(res, name, id, digest) {
  const cookie = name + '=' + id + '.' + digest(name, id);
  res.setHeader('Set-Cookie', cookie + '; Path=/api/pet-garden; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000');
}

function identify(req, settings, now, digest, verifyBound, family, input = {}) {
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
      const account = family?.userFor('telegram', hash(settings.hashSecret, user.id), '', 'Telegram');
      requireValue(account, 503, 'account_unavailable');
      return {ref: 'user:' + account.id, userId: account.id, kind: 'telegram', locale: user.language};
    } catch { reject(401, 'init_data'); }
  }
  if (scheme === 'bearer') {
    return Promise.resolve(verifyBound?.(req)).then(subject => {
      requireValue(typeof subject === 'string' && subject.length > 0 && subject.length <= 256, 401, 'identity');
      return {ref: digest('bound', subject), kind: 'bound'};
    });
  }
  const sessionToken = cookie(req, 'ct_pet_session');
  if (tokenPattern.test(sessionToken ?? '')) {
    const user = family?.sessionUser(hash(settings.hashSecret, sessionToken));
    if (user) return {ref: 'user:' + user.user_id, userId: user.user_id, kind: 'email', csrfHash: user.csrf_hash};
  }
  const browser = signedCookie(req, 'ct_pet_browser', digest);
  const claimToken = scheme === 'claim' ? supplied : browser && digest('browser-token', browser);
  requireValue(!claimToken || tokenPattern.test(claimToken), 401, 'identity');
  const claimHash = claimToken && digest('claim', claimToken);
  return {
    ref: claimHash && 'browser:' + claimHash, kind: 'browser', suppliedClaim: scheme === 'claim',
    browserClaimToken: scheme === 'claim' ? undefined : claimToken
  };
}

export function createPetApi(settings, pet, {clock = Date.now, verifyBound, verifyAdmin, approvedRules, moderation, family} = {}) {
  const digest = (scope, value) => hash(settings.hashSecret, JSON.stringify(['pet-garden', scope, value]));
  const rules = approvedRules ?? moderation?.rules ?? draftRules;
  if (!rules.version || !Object.values(rules.entries).some(entries => entries.length))
    throw Error('Missing pet moderation rules');
  const bound = (identity) => requireValue(identity.ref && identity.kind !== 'browser', 401, 'bound_identity_required');
  const owner = (row, identity) => requireValue(row?.demo === 0 && (row.owner_user_id ? row.owner_user_id === identity.userId : row.owner_ref === identity.ref), 404, 'memorial');
  const rate = (req, res, scope, identity, now, subjectLimit = 10, ipLimit = 40) => {
    const ip = digest('rate-ip', [Math.floor(now / 60000), clientIP(req, settings.trustLocal)]);
    const actor = identity.ref && digest('rate-actor', [Math.floor(now / 60000), identity.ref]);
    if (!pet.limit(scope, actor ? [ip, actor] : [ip], Math.floor(now / 60000), [ipLimit, subjectLimit])) {
      res.setHeader('Retry-After', String(60 - Math.floor(now / 1000) % 60));
      reject(429, 'rate_limit');
    }
  };
  const issuePetSession = (res, account, now) => {
    const raw = mint(), csrf = mint().slice(0, 36), max = 30 * 86400;
    family.session(hash(settings.hashSecret, raw), account.id, now + max * 1000, hash(settings.hashSecret, csrf));
    res.setHeader('Set-Cookie', `ct_pet_session=${raw}; Path=/api/pet-garden; Max-Age=${max}; HttpOnly; Secure; SameSite=Lax`);
    return csrf;
  };
  const mergeOrPrompt = (res, current, target, now, confirmed = false) => {
    const summary = pet.mineSummary(target.id);
    if (!confirmed && (summary.memorialCount || family.familyData(target.id))) {
      const mergeToken = mint();
      pet.linkStart(digest('merge', mergeToken), current.userId, 'merge', null, target.id, now + 600000);
      reject(409, 'merge_confirmation_required', {mergeToken, source: {memorialCount: summary.memorialCount, hasFamilyData: family.familyData(target.id)}});
    }
    const result = family.mergeUsers(current.userId, target.id);
    requireValue(!result.error, 409, result.error);
    const account = family.user(result.survivor);
    return {merged: true, csrf: issuePetSession(res, account, now), identityKinds: family.identityKinds(account.id)};
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
    if (method === 'POST' && area === 'auth' && id === 'email' && action === 'start' && segments.length === 3) {
      requireValue(family, 503, 'account_unavailable');
      const email = String(input.email ?? '').trim().toLowerCase();
      requireValue(validEmail(email), 400, 'email_invalid');
      const subject = hash(settings.hashSecret, email), ip = hash(settings.hashSecret, clientIP(req, settings.trustLocal));
      if (!family.rate('pet-email:' + subject, now + 60000) || !family.rate('pet-email-ip:' + ip, now + 30000)) reject(429, 'email_rate_limited');
      if (!pet.emailDailyLimit(dayFormat.format(now), settings.petEmailDailyLimit ?? 200)) reject(429, 'email_daily_limit');
      const code = String(randomInt(100000, 1000000));
      pet.saveEmailCode(subject, hash(settings.hashSecret, code), now + 600000);
      await sendMail(settings, family, {to: email, subject: 'Mã đăng nhập Vườn Thú Cưng', text: `Mã đăng nhập của bạn: ${code}. Mã có hiệu lực trong 10 phút.`, html: `<p>Mã đăng nhập của bạn: <strong>${code}</strong>.</p><p>Mã có hiệu lực trong 10 phút.</p>`});
      return ok({ok: true}, 201);
    }
    if (method === 'POST' && area === 'auth' && id === 'email' && action === 'verify' && segments.length === 3) {
      requireValue(family, 503, 'account_unavailable');
      const email = String(input.email ?? '').trim().toLowerCase(), code = String(input.code ?? '');
      requireValue(validEmail(email) && /^\d{6}$/.test(code), 400, 'email_code_invalid');
      requireValue(pet.takeEmailCode(hash(settings.hashSecret, email), hash(settings.hashSecret, code), now), 401, 'email_code_invalid');
      const account = family.userFor('email', hash(settings.hashSecret, email), email, '');
      return ok({ok: true, csrf: issuePetSession(res, account, now), identityKinds: ['email']});
    }
    const identity = await identify(req, settings, now, digest, verifyBound, family, input);
    if (!['GET', 'HEAD'].includes(method) && identity.kind === 'email')
      requireValue(typeof req.headers['x-csrf-token'] === 'string' && equal(hash(settings.hashSecret, req.headers['x-csrf-token']), identity.csrfHash), 403, 'csrf');
    if (method === 'GET' && area === 'me' && segments.length === 1)
      return ok({authenticated: Boolean(identity.userId), identityKinds: identity.userId ? family.identityKinds(identity.userId) : []});
    if (method === 'POST' && area === 'auth' && id === 'link' && action === 'email' && extra === 'start') {
      requireValue(identity.userId, 401, 'pet_login_required');
      const email = String(input.email ?? '').trim().toLowerCase();
      requireValue(validEmail(email), 400, 'email_invalid');
      const subject = hash(settings.hashSecret, email), ip = hash(settings.hashSecret, clientIP(req, settings.trustLocal));
      if (!family.rate('pet-link-email:' + subject, now + 60000) || !family.rate('pet-link-email-ip:' + ip, now + 30000)) reject(429, 'email_rate_limited');
      if (!pet.emailDailyLimit(dayFormat.format(now), settings.petEmailDailyLimit ?? 200)) reject(429, 'email_daily_limit');
      const code = String(randomInt(100000, 1000000));
      pet.saveEmailCode(subject, hash(settings.hashSecret, code), now + 600000);
      await sendMail(settings, family, {to: email, subject: 'Mã liên kết Vườn Thú Cưng', text: `Mã liên kết của bạn: ${code}. Mã có hiệu lực trong 10 phút.`, html: `<p>Mã liên kết của bạn: <strong>${code}</strong>.</p><p>Mã có hiệu lực trong 10 phút.</p>`});
      return ok({ok: true}, 201);
    }
    if (method === 'POST' && area === 'auth' && id === 'link' && action === 'email' && extra === 'verify') {
      requireValue(identity.userId, 401, 'pet_login_required');
      const email = String(input.email ?? '').trim().toLowerCase(), code = String(input.code ?? '');
      requireValue(validEmail(email) && /^\d{6}$/.test(code), 400, 'email_code_invalid');
      requireValue(pet.takeEmailCode(hash(settings.hashSecret, email), hash(settings.hashSecret, code), now), 401, 'email_code_invalid');
      const target = family.userFor('email', hash(settings.hashSecret, email), email, '');
      if (target.id === identity.userId) return ok({linked: true, identityKinds: family.identityKinds(target.id)});
      return ok(mergeOrPrompt(res, identity, target, now));
    }
    if (method === 'POST' && area === 'auth' && id === 'link' && action === 'telegram' && extra === 'start') {
      requireValue(identity.userId, 401, 'pet_login_required');
      const linkCode = mint();
      pet.linkStart(digest('telegram-link', linkCode), identity.userId, 'telegram', null, null, now + 600000);
      return ok({linkCode, expiresAt: new Date(now + 600000).toISOString(), deepLink: `https://t.me/ChuaMayBot/chuamay?startapp=pet-link-${linkCode}`}, 201);
    }
    if (method === 'POST' && area === 'auth' && id === 'link' && action === 'telegram' && extra === 'confirm') {
      requireValue(identity.kind === 'telegram' && identity.userId, 401, 'pet_login_required');
      const linkCode = String(input.linkCode ?? ''), link = tokenPattern.test(linkCode) && pet.linkPeek(digest('telegram-link', linkCode), 'telegram', now);
      requireValue(link, 400, 'link_expired');
      requireValue(link.source_user_id !== identity.userId, 403, 'link_forbidden');
      requireValue(pet.linkAssignTarget(digest('telegram-link', linkCode), identity.userId), 403, 'link_forbidden');
      return ok({pending: true});
    }
    if (method === 'POST' && area === 'auth' && id === 'link' && action === 'confirm' && segments.length === 3) {
      requireValue(identity.userId, 401, 'pet_login_required');
      const mergeToken = String(input.mergeToken ?? '');
      const linkCode = String(input.linkCode ?? '');
      const tokenHash = mergeToken ? digest('merge', mergeToken) : digest('telegram-link', linkCode);
      const kind = mergeToken ? 'merge' : 'telegram';
      requireValue(tokenPattern.test(mergeToken || linkCode), 400, 'link_expired');
      const link = pet.linkTake(tokenHash, identity.userId, kind, now);
      requireValue(link, 400, 'link_expired');
      const target = family.user(link.target_user_id);
      requireValue(target, 400, 'link_expired');
      return ok(mergeOrPrompt(res, identity, target, now, kind === 'merge'));
    }
    if (method === 'GET' && area === 'me' && id === 'claim' && segments.length === 2) {
      const claimToken = identity.browserClaimToken;
      rate(req, res, 'view-claim', claimToken ? identity : {}, now, 2, 8);
      if (!claimToken) return ok({items: []});
      const claimHash = digest('claim', claimToken);
      const items = pet.mine(identity.ref)
        .filter(row => row.identity_kind === 'browser' && row.browser_claim_hash === claimHash)
        .map(row => ({id: row.id, claimToken}));
      return ok({items});
    }
    if (method === 'GET' && area === 'mine' && segments.length === 1) {
      requireValue(identity.userId, 401, 'pet_login_required');
      return ok({items: pet.mineUser(identity.userId).map(row => ({
        ...publicFields(row), publicStatus: row.public_status, districtId: row.district_id
      }))});
    }
    if (method === 'GET' && area === 'mine' && action === 'visits' && segments.length === 3) {
      owner(uuid.test(id) && pet.find(id), identity);
      const day = query.get('day') ?? today;
      requireValue(isoDay(day) && day <= today, 400, 'day');
      return ok({date: day, ...pet.counts(id, day)});
    }
    if (method === 'GET' && area === 'memorials' && action === 'export' && segments.length === 3) {
      const row = uuid.test(id) && pet.find(id);
      owner(row, identity);
      const counts = pet.exportCounts(id);
      return ok({...publicFields(row), bornOn: row.born_on, diedOn: row.died_on,
        createdAt: new Date(row.created_at).toISOString(), publicStatus: row.public_status,
        districtId: row.district_id, ...counts, offeringCount: counts.flowers + counts.lights});
    }
    if (method === 'GET' && area === 'memorials' && action === 'private' && segments.length === 3) {
      const row = uuid.test(id) && pet.find(id);
      requireValue(row?.demo === 0 && identity.ref && pet.member(id, identity.ref), 404, 'memorial');
      return ok({...publicFields(row), bornOn: row.born_on, diedOn: row.died_on, publicStatus: row.public_status});
    }

    if (method === 'POST' && area === 'memorials' && segments.length === 1) {
      rate(req, res, 'create', identity, now, 4, 12);
      requireValue(!moderation?.isBanned(identity.ref, identity.userId), 403, 'pet_banned');
      requireValue(identity.userId && ['telegram', 'email'].includes(identity.kind), 401, 'pet_login_required');
      if (pet.mineUser(identity.userId).length) return ok({code: 'coming_soon', message: 'Sắp mở'}, 409);
      const data = memorialInput(input, today);
      const text = dataWithLocale(data, identity, input);
      if (moderation && data.status === 'visible') {
        requireValue(approvedRules, 503, 'public_creation_closed');
        const decision = moderation.check(text);
        if (decision) {
          moderation.hold(decision.category, rules.version, now);
          reject(422, 'moderation', decision);
        }
      } else if (!moderation) {
        const decision = moderatePublicText(text, rules);
        if (decision) reject(422, 'moderation', decision);
        requireValue(data.status !== 'visible' || approvedRules, 503, 'public_creation_closed');
      }

      const memorialId = randomUUID();
      if (!pet.create({...data, id: memorialId, kind: identity.kind, owner: identity.ref, userId: identity.userId,
        claimHash: null, now, ruleVersion: rules.version})) return ok({code: 'coming_soon', message: 'Sắp mở'}, 409);
      return ok({id: memorialId, publicStatus: data.status}, 201);
    }
    if (method === 'POST' && area === 'invites' && action === 'accept' && segments.length === 3) {
      bound(identity);
      rate(req, res, 'accept', identity, now);
      requireValue(tokenPattern.test(id), 404, 'invite');
      const result = pet.accept(digest('invite', id), identity.ref, identity.userId ?? null, now);
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
      requireValue(!moderation?.isBanned(identity.ref, identity.userId), 403, 'pet_banned');
      requireValue(typeof input.claimToken === 'string' && tokenPattern.test(input.claimToken) &&
        pet.claim(id, digest('claim', input.claimToken), identity.ref, identity.userId ?? null, identity.kind, now), 409, 'claim_conflict');
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
      requireValue(pet.invite(id, identity.ref, identity.userId ?? null, {id: inviteId, hash: digest('invite', token), expires, maxUses}), 404, 'memorial');
      return ok({inviteId, token, expiresAt: new Date(expires).toISOString()}, 201);
    }
    if (method === 'DELETE' && action === 'invites' && segments.length === 4) {
      rate(req, res, 'revoke', identity, now);
      owner(pet.find(id), identity);
      requireValue(uuid.test(extra) && pet.revoke(id, identity.ref, identity.userId ?? null, extra, now), 404, 'invite');
      return ok({revoked: true});
    }
    if (method === 'POST' && action === 'offerings' && segments.length === 3) {
      rate(req, res, 'offer', identity, now, 20, 60);
      rate(req, res, 'offer:' + id, identity, now, 6, 20);
      requireValue(['flower', 'light'].includes(input.kind), 400, 'offering_kind');
      // shortcut: direct clients without cookies share a daily key per IP, read the public detail first to distinguish them.
      const visitor = digest('daily-visitor', [today,
        identity.ref ?? signedCookie(req, 'ct_pet_visitor', digest) ?? clientIP(req, settings.trustLocal)]);
      const counts = pet.offer(id, today, visitor, input.kind, now, identity.ref, identity.userId ?? null);
      requireValue(counts, 404, 'memorial');
      return ok(publicCounts(counts));
    }
    if (method === 'DELETE' && segments.length === 2) {
      rate(req, res, 'delete', identity, now);
      owner(pet.find(id), identity);
      requireValue(pet.remove(id, identity.ref, identity.userId ?? null), 404, 'memorial');
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
