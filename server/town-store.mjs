import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {normalizeName,randomName} from './town-names.mjs';
const day=86400000;
const digest=value=>createHash('sha256').update(value).digest('hex');
const reject=code=>{throw Error(code);};
export function openTownStore(db, environment) {
  if (environment!=='staging') reject('town_staging_only');
  if (!db.prepare('SELECT 1 FROM town_schema WHERE version=1').get()) reject('town_migration_required');
  const one=(sql,...args)=>db.prepare(sql).get(...args),run=(sql,...args)=>db.prepare(sql).run(...args);
  const transact=fn=>(...args)=>db.transaction(fn).immediate(...args);
  const get=ref=>one('SELECT n.* FROM town_names n LEFT JOIN users u ON u.id=n.user_id WHERE n.ref=? AND (n.user_id IS NULL OR (u.id IS NOT NULL AND u.deleted_at IS NULL))',ref);
  function replace(ref,name,now,lock=0) {
    run('UPDATE town_names SET name=?,revision=revision+1,seen=?,locked_until=max(locked_until,?) WHERE ref=?',name,now,lock,ref);
    const row=get(ref); if(row.user_id) run('UPDATE users SET town_name=? WHERE id=?',name,row.user_id);
    return row;
  }
  function valid(row) {if(!row)reject('identity'); normalizeName(row.name); return row;}
  return {
    get,
    ensure:transact((ref,userId,cookieName,now)=>{
      let row=get(ref);
      if (userId && !one('SELECT 1 FROM users WHERE id=? AND deleted_at IS NULL',userId)) reject('identity');
      if(!row){let name=userId&&one('SELECT town_name FROM users WHERE id=?',userId)?.town_name;
        try{name=normalizeName(name||cookieName);}catch{name=randomName();}
        run('INSERT INTO town_names(ref,user_id,name,seen) VALUES(?,?,?,?)',ref,userId||null,name,now);
        if(userId)run('UPDATE users SET town_name=? WHERE id=?',name,userId); row=get(ref);
      }
      try{valid(row);}catch{row=replace(ref,randomName(),now);}
      run('UPDATE town_names SET seen=? WHERE ref=?',now,ref);return row;
    }),
    save:transact((ref,name,now,{candidate=false}={})=>{
      const row=valid(get(ref));name=normalizeName(name);
      if(row.locked_until>now&&!candidate)reject('name_locked');
      if(name===row.name)return row;
      if(one('SELECT count(*) n FROM town_changes WHERE ref=? AND at>?',ref,now-day).n>=3)reject('name_rate');
      run('INSERT INTO town_changes VALUES(?,?)',ref,now);return replace(ref,name,now);
    }),
    limit:transact((key,now,max,window=60000)=>{
      run('DELETE FROM town_rates WHERE expires<=?',now);
      const row=one('SELECT * FROM town_rates WHERE key=?',key);
      if(row?.count>=max)return false;
      if(!row&&one('SELECT count(*) n FROM town_rates').n>=4000)return false;
      run('INSERT INTO town_rates VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',key,now+window);return true;
    }),
    issue:transact((ref,origin,now)=>{
      valid(get(ref));run('DELETE FROM town_tickets WHERE expires<=? OR ref=?',now,ref);
      if(one('SELECT count(*) n FROM town_tickets').n>=400)reject('busy');
      const token=randomBytes(32).toString('base64url');run('INSERT INTO town_tickets VALUES(?,?,?,?)',digest(token),ref,origin,now+30000);return token;
    }),
    consume:transact((token,origin,now)=>{
      if(typeof token!=='string'||!/^[\w-]{43}$/.test(token))reject('ticket');
      const row=one('DELETE FROM town_tickets WHERE hash=? RETURNING *',digest(token));
      if(!row||row.origin!==origin||row.expires<=now)return null;
      const name=get(row.ref);if(!name)return null;
      if(name.user_id&&!one('SELECT 1 FROM users WHERE id=? AND deleted_at IS NULL',name.user_id))return null;
      try{return valid(name);}catch{return null;}
    }),
    presence(actor,ref,room,revision,now){run('INSERT INTO town_presence VALUES(?,?,?,?,?) ON CONFLICT(ref) DO UPDATE SET actor=excluded.actor,room=excluded.room,revision=excluded.revision,expires=excluded.expires',actor,ref,room,revision,now+45000);},
    leave(ref){run('DELETE FROM town_presence WHERE ref=?',ref);},
    clearPresence(){run('DELETE FROM town_presence');},
    report:transact((reporter,actor,now)=>{
      const target=one('SELECT * FROM town_presence WHERE actor=? AND expires>?',actor,now),self=one('SELECT * FROM town_presence WHERE ref=? AND expires>?',reporter,now);
      if(!target||!self||target.room!==self.room||target.ref===reporter)reject('report_target');
      const row=valid(get(target.ref));if(row.revision!==target.revision)reject('report_stale');
      run('INSERT OR IGNORE INTO town_reports VALUES(?,?,?,?)',row.ref,row.revision,reporter,now);
      const count=one('SELECT count(*) n FROM town_reports WHERE target=? AND revision=?',row.ref,row.revision).n;
      if(count>=3){run('INSERT OR IGNORE INTO town_reviews VALUES(?,?,?,?,?,?,?)',randomUUID(),row.ref,row.revision,row.name,count,'pending',now);
        replace(row.ref,randomName(row.name),now,now+day);}
      return {accepted:true};
    }),
    reviews(){return db.prepare("SELECT id,name,reports FROM town_reviews WHERE status='pending' ORDER BY created LIMIT 100").all();},
    moderate:transact(({id,action,requestId,actor,now})=>{
      const previous=one('SELECT * FROM town_audit WHERE request_id=?',requestId);
      if(previous){if(previous.review_id!==id||previous.action!==action||previous.actor!==actor)reject('request_conflict');return previous.result;}
      const row=one("SELECT * FROM town_reviews WHERE id=? AND status='pending'",id);if(!row)reject('review');
      if(action==='reset')replace(row.target,randomName(get(row.target).name),now,now+7*day);
      run('UPDATE town_reviews SET status=? WHERE id=?',action,id);
      run('INSERT INTO town_audit VALUES(?,?,?,?,?,?)',requestId,actor,id,action,'ok',now);return 'ok';
    }),
    cleanup(now){db.transaction(()=>{run('DELETE FROM town_changes WHERE at<?',now-day);run('DELETE FROM town_tickets WHERE expires<=?',now);run('DELETE FROM town_presence WHERE expires<=?',now);run('DELETE FROM town_rates WHERE expires<=?',now);run('DELETE FROM town_reports WHERE at<?',now-30*day);run("DELETE FROM town_reviews WHERE status<>'pending' AND created<?",now-30*day);run('DELETE FROM town_audit WHERE at<?',now-90*day);run('DELETE FROM town_names WHERE user_id IS NULL AND seen<?',now-365*day);}).immediate();}
  };
}
