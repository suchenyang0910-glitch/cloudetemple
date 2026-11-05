from pathlib import Path
from datetime import datetime,timezone
import json
from playwright.sync_api import sync_playwright

out=Path('screenshots/round3/review2/gestures');out.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as pw:
 b=pw.chromium.launch();c=b.new_context(viewport={'width':393,'height':659},timezone_id='UTC',record_video_dir=str(out/'raw'),record_video_size={'width':393,'height':659})
 p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.add_init_script("localStorage.setItem('ct-muted','true');localStorage.setItem('ct-visitor','\"bun-light\"');window.haptics=[];Object.defineProperty(navigator,'vibrate',{value:v=>{haptics.push(v);return true}})")
 p.clock.set_fixed_time(datetime(2026,11,5,10,tzinfo=timezone.utc));p.goto('http://127.0.0.1:8828')
 def ready():p.wait_for_function("document.querySelector('#app').getAttribute('aria-busy')==='false'");p.wait_for_timeout(350)
 def click(a):p.locator(f'[data-action={a}]').click();ready()
 ready();click('enter');click('continue');click('beads')
 p.locator('#sound-toggle').click();p.evaluate("async()=>{window.testAudio=(await import('./app.js')).audio}");p.wait_for_function("testAudio.enabled&&!testAudio.loading&&testAudio.buffers.has('bead-v1')")
 for distance,expected in [(1.6,2),(1.4,1)]:
  if distance==1.4:click('home');click('beads')
  p.evaluate("()=>{window.cues=[];haptics=[];testAudio.observe=e=>{if(e.event==='play')cues.push(e)}}")
  pitch=393*.142+6;x,y=310,260
  p.mouse.move(x,y);p.mouse.down()
  for i in range(1,33):p.mouse.move(x,y+distance*pitch*i/32);p.wait_for_timeout(20)
  assert p.locator('#bead-count').inner_text().startswith('1 /')
  p.mouse.up();p.wait_for_timeout(250)
  count=int(p.locator('#bead-count').inner_text().split('/')[0]);sounds=p.evaluate("cues.filter(e=>e.name==='bead-v1').length");haptics=p.evaluate('haptics.length')
  assert (count,sounds,haptics)==(expected,expected,expected),(distance,count,sounds,haptics)
  # At rest, next numbered bead is exactly centered on the thumb point.
  position=p.locator(f'.strand-bead[data-number="{expected+1}"]').bounding_box();thumb=p.locator('.thumb-point').bounding_box()
  error=abs(position['x']+position['width']/2-thumb['x']-thumb['width']/2)+abs(position['y']+position['height']/2-thumb['y']-thumb['height']/2)
  assert error<1,error
  results.append(dict(drag=distance,count=count,decodedBeadSounds=sounds,hapticCalls=haptics,snapErrorPx=error))
  p.screenshot(path=str(out/f'drag-{distance}.png'));p.wait_for_timeout(800)
 click('home');click('beads')
 for period,hour in [('day',10),('night',21)]:
  p.clock.set_fixed_time(datetime(2026,11,5,hour,tzinfo=timezone.utc));p.wait_for_function(f"document.body.dataset.period==='{period}'");p.wait_for_timeout(300)
  for hand in ['right','left']:
   if p.evaluate('document.body.dataset.hand')!=hand:click('bead-hand')
   assert p.locator('[data-action=bead-hand]').inner_text()=='Đổi tay'
   assert ('trái' if hand=='left' else 'phải') in p.locator('[data-action=bead-hand]').get_attribute('aria-label')
   p.screenshot(path=str(out/f'393-{period}-{hand}.png'))
 # Spacer and guru stay mapped to logical numbers while animating.
 if p.evaluate('document.body.dataset.hand')=='left':click('bead-hand')
 for n in range(26):p.locator('#bead-control').press('Enter');p.wait_for_timeout(100)
 assert p.locator('.strand-bead.spacer[data-number="27"]').count()==1
 p.screenshot(path=str(out/'spacer.png'))
 for n in range(82):p.locator('#bead-control').press('Enter');p.wait_for_timeout(100)
 p.wait_for_timeout(200);assert p.locator('.strand-bead.guru[data-number="109"]').count()==1;p.screenshot(path=str(out/'guru.png'))
 p.locator('#bead-control').press('Enter');p.wait_for_timeout(400);assert p.locator('[data-action=bead-again]').is_visible()
 click('bead-again');assert 'Vòng 2' in p.locator('#heading').inner_text()
 p.locator('[data-action=more]').click();p.locator('#language').select_option('en');p.locator('#close-more').click()
 assert p.locator('[data-action=bead-hand]').inner_text()=='Switch hand';assert 'Currently using right hand' in p.locator('[data-action=bead-hand]').get_attribute('aria-label')
 assert not p.evaluate('document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight')
 assert not errors,errors
 video=p.video;c.close();video.save_as(str(out/'drag-release-393.webm'));b.close()
(out/'checks.json').write_text(json.dumps(dict(results=results,errors=errors,approvedArtwork=True,languageLabels=True,spacerGuru=True,scope='Desktop Chromium; actual decoded sound scheduling and mocked vibration calls, not physical iPhone listening or haptics'),indent=2));print(json.dumps(results))
