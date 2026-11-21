import {randomUUID,randomInt} from 'node:crypto';
export const limits=Object.freeze({connections:200,payload:2048,buffer:32768,memory:300000000});
export function vietnamPeriod(now){const hour=new Date(now+7*3600000).getUTCHours();return hour>=5&&hour<7?'dawn':hour>=7&&hour<17?'day':hour>=17&&hour<19?'dusk':'night';}
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const fields={enter:['scene','ticket','room'],leave:[],move:['from','target','at'],state:['value','seconds'],claim:['seat'],release:['seat'],ping:['background','continueSeat']};
export function createTownCore({store,scenes,clock=Date.now,log=()=>{}}){
  if(!scenes?.town||!scenes?.chuamay||!scenes?.suoi||!scenes?.lientri)throw Error('seats_required');
  const connections=new Set(),members=new Map(),rooms=new Map();
  function send(c,type,data={}){if(!c.closed)c.send({v:1,seq:++c.out,type,...data});}
  const result=(c,code)=>send(c,'state',{actor:c.member?.actor||null,state:c.member?.state||'stand',code});
  function broadcast(room,type,data={}){room.seq++;for(const m of room.members.values())if(m.connection)send(m.connection,type,{room:room.id,roomSeq:room.seq,...data});}
  function position(m,now=clock()){if(!m.motion)return [...m.at];const f=Math.min(1,(now-m.motion.start)/m.motion.duration);return m.at.map((n,i)=>n+(m.motion.target[i]-n)*f);}
  const view=m=>({actor:m.actor,name:m.name,at:position(m),target:m.motion?.target||position(m),state:m.state,seat:m.seat?.id||null});
  function presence(m){store.presence(m.actor,m.ref,m.room.id,m.revision,clock());}
  function release(m,reason){if(!m.seat)return;const id=m.seat.id;m.room.seats.delete(id);m.seat=null;m.state='stand';broadcast(m.room,'release',{actor:m.actor,seat:id,reason});}
  function remove(m){release(m,'leave');m.room.members.delete(m.ref);members.delete(m.ref);store.leave(m.ref);broadcast(m.room,'gone',{actor:m.actor});if(!m.room.members.size)rooms.delete(m.room.id);if(m.connection)m.connection.member=null;}
  function roomFor(scene,hint){
    const wanted=rooms.get(hint);if(wanted?.scene===scene&&wanted.members.size<scenes[scene].cap)return wanted;
    const used=[...rooms.values()].filter(r=>r.scene===scene&&r.members.size<scenes[scene].cap).sort((a,b)=>b.members.size-a.members.size);
    if(used.length)return used[0];const room={id:randomUUID(),scene,seq:0,members:new Map(),seats:new Map()};rooms.set(room.id,room);return room;
  }
  function join(c,scene,hint){
    if(!Object.hasOwn(scenes,scene)||!scenes[scene]?.bounds)return result(c,'scene');
    let old=members.get(c.ref);if(old&&old.room.scene!==scene){remove(old);old=null;}
    const profile=store.public(c.ref);if(!profile){disconnect(c,true);return;}
    let m=old;
    if(m){broadcast(m.room,'gone',{actor:m.actor});m.actor=randomUUID();m.connection=c;m.disconnected=null;m.background=null;}
    else{const room=roomFor(scene,hint),spawn=scenes[scene].spawns[randomInt(scenes[scene].spawns.length)];m={ref:c.ref,actor:randomUUID(),room,connection:c,at:[spawn.x,spawn.z],yaw:spawn.yaw,motion:null,state:'stand',seat:null,background:null,disconnected:null,lastTarget:[spawn.x,spawn.z],lastTargetAt:clock()};members.set(c.ref,m);room.members.set(c.ref,m);}
    m.name=profile.name;m.revision=profile.revision;c.member=m;presence(m);
    const p=position(m);send(c,'snapshot',{room:m.room.id,scene,roomSeq:m.room.seq,self:m.actor,spawn:{x:p[0],z:p[1],yaw:m.yaw},period:vietnamPeriod(clock()),serverTime:clock(),members:[...m.room.members.values()].filter(p=>p.connection).map(view),seats:[...m.room.seats.values()].map(s=>({seat:s.id,actor:s.owner.actor,phase:s.phase,until:s.until}))});
    broadcast(m.room,'join',view(m));
  }
  function disconnect(c,terminate=false,at=clock()){if(c.closed)return;c.closed=true;connections.delete(c);const m=c.member;
    if(m&&m.connection===c){m.at=position(m);m.motion=null;m.connection=null;m.disconnected=at;store.leave(m.ref);broadcast(m.room,'gone',{actor:m.actor});if(!m.seat)remove(m);}
    if(terminate)c.close();
  }
  function connect({send:write,close,origin}){if(connections.size>=limits.connections)return null;const c={send:write,close,origin,in:0,out:0,ref:null,member:null,closed:false,opened:clock(),seen:clock(),bucket:clock(),count:0,lastMove:-Infinity,lastSeat:-Infinity,rejected:[],cooldown:0};connections.add(c);return c;}
  function claimResult(c,ok,code,seat=null,nearest=null){if(!ok){const now=clock();c.rejected=c.rejected.filter(at=>at>now-60000);c.rejected.push(now);if(c.rejected.length>=5)c.cooldown=now+30000;}send(c,'claim-result',{ok,code,seat,nearest,cooldownUntil:c.cooldown});}
  function receive(c,msg){
    if(c.closed)return;
    const now=clock();if(now-c.bucket>=1000){c.bucket=now;c.count=0;}if(++c.count>15){log({code:'rate'});disconnect(c,true);return;}
    if(!msg||Array.isArray(msg)||msg.v!==1||!Number.isSafeInteger(msg.seq)||msg.seq!==c.in+1||!Object.hasOwn(fields,msg.type)||Object.keys(msg).some(k=>!['v','seq','type',...fields[msg.type]].includes(k))){result(c,'protocol');disconnect(c,true);return;}
    c.in=msg.seq;c.seen=now;
    if(!c.ref){
      if(msg.type!=='enter'){result(c,'ticket');disconnect(c,true);return;}const identity=store.consume(msg.ticket,c.origin,now);if(!identity){result(c,'ticket');disconnect(c,true);return;}
      for(const other of [...connections])if(other!==c&&other.ref===identity.ref)disconnect(other,true);
      c.ref=identity.ref;join(c,msg.scene,msg.room);return;
    }
    if(msg.ticket!==undefined){result(c,'protocol');return;}
    if(msg.type==='enter'){join(c,msg.scene,msg.room);return;}
    const m=c.member;if(!m){if(msg.type==='ping'){send(c,'ping',{period:vietnamPeriod(now),serverTime:now});return;}return result(c,'scene_required');}
    const cfg=scenes[m.room.scene];
    if(msg.type==='leave'){remove(m);return;}
    if(msg.type==='ping'){
      if((msg.background!==undefined&&typeof msg.background!=='boolean')||(msg.continueSeat!==undefined&&typeof msg.continueSeat!=='boolean'))return result(c,'ping');
      if(msg.background===true){if(m.background===null)m.background=now;}else if(msg.background===false)m.background=null;
      if(msg.continueSeat&&m.seat?.phase==='occupied'&&m.seat.indefinite&&m.seat.prompted){m.seat.started=now;m.seat.until=now+32*60000;m.seat.prompted=false;}
      presence(m);send(c,'ping',{serverTime:now,period:vietnamPeriod(now)});return;
    }
    if(msg.type==='release'){if(msg.seat!==undefined&&msg.seat!==m.seat?.id)return result(c,'seat');release(m,'stand');return;}
    if(msg.type==='move'){
      if(now-c.lastMove<500){log({code:'move_rate'});return result(c,'move_rate');}c.lastMove=now;
      const t=msg.target,b=cfg.bounds,at=position(m,now);if(!Array.isArray(t)||t.length!==2||!t.every(Number.isFinite)||t[0]<b[0]||t[0]>b[1]||t[1]<b[2]||t[1]>b[3])return result(c,'move_bounds');
      if(!Array.isArray(msg.from)||msg.from.length!==2||!msg.from.every(Number.isFinite)||distance(msg.from,at)>.8||!Number.isFinite(msg.at))return result(c,'move_origin');
      if(distance(m.lastTarget,t)>cfg.speed*1.5*(now-m.lastTargetAt)/1000)return result(c,'move_speed');
      if(m.seat?.phase==='occupied')release(m,'move');m.at=at;m.motion={target:[...t],start:now,duration:Math.max(1,distance(at,t)/cfg.speed*1000)};m.lastTarget=[...t];m.lastTargetAt=now;m.state='walk';
      broadcast(m.room,'move',{actor:m.actor,from:at,target:t,at:now,duration:m.motion.duration});return;
    }
    if(msg.type==='claim'){
      if(c.cooldown>now)return send(c,'claim-result',{ok:false,code:'claim_cooldown',cooldownUntil:c.cooldown});
      if(now-c.lastSeat<2000){log({code:'seat_rate'});return claimResult(c,false,'seat_rate');}c.lastSeat=now;
      if(typeof msg.seat!=='string'||!Object.hasOwn(cfg.seats,msg.seat))return claimResult(c,false,'seat_unknown');
      if(m.seat)return claimResult(c,false,'one_seat');
      if(m.room.seats.has(msg.seat)){const p=position(m);const nearest=Object.values(cfg.seats).filter(s=>!m.room.seats.has(s.id)).sort((a,b)=>distance(p,[a.x,a.z])-distance(p,[b.x,b.z]))[0]?.id||null;return claimResult(c,false,'seat_busy',msg.seat,nearest);}
      const seat={id:msg.seat,owner:m,phase:'reserved',until:now+15000};m.seat=seat;m.room.seats.set(seat.id,seat);claimResult(c,true,'reserved',seat.id);broadcast(m.room,'state',{...view(m),reservedUntil:seat.until});return;
    }
    if(msg.type==='state'){
      if(['stand','walk','incense','lamp'].includes(msg.value)){release(m,'stand');m.state=msg.value;m.at=position(m,now);m.motion=null;broadcast(m.room,'state',view(m));return;}
      if(!['sit','bow','mo'].includes(msg.value)||!m.seat||m.seat.phase!=='reserved'||m.seat.until<=now)return result(c,'seat_required');
      const seat=cfg.seats[m.seat.id];if(seat.kind!==msg.value||distance(position(m,now),[seat.x,seat.z])>.8)return result(c,'seat_required');
      if(msg.seconds!==null&&(!Number.isInteger(msg.seconds)||msg.seconds<1||msg.seconds>3600))return result(c,'duration');
      Object.assign(m.seat,{phase:'occupied',started:now,indefinite:msg.seconds===null,prompted:false,until:now+(msg.seconds===null?32*60:msg.seconds+120)*1000});m.state=msg.value;m.at=[seat.x,seat.z];m.motion=null;broadcast(m.room,'state',view(m));
    }
  }
  let refreshed=0;
  function tick(){const now=clock();for(const c of [...connections])if((!c.ref&&now-c.opened>=5000)||now-c.seen>=45000)disconnect(c,true,c.seen);
    for(const m of [...members.values()]){
      if(m.motion&&now>=m.motion.start+m.motion.duration){m.at=[...m.motion.target];m.motion=null;m.state='stand';broadcast(m.room,'state',view(m));}
      const seat=m.seat;
      if(seat&&((m.disconnected!==null&&now-m.disconnected>=60000)||(m.background!==null&&now-m.background>=90000)||now>=seat.until))release(m,'expired');
      if(m.seat?.phase==='occupied'&&m.seat.indefinite&&!m.seat.prompted&&now-m.seat.started>=30*60000){m.seat.prompted=true;if(m.connection)send(m.connection,'state',{actor:m.actor,state:m.state,code:'continue_seat',until:m.seat.until});}
      if(!m.connection&&!m.seat)remove(m);
    }
    if(now-refreshed>=1000){refreshed=now;for(const m of [...members.values()]){const profile=store.public(m.ref);if(!profile){if(m.connection)disconnect(m.connection,true);remove(m);continue;}if(profile.revision!==m.revision||profile.name!==m.name){m.name=profile.name;m.revision=profile.revision;if(m.connection){presence(m);broadcast(m.room,'state',view(m));}}}}
  }
  return {connect,receive,disconnect,tick,counts:()=>({connections:connections.size,rooms:[...rooms.values()].map(r=>r.members.size)}),stop(){for(const c of [...connections])disconnect(c,true);for(const m of [...members.values()])remove(m);}};
}
