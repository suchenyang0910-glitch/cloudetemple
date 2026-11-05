from pathlib import Path
import json,statistics
from playwright.sync_api import sync_playwright
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True);p=b.new_page(viewport={'width':375,'height':667});p.add_init_script("localStorage.setItem('ct-muted','true')");p.goto('http://127.0.0.1:8821')
 def ready():p.wait_for_function("document.querySelector('#app').getAttribute('aria-busy')==='false'")
 ready()
 for a in ['enter','continue','beads']:p.locator(f'[data-action={a}]').click();ready()
 p.wait_for_timeout(500);p.evaluate("window.samples=[];window.sampling=true;let last=performance.now();function record(t){if(!sampling)return;samples.push(t-last);last=t;requestAnimationFrame(record)}requestAnimationFrame(record)")
 box=p.locator('#bead-control').bounding_box()
 for j in range(4):
  p.mouse.move(90,box['y']+30);p.mouse.down()
  for i in range(1,41):p.mouse.move(90,box['y']+30+i*5);p.wait_for_timeout(16)
  p.mouse.up();p.wait_for_timeout(200)
 samples=p.evaluate('sampling=false;samples');samples=sorted(x for x in samples if x>0);result={'engine':'Isolated desktop headless Chromium, 375x667, not physical iPhone SE','frames':len(samples),'medianMs':round(statistics.median(samples),2),'p95Ms':round(samples[int(len(samples)*.95)],2)};b.close()
Path('screenshots/round3/frame-se.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
