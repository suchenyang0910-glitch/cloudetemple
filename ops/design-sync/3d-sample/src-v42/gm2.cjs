const { chromium } = require('playwright');(async()=>{
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://127.0.0.1:8765/test.html');await p.waitForTimeout(4000);
await p.evaluate(()=>document.getElementById('placesbtn').click());await p.waitForTimeout(500);await p.screenshot({path:'gm1.png'});
await p.evaluate(()=>document.getElementById('places').scrollTop=560);await p.waitForTimeout(300);await p.screenshot({path:'gm2.png'});
const res=[];
for(const i of [1,2,3,4,5,6,7,8,9,10,11,12,13,'A','B','C','D']){res.push(await p.evaluate(i=>{document.getElementById('placesbtn').click();document.querySelector(`#places .row[data-n="${i}"]`).click();return [i,+__ct.pos.x.toFixed(1),+__ct.pos.z.toFixed(1),__ct.walkable(__ct.pos.x,__ct.pos.z),document.getElementById('places').hidden]},i))}
// canvas pin tap: pin 7
const hit=await p.evaluate(()=>{document.getElementById('placesbtn').click();const cv=document.querySelector('#places .gmap'),r=cv.getBoundingClientRect();return [r.left,r.top,r.width/cv.width,r.width,r.height]});
await p.mouse.click(hit[0]+658*hit[2],hit[1]+368*hit[2]);await p.waitForTimeout(300);
res.push(await p.evaluate(()=>['pin7',+__ct.pos.x.toFixed(1),+__ct.pos.z.toFixed(1),document.getElementById('places').hidden]));
console.log(JSON.stringify(res),JSON.stringify(hit),'errors',JSON.stringify(errs));await b.close()})();
