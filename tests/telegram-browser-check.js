// Local mocked Telegram bridge: this is not a real Telegram client test.
async(page)=>{
  const assert=(v,m)=>{if(!v)throw Error(m);};let sdkRequests=0,reminder=null;
  const sdk=`window.audit={ready:0,expand:0,haptics:[],backVisible:false};window.Telegram={WebApp:{initData:'mock-signed-data',themeParams:{bg_color:'#202520',text_color:'#fffaf1',button_color:'#614a32',button_text_color:'#fffaf1'},ready(){audit.ready++},expand(){audit.expand++},BackButton:{onClick(f){audit.back=f},show(){audit.backVisible=true},hide(){audit.backVisible=false}},HapticFeedback:{impactOccurred(k){audit.haptics.push(k)}},onEvent(){},setHeaderColor(){},setBackgroundColor(){},openTelegramLink(u){audit.share=u}}};`;
  await page.route('https://telegram.org/js/telegram-web-app.js',r=>{sdkRequests++;return r.fulfill({contentType:'text/javascript',body:sdk});});
  await page.route(/^https:\/\/(h5|miniapp|staging)\.chuamay\.org\//,async r=>{const url=new URL(r.request().url());const response=await r.fetch({url:'http://127.0.0.1:8788'+url.pathname+url.search});await r.fulfill({response});});
  await page.route('https://api.chuamay.org/telegram/remind',async r=>{if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'https://miniapp.chuamay.org','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST'}});reminder=r.request().postDataJSON();return r.fulfill({status:201,headers:{'Access-Control-Allow-Origin':'https://miniapp.chuamay.org'},contentType:'application/json',body:'{"ok":true}'});});
  try{
    await page.goto('https://h5.chuamay.org');await page.locator('[data-action=enter]').waitFor();assert(sdkRequests===0,'h5 must not load Telegram');
    await page.goto('https://miniapp.chuamay.org');await page.locator('[data-action=enter]').waitFor();assert(await page.evaluate(()=>audit.ready===1&&audit.expand===1),'ready/expand');
    await page.locator('[data-action=enter]').click();await page.locator('[data-action=continue]').click();await page.locator('[data-action=beads]').click();await page.locator('#bead-control').click();assert(await page.evaluate(()=>audit.haptics[0]==='light'),'light haptic');
    for(let i=1;i<108;i++)await page.locator('#bead-control').click();assert(await page.evaluate(()=>audit.haptics.at(-1)==='heavy'),'heavy haptic');
    await page.locator('[data-action=share]').click();await page.locator('[data-action=share-file]').click();assert(await page.evaluate(()=>audit.share.startsWith('https://t.me/share/url?')),'Telegram share');
    await page.evaluate(()=>audit.back());await page.evaluate(()=>audit.back());await page.locator('[data-action=bow]').click();await page.locator('[data-action=bow-once]').click();await page.clock.runFor(4200);assert(await page.evaluate(()=>audit.haptics.includes('soft')),'bow haptic');
    await page.evaluate(()=>audit.back());await page.locator('[data-action=more]').click();await page.locator('#memorial').click();assert(await page.locator('#email').count()===0,'no email in mini app');await page.locator('#remind-form input').check();await page.locator('#remind-form button').click();await page.waitForFunction(()=>document.querySelector('#remind-status').textContent.length>0);assert(reminder?.initData==='mock-signed-data'&&reminder.consent===true,'signed reminder payload');
    await page.screenshot({path:'E:/cloudtemple/screenshots/11-miniapp-mocked.png',fullPage:true});
    return {passed:true,sdkRequests,reminderConsent:reminder.consent,mode:'mocked Telegram bridge; not device evidence'};
  }finally{await page.unrouteAll({behavior:'wait'});}
}
