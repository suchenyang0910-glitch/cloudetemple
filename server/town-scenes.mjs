import {readFileSync} from 'node:fs';
export function loadTownScenes(file,{allowTest=false}={}){
  const data=JSON.parse(readFileSync(file,'utf8'));
  if(data.version!==1||typeof data.test!=='boolean'||(data.test&&!allowTest))throw Error('seats_config');
  if(data.test&&!String(file).includes('TEST'))throw Error('test_seats_filename');
  const expected={town:20,chuamay:16,suoi:8,lientri:12},scenes={};
  if(Object.keys(data.scenes||{}).sort().join()!==Object.keys(expected).sort().join())throw Error('scene_ids');
  for(const [id,cfg] of Object.entries(data.scenes)){
    const {minX,maxX,minZ,maxZ}=cfg.bounds||{},bounds=[minX,maxX,minZ,maxZ];
    const inside=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&p.x>=minX&&p.x<=maxX&&p.z>=minZ&&p.z<=maxZ;
    if(!bounds.every(Number.isFinite)||minX>=maxX||minZ>=maxZ||!Number.isFinite(cfg.speed)||cfg.speed<=0||cfg.speed>10||!Number.isInteger(cfg.cap)||cfg.cap<1||cfg.cap>20||(id==='town'&&cfg.cap!==20)||!Array.isArray(cfg.spawns)||cfg.spawns.length<1||cfg.spawns.length>4||!cfg.spawns.every(p=>inside(p)&&Number.isFinite(p.yaw))||!Array.isArray(cfg.seats))throw Error('scene_config');
    const ids=new Set(),seats={};
    for(const seat of cfg.seats){if(!/^[a-zA-Z0-9_-]{1,40}$/.test(seat.id)||ids.has(seat.id)||!inside(seat)||!Number.isFinite(seat.yaw)||!['sit','bow','mo','incense','lamp','stand'].includes(seat.kind))throw Error('seat_config');ids.add(seat.id);if(['sit','bow','mo'].includes(seat.kind))seats[seat.id]=seat;}
    if(id==='town'?Object.keys(seats).length!==0:Object.keys(seats).length!==cfg.cap)throw Error('seat_capacity');
    scenes[id]={bounds,speed:cfg.speed,cap:cfg.cap,spawns:cfg.spawns,seats};
  }
  return scenes;
}
