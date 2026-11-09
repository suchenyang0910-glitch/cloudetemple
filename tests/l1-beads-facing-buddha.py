from datetime import datetime, timezone
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright

BASE=os.environ.get('CT_TEST_BASE','http://127.0.0.1:8828')
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'screenshots/l1-beads-facing-buddha'
OUT.mkdir(parents=True,exist_ok=True)
VISITORS=['short-light','curly-dark','curly-medium','bun-light','bun-dark','ponytail-medium']
PROTECTED=[[0,360,285,850],[225,560,350,975],[0,840,440,1295],[703,840,941,1270]]
results=[]

def overlap(a,b):
 return max(0,min(a[2],b[2])-max(a[0],b[0]))*max(0,min(a[3],b[3])-max(a[1],b[1]))

with sync_playwright() as pw:
 browser=pw.chromium.launch()
 context=browser.new_context(viewport={'width':393,'height':659},timezone_id='UTC',record_video_dir=str(OUT/'raw'),record_video_size={'width':393,'height':659})
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("localStorage.setItem('ct-muted','true');localStorage.setItem('ct-bead-guide','true');localStorage.setItem('ct-morning-seen','true')")
 page.clock.set_fixed_time(datetime(2026,11,5,10,tzinfo=timezone.utc))

 def ready():
  page.wait_for_function("document.querySelector('#app').getAttribute('aria-busy')==='false'")
  page.wait_for_timeout(350)
 def click(action):
  page.locator(f'[data-action="{action}"]:visible').first.click();ready()
 def open_view(visitor,view):
  page.goto(BASE);ready();page.evaluate("id=>localStorage.setItem('ct-visitor',JSON.stringify(id))",visitor);page.reload();ready();click('enter');click('continue');click(view)

 for visitor in VISITORS:
  open_view(visitor,'beads')
  assert page.locator('body').get_attribute('data-view')=='beads'
  assert page.locator('#scene').get_attribute('data-pose')=='beads-side-1-v1'
  metrics=page.evaluate("""async id=>{const app=await import('./app.js'),layout=await (await fetch('./assets/processed-v1/layout-v1.json')).json();
   const a=app.placement(layout,id,'beads-side-1-v1'),b=app.placement(layout,id,'mo-1-v1'),stage=document.querySelector('.stage').getBoundingClientRect(),controls=document.querySelector('#controls').getBoundingClientRect(),heading=document.querySelector('.scene-heading').getBoundingClientRect(),scale=parseFloat(getComputedStyle(document.querySelector('.stage')).getPropertyValue('--scene-width'))/941,top=parseFloat(getComputedStyle(document.querySelector('.stage')).getPropertyValue('--scene-top')),left=(stage.width-941*scale)/2;
   const beads=[...document.querySelectorAll('.strand-bead')].filter(e=>+getComputedStyle(e).opacity>.05).map(e=>{const r=e.getBoundingClientRect();return [(r.left-stage.left-left)/scale,(r.top-stage.top-top)/scale,(r.right-stage.left-left)/scale,(r.bottom-stage.top-top)/scale]});
   const thumb=document.querySelector('.thumb-point').getBoundingClientRect(),touch=getComputedStyle(document.querySelector('.bead-control')).clipPath;
   return {placementDelta:[a.x-b.x,a.y-b.y,a.w-b.w,a.h-b.h],beads,thumb:[thumb.x+thumb.width/2,thumb.y+thumb.height/2],touch,controlsTop:controls.top,headingBottom:heading.bottom,scroll:document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth};} """,visitor)
  assert max(abs(x) for x in metrics['placementDelta'])<1e-8,(visitor,metrics['placementDelta'])
  assert not metrics['scroll']
  assert metrics['beads'] and all(all(overlap(r,p)==0 for p in PROTECTED) for r in metrics['beads']),(visitor,metrics['beads'])
  page.screenshot(path=str(OUT/f'{visitor}-f1.png'))
  page.locator('#bead-control').press('Enter');page.wait_for_function("document.querySelector('#scene').dataset.pose==='beads-side-2-v1'")
  page.screenshot(path=str(OUT/f'{visitor}-f2.png'));page.wait_for_function("document.querySelector('#scene').dataset.pose==='beads-side-3-v1'")
  page.screenshot(path=str(OUT/f'{visitor}-f3.png'));page.wait_for_function("document.querySelector('#scene').dataset.pose==='beads-side-1-v1'")
  page.locator('#bead-control').press('Enter');page.wait_for_timeout(220)
  assert page.locator('#bead-count').inner_text().startswith('2 /')
  assert page.locator('#bead-status').text_content().startswith('0 /'),'screen reader count is throttled before 9'
  for _ in range(7): page.locator('#bead-control').press('Enter');page.wait_for_timeout(100)
  assert page.locator('#bead-status').text_content().startswith('9 /')
  results.append({'visitor':visitor,'placementDelta':metrics['placementDelta'],'visibleBeads':len(metrics['beads']),'touch':metrics['touch'],'frames':'1-2-3-1','srAnnouncements':'0 then 9'})

 # Representative woodfish/beads comparison, plus both hand layouts.
 open_view('bun-light','mo');page.screenshot(path=str(OUT/'compare-bun-light-mo.png'))
 click('home');click('beads');page.screenshot(path=str(OUT/'compare-bun-light-beads.png'))
 right=page.evaluate("()=>document.querySelector('.thumb-point').getBoundingClientRect().x+document.querySelector('.thumb-point').getBoundingClientRect().width/2")
 click('bead-hand');left=page.evaluate("()=>document.querySelector('.thumb-point').getBoundingClientRect().x+document.querySelector('.thumb-point').getBoundingClientRect().width/2")
 assert abs(right/393-.549)<.01 and abs(left/393-.654)<.01,(right,left)
 page.screenshot(path=str(OUT/'beads-left-hand.png'))
 # Rapid steps hold F2 until the hand stops; reduced motion never shows F3.
 click('home');click('beads');page.evaluate("window.beadPoses=[];new MutationObserver(()=>beadPoses.push(document.querySelector('#scene').dataset.pose)).observe(document.querySelector('#scene'),{attributes:true,attributeFilter:['data-pose']})")
 for n in range(3):
  page.locator('#bead-control').press('Enter')
  if n<2: page.wait_for_timeout(50)
 page.evaluate('beadPoses.length=0')
 page.wait_for_timeout(120);assert page.locator('#scene').get_attribute('data-pose')=='beads-side-2-v1' and 'beads-side-3-v1' not in page.evaluate('beadPoses')
 page.wait_for_timeout(50);assert page.locator('#scene').get_attribute('data-pose')=='beads-side-3-v1'
 page.wait_for_timeout(120);assert page.locator('#scene').get_attribute('data-pose')=='beads-side-1-v1'
 page.emulate_media(reduced_motion='reduce');page.wait_for_timeout(50);page.evaluate('beadPoses.length=0');page.locator('#bead-control').press('Enter');page.wait_for_function("document.querySelector('#scene').dataset.pose==='beads-side-2-v1'",timeout=100)
 page.wait_for_timeout(150);assert page.locator('#scene').get_attribute('data-pose')=='beads-side-1-v1' and 'beads-side-3-v1' not in page.evaluate('beadPoses')
 video=page.video;context.close();video.save_as(str(OUT/'six-visitors-actions-393x659.webm'));browser.close()
 assert not errors,errors

(OUT/'checks.json').write_text(json.dumps({'base':BASE,'viewport':[393,659],'visitors':results,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'visitors':len(results),'screenshots':len(list(OUT.glob('*.png'))),'video':'six-visitors-actions-393x659.webm'}))
