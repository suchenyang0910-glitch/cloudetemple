import { randomUUID } from "node:crypto";
export function identityDuplicateSummary(db) {
  const rows = db
    .prepare(
      "SELECT count(DISTINCT user_id) users FROM identities WHERE email IS NOT NULL AND trim(email)<>'' GROUP BY lower(trim(email)) HAVING count(DISTINCT user_id)>1",
    )
    .all();
  return {
    duplicateEmails: rows.length,
    duplicateUsers: rows.reduce((total, row) => total + row.users, 0),
  };
}
export function openFamilyStore(db, { demo = true } = {}) {
  const demoFlag = demo ? 1 : 0;
  db.pragma("foreign_keys = ON");
  db.exec(`
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,display_name TEXT NOT NULL DEFAULT '',locale TEXT NOT NULL DEFAULT 'vi',created_at TEXT NOT NULL,deleted_at TEXT,demo INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS identities(id INTEGER PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,provider TEXT NOT NULL CHECK(provider IN('email','google','telegram')),subject TEXT NOT NULL,email TEXT,created_at TEXT NOT NULL,demo INTEGER NOT NULL DEFAULT 1,UNIQUE(provider,subject));
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL,ua_summary TEXT NOT NULL,csrf_hash TEXT NOT NULL,created_at TEXT NOT NULL,demo INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS email_codes(subject TEXT PRIMARY KEY,email TEXT NOT NULL,code_hash TEXT NOT NULL,expires_at INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,ip_hash TEXT NOT NULL,created_at TEXT NOT NULL,demo INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS family_rates(key TEXT PRIMARY KEY,until INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS oauth_states(state_hash TEXT PRIMARY KEY,verifier TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at TEXT NOT NULL,demo INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS tablets(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,honorific TEXT NOT NULL,full_name TEXT NOT NULL,birth_year INTEGER,death_year INTEGER,death_lunar_day INTEGER NOT NULL,death_lunar_month INTEGER NOT NULL,death_lunar_leap INTEGER NOT NULL DEFAULT 0,note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,demo INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS tablet_members(tablet_id TEXT NOT NULL REFERENCES tablets(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL CHECK(role IN('owner','family')),created_at TEXT NOT NULL,demo INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(tablet_id,user_id));
CREATE TABLE IF NOT EXISTS invites(id TEXT PRIMARY KEY,tablet_id TEXT NOT NULL REFERENCES tablets(id) ON DELETE CASCADE,token_hash TEXT NOT NULL UNIQUE,created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL,revoked_at TEXT,uses INTEGER NOT NULL DEFAULT 0,max_uses INTEGER NOT NULL DEFAULT 20,created_at TEXT NOT NULL,demo INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS offerings(id TEXT PRIMARY KEY,tablet_id TEXT NOT NULL REFERENCES tablets(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind IN('incense','flower','fruit','tea')),at TEXT NOT NULL,created_at TEXT NOT NULL,demo INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS reminder_prefs(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,email_on INTEGER NOT NULL DEFAULT 0,telegram_on INTEGER NOT NULL DEFAULT 0,telegram_chat_id TEXT,ics_token TEXT,festival_on INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,demo INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS deliveries(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,tablet_id TEXT,kind TEXT NOT NULL,due_date TEXT NOT NULL,channel TEXT NOT NULL,sent_at TEXT,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,dedupe_key TEXT UNIQUE,demo INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS family_consents(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,version TEXT NOT NULL,consented_at TEXT NOT NULL,demo INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS calendar_preorders(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE SET NULL,contact TEXT NOT NULL,family_name TEXT NOT NULL,edition TEXT NOT NULL CHECK(edition IN('basic','family')),anniversaries_json TEXT NOT NULL,address TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL,demo INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS membership_interests(id TEXT PRIMARY KEY,name TEXT NOT NULL DEFAULT '',contact TEXT NOT NULL,ancestor_count TEXT NOT NULL,willingness TEXT NOT NULL,region TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,expires_at INTEGER NOT NULL,demo INTEGER NOT NULL DEFAULT 1);`);
  const deliveryColumns = db.prepare("PRAGMA table_info(deliveries)").all();
  if (!deliveryColumns.some((column) => column.name === "dedupe_key")) {
    db.exec("ALTER TABLE deliveries ADD COLUMN dedupe_key TEXT");
    db.exec("UPDATE deliveries SET dedupe_key=id WHERE dedupe_key IS NULL");
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS deliveries_dedupe_key ON deliveries(dedupe_key)",
    );
  }
  const now = () => new Date().toISOString(),
    one = (sql, ...p) => db.prepare(sql).get(...p),
    all = (sql, ...p) => db.prepare(sql).all(...p),
    run = (sql, ...p) => db.prepare(sql).run(...p);
  const userFor = (provider, subject, email = "", display = "") => {
    email = String(email || "").trim().toLowerCase();
    const found = one(
      "SELECT u.* FROM users u JOIN identities i ON i.user_id=u.id WHERE i.provider=? AND i.subject=?",
      provider,
      subject,
    );
    if (found) {
      if (email)
        run(
          "UPDATE identities SET email=? WHERE provider=? AND subject=?",
          email,
          provider,
          subject,
        );
      return found;
    }
    const emailUsers = email
      ? all(
          "SELECT DISTINCT u.* FROM users u JOIN identities i ON i.user_id=u.id WHERE lower(i.email)=? AND u.deleted_at IS NULL",
          email,
        )
      : [];
    if (emailUsers.length > 1) throw Error("duplicate_identity");
    const id = randomUUID(),
      at = now();
    if (emailUsers.length === 1) {
      run(
        "INSERT INTO identities(user_id,provider,subject,email,created_at,demo) VALUES(?,?,?,?,?,?)",
        emailUsers[0].id,
        provider,
        subject,
        email,
        at,
        demoFlag,
      );
      return emailUsers[0];
    }
    db.transaction(() => {
      run(
        "INSERT INTO users VALUES(?,?,?,?,?,?)",
        id,
        display,
        "vi",
        at,
        null,
        demoFlag,
      );
      run(
        "INSERT INTO identities(user_id,provider,subject,email,created_at,demo) VALUES(?,?,?,?,?,?)",
        id,
        provider,
        subject,
        email || null,
        at,
        demoFlag,
      );
      run(
        "INSERT INTO reminder_prefs(user_id,created_at,demo) VALUES(?,?,?)",
        id,
        at,
        demoFlag,
      );
    })();
    return one("SELECT * FROM users WHERE id=?", id);
  };
  const member = (user, id) =>
    one(
      "SELECT m.role,t.* FROM tablet_members m JOIN tablets t ON t.id=m.tablet_id WHERE m.user_id=? AND t.id=?",
      user,
      id,
    );
  return {
    db,
    userFor,
    member,
    rate(key, until) {
      const row = one("SELECT until FROM family_rates WHERE key=?", key);
      if ((row?.until || 0) > Date.now()) return false;
      run("INSERT OR REPLACE INTO family_rates VALUES(?,?)", key, until);
      return true;
    },
    saveCode(record) {
      run(
        "INSERT OR REPLACE INTO email_codes VALUES(?,?,?,?,?,?,?,?)",
        record.subject,
        record.email,
        record.codeHash,
        record.expires,
        0,
        record.ipHash,
        now(),
        demoFlag,
      );
    },
    takeCode(subject, codeHash) {
      const row = one("SELECT * FROM email_codes WHERE subject=?", subject);
      if (!row || row.expires_at < Date.now() || row.attempts >= 5) return null;
      if (row.code_hash !== codeHash) {
        run(
          "UPDATE email_codes SET attempts=attempts+1 WHERE subject=?",
          subject,
        );
        return null;
      }
      run("DELETE FROM email_codes WHERE subject=?", subject);
      return row;
    },
    saveState(hash, verifier, expires) {
      run(
        "INSERT OR REPLACE INTO oauth_states VALUES(?,?,?,?,?)",
        hash,
        verifier,
        expires,
        now(),
        demoFlag,
      );
    },
    takeState(hash) {
      const row = one("SELECT * FROM oauth_states WHERE state_hash=?", hash);
      run("DELETE FROM oauth_states WHERE state_hash=?", hash);
      return row && row.expires_at >= Date.now() ? row : null;
    },
    session(hash, user, expires, csrfHash) {
      run(
        "INSERT INTO sessions (token_hash,user_id,expires_at,ua_summary,csrf_hash,created_at,demo) VALUES(?,?,?,'',?,?,?)",
        hash,
        user,
        expires,
        csrfHash,
        now(),
        demoFlag,
      );
    },
    sessionUser(hash) {
      return one(
        "SELECT s.user_id,s.csrf_hash,u.display_name,u.locale,(SELECT email FROM identities WHERE user_id=u.id AND email IS NOT NULL ORDER BY CASE provider WHEN 'google' THEN 0 WHEN 'email' THEN 1 ELSE 2 END LIMIT 1) AS email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.deleted_at IS NULL",
        hash,
        Date.now(),
      );
    },
    rotateCsrf(tokenHash, csrfHash) {
      run(
        "UPDATE sessions SET csrf_hash=? WHERE token_hash=?",
        csrfHash,
        tokenHash,
      );
    },
    logout(hash) {
      run("DELETE FROM sessions WHERE token_hash=?", hash);
    },
    consent(user) {
      return one("SELECT version,consented_at FROM family_consents WHERE user_id=?", user) || null;
    },
    acceptConsent(user, version) {
      const at = now();
      run("INSERT INTO family_consents VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET version=excluded.version,consented_at=excluded.consented_at", user, version, at, demoFlag);
      return { version, consented_at: at };
    },
    listTablets(user) {
      return all(
        "SELECT t.*,m.role FROM tablets t JOIN tablet_members m ON m.tablet_id=t.id WHERE m.user_id=? ORDER BY t.created_at",
        user,
      );
    },
    createTablet(user, v, id = randomUUID()) {
      const existing = member(user, id);
      if (existing) return existing;
      if (one("SELECT count(*) n FROM tablets WHERE owner_id=?", user).n >= 10)
        throw Error("tablet_limit");
      const at = now();
      db.transaction(() => {
        run(
          "INSERT INTO tablets VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
          id,
          user,
          v.honorific,
          v.fullName,
          v.birthYear,
          v.deathYear,
          v.day,
          v.month,
          v.leap ? 1 : 0,
          v.note,
          at,
          demoFlag,
        );
        run(
          "INSERT INTO tablet_members VALUES(?,?, 'owner',?,?)",
          id,
          user,
          at,
          demoFlag,
        );
      })();
      return member(user, id);
    },
    updateTablet(user, id, v) {
      const m = member(user, id);
      if (!m || m.role !== "owner") return null;
      run(
        "UPDATE tablets SET honorific=?,full_name=?,birth_year=?,death_year=?,death_lunar_day=?,death_lunar_month=?,death_lunar_leap=?,note=? WHERE id=?",
        v.honorific,
        v.fullName,
        v.birthYear,
        v.deathYear,
        v.day,
        v.month,
        v.leap ? 1 : 0,
        v.note,
        id,
      );
      return member(user, id);
    },
    deleteTablet(user, id) {
      const m = member(user, id);
      if (!m || m.role !== "owner") return false;
      run("DELETE FROM tablets WHERE id=?", id);
      return true;
    },
    offer(user, id, kind) {
      const membership = member(user, id);
      if (!membership || membership.role !== "owner") return null;
      const at = now();
      run(
        "INSERT INTO offerings VALUES(?,?,?,?,?,?,?)",
        randomUUID(),
        id,
        user,
        kind,
        at,
        at,
        demoFlag,
      );
      return one(
        "SELECT count(DISTINCT user_id) n FROM offerings WHERE tablet_id=? AND at>=date('now','localtime')",
        id,
      ).n;
    },
    invite(user, id, hash, expires, maxUses) {
      const m = member(user, id);
      if (!m || m.role !== "owner") return null;
      const invite = randomUUID();
      run(
        "INSERT INTO invites VALUES(?,?,?,?,?,?,?,?,?,?)",
        invite,
        id,
        hash,
        user,
        expires,
        null,
        0,
        maxUses,
        now(),
        demoFlag,
      );
      return invite;
    },
    inviteInfo(hash) {
      return one(
        "SELECT i.*,t.honorific,t.full_name,u.display_name inviter FROM invites i JOIN tablets t ON t.id=i.tablet_id JOIN users u ON u.id=i.created_by WHERE i.token_hash=?",
        hash,
      );
    },
    acceptInvite(user, hash) {
      return db
        .transaction(() => {
          const i = this.inviteInfo(hash);
          if (!i) return null;
          const existing = member(user, i.tablet_id);
          if (existing) return existing;
          if (one("SELECT count(*) n FROM tablet_members WHERE tablet_id=?", i.tablet_id).n >= 5) return null;
          const claimed = run(
            "UPDATE invites SET uses=uses+1 WHERE id=? AND revoked_at IS NULL AND expires_at>=? AND uses<max_uses",
            i.id,
            Date.now(),
          );
          if (claimed.changes !== 1) return null;
          run(
            "INSERT INTO tablet_members VALUES(?,?,'family',?,?)",
            i.tablet_id,
            user,
            now(),
            demoFlag,
          );
          return member(user, i.tablet_id);
        })
        .immediate();
    },
    revokeInvite(user, tabletId, inviteId) {
      const m = member(user, tabletId);
      if (!m || m.role !== "owner") return false;
      return (
        run(
          "UPDATE invites SET revoked_at=? WHERE id=? AND tablet_id=? AND revoked_at IS NULL",
          now(),
          inviteId,
          tabletId,
        ).changes === 1
      );
    },
    removeMember(user, tabletId, memberId) {
      const m = member(user, tabletId);
      if (!m || m.role !== "owner" || memberId === user) return false;
      return (
        run(
          "DELETE FROM tablet_members WHERE tablet_id=? AND user_id=? AND role='family'",
          tabletId,
          memberId,
        ).changes === 1
      );
    },
    leaveTablet(user, tabletId) {
      return run("DELETE FROM tablet_members WHERE tablet_id=? AND user_id=? AND role='family'", tabletId, user).changes === 1;
    },
    prefs(user) {
      return one("SELECT * FROM reminder_prefs WHERE user_id=?", user);
    },
    setPrefs(user, v) {
      run(
        "UPDATE reminder_prefs SET email_on=?,telegram_on=?,telegram_chat_id=COALESCE(?,telegram_chat_id),ics_token=COALESCE(?,ics_token),festival_on=? WHERE user_id=?",
        v.email ? 1 : 0,
        v.telegram ? 1 : 0,
        v.telegramChat,
        v.icsHash,
        v.festival ? 1 : 0,
        user,
      );
      return this.prefs(user);
    },
    unsubscribeEmail(user) {
      return (
        run("UPDATE reminder_prefs SET email_on=0 WHERE user_id=?", user)
          .changes === 1
      );
    },
    revokeCalendar(user) {
      return (
        run("UPDATE reminder_prefs SET ics_token=NULL WHERE user_id=?", user)
          .changes === 1
      );
    },
    calendarUser(icsHash) {
      const pref = one(
        "SELECT * FROM reminder_prefs WHERE ics_token=?",
        icsHash,
      );
      return pref
        ? { prefs: pref, tablets: this.listTablets(pref.user_id) }
        : null;
    },
    exportUser(user) {
      return {
        user: one(
          "SELECT id,display_name,locale,created_at FROM users WHERE id=?",
          user,
        ),
        tablets: this.listTablets(user),
        offerings: all(
          "SELECT tablet_id,kind,at FROM offerings WHERE user_id=?",
          user,
        ),
        reminders: this.prefs(user),
        consent: this.consent(user),
      };
    },
    createPreorder(user, value) {
      const id = randomUUID(), at = now();
      run("INSERT INTO calendar_preorders VALUES(?,?,?,?,?,?,?,?,?,?)", id, user || null, value.contact, value.familyName, value.edition, JSON.stringify(value.anniversaries), "", "pending", at, demoFlag);
      return { id, status: "pending" };
    },
    createInterest(value) {
      const id = randomUUID(), at = now();
      run("INSERT INTO membership_interests VALUES(?,?,?,?,?,?,?,?,?)", id, value.name, value.contact, value.ancestorCount, value.willingness, value.region, at, Date.now() + 730 * 86400000, demoFlag);
      return { id };
    },
    presaleAdmin() {
      return {
        preorders: all("SELECT contact,family_name,edition,status FROM calendar_preorders ORDER BY created_at DESC LIMIT 500"),
        interests: all("SELECT contact,ancestor_count,willingness,region FROM membership_interests ORDER BY created_at DESC LIMIT 500"),
      };
    },
    deleteUser(user) {
      run("DELETE FROM users WHERE id=?", user);
    },
    cleanup() {
      run("DELETE FROM sessions WHERE expires_at<=?", Date.now());
      run("DELETE FROM email_codes WHERE expires_at<=?", Date.now());
      run("DELETE FROM oauth_states WHERE expires_at<=?", Date.now());
      run("DELETE FROM family_rates WHERE until<=?", Date.now());
      run("DELETE FROM membership_interests WHERE expires_at<=?", Date.now());
      if (
        one(
          "SELECT 1 ok FROM sqlite_master WHERE type='table' AND name='mail_outbox'",
        )
      )
        run(
          "DELETE FROM mail_outbox WHERE expires_at IS NULL OR expires_at<=?",
          Date.now(),
        );
    },
  };
}
