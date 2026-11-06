from pathlib import Path
from playwright.sync_api import sync_playwright

base='http://127.0.0.1:8825'
out=Path(__file__).resolve().parents[1]/'screenshots'/'issues5-7'
out.mkdir(parents=True,exist_ok=True)

with sync_playwright() as p:
 browser=p.chromium.launch()
 for width,height in [(375,548),(393,659)]:
  page=browser.new_page(viewport={'width':width,'height':height})
  page.add_init_script("""localStorage.setItem('ct-muted','true');localStorage.setItem('ct-analytics','no');
    navigator.canShare=()=>true;navigator.share=async d=>window.shareData={text:d.text,url:d.url,files:d.files?.length||0};""")
  page.goto(base+'/?s=zalo&a=beads')
  page.wait_for_function("document.querySelector('#app').getAttribute('aria-busy')==='false'")
  if page.locator('#ga-choice').count():
   page.locator('#ga-choice').evaluate("e=>e.hidden=true")
  assert page.url==base+'/'
  def go(action):
   page.locator(f'[data-action={action}]').click();expected={'enter':'choose','continue':'home'}.get(action,action);page.wait_for_function("v=>document.body.dataset.view===v&&document.querySelector('#app').getAttribute('aria-busy')==='false'",arg=expected);page.wait_for_timeout(400)
  go('enter');go('continue')
  for activity in ['incense','bow','sit','mo']:
   go(activity)
   dims=page.evaluate("({scrollW:document.documentElement.scrollWidth,w:innerWidth,scrollH:document.documentElement.scrollHeight,h:innerHeight})")
   assert dims['scrollW']<=dims['w'] and dims['scrollH']<=dims['h'],(activity,dims)
   go('home')
  go('beads')
  page.locator('#bead-control').wait_for()
  page.screenshot(path=out/f'{width}x{height}-beads-round1.png')
  for _ in range(108):
   page.locator('#bead-control').press('Enter');page.wait_for_timeout(95)
  assert page.locator('[data-action=bead-again]').is_visible()
  page.locator('[data-action=share]').click();page.locator('.share-preview').wait_for()
  page.screenshot(path=out/f'{width}x{height}-share-card.png')
  page.locator('[data-action=share-file]').click();page.wait_for_function("window.shareData?.files===1")
  data=page.evaluate('shareData');assert data['text'] and data['url'].endswith('?s=system&a=beads')
  page.locator('#close-modal').click();page.locator('[data-action=bead-again]').click();page.locator('#bead-control').wait_for()
  assert page.locator('.strand-bead.guru').count()==1
  page.screenshot(path=out/f'{width}x{height}-beads-round2-reversed.png')
  dims=page.evaluate("({scrollW:document.documentElement.scrollWidth,w:innerWidth,scrollH:document.documentElement.scrollHeight,h:innerHeight,bad:[...document.querySelectorAll('button')].filter(b=>b.offsetParent).filter(b=>{const r=b.getBoundingClientRect();return r.width<44||r.height<44||r.bottom>innerHeight||r.right>innerWidth}).length})")
  assert dims['scrollW']<=dims['w'] and dims['scrollH']<=dims['h'] and dims['bad']==0,dims
  page.close()
 for route in ['/huong-dan/thap-huong','/huong-dan/le-phat','/huong-dan/lan-chuoi','/huong-dan/go-mo','/huong-dan/ngoi-yen','/cau-hoi-thuong-gap']:
  page=browser.new_page(java_script_enabled=False)
  response=page.goto(base+'/static'+route+'/');assert response.status==200
  html=page.content();assert '<h1>' in html and '待核' not in html and 'application/ld+json' in html
  page.close()
 browser.close()
print({'passed':True,'sizes':['375x548','393x659'],'staticPages':6})
