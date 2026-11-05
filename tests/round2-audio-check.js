async(page)=>{
 page=await page.context().browser().newPage();
 const assert=(v,m)=>{if(!v)throw Error(m)},errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.audioAudit={contexts:0,starts:[]};const Original=window.AudioContext;
  if(Original)window.AudioContext=class extends Original{constructor(...args){super(...args);audioAudit.contexts++;const create=this.createBufferSource.bind(this);this.createBufferSource=()=>{const s=create(),start=s.start.bind(s);s.start=(when=0,...args)=>{audioAudit.starts.push({when:when||this.currentTime,duration:s.buffer?.duration,loop:s.loop});return start(when,...args)};return s;};}};
 });
 await page.setViewportSize({width:393,height:852});await page.clock.install({time:new Date('2026-11-05T10:00:00+07:00')});
 await page.goto('http://127.0.0.1:8798');await page.evaluate(()=>localStorage.clear());await page.reload();await page.locator('[data-action=enter]').waitFor();
 assert(await page.evaluate(()=>audioAudit.contexts===0&&performance.getEntriesByType('resource').every(e=>!e.name.includes('/audio/'))),'initial silent lazy');
 await page.locator('[data-action=enter]').click();await page.waitForFunction(()=>document.querySelector('#sound-toggle').getAttribute('aria-busy')==='false'&&audioAudit.starts.length===1);
 assert(await page.evaluate(()=>audioAudit.contexts===1),'gesture creates one context');
 await page.locator('#sound-toggle').click();await page.reload();await page.locator('[data-action=enter]').click();await page.locator('[data-action=continue]').click();await page.locator('[data-action=mo]').click();await page.locator('#wood-prop').waitFor({state:'visible'});
 assert(await page.evaluate(()=>audioAudit.contexts===0&&performance.getEntriesByType('resource').every(e=>!e.name.includes('/audio/'))),'remember mute: no context or downloads');
 await page.locator('#sound-toggle').click();await page.waitForFunction(()=>document.querySelector('#sound-toggle').getAttribute('aria-busy')==='false'&&audioAudit.starts.length>0);
 await page.evaluate(()=>{for(let i=0;i<20;i++)document.querySelector('#wood-prop').click()});
 assert((await page.locator('#daily-wood').innerText()).endsWith('20'),'20 taps');
 const voices=await page.evaluate(()=>{const hits=audioAudit.starts.filter(s=>s.duration<.5);return {hits:hits.length,max:Math.max(...hits.map(s=>hits.filter(t=>t.when<=s.when+.00001&&t.when+t.duration>s.when+.00001).length))}});assert(voices.hits===20&&voices.max<=6,'six-voice cap');
 await page.locator('[data-action=wood-auto]').click();await page.clock.runFor(2100);assert((await page.locator('#daily-wood').innerText()).endsWith('22'),'auto tick');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});await page.clock.runFor(3000);assert((await page.locator('#daily-wood').innerText()).endsWith('22'),'hidden stops auto');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))});
 await page.clock.setSystemTime(new Date('2026-11-06T10:00:00+07:00'));await page.clock.runFor(300);assert((await page.locator('#daily-wood').innerText()).endsWith('0'),'local next day reset');
 await page.locator('#wood-prop').focus();await page.keyboard.press('Space');assert((await page.locator('#daily-wood').innerText()).endsWith('1'),'keyboard tap');
 await page.locator('#sound-toggle').click();const before=await page.evaluate(()=>audioAudit.starts.length);await page.locator('#wood-prop').click();assert(await page.evaluate(()=>audioAudit.starts.length)===before,'mute creates no source');
 await page.evaluate(()=>{for(let i=0;i<84;i++)document.querySelector('#wood-prop').click()});assert((await page.locator('#wood-message').innerText()).length>0,'108 quiet message');assert(!await page.locator('#modal').isVisible(),'108 does not interrupt');await page.locator('[data-action=home]').click();await page.locator('[data-action=sit]').click();await page.locator('[data-action=sit-start]').click();await page.locator('#ambient').selectOption('forest');assert(await page.evaluate(()=>performance.getEntriesByType('resource').every(e=>!e.name.includes('ambient-courtyard'))),'muted background not downloaded');
 await page.locator('#sound-toggle').click();await page.waitForFunction(()=>audioAudit.starts.some(s=>s.loop));
 const loops=await page.evaluate(()=>audioAudit.starts.filter(s=>s.loop).map(s=>s.duration));
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))});await page.waitForFunction(()=>audioAudit.starts.filter(s=>s.loop).length>=2);
 assert(errors.length===0,errors.join(';'));return {passed:true,voices,backgroundDurations:loops,errors};
}
