from pathlib import Path
from datetime import datetime,timezone
import json,os,re
from playwright.sync_api import sync_playwright
url=os.environ.get('RELEASE_URL','http://127.0.0.1:8829');live=url.startswith('https:');out=Path('screenshots/round3/review2/deployed' if live else 'review/review2-package');out.mkdir(parents=True,exist_ok=True);release=json.loads(Path('dist/release.json').read_text())['release'];rows=[]
with sync_playwright() as pw:
 b=pw.chromium.launch()
 for w,h in [(375,548),(393,659),(375,667),(393,852)]:
  c=b.new_context(viewport={'width':w,'height':h},timezone_id='UTC');p=c.new_page();bad=[];requests=[];p.on('pageerror',lambda e:bad.append(str(e)));p.on('response',lambda r:bad.append(f'{r.status} {r.url}') if r.status>=400 else None);p.on('request',lambda r:requests.append(r.url))
  if live:
   html=Path('dist/index.html').read_text(encoding='utf-8');csp=re.search(r'Content-Security-Policy "([^"]+)"',Path('deploy/generated-nginx/staging.conf').read_text())[1]
   p.route(url+'/',lambda r:r.fulfill(body=html,content_type='text/html',headers={'Content-Security-Policy':csp}))
  p.add_init_script("localStorage.setItem('ct-muted','true');localStorage.setItem('ct-visitor','\"bun-light\"')");p.clock.set_fixed_time(datetime(2026,11,5,10,tzinfo=timezone.utc));p.goto(url+'/')
  def ready():p.locator('#app[aria-busy=false]').wait_for();p.wait_for_timeout(300)
  def click(a):p.locator(f'[data-action={a}]').click();ready()
  ready();click('enter');click('continue')
  for period,hour in [('day',10),('night',21)]:
   p.clock.set_fixed_time(datetime(2026,11,5,hour,tzinfo=timezone.utc));p.wait_for_timeout(500)
   for v in ['mo','beads']:
    click(v)
    for hand in (['right','left'] if v=='beads' else ['']):
     if hand and p.evaluate('document.body.dataset.hand')!=hand:click('bead-hand')
     assert not p.evaluate('document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth')
     if h in [548,659]:p.screenshot(path=str(out/f'{w}x{h}-{period}-{v}{"-"+hand if hand else ""}.png'))
    click('home')
  fonts=p.evaluate('''async()=>{for(const w of [400,500,600])await document.fonts.load(w+' 16px "Be Vietnam Pro"','Việt Nam');return [...document.fonts].filter(f=>f.family.includes('Be Vietnam Pro')).map(f=>f.status)}''')
  assert len(fonts)==6 and all(x=='loaded' for x in fonts),fonts
  assert not bad,bad
  assert not any('fonts.google' in u for u in requests)
  assert all(release in u for u in requests if re.search(r'\.(js|css|woff2)(\?|$)',u) and url in u)
  rows.append({'size':[w,h],'fontsLoaded':len(fonts),'errors':bad,'requests':requests});c.close()
 b.close()
(out/'checks.json').write_text(json.dumps({'release':release,'url':url,'entryHTML':'local exact package fulfilled for auth bypass' if live else 'local package HTTP','checks':rows},indent=2));print(json.dumps({'release':release,'live':live,'cases':len(rows)}))
