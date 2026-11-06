import {randomUUID} from 'node:crypto';
const ensure=db=>db.exec('CREATE TABLE IF NOT EXISTS mail_outbox(id TEXT PRIMARY KEY,to_address TEXT NOT NULL,subject TEXT NOT NULL,text_body TEXT NOT NULL,html_body TEXT NOT NULL,created_at TEXT NOT NULL,demo INTEGER NOT NULL DEFAULT 1)');
export function putOutbox(db,m){ensure(db);db.prepare('INSERT INTO mail_outbox VALUES(?,?,?,?,?,?,1)').run(randomUUID(),m.to,m.subject,m.text,m.html,new Date().toISOString());}
export function listOutbox(db){ensure(db);return db.prepare('SELECT id,to_address,subject,text_body,created_at FROM mail_outbox ORDER BY created_at DESC LIMIT 100').all();}
export function handleOutbox(req,res,route,db){if(route!=='/family/dev/outbox'||req.method!=='GET')return false;res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'});res.end(JSON.stringify({ok:true,messages:listOutbox(db)}));return true;}
