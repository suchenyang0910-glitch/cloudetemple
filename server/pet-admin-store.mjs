import {randomUUID} from 'node:crypto';

export function openPetAdminStore(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pet_admin_reviews (
      id TEXT PRIMARY KEY NOT NULL, category TEXT NOT NULL, rule_version TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pet_admin_takedowns (
      memorial_id TEXT PRIMARY KEY NOT NULL REFERENCES pet_memorials(id) ON DELETE CASCADE,
      prior_status TEXT NOT NULL CHECK(prior_status IN ('visible','wall'))
    );
    CREATE TABLE IF NOT EXISTS pet_admin_bans (
      id TEXT PRIMARY KEY NOT NULL, subject_ref TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pet_admin_audit (
      id TEXT PRIMARY KEY NOT NULL, actor_ref TEXT NOT NULL, action TEXT NOT NULL, target_id TEXT,
      reason TEXT, result TEXT NOT NULL, request_id TEXT UNIQUE, created_at INTEGER NOT NULL,
      CHECK(result <> 'ok' OR (reason IS NOT NULL AND length(trim(reason)) > 0 AND request_id IS NOT NULL))
    );
    CREATE INDEX IF NOT EXISTS pet_admin_audit_target ON pet_admin_audit(action,target_id) WHERE result='ok';
    CREATE TRIGGER IF NOT EXISTS pet_admin_audit_no_update BEFORE UPDATE ON pet_admin_audit
      BEGIN SELECT RAISE(ABORT,'pet_admin_audit is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS pet_admin_audit_no_delete BEFORE DELETE ON pet_admin_audit
      BEGIN SELECT RAISE(ABORT,'pet_admin_audit is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS pet_admin_audit_no_replace BEFORE INSERT ON pet_admin_audit
      WHEN EXISTS(SELECT 1 FROM pet_admin_audit WHERE id=NEW.id OR request_id=NEW.request_id)
      BEGIN SELECT RAISE(ABORT,'pet_admin_audit is append-only'); END;
  `);
  if (!db.prepare("PRAGMA table_info(pet_admin_bans)").all().some(column => column.name === 'user_id'))
    db.exec("ALTER TABLE pet_admin_bans ADD COLUMN user_id TEXT");
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const audit = ({actor, action, target, reason, requestId, now}, result) => run(
    'INSERT INTO pet_admin_audit VALUES(?,?,?,?,?,?,?,?)',
    randomUUID(), actor, action, target, reason, result, result === 'ok' ? requestId : null, now
  );
  const resolved = (action, target) => get(
    "SELECT 1 FROM pet_admin_audit WHERE action=? AND target_id=? AND result='ok'", action, target
  );
  const memorial = id => get("SELECT id,owner_ref,owner_user_id,public_status FROM pet_memorials WHERE id=? AND demo=0", id);
  const change = db.transaction(op => {
    const {action, target, now, requestId} = op;
    let result = 'not_found', banId;
    if (get('SELECT 1 FROM pet_admin_audit WHERE request_id=?', requestId)) result = 'replayed';
    else if (action === 'takedown') {
      const row = memorial(target);
      if (row && ['visible', 'wall'].includes(row.public_status)) {
        run('INSERT INTO pet_admin_takedowns VALUES(?,?)', target, row.public_status);
        run("UPDATE pet_memorials SET public_status='hidden',updated_at=? WHERE id=?", now, target);
        result = 'ok';
      }
    } else if (action === 'restore') {
      const row = get('SELECT prior_status FROM pet_admin_takedowns WHERE memorial_id=?', target);
      if (row && memorial(target)?.public_status === 'hidden') {
        run('UPDATE pet_memorials SET public_status=?,updated_at=? WHERE id=?', row.prior_status, now, target);
        run('DELETE FROM pet_admin_takedowns WHERE memorial_id=?', target);
        result = 'ok';
      }
    } else if (action === 'ban') {
      const row = memorial(target);
      if (row) {
        banId = randomUUID();
        result = run('INSERT INTO pet_admin_bans(id,subject_ref,created_at,user_id) VALUES(?,?,?,?) ON CONFLICT(subject_ref) DO NOTHING',
          banId, row.owner_ref, now, row.owner_user_id).changes ? 'ok' : 'already_banned';
      }
    } else if (action === 'unban') {
      if (run('DELETE FROM pet_admin_bans WHERE id=?', target).changes) result = 'ok';
    } else if (action === 'resolve-review') {
      if (get('SELECT 1 FROM pet_admin_reviews WHERE id=?', target) && !resolved(action, target)) result = 'ok';
    } else if (action === 'resolve-report') {
      if (get('SELECT 1 FROM pet_reports WHERE id=?', target) && !resolved(action, target)) result = 'ok';
    }
    audit(op, result);
    return result === 'ok' && banId ? {result, banId} : {result};
  }).immediate;

  return {
    isBanned: (ref, userId) => Boolean((ref || userId) && get('SELECT 1 FROM pet_admin_bans WHERE subject_ref=? OR user_id=?', ref, userId)),
    hold: (category, version, now) => run('INSERT INTO pet_admin_reviews VALUES(?,?,?,?)',
      randomUUID(), category, version, now),
    reviews: after => all(
      "SELECT q.rowid AS seq,q.id,q.category,q.rule_version AS ruleVersion,q.created_at AS createdAt FROM pet_admin_reviews q" +
      " WHERE q.rowid>? AND NOT EXISTS(SELECT 1 FROM pet_admin_audit a WHERE a.action='resolve-review' AND a.target_id=q.id AND a.result='ok')" +
      " ORDER BY q.rowid LIMIT 51", after
    ),
    reports: after => all(
      "SELECT q.rowid AS seq,q.id,q.memorial_id AS memorialId,q.reason_code AS category,q.created_at AS createdAt," +
      " CASE WHEN m.public_status IN ('visible','wall') THEN m.pet_name END AS petName," +
      " CASE WHEN m.public_status IN ('visible','wall') THEN m.epitaph END AS epitaph" +
      " FROM pet_reports q JOIN pet_memorials m ON m.id=q.memorial_id AND m.demo=0" +
      " WHERE q.rowid>? AND NOT EXISTS(SELECT 1 FROM pet_admin_audit a WHERE a.action='resolve-report' AND a.target_id=q.id AND a.result='ok')" +
      " ORDER BY q.rowid LIMIT 51", after
    ),
    takedowns: after => all('SELECT t.rowid AS seq,t.memorial_id AS id,m.updated_at AS updatedAt FROM pet_admin_takedowns t' +
      ' JOIN pet_memorials m ON m.id=t.memorial_id AND m.demo=0 WHERE t.rowid>? ORDER BY t.rowid LIMIT 51', after),
    bans: after => all('SELECT rowid AS seq,id,created_at AS createdAt FROM pet_admin_bans WHERE rowid>? ORDER BY rowid LIMIT 51', after),
    change,
    audit
  };
}
