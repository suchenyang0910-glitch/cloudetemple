"""WebKit on Windows, iPhone viewport; server-shaped Fast 3G, not physical Safari."""
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import urlparse,unquote
from threading import Thread,Lock
import time,json,mimetypes,statistics
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
roots={'before':root/'review/perf/before','after':root/'dist'}
lock=Lock();next_byte=0
class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        global next_byte
        parts=unquote(urlparse(self.path).path).strip('/').split('/',1)
        if parts[0] not in roots:self.send_error(404);return
        base=roots[parts[0]].resolve();file=(base/(parts[1] if len(parts)>1 and parts[1] else 'index.html')).resolve()
        if not file.is_relative_to(base) or not file.is_file():self.send_error(404);return
        body=file.read_bytes();time.sleep(.15)
        self.send_response(200);self.send_header('Content-Type',mimetypes.guess_type(file)[0] or 'application/octet-stream');self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.end_headers()
        try:
            for offset in range(0,len(body),8192):
                chunk=body[offset:offset+8192]
                with lock:next_byte=max(next_byte,time.monotonic())+len(chunk)/200000;deadline=next_byte
                time.sleep(max(0,deadline-time.monotonic()));self.wfile.write(chunk);self.wfile.flush()
        except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):pass
server=ThreadingHTTPServer(('127.0.0.1',8812),Handler);Thread(target=server.serve_forever,daemon=True).start()
records=[]
try:
    with sync_playwright() as p:
        browser=p.webkit.launch(headless=True)
        for variant in ['before','after']:
            for run in range(3):
                context=browser.new_context(viewport={'width':393,'height':852},device_scale_factor=3,is_mobile=True,has_touch=True,timezone_id='Asia/Ho_Chi_Minh')
                page=context.new_page();page.route('https://**/*',lambda route:route.abort())
                page.add_init_script("const OriginalDate=Date;window.Date=class extends OriginalDate{constructor(...a){super(...(a.length?a:['2026-11-05T10:00:00+07:00']))}static now(){return new OriginalDate('2026-11-05T10:00:00+07:00').getTime()}}")
                page.goto(f'http://127.0.0.1:8812/{variant}/',wait_until='domcontentloaded')
                page.locator('[data-action=enter]').wait_for();page.locator('#loading').wait_for(state='hidden')
                interactive=page.evaluate('performance.now()');page.wait_for_load_state('networkidle')
                metrics=page.evaluate("""()=>({bytes:performance.getEntriesByType('resource').filter(e=>e.name.startsWith(location.origin)).reduce((s,e)=>s+e.encodedBodySize,0)+performance.getEntriesByType('navigation')[0].encodedBodySize,images:performance.getEntriesByType('resource').filter(e=>e.name.endsWith('.webp')).map(e=>({url:e.name,bytes:e.encodedBodySize})),audio:performance.getEntriesByType('resource').filter(e=>/\\.(m4a|mp3)$/.test(e.name)).length})""")
                record={'variant':variant,'run':run+1,'interactiveMs':round(interactive),**metrics};records.append(record);print(json.dumps(record),flush=True)
                if run==0:page.screenshot(path=str(root/f'screenshots/mobile-{variant}-webkit.png'))
                context.close()
        browser.close()
finally:server.shutdown()
result={'engine':'Playwright WebKit 26.4 Windows; not physical Safari','network':'server shaped 1.6 Mbps aggregate download / 150ms response delay, cold cache; external fonts blocked equally; no TLS/DNS/BasicAuth prompt/Cloudflare delay','records':records,'medians':{v:{'interactiveMs':statistics.median(r['interactiveMs'] for r in records if r['variant']==v),'bytes':statistics.median(r['bytes'] for r in records if r['variant']==v)} for v in roots}}
(root/'screenshots/mobile-performance.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result['medians']),flush=True)
