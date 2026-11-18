const analyticsDimensions = {
  browser: ['chrome', 'safari', 'firefox', 'edge', 'other'],
  os: ['android', 'ios', 'windows', 'macos', 'linux', 'other'],
  device: ['phone', 'tablet', 'desktop', 'other'],
  screen: ['small', 'medium', 'large'],
  language: ['vi', 'en', 'other'],
  source: ['direct', 'telegram', 'share', 'other'],
  page: ['garden', 'memorial', 'mine']
};

export function openPetStore(db) {
  db.pragma('foreign_keys = ON');
  db.exec(
    "CREATE TABLE IF NOT EXISTS pet_memorials (" +
    "id TEXT PRIMARY KEY, owner_ref TEXT NOT NULL UNIQUE, identity_kind TEXT NOT NULL, browser_claim_hash TEXT UNIQUE," +
    "pet_name TEXT NOT NULL, species_code TEXT NOT NULL, born_on TEXT, died_on TEXT NOT NULL, epitaph TEXT NOT NULL," +
    "public_status TEXT NOT NULL CHECK(public_status IN ('visible','hidden','wall')), moderation_status TEXT NOT NULL," +
    "moderation_rule_version TEXT NOT NULL, moderation_reason_code TEXT, district_id INTEGER NOT NULL," +
    "row_no INTEGER NOT NULL, column_no INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL," +
    "last_qualifying_visit_at INTEGER, wall_at INTEGER, demo INTEGER NOT NULL DEFAULT 0);" +
    "CREATE UNIQUE INDEX IF NOT EXISTS pet_slots ON pet_memorials(district_id,row_no,column_no) WHERE wall_at IS NULL;" +
    "CREATE TABLE IF NOT EXISTS pet_invites (" +
    "id TEXT PRIMARY KEY, memorial_id TEXT NOT NULL REFERENCES pet_memorials(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE," +
    "created_by TEXT NOT NULL, expires_at INTEGER NOT NULL, max_uses INTEGER NOT NULL, uses INTEGER NOT NULL DEFAULT 0, revoked_at INTEGER);" +
    "CREATE TABLE IF NOT EXISTS pet_members (" +
    "memorial_id TEXT NOT NULL REFERENCES pet_memorials(id) ON DELETE CASCADE, principal_ref TEXT NOT NULL, role TEXT NOT NULL," +
    "invite_id TEXT REFERENCES pet_invites(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, revoked_at INTEGER," +
    "PRIMARY KEY(memorial_id,principal_ref));" +
    "CREATE TABLE IF NOT EXISTS pet_offerings (" +
    "memorial_id TEXT NOT NULL REFERENCES pet_memorials(id) ON DELETE CASCADE, day TEXT NOT NULL, visitor_ref TEXT NOT NULL," +
    "kind TEXT NOT NULL CHECK(kind IN ('flower','light')), demo INTEGER NOT NULL DEFAULT 0," +
    "PRIMARY KEY(memorial_id,day,visitor_ref,kind));" +
    "CREATE TABLE IF NOT EXISTS pet_visits (" +
    "memorial_id TEXT NOT NULL REFERENCES pet_memorials(id) ON DELETE CASCADE, day TEXT NOT NULL, visitor_ref TEXT NOT NULL," +
    "kind TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(memorial_id,day,visitor_ref,kind));" +
    "CREATE TABLE IF NOT EXISTS pet_rates (" +
    "scope TEXT NOT NULL, subject_ref TEXT NOT NULL, bucket INTEGER NOT NULL, hits INTEGER NOT NULL," +
    "PRIMARY KEY(scope,subject_ref,bucket));" +
    "CREATE TABLE IF NOT EXISTS pet_reports (" +
    "id TEXT PRIMARY KEY, memorial_id TEXT NOT NULL REFERENCES pet_memorials(id) ON DELETE CASCADE," +
    "reason_code TEXT NOT NULL, created_at INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS pet_analytics_events (" +
    "visitor_ref TEXT NOT NULL, action TEXT NOT NULL, created_at INTEGER NOT NULL," +
    "browser TEXT, os TEXT, device TEXT, screen TEXT, language TEXT, source TEXT, page TEXT);"
  );
  for (const [table, column] of [
    ['pet_memorials', 'owner_user_id TEXT'], ['pet_members', 'user_id TEXT'],
    ['pet_invites', 'created_by_user_id TEXT'], ['pet_offerings', 'user_id TEXT'],
    ['pet_visits', 'user_id TEXT']
  ]) {
    if (!db.prepare(`PRAGMA table_info(${table})`).all().some(item => item.name === column.split(' ')[0]))
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column}`);
  }
  db.exec(
    "CREATE INDEX IF NOT EXISTS pet_memorials_owner_user ON pet_memorials(owner_user_id) WHERE owner_user_id IS NOT NULL;" +
    "CREATE INDEX IF NOT EXISTS pet_members_user ON pet_members(user_id) WHERE user_id IS NOT NULL;" +
    "CREATE TABLE IF NOT EXISTS pet_email_daily (day TEXT PRIMARY KEY, sent INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS pet_email_codes (subject TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);" +
    "CREATE TABLE IF NOT EXISTS pet_consents (user_id TEXT PRIMARY KEY, accepted_at INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS pet_link_tokens (token_hash TEXT PRIMARY KEY, source_user_id TEXT NOT NULL, kind TEXT NOT NULL, target_email TEXT, target_user_id TEXT, expires_at INTEGER NOT NULL, used_at INTEGER);"
  );
  if (!db.prepare("PRAGMA table_info(pet_link_tokens)").all().some(item => item.name === 'target_user_id'))
    db.exec("ALTER TABLE pet_link_tokens ADD COLUMN target_user_id TEXT");
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const transaction = (fn) => db.transaction(fn).immediate;
  const find = (id) => get("SELECT * FROM pet_memorials WHERE id=?", id);
  const counts = (id, day) => get(
    "SELECT count(DISTINCT visitor_ref) AS uniqueVisitors, count(*) FILTER(WHERE kind='flower') AS flowers," +
    "count(*) FILTER(WHERE kind='light') AS lights FROM pet_visits WHERE memorial_id=? AND day=?", id, day
  );
  const addMember = (id, ref, userId, role, inviteId, now) => run(
    "INSERT INTO pet_members(memorial_id,principal_ref,role,invite_id,created_at,revoked_at,user_id) VALUES(?,?,?,?,?,NULL,?) ON CONFLICT(memorial_id,principal_ref)" +
    " DO UPDATE SET role=excluded.role,invite_id=excluded.invite_id,created_at=excluded.created_at,revoked_at=NULL,user_id=excluded.user_id",
    id, ref, role, inviteId, now, userId
  );
  return {
    find,
    counts,
    exportCounts: (id) => get(
      "SELECT (SELECT count(*) FROM pet_invites WHERE memorial_id=?) AS inviteCount," +
      " (SELECT count(*) FROM pet_members WHERE memorial_id=?) AS memberCount," +
      " count(*) FILTER (WHERE kind='flower') AS flowers," +
      " count(*) FILTER (WHERE kind='light') AS lights FROM pet_visits WHERE memorial_id=?", id, id, id
    ),
    list: (district, cursor, limit) => all(
      "SELECT * FROM pet_memorials WHERE district_id=? AND public_status='visible' AND demo=0 AND id>? ORDER BY id LIMIT ?",
      district, cursor, limit
    ),
    mine: (ref) => all("SELECT * FROM pet_memorials WHERE owner_ref=? AND demo=0", ref),
    mineUser: (userId) => all("SELECT * FROM pet_memorials WHERE owner_user_id=? AND demo=0", userId),
    member: (id, ref) => Boolean(get(
      "SELECT 1 FROM pet_members WHERE memorial_id=? AND principal_ref=? AND revoked_at IS NULL", id, ref
    )),
    memberUser: (id, userId) => Boolean(get(
      "SELECT 1 FROM pet_members WHERE memorial_id=? AND user_id=? AND revoked_at IS NULL", id, userId
    )),
    create: transaction((m) => {
      if (get("SELECT 1 FROM pet_memorials WHERE owner_ref=? OR owner_user_id=? OR browser_claim_hash=?", m.owner, m.userId, m.claimHash)) return false;
      const {slot} = get(
        "SELECT coalesce(max((district_id-1)*64+(row_no-1)*8+column_no),0) AS slot FROM pet_memorials WHERE wall_at IS NULL"
      );
      run(
        "INSERT INTO pet_memorials(id,owner_ref,identity_kind,browser_claim_hash,pet_name,species_code,born_on,died_on,epitaph," +
        "public_status,moderation_status,moderation_rule_version,district_id,row_no,column_no,created_at,updated_at)" +
        " VALUES(?,?,?,?,?,?,?,?,?,?,'passed',?,?,?,?,?,?)",
        m.id, m.owner, m.kind, m.claimHash, m.name, m.species, m.born, m.died, m.epitaph, m.status, m.ruleVersion,
        Math.floor(slot / 64) + 1, Math.floor(slot % 64 / 8) + 1, slot % 8 + 1, m.now, m.now
      );
      if (m.userId) run("UPDATE pet_memorials SET owner_user_id=? WHERE id=?", m.userId, m.id);
      addMember(m.id, m.owner, m.userId ?? null, 'owner', null, m.now);
      return true;
    }),
    claim: transaction((id, claimHash, owner, userId, kind, now) => {
      if (get("SELECT 1 FROM pet_memorials WHERE owner_ref=? OR owner_user_id=?", owner, userId)) return false;
      const memorial = find(id);
      if (memorial?.demo !== 0 || memorial.identity_kind !== 'browser' || memorial.browser_claim_hash !== claimHash) return false;
      run("UPDATE pet_memorials SET owner_ref=?,owner_user_id=?,identity_kind=?,browser_claim_hash=NULL,updated_at=? WHERE id=?", owner, userId, kind, now, id);
      run("DELETE FROM pet_members WHERE memorial_id=? AND principal_ref=?", id, memorial.owner_ref);
      addMember(id, owner, userId, 'owner', null, now);
      return true;
    }),
    invite: transaction((id, owner, userId, invite) => {
      const memorial = find(id);
      if (!memorial || (memorial.owner_user_id ? memorial.owner_user_id !== userId : memorial.owner_ref !== owner)) return false;
      run("INSERT INTO pet_invites(id,memorial_id,token_hash,created_by,expires_at,max_uses,created_by_user_id) VALUES(?,?,?,?,?,?,?)",
        invite.id, id, invite.hash, owner, invite.expires, invite.maxUses, userId);
      return true;
    }),
    accept: transaction((tokenHash, ref, userId, now) => {
      const invite = get("SELECT * FROM pet_invites WHERE token_hash=? AND revoked_at IS NULL AND expires_at>?", tokenHash, now);
      if (!invite) return null;
      const id = invite.memorial_id;
      const member = get(
        "SELECT role FROM pet_members WHERE memorial_id=? AND principal_ref=? AND revoked_at IS NULL", id, ref
      );
      if (member) return {memorialId: id, role: member.role};
      if (invite.uses >= invite.max_uses) return null;
      addMember(id, ref, userId ?? null, 'invited', invite.id, now);
      run("UPDATE pet_invites SET uses=uses+1 WHERE id=?", invite.id);
      return {memorialId: id, role: 'invited'};
    }),
    revoke: transaction((id, owner, userId, inviteId, now) => {
      const memorial = find(id);
      if (!memorial || (memorial.owner_user_id ? memorial.owner_user_id !== userId : memorial.owner_ref !== owner)) return false;
      if (!run("UPDATE pet_invites SET revoked_at=coalesce(revoked_at,?) WHERE id=? AND memorial_id=?", now, inviteId, id).changes)
        return false;
      run("UPDATE pet_members SET revoked_at=? WHERE invite_id=? AND revoked_at IS NULL", now, inviteId);
      return true;
    }),
    offer: transaction((id, day, visitor, kind, now, ownerRef, userId) => {
      const memorial = find(id);
      if (memorial?.public_status !== 'visible' || memorial.demo) return null;
      if (memorial.owner_ref !== ownerRef && run(
        "INSERT INTO pet_visits(memorial_id,day,visitor_ref,kind,created_at) SELECT ?,?,?,?,? WHERE NOT EXISTS (" +
        "SELECT 1 FROM pet_offerings WHERE memorial_id=? AND day=? AND visitor_ref=? AND kind=?)" +
        " ON CONFLICT(memorial_id,day,visitor_ref,kind) DO NOTHING", id, day, visitor, kind, now, id, day, visitor, kind
      ).changes) {
        run("UPDATE pet_memorials SET last_qualifying_visit_at=? WHERE id=?", now, id);
      }
      if (userId) run("UPDATE pet_visits SET user_id=? WHERE memorial_id=? AND day=? AND visitor_ref=? AND kind=?", userId, id, day, visitor, kind);
      return counts(id, day);
    }),
    report: transaction((id, memorialId, reason, now) => {
      const memorial = find(memorialId);
      if (!memorial || memorial.demo || !['visible', 'wall'].includes(memorial.public_status)) return false;
      run("INSERT INTO pet_reports VALUES(?,?,?,?)", id, memorialId, reason, now);
      return true;
    }),
    remove: (id, owner, userId) => Boolean(run("DELETE FROM pet_memorials WHERE id=? AND demo=0 AND (owner_user_id=? OR (owner_user_id IS NULL AND owner_ref=?))", id, userId, owner).changes),
    limit: transaction((scope, subjects, bucket, limits) => {
      if (subjects.some((ref, i) => (get(
        "SELECT hits FROM pet_rates WHERE scope=? AND subject_ref=? AND bucket=?", scope, ref, bucket
      )?.hits ?? 0) >= limits[i])) return false;
      for (const ref of subjects) run(
        "INSERT INTO pet_rates VALUES(?,?,?,1) ON CONFLICT(scope,subject_ref,bucket) DO UPDATE SET hits=hits+1", scope, ref, bucket
      );
      return true;
    }),
    emailDailyLimit: transaction((day, limit) => {
      const row = get("SELECT sent FROM pet_email_daily WHERE day=?", day);
      if ((row?.sent ?? 0) >= limit) return false;
      run("INSERT INTO pet_email_daily(day,sent) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET sent=sent+1", day);
      return true;
    }),
    saveEmailCode: transaction((subject, codeHash, expires) => {
      run("INSERT INTO pet_email_codes(subject,code_hash,expires_at,attempts) VALUES(?,?,?,0) ON CONFLICT(subject) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0", subject, codeHash, expires);
    }),
    takeEmailCode: transaction((subject, codeHash, now) => {
      const row = get("SELECT * FROM pet_email_codes WHERE subject=?", subject);
      if (!row || row.expires_at < now || row.attempts >= 5) return false;
      if (row.code_hash !== codeHash) {
        run("UPDATE pet_email_codes SET attempts=attempts+1 WHERE subject=?", subject);
        return false;
      }
      run("DELETE FROM pet_email_codes WHERE subject=?", subject);
      return true;
    }),
    linkStart: transaction((tokenHash, sourceUserId, kind, targetEmail, targetUserId, expires) => {
      run("INSERT INTO pet_link_tokens(token_hash,source_user_id,kind,target_email,target_user_id,expires_at,used_at) VALUES(?,?,?,?,?,?,NULL)", tokenHash, sourceUserId, kind, targetEmail, targetUserId, expires);
    }),
    linkPeek: (tokenHash, kind, now) => {
      const row = get("SELECT * FROM pet_link_tokens WHERE token_hash=?", tokenHash);
      return !row || row.kind !== kind || row.used_at || row.expires_at < now ? null : row;
    },
    linkAssignTarget: transaction((tokenHash, targetUserId) => {
      return Boolean(run("UPDATE pet_link_tokens SET target_user_id=? WHERE token_hash=? AND used_at IS NULL AND target_user_id IS NULL", targetUserId, tokenHash).changes);
    }),
    linkTake: transaction((tokenHash, sourceUserId, kind, now) => {
      const row = get("SELECT * FROM pet_link_tokens WHERE token_hash=?", tokenHash);
      if (!row || row.source_user_id !== sourceUserId || row.kind !== kind || row.used_at || row.expires_at < now || !row.target_user_id) return null;
      run("UPDATE pet_link_tokens SET used_at=? WHERE token_hash=?", now, tokenHash);
      return row;
    }),
    mineSummary: (userId) => get("SELECT count(*) AS memorialCount FROM pet_memorials WHERE owner_user_id=? AND demo=0", userId),
    maintain: transaction((now, yearAgo) => {
      const clearedRates = run("DELETE FROM pet_rates WHERE bucket<?", Math.floor(now / 60000)).changes;
      const movedToWall = run("UPDATE pet_memorials SET public_status='wall',wall_at=?,updated_at=? WHERE public_status='visible'" +
        " AND demo=0 AND coalesce(last_qualifying_visit_at,created_at)<=?", now, now, yearAgo).changes;
      return {movedToWall, clearedRates};
    }),
    analytics: () => all("SELECT action,count(*) AS total FROM pet_analytics_events GROUP BY action ORDER BY action"),
    recordAnalytics: (event, now) => {
      if (event?.consent !== true || typeof event.visitorRef !== 'string' || !/^[a-f0-9]{32}$/.test(event.visitorRef) ||
          !['open', 'flower', 'light', 'create'].includes(event.action)) return false;
      const dimensions = Object.entries(analyticsDimensions).map(([field, allowed]) =>
        allowed.includes(event[field]) ? event[field] : null
      );
      run("INSERT INTO pet_analytics_events VALUES(?,?,?,?,?,?,?,?,?,?)", event.visitorRef, event.action, now, ...dimensions);
      return true;
    }
  };
}
