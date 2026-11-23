import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import Database from 'better-sqlite3';
import {WebSocketServer} from './town-realtime/ws.mjs';
import {createTownSocketServer} from './town-ws.mjs';
import {startTownProcess} from './town-process.mjs';
import {loadTownScenes} from './town-scenes.mjs';
import {migrateTown} from './town-migrate.mjs';
import {openTownStore} from './town-store.mjs';

const seats=new URL('./town-seats.TEST.json',import.meta.url);
const scenes=loadTownScenes(seats,{allowTest:true}),origin='https://staging.chuamay.org';

for(const code of ['SQLITE_BUSY','SQLITE_LOCKED','SQLITE_IOERR',undefined])test(`timer handles only SQLITE_BUSY as retryable: ${code}`,async t=>{
  t.mock.timers.enable({apis:['setInterval']});
  const logs=[],app=createTownSocketServer({WebSocketServer,store:{},scenes,origins:new Set([origin]),environment:'staging',log:e=>logs.push(e.code),memory:()=>0});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  let calls=0;const tick=t.mock.method(app.core,'tick',()=>{if(++calls===1)throw Object.assign(Error('store failure'),{code});});
  const stop=t.mock.method(app.core,'stop',()=>{});
  try{
    t.mock.timers.tick(1000);
    if(code==='SQLITE_BUSY'){
      assert.deepEqual(logs,['store_busy']);assert.equal(stop.mock.callCount(),0);assert(app.server.listening);
      t.mock.timers.tick(1000);assert.equal(tick.mock.callCount(),2,'next timer round resumes');
    }else{
      assert.deepEqual(logs,['store']);assert.equal(stop.mock.callCount(),1);assert.equal(app.server.listening,false);
      t.mock.timers.tick(1000);assert.equal(tick.mock.callCount(),1,'fatal timer stays stopped');
    }
  }finally{await app.close();}
});

test('real isolated WAL writer lock waits about 2 seconds, preserves member, then refreshes after unlock',async t=>{
  const archive=fileURLToPath(new URL('../_archive/',import.meta.url));await mkdir(archive,{recursive:true});
  const dir=await mkdtemp(path.join(archive,'town-lock-')),stage=path.join(dir,'staging');await mkdir(stage);
  const db=new Database(path.join(stage,'town.sqlite'));db.pragma('journal_mode = WAL');
  migrateTown(db,'staging',{isolated:true});
  const store=openTownStore(db,'staging',{isolated:true});store.ensure('guest:lock',null,'Tâm An',Date.now());
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
  t.mock.timers.enable({apis:['setInterval','Date'],now:Date.now()});
  const logs=[];t.mock.method(console,'log',value=>logs.push(value));
  let process;
  try{
    process=await startTownProcess({CHUAMAY_ENV:'staging',TOWN_REALTIME_ENABLED:'1',TOWN_DB_PATH:path.join(stage,'town.sqlite'),TOWN_PORT:String(port),TOWN_SEATS_PATH:fileURLToPath(seats),TOWN_ALLOW_TEST_SEATS:'1'});
    const messages=[];let closed=false;
    const c=process.app.core.connect({origin,send:m=>messages.push(m),close:()=>{closed=true;}});
    process.app.core.receive(c,{v:1,seq:1,type:'enter',scene:'town',ticket:store.issue('guest:lock',origin,Date.now())});
    assert.equal(messages[0].type,'snapshot');
    db.prepare("UPDATE town_names SET name='admin',fallback_name='' WHERE ref=?").run('guest:lock');db.exec('BEGIN IMMEDIATE');
    const before=performance.now();t.mock.timers.tick(1000);const waited=performance.now()-before;
    assert(waited>=1500,`actual lock wait ${waited}ms must exceed old 100ms timeout`);
    assert(logs.some(line=>JSON.parse(line).code==='store_busy'));assert(process.app.server.listening);
    assert.equal(closed,false);assert.equal(process.app.core.counts().connections,1);
    db.exec('ROLLBACK');db.prepare('UPDATE town_names SET name=?,revision=revision+1 WHERE ref=?').run('An Nhiên','guest:lock');
    t.mock.timers.tick(1000);
    assert(messages.some(m=>m.type==='state'&&m.name==='An Nhiên'),'next round reads the database after unlock');
    assert.equal(closed,false);assert(process.app.server.listening);
  }finally{
    if(db.inTransaction)db.exec('ROLLBACK');
    if(process)await process.stop();db.close();
    assert.equal(path.dirname(path.resolve(dir)),path.resolve(archive));await rm(dir,{recursive:true});
  }
});
