const { chromium } = require('playwright');(async()=>{
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:900,height:700},deviceScaleFactor:1});
const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://127.0.0.1:8765/test.html');await p.waitForTimeout(4000);await p.evaluate(()=>{__ct.setTime('day');document.querySelectorAll('.top,.bar,.spot').forEach(e=>e.style.display='none')});await p.waitForTimeout(500);
const shots=[['a',0,150,[0,22,30,8]],['b',0,133,[0,5,12,5]],['c',0,117,[0,5,12,6]],['d',0,116,[16,12,10,5]],['e',0,116,[0,2.2,5,7]],['f',0,100,[0,80,70,0]],['g',-22,-40,[8,7,12,4]],['h',-22,-12,[0,26,30,0]],['i',-27,38,[5,7,13,5]]];
for(const [n,x,z,tc] of shots){await p.evaluate(([x,z,tc])=>{__ct.tp(x,z);__ct.testCam=tc},[x,z,tc]);await p.waitForTimeout(1300);await p.screenshot({path:'s'+n+'.png'})}
const r=await p.evaluate(()=>{__ct.testCam=null;let badp=0,none=0,seed=8;const rr=()=>(seed=(seed*16807)%2147483647)/2147483647;const W=__ct.walkable;const pick=()=>{for(;;){const x=-39+rr()*78,z=-64+rr()*224;if(W(x,z))return [x,z]}};let mx=0;
 for(let i=0;i<300;i++){const a=pick(),b=pick(),t0=performance.now(),path=__ct.plan(a[0],a[1],b[0],b[1]);mx=Math.max(mx,performance.now()-t0);if(!path.length){none++;continue}let c=a;for(const q of path){const d=Math.hypot(q[0]-c[0],q[1]-c[1]),m=Math.ceil(d/.05);for(let k=0;k<=m;k++){const t=k/Math.max(1,m);if(!W(c[0]+(q[0]-c[0])*t,c[1]+(q[1]-c[1])*t,-.03)){badp++;break}}c=q}}
 const doors={};for(const [k,s] of Object.entries(__ct.TOWN.spots)){doors[k]=[W(s.x,s.z),__ct.plan(0,160,s.x,s.z).length]}return {badp,none,ms:Math.round(mx),doors,pb:__ct.pathBad()}});
console.log(JSON.stringify(r),'errors',JSON.stringify(errs));await b.close();})();
