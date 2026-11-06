from pathlib import Path
import html,json
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright
import sys
root=Path(__file__).resolve().parents[1]/'dist';out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
release=json.loads((root/'release.json').read_text())['release']
with sync_playwright() as pw:
 b=pw.chromium.launch(channel='chrome');url='https://staging.chuamay.org/'
 for yes in [False,True]:
  ctx=b.new_context(viewport={'width':393,'height':659});page=ctx.new_page();rec=[];errors=[]
  # HTML comes from the verified bundle. JS, CSS, media and Google responses are live.
  csp=ctx.request.get(url+f'analytics.{release}.js').headers['content-security-policy']
  page.route(url+'?*',lambda route:route.fulfill(body=(root/'index.html').read_bytes(),headers={'content-type':'text/html; charset=utf-8','content-security-policy':csp}))
  def collect(req,status):
   u=urlparse(req.url)
   if u.hostname not in ['www.googletagmanager.com','www.google-analytics.com','analytics.google.com','region1.google-analytics.com'] and 'google-analytics.com' not in (u.hostname or ''):return
   assert 'secretprobe' not in req.url+(req.post_data or '')
   pars=parse_qs(u.query+'&'+(req.post_data or ''))
   rec.append([u.netloc+u.path,status,pars.get('tid',[''])[0],pars.get('_dbg',[''])[0],pars.get('en',[''])[0],pars.get('dt',[''])[0],pars.get('dl',[''])[0]])
  page.on('response',lambda r:collect(r.request,r.status));page.on('requestfailed',lambda r:collect(r,'failed'));page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(url+'?s=secretprobe#secretprobe',wait_until='domcontentloaded',timeout=60000)
  choice=page.locator('#ga-choice button');choice.first.wait_for();assert not rec
  (choice.first if yes else choice.last).click();page.get_by_text('Vào chùa',exact=True).click();page.wait_for_timeout(8500)
  names=[c['name'] for c in ctx.cookies() if c['name'].startswith('_ga')];state='accepted' if yes else 'declined'
  data={'mode':state,'requests':rec,'cookie_names':names,'errors':errors};(out/(state+'.json')).write_text(json.dumps(data,indent=2))
  print(data,flush=True)
  report=ctx.new_page();report.set_viewport_size({'width':760,'height':400});report.set_content('<style>body{font:18px system-ui;margin:24px;color:#302923}pre{font-size:14px;white-space:pre-wrap;background:#f6f2ed;padding:14px}</style><h2>Staging · '+state+'</h2><p>Browser network capture · live assets and collectors</p><pre>'+html.escape('\n'.join(' | '.join(map(str,row)) for row in rec) or 'GA requests: 0')+'</pre><p>GA cookie names: '+(', '.join(names) or 'none')+'</p><small>Top-level HTML supplied from the deployed release; staging CSP applied.</small>');report.screenshot(path=out/(state+'.png'))
  if not yes:assert not names and not rec
  if yes:
   assert names and any(r[1]==204 and r[4]=='page_view' and r[2]=='G-0EF24Y0Q9M' for r in rec)
   page.locator('#more-toggle').click();page.get_by_text('Tùy chọn thống kê').click();choice.last.click()
   assert not [c for c in ctx.cookies() if c['name'].startswith('_ga')]
  ctx.close()
