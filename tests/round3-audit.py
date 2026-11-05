from pathlib import Path
from datetime import datetime
import json,sys
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];phase=sys.argv[1] if len(sys.argv)>1 else 'before';port=sys.argv[2] if len(sys.argv)>2 else '8820';base=f'http://127.0.0.1:{port}'
out=root/'screenshots/round3'/phase;out.mkdir(parents=True,exist_ok=True);rows=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True)
 for width,height in [(393,852),(375,667)]:
  for period,hour in [('dawn',6),('day',10),('dusk',18),('night',22)]:
   ctx=b.new_context(viewport={'width':width,'height':height},timezone_id='Asia/Ho_Chi_Minh');p=ctx.new_page()
   p.add_init_script("localStorage.setItem('ct-muted','true');localStorage.setItem('ct-visitor',JSON.stringify('bun-light'))")
   p.clock.install(time=datetime.fromisoformat(f'2026-11-05T{hour:02}:00:00+07:00'))
   def click(action):p.locator(f'[data-action="{action}"]:visible').first.click()
   def shot(name,wait=True):
    if wait:
     p.wait_for_function("document.querySelector('#app')?.getAttribute('aria-busy')!=='true'");p.locator('#loading').wait_for(state='hidden');p.clock.run_for(500);p.evaluate("document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).forEach(a=>a.finish())")
    file=f'{width}-{period}-{name}.png';p.screenshot(path=str(out/file),scale='css')
    metrics=p.evaluate("""()=>({scroll:document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth,smallButtons:[...document.querySelectorAll('button')].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().height<47).map(e=>e.textContent.trim()||e.getAttribute('aria-label')),view:document.body.dataset.view})""")
    rows.append({'file':file,'state':name,'width':width,'period':period,**metrics})
   p.goto(base);p.locator('[data-action=enter]').wait_for();shot('entry');click('enter');shot('choose');click('change');shot('choose-changed');click('continue');shot('home')
   click('incense');shot('incense-ready');click('light');p.clock.fast_forward(20000);shot('incense-burning');p.clock.fast_forward(41000);shot('incense-done');click('home')
   click('bow');shot('bow-ready');click('bow-once');p.clock.run_for(1300);shot('bowing');p.clock.run_for(3000);click('auto');shot('bow-auto');p.clock.run_for(9000);shot('bow-done');click('home')
   click('sit');shot('sit-choice');p.locator('[data-minutes="1"]').click();click('sit-start');shot('sit-running');click('pause');shot('sit-paused');click('pause');p.clock.fast_forward(61000);shot('sit-done');click('home')
   click('mo');shot('mo-ready');click('wood');shot('mo-tapping');click('wood-auto');p.clock.run_for(2000);shot('mo-auto');click('wood-auto');p.evaluate("for(let i=0;i<108;i++)document.querySelector('#wood-prop').click()");shot('mo-108');click('home')
   click('beads');shot('beads-0');click('bead');p.clock.run_for(300);shot('beads-1')
   for target in ([27,107,108] if phase=='before' else [27,107,108,109]):
    current=int(p.locator('#bead-count' if p.locator('#bead-count').count() else '#bead-control').inner_text().split('/')[0].strip()) if p.locator('#bead-control').count() else target
    for i in range(current,target):
     p.locator('[data-action=bead]').evaluate('(e)=>e.click()');p.clock.run_for(200 if phase=='after' else 1)
    shot('beads-'+str(target) if target<(108 if phase=='before' else 109) else 'completed')
   click('share');p.locator('.share-preview').wait_for();p.locator('.share-preview').evaluate('(e)=>e.decode()');shot('share');p.locator('#close-modal').click();click('home');click('more');shot('more');p.locator('#memorial').click();shot('registration');p.locator('#waitlist-form button').click();shot('registration-invalid');p.locator('#close-modal').click();click('leave');shot('leave')
   for slug,name in [('gioi-thieu','about'),('quyen-rieng-tu','privacy'),('dieu-khoan','terms')]:
    p.goto(base+'/'+slug+'.html');shot(name,False)
   p.route('**/scene-vn-*.webp',lambda r:r.fulfill(status=503,body='audit failure'))
   p.goto(base);p.locator('[data-action=enter]').wait_for();shot('image-failure')
   p.unroute_all(behavior='wait')
   p.add_init_script("const nativeFetch=window.fetch;window.fetch=(u,o)=>String(u).includes('scene-vn-')?new Promise(r=>setTimeout(r,5000)).then(()=>nativeFetch(u,o)):nativeFetch(u,o)")
   p.goto(base,wait_until='domcontentloaded');p.clock.run_for(1000);shot('loading',False)
   p.clock.run_for(6000)
   ctx.close();print(f'{phase} {width} {period}: {len(rows)} screenshots',flush=True)
 b.close()
(out/'audit.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
