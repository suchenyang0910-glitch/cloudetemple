from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.request import urlopen
import subprocess
import time

from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
out=root/'screenshots'/'issues5-7'
out.mkdir(parents=True,exist_ok=True)
subprocess.run(['pwsh','-NoProfile','-File',str(root/'tools'/'package.ps1'),'-Environment','staging'],cwd=root,check=True)

class QuietHandler(SimpleHTTPRequestHandler):
 def log_message(self,format,*args):pass

server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(root/'dist')))
thread=Thread(target=server.serve_forever,daemon=True)
thread.start()
base=f'http://127.0.0.1:{server.server_port}'
for _ in range(50):
 try:
  with urlopen(base,timeout=.2) as response:
   if response.status==200:break
 except OSError:time.sleep(.05)
else:raise RuntimeError('dist preview did not become ready')

try:
 with sync_playwright() as p:
  browser=p.chromium.launch(args=['--host-resolver-rules=MAP staging.chuamay.org 127.0.0.1'])
  for width,height in [(375,548),(393,659)]:
   page=browser.new_page(viewport={'width':width,'height':height})
   page.add_init_script("""localStorage.setItem('ct-muted','true');localStorage.setItem('ct-analytics','no');
     navigator.canShare=()=>true;navigator.share=async d=>window.shareData={text:d.text,url:d.url,files:d.files?.length||0};""")
   page.goto(base+'/?s=zalo&a=beads')
   page.wait_for_function("document.querySelector('#app').getAttribute('aria-busy')==='false'")
   if page.locator('#ga-choice').count():page.locator('#ga-choice').evaluate("e=>e.hidden=true")
   assert page.url==base+'/'
   def go(action,expected=None):
    page.locator(f'[data-action={action}]').click();expected=expected or {'enter':'choose','continue':'home'}.get(action,action)
    page.wait_for_function("v=>document.body.dataset.view===v&&document.querySelector('#app').getAttribute('aria-busy')==='false'",arg=expected);page.wait_for_timeout(400)
   go('enter');go('continue','beads')
   assert page.url==base+'/' and page.locator('#bead-control').is_visible()
   go('home')
   for activity in ['incense','bow','sit','mo']:
    go(activity)
    dims=page.evaluate("({scrollW:document.documentElement.scrollWidth,w:innerWidth,scrollH:document.documentElement.scrollHeight,h:innerHeight})")
    assert dims['scrollW']<=dims['w'] and dims['scrollH']<=dims['h'],(activity,dims)
    go('home')
   go('beads');page.locator('#bead-control').wait_for();page.screenshot(path=out/f'{width}x{height}-beads-round1.png')
   for _ in range(108):page.locator('#bead-control').press('Enter');page.wait_for_timeout(95)
   assert page.locator('[data-action=bead-again]').is_visible()
   assert page.locator('[data-action=share]').inner_text()=='Chia sẻ' and page.locator('[data-action=download]').inner_text()=='Tải ảnh'
   page.locator('[data-action=share]').click();page.wait_for_function("window.shareData?.files===1")
   data=page.evaluate('shareData');assert data['text'] and data['url'].endswith('?s=system&a=beads')
   page.evaluate("navigator.share=undefined;navigator.clipboard.writeText=async t=>window.copied=t;window.open=(...a)=>{window.opened=a;return null}")
   page.locator('[data-action=share]').click();page.locator('.share-preview').wait_for();page.screenshot(path=out/f'{width}x{height}-share-card.png')
   page.locator('[data-action=share-zalo]').click();page.wait_for_function("window.opened?.[0]==='zalo://'");assert 's=zalo' in page.evaluate('window.copied')
   page.evaluate("(()=>{window.opened=null;navigator.clipboard.writeText=async()=>{throw Error('blocked')};return null})()")
   page.locator('[data-action=share-zalo]').click();page.wait_for_timeout(100);assert page.evaluate('window.opened') is None
   page.evaluate("(()=>{window.opened=null;navigator.clipboard.writeText=async t=>window.copied=t;return null})()")
   page.locator('[data-action=share-messenger]').click();page.wait_for_function("window.opened?.[0]?.startsWith('fb-messenger://')");assert 's=messenger' in page.evaluate('window.copied')
   page.locator('#close-modal').click();page.locator('[data-action=bead-again]').click();page.locator('#bead-control').wait_for()
   assert page.locator('.strand-bead.guru').count()==1
   page.screenshot(path=out/f'{width}x{height}-beads-round2-reversed.png')
   dims=page.evaluate("({scrollW:document.documentElement.scrollWidth,w:innerWidth,scrollH:document.documentElement.scrollHeight,h:innerHeight,bad:[...document.querySelectorAll('button')].filter(b=>b.offsetParent).filter(b=>{const r=b.getBoundingClientRect();return r.width<44||r.height<44||r.bottom>innerHeight||r.right>innerWidth}).length})")
   assert dims['scrollW']<=dims['w'] and dims['scrollH']<=dims['h'] and dims['bad']==0,dims
   page.close()

  page=browser.new_page(viewport={'width':393,'height':659})
  page.add_init_script("localStorage.setItem('ct-muted','true');localStorage.setItem('ct-analytics','no')")
  page.goto(base+'/?a=javascript%3Aalert(1)&s=attacker');page.wait_for_function("document.querySelector('#app').getAttribute('aria-busy')==='false'")
  page.locator('[data-action=enter]').click();page.wait_for_function("document.body.dataset.view==='choose'")
  page.locator('[data-action=continue]').click();page.wait_for_function("document.body.dataset.view==='home'")
  assert page.url==base+'/';page.close()

  for route in ['/huong-dan/thap-huong','/huong-dan/le-phat','/huong-dan/lan-chuoi','/huong-dan/go-mo','/huong-dan/ngoi-yen','/cau-hoi-thuong-gap']:
   page=browser.new_page(java_script_enabled=False)
   response=page.goto(base+route+'/');assert response.status==200
   html=page.content();assert '<h1>' in html and '待核' not in html and 'application/ld+json' in html and not any(f'<p>{letter}</p>' in html for letter in 'htap')
   page.close()

  page=browser.new_page(viewport={'width':393,'height':659})
  page.add_init_script("localStorage.setItem('ct-muted','true');localStorage.setItem('ct-analytics','no')")
  page.route('https://telegram.org/js/telegram-web-app.js',lambda route:route.fulfill(content_type='text/javascript',body="""window.Telegram={WebApp:{initData:'test',initDataUnsafe:{},viewportStableHeight:659,safeAreaInset:{},contentSafeAreaInset:{},ready(){},expand(){},disableVerticalSwipes(){},onEvent(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},enableClosingConfirmation(){},disableClosingConfirmation(){},BackButton:{onClick(){},show(){},hide(){}},SettingsButton:{onClick(){},show(){}},HapticFeedback:{impactOccurred(){}}}};"""))
  telegram_base=f'http://staging.chuamay.org:{server.server_port}'
  page.goto(telegram_base+'/?telegram=1&a=mo');page.wait_for_function("document.querySelector('#app').getAttribute('aria-busy')==='false'")
  page.locator('[data-action=enter]').click();page.wait_for_function("document.body.dataset.view==='choose'")
  page.locator('[data-action=continue]').click();page.wait_for_function("document.body.dataset.view==='mo'")
  page.evaluate("for(let i=0;i<108;i++)document.querySelector('#wood-prop').click()")
  page.wait_for_function("!!document.querySelector('[data-action=download]')")
  page.locator('[data-action=download]').click();page.wait_for_function("document.querySelector('#share-status').textContent.includes('Nhấn giữ')")
  assert page.evaluate("!('telegramDownload' in window)")
  page.close();browser.close()
finally:
 server.shutdown();server.server_close();thread.join(timeout=2)

print({'passed':True,'sizes':['375x548','393x659'],'staticPages':6})
