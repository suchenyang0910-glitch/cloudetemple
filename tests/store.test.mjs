import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createStore} from '../deploy/store.mjs';
test('VPS storage persists across restart and purges expired records',async()=>{
  const folder=await mkdtemp(path.join(tmpdir(),'ct-store-')),file=path.join(folder,'test.sqlite');let store=createStore(file);
  try{await store.put('email:test','consent',{expirationTtl:90*86400});await store.put('rate:test','expired',{expirationTtl:-1});store.close();store=createStore(file);assert.equal(await store.get('email:test'),'consent');assert.equal(await store.get('rate:test'),null);store.cleanup();assert.equal(await store.get('rate:test'),null);}finally{store.close();await rm(folder,{recursive:true,force:true});}
});
