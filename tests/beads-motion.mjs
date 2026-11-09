import assert from 'node:assert/strict';
import {BeadMotion,beadArc} from '../beads.js';
import {beadMotionConfig} from '../config.js';
let calls=[];const m=new BeadMotion(n=>calls.push(n));
m.begin(100,100);m.move(100,145);m.frame(0);assert.equal(m.count,1);
m.move(100,310);m.frame(20);assert.equal(m.count,1);m.frame(90);assert.equal(m.count,2);m.frame(180);assert.equal(m.count,3);
m.end();m.frame(270);assert.equal(m.count,3,'release does not count queued distance');
m.begin(100,300);m.move(100,100);m.frame(400);m.end();assert.equal(m.count,3,'reverse and snap do not count');
m.begin(100,100);m.move(240,120);m.frame(500);assert.equal(m.end(),false);assert.equal(m.count,3);
m.begin(10,100);m.move(10,400);m.frame(600);m.end();assert.equal(m.count,3);
assert(m.tap(700));assert(!m.tap(750));assert(m.tap(800));assert.deepEqual(calls,[1,2,3,4,5]);
for(const [distance,expected] of [[1.6,2],[1.4,1],[1.5,1]]){
 const sounds=[];const snap=new BeadMotion(n=>sounds.push(n));
 snap.begin(100,100);snap.move(100,100+snap.pitch);snap.frame(0);
 snap.move(100,100+distance*snap.pitch);snap.frame(100);snap.end(150);
 assert.equal(snap.count,expected);assert.equal(sounds.length,expected,'one cue per counted bead');assert.equal(snap.position,expected*snap.pitch);
}
const cancelled=new BeadMotion(()=>{throw Error('cancel must not count')});cancelled.begin(100,100);cancelled.move(100,130);cancelled.frame(0);cancelled.end(100,false);assert.equal(cancelled.position,0);
console.log('Bead motion: slow / capped catch-up / release / reverse / horizontal / edge / taps passed');
const edge=new BeadMotion(()=>{throw Error('edge counted');});edge.begin(390,100,393);edge.move(390,400);edge.frame(0);assert(!edge.active);
for(const width of [360,375,390,393,430])for(let offset=-300;offset<=300;offset+=10){
 const right=beadArc(width,600,offset),left=beadArc(width,600,offset,true),r=width*beadMotionConfig.arcRadius;
 assert.equal(right.y,left.y);assert(right.x>=width*beadMotionConfig.laneRight-1e-8&&right.x<=width*beadMotionConfig.laneLeft+1e-8);assert(left.x>=width*beadMotionConfig.laneRight-1e-8&&left.x<=width*beadMotionConfig.laneLeft+1e-8);
 assert(Math.abs(Math.hypot(right.x-(width*beadMotionConfig.laneRight+r),right.y-600*.65)-r)<1e-8);
 assert(Math.abs(Math.hypot(left.x-(width*beadMotionConfig.laneLeft-r),left.y-600*.65)-r)<1e-8);
}
const loop=new BeadMotion(()=>{});for(let n=0;n<109;n++)assert(loop.tap(n*100));assert.equal(loop.count,109);

for(const [w,h] of [[375,548],[393,659],[375,667],[390,844],[393,852],[430,932]])assert(Math.abs(beadArc(w,h,0).y/h-.65)<1e-9);
