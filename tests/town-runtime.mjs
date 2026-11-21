import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {periodNow} from '../period.js';
import {createFrameMonitor} from '../town-performance.js';

const layout=JSON.parse(await fs.readFile(new URL('../assets/processed-v1/layout-v1.json',import.meta.url)));
for(const [time,expected] of [['04:59:59','night'],['05:00:00','dawn'],['07:59:59','dawn'],['08:00:00','day'],['16:59:59','day'],['17:00:00','dusk'],['18:59:59','dusk'],['19:00:00','night'],['23:59:59','night'],['00:00:00','night']]){
  const date=new Date(`2026-11-21T${time}+07:00`);
  for(const tz of ['UTC','America/Los_Angeles','Asia/Tokyo','Asia/Bangkok']){
    process.env.TZ=tz;
    assert.equal(periodNow(date),expected,`${time} in ${tz}`);
    assert.equal(periodNow(date,layout.periods),expected,'town and existing hall agree');
  }
}
let notices=0;const monitor=createFrameMonitor(()=>notices++);
monitor.frame(0);for(let t=50;t<=6000;t+=50)monitor.frame(t);assert.equal(notices,0,'20 FPS is not below 20');
monitor.reset();monitor.frame(0);for(let t=100;t<=4000;t+=100)monitor.frame(t);assert.equal(notices,0);
for(let t=4010;t<=5000;t+=10)monitor.frame(t);
for(let t=5100;t<=9900;t+=100)monitor.frame(t);assert.equal(notices,0,'a healthy FPS window resets the slow run');
monitor.reset();monitor.frame(100000);assert.equal(notices,0,'background gap is excluded');
for(let t=100100;t<=104900;t+=100)monitor.frame(t);assert.equal(notices,0);
monitor.frame(105000);assert.equal(notices,1,'5 seconds prompts');
monitor.frame(106000);monitor.reset();monitor.frame(110000);monitor.frame(116000);assert.equal(notices,1,'one prompt per visit');
let jitterNotices=0;const jitter=createFrameMonitor(()=>jitterNotices++);jitter.frame(0);
for(let t=0;t<5500;t+=110){jitter.frame(t+25);jitter.frame(t+110);}
assert.equal(jitterNotices,1,'sustained average below 20 FPS still counts with individual fast frames');
console.log('PASS: UTC+7 boundaries across four device timezones, layout parity, continuous low FPS, recovery and hidden-gap reset');
