from datetime import datetime, timezone
from pathlib import Path
import os, time
from playwright.sync_api import sync_playwright

BASE=os.environ.get('CT_TEST_BASE','http://127.0.0.1:4178')
OUT=Path(__file__).resolve().parents[1]/'screenshots/l2-incense/hall-color-check'
OUT.mkdir(parents=True,exist_ok=True)

def wait(check,seconds=12):
 end=time.time()+seconds
 while time.time()<end:
  if check():return
  time.sleep(.05)
 raise AssertionError('page state timeout')

with sync_playwright() as pw:
 browser=pw.chromium.launch()
 for period,fixed in {'day':datetime(2026,11,10,3,tzinfo=timezone.utc),'night':datetime(2026,11,10,13,tzinfo=timezone.utc)}.items():
  opts={'viewport':{'width':393,'height':659},'timezone_id':'Asia/Bangkok'}
  if os.environ.get('CT_TEST_USER'):opts['http_credentials']={'username':os.environ['CT_TEST_USER'],'password':os.environ['CT_TEST_PASS']}
  context=browser.new_context(**opts);context.route('**/api/**',lambda route:route.fulfill(status=200,content_type='application/json',body='{}'))
  page=context.new_page();page.clock.set_fixed_time(fixed);page.add_init_script("localStorage.setItem('ct-muted','true');localStorage.setItem('ct-morning-seen','true');localStorage.setItem('ct-visitor',JSON.stringify('bun-light'))")
  page.goto(BASE,wait_until='domcontentloaded');wait(lambda:page.locator('#app').get_attribute('aria-busy')=='false')
  page.locator('[data-action=enter]').click();wait(lambda:page.locator('body').get_attribute('data-view')=='choose');page.locator('[data-action=continue]').click();wait(lambda:page.locator('body').get_attribute('data-view')=='home')
  for view in ['bow','mo','beads']:
   page.evaluate("v=>document.querySelector('[data-action='+v+']').click()",view);wait(lambda:page.locator('body').get_attribute('data-view')==view);wait(lambda:page.locator('#app').get_attribute('aria-busy')=='false');time.sleep(.4)
   page.evaluate("document.querySelector('#ga-choice').style.display='none';scrollTo(0,0)");page.screenshot(path=OUT/f'{view}-{period}-393x659.png')
   page.evaluate("document.querySelector('[data-action=home]').click()");wait(lambda:page.locator('body').get_attribute('data-view')=='home')
  context.close()
 browser.close()
print('hall color check: 6 screenshots')
