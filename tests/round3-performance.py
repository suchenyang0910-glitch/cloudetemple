"""Cold cache, aggregate Fast 3G shaping; browser engine is not a physical phone."""
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import urlparse,unquote
from threading import Thread,Lock
import time,json,mimetypes,statistics
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];out=root/'screenshots/round3';roots={'before':root/'review/round3-baseline','after':root};lock=Lock();next_byte=0
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  global next_byte
  parts=unquote(urlparse(self.path).path).strip('/').split('/',1)
  if parts[0] not in roots:self.send_error(404);return
  base=roots[parts[0]].resolve();relative=parts[1] if len(parts)>1 and parts[1] else 'index.html';file=(base/relative).resolve()
  if not file.is_relative_to(base) or not file.is_file() or file.suffix not in ['.html','.css','.js','.webp','.json','.mp3','.m4a']:self.send_error(404);return
  body=file.read_bytes();time.sleep(.15);self.send_response(200);self.send_header('Content-Type',mimetypes.guess_type(file)[0] or 'application/octet-stream');self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.end_headers()
  try:
   for offset in range(0,len(body),8192):
    chunk=body[offset:offset+8192]
    with lock:next_byte=max(next_byte,time.monotonic())+len(chunk)/200000;deadline=next_byte
    time.sleep(max(0,deadline-time.monotonic()));self.wfile.write(chunk);self.wfile.flush()
  except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):pass
server=ThreadingHTTPServer(('127.0.0.1',8822),Handler);Thread(target=server.serve_forever,daemon=True).start();records=[]
try:
 with sync_playwright() as pw:
  browser=pw.webkit.launch(headless=True)
  for variant in ['before','after']:
   for run in range(3):
    options={'viewport':{'width':393,'height':852},'device_scale_factor':3,'is_mobile':True,'has_touch':True,'timezone_id':'Asia/Ho_Chi_Minh'}
    if variant=='after' and run==0:options.update(record_video_dir=str(out/'video'),record_video_size={'width':393,'height':852})
    ctx=browser.new_context(**options);p=ctx.new_page();p.route('https://**/*',lambda r:r.abort());p.add_init_script("localStorage.setItem('ct-muted','true');localStorage.setItem('ct-visitor',JSON.stringify('bun-light'))")
    p.goto(f'http://127.0.0.1:8822/{variant}/',wait_until='domcontentloaded')
    if variant=='after':p.wait_for_function("performance.getEntriesByName('ct-interactive').length>0");interactive=p.evaluate("performance.getEntriesByName('ct-interactive')[0].startTime")
    else:p.locator('[data-action=enter]').wait_for();p.locator('#loading').wait_for(state='hidden');interactive=p.evaluate('performance.now()')
    p.wait_for_function("document.querySelector('#app').getAttribute('aria-busy')==='false'")
    firstScene=p.evaluate('performance.now()');p.wait_for_load_state('networkidle')
    data=p.evaluate("""()=>({bytes:performance.getEntriesByType('resource').filter(e=>e.name.startsWith(location.origin)).reduce((s,e)=>s+e.encodedBodySize,0)+performance.getEntriesByType('navigation')[0].encodedBodySize,audioRequests:performance.getEntriesByType('resource').filter(e=>/\.(m4a|mp3)$/.test(e.name)).length})""")
    record={'variant':variant,'run':run+1,'interactiveMs':round(interactive),'firstSceneMs':round(firstScene),**data};records.append(record);print(json.dumps(record),flush=True)
    if variant=='after' and run==0:
     for action in ['enter','continue','mo']:
      p.locator(f'[data-action={action}]').click();p.wait_for_function("document.querySelector('#app').getAttribute('aria-busy')==='false'");p.wait_for_timeout(900)
     p.screenshot(path=str(out/'fast3g-mo.png'));video=p.video;ctx.close();video.save_as(str(out/'fast3g-entry-home-mo.webm'))
    else:ctx.close()
  browser.close()
finally:server.shutdown()
result={'engine':'WebKit 26.4 Windows, not physical Safari','network':'1.6Mbps shared download, 150ms response delay, cold cache; external fonts blocked equally; excludes TLS/DNS/authentication/Cloudflare latency','records':records,'medians':{v:{k:statistics.median(r[k] for r in records if r['variant']==v) for k in ['interactiveMs','firstSceneMs','bytes']} for v in roots}}
(out/'performance.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result['medians']),flush=True)
