import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createRequire} from 'node:module';
import {once} from 'node:events';
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {migrateTown} from '../server/town-migrate.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'_archive','town-realtime-evidence'),stage=path.join(out,'staging');mkdirSync(stage,{recursive:true});
const require=createRequire(import.meta.url),Database=require(process.env.TOWN_TEST_SQLITE_MODULE||'better-sqlite3'),dbFile=path.join(stage,'smoke.sqlite'),db=new Database(dbFile);db.exec('CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,deleted_at TEXT)');migrateTown(db,'staging');db.close();
async function port(){const s=createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(r=>s.close(r));return p;}
const realtimePort=await port(),apiPort=await port(),args=[];
if(process.env.TOWN_TEST_WS_BUNDLE){const wrapper=path.join(stage,'ws-wrapper.mjs'),loader=path.join(stage,'test-loader.mjs');writeFileSync(wrapper,`import {createRequire} from 'node:module';const m=createRequire(import.meta.url)(${JSON.stringify(process.env.TOWN_TEST_WS_BUNDLE)});export const WebSocketServer=m.wsServer;`);writeFileSync(loader,`import {registerHooks} from 'node:module';registerHooks({resolve(s,c,next){return s==='ws'?{url:${JSON.stringify(pathToFileURL(wrapper).href)},shortCircuit:true}:next(s,c)}});`);args.push('--import',pathToFileURL(loader).href);}
const apiCode=`import {createServer} from ${JSON.stringify(pathToFileURL(path.join(root,'server/app.mjs')).href)};createServer({telegramEnabled:false,origins:new Set()},{}).listen(${apiPort},'127.0.0.1');`;
const api=spawn(process.execPath,['--input-type=module','-e',apiCode],{cwd:root,stdio:'pipe',windowsHide:true});
const realtime=spawn(process.execPath,[...args,'server/town-process.mjs'],{cwd:root,stdio:'pipe',windowsHide:true,env:{...process.env,CHUAMAY_ENV:'staging',TOWN_REALTIME_ENABLED:'1',TOWN_DB_PATH:dbFile,TOWN_PORT:String(realtimePort)}});
let output='';realtime.stdout.on('data',d=>output+=d);realtime.stderr.on('data',d=>output+=d);api.stderr.on('data',()=>{});
async function health(port){for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${port}/healthz`);if(r.ok)return true;}catch{}await new Promise(r=>setTimeout(r,50));}return false;}
try{assert(await health(apiPort));assert(await health(realtimePort),output);const ended=once(realtime,'exit');realtime.kill('SIGKILL');await ended;assert(await health(apiPort),'API health must survive independent realtime process death');writeFileSync(path.join(out,'process.json'),JSON.stringify({independentProcessDeath:'PASS',existingApiHealthAfterDeath:'PASS',database:'local synthetic staging SQLite',websocketDependency:process.env.TOWN_TEST_WS_BUNDLE?'existing Playwright bundle injected only by test loader':'installed ws'},null,2));console.log('PASS: independent realtime child killed; existing API child remains healthy');}finally{api.kill();if(realtime.exitCode===null)realtime.kill();}
