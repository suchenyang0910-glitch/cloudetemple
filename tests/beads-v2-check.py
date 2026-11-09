from pathlib import Path
from datetime import datetime, timezone
import json, statistics
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1];out=root/'screenshots/round3/beads-v2';out.mkdir(exist_ok=True)
base='http://127.0.0.1:8824';checks=[];errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch()
 def setup(browser,width=393,height=852,**options):
  c=browser.new_context(timezone_id='UTC',viewport={'width':width,'height':height},**options);p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
  p.add_init_script("localStorage.setItem('ct-muted','true');localStorage.setItem('ct-morning-seen','true');localStorage.setItem('ct-visitor',JSON.stringify('bun-light'))")
  p.clock.set_fixed_time(datetime(2026,11,5,10,tzinfo=timezone.utc));p.goto(base);ready(p);return c,p
 def ready(p):p.wait_for_function("document.querySelector('#app').getAttribute('aria-busy')==='false'");p.wait_for_timeout(320)
 def click(p,a):p.locator(f'[data-action={a}]:visible').first.click();ready(p)
 def enter(p):click(p,'enter');click(p,'continue');click(p,'beads')
 def count(p):return int(p.locator('#bead-count').inner_text().split('/')[0])
 def drag(p,dx,dy,duration=600,x=310,y=230):
  p.mouse.move(x,y);p.mouse.down()
  for i in range(1,21):p.mouse.move(x+dx*i/20,y+dy*i/20);p.wait_for_timeout(duration/20)
  p.mouse.up();p.wait_for_timeout(220)
 c,p=setup(b,record_video_dir=str(out/'raw'),record_video_size={'width':393,'height':852});enter(p)
 p.evaluate("window.ft=[];window.sampling=true;let prev;function f(t){if(!sampling)return;if(prev)ft.push(t-prev);prev=t;requestAnimationFrame(f)}requestAnimationFrame(f)")
 p.evaluate("async()=>{const {audio}=await import('./app.js');window.cues=[];audio.strike=(...args)=>{cues.push(args);return true}}");p.screenshot(path=str(out/'right-0.png'));drag(p,0,190);assert count(p)==3
 before=count(p);drag(p,0,-150,y=400);drag(p,90,15,x=270);drag(p,0,190,x=389);assert count(p)==before
 drag(p,0,250,duration=500);assert count(p)==before+4
 p.wait_for_timeout(300);assert count(p)==before+4
 p.locator('#bead-control').click(position={'x':300,'y':350});assert count(p)==before+5
 while count(p)<27:p.locator('#bead-control').press('Enter');p.wait_for_timeout(100)
 p.screenshot(path=str(out/'right-27.png'));checks.append('slow / fast / reverse / horizontal / edge / tap / 27 passed')
 while count(p)<107:p.locator('#bead-control').press('Enter');p.wait_for_timeout(100)
 p.screenshot(path=str(out/'right-107.png'));p.locator('#bead-control').press('Enter');p.wait_for_timeout(220)
 assert p.locator('[data-action=bead-again]').is_visible();p.screenshot(path=str(out/'completed.png'))
 cues=p.evaluate('cues');assert len([x for x in cues if x[0]=='bead-v1'])==108;assert len([x for x in cues if x[0]=='keisu' and x[1]==.25])==3;assert len([x for x in cues if x[0]=='bell'])==1;checks.append('108 bead cues, 3 spacer cues, 1 completion bell; playback-call test only')
 click(p,'bead-again');assert count(p)==0 and 'Vòng 2' in p.locator('#heading').inner_text() and p.locator('.strand-bead.guru').count()==1;click(p,'bead-hand');p.screenshot(path=str(out/'left-round2.png'))
 assert p.evaluate("localStorage.getItem('ct-bead-hand')")=='"left"'
 p.evaluate('sampling=false');times=p.evaluate('ft');checks.append({'desktop393FrameMs':{'median':statistics.median(times),'p95':sorted(times)[int(len(times)*.95)]},'note':'desktop Chromium, not physical iPhone FPS'})
 video=p.video;c.close();video.save_as(str(out/'gestures-393.webm'));checks.append('guru arrives at 108 and completes; next round starts reversed at zero; left hand persists')
 for engine in [b,pw.webkit.launch()]:
  for w,h in [(375,548),(393,659),(375,667),(390,844),(393,852),(430,932)]:
   c,p=setup(engine,w,h)
   for view,action in [('entry',None),('choose','enter'),('home','continue'),('incense','incense'),('bow','bow'),('sit','sit'),('mo','mo'),('beads','beads')]:
    if action:click(p,action)
    m=p.evaluate("""()=>({scroll:document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('#controls button,.corner-button')].filter(e=>e.getClientRects().length).map(e=>({h:e.getBoundingClientRect().height,b:e.getBoundingClientRect().bottom,t:e.getBoundingClientRect().top,clip:e.id!=='bead-control'&&e.scrollWidth>e.clientWidth+2}))})""")
    assert not m['scroll'] and all(x['h']>=47.9 and x['b']<=h+.5 and x['t']>=0 and not x['clip'] for x in m['buttons']),(w,view,m)
    if view=='beads':
     assert p.locator('.strand-bead').count()==13
     if w in [375,393] and engine==b:
      for period,hour in [('dawn',6),('day',10),('dusk',17),('night',21)]:
       p.clock.set_fixed_time(datetime(2026,11,5,hour,tzinfo=timezone.utc));p.wait_for_function(f"document.body.dataset.period==='{period}'")
       p.screenshot(path=str(out/f'{w}x{h}-{period}-right.png'));click(p,'bead-hand');p.screenshot(path=str(out/f'{w}x{h}-{period}-left.png'));click(p,'bead-hand')
    if view not in ['entry','choose','home']:click(p,'home')
   checks.append({'engine':engine.browser_type.name,'size':[w,h],'eightPagesNoScrollButtons48':True});c.close()
  if engine!=b:engine.close()
 c,p=setup(b,reduced_motion='reduce');enter(p);drag(p,0,190);assert count(p)==1;c.close();checks.append('reduced motion drag counts once')
 c,p=setup(b,375,667);enter(p);p.evaluate("window.ft=[];window.sampling=true;let prev;function f(t){if(!sampling)return;if(prev)ft.push(t-prev);prev=t;requestAnimationFrame(f)}requestAnimationFrame(f)")
 for _ in range(3):drag(p,0,200,x=290)
 p.evaluate('sampling=false');times=p.evaluate('ft');checks.append({'desktopSEFrameMs':{'median':statistics.median(times),'p95':sorted(times)[int(len(times)*.95)]},'note':'375x667 desktop emulation, not physical SE'});c.close()
 # Real audio decoding and six diagnostic buttons, with no claim about physical loudness.
 c,p=setup(b);requests=[];p.on('request',lambda r:requests.append(r.url));p.goto(base+'/?debug=audio');ready(p);p.locator('#audio-debug summary').click()
 assert p.locator('#volume').input_value()=='80';assert not any('/audio/' in u for u in requests)
 for name in ['bell','keisu','mo','bead-v1','forest','rain']:
  p.locator(f'[data-audition="{name}"]').click();p.wait_for_timeout(800)
  key={'forest':'ambient-courtyard','rain':'ambient-rain'}.get(name,name)
  p.wait_for_function("async name=>(await import('./app.js')).audio.buffers.has(name)",arg=key)
 p.screenshot(path=str(out/'audio-six-tests.png'));p.locator('#audio-stop').click()
 diag=p.locator('#audio-debug textarea').input_value();assert all(f'{n}.mp3: HTTP=200' in diag for n in ['bell-v2','keisu-v2','mo','bead-v1','ambient-courtyard','ambient-rain']);assert 'bell-v2.mp3: HTTP=200' in diag and 'keisu-v2.mp3: HTTP=200' in diag and 'bead-v1.mp3: HTTP=200' in diag
 p.locator('#volume').evaluate("e=>{e.value=63;e.dispatchEvent(new Event('input',{bubbles:true}))}");p.reload();ready(p);assert p.locator('#volume').input_value()=='63'
 for invalid in ['"loud"','-1','101','null']:
  p.evaluate('(v)=>localStorage.setItem("ct-volume",v)',invalid);p.reload();ready(p);assert p.locator('#volume').input_value()=='80'
 p.locator('#audio-debug').evaluate('(e)=>e.open=true');p.locator('#audio-test').click();p.wait_for_timeout(1200);assert 'mo' in p.locator('#audio-debug textarea').input_value()
 p.locator('#audio-test').click();p.locator('#audio-stop').click();p.wait_for_timeout(700)
 assert p.evaluate("async()=>{const a=(await import('./app.js')).audio;return a.voices.size===0&&!a.background&&[...a.native.values()].every(e=>e.paused)}")
 p.locator('#audio-native-test').click();p.wait_for_timeout(500)
 p.evaluate("async()=>{const {audio}=await import('./app.js');audio.mute();window.mutedCheck={master:audio.master.gain.value,voices:audio.voices.size,played:audio.strike('bell')}}")
 assert p.evaluate('mutedCheck')=={'master':0,'voices':0,'played':False}
 checks.append({'sixAudioDecoded':True,'default80Saved63InvalidFallback80':True,'muteMaster0Voices0':True,'diagnostic':diag});c.close();b.close()
 assert not errors,errors
(out/'checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(checks,ensure_ascii=False))
