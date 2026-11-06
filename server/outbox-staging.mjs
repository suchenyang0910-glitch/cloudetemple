import { randomUUID } from "node:crypto";
const ensure = (db) => {
  db.exec(
    "CREATE TABLE IF NOT EXISTS mail_outbox(id TEXT PRIMARY KEY,to_address TEXT NOT NULL,subject TEXT NOT NULL,text_body TEXT NOT NULL,html_body TEXT NOT NULL,created_at TEXT NOT NULL,expires_at INTEGER NOT NULL,demo INTEGER NOT NULL DEFAULT 1)",
  );
  const columns = db.prepare("PRAGMA table_info(mail_outbox)").all();
  if (!columns.some((column) => column.name === "expires_at")) {
    db.exec("ALTER TABLE mail_outbox ADD COLUMN expires_at INTEGER");
    db.prepare(
      "UPDATE mail_outbox SET expires_at=0 WHERE expires_at IS NULL",
    ).run();
  }
};
export function putOutbox(db, m) {
  ensure(db);
  db.prepare(
    "INSERT INTO mail_outbox(id,to_address,subject,text_body,html_body,created_at,expires_at,demo) VALUES(?,?,?,?,?,?,?,1)",
  ).run(
    randomUUID(),
    m.to,
    m.subject,
    m.text,
    m.html,
    new Date().toISOString(),
    Date.now() + 10 * 60 * 1000,
  );
}
export function listOutbox(db) {
  ensure(db);
  return db
    .prepare(
      "SELECT id,to_address,subject,text_body,created_at FROM mail_outbox WHERE expires_at>? ORDER BY created_at DESC LIMIT 100",
    )
    .all(Date.now());
}
export function handleOutbox(req, res, route, db) {
  if (route !== "/family/dev/outbox" || req.method !== "GET") return false;
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
  });
  res.end(JSON.stringify({ ok: true, messages: listOutbox(db) }));
  return true;
}
