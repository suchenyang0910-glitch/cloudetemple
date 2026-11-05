async(page)=>{
 const p=await page.context().browser().newPage({viewport:{width:393,height:852}}),assert=(v,m)=>{if(!v)throw Error(m)};
 try{
 await p.addInitScript(()=>{localStorage.setItem('ct-muted','true');window.prefetchAudit=[];window.idleCalls=0;const idle=window.requestIdleCallback;window.requestIdleCallback=(f,o)=>idle.call(window,d=>{idleCalls++;window.inIdle=true;f(d);window.inIdle=false;},o);const original=window.fetch;window.fetch=(u,o)=>{prefetchAudit.push({url:String(u),idle:!!window.inIdle});return original(u,o);};});
 await p.goto('http://127.0.0.1:8821');await p.waitForFunction(()=>document.querySelector('#app').getAttribute('aria-busy')==='false');
 assert(await p.evaluate(()=>idleCalls===0&&prefetchAudit.filter(x=>x.url.endsWith('.webp')).length===1),'first scene only, no prefetch before entry');
 let requests=0;await p.route('**/scene-vn-courtyard-*.webp',async r=>{requests++;await new Promise(resolve=>setTimeout(resolve,1200));await r.continue();});
 await p.evaluate(()=>{const b=document.querySelector('[data-action=enter]');b.click();b.click();b.click();});
 await p.waitForTimeout(550);assert(await p.locator('#scene-old').count()===1,'old scene retained');assert(await p.locator('#loading').isVisible(),'indicator after 400ms');assert(await p.locator('[data-action=continue]').isVisible(),'next action usable while loading');
 await p.waitForFunction(()=>document.querySelector('#app').getAttribute('aria-busy')==='false');assert(requests===1,'duplicate navigation does not refetch scene');
 await p.waitForFunction(()=>prefetchAudit.filter(x=>x.url.includes('choose-v1')).length===6&&prefetchAudit.filter(x=>x.idle&&x.url.includes('choose-v1')).length>=5);
 await p.locator('[data-action=continue]').click();await p.waitForFunction(()=>prefetchAudit.some(x=>x.idle&&x.url.includes('mo-mallet')));
 assert(await p.evaluate(()=>prefetchAudit.every(x=>!x.url.includes('/audio/'))),'muted idle never fetches audio');
 return {passed:true,checks:['first scene only','old scene retained','400ms indicator','controls usable during load','duplicate navigation one request','six approved visitor thumbnails idle prefetch','home scene and pose idle prefetch','no muted audio downloads']};
 }finally{await p.close();}
}
