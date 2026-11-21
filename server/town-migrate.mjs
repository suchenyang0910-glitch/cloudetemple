import {pathToFileURL} from 'node:url';

export function migrateTown(db, environment) {
  if (environment !== 'staging') throw Error('town_staging_only');
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE name='users'").get()) throw Error('existing_accounts_required');
  db.transaction(() => {
    if (!db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'town_name')) db.exec('ALTER TABLE users ADD COLUMN town_name TEXT');
    db.exec(`
      CREATE TABLE IF NOT EXISTS town_names(ref TEXT PRIMARY KEY,user_id TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,locked_until INTEGER NOT NULL DEFAULT 0,seen INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS town_changes(ref TEXT NOT NULL REFERENCES town_names(ref) ON DELETE CASCADE,at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS town_changes_ref ON town_changes(ref,at);
      CREATE TABLE IF NOT EXISTS town_reports(target TEXT NOT NULL REFERENCES town_names(ref) ON DELETE CASCADE,revision INTEGER NOT NULL,reporter TEXT NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(target,revision,reporter));
      CREATE TABLE IF NOT EXISTS town_reviews(id TEXT PRIMARY KEY,target TEXT NOT NULL REFERENCES town_names(ref) ON DELETE CASCADE,revision INTEGER NOT NULL,name TEXT NOT NULL,reports INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created INTEGER NOT NULL,UNIQUE(target,revision));
      CREATE TABLE IF NOT EXISTS town_audit(request_id TEXT PRIMARY KEY,actor TEXT NOT NULL,review_id TEXT NOT NULL,action TEXT NOT NULL,result TEXT NOT NULL,at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS town_tickets(hash TEXT PRIMARY KEY,ref TEXT NOT NULL REFERENCES town_names(ref) ON DELETE CASCADE,origin TEXT NOT NULL,expires INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS town_tickets_expiry ON town_tickets(expires);
      CREATE TABLE IF NOT EXISTS town_presence(actor TEXT PRIMARY KEY,ref TEXT NOT NULL UNIQUE REFERENCES town_names(ref) ON DELETE CASCADE,room TEXT NOT NULL,revision INTEGER NOT NULL,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS town_rates(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS town_schema(version INTEGER PRIMARY KEY);
      INSERT OR IGNORE INTO town_schema VALUES(1);
    `);
  }).immediate();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.env.CHUAMAY_ENV !== 'staging' || process.argv[2] !== '--staging-only' || !process.argv[3]?.replaceAll('\\','/').includes('/staging/')) throw Error('explicit_staging_database_required');
  const {default: Database} = await import('better-sqlite3');
  const db = new Database(process.argv[3], {fileMustExist:true});
  try {db.pragma('foreign_keys = ON'); migrateTown(db, 'staging'); console.log('town_schema_v1');} finally {db.close();}
}
