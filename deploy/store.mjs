import {DatabaseSync} from 'node:sqlite';
export function createStore(filename){
  const db=new DatabaseSync(filename);
  db.exec('PRAGMA secure_delete=ON; PRAGMA journal_mode=DELETE; CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires INTEGER NOT NULL)');
  const get=db.prepare('SELECT value FROM kv WHERE key=? AND expires>?');
  const put=db.prepare('INSERT INTO kv VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, expires=excluded.expires');
  const prune=db.prepare('DELETE FROM kv WHERE expires<=?');
  const cleanup=()=>prune.run(Date.now());cleanup();
  const timer=setInterval(cleanup,60000);timer.unref();
  return {async get(key){return get.get(key,Date.now())?.value??null;},async put(key,value,{expirationTtl}){put.run(key,value,Date.now()+expirationTtl*1000);},cleanup,close(){clearInterval(timer);db.close();}};
}
