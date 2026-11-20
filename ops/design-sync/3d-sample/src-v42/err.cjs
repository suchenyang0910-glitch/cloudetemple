const { chromium } = require('playwright');(async()=>{
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:390,height:760}});
p.on('pageerror',e=>console.log('PAGEERR',String(e),(e.stack||'').split('\n').slice(0,3).join(' | ')));p.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});
await p.goto('http://127.0.0.1:8765/test.html');await p.waitForTimeout(3000);await b.close();})();
