from pathlib import Path
from datetime import datetime,timezone
import json
from playwright.sync_api import sync_playwright
results=[]
with sync_playwright() as pw:
 for engine in ['chromium','webkit']:
  b=getattr(pw,engine).launch()
  for w,h in [(375,548),(393,659),(375,667),(393,852)]:
   p=b.new_page(viewport={'width':w,'height':h});p.add_init_script("localStorage.setItem('ct-muted','true')");p.goto('http://127.0.0.1:8828')
   for view in ['entry','choose']:
    p.wait_for_function("document.querySelector('#app').getAttribute('aria-busy')==='false'");p.wait_for_timeout(200)
    assert not p.evaluate('document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth')
    assert p.locator('#controls').evaluate('(e)=>[...e.querySelectorAll("button")].filter(b=>b.offsetWidth).every(b=>b.getBoundingClientRect().bottom<=innerHeight+.5)')
    if view=='entry':p.locator('[data-action=enter]').click()
   results.append({'engine':engine,'size':[w,h],'entryChoose':True});p.close()
  b.close()
 b=pw.chromium.launch();p=b.new_page(viewport={'width':375,'height':548});p.add_init_script("localStorage.setItem('ct-muted','true')");p.clock.install(time=datetime(2026,11,5,10,tzinfo=timezone.utc));p.goto('http://127.0.0.1:8828')
 for action in ['enter','continue','incense','light']:
  p.wait_for_function("document.querySelector('#app').getAttribute('aria-busy')==='false'");p.locator(f'[data-action={action}]').click()
 p.clock.fast_forward(59000);assert p.locator('#incense-status').is_visible();p.clock.fast_forward(1200);assert p.locator('[data-action=share]').is_visible()
 p.locator('[data-action=share]').click();p.wait_for_timeout(500);assert p.locator('.share-preview').is_visible();p.screenshot(path='screenshots/round3/review2/after/375x548-share.png');b.close()
Path('screenshots/round3/review2/flow-checks.json').write_text(json.dumps({'entryChoose':results,'normalIncense':'still burning at 59s; completes after 60s; share preview visible'},indent=2));print('entry/choose, 60s incense and share passed')
