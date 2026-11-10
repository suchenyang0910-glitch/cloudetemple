from datetime import datetime, timezone
from pathlib import Path
import json, os
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

BASE=os.environ.get('CT_TEST_BASE','http://127.0.0.1:8828')
OUT=Path('screenshots/beads-inset-staging');OUT.mkdir(parents=True,exist_ok=True)
SIZES=[(375,548),(390,844),(393,659),(430,932)]
VISITORS=['short-light','curly-dark','curly-medium','bun-light','bun-dark','ponytail-medium']

def alpha_right(visitor):
 im=Image.open(Path('assets/processed-v1/img')/f'visitor-{visitor}-beads-side-1-v1.webp').convert('RGBA')
 return im.getchannel('A').point(lambda x:255 if x>40 else 0).getbbox()[2]

def ready(page):
 page.wait_for_function("document.querySelector('#app').getAttribute('aria-busy')==='false'")
 page.wait_for_timeout(350)

def open_beads(page,visitor):
 page.add_init_script(f"localStorage.setItem('ct-muted','true');localStorage.setItem('ct-bead-guide','true');localStorage.setItem('ct-morning-seen','true');localStorage.setItem('ct-visitor',JSON.stringify('{visitor}'));" )
 page.goto(BASE);ready(page)
 for action in ['enter','continue','beads']:
  page.locator(f'[data-action="{action}"]:visible').first.click();ready(page)

def metrics(page,visitor):
 return page.evaluate("""right=>{const bead=[...document.querySelectorAll('.strand-bead')].find(e=>e.dataset.number==='1'),visible=[...document.querySelectorAll('.strand-bead')].filter(e=>+getComputedStyle(e).opacity>.05).map(e=>e.getBoundingClientRect()),thumb=document.querySelector('.thumb-point').getBoundingClientRect(),arrows=document.querySelector('.bead-chevrons').getBoundingClientRect(),canvas=document.querySelector('#scene').getBoundingClientRect();const personRight=canvas.left+(350+right/600*397)/941*canvas.width;return {bead:bead.getBoundingClientRect().toJSON(),thumb:thumb.toJSON(),arrows:arrows.toJSON(),visible:visible.map(r=>r.toJSON()),personRight,innerWidth,scroll:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight};}""",alpha_right(visitor))

rows=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch()
 for width,height in SIZES:
  context=browser.new_context(viewport={'width':width,'height':height},timezone_id='UTC')
  page=context.new_page();page.clock.set_fixed_time(datetime(2026,11,10,10,tzinfo=timezone.utc));open_beads(page,'short-light')
  m=metrics(page,'short-light');gap=width-m['bead']['right'];person_gap=m['bead']['left']-m['personRight'];last=max(r['bottom'] for r in m['visible'])
  assert 28<=gap<=32,(width,height,gap)
  assert person_gap>=20,(width,height,person_gap)
  assert m['thumb']['left']>=0 and m['thumb']['right']<=width,(width,height,m['thumb'])
  assert m['arrows']['top']>=last,(width,height,m['arrows']['top'],last)
  assert not m['scroll'],(width,height,'scroll')
  page.screenshot(path=str(OUT/f'{width}x{height}-day.png'))
  rows.append({'size':[width,height],'outerGap':round(gap,2),'personGap':round(person_gap,2),'ring':[round(m['thumb']['left'],2),round(m['thumb']['right'],2)],'arrowGap':round(m['arrows']['top']-last,2)})
  context.close()

 # Fixed-order six-person day/night review at the real Safari viewport.
 tiles=[]
 for hour,period in [(10,'day'),(21,'night')]:
  for visitor in VISITORS:
   context=browser.new_context(viewport={'width':393,'height':659},timezone_id='UTC')
   page=context.new_page();page.clock.set_fixed_time(datetime(2026,11,10,hour,tzinfo=timezone.utc));open_beads(page,visitor)
   m=metrics(page,visitor);assert m['bead']['left']-m['personRight']>=20,(visitor,period,m)
   target=OUT/f'{visitor}-{period}.png';page.screenshot(path=str(target));tiles.append(target);context.close()

 # Rounded-screen proof: clip the independent browser capture, not the app DOM.
 context=browser.new_context(viewport={'width':393,'height':852},timezone_id='UTC')
 page=context.new_page();page.clock.set_fixed_time(datetime(2026,11,10,10,tzinfo=timezone.utc));open_beads(page,'bun-light')
 rounded=OUT/'393x852-iphone-rounded-source.png';page.screenshot(path=str(rounded));context.close();browser.close()

images=[Image.open(p).convert('RGB') for p in tiles];sheet=Image.new('RGB',(393*6,659*2),'white')
for i,im in enumerate(images):sheet.paste(im,((i%6)*393,(i//6)*659))
sheet.save(OUT/'total-beads-fixed-order-6x-day-night.jpg',quality=88)
im=Image.open(rounded).convert('RGBA');mask=Image.new('L',im.size,0);ImageDraw.Draw(mask).rounded_rectangle((0,0,im.width-1,im.height-1),radius=44,fill=255);im.putalpha(mask);im.save(OUT/'393x852-iphone-rounded.png');rounded.unlink()
(OUT/'checks.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'sizes':rows,'reviewImages':len(tiles)},ensure_ascii=False))
