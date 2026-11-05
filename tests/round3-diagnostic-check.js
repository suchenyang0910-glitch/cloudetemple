async(page)=>{
 const p=await page.context().browser().newPage({viewport:{width:393,height:852}}),assert=(v,m)=>{if(!v)throw Error(m)},errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto('http://127.0.0.1:8824/?debug=audio');await p.locator('#audio-test').waitFor();
  assert(await p.evaluate(()=>performance.getEntriesByType('resource').every(r=>!r.name.includes('/assets/audio/'))),'debug does not preload sound');
  await p.locator('#audio-test').click();await p.waitForFunction(()=>document.querySelector('#audio-debug textarea').value.includes('mo.mp3: HTTP=200')&&document.querySelector('#audio-debug textarea').value.includes('"name":"mo"'));
  const good=await p.locator('#audio-debug textarea').inputValue();assert(good.includes('decode=ok')&&good.includes('advancing=yes'),'decode and clock');
  await p.screenshot({path:'E:/cloudtemple/screenshots/round3/beads-v2/audio-debug-regression.png'});
  await p.locator('#audio-native-test').click();await p.waitForFunction(()=>document.querySelector('#audio-debug textarea').value.includes('"result":"playing"'));
  await p.locator('#audio-debug summary').click();await p.locator('[data-action=enter]').click();await p.locator('[data-action=continue]').click();await p.locator('[data-action=mo]').click();
  await p.evaluate(async()=>{const {audio}=await import('/app.js');await audio.context.suspend();});
  await p.locator('#wood-prop').click();await p.waitForFunction(async()=>{const {audio}=await import('/app.js');return audio.context.state==='running'});
  await p.locator('#sound-toggle').click();assert(await p.evaluate(async()=>{const {audio}=await import('/app.js');return !audio.enabled&&[...audio.native.values()].every(e=>e.paused)&&audio.master.gain.value===0}),'mute stops both routes');
  await p.route('**/assets/audio/*',r=>r.fulfill({status:401,body:'Unauthorized'}));await p.reload();await p.locator('#audio-test').click();await p.waitForFunction(()=>document.querySelector('#audio-debug textarea').value.includes('HTTP=401'));
  assert((await p.locator('#audio-debug textarea').inputValue()).includes('HTTP 401'),'auth failure visible');
  await p.unrouteAll({behavior:'wait'});await p.route('**/assets/audio/*',r=>r.fulfill({status:200,contentType:'text/html',body:'not audio'}));await p.reload();await p.locator('#audio-test').click();await p.waitForFunction(()=>document.querySelector('#audio-debug textarea').value.includes('decode=failed'));
  assert(errors.length===0,errors.join(';'));return {passed:true,checks:['lazy debug','200/decode/clock','HTML audio','suspended recovery','mute both routes','401 visible','decode error visible'],errors};
 }finally{await p.close();}
}
