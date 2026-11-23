import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {createServer} from 'node:http';
import Database from 'better-sqlite3';
import {migrateTown} from './town-migrate.mjs';
import {openTownStore} from './town-store.mjs';
import {initializeTownFile,openIsolatedTown,refreshTownAccounts,createTownFeature,townDatabasePath} from './town-isolated.mjs';
import {loadTownNamePolicy,draftTownNames} from './town-name-policy.mjs';
import {createTownApi,townPrefix} from './town-api.mjs';
import {createTownCore,connectionLimit} from './town-realtime.mjs';
import {loadTownScenes} from './town-scenes.mjs';
import {startTownProcess} from './town-process.mjs';
import {WebSocket} from './town-realtime/ws.mjs';
import {createTownAccess} from '../town-access.js';
import {createServer as createApiServer} from './app.mjs';

const base=fileURLToPath(new URL('../_archive/',import.meta.url));
fs.mkdirSync(base,{recursive:true});
const origin='https://h5.chuamay.org';
function fixture(t){
  const root=fs.mkdtempSync(path.join(base,'town-production-')),dir=path.join(root,'production');fs.mkdirSync(dir);
  const file=path.join(dir,'town.sqlite');initializeTownFile('production',file);
  const pool={version:1,reviewed:true,names:Array.from({length:7},(_,i)=>({id:i+1,vi:draftTownNames.candidate(i+1)}))};
  const poolPath=path.join(root,'names.SYNTHETIC-TEST.json');fs.writeFileSync(poolPath,JSON.stringify(pool));
  const sha=createHash('sha256').update(fs.readFileSync(poolPath)).digest('hex'),names=loadTownNamePolicy(poolPath,sha);
  const {db,store}=openIsolatedTown('production',file,names);
  const main=new Database(path.join(dir,'api.sqlite'));main.exec("CREATE TABLE users(id TEXT PRIMARY KEY,deleted_at TEXT);INSERT INTO users VALUES('test-account',NULL)");
  const cleanup=[];
  t.after(async()=>{for(const fn of cleanup.reverse())await fn();if(main.open)main.close();if(db.open)db.close();assert.equal(path.dirname(root),base.replace(/[\\/]$/,''));fs.rmSync(root,{recursive:true});});
  return {root,dir,file,poolPath,sha,names,db,store,main,after:fn=>cleanup.push(fn)};
}
test('isolated initialization never alters legacy main tables, cannot overwrite, no users copy',t=>{
  const f=fixture(t);migrateTown(f.main,'staging');
  const before=f.main.serialize();
  assert.throws(()=>initializeTownFile('production',f.file),/EEXIST/);
  assert.throws(()=>migrateTown(f.main,'production',{isolated:true}),/separate_database/);
  assert.deepEqual(f.main.serialize(),before);
  assert.equal(f.db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='users'").get().n,0);
  assert.equal(f.db.pragma('journal_mode',{simple:true}),'wal');
  assert.throws(()=>townDatabasePath('production',path.join(f.dir,'api.sqlite')),/separate_database/);
  assert.throws(()=>townDatabasePath('staging',f.file),/separate_database/);
  assert.throws(()=>townDatabasePath('production',f.dir+'/../staging/town.sqlite'),/separate_database/);
});

test('main database exclusive lock cannot block isolated ticket consumption or room snapshots',t=>{
  const f=fixture(t),now=Date.now(),reader=new Database(f.main.name,{timeout:10});
  f.after(()=>reader.close());f.store.ensure('guest:lock',null,null,now);
  const token=f.store.issue('guest:lock',origin,now);
  f.main.exec('BEGIN EXCLUSIVE');
  try{
    assert.throws(()=>reader.prepare('SELECT * FROM users').all(),/locked/);
    assert.equal(f.store.consume(token,origin,now).ref,'guest:lock');
    f.store.presence('actor','guest:lock','room',1,now);
    assert.equal(f.store.public('guest:lock').name,f.names.normalize(f.store.public('guest:lock').name));
  }finally{f.main.exec('ROLLBACK');}
});

test('town writer lock does not block main account writes; WAL readers remain available',t=>{
  const f=fixture(t),writer=new Database(f.file,{timeout:10}),reader=new Database(f.file,{readonly:true});
  f.after(()=>{writer.close();reader.close();});writer.exec('BEGIN IMMEDIATE');
  try{
    f.main.prepare("INSERT INTO users VALUES('independent',NULL)").run();
    assert.equal(f.main.prepare('SELECT count(*) n FROM users').get().n,2);
    assert(reader.prepare('SELECT * FROM town_schema').all().length>0);
  }finally{writer.exec('ROLLBACK');}
});

test('account refresh deletes only town projection and expired leases fail closed',t=>{
  const f=fixture(t),now=Date.now();
  f.store.ensure('user:test-account','test-account',null,now);refreshTownAccounts(f.main,f.db,now);
  assert(f.store.get('user:test-account'));
  const later=openTownStore(f.db,'production',{isolated:true,names:f.names,clock:()=>now+30001});
  assert.equal(later.get('user:test-account'),undefined);
  f.main.prepare('UPDATE users SET deleted_at=? WHERE id=?').run('deleted','test-account');
  refreshTownAccounts(f.main,f.db,now+1000);
  assert.equal(f.db.prepare('SELECT count(*) n FROM town_names').get().n,0);
  assert.equal(f.main.prepare('SELECT deleted_at FROM users').get().deleted_at,'deleted');
});

test('reviewed name policy rejects draft, wrong hash, free text, and old names outside replacement pool',t=>{
  const f=fixture(t);assert.throws(()=>loadTownNamePolicy(f.poolPath,'0'.repeat(64)),/hash/);
  const draftFile=path.join(f.root,'draft.json');fs.writeFileSync(draftFile,JSON.stringify({version:1,reviewed:false,names:[]}));
  assert.throws(()=>loadTownNamePolicy(draftFile,createHash('sha256').update(fs.readFileSync(draftFile)).digest('hex')),/reviewed/);
  assert.throws(()=>f.names.candidate(99999),/candidate/);assert.throws(()=>f.names.normalize('Tên Riêng'),/candidate/);
  f.store.ensure('guest:old',null,null,Date.now());f.db.prepare("UPDATE town_names SET name='Tên Riêng' WHERE ref='guest:old'").run();
  const publicName=f.store.public('guest:old').name;assert.equal(f.names.normalize(publicName),publicName);
  assert.equal(f.store.public('guest:old').name,publicName,'stable allowed fallback');
});

test('production API rejects typed names even with a valid candidate and accepts a reviewed choice',async t=>{
  const f=fixture(t),handler=createTownApi({environment:'production',origins:new Set([origin]),hashSecret:'synthetic-test-secret'},f.store,{names:f.names});
  const server=createServer(async(req,res)=>{await handler(req,res,new URL(req.url,'http://local').pathname);});
  server.listen(0,'127.0.0.1');await once(server,'listening');f.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}${townPrefix}/name`;
  const post=body=>fetch(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post({name:f.names.candidate(1)})).status,400);
  assert.equal((await post({name:'free',candidateId:1})).status,400);
  const ok=await post({candidateId:1});assert.equal(ok.status,200);assert.equal((await ok.json()).name,f.names.candidate(1));
});

test('two flags independent; defaults open no database and offer no multiplayer requests',async t=>{
  const f=fixture(t);
  for(const entry of [false,true])for(const realtime of [false,true]){
    const feature=createTownFeature({CHUAMAY_ENV:'production',TOWN_ENTRY_ENABLED:entry?'1':'0',TOWN_REALTIME_ENABLED:realtime?'1':'0',TOWN_DB_PATH:f.file,TOWN_NAME_POOL_PATH:f.poolPath,TOWN_NAME_POOL_SHA256:f.sha},{environment:'production',hashSecret:'synthetic-test',origins:new Set([origin])},f.main,{});
    let body;const response={writeHead(){},end(text){body=JSON.parse(text);}};
    await feature.handle({method:'GET'},response,townPrefix+'/config');
    assert.deepEqual(body,{entryEnabled:entry,realtimeEnabled:realtime});feature.close();
  }
  const feature=createTownFeature({}, {environment:'production'}, new Proxy({}, {get(){throw Error('must not touch main');}}),{});
  let flags;await feature.handle({method:'GET'},{writeHead(){},end(text){flags=JSON.parse(text);}},townPrefix+'/config');
  assert.deepEqual(flags,{entryEnabled:false,realtimeEnabled:false});feature.close();
  let calls=0;t.mock.method(globalThis,'fetch',()=>{calls++;throw Error('must not fetch');});
  for(const options of [{},{entryEnabled:true},{entryEnabled:false,realtimeEnabled:true}]){
    const access=createTownAccess(options);access.enter('town');assert.equal(access.mode,options.entryEnabled?'single':'hidden');access.close();
  }
  assert.equal(calls,0);
});

test('production HTTP CORS allows only configured page origins with credentials and CSRF preflight',async t=>{
  const f=fixture(t),settings={environment:'production',telegramEnabled:false,origins:new Set([origin,'https://miniapp.chuamay.org']),hashSecret:'synthetic-test'};
  const feature=createTownFeature({CHUAMAY_ENV:'production'},settings,f.main,{});
  const server=createApiServer(settings,{},undefined,feature.handle);server.listen(0,'127.0.0.1');await once(server,'listening');
  f.after(async()=>{feature.close();await new Promise(resolve=>server.close(resolve));});
  const url=`http://127.0.0.1:${server.address().port}${townPrefix}/config`;
  for(const allowed of settings.origins){const response=await fetch(url,{headers:{Origin:allowed}});assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),allowed);assert.equal(response.headers.get('access-control-allow-credentials'),'true');}
  const preflight=await fetch(url,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Headers':'x-csrf-token,content-type'}});
  assert.equal(preflight.status,204);assert(preflight.headers.get('access-control-allow-headers').includes('X-CSRF-Token'));
  assert.equal((await fetch(url,{headers:{Origin:'https://untrusted.invalid'}})).status,403);
});

test('API town connection has short busy timeout rather than blocking existing routes for two seconds',t=>{
  const f=fixture(t),api=openIsolatedTown('production',f.file,f.names,{timeout:50}),writer=new Database(f.file);
  f.after(()=>{writer.close();api.db.close();});
  assert.equal(api.db.pragma('busy_timeout',{simple:true}),50);
  writer.exec('BEGIN IMMEDIATE');const before=performance.now();
  try{assert.throws(()=>api.store.ensure('guest:busy',null,null,Date.now()),/locked/);assert(performance.now()-before<1000);f.main.prepare("INSERT INTO users VALUES('main-still-writes',NULL)").run();}
  finally{writer.exec('ROLLBACK');}
});

test('production has two scenes, per-room 20/16, opens more rooms; hard cap 120 not 36',t=>{
  const f=fixture(t),raw=JSON.parse(fs.readFileSync(new URL('./town-seats.TEST.json',import.meta.url)));raw.test=false;
  for(const cfg of Object.values(raw.scenes)){const p=cfg.spawns[0];cfg.spawns=[[-2,0],[2,0],[0,-2],[0,2]].map(([x,z])=>({...p,x:p.x+x,z:p.z+z}));}
  const scenePath=path.join(f.root,'synthetic-seats.json');fs.writeFileSync(scenePath,JSON.stringify(raw));
  const scenes=loadTownScenes(scenePath,{production:true});assert.deepEqual(Object.keys(scenes).sort(),['chuamay','town']);
  assert.equal(connectionLimit('staging'),40);assert.equal(connectionLimit('production'),120);
  const core=createTownCore({store:f.store,scenes,maxConnections:120});f.after(()=>core.stop());
  const rooms=[];for(let i=0;i<120;i++){
    const ref='guest:'+i;f.store.ensure(ref,null,null,Date.now());
    const c=core.connect({origin,close(){},send:message=>{if(message.type==='snapshot')rooms.push(message.room);}});assert(c);
    core.receive(c,{v:1,seq:1,type:'enter',scene:i<40?'town':'chuamay',ticket:f.store.issue(ref,origin,Date.now())});
  }
  assert.deepEqual(core.counts().rooms,[20,20,16,16,16,16,16]);
  assert.equal(new Set(rooms).size,7);assert.equal(core.connect({origin,send(){},close(){}}),null);
});

test('production runtime refuses draft/TEST/missing database and is inert when disabled',async t=>{
  const f=fixture(t),env={CHUAMAY_ENV:'production',TOWN_REALTIME_ENABLED:'1',TOWN_DB_PATH:f.file};
  assert.equal(await startTownProcess({CHUAMAY_ENV:'production'}),null);
  await assert.rejects(startTownProcess(env),/reviewed/);
  await assert.rejects(startTownProcess({...env,TOWN_NAME_POOL_PATH:f.poolPath,TOWN_NAME_POOL_SHA256:f.sha,TOWN_SEATS_PATH:fileURLToPath(new URL('./town-seats.TEST.json',import.meta.url)),TOWN_ALLOW_TEST_SEATS:'1'}),/seats_config/);
});

test('local production-mode runtime accepts reviewed synthetic inputs, caps 120, and logs only codes',async t=>{
  const f=fixture(t),raw=JSON.parse(fs.readFileSync(new URL('./town-seats.TEST.json',import.meta.url)));raw.test=false;
  const scenePath=path.join(f.root,'synthetic-seats.json');fs.writeFileSync(scenePath,JSON.stringify(raw));
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  t.mock.timers.enable({apis:['setInterval']});const logs=[];t.mock.method(console,'log',line=>logs.push(JSON.parse(line)));
  const runtime=await startTownProcess({CHUAMAY_ENV:'production',TOWN_REALTIME_ENABLED:'1',TOWN_DB_PATH:f.file,TOWN_NAME_POOL_PATH:f.poolPath,TOWN_NAME_POOL_SHA256:f.sha,TOWN_SEATS_PATH:scenePath,TOWN_PORT:String(port)});
  try{
    assert.equal(runtime.app.server.address().address,'127.0.0.1');assert.equal(runtime.app.server.maxConnections,120);
    t.mock.timers.tick(60000);assert.deepEqual(logs,[{code:'town_alive'}]);
    assert.equal(fs.readFileSync(new URL('../deploy/chuamay-town-production.service',import.meta.url),'utf8').includes('TOWN_REALTIME_ENABLED=0'),true);
  }finally{await runtime.stop();t.mock.timers.reset();}
});

test('staging isolated process uses existing loopback transport and leaves main file untouched',async t=>{
  const f=fixture(t),stage=path.join(f.root,'staging');fs.mkdirSync(stage);const file=path.join(stage,'town.sqlite');initializeTownFile('staging',file);
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const before=f.main.serialize();
  const process=await startTownProcess({CHUAMAY_ENV:'staging',TOWN_REALTIME_ENABLED:'1',TOWN_DB_PATH:file,TOWN_PORT:String(port),TOWN_SEATS_PATH:fileURLToPath(new URL('./town-seats.TEST.json',import.meta.url)),TOWN_ALLOW_TEST_SEATS:'1'});
  try{
    assert.equal(process.app.server.address().address,'127.0.0.1');assert.equal(process.app.server.maxConnections,40);
    const source=openIsolatedTown('staging',file,draftTownNames),ref='guest:smoke';
    source.store.ensure(ref,null,null,Date.now());const token=source.store.issue(ref,'https://staging.chuamay.org',Date.now());source.db.close();
    const ws=new WebSocket(`ws://127.0.0.1:${port}/town-ws`,{origin:'https://staging.chuamay.org'});f.after(()=>ws.terminate());
    await once(ws,'open');const received=once(ws,'message');ws.send(JSON.stringify({v:1,seq:1,type:'enter',scene:'town',ticket:token}));
    assert.equal(JSON.parse((await received)[0].toString()).type,'snapshot');
    assert.deepEqual(f.main.serialize(),before);
  }finally{await process.stop();}
});
