from pathlib import Path
from playwright.sync_api import sync_playwright
import subprocess, time

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'screenshots'/'next-round-staging'
OUT.mkdir(parents=True,exist_ok=True)
PORT=8898
server=subprocess.Popen(['python','-m','http.server',str(PORT),'-d',str(ROOT/'dist')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
sizes=[(375,548),(393,659),(393,852)]
try:
  time.sleep(.4)
  with sync_playwright() as p:
    browser=p.chromium.launch()
    for width,height in sizes:
      page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
      page.goto(f'http://localhost:{PORT}/')
      page.evaluate("localStorage.clear();localStorage.setItem('ct-analytics',JSON.stringify('no'));localStorage.setItem('ct-morning-seen',JSON.stringify(true))")
      page.reload(); page.locator('[data-action=enter]').wait_for()
      page.locator('#sound-hint').wait_for(state='visible'); assert 'âm thanh' in page.locator('#sound-hint').inner_text();page.locator('#boot').wait_for(state='detached')
      page.screenshot(path=OUT/f'{width}x{height}-entry.png')
      page.locator('[data-action=enter]').click();page.locator('[data-action=continue]').click();page.locator('[data-action=incense]').wait_for();page.locator('#ga-choice').evaluate("el=>el.hidden=true")
      page.screenshot(path=OUT/f'{width}x{height}-home.png')
      home=page.evaluate("""()=>({scroll:[document.scrollingElement.scrollWidth,document.scrollingElement.scrollHeight,innerWidth,innerHeight],nav:[...document.querySelectorAll('.action-nav button')].map(e=>({font:parseFloat(getComputedStyle(e).fontSize),r:e.getBoundingClientRect()})),gap:parseFloat(getComputedStyle(document.querySelector('.action-nav')).gap),heading:parseFloat(getComputedStyle(document.querySelector('.scene-heading h1')).fontSize)})""")
      assert home['scroll']==[width,height,width,height],home
      assert home['gap']>=8 and home['heading']>=18 and all(x['font']>=14 and x['r']['height']>=44 for x in home['nav']),home
      page.locator('[data-action=incense]').click();page.locator('[data-action=light]').wait_for();page.screenshot(path=OUT/f'{width}x{height}-incense.png')
      back=page.locator('[data-action=home]'); style=back.evaluate("e=>({font:parseFloat(getComputedStyle(e).fontSize),border:getComputedStyle(e).borderStyle,height:e.getBoundingClientRect().height})")
      assert style['font']>=16 and style['border']!='none' and style['height']>=44,style
      page.close()
      page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
      page.goto(f'http://localhost:{PORT}/');page.evaluate("localStorage.clear();localStorage.setItem('ct-analytics',JSON.stringify('no'))");page.reload();page.locator('[data-action=enter]').click();page.locator('[data-action=continue]').click();page.locator('[data-action=morning-start]').wait_for();page.locator('#ga-choice').evaluate("el=>el.hidden=true");page.wait_for_timeout(700)
      page.screenshot(path=OUT/f'{width}x{height}-morning-bell.png')
      page.close()
    browser.close()
  print({'passed':True,'screenshots':len(list(OUT.glob('*.png'))),'sizes':sizes})
finally:
  server.terminate();server.wait(timeout=5)
