// Run: node tests/town-shell.cjs [path to an existing Playwright installation]
const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),out=path.join(root,'_archive','town-shell-evidence');
fs.mkdirSync(out,{recursive:true});
const policy="default-src 'self'; script-src 'self' https://static.cloudflareinsights.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src https://*.google-analytics.com https://www.googletagmanager.com 'self' data: blob:; connect-src https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com 'self' https://cloudflareinsights.com https://api.chuamay.org; media-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg','.m4a':'audio/mp4'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end('{"enabled":false}');return;}
  if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
  const file=path.resolve(dist,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Content-Security-Policy',policy);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));
});
const packageApp=enabled=>execFileSync('powershell',['-NoProfile','-ExecutionPolicy','Bypass','-File','tools/package.ps1','-Environment','production',...(enabled?['-EnableTown']:[])],{cwd:root,stdio:'pipe'});
(async()=>{
  let browser;const results={baseline:'0115ca2069bc6ff45458338b0d698eca3dee8743',api:'local synthetic disabled responses',screens:[],failures:[]};
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://h5.chuamay.org:'+server.address().port;
    browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP h5.chuamay.org 127.0.0.1','--proxy-server=direct://','--proxy-bypass-list=*']});results.browser=browser.version();
    async function pageFor(viewport={width:1280,height:900}){
      const context=await browser.newContext({viewport,timezoneId:'America/Los_Angeles'});const page=await context.newPage();
      await page.addInitScript(()=>{const NativeDate=Date;window.townTestNow=NativeDate.parse('2026-11-21T10:00:00+07:00');window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[window.townTestNow]));}static now(){return window.townTestNow;}};});
      await context.route('https://api.chuamay.org/**',r=>r.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true'},body:'{"enabled":false}'}));
      await context.route(/^https?:\/\/(?!h5\.chuamay\.org:|api\.chuamay\.org\/)/,r=>r.abort());
      await page.addInitScript(()=>{localStorage.setItem('ct-muted','true');window.cspErrors=[];addEventListener('securitypolicyviolation',e=>window.cspErrors.push(e.violatedDirective));});
      return page;
    }
    async function home(page){await page.goto(origin+'/?town=home');await page.waitForSelector('body[data-view="home"]');await page.locator('#ga-choice button').last().click();}
    packageApp(false);let page=await pageFor();const disabledRequests=[];page.on('request',r=>disabledRequests.push(r.url()));await home(page);
    assert.equal(await page.locator('#town-entry').count(),0);
    await page.goto(origin+'/town.html');await page.waitForURL(origin+'/');await page.waitForSelector('body[data-view="home"]');
    assert(!disabledRequests.some(u=>/town-(scene|three)/.test(u)));results.disabled='PASS: no entry; direct URL returns home; no 3D module fetch';await page.context().close();
    packageApp(true);const release=JSON.parse(fs.readFileSync(path.join(dist,'release.json'))).release;
    const moduleURL='/town-loader.'+release+'.js';
    const state=p=>p.evaluate(async u=>(await import(u)).world.position(),moduleURL);
    const project=(p,x,z)=>p.evaluate(async ({u,x,z})=>(await import(u)).world.project(x,z),{u:moduleURL,x,z});
    for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
      page=await pageFor(viewport);const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
      await home(page);assert.equal(await page.locator('#town-entry').count(),1);await page.locator('#town-entry').click();await page.waitForSelector('body[data-ready="true"]');
      assert.equal(await page.locator('#back-2d').evaluate(el=>getComputedStyle(el).position),'absolute');
      const titleBox=await page.locator('.place').boundingBox(),exitBox=await page.locator('#back-2d').boundingBox();assert(exitBox.y>=titleBox.y+titleBox.height);
      const soundBox=await page.locator('#town-sound').boundingBox();assert.equal(exitBox.height,44);assert(exitBox.x+exitBox.width<soundBox.x,'single line return and sound do not overlap');
      assert((await page.locator('#mini').boundingBox()).y>viewport.height/2);
      const firstFrame=await page.evaluate(()=>performance.getEntriesByName('town-first-frame')[0].startTime);
      const before=await state(page);await page.waitForTimeout(500);const point=await project(page,0,60);await page.mouse.click(point.x,point.y);
      let after=await state(page);const walkDeadline=Date.now()+20000;
      while(Math.hypot(after.x-before.x,after.z-before.z)<=2&&Date.now()<walkDeadline){await page.waitForTimeout(100);after=await state(page);}
      assert(Math.hypot(after.x-before.x,after.z-before.z)>2,JSON.stringify({viewport,before,after,point}));
      const nav=await page.evaluate(async u=>{const w=(await import(u)).world;return [[0,66.5,0,-40.4],[0,66.5,36,8],[36,8,-34,29]].map(p=>w.plan(...p).length)},moduleURL);assert(nav.every(n=>n>0));
      await page.locator('#placesbtn').click();await page.locator('[data-n="2"]').click();
      await page.waitForSelector('[data-s="go_chuamay"]:visible');await page.locator('[data-s="go_chuamay"]').click();
      await page.waitForURL(origin+'/');await page.waitForSelector('body[data-view="home"]');const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('ct-town-return-v1')));
      assert.equal(await page.locator('body').getAttribute('data-period'),'day','existing hall also follows UTC+7 on a Los Angeles device');
      assert(saved&&Math.abs(saved.x)<.4&&Math.abs(saved.z+40.4)<.4);
      for(const activity of ['sit','mo','bow','incense','beads']){await page.locator(`[data-action="${activity}"]`).first().click();await page.waitForSelector(`body[data-view="${activity}"]`);await page.locator('[data-action="home"]').first().click();await page.waitForSelector('body[data-view="home"]');}
      await page.locator('#town-entry').click();await page.waitForSelector('body[data-ready="true"]');const restored=await state(page);assert(Math.hypot(restored.x-saved.x,restored.z-saved.z)<.01);
      assert.equal(await page.locator('.spot').count(),1);assert.equal(await page.locator('#demobtn,#demotag').count(),0);
      assert.equal(await page.locator('[data-t]').count(),0);
      for(const [hour,period] of [[6,'dawn'],[10,'day'],[18,'dusk'],[22,'night']]){
        await page.evaluate(value=>window.townTestNow=value,Date.parse(`2026-11-21T${String(hour).padStart(2,'0')}:00:00+07:00`));
        await page.waitForFunction(p=>document.body.dataset.period===p,period);
      }
      await page.evaluate(value=>window.townTestNow=value,Date.parse('2026-11-21T10:00:00+07:00'));await page.waitForFunction(()=>document.body.dataset.period==='day');
      const posts=await page.evaluate(async u=>{const w=(await import(u)).world;return [[-48.0125,47.9875],[18.25,34.25],[21.75,37.75]].map(([x,z])=>w.walkable(x,z));},moduleURL);assert.deepEqual(posts,[false,false,false]);
      await page.locator('#placesbtn').click();await page.locator('.places-scroll').evaluate(el=>el.scrollTop=el.scrollHeight);
      const closeBox=await page.locator('#places .x').boundingBox();assert(closeBox.y>=0&&closeBox.y+closeBox.height<viewport.height);await page.locator('#places .x').click();
      assert(!requests.some(u=>/\/audio\//.test(u)),'no audio requests before a gesture');
      await page.locator('#town-sound').click();await page.waitForFunction(async u=>!!(await import(u)).audio.background,moduleURL);
      assert(requests.some(u=>u.includes('/audio/ambient-courtyard.mp3')),'existing recorded ambient');
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
      assert.equal(await page.evaluate(async u=>(await import(u)).audio.background===null,moduleURL),true);
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
      await page.waitForFunction(async u=>!!(await import(u)).audio.background,moduleURL);
      await page.locator('#town-sound').click();assert.equal(await page.locator('#town-sound').getAttribute('aria-pressed'),'false');
      await page.screenshot({path:path.join(out,`town-${viewport.width}.png`)});
      assert(!/[\u4e00-\u9fff]|Xem thử/.test(await page.locator('body').innerText()));assert.deepEqual(await page.evaluate(()=>window.cspErrors),[]);assert.deepEqual(errors,[]);assert(!requests.some(u=>!u.startsWith(origin)&&!u.startsWith('https://api.chuamay.org/')));
      await page.locator('#back-2d').click();await page.waitForURL(origin+'/');await page.waitForSelector('body[data-view="home"]');
      const invalidReturn=await page.evaluate(async release=>{const nav=await import('/town-navigation.'+release+'.js');return ['{','null','{"x":999,"z":0,"yaw":0,"pitch":0.4,"distance":12}'].map(value=>{sessionStorage.setItem('ct-town-return-v1',value);return nav.readTownReturn();});},release);assert.deepEqual(invalidReturn,[null,null,null]);
      results.screens.push({viewport,firstFrameMs:Math.round(firstFrame),walk:{before,after},threeRoutes:nav,door:saved,restored,cspErrors:0,pageErrors:0,externalRequests:0,manualReturn:'PASS',invalidSavedPositions:'rejected',returnHeight:exitBox.height,autoPeriodsUTC7:'PASS (device America/Los_Angeles)',pavilionCollisions:posts,audio:'gesture, recorded ambient, hidden pause/resume, mute PASS',fiveActivities:'opened and returned'});await page.context().close();
    }
    for(const kind of ['scene','three','webgl','context-loss']){
      page=await pageFor();await home(page);
      if(kind==='scene'||kind==='three')await page.route('**/town-'+kind+'.*.js',r=>r.abort());
      if(kind==='webgl')await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args)};});
      await page.locator('#town-entry').click();
      if(kind==='context-loss'){await page.waitForSelector('body[data-ready="true"]');await page.locator('#stage > canvas').first().evaluate(c=>c.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));}
      await page.waitForURL(origin+'/');await page.waitForSelector('body[data-view="home"]');assert.equal(await page.locator('#town-entry').count(),0);
      await page.reload();await page.waitForSelector('body[data-view="entry"]');assert(!page.url().includes('town.html'));
      await page.goto(origin+'/town.html');await page.waitForURL(origin+'/');assert.equal(await page.locator('#town-entry').count(),0);
      results.failures.push({kind,result:'PASS: home fallback, blocked reentry, no auto retry'});await page.context().close();
    }
    page=await pageFor();await home(page);await page.locator('#town-entry').click();await page.waitForSelector('body[data-ready="true"]');
    await page.route('**/assets/**/audio/**',r=>r.abort());await page.locator('#town-sound').click();
    await page.waitForFunction(()=>document.getElementById('msg').textContent.includes('Chưa mở được âm thanh'));
    assert.equal(await page.locator('body').getAttribute('data-ready'),'true');assert.equal(await page.locator('#town-sound').getAttribute('aria-pressed'),'false');
    results.audioFailure='PASS: unavailable audio stays in town and resets mute state';await page.context().close();
    page=await pageFor();await home(page);
    await page.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>raf(()=>setTimeout(()=>fn(performance.now()),100));});
    await page.locator('#town-entry').click();await page.waitForSelector('body[data-ready="true"]');
    await page.waitForSelector('#town-slow:not([hidden])',{timeout:20000});
    await page.screenshot({path:path.join(out,'town-slow.png')});await page.locator('#town-fallback').click();await page.waitForURL(origin+'/');
    await page.waitForSelector('body[data-view="home"]');assert.equal(await page.locator('#town-entry').count(),0);
    results.failures.push({kind:'continuous low FPS (injected 100ms frames)',result:'PASS: prompt, one-click home, session reentry blocked'});await page.context().close();
    results.packageBytes=JSON.parse(fs.readFileSync(path.join(root,'deploy',`package-${release}.json`))).totalBytes;
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
  }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
