import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {openStore} from './store.mjs';
import {createServer} from './app.mjs';
import {validateInitData,config,clientIP} from './security.mjs';
const settings={origins:new Set(['https://h5.chuamay.org','https://miniapp.chuamay.org']),token:'123:test-token',webhookSecret:'test-webhook-secret-with-32-characters',hashSecret:'test-hash-secret-with-32-characters',trustLocal:false,mini:'https://miniapp.chuamay.org'};
const valid=()=>({email:'test@example.com',language:'vi',consent:true,consentAt:new Date().toISOString()});
function signed(date=Math.floor(Date.now()/1000)){const p=new URLSearchParams({auth_date:String(date),user:JSON.stringify({id:123,language_code:'vi',first_name:'Do not store'})});const data=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');const secret=createHmac('sha256','WebAppData').update(settings.token).digest();p.set('hash',createHmac('sha256',secret).update(data).digest('hex'));return p.toString();}
async function fixture(t,options=settings){const store=openStore(':memory:'),sent=[],server=createServer(options,store,async(method,body)=>sent.push({method,body}));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));store.close();});const base='http://127.0.0.1:'+server.address().port;return {store,sent,base,post:(body,headers={},route='/waitlist')=>fetch(base+route,{method:'POST',headers:{Origin:'https://h5.chuamay.org','Content-Type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)})};}
test('valid waitlist stores allowed fields, HMAC keys and 90-day expiry',async t=>{const f=await fixture(t);assert.equal((await f.post({...valid(),name:'ignore'})).status,201);const row=f.store.db.prepare('SELECT * FROM waitlist').get();assert.deepEqual(Object.keys(row).sort(),['consentAt','email','expires','key','language']);assert.match(row.key,/^[a-f0-9]{64}$/);assert.ok(Math.abs(row.expires-Date.now()-90*86400000)<2000);});
test('invalid email consent language date rejected without writes',async t=>{const f=await fixture(t);for(const patch of [{email:'bad'},{email:'x@..com'},{consent:false},{language:'th'},{consentAt:'2000-01-01'}])assert.equal((await f.post({...valid(),...patch})).status,400);assert.equal(f.store.db.prepare('SELECT count(*) n FROM waitlist').get().n,0);});
test('concurrent requests precisely limit the same IP',async t=>{const f=await fixture(t);assert.deepEqual((await Promise.all([f.post(valid()),f.post(valid())])).map(r=>r.status).sort(),[201,429]);assert.equal((await f.post(valid())).status,429);});
test('body limit, JSON and content type validation',async t=>{const f=await fixture(t);assert.equal((await f.post('{')).status,400);assert.equal((await f.post('x'.repeat(4097))).status,400);assert.equal((await f.post(valid(),{'Content-Type':'text/plain'})).status,415);});
test('missing secrets fail closed and failed writes return 503',async t=>{for(const key of ['TELEGRAM_BOT_TOKEN','TELEGRAM_WEBHOOK_SECRET','HASH_SECRET']){const env={TELEGRAM_BOT_TOKEN:settings.token,TELEGRAM_WEBHOOK_SECRET:settings.webhookSecret,HASH_SECRET:settings.hashSecret};delete env[key];assert.throws(()=>config(env),new RegExp(key));}const f=await fixture(t);f.store.register=()=>{throw Error('disk');};assert.equal((await f.post(valid())).status,503);});
test('GET cannot register',async t=>{const f=await fixture(t);assert.equal((await fetch(f.base+'/waitlist',{headers:{Origin:'https://h5.chuamay.org'}})).status,405);});
test('second write failure rolls back email and permits retry',async t=>{const f=await fixture(t);f.store.db.exec("CREATE TRIGGER fail_rate BEFORE INSERT ON rates BEGIN SELECT RAISE(ABORT,'failure'); END");assert.equal((await f.post(valid())).status,503);assert.equal(f.store.db.prepare('SELECT count(*) n FROM waitlist').get().n,0);f.store.db.exec('DROP TRIGGER fail_rate');assert.equal((await f.post(valid())).status,201);});
const envFor=origins=>({TELEGRAM_BOT_TOKEN:settings.token,TELEGRAM_WEBHOOK_SECRET:settings.webhookSecret,HASH_SECRET:settings.hashSecret,ALLOWED_ORIGINS:origins});
test('production CORS isolates allowed origins; unset denies cross-origin',async t=>{
 for(const list of ['https://h5.chuamay.org,https://miniapp.chuamay.org',undefined]){
  const f=await fixture(t,config(envFor(list)));
  for(const origin of ['https://h5.chuamay.org','https://miniapp.chuamay.org','https://staging.chuamay.org','http://localhost:8788','https://evil.test','null']){
   const r=await fetch(f.base+'/waitlist',{method:'OPTIONS',headers:{Origin:origin}}),allowed=!!list&&['https://h5.chuamay.org','https://miniapp.chuamay.org'].includes(origin);
   assert.equal(r.status,allowed?204:403);assert.equal(r.headers.get('Access-Control-Allow-Origin'),allowed?origin:null);assert.equal(r.headers.get('Access-Control-Allow-Credentials'),allowed?'true':null);
  }
  assert.equal((await fetch(f.base+'/healthz')).status,200);
  const r=await fetch(f.base+'/waitlist',{method:'POST',headers:{'Content-Type':'application/json','Sec-Fetch-Site':'same-origin'},body:'{}'});
  assert.equal(r.status,400,'same-origin without Origin reaches validation');assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);
  assert.equal((await fetch(f.base+'/telegram/webhook',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':settings.webhookSecret},body:'{}'})).status,400,'webhook without Origin reaches validation');
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM waitlist').get().n,0);
 }
});
test('staging accepts only its own configured origin; rejects invalid configuration',async t=>{
 const f=await fixture(t,config(envFor('https://staging.chuamay.org')));
 for(const origin of ['https://staging.chuamay.org','https://h5.chuamay.org','https://miniapp.chuamay.org'])assert.equal((await fetch(f.base+'/waitlist',{method:'OPTIONS',headers:{Origin:origin}})).status,origin==='https://staging.chuamay.org'?204:403);
 for(const value of ['*','null','https://h5.chuamay.org/path','https://u:p@h5.chuamay.org','http://h5.chuamay.org'])assert.throws(()=>config(envFor(value)),/Invalid ALLOWED_ORIGINS/);
});
test('initData validates signature, rejects tamper old future and duplicates',()=>{assert.equal(validateInitData(signed(),settings.token).id,'123');assert.throws(()=>validateInitData(signed().replace('auth_date=','auth_date=1'),settings.token));assert.throws(()=>validateInitData(signed(Math.floor(Date.now()/1000)-86401),settings.token));assert.throws(()=>validateInitData(signed(Math.floor(Date.now()/1000)+121),settings.token));assert.throws(()=>validateInitData(signed()+'&auth_date=1',settings.token));});
test('webhook requires secret; commands and delete use verified sender',async t=>{const f=await fixture(t);const update={update_id:1,message:{from:{id:123,language_code:'vi'},chat:{id:123,type:'private'},text:'/start'}};assert.equal((await f.post(update,{},'/telegram/webhook')).status,401);const headers={'X-Telegram-Bot-Api-Secret-Token':settings.webhookSecret};assert.equal((await f.post(update,headers,'/telegram/webhook')).status,200);assert.equal(f.sent[0].body.reply_markup.inline_keyboard[0][0].web_app.url,settings.mini);await f.post(update,headers,'/telegram/webhook');assert.equal(f.sent.length,1);f.store.remind({id:'123',language:'vi'},new Date().toISOString());assert.equal((await f.post({update_id:2,callback_query:{id:'cb',from:{id:123},data:'delete-data'}},headers,'/telegram/webhook')).status,200);assert.equal(f.store.db.prepare('SELECT count(*) n FROM reminders').get().n,0);});
test('reminder requires consent and signed initData, stores only three fields',async t=>{const f=await fixture(t);assert.equal((await f.post({...valid(),initData:'fake'},{},'/telegram/remind')).status,401);assert.equal((await f.post({...valid(),initData:signed()},{},'/telegram/remind')).status,201);assert.deepEqual(Object.keys(f.store.db.prepare('SELECT * FROM reminders').get()).sort(),['consentAt','language','user_id']);});
test('forwarded IP trusted only behind Cloudflare peer',()=>{const req={socket:{remoteAddress:'192.0.2.1'},headers:{'cf-connecting-ip':'198.51.100.4'}};assert.equal(clientIP(req,false),'192.0.2.1');req.socket.remoteAddress='173.245.48.1';assert.equal(clientIP(req,false),'198.51.100.4');req.socket.remoteAddress='127.0.0.1';req.headers['x-chuamay-peer']='192.0.2.1';assert.equal(clientIP(req,true),'192.0.2.1');});
test('disabled Telegram needs only HASH_SECRET and leaves registration available',async t=>{
 const env={TELEGRAM_ENABLED:'0',HASH_SECRET:settings.hashSecret,ALLOWED_ORIGINS:'https://h5.chuamay.org'};
 assert.throws(()=>config({...env,HASH_SECRET:''}),/HASH_SECRET/);
 assert.throws(()=>config({...env,TELEGRAM_ENABLED:'off'}),/TELEGRAM_ENABLED/);
 const f=await fixture(t,config(env));
 const health=await fetch(f.base+'/healthz');
 assert.equal(health.status,200);assert.deepEqual(await health.json(),{ok:true,telegram:'disabled'});
 for(const route of ['/telegram/remind','/telegram/webhook']){
   const response=await f.post({}, {}, route);assert.equal(response.status,503);
   assert.equal((await response.json()).error,'telegram_disabled');
 }
 assert.equal(f.sent.length,0);assert.equal((await f.post(valid())).status,201);
});
test('outbox mail provider is rejected outside staging',()=>{
 const env={TELEGRAM_ENABLED:'0',HASH_SECRET:settings.hashSecret,CHUAMAY_ENV:'production',MAIL_PROVIDER:'outbox',FAMILY_ENABLED:'0'};
 assert.throws(()=>config(env),/Outbox is staging-only/);
 assert.equal(config({...env,CHUAMAY_ENV:'staging'}).mailProvider,'outbox');
});
test('family defaults closed in production and requires an explicit switch',()=>{
 const env={TELEGRAM_ENABLED:'0',HASH_SECRET:settings.hashSecret};
 assert.equal(config({...env,CHUAMAY_ENV:'production'}).familyEnabled,false);
 assert.equal(config({...env,CHUAMAY_ENV:'production',FAMILY_ENABLED:'0'}).familyEnabled,false);
 assert.equal(config({...env,CHUAMAY_ENV:'production',FAMILY_ENABLED:'1',FAMILY_ALLOWLIST:'first@example.com,second@example.com'}).familyEnabled,true);
 assert.equal(config({...env,CHUAMAY_ENV:'staging',FAMILY_ENABLED:'1',FAMILY_ALLOWLIST:'first@example.com,second@example.com'}).familyEnabled,true);
 assert.throws(()=>config({...env,CHUAMAY_ENV:'production',FAMILY_ENABLED:'1'}),/FAMILY_ALLOWLIST/);
 assert.throws(()=>config({...env,CHUAMAY_ENV:'production',FAMILY_ENABLED:'1',FAMILY_ALLOWLIST:'bad'}),/FAMILY_ALLOWLIST/);
 assert.throws(()=>config({...env,CHUAMAY_ENV:'staging',FAMILY_ENABLED:'yes'}),/FAMILY_ENABLED/);
});
test('pet module defaults closed and requires a valid explicit switch',()=>{
 const env={TELEGRAM_ENABLED:'0',HASH_SECRET:settings.hashSecret,FAMILY_ENABLED:'0'};
 assert.equal(config({...env,CHUAMAY_ENV:'production'}).petEnabled,false);
 assert.equal(config({...env,CHUAMAY_ENV:'staging'}).petEnabled,false);
 assert.equal(config({...env,CHUAMAY_ENV:'staging',PET_ENABLED:'1'}).petEnabled,true);
 assert.throws(()=>config({...env,CHUAMAY_ENV:'staging',PET_ENABLED:'yes'}),/PET_ENABLED/);
});
