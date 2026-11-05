import assert from 'node:assert/strict';
import {bowFrame} from '../bow.js';
const weights=t=>{const f=bowFrame(t),w=[0,0,0];w[f.from-1]+=1-f.mix;w[f.to-1]+=f.mix;return w;};
assert.deepEqual(weights(0),[1,0,0]);assert.deepEqual(weights(1200),[0,0,1]);assert.deepEqual(weights(1999),[0,0,1]);assert.deepEqual(weights(3200),[1,0,0]);assert.deepEqual(weights(3799),[1,0,0]);
for(let t=1;t<=3800;t++){const a=weights(t),b=weights(t-1);assert(Math.abs(a.reduce((s,x)=>s+x,0)-1)<1e-9);assert(a.every((x,i)=>Math.abs(x-b[i])<.004));const r=bowFrame(t,true);assert.equal(r.from,r.to);assert.equal(r.mix,1);}
console.log('Bow: continuous weights, 1.2/0.8/1.2/0.6s phases, reduced-motion hard frames passed');
