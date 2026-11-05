import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/waitlist.js';
let ip=1;
function setup(){const values=new Map(),writes=[];return {values,writes,env:{WAITLIST_SECRET:'test-only-secret-with-at-least-32-characters',WAITLIST:{async get(k){return values.get(k)||null;},async put(k,v,o){values.set(k,v);writes.push({k,v,o});}}}};}
const valid=()=>({email:'visitor@example.com',language:'vi',consent:true,consentAt:new Date().toISOString()});
const request=(body,options={})=>new Request('https://temple.test/api/waitlist',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':options.ip||`192.0.2.${ip++}`,...options.headers},body:typeof body==='string'?body:JSON.stringify(body)});
test('valid consent persists only approved fields and expires after 90 days',async()=>{const s=setup(),r=await onRequest({request:request({...valid(),name:'must not store',ip:'must not store'}),env:s.env});assert.equal(r.status,201);const item=s.writes.find(x=>x.k.startsWith('email:'));assert.equal(item.o.expirationTtl,90*86400);assert.deepEqual(Object.keys(JSON.parse(item.v)).sort(),['consentAt','consentVersion','email','language','receivedAt']);assert.ok(s.writes.every(x=>!x.k.includes('@')&&!x.k.includes('192.0.2')));});
test('invalid email, missing consent, wrong language and stale consent rejected',async()=>{for(const patch of [{email:'bad'},{consent:false},{language:'th'},{consentAt:'2000-01-01'}, {email:'x@..com'}]){const s=setup();assert.equal((await onRequest({request:request({...valid(),...patch}),env:s.env})).status,400);assert.equal(s.writes.length,0);}});
test('same IP cooldown blocks consecutive and concurrent submissions',async()=>{const s=setup(),addr=`192.0.2.${ip++}`;const results=await Promise.all([1,2].map(()=>onRequest({request:request(valid(),{ip:addr}),env:s.env})));assert.deepEqual(results.map(r=>r.status).sort(),[201,429]);assert.equal((await onRequest({request:request(valid(),{ip:addr}),env:s.env})).status,429);});
test('invalid JSON, oversized body, wrong origin and content type rejected',async()=>{const s=setup();assert.equal((await onRequest({request:request('{'),env:s.env})).status,400);assert.equal((await onRequest({request:request('x'.repeat(5000)),env:s.env})).status,400);assert.equal((await onRequest({request:request(valid(),{headers:{Origin:'https://other.test'}}),env:s.env})).status,403);assert.equal((await onRequest({request:request(valid(),{headers:{'Content-Type':'text/plain'}}),env:s.env})).status,415);});
test('missing binding and failed KV writes never report success',async()=>{assert.equal((await onRequest({request:request(valid()),env:{}})).status,503);const s=setup();s.env.WAITLIST.put=async()=>{throw new Error('offline');};assert.equal((await onRequest({request:request(valid()),env:s.env})).status,503);});
test('GET does not register',async()=>{const s=setup();assert.equal((await onRequest({request:new Request('https://temple.test/api/waitlist'),env:s.env})).status,405);assert.equal(s.writes.length,0);});

test('either KV write failing allows the same IP to retry immediately',async()=>{
  for(const failedWrite of [1,2]){
    const s=setup(),addr=`192.0.2.${ip++}`,put=s.env.WAITLIST.put;let calls=0;
    s.env.WAITLIST.put=async(...args)=>{if(++calls===failedWrite)throw new Error('temporary write failure');return put(...args);};
    assert.equal((await onRequest({request:request(valid(),{ip:addr}),env:s.env})).status,503);
    assert.ok(![...s.values.keys()].some(k=>k.startsWith('rate:')));
    assert.equal((await onRequest({request:request(valid(),{ip:addr}),env:s.env})).status,201);
    assert.equal((await onRequest({request:request(valid(),{ip:addr}),env:s.env})).status,429);
  }
});
