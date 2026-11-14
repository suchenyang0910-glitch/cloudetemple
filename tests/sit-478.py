from pathlib import Path
import json, os, time
from playwright.sync_api import sync_playwright

BASE=os.environ.get('CT_TEST_BASE','http://127.0.0.1:8834')
OUT=Path(os.environ.get('CT_TEST_OUT','E:/cloudtemple/ops/receipts/P111'));OUT.mkdir(parents=True,exist_ok=True)

def ready(page):
 page.wait_for_function("document.querySelector('#app').getAttribute('aria-busy')==='false'")
 page.wait_for_timeout(300)

def open_sit(page,seen=False):
 page.add_init_script(f"""localStorage.setItem('ct-muted','true');localStorage.setItem('ct-morning-seen','true');localStorage.setItem('ct-visitor',JSON.stringify('short-light'));localStorage.setItem('ct-breath-guide','false');localStorage.setItem('ct-breath-pattern',JSON.stringify('4-6'));{'localStorage.setItem(\'ct-breath-478-tutorial-seen\',\'true\');' if seen else 'localStorage.removeItem(\'ct-breath-478-tutorial-seen\');'}""")
 page.goto(BASE);ready(page)
 for action in ['enter','continue','sit']:
  page.locator(f'[data-action="{action}"]:visible').first.click();ready(page)

def assert_layout(page):
 result=page.evaluate("""()=>({scroll:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,buttons:[...document.querySelectorAll('#controls button')].filter(e=>e.offsetParent).map(e=>{const r=e.getBoundingClientRect();return [r.width,r.height]})})""")
 assert not result['scroll'],result
 assert all(w>=44 and h>=44 for w,h in result['buttons']),result

def open_478(page):
 page.locator('[data-action="sit-options"]').click()
 page.locator('[data-action="breath-toggle"]').click()
 page.locator('[data-breath="4-7-8"]').click()
 page.locator('.sit-tutorial').wait_for()

with sync_playwright() as pw:
 browser=pw.chromium.launch()
 # Pure timing boundaries for all four patterns.
 page=browser.new_page();page.goto(BASE);ready(page)
 timing=page.evaluate("""async()=>{const {breathFrame}=await import('./app.js');const cases={'4-6':[[0,'inhale'],[3999,'inhale'],[4000,'exhale'],[9999,'exhale']], '4-4':[[0,'inhale'],[3999,'inhale'],[4000,'exhale'],[7999,'exhale']], '5-7':[[0,'inhale'],[4999,'inhale'],[5000,'exhale'],[11999,'exhale']], '4-7-8':[[0,'inhale'],[3999,'inhale'],[4000,'hold'],[10999,'hold'],[11000,'exhale'],[18999,'exhale'],[19000,'inhale']]};return Object.fromEntries(Object.entries(cases).map(([pace,checks])=>[pace,checks.map(([at,want])=>({at,want,got:breathFrame(at,0,pace).phase}))]));}""")
 assert all(x['want']==x['got'] for checks in timing.values() for x in checks),timing
 page.close()

 # First-use tutorial, clear close controls, English copy, and compact widths.
 for width,height in [(360,640),(393,852)]:
  context=browser.new_context(viewport={'width':width,'height':height})
  page=context.new_page();open_sit(page);open_478(page);assert_layout(page)
  page.screenshot(path=str(OUT/f'tutorial-{width}x{height}-vi.png'))
  page.locator('[data-action="sit-tutorial-done"]').click();page.locator('.sit-options').wait_for();assert_layout(page)
  page.screenshot(path=str(OUT/f'settings-{width}x{height}-vi.png'))
  page.keyboard.press('Escape');page.wait_for_timeout(50);assert not page.locator('.sit-options').count();assert page.locator('[data-action="sit-options"]').evaluate('e=>e===document.activeElement')
  page.locator('[data-action="sit-options"]').click();page.locator('.stage').click(position={'x':20,'y':250});assert not page.locator('.sit-options').count()
  page.locator('[data-action="sit-options"]').click();page.locator('[data-action="sit-options-done"]').click();page.wait_for_timeout(50);assert page.locator('[data-action="sit-options"]').evaluate('e=>e===document.activeElement')
  context.close()

 context=browser.new_context(viewport={'width':393,'height':852})
 page=context.new_page();open_sit(page,True);page.locator('#language').evaluate("e=>{e.value='en';e.dispatchEvent(new Event('change',{bubbles:true}))}");page.locator('[data-action="sit-options"]').click();page.locator('[data-breath="4-7-8"]').click();page.locator('[data-action="sit-tutorial"]').click();page.screenshot(path=str(OUT/'tutorial-393x852-en.png'));context.close()

 context=browser.new_context(viewport={'width':393,'height':852},reduced_motion='reduce')
 page=context.new_page();open_sit(page,True);page.locator('[data-action="sit-options"]').click();page.locator('[data-action="breath-toggle"]').click();page.locator('[data-breath="4-7-8"]').click();page.locator('[data-action="sit-options-done"]').click();page.locator('[data-action="sit-start"]').click();assert page.locator('.breath-triangle-dot').evaluate("e=>getComputedStyle(e).display==='none'");context.close()

 # Neighboring activities and the family shell still open after the shared render changes.
 context=browser.new_context(viewport={'width':393,'height':852})
 page=context.new_page();open_sit(page,True);page.locator('[data-action="home"]').click()
 for action,probe in [('incense','#incense-status'),('bow','[data-action="bow-once"]'),('beads','#bead-control'),('mo','#wood-prop')]:
  page.locator(f'[data-action="{action}"]').click();page.locator(probe).wait_for();
  if action=='bow':page.locator('[data-action="bow-once"]').click()
  elif action=='beads':page.locator('#bead-control').click()
  elif action=='mo':page.locator('#wood-prop').click(position={'x':10,'y':10})
  page.locator('[data-action="home"]:visible').first.click()
 page.goto(BASE+'/family.html');page.wait_for_load_state('domcontentloaded');assert page.locator('body').count()==1
 context.close()

 # A real 19-second guide cycle at both required compact widths.
 phases={}
 for width,height in [(360,640),(406,695)]:
  context=browser.new_context(viewport={'width':width,'height':height})
  page=context.new_page();open_sit(page,True)
  page.locator('[data-action="sit-options"]').click();page.locator('[data-action="breath-toggle"]').click();page.locator('[data-breath="4-7-8"]').click();page.locator('[data-action="sit-options-done"]').click();page.locator('[data-action="sit-start"]').click()
  started=time.monotonic();observed=[]
  for phase,wait in [('inhale',0),('hold',4.1),('exhale',7.1)]:
   if wait:page.wait_for_timeout(int(wait*1000))
   page.wait_for_function(f"document.querySelector('.breath-triangle-guide')?.dataset.phase==='{phase}'")
   data=page.evaluate("""()=>{const g=document.querySelector('.breath-triangle-guide'),r=g.getBoundingClientRect(),h=document.querySelector('.scene-heading').getBoundingClientRect(),c=document.querySelector('.controls').getBoundingClientRect(),dot=g.querySelector('.breath-triangle-dot'),active=getComputedStyle(g.querySelector('.breath-edge-'+g.dataset.phase));return {phase:g.dataset.phase,text:g.querySelector('.breath-triangle-copy').innerText,stageNote:document.querySelector('#stage-note').textContent,box:r.toJSON(),heading:h.toJSON(),controls:c.toJSON(),dot:dot.getBoundingClientRect().toJSON(),activeWidth:active.strokeWidth,scroll:document.documentElement.scrollHeight>innerHeight};}""")
   assert data['phase']==phase and not data['stageNote'] and not data['scroll'],data
   assert data['box']['top']>=data['heading']['bottom'] and data['box']['bottom']<=data['controls']['top'],data
   observed.append({'phase':phase,'elapsed':round(time.monotonic()-started,2),'text':data['text']})
   page.screenshot(path=str(OUT/f'guide-{width}x{height}-{phase}.png'))
  page.wait_for_timeout(8_100);page.wait_for_function("document.querySelector('.breath-triangle-guide')?.dataset.phase==='inhale'")
  observed.append({'phase':'inhale-next','elapsed':round(time.monotonic()-started,2)})
  phases[f'{width}x{height}']=observed;context.close()
 browser.close()

(OUT/'sit-478-checks.json').write_text(json.dumps({'passed':True,'boundaries':timing,'phases':phases},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'screenshots':11,'phases':phases},ensure_ascii=False))
