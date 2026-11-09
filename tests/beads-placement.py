from datetime import datetime, timezone
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright

BASE=os.environ.get('CT_TEST_BASE','http://127.0.0.1:8828')
OUT=Path('screenshots/l1-beads-facing-buddha/placement');OUT.mkdir(parents=True,exist_ok=True)
SIZES=[(360,640),(375,667),(390,844),(393,852),(430,932)]
VISITORS=['short-light','curly-dark','curly-medium','bun-light','bun-dark','ponytail-medium']
PROTECTED=[[0,360,285,850],[225,560,350,975],[0,840,440,1295],[703,840,941,1270]]
rows=[]

def overlap(a,b):
 return max(0,min(a[2],b[2])-max(a[0],b[0]))*max(0,min(a[3],b[3])-max(a[1],b[1]))

with sync_playwright() as pw:
 browser=pw.chromium.launch()
 for width,height in SIZES:
  context=browser.new_context(viewport={'width':width,'height':height},timezone_id='UTC')
  page=context.new_page();page.add_init_script("localStorage.setItem('ct-muted','true');localStorage.setItem('ct-bead-guide','true');localStorage.setItem('ct-morning-seen','true')")
  page.clock.set_fixed_time(datetime(2026,11,5,10,tzinfo=timezone.utc))
  def ready(): page.wait_for_function("document.querySelector('#app').getAttribute('aria-busy')==='false'");page.wait_for_timeout(300)
  def click(action): page.locator(f'[data-action="{action}"]:visible').first.click();ready()
  for visitor in VISITORS:
   page.goto(BASE);ready();page.evaluate("id=>localStorage.setItem('ct-visitor',JSON.stringify(id))",visitor);page.reload();ready();click('enter');click('continue');click('beads')
   for hand in ['right','left']:
    if page.locator('body').get_attribute('data-hand')!=hand: click('bead-hand')
    m=page.evaluate("""()=>{const stage=document.querySelector('.stage').getBoundingClientRect(),controls=document.querySelector('#controls').getBoundingClientRect(),heading=document.querySelector('.scene-heading').getBoundingClientRect(),scale=parseFloat(getComputedStyle(document.querySelector('.stage')).getPropertyValue('--scene-width'))/941,top=parseFloat(getComputedStyle(document.querySelector('.stage')).getPropertyValue('--scene-top')),left=(stage.width-941*scale)/2;
     const beads=[...document.querySelectorAll('.strand-bead')].filter(e=>+getComputedStyle(e).opacity>.05).map(e=>{const r=e.getBoundingClientRect();return [(r.left-stage.left-left)/scale,(r.top-stage.top-top)/scale,(r.right-stage.left-left)/scale,(r.bottom-stage.top-top)/scale]});
     const thumb=document.querySelector('.thumb-point').getBoundingClientRect(),area=getComputedStyle(document.querySelector('.beads-area'));
     return {beads,thumbX:thumb.x+thumb.width/2,thumbY:thumb.y+thumb.height/2,touchTop:parseFloat(area.getPropertyValue('--bead-touch-top')),headingBottom:heading.bottom-stage.top,controlsTop:controls.top,scroll:document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth};}""")
    assert m['beads'] and all(all(overlap(r,p)==0 for p in PROTECTED) for r in m['beads']),(width,height,visitor,hand,m)
    target=.549 if hand=='right' else .654
    assert abs(m['thumbX']/width-target)<.01 and m['touchTop']>=m['headingBottom'] and not m['scroll'],(width,height,visitor,hand,m)
    rows.append({'size':[width,height],'visitor':visitor,'hand':hand,'visibleBeads':len(m['beads']),'thumbXRatio':m['thumbX']/width})
   if visitor=='bun-light' and width in [375,393]: page.screenshot(path=str(OUT/f'{width}x{height}-day-left.png'))
  context.close()
 browser.close()

(OUT/'checks.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'cases':len(rows),'sizes':SIZES}))
