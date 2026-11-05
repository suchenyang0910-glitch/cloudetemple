// Run through Playwright browser_run_code_unsafe(filename=absolute path), with tools/serve.mjs running.
async (page) => {
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  const click=action=>page.locator(`[data-action="${action}"]`).click();
  const shot=async name=>{await page.clock.runFor(600);await page.locator('#scene').evaluate(e=>e.getAnimations().forEach(a=>a.finish()));await page.screenshot({path:`E:/cloudtemple/screenshots/${name}.png`,fullPage:true});};
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.clock.install({time:new Date('2026-11-05T10:00:00+07:00')});
  await page.goto('http://127.0.0.1:8788');
  await page.locator('[data-action=enter]').waitFor();
  await shot('01-entry');
  await click('enter');await click('continue');
  await page.locator('[data-action=incense]').waitFor();await shot('02-home');
  await click('incense');await click('light');await shot('03-incense');
  await page.clock.fastForward(61000);await page.locator('[data-action=share]').waitFor();
  await click('home');await click('bow');await page.locator('[data-target="108"]').waitFor();
  for(const n of [27,54,108,3]){await page.locator(`[data-target="${n}"]`).click();assert(await page.locator(`[data-target="${n}"]`).getAttribute('aria-pressed')==='true','bow target');}
  await click('bow-once');await page.clock.runFor(1300);await shot('04-bow');
  await page.clock.runFor(2300);assert((await page.locator('#bow-count').innerText())==='1 / 3','one bow');
  await click('auto');await page.clock.runFor(8500);await page.locator('[data-action=share]').waitFor();
  await click('home');await click('sit');await page.locator('[data-minutes="1"]').click();await click('sit-start');
  await page.clock.runFor(10000);await click('pause');const held=await page.locator('#timer').innerText();
  await page.clock.fastForward(15000);assert(await page.locator('#timer').innerText()===held,'paused timer');
  await click('wood');assert((await page.locator('#wood-count').innerText()).endsWith('1'),'wood counter');await shot('05-sit');
  await click('pause');await page.clock.fastForward(51000);await click('share');await page.locator('.share-preview').waitFor();await shot('07-share');
  const pending=page.waitForEvent('download');await click('download');assert((await pending).suggestedFilename()==='chua-may.png','PNG download');
  await page.locator('#close-modal').click();await click('home');await click('beads');await page.locator('#bead-control').focus();
  await page.keyboard.press('Enter');await page.keyboard.press('Enter');assert(await page.locator('#bead-control').innerText()==='2 / 108','keyboard focus');await shot('06-beads');
  for(let i=2;i<108;i++)await click('bead');await page.locator('[data-action=share]').waitFor();
  await click('home');await click('more');await page.locator('#memorial').click();await shot('08-memorial');await page.locator('#waitlist-form button').click();assert((await page.locator('#form-status').innerText()).length>0,'form validation');await page.locator('#close-modal').click();
  await page.clock.setSystemTime(new Date('2026-11-05T22:00:00+07:00'));await click('bow');await click('bow-once');await page.clock.runFor(1300);await shot('09-night-bow');
  assert(await page.locator('body').getAttribute('data-period')==='night','night');
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>getComputedStyle(document.querySelector('.halo-pulse')).animationName==='none');
  for(const width of [375,390,430]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'overflow');}
  await page.setViewportSize({width:390,height:844});await click('home');await click('more');await page.locator('#language').selectOption('en');assert(await page.locator('html').getAttribute('lang')==='en','English');
  return {passed:true,screenshots:9,paused:held,viewportWidths:[375,390,430]};
}
