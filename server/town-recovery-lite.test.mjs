import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTownCore} from './town-realtime.mjs';

function fixture(t){
  let now=1000000,core;
  const writes=[];
  const store={consume:ref=>({ref}),public:()=>({name:'Tâm An',revision:1}),
    presence:(...args)=>writes.push(['presence',...args]),leave:ref=>writes.push(['leave',ref])};
  const cfg={bounds:[-20,20,-20,20],speed:3.1,cap:16,
    spawns:[-6,-2,2,6].map(x=>({x,z:10,yaw:3.14})),
    seats:{'seat-1':{id:'seat-1',kind:'sit',x:0,z:0}}};
  const scenes={town:{...cfg,cap:20},chuamay:{...cfg}};
  const start=()=>core=createTownCore({store,scenes,clock:()=>now});start();t.after(()=>core.stop());
  function person(ref='guest:a',scene='town'){
    const messages=[];let seq=0;
    const c=core.connect({origin:'https://test.invalid',send:m=>messages.push(m),close:()=>{}});assert(c);
    const send=(type,data={})=>core.receive(c,{v:1,seq:++seq,type,...data});
    send('enter',{scene,ticket:ref});
    return {c,send,messages,get snapshot(){return messages.find(m=>m.type==='snapshot');}};
  }
  function walk(p,target=[0,0]){now+=10000;p.send('move',{from:[...p.c.member.at],target,at:now});assert.equal(p.messages.at(-1).type,'move');now+=10000;p.send('ping',{background:false});core.tick();}
  function sit(p){walk(p);p.send('claim',{seat:'seat-1'});p.send('state',{value:'sit',seconds:null});assert.equal(p.c.member.state,'sit');}
  return {person,walk,sit,scenes,writes,get core(){return core;},advance:n=>now+=n,restart(){core.stop();start();}};
}

for(const ref of ['guest:a','user:synthetic'])test(`${ref}: standing reconnect restores position for self and observer`,t=>{
  const f=fixture(t),a=f.person(ref);f.walk(a,[1,2]);const observer=f.person('guest:observer'),actor=a.snapshot.self;
  f.core.disconnect(a.c);f.advance(10000);f.core.tick();const b=f.person(ref);
  assert.deepEqual(b.c.member.at,[1,2]);assert.deepEqual([b.snapshot.spawn.x,b.snapshot.spawn.z],[1,2]);
  assert.notEqual(b.snapshot.self,actor);assert.equal(b.snapshot.room,a.snapshot.room);
  assert.deepEqual(observer.messages.at(-1).at,[1,2]);assert.equal(observer.messages.at(-1).actor,b.snapshot.self);
  assert(!b.snapshot.members.some(m=>m.actor===actor));assert.equal(b.snapshot.seats.length,0);
});

for(const tick of [false,true])test(`standing retention expires at 60s (tick=${tick})`,t=>{
  const f=fixture(t),a=f.person();f.walk(a);f.core.disconnect(a.c);f.advance(59999);
  f.core.tick();assert.deepEqual(f.core.counts().rooms,[1]);f.advance(1);if(tick)f.core.tick();
  const b=f.person();assert.notDeepEqual(b.c.member.at,[0,0]);assert.notEqual(b.snapshot.room,a.snapshot.room);
});

test('seated disconnect and 20s background keep existing seat ownership and deadline',t=>{
  const f=fixture(t),a=f.person();f.sit(a);const until=a.c.member.seat.until;
  f.core.disconnect(a.c);f.advance(20000);const b=f.person();
  assert.equal(b.c.member.state,'sit');assert.deepEqual(b.c.member.at,[0,0]);assert.equal(b.snapshot.seats[0].actor,b.snapshot.self);
  b.send('ping',{background:true});f.advance(20000);const c=f.person();
  assert.equal(c.c.member.state,'sit');assert.equal(c.snapshot.seats[0].actor,c.snapshot.self);assert.equal(c.snapshot.seats[0].until,until);
});

test('leave and scene switch discard position; service restart intentionally does not restore',t=>{
  const f=fixture(t),a=f.person();f.walk(a);a.send('leave');const b=f.person();assert.notDeepEqual(b.c.member.at,[0,0]);
  f.walk(b);const c=f.person('guest:a','chuamay');assert.notDeepEqual(c.c.member.at,[0,0]);
  f.walk(c);f.restart();const d=f.person('guest:a','chuamay');assert.notDeepEqual(d.c.member.at,[0,0]);
});

test('disconnect during motion freezes authoritative position and idle ticks add no writes',t=>{
  const f=fixture(t),a=f.person();f.advance(10000);a.send('move',{from:[...a.c.member.at],target:[0,0],at:1010000});
  f.advance(500);f.core.disconnect(a.c);const at=[...a.c.member.at],writes=f.writes.length;
  for(let i=0;i<10;i++){f.advance(1000);f.core.tick();}assert.equal(f.writes.length,writes);
  const b=f.person();assert.deepEqual(b.c.member.at,at);assert.equal(b.c.member.state,'stand');
});

test('first four spawns have 1m clearance; crowded offsets are 0.85–1.5m and separated by 0.8m',t=>{
  const f=fixture(t),people=[];
  for(let i=0;i<20;i++){
    const p=f.person('guest:'+i),at=p.c.member.at;
    for(const other of people)assert(Math.hypot(at[0]-other[0],at[1]-other[1])>=(i<4?1:.8));
    if(i<4)assert(f.scenes.town.spawns.some(s=>at[0]===s.x&&at[1]===s.z));
    else assert(f.scenes.town.spawns.some(s=>{const d=Math.hypot(at[0]-s.x,at[1]-s.z);return d>=.85-1e-9&&d<=1.5+1e-9;}));
    people.push(at);if(i===0)f.core.disconnect(p.c);
  }
});

test('offset remains in bounds; no safe space refuses entry instead of overlapping',t=>{
  const f=fixture(t);f.scenes.town={...f.scenes.town,bounds:[0,2,0,2],spawns:[{x:0,z:0,yaw:0}]};
  f.person();const b=f.person('guest:b'),at=b.c.member.at;assert(at.every(n=>n>=0&&n<=2));assert(Math.hypot(...at)>=.85-1e-9);
  f.scenes.chuamay={...f.scenes.chuamay,bounds:[0,.1,0,.1],spawns:[{x:0,z:0,yaw:0}]};
  f.person('guest:c','chuamay');const d=f.person('guest:d','chuamay');assert.equal(d.snapshot,undefined);assert.equal(d.messages.at(-1).code,'spawn_busy');
});

for(const delay of [59999,60000])test(`stale connection retains position for 60s after detection (${delay}ms)`,t=>{
  const f=fixture(t),a=f.person();f.walk(a,[1,2]);const lastSeen=a.c.seen;
  f.advance(44999);f.core.tick();assert.equal(a.c.closed,false);
  f.advance(1);f.core.tick();assert.equal(a.c.closed,true);
  assert.equal(a.c.member.disconnected,lastSeen+45000);
  f.advance(delay);f.core.tick();const b=f.person();
  if(delay<60000){assert.deepEqual(b.c.member.at,[1,2]);assert.equal(b.snapshot.room,a.snapshot.room);}
  else{assert.notDeepEqual(b.c.member.at,[1,2]);assert.notEqual(b.snapshot.room,a.snapshot.room);}
});
