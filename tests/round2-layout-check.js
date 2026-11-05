async(page)=>{
 const assert=(v,m)=>{if(!v)throw Error(m)},rows=[];
 const shot=async(name)=>{await page.locator('#loading').waitFor({state:'hidden'});await page.clock.runFor(650);const m=await page.evaluate(()=>{const r=document.scrollingElement;const buttons=[...document.querySelectorAll('#controls button,#controls select,.corner-button,#wood-prop')].filter(e=>e.getClientRects().length).map(e=>{const b=e.getBoundingClientRect();return {text:e.textContent,x:b.x,y:b.y,right:b.right,bottom:b.bottom,h:b.height,overflow:e.scrollWidth>e.clientWidth+1}});return {height:innerHeight,scrollHeight:r.scrollHeight,width:innerWidth,scrollWidth:r.scrollWidth,buttons}});assert(m.height===m.scrollHeight&&m.width===m.scrollWidth,'scroll '+name);assert(m.buttons.every(b=>b.x>=0&&b.y>=0&&b.right<=m.width+.1&&b.bottom<=m.height+.1&&b.h>=44&&!b.overflow),'bounds '+name);await page.screenshot({path:`E:/cloudtemple/screenshots/round2/${name}.png`});rows.push({name,height:m.height,scrollHeight:m.scrollHeight});};
 for(const [width,height] of [[375,667],[393,852],[430,932],[360,800]]){
  await page.setViewportSize({width,height});
  for(const [period,hour] of [['dawn',6],['day',10],['dusk',18],['night',22]]){
   await page.clock.setSystemTime(new Date(`2026-11-05T${String(hour).padStart(2,'0')}:00:00+07:00`));await page.goto('http://127.0.0.1:8798');await page.evaluate(()=>{localStorage.setItem('ct-muted','true');localStorage.removeItem('ct-wood')});
   await page.locator('[data-action=enter]').waitFor();if(period==='day')await shot(`${width}-entry`);
   await page.locator('[data-action=enter]').click();await page.locator('[data-action=continue]').waitFor();if(period==='day')await shot(`${width}-choose`);
   await page.locator('[data-action=continue]').click();await page.locator('[data-action=mo]').waitFor();if(period==='day')await shot(`${width}-home`);
   await page.locator('[data-action=mo]').click();await page.locator('#wood-prop').waitFor({state:'visible'});await shot(`${width}-mo-${period}`);
   const gap=await page.evaluate(()=>document.querySelector('#controls').getBoundingClientRect().top-document.querySelector('#wood-prop').getBoundingClientRect().bottom);assert(Math.abs(gap-16)<.1,'prop gap');
   if(period==='day'){
    for(const [view,ready] of [['incense','[data-action=light]'],['bow','[data-action=bow-once]'],['sit','[data-action=sit-start]'],['beads','#bead-control']]){
     await page.locator('[data-action=home]').click();await page.locator(`[data-action=${view}]`).click();await page.locator(ready).waitFor();await shot(`${width}-${view}`);
    }
    if(width===393){for(let n=0;n<108;n++)await page.locator('#bead-control').click();await page.locator('[data-action=share]').click();await page.locator('.share-preview').waitFor();await page.screenshot({path:'E:/cloudtemple/screenshots/round2/393-share.png'});await page.locator('#close-modal').click();await page.locator('#more-toggle').click();await page.screenshot({path:'E:/cloudtemple/screenshots/round2/393-more.png'});await page.locator('#close-more').click();}
   }
  }
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#wood-prop').click();assert(await page.locator('#mallet-prop').evaluate(e=>e.getAnimations().length)===0,'reduced motion');await page.emulateMedia({reducedMotion:'no-preference'});
 return {passed:true,screenshots:rows.length+2,dimensions:[...new Set(rows.map(r=>r.name.split('-')[0]+' / '+r.scrollHeight))],rows};
}
