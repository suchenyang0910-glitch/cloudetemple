"""Exercise the actual page against an isolated loopback server; no production requests."""
import functools, http.server, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

root = Path(__file__).resolve().parents[1]
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(root)))
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = 'http://127.0.0.1:' + str(server.server_port)
with sync_playwright() as pw:
    browser = pw.webkit.launch()
    for case, expected in [('normal','fetch-blob'), ('debug','fetch-blob'), ('404','failed'), ('fetch-timeout','native-img'), ('decode-error','native-img'), ('decode-timeout','native-img'), ('native-timeout','failed')]:
        context = browser.new_context(viewport={'width':393,'height':659})
        page = context.new_page()
        page.add_init_script("""(()=>{
          window.mode='%s';window.calls={fetch:0,native:0};
          const f=window.fetch, decode=HTMLImageElement.prototype.decode, timer=window.setTimeout;
          window.fetch=(u,opts)=>{
            if(String(u).endsWith('.webp')){
              calls.fetch++;
              if(mode==='fetch-timeout')return new Promise((_,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))));
              if(mode==='404'||mode==='native-timeout')return Promise.resolve(new Response(null,{status:404}));
            }return f(u,opts);
          };
          const src=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
          Object.defineProperty(HTMLImageElement.prototype,'src',{...src,set(u){
            if(String(u).endsWith('.webp')){calls.native++;if(mode==='native-timeout')return;}
            src.set.call(this,u);
          }});
          HTMLImageElement.prototype.decode=function(){
             if(mode==='decode-error')return Promise.reject(new DOMException('decode','EncodingError'));
             if(mode==='decode-timeout')return new Promise(()=>{});
             return decode.call(this);
          };
          window.setTimeout=(fn,ms,...args)=>timer(fn,[8000,15000].includes(ms)?(mode==='normal'||mode==='debug'?ms:250):ms,...args);
        })()""" % case)
        if case=='404':page.route('**/*.webp',lambda r:r.fulfill(status=404))
        page.goto(origin+('/' if case=='normal' else '/?debug=img'))
        page.locator('.stage.scene-ready').wait_for()
        row=page.evaluate("async()=>[...(await import('/resources.js')).imageStatus.values()][0]")
        assert row['path']==expected,(case,row)
        assert page.evaluate('calls')=={'fetch':1,'native':int(expected!='fetch-blob')},(case,page.evaluate('calls'))
        assert page.locator('#img-debug').count()==int(case!='normal')
        if case!='normal':
            assert not page.locator('#img-debug').evaluate('(x)=>x.open')
            page.locator('#img-debug summary').click()
            page.locator('#img-debug pre').filter(has_text=expected).wait_for()
            page.locator('#img-debug summary').click()
        if case=='404':
            page.unroute('**/*.webp');page.evaluate("window.mode='normal'")
            page.locator('[data-action=retry]').click()
            page.locator('[data-action=retry]').wait_for(state='detached')
            assert page.evaluate('calls.fetch')==2
        print(case,expected,flush=True);context.close()
    browser.close()
server.shutdown()
