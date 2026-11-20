const { chromium } = require('playwright');(async()=>{
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:390,height:760}});const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
await p.goto('http://127.0.0.1:8765/test.html');await p.waitForTimeout(4000);await p.click('#placesbtn');await p.waitForTimeout(300);await p.click('#places .row[data-fps]');await p.waitForTimeout(4000);
console.log(JSON.stringify(await p.evaluate(()=>document.querySelector('#fpsbox').textContent)),errs);
await p.evaluate(()=>__ct.enter(__ct.CLIFF));await p.waitForTimeout(4000);console.log(JSON.stringify(await p.evaluate(()=>document.querySelector('#fpsbox').textContent)));
await p.evaluate(()=>__ct.enter(__ct.TEMPLE));await p.waitForTimeout(4000);console.log(JSON.stringify(await p.evaluate(()=>document.querySelector('#fpsbox').textContent)));
await b.close()})();
