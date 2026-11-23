import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createTownCore} from './town-realtime.mjs';
import {initializeTownFile,openIsolatedTown} from './town-isolated.mjs';
import {draftTownNames} from './town-name-policy.mjs';

const origin='https://staging.chuamay.org';
function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'town-recovery-'));
  const folder=path.join(dir,'staging','town');fs.mkdirSync(folder,{recursive:true});
  const file=path.join(folder,'town.sqlite');initializeTownFile('staging',file);
  let now=Date.now(),resource,core;
  const cfg={bounds:[-20,20,-20,20],speed:3.1,cap:16,
    spawns:[-6,-2,2,6].map(x=>({x,z:10,yaw:3.14})),
    seats:{'seat-1':{id:'seat-1',kind:'sit',x:0,z:0,yaw:3.14},'seat-2':{id:'seat-2',kind:'sit',x:2,z:0,yaw:3.14}}};
  const scenes={town:{...cfg,cap:20},chuamay:{...cfg}};
  function start(){resource=openIsolatedTown('staging',file,draftTownNames);core=createTownCore({store:resource.store,scenes,clock:()=>now});}
  start();
  t.after(()=>{core.stop();resource.db.close();assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert(path.basename(dir).startsWith('town-recovery-'));fs.rmSync(dir,{recursive:true,force:true});});
  function person(ref='guest:a',scene='town'){
    resource.store.ensure(ref,ref.startsWith('user:')?ref.slice(5):null,'Tâm An',now);
    const messages=[];let closed=false,seq=0;
    const c=core.connect({origin,send:m=>messages.push(m),close:()=>closed=true});assert(c);
    const send=(type,data={})=>core.receive(c,{v:1,seq:++seq,type,...data});
    send('enter',{scene,ticket:resource.store.issue(ref,origin,now)});
    return {c,send,messages,ref,get closed(){return closed;},get snapshot(){return messages.find(m=>m.type==='snapshot');}};
  }
  function walk(p,target=[0,0]){now+=10000;p.send('move',{from:[...p.c.member.at],target,at:now});assert.equal(p.messages.at(-1).type,'move');now+=10000;p.send('ping',{background:false});core.tick();}
  function sit(p){walk(p);p.send('claim',{seat:'seat-1'});p.send('state',{value:'sit',seconds:null});assert.equal(p.c.member.state,'sit');}
  return {person,walk,sit,scenes,file,get core(){return core;},get db(){return resource.db;},advance:n=>now+=n,
    restart({crash=false,delay=3000}={}){if(!crash)core.stop();resource.db.close();now+=delay;start();}};
}

for(const ref of ['guest:a','user:synthetic']){
  test(`${ref}: standing disconnect restores exact position and rotates actor`,t=>{
    const f=fixture(t),a=f.person(ref);f.walk(a,[1,2]);const actor=a.c.member.actor;
    f.core.disconnect(a.c);f.advance(20000);const b=f.person(ref);
    assert.deepEqual(b.c.member.at,[1,2]);assert.notEqual(b.snapshot.self,actor);assert.equal(b.snapshot.seats.length,0);
  });
  test(`${ref}: seated disconnect and background return restore snapshot ownership`,t=>{
    const f=fixture(t),a=f.person(ref);f.sit(a);let actor=a.c.member.actor;
    f.core.disconnect(a.c);f.advance(20000);const b=f.person(ref);
    assert.notEqual(b.snapshot.self,actor);assert.deepEqual(b.c.member.at,[0,0]);
    assert.equal(b.snapshot.members.find(m=>m.actor===b.snapshot.self).state,'sit');
    assert.equal(b.snapshot.seats[0].actor,b.snapshot.self);
    actor=b.snapshot.self;b.send('ping',{background:true});f.advance(20000);const c=f.person(ref);
    assert(b.closed);assert.notEqual(c.snapshot.self,actor);assert.equal(c.snapshot.seats[0].actor,c.snapshot.self);
    assert.equal(c.c.member.state,'sit');assert.deepEqual(c.c.member.at,[0,0]);
  });
}

for(const crash of [false,true])test(`file database reopen retains two standing positions (crash=${crash})`,t=>{
  const f=fixture(t),a=f.person('guest:a');f.walk(a,[-3,1]);const b=f.person('guest:b');f.walk(b,[3,1]);
  const actors=[a.c.member.actor,b.c.member.actor];f.restart({crash});
  const aa=f.person('guest:a'),bb=f.person('guest:b');
  assert.deepEqual(aa.c.member.at,[-3,1]);assert.deepEqual(bb.c.member.at,[3,1]);
  assert.notEqual(aa.snapshot.self,actors[0]);assert.notEqual(bb.snapshot.self,actors[1]);
  assert.equal(bb.snapshot.room,aa.snapshot.room);
  assert.deepEqual(bb.snapshot.members.find(m=>m.actor===aa.snapshot.self).at,[-3,1]);
});

test('restart restores reserved seat before owner returns; no second claimant can take it',t=>{
  const f=fixture(t),a=f.person();f.sit(a);const until=a.c.member.seat.until;
  f.restart();const other=f.person('guest:b');other.send('claim',{seat:'seat-1'});
  assert.equal(other.messages.at(-1).code,'seat_busy');
  const b=f.person();assert.equal(b.snapshot.seats[0].actor,b.snapshot.self);
  assert.equal(b.snapshot.seats[0].until,until);assert.equal(b.c.member.state,'sit');
  assert(!JSON.stringify(b.snapshot).includes('guest:'));
});

test('standing recovery expires at 60 seconds, including join before tick',t=>{
  const f=fixture(t),a=f.person();f.walk(a,[0,0]);f.core.disconnect(a.c);f.advance(60000);
  const b=f.person();assert.notDeepEqual(b.c.member.at,[0,0]);assert.equal(b.c.member.seat,null);
});

test('expired disconnect and background seat deadlines cannot be reset by reconnect',t=>{
  const f=fixture(t),a=f.person();f.sit(a);a.send('ping',{background:true});f.advance(80000);
  f.core.disconnect(a.c);f.advance(10000);const b=f.person();
  assert.equal(b.c.member.seat,null);assert.equal(b.snapshot.seats.length,0);
  f.sit(b);f.core.disconnect(b.c);f.advance(60000);const c=f.person();assert.equal(c.c.member.seat,null);
});

test('expired reservation is not resurrected across a restart',t=>{
  const f=fixture(t),a=f.person();a.send('claim',{seat:'seat-1'});f.restart({delay:15000});
  const b=f.person();assert.equal(b.snapshot.seats.length,0);assert.equal(b.c.member.seat,null);
});

test('explicit leave and switching scenes discard old recovery and seats',t=>{
  const f=fixture(t),a=f.person();f.sit(a);a.send('leave');
  assert.equal(f.db.prepare('SELECT count(*) n FROM town_recovery').get().n,0);
  f.restart();const b=f.person();assert.equal(b.c.member.seat,null);assert.notDeepEqual(b.c.member.at,[0,0]);
  f.sit(b);const c=f.person('guest:a','chuamay');assert.equal(c.snapshot.scene,'chuamay');assert.equal(c.c.member.seat,null);
  f.restart();const d=f.person('guest:a','town');assert.equal(d.c.member.seat,null);assert.notDeepEqual(d.c.member.at,[0,0]);
});

test('new entrants avoid occupied spawn points, then use a separated 0.8–1.5m offset',t=>{
  const f=fixture(t),people=[];
  for(let i=0;i<12;i++){
    const p=f.person('guest:'+i),at=p.c.member.at;
    for(const other of people)assert(Math.hypot(at[0]-other[0],at[1]-other[1])>=.8-1e-9);
    if(i<4)assert(f.scenes.town.spawns.some(s=>at[0]===s.x&&at[1]===s.z));
    else assert(f.scenes.town.spawns.some(s=>{const d=Math.hypot(at[0]-s.x,at[1]-s.z);return d>=.8-1e-9&&d<=1.5+1e-9;}));
    people.push(at);
  }
});

test('spawn offsets stay inside bounds; impossible space is refused, not overlapped',t=>{
  const f=fixture(t);f.scenes.town={...f.scenes.town,bounds:[0,.1,0,.1],spawns:[{x:0,z:0,yaw:0}]};
  f.person('guest:a');const b=f.person('guest:b');assert.equal(b.snapshot,undefined);assert.equal(b.messages.at(-1).code,'spawn_busy');
});

test('independent database v3 upgrade is idempotent; recovery never creates users',t=>{
  const f=fixture(t);f.db.exec('DROP TABLE town_recovery; DELETE FROM town_schema WHERE version=4');
  f.restart();assert.equal(f.db.prepare('SELECT count(*) n FROM town_recovery').get().n,0);
  assert(f.db.prepare('SELECT 1 FROM town_schema WHERE version=4').get());
  assert.equal(f.db.prepare("SELECT 1 FROM sqlite_master WHERE name='users'").get(),undefined);
  f.restart();assert.equal(f.db.prepare('SELECT count(*) n FROM town_recovery').get().n,0);
});

test('deleted identity clears recovery without a foreign-key failure',t=>{
  const f=fixture(t),a=f.person('user:synthetic');f.sit(a);
  f.db.prepare('DELETE FROM town_names WHERE ref=?').run(a.ref);
  f.advance(1000);assert.doesNotThrow(()=>f.core.tick());assert(a.closed);
  assert.equal(f.db.prepare('SELECT count(*) n FROM town_recovery').get().n,0);
});

test('opening a database without schema3 cannot silently initialize it',t=>{
  const f=fixture(t);f.db.exec('DELETE FROM town_schema WHERE version=3; DROP TABLE town_recovery');
  assert.throws(()=>openIsolatedTown('staging',f.file,draftTownNames),/town_separate_database_required/);
  assert.equal(f.db.prepare("SELECT 1 FROM sqlite_master WHERE name='town_recovery'").get(),undefined);
});

test('disconnect while moving freezes authoritative position as standing',t=>{
  const f=fixture(t),a=f.person();f.advance(10000);
  a.send('move',{from:[...a.c.member.at],target:[0,0],at:Date.now()});f.advance(500);
  f.core.disconnect(a.c);const at=[...a.c.member.at];f.restart();const b=f.person();
  assert.deepEqual(b.c.member.at,at);assert.equal(b.c.member.state,'stand');
});
