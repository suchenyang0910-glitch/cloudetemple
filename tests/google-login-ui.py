from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
import json, subprocess, time

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'screenshots'/'staging-small-fixes'/'google'
OUT.mkdir(parents=True,exist_ok=True)
PORT=8901
server=subprocess.Popen(['python','-m','http.server',str(PORT),'-d',str(ROOT/'dist')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
  time.sleep(.4)
  with sync_playwright() as p:
    browser=p.chromium.launch()
    def open_page(width,height,user_agent=None,authenticated=False,name='login'):
      page=browser.new_page(viewport={'width':width,'height':height},user_agent=user_agent)
      def api(route):
        path=urlparse(route.request.url).path
        body={'ok':True,'authenticated':authenticated,'csrf':'csrf-test' if authenticated else ''} if path.endswith('/session') else {'ok':True,'tablets':[]} if path.endswith('/tablets') else {'ok':False}
        route.fulfill(status=200 if body.get('ok') else 404,content_type='application/json',body=json.dumps(body))
      page.route('**/api/family/**',api);page.goto(f'http://localhost:{PORT}/family.html')
      page.screenshot(path=OUT/f'{width}x{height}-{name}.png')
      return page
    for width,height in [(375,548),(393,659),(393,852)]:
      page=open_page(width,height,name='google-login');assert page.locator('.google').is_visible();assert page.locator('.google').bounding_box()['y']<page.locator('#email-login').bounding_box()['y'];page.close()
    page=open_page(393,659,user_agent='Telegram-iOS',name='embedded-login');assert page.locator('.google').count()==0;assert 'Safari' in page.locator('.login').inner_text();page.close()
    page=open_page(393,659,authenticated=True,name='google-success');assert page.locator('#email-login').count()==0;assert page.locator('#new').is_visible();page.close()
    browser.close()
  print({'passed':True,'screenshots':len(list(OUT.glob('*.png')))})
finally:
  server.terminate();server.wait(timeout=5)
