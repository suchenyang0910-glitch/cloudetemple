from pathlib import Path
from playwright.sync_api import sync_playwright
import subprocess, time

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'screenshots'/'ccgs-integration'
OUT.mkdir(parents=True,exist_ok=True)
PORT=8897
server=subprocess.Popen(['python','-m','http.server',str(PORT),'-d',str(ROOT/'dist')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
sizes=[(375,548),(393,659),(393,852)]

def enter(page,morning_seen=True):
    page.goto(f'http://localhost:{PORT}/')
    page.evaluate("localStorage.setItem('ct-analytics','no')")
    if morning_seen: page.evaluate("localStorage.setItem('ct-morning-seen','true')")
    else: page.evaluate("localStorage.removeItem('ct-morning-seen')")
    page.reload(); page.locator('[data-action=enter]').click(); page.locator('[data-action=continue]').click()
    page.locator('#ga-choice').evaluate("el=>el.hidden=true")

try:
  time.sleep(.4)
  with sync_playwright() as p:
    browser=p.chromium.launch()
    for width,height in sizes:
      page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
      enter(page,False); page.locator('[data-action=morning-start]').wait_for()
      page.screenshot(path=OUT/f'{width}x{height}-morning-bell.png')
      page.locator('[data-action=morning-start]').click(); page.locator('[data-action=light]').wait_for(timeout=6000)
      page.screenshot(path=OUT/f'{width}x{height}-morning-incense.png')
      page.locator('[data-action=morning-skip-step]').click(); page.locator('[data-action=bow-once]').wait_for()
      page.screenshot(path=OUT/f'{width}x{height}-morning-bow.png')
      page.locator('[data-action=morning-skip-step]').click(); page.locator('[data-action=sit-start]').wait_for()
      page.screenshot(path=OUT/f'{width}x{height}-morning-sit.png')
      page.close()
      for date in ['2027-01-30','2027-02-05','2027-02-06','2027-02-20']:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
        page.goto(f'http://localhost:{PORT}/?festival-date={date}')
        page.evaluate("localStorage.setItem('ct-morning-seen','true');localStorage.setItem('ct-analytics','no')");page.reload()
        page.locator('[data-action=enter]').click();page.locator('[data-action=continue]').click();page.locator('[data-action=incense]').wait_for()
        page.locator('#ga-choice').evaluate("el=>el.hidden=true")
        assert page.locator('body').get_attribute('data-festival')
        page.screenshot(path=OUT/f'{width}x{height}-festival-{date}.png')
        page.close()
    browser.close()
  print({'passed':True,'screenshots':len(list(OUT.glob('*.png'))),'sizes':sizes})
finally:
  server.terminate();server.wait(timeout=5)
