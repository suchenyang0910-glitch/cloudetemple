from pathlib import Path
from datetime import datetime,timezone
import json,os
from playwright.sync_api import sync_playwright
out=Path('screenshots/round3/review2');out.mkdir(parents=True,exist_ok=True)
base=os.environ.get('REVIEW_URL','http://127.0.0.1:8828');rows=[];errors=[]
layout=json.loads(Path('assets/processed-v1/layout-v1.json').read_text(encoding='utf-8'))
with sync_playwright() as pw:
 for engine in ['chromium','webkit']:
  b=getattr(pw,engine).launch()
  for w,h in [(375,548),(393,659),(375,667),(393,852)]:
   c=b.new_context(viewport={'width':w,'height':h},timezone_id='UTC');p=c.new_page();requests=[]
   p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:requests.append(r.url));p.add_init_script("localStorage.setItem('ct-muted','true');localStorage.setItem('ct-visitor','\"bun-light\"')")
   p.clock.set_fixed_time(datetime(2026,11,5,10,tzinfo=timezone.utc))
   def ready():p.wait_for_function("document.querySelector('#app').getAttribute('aria-busy')==='false'");p.wait_for_timeout(230)
   def click(a):p.locator(f'[data-action={a}]').click();ready()
   p.goto(base);ready();click('enter');click('continue')
   for hour,period in [(6,'dawn'),(10,'day'),(18,'dusk'),(21,'night')]:
    p.clock.set_fixed_time(datetime(2026,11,5,hour,tzinfo=timezone.utc));p.wait_for_timeout(450)
    for v in ['home','incense','bow','sit','mo','beads','leave']:
     if v!='home':click(v)
     assert not p.evaluate('document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth'),(engine,w,h,v)
     assert p.locator('#controls').evaluate('(e)=>[...e.querySelectorAll("button")].filter(b=>b.offsetWidth).every(b=>{const r=b.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+.5&&r.left>=0&&r.right<=innerWidth+.5})'),(engine,w,h,v)
     if v=='mo':
      m=p.evaluate('''a=>{const s=document.querySelector('#scene').getBoundingClientRect(),w=document.querySelector('#wood-prop').getBoundingClientRect(),panel=document.querySelector('#controls').getBoundingClientRect(),heading=document.querySelector('.scene-heading').getBoundingClientRect(),k=s.width/941;return {woodTop:w.top,woodBottom:w.bottom,woodWidth:w.width,altarBottom:s.y+a.altar[3]*k,haloTop:s.y+a.halo[1]*k,headingBottom:heading.bottom,panelTop:panel.top}}''',layout['hall-front']['protected'])
      assert m['woodTop']>=m['altarBottom'] and m['panelTop']-m['woodBottom']>=15.9 and m['woodWidth']>=w*.28-.1 and m['haloTop']>=m['headingBottom'],(engine,w,h,m)
      rows.append(dict(engine=engine,w=w,h=h,period=period,mo=m))
     if v=='beads':
      for hand in ['right','left']:
       if p.evaluate('document.body.dataset.hand')!=hand:click('bead-hand')
       m=p.evaluate('''()=>{const beads=[...document.querySelectorAll('.strand-bead')].filter(e=>+getComputedStyle(e).opacity>0).map(e=>e.getBoundingClientRect()),t=document.querySelector('.thumb-point').getBoundingClientRect();return {visible:beads.length,complete:beads.every(r=>r.left>=10&&r.right<=innerWidth-10),thumbPercent:(t.y+t.height/2)/innerHeight*100,haloFilter:getComputedStyle(document.querySelector('.beads-area')).filter}}''')
       assert m['complete'] and m['visible']>=4 and 63<=m['thumbPercent']<=66 and m['haloFilter']=='none',(engine,w,h,hand,m)
       rows.append(dict(engine=engine,w=w,h=h,period=period,hand=hand,beads=m))
       if engine=='chromium' and h in [548,659]:p.screenshot(path=str(out/'after'/f'{w}x{h}-beads-{period}-{hand}.png'))
     if v=='leave':click('reenter');click('enter');click('continue')
     elif v!='home':click('home')
   p.goto(base+'/?debug=audio');ready();assert not p.locator('#audio-debug').evaluate('(e)=>e.open');p.locator('#audio-debug summary').click();p.wait_for_timeout(200)
   assert p.locator('#audio-debug').bounding_box()['y']+p.locator('#audio-debug').bounding_box()['height']<=p.locator('#controls').bounding_box()['y']
   click('enter');assert p.evaluate('document.body.dataset.view')=='choose';p.locator('#audio-debug summary').click();click('continue')
   assert not any('fonts.googleapis.com' in u or 'fonts.gstatic.com' in u for u in requests)
   assert p.evaluate('''async()=>{for(const w of [400,500,600])await document.fonts.load(w+' 16px "Be Vietnam Pro"','Chùa Mây bình yên Việt Nam');return [...document.fonts].filter(f=>f.family.includes('Be Vietnam Pro')).every(f=>f.status==='loaded')}''')
   c.close()
  b.close()
 # Monotonic timer: wall clock edits cannot extend it; long elapsed time completes safely.
 b=pw.chromium.launch();p=b.new_page(viewport={'width':375,'height':548});p.add_init_script("localStorage.setItem('ct-muted','true')");p.clock.install(time=datetime(2026,11,5,10,tzinfo=timezone.utc));p.goto(base);ready();click('enter');click('continue');click('incense');click('light')
 p.clock.run_for(1000)
 for offset in [-10**12,10**12]:
  p.evaluate('(n)=>{Date.now=()=>n}',offset);p.clock.run_for(500)
  m=p.evaluate("()=>({text:document.querySelector('#incense-status').textContent,scale:+document.querySelector('#incense-progress').style.transform.match(/[\\d.]+/)[0]})")
  assert 0<=m['scale']<=1 and len(m['text'])<100,m
 p.clock.fast_forward(3600000);assert p.locator('[data-action=share]').is_visible();p.screenshot(path=str(out/'after'/'375x548-incense-clock-jump.png'));b.close()
assert not errors,errors
(out/'checks.json').write_text(json.dumps({'cases':rows,'errors':errors,'fontRequests':'same origin, six loaded faces','debug':'collapsed and expanded enter works in both engines','incense':'wall clock +/- 1e12 and one-hour monotonic jump bounded'},indent=2),encoding='utf-8');print(json.dumps({'layoutCases':len(rows),'errors':errors}))
