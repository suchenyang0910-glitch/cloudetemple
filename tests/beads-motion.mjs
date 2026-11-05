import assert from 'node:assert/strict';
import {BeadMotion,beadArc} from '../beads.js';
let calls=[];const m=new BeadMotion(n=>calls.push(n));
m.begin(100,100);m.move(100,145);m.frame(0);assert.equal(m.count,1);
m.move(100,310);m.frame(20);assert.equal(m.count,1);m.frame(90);assert.equal(m.count,2);m.frame(180);assert.equal(m.count,3);
m.end();m.frame(270);assert.equal(m.count,3,'release does not count queued distance');
m.begin(100,300);m.move(100,100);m.frame(400);m.end();assert.equal(m.count,3,'reverse and snap do not count');
m.begin(100,100);m.move(240,120);m.frame(500);assert.equal(m.end(),false);assert.equal(m.count,3);
m.begin(10,100);m.move(10,400);m.frame(600);m.end();assert.equal(m.count,3);
assert(m.tap(700));assert(!m.tap(750));assert(m.tap(800));assert.deepEqual(calls,[1,2,3,4,5]);
const snap=new BeadMotion(()=>{});snap.begin(100,100);snap.move(100,130);snap.frame(0);snap.end();assert.equal(snap.position,42);assert.equal(snap.count,0,'nearest snap is visual only');snap.begin(100,100);assert.equal(snap.position,42);snap.move(100,142);snap.frame(100);assert.equal(snap.count,1);
console.log('Bead motion: slow / capped catch-up / release / reverse / horizontal / edge / taps passed');
const edge=new BeadMotion(()=>{throw Error('edge counted');});edge.begin(390,100,393);edge.move(390,400);edge.frame(0);assert(!edge.active);
for(const width of [375,390,393,430])for(let offset=-300;offset<=300;offset+=10){const right=beadArc(width,600,offset),left=beadArc(width,600,offset,true);assert(Math.abs(right.x+left.x-width)<1e-8);assert.equal(right.y,left.y);assert(Math.abs(Math.hypot(right.x-width*1.64,right.y-294)-width*.9)<1e-8);}
const loop=new BeadMotion(()=>{});for(let n=0;n<109;n++)assert(loop.tap(n*100));assert.equal(loop.count,109);
