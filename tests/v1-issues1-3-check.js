async(page)=>{
 const p=await page.context().browser().newPage({viewport:{width:393,height:659}}),assert=(v,m)=>{if(!v)throw Error(m)};
 try{
  await p.addInitScript(()=>{localStorage.setItem('ct-muted','true');localStorage.removeItem('ct-bead-guide');window.menuCount=0;document.addEventListener('contextmenu',()=>menuCount++);});
  await p.goto('http://127.0.0.1:8821');await p.waitForFunction(()=>document.querySelector('#app').getAttribute('aria-busy')==='false');
  assert(await p.evaluate(()=>performance.getEntriesByName('ct-interactive').length===1),'interactive mark');
  await p.locator('[data-action=enter]').click();await p.locator('[data-action=continue]').click();await p.locator('[data-action=beads]').click();await p.locator('#bead-control').waitFor();
  assert(await p.locator('.bead-guide').evaluate(e=>e.classList.contains('visible')),'first-use guide');
  const thumb=await p.locator('.thumb-point').boundingBox();await p.mouse.move(thumb.x,thumb.y);await p.mouse.down();await p.waitForTimeout(800);await p.mouse.move(thumb.x,thumb.y+90,{steps:8});await p.mouse.up();
  assert(await p.locator('#bead-count').textContent()==='1 / 108','one bead');
  assert(await p.evaluate(()=>getSelection().toString()===''&&menuCount===0&&localStorage.getItem('ct-bead-guide')==='true'),'selection/menu/learned');
  assert(!await p.locator('.bead-guide').evaluate(e=>e.classList.contains('visible')),'guide hides');
  await p.locator('[data-action=bead-hand]').click();assert(await p.locator('.thumb-point').evaluate(e=>parseFloat(e.style.left)<innerWidth/2),'left mirror');
  const control=await p.locator('#bead-control').boundingBox();await p.mouse.move(control.x+80,control.y+300);await p.mouse.down();await p.mouse.move(control.x+150,control.y+300,{steps:3});await p.mouse.up();assert(await p.locator('.bead-guide').evaluate(e=>e.classList.contains('visible')),'invalid gesture hint');
  await p.locator('[data-action=home]').click();await p.locator('[data-action=mo]').click();await p.locator('#wood-prop').waitFor({state:'visible'});for(let i=0;i<30;i++)await p.locator('#wood-prop').click();
  assert(await p.evaluate(()=>getSelection().toString()===''&&menuCount===0),'rapid taps guarded');
  return {passed:true,checks:['interactive mark','long press/drag','first-use guide','learned guide','invalid hint','left mirror','30 wood taps']};
 }finally{await p.close();}
}
