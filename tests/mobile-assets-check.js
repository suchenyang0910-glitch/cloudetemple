async(page)=>{
 const p=await page.context().browser().newPage({viewport:{width:393,height:852},deviceScaleFactor:3}),assert=(v,m)=>{if(!v)throw Error(m)},errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{localStorage.setItem('ct-muted','true');localStorage.setItem('ct-visitor',JSON.stringify('bun-light'));});
  let scenes=0,people=0,started=0;
  await p.route('**/scene-vn-*.webp',async r=>{scenes++;started=Date.now();await new Promise(resolve=>setTimeout(resolve,5000));await r.continue()});
  await p.goto('http://127.0.0.1:8813/?debug=audio');await p.locator('[data-action=enter]').waitFor();
  assert(Date.now()-started<4000,'3s fallback did not unblock');assert(scenes===1,'only current entry scene');
  await p.locator('#audio-debug summary').click();
  await p.route('**/visitor-*.webp',r=>{people++;return r.fulfill({status:503,body:'unavailable'})});
  await p.locator('[data-action=enter]').click();await p.locator('.preview').waitFor();
  await p.waitForFunction(()=>document.querySelector('.preview').getAttribute('aria-label')==='Chưa tải được hình ảnh');
  assert(people===2,'image retried exactly once: '+people);
  assert(await p.locator('.preview').evaluate(c=>c.getContext('2d').getImageData(1,1,1,1).data[3]===255),'visible placeholder');
  assert(await p.locator('body').getAttribute('data-view')==='choose','late entry image did not change page');
  await p.locator('#audio-debug summary').click();await p.waitForFunction(()=>document.querySelector('#audio-debug textarea').value.includes('HTTP 503'));
  await p.screenshot({path:'E:/cloudtemple/screenshots/mobile-image-failure.png',scale:'css'});
  await p.unrouteAll({behavior:'wait'});await p.goto('http://127.0.0.1:8813');await p.locator('[data-action=enter]').waitFor();
  let resources=await p.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name));assert(resources.filter(n=>n.endsWith('.webp')).length===1&&resources.some(n=>n.includes('/mobile/')),'mobile entry only');assert(!resources.some(n=>/\.(m4a|mp3)$/.test(n)),'no audio until enabled');
  await p.locator('[data-action=enter]').click();await p.locator('[data-action=continue]').click();await p.locator('[data-action=sit]').click();await p.locator('[data-action=sit-start]').waitFor();await p.locator('#scene').evaluate(c=>c.getAnimations().forEach(a=>a.finish()));await p.screenshot({path:'E:/cloudtemple/screenshots/mobile-sit-393.png',scale:'css'});
  assert(await p.evaluate(()=>document.documentElement.scrollHeight===innerHeight&&document.documentElement.scrollWidth===innerWidth),'no scroll');
  await p.setViewportSize({width:900,height:1000});await p.reload();await p.locator('[data-action=enter]').waitFor();resources=await p.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name));assert(resources.some(n=>n.includes('/img/scene-'))&&!resources.some(n=>n.includes('/mobile/')),'large viewport original scene');
  assert(errors.length===0,errors.join(';'));return {passed:true,checks:['3s fallback','one entry image','retry once','placeholder','diagnostic 503','late response isolation','mobile vs desktop','no scroll'],errors};
 }finally{await p.close();}
}
