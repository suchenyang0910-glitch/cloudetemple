async(page)=>{
 const p=await page.context().browser().newPage({viewport:{width:393,height:852}}),check=(v,m)=>{if(!v)throw Error(m)};
 try{
 await p.addInitScript(()=>localStorage.setItem('ct-muted','true'));await p.goto('http://127.0.0.1:8824');
 const ready=()=>p.waitForFunction(()=>document.querySelector('#app').getAttribute('aria-busy')==='false');
 const click=async a=>{await p.locator(`[data-action=${a}]`).click();await ready();};await ready();
 await p.locator('#sound-toggle').click();await p.waitForFunction(async()=>{const {audio}=await import('/app.js');return audio.enabled&&!audio.loading;});
 await p.evaluate(async()=>{const {audio}=await import('/app.js');window.soundEvents=[];audio.observe=e=>soundEvents.push(e);});
 await click('enter');await click('continue');await click('incense');await click('light');
 await p.waitForFunction(async()=>{const {audio}=await import('/app.js');return !!audio.background;});
 check(await p.evaluate(()=>soundEvents.some(e=>e.event==='play'&&e.name==='keisu'&&e.gain===.6)),'incense keisu');
 await click('home');check(await p.evaluate(async()=>{const {audio}=await import('/app.js');return !audio.background&&audio.fading.size>0;}),'incense fades on leaving');
 await click('beads');await p.waitForFunction(async()=>{const {audio}=await import('/app.js');return audio.buffers.has('bead-v1');});
 for(let i=0;i<27;i++){await p.locator('#bead-control').press('Enter');await p.waitForTimeout(100);}
 check(await p.evaluate(()=>soundEvents.filter(e=>e.event==='play'&&e.name==='bead-v1').length===27),'each bead plays');
 check(await p.evaluate(()=>soundEvents.some(e=>e.event==='play'&&e.name==='keisu'&&e.gain===.25)),'spacer sound');
 await click('home');await click('leave');check(await p.evaluate(()=>soundEvents.some(e=>e.event==='play'&&e.name==='bell'&&e.gain===.5)),'leave bell');
 await p.locator('#sound-toggle').click();const before=await p.evaluate(()=>soundEvents.filter(e=>e.event==='play').length);await click('reenter');await click('enter');await click('continue');await click('incense');await click('light');await p.waitForTimeout(300);
 check(await p.evaluate(()=>soundEvents.filter(e=>e.event==='play').length)===before,'muted new actions silent');
 return {passed:true,checks:['incense keisu .6','incense fade-out','27 bead recordings','spacer .25','leave bell .5','mute new actions']};
 }finally{await p.close();}
}
