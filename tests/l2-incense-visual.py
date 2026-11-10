from datetime import datetime, timezone
from pathlib import Path
import json, os, time
from playwright.sync_api import sync_playwright

BASE=os.environ.get('CT_TEST_BASE','http://127.0.0.1:4178')
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'screenshots/l2-incense'
OUT.mkdir(parents=True,exist_ok=True)
VISITORS=['short-light','curly-dark','curly-medium','bun-light','bun-dark','ponytail-medium']
PERIODS={'day':datetime(2026,11,10,3,tzinfo=timezone.utc),'night':datetime(2026,11,10,13,tzinfo=timezone.utc)}
STEPS=['walk-1','walk-2','hold','light','vai-1','vai-2','plant-1','end']
results=[]

def ready(page):
 page.wait_for_function("document.querySelector('#app').getAttribute('aria-busy')==='false'",timeout=12000)

def shot(page,visitor,period,step):
 page.evaluate("scrollTo(0,0)")
 path=OUT/f'{visitor}-{period}-{step}-393x659.png';page.screenshot(path=path)
 results.append({'visitor':visitor,'period':period,'step':step,'path':str(path)})

with sync_playwright() as pw:
 browser=pw.chromium.launch()
 for visitor in VISITORS:
  for period,fixed in PERIODS.items():
   print(f'start {visitor} {period}',flush=True)
   video=visitor=='bun-light' and period=='day'
   context=browser.new_context(viewport={'width':393,'height':659},timezone_id='Asia/Bangkok',record_video_dir=str(OUT/'video') if video else None,record_video_size={'width':393,'height':659} if video else None)
   context.route('**/api/**',lambda route:route.fulfill(status=200,content_type='application/json',body='{}'))
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.clock.set_fixed_time(fixed)
   page.add_init_script("localStorage.setItem('ct-muted','true');localStorage.setItem('ct-morning-seen','true');localStorage.setItem('ct-analytics','no')")
   page.goto(BASE,wait_until='domcontentloaded',timeout=12000);print(' dom ready',flush=True);time.sleep(.5);print({'busy':page.locator('#app').get_attribute('aria-busy'),'errors':errors},flush=True);ready(page);page.evaluate("document.querySelector('#ga-choice').hidden=true");time.sleep(.15)
   if page.locator('#ga-choice:not([hidden])').count():page.locator('#ga-choice button').nth(1).click()
   print(' entry ready',flush=True)
   page.evaluate("id=>localStorage.setItem('ct-visitor',JSON.stringify(id))",visitor);page.reload();ready(page)
   release=page.evaluate("()=>fetch('/release.json').then(r=>r.json()).then(x=>x.release)")
   page.evaluate("async r=>{const m=await import('/incense.'+r+'.js');Object.assign(m.incenseConfig,{startDelay:120,walkMs:520,lightMs:500,igniteAt:160,vaiCycleMs:420,vaiStrikeAt:150,plantMs:500,plantAt:180,autoGap:100,burnMs:60000,earlyMs:700,standMinMs:150})}",release)
   page.locator('[data-action=enter]').click();page.wait_for_function("document.body.dataset.view==='choose'");ready(page);print(' choose ready',flush=True)
   page.locator('[data-action=continue]').click();page.wait_for_function("document.body.dataset.view==='home'");ready(page);print(' home ready',flush=True)
   page.evaluate("document.querySelector('[data-action=incense]').click()");page.wait_for_function("document.body.dataset.view==='incense'",timeout=12000);ready(page);page.evaluate("document.querySelector('#ga-choice').style.display='none'");print(' incense ready',flush=True)
   time.sleep(.19);shot(page,visitor,period,'walk-1');time.sleep(.25);shot(page,visitor,period,'walk-2')
   page.locator('[data-action=light]').wait_for(state='visible');page.wait_for_function("!document.querySelector('[data-action=light]').disabled");shot(page,visitor,period,'hold')
   page.evaluate("document.querySelector('[data-action=light]').click()");time.sleep(.23);shot(page,visitor,period,'light')
   page.wait_for_function("!document.querySelector('[data-action=light]').disabled");page.evaluate("document.querySelector('[data-action=light]').click()");time.sleep(.07);shot(page,visitor,period,'vai-1');time.sleep(.14);shot(page,visitor,period,'vai-2')
   page.wait_for_function("!document.querySelector('[data-action=light]').disabled");page.evaluate("document.querySelector('[data-action=light]').click()");time.sleep(.23);shot(page,visitor,period,'plant-1')
   time.sleep(.34);shot(page,visitor,period,'end');page.wait_for_function("!document.querySelector('[data-action=light]').disabled")
   if errors:raise AssertionError(errors)
   assert page.locator('canvas').get_attribute('data-cushion-policy')=='hidden'
   context.close()
 browser.close()

(OUT/'results.json').write_text(json.dumps({'passed':True,'shots':len(results),'results':results},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'shots':len(results),'output':str(OUT)},ensure_ascii=False))
