// Run with Playwright browser_run_code_unsafe(filename); local demo must already be open.
async (page) => {
  await page.reload();
  await page.waitForFunction(() => window.__petgarden?.world());
  const layout = await page.evaluate(() => {
    const assert = (ok, message) => { if (!ok) throw Error(message); };
    const a = window.__petgarden, w = a.world(), slots = w.memorialSlots;
    const groups = new Map();
    for (const s of slots) { if (!groups.has(s.cluster)) groups.set(s.cluster, []); groups.get(s.cluster).push(s); }
    const islands = [...groups.values()].filter(g => !g[0].privateCourt);
    const courts = slots.filter(s => s.privateCourt);
    assert(slots.length === 34 && islands.length === 6 && courts.length === 4 && w.trees.length === 6, 'layout counts');
    assert(islands.every(g => g.length === 5), 'five plaques per island');
    assert(slots.every(s => !s.sample && Math.abs(s.yaw - Math.atan2(-s.x, -s.z)) < 1e-8), 'blank plaques facing pool');
    const distances = islands.map(g => Math.min(...g.flatMap((s, i) => g.slice(i + 1).map(t => Math.hypot(s.x - t.x, s.z - t.z)))));
    assert(distances.every(d => Math.abs(d - 4) < .01), 'four metre spacing');
    const centres = islands.map(g => ({x:g.reduce((v,s)=>v+s.x,0)/g.length,z:g.reduce((v,s)=>v+s.z,0)/g.length}));
    const clearGrass = Math.min(...centres.flatMap((s,i)=>centres.slice(i+1).map(t=>Math.hypot(s.x-t.x,s.z-t.z)-2*4.83)));
    assert(clearGrass > 2, 'visible grass between floral borders');
    for (const s of courts) {
      assert(groups.get(s.cluster).length === 1, 'one private plaque');
      assert(w.free(s.x, s.z + 2.5) && !w.free(s.x + 2.5, s.z), 'open gate and solid side');
      const route = w.route(w.start, {x:s.x+1,z:s.z+1}); let last = w.start;
      assert(route.length > 0, 'court reachable');
      for (const p of route) { assert(w.segment(last,p), 'court route crosses obstacle'); last=p; }
    }
    const tests=a.tests(); assert(tests.cases===100 && tests.unreachable===0 && tests.wallCrossings===0, '100 navigation cases');
    const points=[]; w.g.traverse(o=>{if(o.isPoints)points.push(o)});
    assert(points.length===1 && points[0].geometry.attributes.position.count===112, 'single Points / 112 particles');
    assert(w.g.children.filter(o=>o.name.startsWith('lawn-butterfly-')).length===4, 'four butterflies');
    assert(a.camera.fov===58 && a.controls().zoom===5.6 && a.controls().pitch===0, 'default camera');
    return {slots:slots.length,islands:islands.length,courts:courts.length,distances,clearGrass,tests};
  });
  const motion = () => page.evaluate(() => {const w=window.__petgarden.world(),p=w.g.getObjectByName('lawn-petals');return {y:p.geometry.attributes.position.getY(8),wing:w.g.getObjectByName('lawn-butterfly-0').children[0].rotation.y}});
  const before=await motion(); await page.waitForTimeout(250); const after=await motion();
  if (!(after.y<before.y && after.wing!==before.wing)) throw Error('petal / wing animation');
  await page.locator('#sample').check();
  const samples=await page.evaluate(()=>window.__petgarden.world().memorialSlots.filter(s=>s.sample).length);
  if(samples!==3)throw Error('sample opt-in');
  await page.locator('#sample').uncheck();
  await page.evaluate(()=>{const a=window.__petgarden;a.setPose(10,-9.5,0,0,7)});
  await page.waitForTimeout(100);
  const plaque=await page.evaluate(()=>{const a=window.__petgarden,w=a.world(),s=w.memorialSlots.find(p=>p.privateCourt),p=new w.T.Vector3(s.x,w.floorY(s.x,s.z)+.23,s.z).project(a.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}});
  await page.mouse.click(plaque.x,plaque.y);
  await page.waitForFunction(()=>!document.querySelector('#card').hidden);
  const card=await page.locator('#card').innerText();
  if(!card.includes('Nơi này còn trống'))throw Error('blank card');
  await page.keyboard.press('Escape');
  const cleared=await page.evaluate(()=>({hidden:document.querySelector('#card').hidden,samples:window.__petgarden.world().memorialSlots.filter(s=>s.sample).length}));
  if(!cleared.hidden || cleared.samples!==0)throw Error('card close / sample reset');
  await page.evaluate(()=>{const a=window.__petgarden;a.setPose(0,0,0,Math.PI/2,37);a.camera.fov=96;a.camera.updateProjectionMatrix()});
  await page.waitForTimeout(100);
  const metrics=await page.evaluate(()=>window.__petgarden.metrics());
  if(metrics.triangles>60000 || metrics.calls>45)throw Error('render budget');
  return {status:'PASS',layout,motion:{before,after},samples,card,cleared,metrics};
}
