import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
import {openTownStore} from './town-store.mjs';
import {createTownSocketServer} from './town-ws.mjs';
import {loadTownScenes} from './town-scenes.mjs';

export async function startTownProcess(env=process.env){
  if(env.CHUAMAY_ENV!=='staging'||env.TOWN_REALTIME_ENABLED!=='1')throw Error('town_staging_only');
  const file=env.TOWN_DB_PATH||'/var/lib/chuamay/staging/api.sqlite';
  if(!file.replaceAll('\\','/').includes('/staging/'))throw Error('staging_database_required');
  const scenes=loadTownScenes(env.TOWN_SEATS_PATH||'ops/design-sync/multiplayer/seats.v1.json',{allowTest:env.TOWN_ALLOW_TEST_SEATS==='1'});
  const [{default:Database},{WebSocketServer}]=await Promise.all([import('better-sqlite3'),import('./town-realtime/ws.mjs')]);
  const db=new Database(file,{fileMustExist:true,timeout:100});db.pragma('foreign_keys = ON');
  const origins=new Set(['https://staging.chuamay.org']);
  const store=openTownStore(db,'staging');
  const app=createTownSocketServer({WebSocketServer,store,scenes,origins,environment:'staging',log:entry=>console.log(JSON.stringify(entry))});
  const counts=setInterval(()=>{console.log(JSON.stringify(app.core.counts()));try{store.cleanup(Date.now());}catch{console.error('{"code":"cleanup"}');}},60000);counts.unref();
  const port=Number(env.TOWN_PORT||8793);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('port');
  app.server.listen(port,'127.0.0.1');
  try{await once(app.server,'listening');store.clearPresence();}catch(error){await app.close();db.close();throw error;}
  let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;clearInterval(counts);await app.close();db.close();};
  process.once('SIGTERM',()=>void stop());process.once('SIGINT',()=>void stop());
  return {app,stop};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)startTownProcess().catch(()=>{console.error('{"code":"startup"}');process.exitCode=1;});
