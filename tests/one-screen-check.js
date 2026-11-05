async(page)=>{
 const results=[];const assert=(v,m)=>{if(!v)throw Error(m)};
 for(const [width,height] of [[375,667],[390,844],[393,852],[430,932]]){
  await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:8788');
  const shot=async(view,selector)=>{await page.locator(selector).waitFor();await page.locator('#loading').waitFor({state:'hidden'});await page.waitForTimeout(500);
   const m=await page.evaluate(()=>{const d=document.scrollingElement;const controls=[...document.querySelectorAll('#controls button,#controls select')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,sw:e.scrollWidth,cw:e.clientWidth}});return {scrollHeight:d.scrollHeight,viewport:innerHeight,scrollWidth:d.scrollWidth,width:innerWidth,controls}});
   assert(m.scrollHeight===height&&m.scrollWidth===width,'scroll '+view);assert(m.controls.every(r=>r.x>=0&&r.y>=0&&r.right<=width+.1&&r.bottom<=height+.1&&r.h>=44&&r.sw<=r.cw),'controls '+view);
   await page.screenshot({path:`E:/cloudtemple/screenshots/one-screen-${width}-${view}.png`});results.push({width,height,view,...m});};
  await shot('entry','[data-action=enter]');await page.locator('[data-action=enter]').click();await shot('choose','[data-action=continue]');await page.locator('[data-action=continue]').click();await shot('home','[data-action=more]');
  for(const [view,selector] of [['incense','[data-action=light]'],['bow','[data-action=bow-once]'],['sit','[data-action=sit-start]'],['beads','#bead-control']]){await page.locator(`[data-action=${view}]`).click();await shot(view,selector);await page.locator('[data-action=home]').click();await page.locator('[data-action=more]').waitFor();}
  await page.locator('[data-action=more]').click();await page.locator('#language').selectOption('en');await page.locator('#sound-toggle').click();assert(await page.locator('#volume').isVisible(),'volume');await page.locator('#close-more').click();
 }
 return {passed:true,screenshots:results.length,dimensions:[...new Set(results.map(r=>r.width+'x'+r.height+': '+r.scrollWidth+'x'+r.scrollHeight))]};
}
