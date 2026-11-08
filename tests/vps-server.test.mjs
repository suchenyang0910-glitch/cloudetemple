import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
test('VPS HTTP adapter preserves validation and only serves public files',async()=>{
  const folder=await mkdtemp(path.join(tmpdir(),'ct-http-'));
  const {release}=JSON.parse(await readFile('dist/release.json','utf8'));
  const child=spawn(process.execPath,['deploy/server.mjs'],{env:{...process.env,PORT:'0',PUBLIC_ORIGIN:'https://temple.test',WAITLIST_SECRET:'test-only-secret-with-32-characters',WAITLIST_DB:path.join(folder,'test.sqlite')},stdio:['ignore','pipe','pipe']});
  try{
    const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server timeout')),10000);child.once('exit',()=>{clearTimeout(timer);reject(Error('server exited'));});child.stdout.on('data',b=>{const match=b.toString().match(/ready on (\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});});
    const base=`http://127.0.0.1:${port}`;
    for(const route of ['/.env','/deploy/server.mjs','/functions/api/waitlist.js','/assets/processed-v1/img/scene-tk-hall-side-day.webp'])assert.equal((await fetch(base+route)).status,404);
    const home=await fetch(base);assert.equal(home.status,200);assert.ok(home.headers.get('Content-Security-Policy').includes("default-src 'self'"));
    const app=await fetch(`${base}/app.${release}.js`);assert.equal(app.status,200);assert.equal(app.headers.get('Content-Type'),'text/javascript');
    const image=await fetch(`${base}/assets/releases/${release}/processed-v1/img/scene-vn-hall-front-day.webp`);assert.equal(image.status,200);assert.equal(image.headers.get('Content-Type'),'image/webp');
    for(const name of ['flower-dao.svg','flower-mai.svg','lantern.svg','moon.svg','petal-dao.svg','petal-mai.svg','pot-dao.svg','pot-mai.svg']){const festival=await fetch(`${base}/assets/releases/${release}/festival/${name}`);assert.equal(festival.status,200);assert.equal(festival.headers.get('Content-Type'),'image/svg+xml');}
    const body=JSON.stringify({email:'vps-test@example.com',language:'vi',consent:true,consentAt:new Date().toISOString()});
    const post=headers=>fetch(base+'/api/waitlist',{method:'POST',headers:{'Content-Type':'application/json',...headers},body});
    assert.equal((await post({Origin:'https://temple.test','CF-Connecting-IP':'192.0.2.7'})).status,403);
    assert.equal((await post({'X-CloudTemple-Client-IP':'192.0.2.7',Origin:'https://evil.test'})).status,403);
    const headers={'X-CloudTemple-Client-IP':'192.0.2.7',Origin:'https://temple.test'};
    assert.equal((await post(headers)).status,201);assert.equal((await post(headers)).status,429);
  }finally{if(child.exitCode===null){const exited=once(child,'exit');child.kill();await exited;}await rm(folder,{recursive:true,force:true});}
});
