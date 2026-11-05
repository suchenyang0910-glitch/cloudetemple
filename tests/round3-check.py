from pathlib import Path
import json,time,statistics
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];out=root/'screenshots/round3';base='http://127.0.0.1:8821';checks=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True)
 c=b.new_context(viewport={'width':393,'height':852},record_video_dir=str(out/'video'),record_video_size={'width':393,'height':852})
 p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.add_init_script("localStorage.setItem('ct-muted','true');localStorage.setItem('ct-visitor',JSON.stringify('bun-light'))")
 def ready():p.wait_for_function("document.querySelector('#app').getAttribute('aria-busy')==='false'");p.wait_for_timeout(350)
 def click(a):p.locator(f'[data-action={a}]:visible').first.click();ready()
 p.goto(base);ready();click('enter')
 p.wait_for_function("[...document.querySelectorAll('.choice-image')].some(e=>e.complete&&e.naturalWidth&&+getComputedStyle(e).opacity>.9)")
 p.evaluate("""()=>{window.choiceFrames=[];window.choiceSample=true;const f=()=>{if(!choiceSample)return;choiceFrames.push([...document.querySelectorAll('.choice-image')].some(e=>e.complete&&e.naturalWidth&&+getComputedStyle(e).opacity>.1));requestAnimationFrame(f)};f();for(let i=0;i<10;i++)setTimeout(()=>document.querySelector('[data-action=change]').click(),i*20)}""")
 p.wait_for_timeout(1200);frames=p.evaluate('choiceSample=false;choiceFrames');assert all(frames);checks.append({'choice10ClicksNoBlankFrames':len(frames)})
 click('continue');click('beads');p.evaluate("window.frameTimes=[];window.lastFrame=performance.now();window.recordFrames=true;function sample(t){if(!recordFrames)return;frameTimes.push(t-lastFrame);lastFrame=t;requestAnimationFrame(sample)};requestAnimationFrame(sample)")
 def count():return int(p.locator('#bead-count').inner_text().split('/')[0])
 def drag(dx,dy,duration=600,x=90):
  box=p.locator('#bead-control').bounding_box();y=box['y']+50;p.mouse.move(x,y);p.mouse.down()
  for i in range(1,21):p.mouse.move(x+dx*i/20,y+dy*i/20);p.wait_for_timeout(duration/20)
  p.mouse.up();p.wait_for_timeout(200)
 drag(0,126);assert count()==3;checks.append('slow drag counts 3 while held')
 previous=count();drag(0,-100);assert count()==previous
 drag(120,20);assert count()==previous
 drag(0,126,x=10);assert count()==previous;checks.append('reverse / horizontal / edge do not count')
 box=p.locator('#bead-control').bounding_box();p.mouse.move(90,box['y']+30);p.mouse.down();p.mouse.move(90,box['y']+280);p.wait_for_timeout(550);p.mouse.up();p.wait_for_timeout(200);assert count()==previous+5;checks.append('fast drag catches 5 beads with rate limit; release does not add')
 previous=count();p.wait_for_timeout(400);assert count()==previous
 p.locator('#bead-control').click(position={'x':110,'y':150});assert count()==previous+1
 while count()<27:p.locator('#bead-control').press('Enter');p.wait_for_timeout(105)
 p.screenshot(path=str(out/'beads-drag-27.png'));p.evaluate('recordFrames=false');times=p.evaluate('frameTimes');times=[x for x in times if x>0]
 checks.append({'frameTiming':{'engine':'desktop Chromium, 393x852; not physical iPhone','frames':len(times),'medianMs':round(statistics.median(times),2),'p95Ms':round(sorted(times)[int(len(times)*.95)],2)}})
 p.wait_for_timeout(700);video=p.video;c.close();video.save_as(str(out/'beads-drag-393.webm'))
 for engine in [b,pw.webkit.launch(headless=True)]:
  for width,height in [(375,667),(390,844),(393,852),(430,932)]:
   ctx=engine.new_context(viewport={'width':width,'height':height});p=ctx.new_page();p.add_init_script("localStorage.setItem('ct-muted','true')");p.goto(base);ready()
   for v in ['entry','choose','home','incense','bow','sit','mo','beads']:
    if v=='choose':click('enter')
    elif v=='home':click('continue')
    elif v!='entry':click(v)
    m=p.evaluate("""()=>({scroll:document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('#controls button,.corner-button')].filter(e=>e.getClientRects().length).map(e=>({h:e.getBoundingClientRect().height,b:e.getBoundingClientRect().bottom,t:e.getBoundingClientRect().top,text:e.textContent,clip:e.scrollWidth>e.clientWidth+2}))})""")
    assert not m['scroll'],(width,v,m)
    assert all(x['h']>=47.9 and x['b']<=height+.5 and x['t']>=0 and not x['clip'] for x in m['buttons']),(width,v,m)
    if width in [390,430] and engine==b:p.screenshot(path=str(out/f'extra-{width}-{v}.png'))
    if v not in ['entry','choose','home']:click('home')
   checks.append({'engine':engine.browser_type.name,'size':[width,height],'eightPagesNoScrollAndButtons48':True});ctx.close()
  if engine!=b:engine.close()
 # Slow first load: immediate text, delayed unobtrusive indicator, retry.
 ctx=b.new_context(viewport={'width':393,'height':852});p=ctx.new_page()
 p.add_init_script("localStorage.setItem('ct-muted','true');const f=fetch;window.fetch=(u,o)=>String(u).includes('scene-vn-')?new Promise(r=>setTimeout(r,1500)).then(()=>f(u,o)):f(u,o)")
 p.goto(base,wait_until='domcontentloaded');p.wait_for_timeout(150);assert p.locator('[data-action=enter]').is_visible();assert not p.locator('#loading').is_visible();p.wait_for_timeout(500);assert p.locator('#loading').is_visible()
 assert p.locator('#loading').evaluate("e=>getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0)'&&getComputedStyle(e).pointerEvents==='none'")
 p.screenshot(path=str(out/'loading-600ms.png'));ready();checks.append('first text immediate, loading delayed >400ms, transparent nonblocking');ctx.close()
 ctx=b.new_context(viewport={'width':393,'height':852},reduced_motion='reduce');p=ctx.new_page();p.add_init_script("localStorage.setItem('ct-muted','true')");p.route('**/scene-vn-*.webp',lambda r:r.fulfill(status=503,body='test'))
 p.goto(base);ready();assert p.locator('[data-action=retry]').is_visible();p.unroute_all();click('retry');assert not p.locator('[data-action=retry]').count();click('enter');click('continue');click('beads');drag(0,126);assert count()==1;checks.append('failure retry recovery; reduced-motion swipe exactly one');ctx.close()
 b.close();assert not errors,errors
(out/'checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(checks),flush=True)
