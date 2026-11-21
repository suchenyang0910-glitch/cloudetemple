const { chromium } = require('playwright');(async()=>{
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:390,height:760}});const errs=[];p.on('pageerror',e=>errs.push(String(e.stack||e).slice(0,300)));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,300))});
await p.goto('http://127.0.0.1:8765/test.html');await p.waitForTimeout(4000);
await p.evaluate(()=>{const s=__ct.TOWN.spots.go_chuamay;__ct.tp(s.x,s.z+.5)});await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('.spot[data-s="go_chuamay"]').click());await p.waitForTimeout(3000);
await p.evaluate(()=>__ct.go('incense'));await p.waitForTimeout(24000);const a=await p.evaluate(()=>__ct.state()+' '+(document.querySelector('.msg')||{}).textContent);
await p.evaluate(()=>__ct.go('bow'));await p.waitForTimeout(40000);const b2=await p.evaluate(()=>__ct.state()+' '+(document.querySelector('.msg')||{}).textContent);
await p.screenshot({path:'x0.png'});
const vis=await p.evaluate(()=>!document.querySelector('#exitbtn').hidden);await p.click('#exitbtn');await p.waitForTimeout(2500);
const c=await p.evaluate(()=>(__ct.world()===__ct.TOWN)+' '+__ct.pos.x.toFixed(1)+','+__ct.pos.z.toFixed(1)+' exitHidden='+document.querySelector('#exitbtn').hidden);
console.log(JSON.stringify({a,b2,vis,c}),errs);await b.close()})();
