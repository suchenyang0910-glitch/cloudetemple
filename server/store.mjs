import Database from 'better-sqlite3';
export function openStore(file){
  const db=new Database(file);db.pragma('secure_delete = ON');db.pragma('journal_mode = DELETE');db.pragma('busy_timeout = 5000');
  db.exec(`CREATE TABLE IF NOT EXISTS waitlist(key TEXT PRIMARY KEY,email TEXT NOT NULL,language TEXT NOT NULL,consentAt TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rates(key TEXT PRIMARY KEY,until INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS reminders(user_id TEXT PRIMARY KEY,language TEXT NOT NULL,consentAt TEXT NOT NULL);`);
  const rate=db.prepare('SELECT until FROM rates WHERE key=?'),email=db.prepare('INSERT OR REPLACE INTO waitlist VALUES(?,?,?,?,?)'),limit=db.prepare('INSERT OR REPLACE INTO rates VALUES(?,?)');
  const register=db.transaction((record,now)=>{if((rate.get(record.ipKey)?.until||0)>now)return false;email.run(record.emailKey,record.email,record.language,record.consentAt,now+90*86400000);limit.run(record.ipKey,now+60000);return true;});
  const cleanup=()=>{db.prepare('DELETE FROM waitlist WHERE expires<=?').run(Date.now());db.prepare('DELETE FROM rates WHERE until<=?').run(Date.now());db.prepare('DELETE FROM reminders WHERE consentAt<=?').run(new Date(Date.now()-90*86400000).toISOString());};
  cleanup();const timer=setInterval(cleanup,86400000);timer.unref();
  return {db,register:(record,now)=>register.immediate(record,now),cleanup,remind(user,consentAt){db.prepare('INSERT OR REPLACE INTO reminders VALUES(?,?,?)').run(user.id,user.language,consentAt);},remove(id){db.prepare('DELETE FROM reminders WHERE user_id=?').run(String(id));},close(){clearInterval(timer);db.close();}};
}
