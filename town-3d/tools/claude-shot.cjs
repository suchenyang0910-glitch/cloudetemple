// Claude 审图用截图脚本：先 node tools/serve.mjs（或任意静态服务，根目录为 ccgs-town-3d），再：
// node town-3d/tools/claude-shot.cjs http://localhost:8765/town-3d/index.html out-dir
// 需要 playwright（npm i -D playwright 后 npx playwright install chromium）
const {chromium}=require('playwright');
(async()=>{const [url,out='.']=process.argv.slice(2);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:393,height:659}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
let bytes=0;p.on('response',async r=>{try{bytes+=+(await r.headerValue('content-length'))||0}catch{}});
await p.goto(url);await p.waitForTimeout(5000);await p.screenshot({path:out+'/1-open.png'});
await p.mouse.click(196,300);await p.waitForTimeout(800);await p.screenshot({path:out+'/2-walk.png'});
for(let i=0;i<5;i++){await p.mouse.click(196,330);await p.waitForTimeout(2200);}
await p.screenshot({path:out+'/3-door.png'});
const btn=await p.$('text=Bản đồ');if(btn){await btn.click();await p.waitForTimeout(1500);await p.screenshot({path:out+'/4-map.png'});}
console.log(JSON.stringify({state:await p.evaluate(()=>window.__TOWN_STATE__),bytes,errs}));await b.close();})();
