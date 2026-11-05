async(page)=>{
 const assert=(v,m)=>{if(!v)throw Error(m)};
 await page.setViewportSize({width:393,height:852});
 const sdk=`window.audit={events:{},colors:{}};window.Telegram={WebApp:{initData:'mock',viewportStableHeight:852,safeAreaInset:{top:24,bottom:20},contentSafeAreaInset:{top:12,bottom:8},ready(){},expand(){},BackButton:{onClick(f){audit.back=f},show(){},hide(){}},SettingsButton:{onClick(f){audit.settings=f},show(){audit.settingsShown=true}},disableVerticalSwipes(){audit.swipesDisabled=true},enableClosingConfirmation(){audit.confirm=true},disableClosingConfirmation(){audit.confirm=false},onEvent(k,f){audit.events[k]=f},setHeaderColor(v){audit.colors.header=v},setBackgroundColor(v){audit.colors.background=v},setBottomBarColor(v){audit.colors.bottom=v}}};`;
 await page.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({contentType:'text/javascript',body:sdk}));
 await page.route('https://staging.chuamay.org/**',async r=>{const u=new URL(r.request().url());const response=await r.fetch({url:'http://127.0.0.1:8788'+u.pathname+u.search});await r.fulfill({response});});
 try{
 await page.clock.setSystemTime(new Date('2026-11-05T10:00:00+07:00'));
 await page.goto('https://staging.chuamay.org/?telegram=1');
 const shot=async(view,selector)=>{await page.locator(selector).waitFor();await page.locator('#loading').waitFor({state:'hidden'});await page.clock.runFor(600);await page.screenshot({path:`E:/cloudtemple/screenshots/one-screen-telegram-${view}.png`});assert(await page.evaluate(()=>document.scrollingElement.scrollHeight===innerHeight),'scroll');assert(!await page.locator('.topbar').isVisible(),'own topbar hidden')};
 await shot('entry','[data-action=enter]');await page.locator('[data-action=enter]').click();await shot('choose','[data-action=continue]');await page.locator('[data-action=continue]').click();await shot('home','[data-action=more]');
 for(const [view,selector] of [['incense','[data-action=light]'],['bow','[data-action=bow-once]'],['sit','[data-action=sit-start]'],['beads','#bead-control']]){
 await page.locator(`[data-action=${view}]`).click();await shot(view,selector);
 if(view==='incense'||view==='sit'){await page.locator(selector).click();assert(await page.evaluate(()=>audit.confirm),'running confirmation');if(view==='sit'){await page.locator('[data-action=pause]').click();assert(await page.evaluate(()=>!audit.confirm),'paused confirmation off');}}
 await page.locator('[data-action=home]').click();await page.locator('[data-action=more]').waitFor();assert(await page.evaluate(()=>!audit.confirm),'home confirmation off');}
 await page.evaluate(()=>audit.settings());assert(await page.locator('#more-menu').isVisible(),'settings opens');await page.locator('#close-more').click();
 const colors={};for(const [period,hour] of [['dawn',6],['day',10],['dusk',18],['night',22]]){await page.clock.setSystemTime(new Date(`2026-11-05T${String(hour).padStart(2,'0')}:00:00+07:00`));await page.locator('[data-action=bow]').click();await page.locator('[data-action=bow-once]').waitFor();colors[period]=await page.evaluate(()=>audit.colors);await page.locator('[data-action=home]').click();await page.locator('[data-action=more]').waitFor();}
 await page.screenshot({path:'E:/cloudtemple/screenshots/one-screen-telegram-night.png'});
 await page.evaluate(()=>{Telegram.WebApp.viewportStableHeight=780;audit.events.viewportChanged({isStateStable:true})});assert(await page.locator('#app').evaluate(e=>e.clientHeight)===780,'stable viewport resize');
 return {passed:true,mode:'mock bridge; native bars cannot be rendered by browser',colors,audit:await page.evaluate(()=>({swipesDisabled:audit.swipesDisabled,settingsShown:audit.settingsShown,safeTop:getComputedStyle(document.body).getPropertyValue('--safe-top')}))};
 }finally{await page.unrouteAll({behavior:'wait'})}
}
