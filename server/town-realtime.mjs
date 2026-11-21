import {randomUUID} from 'node:crypto';
import roomData from './town-rooms.json' with {type:'json'};
export const limits=Object.freeze({connections:200,room:20,payload:2048,buffer:32768,memory:300000000,speed:6.2});
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const fields={enter:['scene','ticket'],leave:[],move:['target'],state:['value','seconds'],seat:['seat'],release:[],heartbeat:['background','continueSeat']};
export function createTownCore({store,clock=Date.now,scenes=roomData,log=()=>{}}){
  const connections=new Set(),members=new Map(),rooms=new Map();
  function send(c,type,data={}){if(!c.closed)c.send({v:1,seq:++c.out,type,...data});}
  const result=(c,code)=>send(c,'result',{code});
  function broadcast(room,type,data={}){room.seq++;for(const m of room.members.values())if(m.connection)send(m.connection,type,{room:room.id,roomSeq:room.seq,...data});}
  function position(m,now=clock()){if(!m.motion)return [...m.at];const f=Math.min(1,(now-m.motion.start)/m.motion.duration);return m.at.map((n,i)=>n+(m.motion.target[i]-n)*f);}
  const view=m=>({actor:m.actor,name:m.name,at:position(m),target:m.motion?.target||position(m),state:m.state,seat:m.seat?.id||null});
  function presence(m){store.presence(m.actor,m.ref,m.room.id,m.revision,clock());}
  function release(m,reason){if(!m.seat)return;const id=m.seat.id;m.room.seats.delete(id);m.seat=null;m.state='standing';broadcast(m.room,'release',{actor:m.actor,seat:id,reason});}
  function remove(m){release(m,'leave');m.room.members.delete(m.ref);members.delete(m.ref);store.leave(m.ref);broadcast(m.room,'leave',{actor:m.actor});if(!m.room.members.size)rooms.delete(m.room.id);if(m.connection)m.connection.member=null;}
  function roomFor(scene){const used=[...rooms.values()].filter(r=>r.scene===scene&&r.members.size<limits.room).sort((a,b)=>b.members.size-a.members.size);if(used.length)return used[0];const room={id:randomUUID(),scene,seq:0,members:new Map(),seats:new Map()};rooms.set(room.id,room);return room;}
  function join(c,scene){
    if(!Object.hasOwn(scenes,scene)||!scenes[scene]?.bounds)return result(c,'scene');
    let old=members.get(c.ref);
    if(old?.connection&&old.connection!==c)return result(c,'already_connected');
    if(old&&old.room.scene!==scene){remove(old);old=null;}
    const profile=store.get(c.ref);if(!profile){disconnect(c,true);return;}
    let m=old;
    if(m){broadcast(m.room,'leave',{actor:m.actor});m.actor=randomUUID();m.connection=c;m.disconnected=null;m.background=null;}
    else{const room=roomFor(scene);m={ref:c.ref,actor:randomUUID(),room,connection:c,at:[...scenes[scene].spawn],motion:null,state:'standing',seat:null,background:null,disconnected:null};members.set(c.ref,m);room.members.set(c.ref,m);}
    m.name=profile.name;m.revision=profile.revision;c.member=m;presence(m);
    send(c,'snapshot',{room:m.room.id,scene,roomSeq:m.room.seq,self:m.actor,members:[...m.room.members.values()].filter(p=>p.connection).map(view),seats:[...m.room.seats.values()].map(s=>({seat:s.id,actor:s.owner.actor,phase:s.phase,until:s.until}))});
    broadcast(m.room,'state',{...view(m)});
  }
  function disconnect(c,terminate=false,at=clock()){if(c.closed)return;c.closed=true;connections.delete(c);const m=c.member;
    if(m&&m.connection===c){m.at=position(m);m.motion=null;m.connection=null;m.disconnected=at;store.leave(m.ref);broadcast(m.room,'leave',{actor:m.actor});if(!m.seat)remove(m);}
    if(terminate)c.close();
  }
  function connect({send:write,close,origin}){if(connections.size>=limits.connections)return null;const c={send:write,close,origin,in:0,out:0,ref:null,member:null,closed:false,opened:clock(),seen:clock(),bucket:clock(),count:0,lastMove:-Infinity,lastSeat:-Infinity};connections.add(c);return c;}
  function receive(c,msg){
    if(c.closed)return;
    const now=clock();if(now-c.bucket>=1000){c.bucket=now;c.count=0;}if(++c.count>15){log({code:'rate'});disconnect(c,true);return;}
    if(!msg||Array.isArray(msg)||msg.v!==1||!Number.isSafeInteger(msg.seq)||msg.seq!==c.in+1||!Object.hasOwn(fields,msg.type)||Object.keys(msg).some(k=>!['v','seq','type',...fields[msg.type]].includes(k))){result(c,'protocol');disconnect(c,true);return;}
    c.in=msg.seq;c.seen=now;
    if(!c.ref){if(msg.type!=='enter'){result(c,'ticket');disconnect(c,true);return;}const identity=store.consume(msg.ticket,c.origin,now);if(!identity){result(c,'ticket');disconnect(c,true);return;}if([...connections].some(other=>other!==c&&other.ref===identity.ref)){result(c,'already_connected');disconnect(c,true);return;}c.ref=identity.ref;join(c,msg.scene);return;}
    if(msg.ticket!==undefined){result(c,'protocol');return;}
    if(msg.type==='enter'){join(c,msg.scene);return;}
    const m=c.member;if(!m){if(msg.type==='heartbeat'){send(c,'heartbeat');return;}return result(c,'scene_required');}
    const cfg=scenes[m.room.scene];
    if(msg.type==='leave'){remove(m);return result(c,'left');}
    if(msg.type==='heartbeat'){
      if(typeof msg.background!=='boolean'||(msg.continueSeat!==undefined&&typeof msg.continueSeat!=='boolean'))return result(c,'heartbeat');
      if(msg.background){if(m.background===null)m.background=now;}else m.background=null;
      if(msg.continueSeat&&m.seat?.phase==='sitting'&&m.seat.indefinite&&m.seat.prompted){m.seat.started=now;m.seat.until=now+32*60000;m.seat.prompted=false;}
      presence(m);send(c,'heartbeat',{serverTime:now});return;
    }
    if(msg.type==='release'){release(m,'stand');return result(c,'released');}
    if(msg.type==='move'){
      if(now-c.lastMove<250){log({code:'move_rate'});return result(c,'move_rate');}c.lastMove=now;
      const t=msg.target,b=cfg.bounds;if(!Array.isArray(t)||t.length!==2||!t.every(Number.isFinite)||t[0]<b[0]||t[0]>b[1]||t[1]<b[2]||t[1]>b[3])return result(c,'move_bounds');
      const at=position(m,now),length=distance(at,t);if(length>30)return result(c,'move_speed');
      if(m.seat?.phase==='sitting')release(m,'move');m.at=at;m.motion={target:[...t],start:now,duration:Math.max(1,length/limits.speed*1000)};m.state='walking';
      broadcast(m.room,'move',{actor:m.actor,target:t,duration:m.motion.duration});return;
    }
    if(msg.type==='seat'){
      if(now-c.lastSeat<1000){log({code:'seat_rate'});return result(c,'seat_rate');}c.lastSeat=now;
      if(typeof msg.seat!=='string'||!Object.hasOwn(cfg.seats,msg.seat))return result(c,'seat_unknown');
      if(m.seat)return result(c,'one_seat');if(m.room.seats.has(msg.seat))return result(c,'seat_busy');
      const seat={id:msg.seat,owner:m,phase:'reserved',until:now+15000};m.seat=seat;m.room.seats.set(seat.id,seat);broadcast(m.room,'seat',{actor:m.actor,seat:seat.id,phase:'reserved',until:seat.until});return;
    }
    if(msg.type==='state'){
      if(msg.value==='standing'){release(m,'stand');m.state='standing';m.at=position(m,now);m.motion=null;broadcast(m.room,'state',view(m));return;}
      if(msg.value!=='sitting'||!m.seat||m.seat.phase!=='reserved'||m.seat.until<=now||distance(position(m,now),cfg.seats[m.seat.id])>.8)return result(c,'seat_required');
      if(msg.seconds!==null&&(!Number.isInteger(msg.seconds)||msg.seconds<1||msg.seconds>3600))return result(c,'duration');
      Object.assign(m.seat,{phase:'sitting',started:now,indefinite:msg.seconds===null,prompted:false,until:now+(msg.seconds===null?32*60:msg.seconds+120)*1000});m.state='sitting';m.at=[...cfg.seats[m.seat.id]];m.motion=null;
      broadcast(m.room,'state',view(m));return;
    }
  }
  let refreshed=0;
  function tick(){const now=clock();for(const c of [...connections])if((!c.ref&&now-c.opened>=5000)||now-c.seen>=35000)disconnect(c,true,c.seen);
    for(const m of [...members.values()]){
      if(m.motion&&now>=m.motion.start+m.motion.duration){m.at=[...m.motion.target];m.motion=null;m.state='standing';broadcast(m.room,'state',view(m));}
      const seat=m.seat;
      if(seat&&((m.disconnected!==null&&m.disconnected!==undefined&&now-m.disconnected>=60000)||(m.background!==null&&now-m.background>=90000)||now>=seat.until))release(m,'expired');
      if(m.seat?.phase==='sitting'&&m.seat.indefinite&&!m.seat.prompted&&now-m.seat.started>=30*60000){m.seat.prompted=true;if(m.connection)send(m.connection,'result',{code:'continue_seat',until:m.seat.until});}
      if(!m.connection&&!m.seat)remove(m);
    }
    if(now-refreshed>=1000){refreshed=now;for(const m of [...members.values()]){const profile=store.get(m.ref);if(!profile){if(m.connection)disconnect(m.connection,true);remove(m);continue;}if(profile.revision!==m.revision){m.name=profile.name;m.revision=profile.revision;if(m.connection){presence(m);broadcast(m.room,'state',view(m));}}}}
  }
  return {connect,receive,disconnect,tick,counts:()=>({connections:connections.size,rooms:[...rooms.values()].map(r=>r.members.size)}),stop(){for(const c of [...connections])disconnect(c,true);for(const m of [...members.values()])remove(m);}};
}
