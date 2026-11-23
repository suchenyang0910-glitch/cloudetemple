import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
import {openIsolatedTown,reviewedNames,townDatabasePath} from './town-isolated.mjs';
import {createTownSocketServer} from './town-ws.mjs';
import {loadTownScenes} from './town-scenes.mjs';

export async function startTownProcess(env=process.env){
  if(!['staging','production'].includes(env.CHUAMAY_ENV))throw Error('town_environment');
  if(env.TOWN_REALTIME_ENABLED!=='1')return null;
  const environment=env.CHUAMAY_ENV,production=environment==='production';
  const file=townDatabasePath(environment,env.TOWN_DB_PATH);
  const names=reviewedNames(env);
  const scenes=loadTownScenes(env.TOWN_SEATS_PATH||'ops/design-sync/multiplayer/seats.v1.json',{allowTest:!production&&env.TOWN_ALLOW_TEST_SEATS==='1',production});
  const port=Number(env.TOWN_PORT||(production?8794:8793));if(!Number.isInteger(port)||port<1024||port>65535)throw Error('port');
  const {WebSocketServer}=await import('./town-realtime/ws.mjs');
  const {db,store}=openIsolatedTown(environment,file,names);
  const origins=new Set(production?['https://h5.chuamay.org','https://miniapp.chuamay.org']:['https://staging.chuamay.org']);
  const app=createTownSocketServer({WebSocketServer,store,scenes,origins,environment,log:entry=>console.log(JSON.stringify({code:entry.code}))});
  const counts=setInterval(()=>{try{store.cleanup(Date.now());console.log('{"code":"town_alive"}');}catch{console.error('{"code":"cleanup"}');}},60000);counts.unref();
  app.server.listen(port,'127.0.0.1');
  try{await once(app.server,'listening');store.clearPresence();}catch(error){clearInterval(counts);await app.close();db.close();throw error;}
  const onSignal=()=>void stop();
  let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;process.off('SIGTERM',onSignal);process.off('SIGINT',onSignal);clearInterval(counts);await app.close();db.close();};
  process.once('SIGTERM',onSignal);process.once('SIGINT',onSignal);
  return {app,stop};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)startTownProcess().catch(()=>{console.error('{"code":"startup"}');process.exitCode=1;});
