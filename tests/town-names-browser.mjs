// Local browser author check only; never connects to staging or creates load clients.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {migrateTown} from '../server/town-migrate.mjs';
import {openTownStore} from '../server/town-store.mjs';
import {createTownApi} from '../server/town-api.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.TOWN_TEST_PLAYWRIGHT||'playwright');
const Database=require(process.env.TOWN_TEST_SQLITE_MODULE||'better-sqlite3');
const root=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(root,'dist'),out=path.join(root,'_archive','town-realtime-evidence');mkdirSync(out,{recursive:true});
const db=new Database(':memory:');db.exec('CREATE TABLE users(id TEXT PRIMARY KEY,deleted_at TEXT)');migrateTown(db,'staging');const store=openTownStore(db,'staging');
let api,origin;const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  const route=new URL(req.url,'http://local').pathname;
  if(route.startsWith('/api/town/')){req.headers['cf-access-jwt-assertion']='local-test-only';if(await api(req,res,route.replace('/api/','/admin/')))return;}
  if(await api(req,res,route))return;
  const file=path.resolve(dist,'.'+route);if(!file.startsWith(dist+path.sep)||!existsSync(file)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'"});res.end(readFileSync(file));
});server.listen(0,'127.0.0.1');await once(server,'listening');origin='http://127.0.0.1:'+server.address().port;
api=createTownApi({environment:'staging',origins:new Set([origin]),hashSecret:'local-synthetic-names-test'.repeat(2),adminEnabled:true},store,{adminOrigin:origin,access:{validate:async t=>{if(t!=='local-test-only')throw Error();return 'author@example.invalid';}}});
const browser=await chromium.launch({headless:true});const evidence=[];
try{
 for(const viewport of [{width:390,height:844},{width:1280,height:900}]){
  const context=await browser.newContext({viewport}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  await page.goto(origin+'/town-name.html');await page.waitForFunction(()=>document.querySelector('#name-choices').children.length===7);const before=await page.locator('#name-input').inputValue();assert(before);
  await page.locator('#name-input').fill('Tâm An');await page.locator('form button').click();await page.waitForFunction(()=>document.querySelector('#name-status').textContent==='Đã lưu tên.');
  await page.reload();await page.waitForFunction(()=>document.querySelector('#name-choices').children.length===7);assert.equal(await page.locator('#name-input').inputValue(),'Tâm An');
  await page.locator('#name-input').fill('ＡＤＭＩＮ');await page.locator('form button').click();await page.waitForFunction(()=>document.querySelector('#name-status').textContent.includes('chưa phù hợp'));
  await page.locator('#name-refresh').click();await page.waitForFunction(()=>!document.querySelector('#name-refresh').disabled);assert.equal(await page.locator('#name-choices button').count(),7);
  await page.locator('#name-choices button').nth(1).click();assert((await page.locator('#name-status').innerText()).includes('Lưu tên'));await page.locator('form button').click();await page.waitForFunction(()=>document.querySelector('#name-status').textContent.includes('7 ngày'));
  await page.screenshot({path:path.join(out,`names-${viewport.width}.png`)});assert.deepEqual(errors,[]);evidence.push({viewport,saveReload:true,filteredFullwidthOfficial:true,suggestions:7,errors:0});await context.close();
 }
 const now=Date.now();for(const ref of ['target','a','b','c']){const row=store.ensure('guest:'+ref,null,'Tâm An',now);store.presence(ref,'guest:'+ref,'test-room',row.revision,now);}
 for(const ref of ['a','b','c'])store.report('guest:'+ref,'target',now);
 const page=await browser.newPage({viewport:{width:1280,height:900}});await page.goto(origin+'/admin.html');await page.locator('#town-names > button').click();await page.waitForSelector('#town-names article');assert.equal(await page.locator('#town-names article').count(),1);assert(!(await page.locator('#town-names').innerText()).includes('guest:'));await page.screenshot({path:path.join(out,'admin-names.png')});page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'重置并限制自由输入 7 天'}).click();await page.waitForFunction(()=>document.querySelector('#town-names [role="status"]').textContent==='暂无待处理称呼。');assert.equal(store.reviews().length,0);
 writeFileSync(path.join(out,'browser.json'),JSON.stringify({browser:browser.version(),names:evidence,adminReset:true,network:'loopback only; synthetic identity/access'},null,2));console.log('PASS: name UI desktop/mobile and admin reset on local synthetic API');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));db.close();}
